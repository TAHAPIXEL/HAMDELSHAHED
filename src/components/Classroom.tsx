"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Camera, Hand, Lock, LogOut, Mic, MicOff, Monitor, Power, Radio, Send, Unlock, Users, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import {
  canShareScreen,
  isMobileDevice,
  liveSession,
  listCameras,
  type Peer,
  type Share,
  type ShareSource,
} from "@/lib/live";
import { api } from "@/lib/store";
import { GRADES, SECTIONS, type Grade, isStaff } from "@/lib/model";
import type { User } from "@/lib/model";
import { Btn, Chip, Empty, Modal, useToast } from "./ui";

/** شناسه‌ی اتاق کلاس = «پایه-شعبه» */
/** فایل APK آخرین نسخه‌ی اندروید (از GitHub Release) */
const ANDROID_APK_URL = "https://github.com/TAHAPIXEL/HAMDELSHAHED/releases/download/android-latest/hamdel.apk";

export function roomOfUser(u: User | null): string | null {
  if (!u?.grade || !u?.section) return null;
  return `${u.grade}-${u.section}`;
}

/** چیدمان شبکه‌ی تصاویر: یک تصویر تمام‌عرض، دو تصویر کنار هم، و بیشتر به صورت شبکه */
function shareGridClass(n: number): string {
  if (n <= 1) return "grid-cols-1";
  if (n === 2) return "grid-cols-1 md:grid-cols-2";
  if (n <= 4) return "grid-cols-1 sm:grid-cols-2";
  return "grid-cols-2 xl:grid-cols-3";
}

interface RoomInfo {
  live: boolean;
  teacherName: string;
  maxListeners: number;
}

const DEFAULT_ROOM = `${GRADES[0] as Grade}-${SECTIONS[GRADES[0] as Grade][0]}`;

