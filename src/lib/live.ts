// ----------------------------------------------------------------------------
//  کلاس آنلاین — موتور صوتی سمت مرورگر (WebRTC)
//  - مدرس برای هر حاضر یک اتصال صوتی مستقیم باز می‌کند و میکروفونش را می‌فرستد.
//  - دانش‌آموز صدای مدرس را می‌شنود؛ با اجازه‌ی مدرس میکروفونش هم روشن می‌شود.
//  - پیام‌های سیگنال‌دهی (پیشنهاد، پاسخ، ICE) از /api/classroom رد و بدل می‌شوند.
// ----------------------------------------------------------------------------

import { api } from "@/lib/store";
import type { LiveMember, LiveState } from "@/lib/server/classroom";

export type { LiveMember, LiveState };
export type LiveRole = "teacher" | "student";

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }],
};
const TICK_MS = 800;
const CONNECT_TIMEOUT_MS = 25_000;
const MIC: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

/** فرمان‌های سبک کلاس آنلاین (بدون وابستگی به وضعیت اتصال) */
export async function liveAction(room: string, body: Record<string, unknown>): Promise<void> {
  await api("/api/classroom", { method: "POST", body: { room, ...body } });
}

export interface LiveStatus {
  connected: number;
  connecting: number;
  micOn: boolean;
  /** دانش‌آموز: وارد کلاس شده است */
  joined: boolean;
  /** مدرس: در حال پخش صدا است */
  broadcasting: boolean;
}

export interface LiveHandlers {
  onState(state: LiveState): void;
  onStatus(status: LiveStatus): void;
  onError(message: string): void;
}

interface Peer {
  pc: RTCPeerConnection;
  joinedAt: number;
  createdAt: number;
  audio: HTMLAudioElement;
  /** دانش‌آموز: فرستنده‌ی صدای خودش را از این مبدل می‌گیرد */
  tx: RTCRtpTransceiver | null;
  pendingIce: RTCIceCandidateInit[];
  remoteSet: boolean;
  /** تا وقتی پیشنهاد/پاسخ فرستاده نشده، ICE در صف می‌ماند تا ترتیب حفظ شود */
  outbox: RTCIceCandidateInit[];
  offerSent: boolean;
}

// خاموش: مرورگر اگر فرستنده بدون track باشد پاسخ را recvonly می‌سازد؛ پس در مذاکره یک track بی‌صدا می‌گذاریم
let silentCtx: AudioContext | null = null;
function silentTrack(): MediaStreamTrack {
  if (!silentCtx) silentCtx = new AudioContext();
  return silentCtx.createMediaStreamDestination().stream.getAudioTracks()[0];
}

function errText(err: unknown, fallback: string): string {
  if (err instanceof DOMException) {
    if (err.name === "NotAllowedError") return "دسترسی به میکروفون داده نشد. اجازه‌ی میکروفون را در مرورگر فعال کنید.";
    if (err.name === "NotFoundError") return "میکروفونی پیدا نشد.";
  }
  return err instanceof Error && err.message ? err.message : fallback;
}

export class LiveClient {
  private readonly role: LiveRole;
  private readonly roomId: string;
  private readonly selfId: string;
  private h: LiveHandlers;

  private timer: ReturnType<typeof setInterval> | null = null;
  private busy = false;
  private stopped = false;
  private state: LiveState | null = null;

  /** ارسال سیگنال‌ها پشت سر هم (ترتیب id در سرور حفظ شود) */
  private sendChain: Promise<unknown> = Promise.resolve();
  private readonly peers = new Map<string, Peer>();
  private readonly cooldown = new Map<string, number>();
  private readonly failures = new Map<string, number>();

  /** مدرس: میکروفون اصلی کلاس */
  private mic: MediaStream | null = null;
  /** دانش‌آموز: آیا خواسته وارد کلاس شود؛ و میکروفون زمان اجازه‌ی صحبت */
  private joined = false;
  /** مدرس: کلاس شروع شده و پخش فعال است */
  private broadcasting = false;
  private localMic: MediaStream | null = null;
  private speakingOn = false;

  constructor(opts: { roomId: string; role: LiveRole; selfId: string; handlers: LiveHandlers }) {
    this.roomId = opts.roomId;
    this.role = opts.role;
    this.selfId = opts.selfId;
    this.h = opts.handlers;
  }

  // -------------------------------------------------------------------------
  // فرمان‌های عمومی
  // -------------------------------------------------------------------------

