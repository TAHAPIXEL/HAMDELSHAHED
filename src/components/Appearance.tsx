"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { ImagePlus, Moon, Palette, RotateCcw, Sun, Trash2, Check } from "lucide-react";
import {
  ACCENT_SWATCHES,
  DEFAULT_THEME,
  MINE_SWATCHES,
  THEME_KEY,
  THEME_PRESETS,
  WALLPAPER_KEY,
  applyTheme,
  type ThemeSettings,
  type WallpaperKind,
} from "@/lib/theme";
import { Seg, useToast } from "./ui";

// ----------------------------------------------------------------------------
// وضعیت پوسته: ذخیره در مرورگر همین دستگاه و اعمال فوری روی کل سایت
// ----------------------------------------------------------------------------

export function useThemeSettings() {
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT_THEME);
  const [image, setImage] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let s: ThemeSettings = DEFAULT_THEME;
    let img: string | null = null;
    try {
      const raw = localStorage.getItem(THEME_KEY);
      if (raw) s = { ...DEFAULT_THEME, ...JSON.parse(raw) };
      img = localStorage.getItem(WALLPAPER_KEY);
    } catch {
      /* مرورگر اجازه‌ی ذخیره‌سازی نداد: پیش‌فرض */
    }
    // بارگذاری یک‌باره‌ی تنظیمات ذخیره‌شده از مرورگر (فقط سمت کلاینت)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(s);
    setImage(img);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    applyTheme(settings, image);
    try {
      localStorage.setItem(THEME_KEY, JSON.stringify(settings));
      if (image) localStorage.setItem(WALLPAPER_KEY, image);
      else localStorage.removeItem(WALLPAPER_KEY);
    } catch {
      /* حافظه پر است: تغییر فقط تا بستن صفحه می‌ماند */
    }
  }, [settings, image, ready]);

  /** تغییر یک یا چند مقدار؛ با تغییر دستی، پیش‌تنظیم «سفارشی» می‌شود */
  const update = useCallback((patch: Partial<ThemeSettings>, presetId: string = "custom") => {
    setSettings((prev) => ({ ...prev, ...patch, presetId }));
  }, []);

  return { settings, image, setImage, update, ready };
}

/** کوچک‌سازی تصویر دلخواه برای والپیپر (JPEG، حداکثر ۱۲۸۰ پیکسل) */
async function compressWallpaper(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("تصویر خوانده نشد"));
      i.src = url;
    });
    const k = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("مرورگر پردازش تصویر را پشتیبانی نمی‌کند");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.8);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ----------------------------------------------------------------------------
// کارت «ظاهر» در پروفایل
// ----------------------------------------------------------------------------

function ColorDot({ color, selected, onPick, label }: { color: string; selected: boolean; onPick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={label}
      title={label}
      className={`relative flex size-9 items-center justify-center rounded-full transition active:scale-95 ${
        selected ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : "ring-1 ring-line"
      }`}
      style={{ background: color }}
    >
      {selected && <Check className="size-4 text-white drop-shadow" />}
    </button>
  );
}

function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  return (
    <label
      className="relative flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-line"
      title={label}
      aria-label={label}
      style={{ background: "conic-gradient(#f43f5e, #f59e0b, #22c55e, #3b82f6, #a855f7, #f43f5e)" }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      />
    </label>
  );
}

