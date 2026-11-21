"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Hand, Mic, MicOff, Radio, Users, Volume2, LogOut, Power } from "lucide-react";
import type { LiveMember, LiveState } from "@/lib/server/classroom";
import { LiveClient, liveAction, type LiveStatus } from "@/lib/live";
import { GRADES, SECTIONS, type Grade, isStaff } from "@/lib/model";
import type { User } from "@/lib/model";
import { Btn, Chip, Empty, Modal, useToast } from "./ui";

/** شناسه‌ی اتاق کلاس = «پایه-شعبه» */
export function roomOfUser(u: User | null): string | null {
  if (!u?.grade || !u?.section) return null;
  return `${u.grade}-${u.section}`;
}

// موتور کلاس یکتاست و با بستن صفحه قطع نمی‌شود؛ پخش مدرس و حضور دانش‌آموز در پس‌زمینه ادامه می‌یابد
let engine: { key: string; client: LiveClient } | null = null;

function engineFor(room: string, role: "teacher" | "student", selfId: string): LiveClient {
  const key = `${room}|${role}|${selfId}`;
  if (engine && engine.key === key) return engine.client;
  if (engine) {
    // کلاس دیگری: اگر موتور قبلی فعال است (پخش یا حضور)، همان را نگه می‌داریم تا قطع نشود
    if (engine.client.isActive()) return engine.client;
    engine.client.destroy();
  }
  const client = new LiveClient({
    roomId: room,
    role,
    selfId,
    handlers: { onState: () => undefined, onStatus: () => undefined, onError: () => undefined },
  });
  engine = { key, client };
  return client;
}

const EMPTY_STATUS: LiveStatus = { connected: 0, connecting: 0, micOn: false, joined: false, broadcasting: false };