  /** مدرس: کلاس را شروع می‌کند و میکروفون را روشن می‌کند */
  async goLive(): Promise<void> {
    if (this.role !== "teacher") return;
    if (!this.mic) this.mic = await navigator.mediaDevices.getUserMedia({ audio: MIC, video: false });
    await api("/api/classroom", { method: "POST", body: { room: this.roomId, action: "start" } });
    this.broadcasting = true;
    this.begin();
    this.emitStatus();
  }

  /** مدرس: پایان کلاس برای همه */
  async endLive(): Promise<void> {
    await api("/api/classroom", { method: "POST", body: { room: this.roomId, action: "end" } });
    this.broadcasting = false;
    this.closeAllPeers();
    this.releaseMic();
    this.emitStatus();
  }

  /** دانش‌آموز: ورود به کلاس (با کلیک کاربر، تا پخش صدا مجاز شود) */
  async join(): Promise<void> {
    this.joined = true;
    this.begin();
    this.emitStatus();
    await this.postJoin();
  }

  /** جایگزینی شنونده‌ها (صفحه‌ی کلاس باز/بسته می‌شود، اما پخش ادامه دارد) */
  setHandlers(h: LiveHandlers): void {
    this.h = h;
    this.emitStatus();
  }

  /** فقط مشاهده‌ی وضعیت کلاس (بدون ورود) */
  watch(): void {
    this.begin();
  }

  /** آیا این موتور باید در پس‌زمینه زنده بماند؟ (پخش مدرس یا حضور دانش‌آموز) */
  isActive(): boolean {
    return this.broadcasting || this.joined;
  }

  /** دانش‌آموز: خروج از کلاس (مشاهده‌ی وضعیت ادامه می‌یابد) */
  async leave(): Promise<void> {
    this.joined = false;
    this.stopSpeaking();
    this.closeAllPeers();
    this.emitStatus();
    try {
      await api("/api/classroom", { method: "POST", body: { room: this.roomId, action: "leave" } });
    } catch {
      // خروج بی‌اثر است؛ سرور حاضر را پس از مدتی حذف می‌کند
    }
    if (!this.isActive()) this.stopTimer();
  }

  /** وقتی صفحه بسته می‌شود: اگر کاری در جریان نیست، موتور متوقف شود */
  releaseIfIdle(): void {
    if (this.isActive()) return;
    this.stopTimer();
    this.closeAllPeers();
    this.releaseMic();
  }

  /** مدرس یا دانش‌آموز: روشن/خاموش کردن میکروفون خودش */
  setMicOn(on: boolean): void {
    const stream = this.role === "teacher" ? this.mic : this.localMic;
    for (const t of stream?.getAudioTracks() ?? []) t.enabled = on;
    this.emitStatus();
  }

  isMicOn(): boolean {
    const stream = this.role === "teacher" ? this.mic : this.localMic;
    return !!stream?.getAudioTracks().some((t) => t.enabled);
  }

  /** آزادسازی کامل منابع (هنگام بستن صفحه) */
  destroy(): void {
    this.stopped = true;
    this.stopTimer();
    this.closeAllPeers();
    this.releaseMic();
    this.stopSpeakingTracks();
  }

  // -------------------------------------------------------------------------
  // حلقه‌ی همگام‌سازی
  // -------------------------------------------------------------------------

  private begin(): void {
    if (this.timer || this.stopped) return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    void this.tick();
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (this.busy || this.stopped) return;
    this.busy = true;
    try {
      const st = await api<LiveState>(`/api/classroom?room=${encodeURIComponent(this.roomId)}`);
      this.state = st;
      this.h.onState(st);
      if (this.role === "teacher") await this.teacherSync(st);
      else await this.studentSync(st);
      this.emitStatus();
    } catch (err) {
      this.h.onError(errText(err, "ارتباط با کلاس آنلاین قطع شد؛ دوباره تلاش می‌شود."));
    } finally {
      this.busy = false;
    }
  }

  private emitStatus(): void {
    let connected = 0;
    let connecting = 0;
    for (const p of this.peers.values()) {
      if (p.pc.connectionState === "connected") connected++;
      else if (p.pc.connectionState === "new" || p.pc.connectionState === "connecting") connecting++;
    }
    this.h.onStatus({
      connected,
      connecting,
      micOn: this.isMicOn(),
      joined: this.joined,
      broadcasting: this.broadcasting,
    });
  }

  private async postJoin(): Promise<void> {
    try {
      await api("/api/classroom", { method: "POST", body: { room: this.roomId, action: "join" } });
    } catch (err) {
      // کلاس هنوز شروع نشده یا ظرفیت پر است؛ حلقه دوباره تلاش می‌کند
      this.h.onError(errText(err, "ورود به کلاس ممکن نشد."));
    }
  }

  // -------------------------------------------------------------------------
  // مدرس
  // -------------------------------------------------------------------------

