"use client";

import { useRef, useState, type ReactNode } from "react";
import { FileText, Play, Pause, X } from "lucide-react";
import type { ChatMedia } from "@/lib/model";
import { fmtDur, openMedia } from "@/lib/chatmedia";
import { useToast } from "./ui";

/** رنگ‌بندی حباب ویس: پیام خودم (آبی)، پیام دیگران (سفید)، پیش‌نمایش ضبط (سبز) */
export type VoiceTone = "mine" | "other" | "rec";

const TONE = {
  mine: {
    btn: "bg-surface text-accent",
    on: "bg-surface",
    off: "bg-surface/45",
    time: "opacity-90",
  },
  other: {
    btn: "bg-accent text-on-accent",
    on: "bg-accent",
    off: "bg-line-strong dark:bg-slate-500",
    time: "text-slate-500 dark:text-slate-400",
  },
  rec: {
    btn: "bg-surface text-accent",
    on: "bg-surface",
    off: "bg-surface/45",
    time: "text-on-accent",
  },
} satisfies Record<VoiceTone, { btn: string; on: string; off: string; time: string }>;

/** پخش ویس با شکل موج؛ کلیک روی موج جابه‌جا می‌کند */
export function VoicePlayer({
  src,
  wave,
  duration,
  tone,
  ready = true,
  compact = false,
}: {
  src: string;
  wave?: number[];
  duration?: number;
  tone: VoiceTone;
  ready?: boolean;
  /** نوار فشرده برای پیش‌نمایش ضبط: دکمه‌ی کوچک‌تر و زمان کنار موج */
  compact?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const barsRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const dur = duration && duration > 0 ? duration : 0;
  const bars = wave && wave.length ? wave : Array.from({ length: 48 }, () => 0.2);
  const progress = dur ? Math.min(1, cur / dur) : 0;
  const t = TONE[tone];

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
    <div className={compact ? "flex w-full min-w-0 items-center gap-2" : "flex w-[232px] max-w-full items-center gap-2.5"}>
      <button
        onClick={toggle}
        disabled={!ready}
        aria-label={playing ? "توقف" : "پخش ویس"}
        className={`grid shrink-0 place-items-center rounded-full shadow-sm transition active:scale-90 disabled:opacity-50 ${compact ? "size-9" : "size-11"} ${t.btn}`}
      >
        {playing ? <Pause className={compact ? "size-4 fill-current" : "size-5 fill-current"} /> : <Play className={`${compact ? "size-4" : "size-5"} translate-x-[1px] fill-current`} />}
      </button>
      <div className={compact ? "flex min-w-0 flex-1 items-center gap-2" : "flex min-w-0 flex-1 flex-col gap-1"}>
        <div ref={barsRef} onClick={(e) => seek(e.clientX)} className={`flex min-w-0 cursor-pointer items-center justify-between ${compact ? "h-6 flex-1" : "h-7"}`}>
          {bars.map((v, i) => {
            const filled = (i + 0.5) / bars.length <= progress;
            return (
              <span
                key={i}
                className={`min-w-[1.5px] max-w-[3px] flex-1 rounded-full transition-colors ${filled ? t.on : t.off}`}
                style={{ height: `${Math.max(12, Math.round(v * 100))}%` }}
              />
            );
          })}
        </div>
        <span dir="ltr" className={`text-[11px] font-bold tabular-nums leading-none ${compact ? "shrink-0" : ""} ${t.time}`}>
          {fmtDur(playing || cur > 0 ? cur : dur)}
        </span>
      </div>
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

/** دکمه‌ی ضبط با دایره‌ی اکولایزر: دور دکمه، میله‌های شعاعی بر اساس باندهای فرکانسی (زیر و بمی) و بلندی صدا بزرگ و کوچک می‌شوند */
export function VoiceOrb({
  active,
  bands,
  level,
  children,
}: {
  active: boolean;
  bands: number[];
  level: number;
  children: ReactNode;
}) {
  return (
    <div className="relative grid size-11 shrink-0 place-items-center">
      {active && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 size-11 rounded-full bg-accent/20 transition-transform duration-100 ease-out"
            style={{ transform: `translate(-50%, -50%) scale(${(1 + level * 0.5).toFixed(3)})` }}
          />
          {bands.map((v, i) => {
            const len = 3 + v * 12;
            const r = 24 + len / 2;
            return (
              <span
                key={i}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 w-[3px] rounded-full bg-accent transition-[height,opacity] duration-100 ease-out"
                style={{
                  height: `${len.toFixed(1)}px`,
                  opacity: (0.3 + v * 0.7).toFixed(2),
                  transform: `translate(-50%, -50%) rotate(${(i / bands.length) * 360}deg) translateY(-${r.toFixed(1)}px)`,
                }}
              />
            );
          })}
        </>
      )}
      <span className="relative grid place-items-center">{children}</span>
    </div>
  );
}

/** حجم فایل به شکل کوتاه، مثل «980.7 KB» */
export function sizeShort(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExt(name: string): string {
  const e = name.split(".").pop() ?? "";
  return e.length <= 4 ? e.toUpperCase() : "FILE";
}

/** پیوست سند: کل حباب قابل ضربه است؛ بازکردن یا دانلود با درصد پیشرفت */
export function FileBubble({ media, mine }: { media: ChatMedia; mine: boolean }) {
  const toast = useToast();
  const [pct, setPct] = useState<number | null>(null);
  const busy = pct !== null;
  const run = async () => {
    if (busy) return;
    setPct(0);
    try {
      await openMedia(media.url, media.name, (p) => setPct(p));
    } catch (err) {
      toast("error", (err as Error).message || "انجام نشد");
    } finally {
      setPct(null);
    }
  };
  return (
    <button
      onClick={run}
      aria-label={`باز کردن ${media.name}`}
      className="relative flex w-[236px] max-w-full items-center gap-3 rounded-xl text-right transition active:scale-[0.99]"
    >
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-full shadow-sm ${
          mine ? "bg-surface text-accent" : "bg-accent text-on-accent"
        }`}
      >
        <FileText className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`line-clamp-2 break-all text-[14px] font-bold leading-5 ${mine ? "" : "text-slate-800 dark:text-slate-100"}`}>
          {media.name}
        </span>
        <span dir="ltr" className={`mt-0.5 block text-[12px] font-semibold ${mine ? "opacity-80" : "text-slate-400"}`}>
          {busy ? `${Math.round((pct ?? 0) * 100)}%` : `${sizeShort(media.size)} · ${fileExt(media.name)}`}
        </span>
      </span>
      {busy && (
        <span className="absolute inset-x-0 -bottom-1 h-0.5 overflow-hidden rounded-full bg-black/10">
          <span className="block h-full bg-current transition-all" style={{ width: `${Math.round((pct ?? 0) * 100)}%` }} />
        </span>
      )}
    </button>
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

/** حباب در حال ارسال: حلقه‌ی پیشرفت با درصد، مثل تلگرام */
export function PendingBubble({ p, onDismiss }: { p: PendingUpload; onDismiss: () => void }) {
  const pct = Math.round(p.progress * 100);
  const r = 19;
  const circ = 2 * Math.PI * r;
  return (
    <div className="msg-in flex items-end gap-2">
      <div className="bubble-mine bubble-mine-c relative max-w-[78%] px-3.5 py-2.5 shadow-sm sm:max-w-[65%]">
        {p.error ? (
          <div className="flex items-center gap-2 text-[13px] font-bold text-rose-600 dark:text-rose-200">
            <span className="flex-1">{p.error}</span>
            <button onClick={onDismiss} className="rounded-full p-1 hover:bg-surface/10" aria-label="بستن">
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex w-[236px] max-w-full items-center gap-3">
            <span className="relative grid size-11 shrink-0 place-items-center">
              <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden="true">
                <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
                <circle
                  cx="22"
                  cy="22"
                  r={r}
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  strokeDashoffset={circ * (1 - p.progress)}
                  className="transition-[stroke-dashoffset] duration-200"
                />
              </svg>
              <span dir="ltr" className="text-[10px] font-black tabular-nums">
                {pct}%
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-bold">{p.kind === "voice" ? "پیام صوتی" : p.name}</span>
              <span dir="ltr" className="block text-[12px] font-semibold opacity-80">
                {p.kind === "voice" ? "در حال ارسال" : sizeShort(p.size)}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