export function ClassroomPage({ open, onClose, user }: { open: boolean; onClose: () => void; user: User }) {
  const teacher = isStaff(user);
  const ownRoom = roomOfUser(user);
  const [room, setRoom] = useState<string>(ownRoom ?? DEFAULT_ROOM);
  const snap = useSyncExternalStore(liveSession.subscribe, liveSession.getSnapshot, liveSession.getSnapshot);
  const [info, setInfo] = useState<RoomInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [chooser, setChooser] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [mobile] = useState(() => typeof window !== "undefined" && isMobileDevice());
  const [screenOk] = useState(() => typeof window !== "undefined" && canShareScreen());
  const [chatText, setChatText] = useState("");
  const toast = useToast();

  const roomReady = !!room && (teacher || room === ownRoom);
  const connectedHere = snap.roomId === room && (snap.phase === "connected" || snap.phase === "reconnecting");
  const connectedElsewhere = !!snap.roomId && snap.roomId !== room && snap.phase !== "idle" && snap.phase !== "ended";
  const live = !!info?.live;
  const isTeacherHere = connectedHere && snap.isTeacher;
  const others = useMemo(() => snap.peers.filter((p) => !p.isSelf), [snap.peers]);
  const hands = useMemo(() => others.filter((p) => p.hand), [others]);

  // وضعیت کلاس فقط هنگام باز بودن صفحه و هر ۵ ثانیه خوانده می‌شود (نه polling سنگین)
  useEffect(() => {
    if (!open || !roomReady) return;
    let alive = true;
    const load = async () => {
      try {
        const s = await api<{ live: boolean; teacherName: string; maxListeners: number }>(`/api/classroom?room=${room}`);
        if (alive) setInfo({ live: s.live, teacherName: s.teacherName, maxListeners: s.maxListeners });
      } catch {
        // خطا را پیام کلی نشان می‌دهد؛ تلاش بعدی خودکار است
      }
    };
    void load();
    const iv = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [open, roomReady, room]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : `${label} انجام نشد؛ دوباره تلاش کنید.`);
    } finally {
      setBusy(false);
    }
  }

  const reloadInfo = async () => {
    try {
      const s = await api<{ live: boolean; teacherName: string; maxListeners: number }>(`/api/classroom?room=${room}`);
      setInfo({ live: s.live, teacherName: s.teacherName, maxListeners: s.maxListeners });
    } catch {
      // ignore
    }
  };

  // ---- کنش‌ها -----------------------------------------------------------------
  const goLive = () =>
    run("شروع کلاس", async () => {
      await api("/api/classroom", { method: "POST", body: { room, action: "start" } });
      await liveSession.connect(room);
      await reloadInfo();
      toast("success", "کلاس آنلاین شروع شد.");
    });

  const join = () =>
    run("ورود به کلاس", async () => {
      await liveSession.connect(room);
    });

  const endLive = () =>
    run("پایان کلاس", async () => {
      await liveSession.endClass();
      await reloadInfo();
      toast("success", "کلاس آنلاین پایان یافت.");
    });

  const leave = () => run("خروج از کلاس", () => liveSession.disconnect());

  const toggleMic = () => run("میکروفون", () => liveSession.setMic(!snap.mic));

  const toggleHand = () => run("دست بالا", async () => liveSession.toggleHand());

  const enableSound = () => run("باز کردن صدا", () => liveSession.enableSound());

  const openChooser = () =>
    run("اشتراک‌گذاری", async () => {
      if (!mobile) setCameras(await listCameras());
      setChooser(true);
    });

  const pick = (source: ShareSource, deviceId?: string) =>
    run("اشتراک‌گذاری", async () => {
      setChooser(false);
      await liveSession.shareSource(source, deviceId);
    });

  const stopShare = () => run("توقف اشتراک", () => liveSession.stopShares());

  const grant = (p: Peer, allowed: boolean) =>
    run("تغییر اجازه‌ی صحبت", async () => {
      await liveSession.grant(p.identity, allowed);
      toast("success", allowed ? `${p.name} اجازه‌ی صحبت گرفت.` : `صحبت ${p.name} قطع شد.`);
    });

  const sendChat = () => {
    const text = chatText.trim();
    if (!text) return;
    liveSession.sendChat(text);
    setChatText("");
  };

  const toggleChat = () => liveSession.setChatOpen(!snap.chatOpen);

  // ---- نمایش --------------------------------------------------------------------
  const phaseText =
    snap.phase === "connecting"
      ? "در حال اتصال به کلاس…"
      : snap.phase === "reconnecting"
        ? "اتصال قطع شد؛ در حال اتصال مجدد…"
        : snap.phase === "ended"
          ? "کلاس پایان یافت."
          : null;

  const showChooser = chooser && (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/5">
      <div className="mb-3 text-sm font-bold">چه چیزی را نشان بدهید؟</div>
      <div className="flex flex-wrap gap-2">
        {mobile ? (
          <>
            <Btn kind="soft" onClick={() => pick("camera-back")}>
              <Camera className="size-4" /> دوربین پشت
            </Btn>
            <Btn kind="soft" onClick={() => pick("camera-front")}>
              <Camera className="size-4" /> دوربین جلو
            </Btn>
            {screenOk && (
              <Btn kind="soft" onClick={() => pick("screen")}>
                <Monitor className="size-4" /> صفحه‌ی گوشی
              </Btn>
            )}
          </>
        ) : (
          <>
            <Btn kind="soft" onClick={() => pick("screen")}>
              <Monitor className="size-4" /> صفحه‌ی نمایش
            </Btn>
            {(cameras.length ? cameras : [{ id: "", label: "وبکم پیش‌فرض" }]).map((c) => (
              <Btn key={c.id || "default"} kind="soft" onClick={() => pick("camera-device", c.id || undefined)}>
                <Video className="size-4" /> {c.label}
              </Btn>
            ))}
          </>
        )}
        <Btn kind="ghost" onClick={() => setChooser(false)}>
          انصراف
        </Btn>
      </div>
      {mobile && !screenOk && (
        <p className="mt-3 text-xs leading-6 text-slate-500 dark:text-slate-400">
          برای نشان دادن صفحه‌ی گوشی، برنامه‌ی اندروید هَمدِل را نصب کنید.{" "}
          <a href={ANDROID_APK_URL} className="font-bold text-indigo-600 underline dark:text-indigo-300">
            دانلود برنامه
          </a>
        </p>
      )}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="کلاس آنلاین" page icon={<Radio className="size-5" />}>
      <div className="flex flex-col gap-4">
        {teacher ? (
          <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            <span className="shrink-0 text-xs font-bold text-slate-500">کلاس:</span>
            {GRADES.flatMap((g) =>
              SECTIONS[g].map((s) => {
                const id = `${g}-${s}`;
                const active = id === room;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRoom(id)}
                    disabled={connectedElsewhere && !active}
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition disabled:opacity-40 ${
                      active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
                    }`}
                  >
                    پایه {g} / شعبه {s}
                  </button>
                );
              }),
            )}
          </div>
        ) : roomReady ? (
          <div className="text-sm text-slate-500">کلاس شما: پایه {user.grade} / شعبه {user.section}</div>
        ) : (
          <Empty
            icon={<Radio className="size-6" />}
            title="کلاس شما مشخص نشده است"
            desc="برای ورود به کلاس آنلاین، پایه و شعبه‌ی شما باید در پروفایل ثبت شده باشد."
          />
        )}

        {roomReady && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`size-2.5 rounded-full ${live ? "animate-pulse bg-rose-500" : "bg-slate-300"}`} />
                <b className="text-base">{live ? "کلاس در حال برگزاری است" : "کلاس شروع نشده است"}</b>
                {live && info?.teacherName ? <Chip tone="indigo">مدرس: {info.teacherName}</Chip> : null}
                {phaseText && <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300">{phaseText}</span>}
              </div>
              <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                {teacher && !live && (
                  <Btn onClick={goLive} loading={busy}>
                    <Power className="size-4" /> شروع کلاس
                  </Btn>
                )}
                {teacher && live && !connectedHere && (
                  <Btn onClick={join} loading={busy}>
                    <Volume2 className="size-4" /> ورود مجدد به کلاس
                  </Btn>
                )}
                {!teacher && live && !connectedHere && (
                  <Btn onClick={join} loading={busy}>
                    <Volume2 className="size-4" /> ورود به کلاس
                  </Btn>
                )}
                {connectedHere && isTeacherHere && (
                  <>
                    <Btn kind={snap.mic ? "soft" : "ghost"} onClick={toggleMic} loading={busy}>
                      {snap.mic ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                      {snap.mic ? "میکروفون روشن" : "میکروفون خاموش"}
                    </Btn>
                    {snap.camera || snap.screen ? (
                      <Btn kind="soft" onClick={stopShare} loading={busy}>
                        <VideoOff className="size-4" /> توقف نمایش
                      </Btn>
                    ) : (
                      <Btn kind="ghost" onClick={openChooser} loading={busy}>
                        <Video className="size-4" /> نمایش تصویر
                      </Btn>
                    )}
                    <Btn kind="danger" onClick={endLive} loading={busy}>
                      <Power className="size-4" /> پایان کلاس
                    </Btn>
                  </>
                )}
                {connectedHere && !isTeacherHere && (
                  <>
                    {snap.canSpeak ? (
                      <>
                        <Btn kind={snap.mic ? "soft" : "ghost"} onClick={toggleMic} loading={busy}>
                          {snap.mic ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                          {snap.mic ? "قطع صدا" : "روشن کردن میکروفون"}
                        </Btn>
                        {snap.camera || snap.screen ? (
                          <Btn kind="soft" onClick={stopShare} loading={busy}>
                            <VideoOff className="size-4" /> توقف نمایش
                          </Btn>
                        ) : (
                          <Btn kind="ghost" onClick={openChooser} loading={busy}>
                            <Video className="size-4" /> نمایش تصویر
                          </Btn>
                        )}
                      </>
                    ) : (
                      <Btn kind={snap.selfHand ? "soft" : "ghost"} onClick={toggleHand}>
                        <Hand className="size-4" /> {snap.selfHand ? "پایین آوردن دست" : "دست بالا"}
                      </Btn>
                    )}
                    <Btn kind="ghost" onClick={leave} loading={busy}>
                      <LogOut className="size-4" /> خروج
                    </Btn>
                  </>
                )}
              </div>
            </div>

            {connectedHere && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>حاضران: {snap.peers.length} از {info?.maxListeners ?? 100} نفر</span>
                {!isTeacherHere && snap.canSpeak && <span>· اجازه‌ی صحبت دارید</span>}
              </div>
            )}
            {connectedElsewhere && (
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                شما هم‌اکنون به کلاس دیگری متصل هستید. برای ورود به این کلاس ابتدا از آن خارج شوید.
              </div>
            )}
            {snap.phase === "error" && snap.error && (
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{snap.error}</div>
            )}
            {connectedHere && snap.audioBlocked && (
              <button
                type="button"
                onClick={enableSound}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20"
              >
                <VolumeX className="size-4" /> صدای کلاس قطع است — برای شنیدن صدای مدرس اینجا بزنید
              </button>
            )}
          </section>
        )}

        {roomReady && !live && !teacher && (
          <Empty
            icon={<Radio className="size-6" />}
            title="کلاس آنلاین هنوز فعال نیست"
            desc="وقتی مدرس کلاس را شروع کند، این صفحه دکمه‌ی ورود را نشان می‌دهد."
          />
        )}

        {connectedHere && showChooser}

        <div className={connectedHere ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]" : "contents"}>
        <div className="flex min-w-0 flex-col gap-4">
        {connectedHere && snap.shares.length > 0 && (
          <div className={`grid gap-2 ${shareGridClass(snap.shares.length)}`}>
            {snap.shares.map((s) => (
              <ShareTile key={s.key} share={s} large={snap.shares.length === 1} />
            ))}
          </div>
        )}

        </div>
        <div className="flex min-w-0 flex-col gap-4">
        {connectedHere && isTeacherHere && hands.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-200">
              <Hand className="size-4" /> دست‌های بالا ({hands.length})
            </h3>
            <ul className="flex flex-col gap-2">
              {hands.map((p) => (
                <li key={p.identity} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{p.name}</span>
                  <Btn kind="soft" onClick={() => grant(p, true)} loading={busy}>
                    <Mic className="size-4" /> اجازه‌ی صحبت
                  </Btn>
                </li>
              ))}
            </ul>
          </section>
        )}

        {connectedHere && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Users className="size-4" /> حاضران ({snap.peers.length})
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {snap.peers.map((p) => (
                <li
                  key={p.identity}
                  className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className={`size-2 shrink-0 rounded-full ${p.speaking ? "bg-emerald-500" : "bg-slate-300"}`} />
                    <span className="truncate text-sm font-semibold">{p.name}</span>
                    {p.teacher && <Chip tone="indigo">مدرس</Chip>}
                    {p.isSelf && <Chip tone="slate">شما</Chip>}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    {p.hand && <Hand className="size-4 text-amber-500" />}
                    {p.camera && <Video className="size-4 text-slate-500" />}
                    {p.screen && <Monitor className="size-4 text-slate-500" />}
                    {p.speaking && <Chip tone="green">در حال صحبت</Chip>}
                    {isTeacherHere && !p.isSelf && !p.teacher && p.canSpeak && (
                      <Btn kind="ghost" onClick={() => grant(p, false)} loading={busy}>
                        قطع
                      </Btn>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {connectedHere && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Radio className="size-4" /> گفتگوی کلاس
              </h3>
              {isTeacherHere ? (
                <Btn kind={snap.chatOpen ? "ghost" : "soft"} onClick={toggleChat}>
                  {snap.chatOpen ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                  {snap.chatOpen ? "بستن چت" : "باز کردن چت"}
                </Btn>
              ) : (
                !snap.chatOpen && <Chip tone="slate">چت توسط مدرس بسته شده است</Chip>
              )}
            </div>
            <ChatList messages={snap.chat} />
            {(snap.chatOpen || isTeacherHere) && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChat();
                    }
                  }}
                  disabled={!snap.chatOpen}
                  maxLength={1000}
                  placeholder={snap.chatOpen ? "پیام خود را بنویسید…" : "چت بسته است"}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-900"
                />
                <Btn onClick={sendChat} disabled={!snap.chatOpen || !chatText.trim()}>
                  <Send className="size-4" /> ارسال
                </Btn>
              </div>
            )}
          </section>
        )}
        </div>
        </div>
      </div>
    </Modal>
  );
}

function ShareTile({ share, large }: { share: Share; large: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    share.track.attach(el);
    return () => {
      share.track.detach(el);
    };
  }, [share.track]);
  return (
    <div className={`relative aspect-video overflow-hidden rounded-2xl bg-black ${large ? "max-h-[70vh]" : ""}`}>
      <video ref={ref} autoPlay playsInline muted={share.isSelf} className="size-full object-contain" />
      <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
        {share.name} · {share.source === "screen" ? "صفحه" : "دوربین"}
        {share.isSelf ? " (شما)" : ""}
      </span>
    </div>
  );
}

function ChatList({ messages }: { messages: { id: string; name: string; text: string; ts: number; mine: boolean }[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);
  if (messages.length === 0) {
    return <p className="text-sm text-slate-500">هنوز پیامی نیست.</p>;
  }
  return (
    <div className="flex max-h-60 flex-col gap-2 overflow-y-auto pr-1 sm:max-h-80">
      {messages.map((m) => (
        <div key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "self-end bg-indigo-600 text-white" : "self-start bg-slate-100 dark:bg-white/10"}`}>
          {!m.mine && <div className="mb-0.5 text-[11px] font-bold opacity-70">{m.name}</div>}
          <div className="whitespace-pre-wrap break-words">{m.text}</div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