  private async teacherSync(st: LiveState): Promise<void> {
    if (!st.live) {
      this.broadcasting = false;
      this.closeAllPeers();
      this.releaseMic();
      this.emitStatus();
      this.h.onError("کلاس پایان یافته است.");
      return;
    }

    for (const s of st.signals) {
      const peer = this.peers.get(s.from);
      if (!peer) continue;
      if (s.kind === "answer") {
        await peer.pc.setRemoteDescription(s.payload as RTCSessionDescriptionInit);
        peer.remoteSet = true;
        await this.flushIce(peer);
      } else if (s.kind === "ice") {
        await this.addIce(peer, s.payload as RTCIceCandidateInit);
      }
    }

    const online = new Map(st.members.filter((m) => m.online).map((m) => [m.userId, m]));
    // حاضرِ رفته یا وارد دوباره‌شده: اتصال قبلی بسته شود
    for (const [uid, peer] of this.peers) {
      const m = online.get(uid);
      if (!m || m.joinedAt !== peer.joinedAt) this.closePeer(uid);
    }
    // اتصالی که نرسیده یا قطع شده، با تأخیر دوباره باز می‌شود
    for (const [uid, peer] of this.peers) {
      const st2 = peer.pc.connectionState;
      const stuck = st2 !== "connected" && Date.now() - peer.createdAt > CONNECT_TIMEOUT_MS;
      if (st2 === "failed" || st2 === "closed" || stuck) {
        this.markFailed(uid);
        this.closePeer(uid);
      }
    }
    for (const m of online.values()) {
      if (this.peers.has(m.userId)) continue;
      if ((this.cooldown.get(m.userId) ?? 0) > Date.now()) continue;
      if (this.peers.size >= st.maxListeners) break;
      await this.createTeacherPeer(m);
    }
  }

  private markFailed(uid: string): void {
    const n = (this.failures.get(uid) ?? 0) + 1;
    this.failures.set(uid, n);
    this.cooldown.set(uid, Date.now() + Math.min(30_000, 3_000 * n));
  }

  private async createTeacherPeer(m: LiveMember): Promise<void> {
    const peer = this.newPeer(m.userId, m.joinedAt);
    // میکروفون مدرس برای حاضر؛ حاضر هم مبدل صوتی دارد تا بتواند صحبت کند
    if (this.mic) for (const t of this.mic.getAudioTracks()) peer.pc.addTrack(t, this.mic);
    else peer.tx = peer.pc.addTransceiver(silentTrack(), { direction: "sendrecv" });
    try {
      const offer = await peer.pc.createOffer();
      await peer.pc.setLocalDescription(offer);
      await this.send(m.userId, "offer", peer.pc.localDescription?.toJSON());
      peer.offerSent = true;
      await this.drainOutbox(m.userId, peer);
    } catch {
      this.markFailed(m.userId);
      this.closePeer(m.userId);
    }
  }

  // -------------------------------------------------------------------------
  // دانش‌آموز
  // -------------------------------------------------------------------------

  private async studentSync(st: LiveState): Promise<void> {
    if (!st.live) {
      this.closeAllPeers();
      this.stopSpeaking();
      if (this.joined) {
        this.joined = false;
        this.emitStatus();
        this.h.onError("کلاس پایان یافته است.");
      }
      return;
    }
    if (!this.joined) return;

    const present = st.members.some((m) => m.userId === this.selfId);
    if (!present) await this.postJoin();

    const teacherId = st.teacherId;
    for (const s of st.signals) {
      if (!teacherId || s.from !== teacherId) continue;
      if (s.kind === "offer") {
        await this.answerTeacher(teacherId, s.payload as RTCSessionDescriptionInit);
      } else if (s.kind === "ice") {
        const peer = this.peers.get(teacherId);
        if (peer) await this.addIce(peer, s.payload as RTCIceCandidateInit);
      }
    }

    // صحبت کردن با اجازه‌ی مدرس
    const me = st.members.find((m) => m.userId === this.selfId);
    if (me?.speaking && !this.speakingOn) await this.startSpeaking();
    if (!me?.speaking && this.speakingOn) this.stopSpeaking();

    const p = teacherId ? this.peers.get(teacherId) : undefined;
    if (p && (p.pc.connectionState === "failed" || p.pc.connectionState === "closed")) this.closePeer(teacherId!);
  }

