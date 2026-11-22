// ----------------------------------------------------------------------------
//  موتور کلاس آنلاین روی LiveKit (کلاینت)
//  - یک اتصال یکتا برای کل برنامه؛ بستن صفحه اتصال را قطع نمی‌کند (پخش مدرس ادامه دارد).
//  - صدا/تصویر/اشتراک صفحه: رسانه‌ی LiveKit. دست بالا، چت، اجازه‌ی صحبت و وضعیت: data channel همان اتاق (تقریباً آنی).
//  - هر تغییر با useSyncExternalStore به UI می‌رسد؛ نیازی به polling نیست.
// ----------------------------------------------------------------------------

import {
  Room,
  RoomEvent,
  Track,
  type LocalParticipant,
  type Participant,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type VideoCaptureOptions,
} from "livekit-client";
import { api } from "@/lib/store";
import { installNativeScreenShare, isNativeApp } from "@/lib/native";

const TOPIC = "classroom";
const MAX_CHAT = 300;

export type ShareSource = "camera-back" | "camera-front" | "camera-device" | "screen";

export interface ChatMsg {
  id: string;
  from: string;
  name: string;
  text: string;
  ts: number;
  mine: boolean;
}

export interface Peer {
  identity: string;
  name: string;
  teacher: boolean;
  isSelf: boolean;
  hand: boolean;
  speaking: boolean;
  canSpeak: boolean;
  mic: boolean;
  camera: boolean;
  screen: boolean;
}

export interface Share {
  key: string;
  identity: string;
  name: string;
  source: "camera" | "screen";
  track: Track;
  isSelf: boolean;
}

/**
 * باید مستقیم داخل کلیک کاربر صدا زده شود (قبل از هر await): مرورگر فقط در همین لحظه
 * اجازه‌ی پخش صدا را برای صفحه باز می‌کند؛ در غیر این صورت صدای کلاس تا چند ثانیه قطع می‌ماند.
 */
export function unlockAudioNow(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    void ctx.resume().catch(() => undefined);
    setTimeout(() => void ctx.close().catch(() => undefined), 3000);
  } catch {
    // مرورگر قدیمی: کاری نمی‌شود
  }
}

export type Phase = "idle" | "connecting" | "connected" | "reconnecting" | "ended" | "error";

export interface LiveSnapshot {
  roomId: string | null;
  phase: Phase;
  error: string | null;
  isTeacher: boolean;
  peers: Peer[];
  shares: Share[];
  chat: ChatMsg[];
  chatOpen: boolean;
  selfHand: boolean;
  mic: boolean;
  camera: boolean;
  screen: boolean;
  canSpeak: boolean;
  audioBlocked: boolean;
}

type Msg =
  | { t: "hand"; raised: boolean }
  | { t: "chat"; id: string; text: string; ts: number; name: string }
  | { t: "chatState"; open: boolean };

const EMPTY: LiveSnapshot = {
  roomId: null,
  phase: "idle",
  error: null,
  isTeacher: false,
  peers: [],
  shares: [],
  chat: [],
  chatOpen: true,
  selfHand: false,
  mic: false,
  camera: false,
  screen: false,
  canSpeak: false,
  audioBlocked: false,
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** خطای ذخیره‌ی چت/وضعیت کلاس؛ همان کانال خطای عمومی برنامه (نمایش به کاربر) */
function reportChatError(message: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("hamdel:error", { detail: message }));
}

interface ChatHistoryRow {
  id: string;
  userId: string;
  name: string;
  text: string;
  createdAt: number;
}

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.matchMedia("(pointer: coarse)").matches);
}

export function canShareScreen(): boolean {
  if (isNativeApp()) return true;
  return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
}

function errorText(err: unknown, fallback: string): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") return "دسترسی به میکروفون یا دوربین داده نشد. از تنظیمات مرورگر اجازه بدهید.";
    if (err.name === "NotFoundError") return "میکروفون یا دوربینی پیدا نشد.";
    if (err.name === "NotReadableError") return "دستگاه توسط برنامه‌ی دیگری در حال استفاده است.";
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

class LiveSession {
  private room: Room | null = null;
  private snap: LiveSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  private hands = new Set<string>();
  private speakingIds = new Set<string>();
  private audioHost: HTMLDivElement | null = null;
  private emitTimer: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;
  /** ذخیره‌ی وضعیت چت به ترتیب ارسال می‌شود تا باز و بسته‌ی سریع مدرس جابه‌جا نشود */
  private chatSave: Promise<unknown> = Promise.resolve();

  // ---- store ----------------------------------------------------------------
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snap;