export function ClassroomPage({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: User;
}) {
  const teacher = isStaff(user);
  const ownRoom = roomOfUser(user);
  const [room, setRoom] = useState<string>(ownRoom ?? `${GRADES[0] as Grade}-${SECTIONS[GRADES[0] as Grade][0]}`);
  const [state, setState] = useState<LiveState | null>(null);
  const [status, setStatus] = useState<LiveStatus>(EMPTY_STATUS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const clientRef = useRef<LiveClient | null>(null);

  // دانش‌آموز فقط کلاس خودش را می‌بیند؛ اگر کلاسش تعریف نشده باشد، صفحه خطا می‌دهد
  const roomReady = !!room && (teacher || room === ownRoom);
  const liveRoomOther = teacher && engine?.client.isActive() && engine.key.split("|")[0] !== room;

  useEffect(() => {
    if (!open || !roomReady) return;
    const client = engineFor(room, teacher ? "teacher" : "student", user.id);
    clientRef.current = client;
    client.setHandlers({
      onState: (st) => {
        setState(st);
        setError(null);
      },
      onStatus: (s) => setStatus(s),
      onError: (msg) => setError(msg),
    });
    client.watch();
    return () => {
      // صفحه بسته می‌شود؛ موتور فقط اگر کاری در جریان نیست متوقف می‌شود
      client.releaseIfIdle();
      if (clientRef.current === client) clientRef.current = null;
      setStatus(EMPTY_STATUS);
    };
  }, [open, room, roomReady, teacher, user.id]);

  const online = useMemo(() => (state?.members ?? []).filter((m) => m.online), [state]);
  const hands = useMemo(() => online.filter((m) => m.hand), [online]);
  const me = online.find((m) => m.userId === user.id) ?? null;
  const live = !!state?.live;
  const isTeacherHere = teacher && live && state?.teacherId === user.id;

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

  const goLive = () =>
    run("شروع کلاس", async () => {
      await clientRef.current?.goLive();
      toast("success", "کلاس آنلاین شروع شد.");
    });

  const endLive = () =>
    run("پایان کلاس", async () => {
      await clientRef.current?.endLive();
      toast("success", "کلاس آنلاین پایان یافت.");
    });

  const join = () =>
    run("ورود به کلاس", async () => {
      await clientRef.current?.join();
    });

  const leave = () =>
    run("خروج از کلاس", async () => {
      await clientRef.current?.leave();
    });

  const toggleHand = () =>
    run("دست بالا", async () => {
      await liveAction(room, { action: "hand", raised: !me?.hand });
    });

  const allow = (m: LiveMember, allowed: boolean) =>
    run("تغییر اجازه‌ی صحبت", async () => {
      await liveAction(room, { action: "speak", userId: m.userId, allowed });
      toast("success", allowed ? `${m.name} اجازه‌ی صحبت گرفت.` : `میکروفون ${m.name} قطع شد.`);
    });

  const toggleMic = () => clientRef.current?.setMicOn(!status.micOn);

  return (
    <Modal open={open} onClose={onClose} title="کلاس آنلاین" page icon={<Radio className="size-5" />}>
      <div className="flex flex-col gap-4">
        {teacher ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-500">کلاس:</span>
            {GRADES.flatMap((g) =>
              SECTIONS[g].map((s) => {
                const id = `${g}-${s}`;
                const active = id === room;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRoom(id)}
                    disabled={!!liveRoomOther && !active}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition disabled:opacity-40 ${
                      active
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300"
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
              <div className="flex items-center gap-2">
                <span className={`size-2.5 rounded-full ${live ? "animate-pulse bg-rose-500" : "bg-slate-300"}`} />
                <b className="text-base">{live ? "کلاس در حال برگزاری است" : "کلاس شروع نشده است"}</b>
                {live && state?.teacherName ? <Chip tone="indigo">مدرس: {state.teacherName}</Chip> : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {teacher && !live && (
                  <Btn onClick={goLive} loading={busy}>
                    <Power className="size-4" /> شروع کلاس
                  </Btn>
                )}
                {isTeacherHere && (
                  <>
                    <Btn kind={status.micOn ? "soft" : "ghost"} onClick={toggleMic}>
                      {status.micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                      {status.micOn ? "میکروفون روشن" : "میکروفون خاموش"}
                    </Btn>
                    <Btn kind="danger" onClick={endLive} loading={busy}>
                      <Power className="size-4" /> پایان کلاس
                    </Btn>
                  </>
                )}
                {!teacher && live && !status.joined && (
                  <Btn onClick={join} loading={busy}>
                    <Volume2 className="size-4" /> ورود به کلاس
                  </Btn>
                )}
                {!teacher && live && status.joined && (
                  <>
                    <Btn kind={me?.hand ? "soft" : "ghost"} onClick={toggleHand} loading={busy}>
                      <Hand className="size-4" /> {me?.hand ? "پایین آوردن دست" : "دست بالا"}
                    </Btn>
                    {me?.speaking && (
                      <Btn kind={status.micOn ? "soft" : "ghost"} onClick={toggleMic}>
                        {status.micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                        {status.micOn ? "قطع صدا" : "روشن کردن صدا"}
                      </Btn>
                    )}
                    <Btn kind="ghost" onClick={leave} loading={busy}>
                      <LogOut className="size-4" /> خروج
                    </Btn>
                  </>
                )}
              </div>
            </div>

            {live && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                <span>حاضران آنلاین: {online.length} از {state?.maxListeners} نفر</span>
                {(status.joined || status.broadcasting) && <span>· اتصال صوتی فعال: {status.connected}</span>}
                {(status.joined || status.broadcasting) && status.connecting > 0 && (
                  <span>· در حال اتصال: {status.connecting}</span>
                )}
              </div>
            )}
            {error && (
              <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                {error}
              </div>
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

        {live && isTeacherHere && hands.length > 0 && (
          <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-200">
              <Hand className="size-4" /> دست‌های بالا ({hands.length})
            </h3>
            <ul className="flex flex-col gap-2">
              {hands.map((m) => (
                <li key={m.userId} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{m.name}</span>
                  <Btn kind="soft" onClick={() => allow(m, true)} loading={busy}>
                    <Mic className="size-4" /> اجازه‌ی صحبت
                  </Btn>
                </li>
              ))}
            </ul>
          </section>
        )}

        {live && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <Users className="size-4" /> حاضران ({online.length})
            </h3>
            {online.length === 0 ? (
              <p className="text-sm text-slate-500">هنوز کسی وارد کلاس نشده است.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {online.map((m) => (
                  <li
                    key={m.userId}
                    className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className={`size-2 shrink-0 rounded-full ${m.speaking ? "bg-emerald-500" : "bg-slate-300"}`} />
                      <span className="truncate text-sm font-semibold">{m.name || "کاربر"}</span>
                      {m.userId === user.id && <Chip tone="slate">شما</Chip>}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {m.hand && <Hand className="size-4 text-amber-500" />}
                      {m.speaking && <Chip tone="green">در حال صحبت</Chip>}
                      {isTeacherHere && m.speaking && m.userId !== user.id && (
                        <Btn kind="ghost" onClick={() => allow(m, false)} loading={busy}>
                          قطع
                        </Btn>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