  private async answerTeacher(teacherId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    this.closePeer(teacherId);
    const peer = this.newPeer(teacherId, 0);
    try {
      await peer.pc.setRemoteDescription(offer);
      // مبدل صوتی که از پیشنهاد مدرس ساخته شد: ارسال‌وشنود + track بی‌صدا تا پاسخ sendrecv باشد
      const tx = peer.pc.getTransceivers().find((t) => t.receiver.track.kind === "audio");
      if (!tx) throw new Error("no audio transceiver in offer");
      tx.direction = "sendrecv";
      await tx.sender.replaceTrack(silentTrack());
      peer.tx = tx;
      peer.remoteSet = true;
      await this.flushIce(peer);
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      await this.send(teacherId, "answer", peer.pc.localDescription?.toJSON());
      peer.offerSent = true;
      await this.drainOutbox(teacherId, peer);
      if (this.speakingOn && this.localMic && peer.tx) {
        await peer.tx.sender.replaceTrack(this.localMic.getAudioTracks()[0] ?? null);
      }
    } catch {
      this.closePeer(teacherId);
    }
  }

  private async startSpeaking(): Promise<void> {
    if (this.speakingOn) return;
    this.speakingOn = true;
    try {
      this.localMic = await navigator.mediaDevices.getUserMedia({ audio: MIC, video: false });
    } catch (err) {
      this.speakingOn = false;
      this.h.onError(errText(err, "میکروفون در دسترس نیست."));
      return;
    }
    const track = this.localMic.getAudioTracks()[0] ?? null;
    const peer = this.state?.teacherId ? this.peers.get(this.state.teacherId) : undefined;
    if (peer?.tx && track) await peer.tx.sender.replaceTrack(track);
  }

  private stopSpeaking(): void {
    this.speakingOn = false;
    this.stopSpeakingTracks();
  }

  private stopSpeakingTracks(): void {
    const peer = this.state?.teacherId ? this.peers.get(this.state.teacherId) : undefined;
    if (peer?.tx) void peer.tx.sender.replaceTrack(silentTrack()).catch(() => undefined);
    for (const t of this.localMic?.getTracks() ?? []) t.stop();
    this.localMic = null;
  }

  // -------------------------------------------------------------------------
  // اتصال WebRTC مشترک
  // -------------------------------------------------------------------------

  private newPeer(remoteId: string, joinedAt: number): Peer {
    this.closePeer(remoteId);
    const pc = new RTCPeerConnection(RTC_CONFIG);
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.setAttribute("playsinline", "");
    audio.style.display = "none";
    document.body.appendChild(audio);

    const peer: Peer = {
      pc,
      joinedAt,
      createdAt: Date.now(),
      audio,
      tx: null,
      pendingIce: [],
      remoteSet: false,
      outbox: [],
      offerSent: false,
    };
    this.peers.set(remoteId, peer);

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const init = e.candidate.toJSON();
      if (peer.offerSent) void this.send(remoteId, "ice", init);
      else peer.outbox.push(init);
    };
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0] ?? new MediaStream([e.track]);
      void audio.play().catch(() => undefined);
    };
    pc.onconnectionstatechange = () => this.emitStatus();
    return peer;
  }

  private async drainOutbox(remoteId: string, peer: Peer): Promise<void> {
    const items = peer.outbox.splice(0);
    for (const init of items) await this.send(remoteId, "ice", init);
  }

  private async addIce(peer: Peer, init: RTCIceCandidateInit): Promise<void> {
    if (!peer.remoteSet) {
      peer.pendingIce.push(init);
      return;
    }
    try {
      await peer.pc.addIceCandidate(init);
    } catch {
      // کاندید نامعتبر یا دیرهنگام؛ اتصال با بقیه‌ی کاندیدها ادامه می‌یابد
    }
  }

  private async flushIce(peer: Peer): Promise<void> {
    const items = peer.pendingIce.splice(0);
    for (const init of items) {
      try {
        await peer.pc.addIceCandidate(init);
      } catch {
        // بی‌اثر
      }
    }
  }

  private send(to: string, kind: "offer" | "answer" | "ice", payload: unknown): Promise<unknown> {
    const run = () => api("/api/classroom", { method: "POST", body: { room: this.roomId, action: "signal", to, kind, payload } });
    this.sendChain = this.sendChain.then(run, run);
    return this.sendChain;
  }

  private closePeer(remoteId: string): void {
    const peer = this.peers.get(remoteId);
    if (!peer) return;
    this.peers.delete(remoteId);
    peer.pc.onicecandidate = null;
    peer.pc.ontrack = null;
    peer.pc.onconnectionstatechange = null;
    try {
      peer.pc.close();
    } catch {
      // بی‌اثر
    }
    peer.audio.srcObject = null;
    peer.audio.remove();
  }

  private closeAllPeers(): void {
    for (const id of [...this.peers.keys()]) this.closePeer(id);
  }

  private releaseMic(): void {
    for (const t of this.mic?.getTracks() ?? []) t.stop();
    this.mic = null;
  }
}
