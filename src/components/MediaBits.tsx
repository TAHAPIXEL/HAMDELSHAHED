"use client";

import { useRef, useState } from "react";
import { Download, FileText, Pause, Play, X } from "lucide-react";
import type { ChatMedia } from "@/lib/model";
import { downloadMedia, fmtDur, openMedia } from "@/lib/chatmedia";
import { useToast } from "./ui";

/** پخش ویس با شکل موج؛ کلیک روی موج جابه‌جا می‌کند */
export function VoicePlayer({
  src,
  wave,
  duration,
  mine,
  ready = true,
}: {
  src: string;
  wave?: number[];
  duration?: number;
  mine: boolean;
  ready?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const dur = duration && duration > 0 ? duration : 0;
  const bars = wave && wave.length ? wave : Array.from({ length: 48 }, () => 0.2);
  const progress = dur ? Math.min(1, cur / dur) : 0;

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !ready) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  const seek = (clientX: number) => {
    const el = barsRef.current;
    const a = audioRef.current;
    if (!el || !a || !dur) return;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    a.currentTime = ratio * (dur / 1000);
    setCur(ratio * dur);
  };

  return (
    <div className="flex w-[244px] max-w-full items-center gap-2.5 py-0.5">
      <button
        onClick={toggle}
        disabled={!ready}
        aria-label={playing ? "توقف" : "پخش ویس"}
        className={`grid size-10 shrink-0 place-items-center rounded-full transition active:scale-90 disabled:opacity-50 ${
          mine ? "bg-white/20 text-white" : "bg-[#4f8ff0]/15 text-[#3b7ae0] dark:text-[#7fb0ff]"
        }`}
      >
        {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
      </button>
      <div ref={barsRef} onClick={(e) => seek(e.clientX)} className="flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-[2px]">
        {bars.map((v, i) => {
          const filled = (i + 0.5) / bars.length <= progress;
          return (
            <span
              key={i}
              className={`w-[3px] shrink-0 rounded-full transition-colors ${
                filled ? (mine ? "bg-white" : "bg-[#3b7ae0]") : mine ? "bg-white/40" : "bg-slate-300 dark:bg-slate-500"
              }`}
              style={{ height: `${Math.max(14, Math.round(v * 100))}%` }}
            />
          );
        })}
      </div>
      <span dir="ltr" className={`w-9 shrink-0 text-end text-[11px] font-bold tabular-nums ${mine ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}>
        {fmtDur(playing || cur > 0 ? cur : dur)}
      </span>
      <audio
        ref={audioRef}
        src={ready ? src : undefined}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime * 1000)}
        onEnded={() => {
          setPlaying(false);
          setCur(0);
        }}
      />
    </div>
  );
}

function fileExt(name: string): string {
  const e = name.split(".").pop() ?? "";
  return e.length <= 4 ? e.toUpperCase() : "FILE";
}

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} کیلوبایت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;
}

/** پیوست سند: کلیک برای مشاهده/بازکردن، دکمه‌ی جدا برای دانلود با درصد پیشرفت */
export function FileBubble({ media, mine }: { media: ChatMedia; mine: boolean }) {
  const toast = useToast();
  const [pct, setPct] = useState<number | null>(null);
  const busy = pct !== null;
  const run = async (fn: (onP: (p: number) => void) => Promise<void>) => {
    if (busy) return;
    setPct(0);
    try {
      await fn((p) => setPct(p));
    } catch (err) {
      toast("error", (err as Error).message || "انجام نشد");
    } finally {
      setPct(null);
    }
  };
  return (
    <div className="relative flex w-[260px] max-w-full items-center gap-3">
      <button
        onClick={() => run((onP) => openMedia(media.url, media.name, onP))}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-right transition active:scale-[0.99]"
        aria-label={`باز کردن ${media.name}`}
      >
        <span className={`relative grid size-11 shrink-0 place-items-center rounded-xl ${mine ? "bg-white/20" : "bg-[#4f8ff0]/15 text-[#3b7ae0] dark:text-[#7fb0ff]"}`}>
          <FileText className="size-5" />
          <span className="absolute -bottom-1 rounded-md bg-slate-800 px-1 text-[8px] font-black leading-3 text-white" dir="ltr">
            {fileExt(media.name)}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-bold">{media.name}</span>
          <span className={`block text-[11px] font-semibold ${mine ? "text-white/70" : "text-slate-400"}`}>
            {busy ? `در حال دریافت ${Math.round((pct ?? 0) * 100)}٪` : sizeText(media.size)}
          </span>
        </span>
      </button>
      <button
        onClick={() => run((onP) => downloadMedia(media.url, media.name, onP))}
        disabled={busy}
        className={`grid size-9 shrink-0 place-items-center rounded-full transition active:scale-90 ${mine ? "bg-white/20" : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200"}`}
        aria-label="دانلود"
      >
        <Download className="size-4" />
      </button>
      {busy && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-full bg-black/10">
          <div className="h-full bg-current transition-all" style={{ width: `${Math.round((pct ?? 0) * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

export interface PendingUpload {
  id: string;
  kind: "voice" | "file";
  name: string;
  size: number;
  progress: number;
  error?: string;
}

/** حباب در حال ارسال: درصد پیشرفت آپلود، مثل تلگرام */
export function PendingBubble({ p, onDismiss }: { p: PendingUpload; onDismiss: () => void }) {
  const pct = Math.round(p.progress * 100);
  return (
    <div className="flex items-end gap-2 flex-row-reverse msg-in">
      <div className="relative max-w-[78%] rounded-2xl bg-gradient-to-bl from-indigo-600 to-violet-600 px-3.5 py-2.5 text-white shadow-sm sm:max-w-[65%]">
        {p.error ? (
          <div className="flex items-center gap-2 text-[13px] font-bold text-rose-100">
            <span className="flex-1">{p.error}</span>
            <button onClick={onDismiss} className="rounded-full p-1 hover:bg-white/10" aria-label="بستن">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex w-[250px] max-w-full flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/20">
                {p.kind === "voice" ? <Play className="size-4 fill-current" /> : <FileText className="size-5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-bold">{p.kind === "voice" ? "پیام صوتی" : p.name}</span>
                <span className="block text-[11px] font-semibold text-white/70">{sizeText(p.size)}</span>
              </span>
              <span dir="ltr" className="text-[12px] font-black tabular-nums">{pct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** شکل موج زنده‌ی هنگام ضبط */
export function RecBars({ levels }: { levels: number[] }) {
  const n = 34;
  const bars = Array.from({ length: n }, (_, i) => levels[levels.length - n + i] ?? 0.12);
  return (
    <div dir="ltr" className="flex h-6 min-w-0 flex-1 items-center justify-end gap-[2px] overflow-hidden">
      {bars.map((v, i) => (
        <span key={i} className="w-[2px] shrink-0 rounded-full bg-rose-400" style={{ height: `${Math.round(Math.max(0.12, v) * 100)}%` }} />
      ))}
    </div>
  );
}