  private emitSoon() {
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = null;
      this.rebuild();
    }, 30);
  }

  private patch(p: Partial<LiveSnapshot>) {
    this.snap = { ...this.snap, ...p };
    this.listeners.forEach((fn) => fn());
  }

  private rebuild() {
    const room = this.room;
    if (!room) return;
    const local = room.localParticipant;
    const remotes = [...room.remoteParticipants.values()];
    const isTeacher = this.snap.isTeacher;

    const peers: Peer[] = [local, ...remotes].map((p) => this.peerOf(p, p === local));
    peers.sort((a, b) => Number(b.teacher) - Number(a.teacher) || a.name.localeCompare(b.name, "fa"));

    const shares: Share[] = [];
    for (const p of [local, ...remotes]) {
      for (const pub of p.trackPublications.values()) {
        if (!pub.track || pub.isMuted) continue;
        if (pub.source !== Track.Source.Camera && pub.source !== Track.Source.ScreenShare) continue;
        shares.push({
          key: `${p.identity}:${pub.trackSid}`,
          identity: p.identity,
          name: p.name || "کاربر",
          source: pub.source === Track.Source.Camera ? "camera" : "screen",
          track: pub.track,
          isSelf: p === local,
        });
      }
    }

    this.patch({
      peers,
      shares,
      canSpeak: this.canSpeakNow(),
      mic: local.isMicrophoneEnabled,
      camera: local.isCameraEnabled,
      screen: local.isScreenShareEnabled,
      selfHand: this.hands.has(local.identity),
      audioBlocked: !room.canPlaybackAudio,
      isTeacher,
    });
  }

  private peerOf(p: Participant, isSelf: boolean): Peer {
    const pub = (src: Track.Source) => {
      const x = p.getTrackPublication(src);
      return !!x && !x.isMuted && !!x.track;
    };
    return {
      identity: p.identity,
      name: p.name || "کاربر",
      teacher: this.isTeacherParticipant(p),
      isSelf,
      hand: this.hands.has(p.identity),
      speaking: this.speakingIds.has(p.identity),
      canSpeak: this.isTeacherParticipant(p) || !!p.permissions?.canPublish,
      mic: pub(Track.Source.Microphone),
      camera: pub(Track.Source.Camera),
      screen: pub(Track.Source.ScreenShare),
    };
  }

  private canSpeakNow(): boolean {
    return !!this.room?.localParticipant.permissions?.canPublish;
  }

  private isTeacherParticipant(p: Participant): boolean {
    try {
      return !!JSON.parse(p.metadata || "{}").teacher;
    } catch {
      return false;
    }
  }

  // ---- اتصال -------------------------------------------------------------------
  /** اتصال به کلاس زنده. اگر به همان کلاس وصل باشیم، دوباره وصل نمی‌شود. */
  async connect(roomId: string, joinToken?: string | null, opts?: { micOn?: boolean }): Promise<void> {
    if (this.room && this.snap.roomId === roomId && this.snap.phase !== "error" && this.snap.phase !== "ended") return;
    await this.disconnect();
    const seq = ++this.seq;
    this.patch({ ...EMPTY, roomId, phase: "connecting" });
    try {
      const res = await api<{ url: string; token: string; canPublish: boolean }>("/api/classroom/token", {
        method: "POST",
        body: { room: roomId, joinToken: joinToken ?? undefined },
      });
      if (seq !== this.seq) return;
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        videoCaptureDefaults: { resolution: { width: 640, height: 360, frameRate: 24 } },
      });
      this.room = room;
      this.bind(room);
      await room.connect(res.url, res.token);
      if (seq !== this.seq) {
        await room.disconnect();
        return;
      }
      const isTeacher = !!res.canPublish;
      this.patch({ phase: "connected", isTeacher });
      this.rebuild();
      // مدرس بلافاصله بعد از شروع کلاس میکروفون را روشن می‌کند؛ منتظر کلیک دوم نمی‌ماند
      if (isTeacher && opts?.micOn) {
        void room.localParticipant
          .setMicrophoneEnabled(true, { echoCancellation: true, noiseSuppression: true })
          .then(() => this.rebuild())
          .catch(() => this.rebuild());
      }
      void this.loadHistory(roomId, seq, isTeacher);
    } catch (err) {
      if (seq !== this.seq) return;
      this.room = null;
      this.patch({ phase: "error", error: errorText(err, "ورود به کلاس انجام نشد؛ دوباره تلاش کنید.") });
    }
  }

  /** تاریخچه و وضعیت چت را از پایگاه‌داده می‌خواند و با پیام‌های زنده‌ی رسیده ادغام می‌کند (بدون تکرار) */
  private async loadHistory(roomId: string, seq: number, announce: boolean) {
    try {
      const h = await api<{ chatOpen: boolean; messages: ChatHistoryRow[] }>(
        `/api/classroom/chat?room=${encodeURIComponent(roomId)}`,
      );
      if (seq !== this.seq || !this.room) return;
      const me = this.room.localParticipant.identity;
      const history: ChatMsg[] = h.messages.map((m) => ({
        id: m.id,
        from: m.userId,
        name: m.name,
        text: m.text,
        ts: m.createdAt,
        mine: m.userId === me,
      }));
      const seen = new Set(history.map((m) => m.id));
      const live = this.snap.chat.filter((m) => !seen.has(m.id));
      this.patch({ chat: [...history, ...live].slice(-MAX_CHAT), chatOpen: h.chatOpen });
      if (announce) this.announceChatState();
    } catch {
      if (seq !== this.seq) return;
      reportChatError("تاریخچه‌ی چت کلاس بارگذاری نشد؛ دوباره وارد کلاس شوید.");
    }
  }

  private bind(room: Room) {
    room
      .on(RoomEvent.ParticipantConnected, (p: RemoteParticipant) => {
        // مدرس وضعیت چت و اجازه‌ها را به حاضر تازه‌وارد می‌دهد
        if (this.snap.isTeacher) this.announceChatState([p.identity]);
        this.emitSoon();
      })
      .on(RoomEvent.ParticipantDisconnected, (p: RemoteParticipant) => {
        this.hands.delete(p.identity);
        this.emitSoon();
      })
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack, pub: RemoteTrackPublication) => {
        if (track.kind === Track.Kind.Audio) this.attachAudio(track, pub.trackSid);
        this.emitSoon();
      })
      .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack, pub: RemoteTrackPublication) => {
        track.detach().forEach((el) => el.remove());
        void pub;
        this.emitSoon();
      })
      .on(RoomEvent.TrackPublished, () => this.emitSoon())
      .on(RoomEvent.TrackUnpublished, () => this.emitSoon())
      .on(RoomEvent.LocalTrackPublished, () => this.emitSoon())
      .on(RoomEvent.LocalTrackUnpublished, () => this.emitSoon())
      .on(RoomEvent.TrackMuted, () => this.emitSoon())
      .on(RoomEvent.TrackUnmuted, () => this.emitSoon())
      .on(RoomEvent.ParticipantPermissionsChanged, (_prev: unknown, p: Participant) => {
        // اجازه‌ی صحبت دانش‌آموز عوض شد؛ اگر لغو شد، صدایش خودکار قطع می‌شود
        if (p === room.localParticipant && !this.canSpeakNow()) {
          void room.localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
          void room.localParticipant.setCameraEnabled(false).catch(() => undefined);
          void room.localParticipant.setScreenShareEnabled(false).catch(() => undefined);
        }
        this.emitSoon();
      })
      .on(RoomEvent.ParticipantMetadataChanged, () => this.emitSoon())
      .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
        this.speakingIds = new Set(speakers.map((s) => s.identity));
        this.emitSoon();
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => this.emitSoon())
      .on(RoomEvent.DataReceived, (payload: Uint8Array, p?: RemoteParticipant, _k?: unknown, topic?: string) => {
        if (topic !== TOPIC) return;
        this.onData(payload, p);
      })
      .on(RoomEvent.Reconnecting, () => this.patch({ phase: "reconnecting" }))
      .on(RoomEvent.Reconnected, () => {
        this.patch({ phase: "connected" });
        this.rebuild();
      })
      .on(RoomEvent.Disconnected, () => {
        // پایان کلاس توسط مدرس یا قطع شبکه؛ در هر صورت اتاق داخلی پاک می‌شود
        const ended = this.snap.phase === "connected" || this.snap.phase === "reconnecting";
        this.cleanupMedia();
        this.room = null;
        this.patch({ phase: ended ? "ended" : this.snap.phase, error: null, peers: [], shares: [], mic: false, camera: false, screen: false, canSpeak: false });
      });
  }

  private attachAudio(track: RemoteTrack, sid: string) {
    if (!this.audioHost) {
      this.audioHost = document.createElement("div");
      this.audioHost.id = "classroom-audio";
      this.audioHost.style.display = "none";
      document.body.appendChild(this.audioHost);
    }
    const el = track.attach();
    el.dataset.sid = sid;
    this.audioHost.appendChild(el);
    void this.room?.startAudio().catch(() => undefined);
  }

  /** دکمه‌ی «باز کردن صدا» — حتماً از یک کلیک کاربر صدا می‌زند تا مرورگر موبایل پخش را آزاد کند */
  async enableSound(): Promise<void> {
    if (!this.room) return;
    await this.room.startAudio();
    this.room.remoteParticipants.forEach((p) =>
      p.audioTrackPublications.forEach((pub) => {
        if (pub.track) pub.track.attach();
      }),
    );
    this.rebuild();
  }

  private cleanupMedia() {
    this.audioHost?.replaceChildren();
    this.hands.clear();
    this.speakingIds.clear();
  }

  async disconnect(): Promise<void> {
    this.seq++;
    const room = this.room;
    this.room = null;
    this.cleanupMedia();
    if (room) await room.disconnect().catch(() => undefined);
    if (this.snap.roomId) this.patch({ ...EMPTY });
  }

  // ---- داده‌ی کلاس ----------------------------------------------------------------
  private send(msg: Msg, identities?: string[]) {
    const local = this.room?.localParticipant;
    if (!local) return;
    void local
      .publishData(encoder.encode(JSON.stringify(msg)), {
        reliable: true,
        topic: TOPIC,
        destinationIdentities: identities,
      })
      .catch(() => undefined);
  }

  private onData(payload: Uint8Array, p?: RemoteParticipant) {
    let msg: Msg;
    try {
      msg = JSON.parse(decoder.decode(payload)) as Msg;
    } catch {
      return;
    }
    const from = p?.identity ?? "";
    const fromTeacher = !!p && this.isTeacherParticipant(p);
    if (msg.t === "hand") {
      if (!from) return;
      if (msg.raised) this.hands.add(from);
      else this.hands.delete(from);
      this.emitSoon();
      return;
    }
    if (msg.t === "chatState") {
      // فقط مدرس می‌تواند چت را باز و بسته کند
      if (!fromTeacher) return;
      this.patch({ chatOpen: msg.open });
      return;
    }
    if (msg.t === "chat") {
      // مدرس وقتی چت بسته است پیام دانش‌آموزان را نمی‌پذیرد
      if (this.snap.isTeacher && !this.snap.chatOpen && !fromTeacher) return;
      const item: ChatMsg = {
        id: String(msg.id).slice(0, 64),
        from,
        name: String(msg.name ?? "کاربر").slice(0, 60),
        text: String(msg.text ?? "").slice(0, 1000),
        ts: Number(msg.ts) || Date.now(),
        mine: false,
      };
      if (this.snap.chat.some((m) => m.id === item.id)) return; // پیام قبلاً از تاریخچه رسیده
      const chat = [...this.snap.chat, item].slice(-MAX_CHAT);
      this.patch({ chat });
    }
  }

  private announceChatState(identities?: string[]) {
    this.send({ t: "chatState", open: this.snap.chatOpen }, identities);
  }

  // ---- کنش‌های کاربر ---------------------------------------------------------------
  /** مدرس: باز/بسته کردن چت برای همه */
  setChatOpen(open: boolean) {
    if (!this.snap.isTeacher) return;
    const roomId = this.snap.roomId;
    this.patch({ chatOpen: open });
    this.announceChatState(); // زنده برای همه‌ی حاضران
    if (!roomId) return;
    // ماندگار: وضعیت در پایگاه‌داده ذخیره می‌شود تا ورود دوباره همان را نشان دهد
    this.chatSave = this.chatSave
      .then(() => api("/api/classroom", { method: "POST", body: { room: roomId, action: "chat", open } }))
      .catch((err) => reportChatError((err as Error).message || "وضعیت چت ذخیره نشد."));
  }

  sendChat(text: string) {
    const clean = text.trim().slice(0, 1000);
    if (!clean || !this.room || !this.snap.chatOpen) return;
    const local = this.room.localParticipant;
    const msg: Msg = { t: "chat", id: `${local.identity}-${Date.now()}-${++this.seq}`, text: clean, ts: Date.now(), name: local.name || "کاربر" };
    this.send(msg); // نمایش آنی برای حاضران
    const item: ChatMsg = { id: msg.id, from: local.identity, name: msg.name, text: clean, ts: msg.ts, mine: true };
    this.patch({ chat: [...this.snap.chat, item].slice(-MAX_CHAT) });
    void this.persistChat(this.snap.roomId, msg.id, clean);
  }

  /** ذخیره‌ی پیام در پایگاه‌داده؛ خطای گذرا دوباره تلاش می‌شود */
  private async persistChat(roomId: string | null, id: string, text: string) {
    if (!roomId) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await api("/api/classroom/chat", { method: "POST", body: { room: roomId, id, text } });
        return;
      } catch (err) {
        const status = (err as { status?: number }).status ?? 0;
        // خطای منطقی (چت بسته، کلاس تمام‌شده) دوباره فرستاده نمی‌شود
        if (status >= 400 && status < 500) {
          reportChatError((err as Error).message);
          return;
        }
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    reportChatError("پیام شما در پایگاه‌داده ذخیره نشد؛ اتصال اینترنت را بررسی کنید.");
  }

  toggleHand() {
    if (!this.room || this.snap.isTeacher) return;
    const local = this.room.localParticipant;
    const raised = !this.hands.has(local.identity);
    if (raised) this.hands.add(local.identity);
    else this.hands.delete(local.identity);
    this.send({ t: "hand", raised });
    this.patch({ selfHand: raised });
    this.emitSoon();
  }

  /** مدرس: اجازه‌ی صحبت (میکروفون، دوربین، صفحه) به یک نفر می‌دهد یا می‌گیرد */
  async grant(identity: string, allowed: boolean): Promise<void> {
    if (!this.snap.isTeacher || !this.snap.roomId) return;
    await api("/api/classroom", {
      method: "POST",
      body: { room: this.snap.roomId, action: "speak", userId: identity, allowed },
    });
    this.hands.delete(identity);
    this.emitSoon();
  }

  /** میکروفون: باید از یک کلیک کاربر صدا بزند تا مجوز مرورگر گرفته شود */
  async setMic(on: boolean): Promise<void> {
    const local = this.room?.localParticipant;
    if (!local) return;
    if (on && !this.canSpeakNow() && !this.snap.isTeacher) throw new Error("هنوز اجازه‌ی صحبت ندارید. منتظر تأیید مدرس بمانید.");
    try {
      await local.setMicrophoneEnabled(on, { echoCancellation: true, noiseSuppression: true });
    } catch (err) {
      throw new Error(errorText(err, "میکروفون روشن نشد."));
    }
    this.rebuild();
  }

  /** اشتراک‌گذاری منبع تصویر یا صفحه؛ هر شرکت‌کننده منبع خودش را انتخاب می‌کند */
  async shareSource(source: ShareSource, deviceId?: string): Promise<void> {
    const local = this.room?.localParticipant;
    if (!local) return;
    if (!this.canSpeakNow() && !this.snap.isTeacher) throw new Error("هنوز اجازه‌ی اشتراک ندارید. منتظر تأیید مدرس بمانید.");
    try {
      if (source === "screen") {
        await local.setCameraEnabled(false);
        // در اپ اندروید صدای سیستم ضبط نمی‌شود؛ فقط تصویر
        await local.setScreenShareEnabled(true, { audio: !isNativeApp() });
      } else {
        await local.setScreenShareEnabled(false);
        await local.setCameraEnabled(true, camOptions(source, deviceId));
      }
    } catch (err) {
      throw new Error(errorText(err, "اشتراک‌گذاری انجام نشد."));
    }
    this.rebuild();
  }

  async stopShares(): Promise<void> {
    const local = this.room?.localParticipant;
    if (!local) return;
    await local.setCameraEnabled(false).catch(() => undefined);
    await local.setScreenShareEnabled(false).catch(() => undefined);
    this.rebuild();
  }

  /** مدرس: پایان کلاس برای همه */
  async endClass(): Promise<void> {
    if (!this.snap.isTeacher || !this.snap.roomId) return;
    await api("/api/classroom", { method: "POST", body: { room: this.snap.roomId, action: "end" } });
    await this.disconnect();
    this.patch({ phase: "ended" });
  }
}

function camOptions(source: "camera-back" | "camera-front" | "camera-device", deviceId?: string): VideoCaptureOptions {
  if (source === "camera-device" && deviceId) return { deviceId: { exact: deviceId } };
  if (source === "camera-front") return { facingMode: "user" };
  if (source === "camera-back") return { facingMode: "environment" };
  return {};
}

/** لیست وبکم‌های متصل (ویندوز/دسکتاپ) */
export async function listCameras(): Promise<{ id: string; label: string }[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === "videoinput")
    .map((d, i) => ({ id: d.deviceId, label: d.label || `دوربین ${i + 1}` }));
}

/** یک نمونه‌ی سراسری: بستن صفحه‌ی کلاس، اتصال را قطع نمی‌کند */
export const liveSession = new LiveSession();

// در اپ اندروید، اشتراک صفحه‌ی گوشی از مسیر بومی انجام می‌شود
installNativeScreenShare();

export type { LocalParticipant };