export function AppearanceCard() {
  const toast = useToast();
  const { settings: s, image, setImage, update } = useThemeSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pickWallpaper = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("error", "فقط فایل تصویر انتخاب کنید");
    setBusy(true);
    try {
      const data = await compressWallpaper(f);
      setImage(data);
      update({ wallpaper: "image" });
    } catch (err) {
      toast("error", (err as Error).message || "تصویر ذخیره نشد");
    } finally {
      setBusy(false);
    }
  };

  const applyPreset = (id: string) => {
    const p = THEME_PRESETS.find((x) => x.id === id);
    if (!p) return;
    update({ ...p.values }, p.id);
  };

  const resetAll = () => {
    const p = THEME_PRESETS[0];
    update({ ...p.values }, p.id);
    setImage(null);
    toast("success", "پوسته به ایتا تیره برگشت");
  };

  const wallpapers: { value: WallpaperKind; label: string }[] = [
    { value: "doodle", label: "نقش‌دار" },
    { value: "dots", label: "نقطه‌ای" },
    { value: "solid", label: "ساده" },
    { value: "image", label: "تصویر من" },
  ];

  return (
    <div className="card anim-fade-up mb-5 p-5">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-black text-slate-700 dark:text-slate-200">
          <Palette className="size-4 text-accent" />
          ظاهر و پوسته
        </div>
        <button
          type="button"
          onClick={resetAll}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] font-bold text-slate-500 transition hover:bg-surface-2 dark:text-slate-400"
        >
          <RotateCcw className="size-3.5" />
          بازنشانی
        </button>
      </div>
      <p className="mb-4 text-[11.5px] font-semibold leading-5 text-slate-400">
        پوسته‌ها و رنگ‌ها روی همین دستگاه ذخیره می‌شوند و کل سایت را عوض می‌کنند.
      </p>

      {/* پیش‌تنظیم‌ها */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {THEME_PRESETS.map((p) => {
          const active = s.presetId === p.id;
          const otherBg = p.values.other || (p.values.mode === "light" ? "#ffffff" : "#262626");
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className={`overflow-hidden rounded-2xl border p-0 text-right transition active:scale-[0.99] ${
                active ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-line-strong"
              }`}
            >
              <div
                className="relative h-[68px] overflow-hidden px-2.5 pt-2.5"
                style={{ background: p.values.wallpaperColor }}
              >
                <div className="ms-auto mb-1.5 h-2.5 w-14 rounded-full" style={{ background: p.values.mine }} />
                <div className="h-2.5 w-20 rounded-full" style={{ background: otherBg }} />
                <div className="absolute bottom-2 start-2.5 size-4 rounded-full" style={{ background: p.values.accent }} />
              </div>
              <div className="flex items-center justify-between gap-1 bg-surface px-2.5 py-2">
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-black text-slate-700 dark:text-slate-200">{p.label}</div>
                  <div className="truncate text-[10px] font-semibold text-slate-400">{p.hint}</div>
                </div>
                {active && <Check className="size-4 shrink-0 text-accent" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-5">
        <div>
          <div className="mb-2 text-[12px] font-black text-slate-600 dark:text-slate-300">حالت نمایش</div>
          <Seg<"dark" | "light">
            options={[
              { value: "dark", label: "تیره" },
              { value: "light", label: "روشن" },
            ]}
            value={s.mode}
            onChange={(mode) => update({ mode })}
          />
        </div>

        <div>
          <div className="mb-2 text-[12px] font-black text-slate-600 dark:text-slate-300">رنگ اصلی (دکمه‌ها و تب‌ها)</div>
          <div className="flex flex-wrap items-center gap-2.5">
            {ACCENT_SWATCHES.map((c) => (
              <ColorDot key={c} color={c} selected={s.accent.toLowerCase() === c} onPick={() => update({ accent: c })} label={`رنگ ${c}`} />
            ))}
            <ColorInput value={s.accent} onChange={(accent) => update({ accent })} label="رنگ اصلی دلخواه" />
          </div>
        </div>

        <div>
          <div className="mb-2 text-[12px] font-black text-slate-600 dark:text-slate-300">رنگ حباب پیام‌های من</div>
          <div className="flex flex-wrap items-center gap-2.5">
            {MINE_SWATCHES.map((c) => (
              <ColorDot key={c} color={c} selected={s.mine.toLowerCase() === c} onPick={() => update({ mine: c })} label={`حباب ${c}`} />
            ))}
            <ColorInput value={s.mine} onChange={(mine) => update({ mine })} label="رنگ حباب من دلخواه" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-[12px] font-black text-slate-600 dark:text-slate-300">حباب پیام دیگران</div>
            <div className="flex items-center gap-2.5">
              <ColorInput value={s.other || (s.mode === "light" ? "#ffffff" : "#262626")} onChange={(other) => update({ other })} label="رنگ حباب دیگران" />
              {s.other && (
                <button type="button" onClick={() => update({ other: "" })} className="text-[11.5px] font-bold text-accent">
                  پیش‌فرض
                </button>
              )}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[12px] font-black text-slate-600 dark:text-slate-300">پس‌زمینه‌ی کلی برنامه</div>
            <div className="flex items-center gap-2.5">
              <ColorInput value={s.bg || (s.mode === "light" ? "#f2f4f7" : "#161616")} onChange={(bg) => update({ bg })} label="رنگ پس‌زمینه" />
              {s.bg && (
                <button type="button" onClick={() => update({ bg: "" })} className="text-[11.5px] font-bold text-accent">
                  پیش‌فرض
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-[12px] font-black text-slate-600 dark:text-slate-300">پس‌زمینه‌ی گفتگو</div>
          <div className="grid grid-cols-4 gap-2">
            {wallpapers.map((w) => {
              const on = s.wallpaper === w.value;
              return (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => (w.value === "image" && !image ? fileRef.current?.click() : update({ wallpaper: w.value }))}
                  className={`rounded-xl border px-2 py-2 text-[11.5px] font-bold transition ${
                    on ? "border-accent bg-accent/10 text-accent" : "border-line text-slate-500 hover:bg-surface-2 dark:text-slate-400"
                  }`}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            {s.wallpaper !== "image" && (
              <>
                <span className="text-[11.5px] font-bold text-slate-400">رنگ زمینه:</span>
                <ColorInput value={s.wallpaperColor} onChange={(wallpaperColor) => update({ wallpaperColor })} label="رنگ زمینه‌ی گفتگو" />
              </>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-[12px] font-bold text-slate-600 transition hover:bg-surface-3 disabled:opacity-60 dark:text-slate-300"
            >
              <ImagePlus className="size-4" />
              {busy ? "در حال پردازش…" : image ? "تعویض تصویر" : "انتخاب تصویر از گالری"}
            </button>
            {image && (
              <button
                type="button"
                onClick={() => {
                  setImage(null);
                  update({ wallpaper: "doodle" });
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
              >
                <Trash2 className="size-4" />
                حذف تصویر
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickWallpaper} />
          </div>
        </div>

        {/* پیش‌نمایش زنده */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-black text-slate-600 dark:text-slate-300">
            {s.mode === "light" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            پیش‌نمایش
          </div>
          <div className="overflow-hidden rounded-2xl border border-line">
            <div className="flex items-center gap-2.5 bg-surface px-3.5 py-2.5">
              <div className="size-8 rounded-full bg-accent" />
              <div className="min-w-0">
                <div className="text-[12.5px] font-black text-slate-800 dark:text-slate-100">گفتگوی نمونه</div>
                <div className="text-[10.5px] font-semibold text-accent">آنلاین</div>
              </div>
            </div>
            <div className="chat-bg flex flex-col gap-2 px-3.5 py-4">
              <div className="bubble-other-c max-w-[70%] self-start rounded-2xl rounded-br-md px-3.5 py-2 text-[12.5px] font-semibold shadow-sm">
                سلام! کلاس امروز ساعت ۱۰ است.
              </div>
              <div className="bubble-mine-c max-w-[70%] self-end rounded-2xl rounded-bl-md px-3.5 py-2 text-[12.5px] font-semibold shadow-sm">
                ممنون، حاضرم ✔
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
