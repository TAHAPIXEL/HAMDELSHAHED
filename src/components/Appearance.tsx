"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Check, ImagePlus, Moon, Palette, RotateCcw, Sun, Trash2 } from "lucide-react";
import { DEV_USER_ID } from "@/lib/collections";
import { DB, currentUser } from "@/lib/model";
import { api } from "@/lib/store";
import {
  ACCENT_SWATCHES,
  DEFAULT_THEME,
  MINE_SWATCHES,
  THEME_KEY,
  THEME_PRESETS,
  TEXTURES,
  applyTheme,
  normalizeTheme,
  presetValues,
  themeVars,
  type ThemeSettings,
} from "@/lib/theme";
import { Seg, Toggle, useDbTick, useToast } from "./ui";

// ----------------------------------------------------------------------------
// ذخیره‌ی پوسته: منبع اصلی، رکورد کاربر در پایگاه‌داده است (فیلد theme).
// کش محلی فقط برای نمایش فوری قبل از دریافت حساب و کاربر مهمان است.
// ----------------------------------------------------------------------------

const OWNER_KEY = "hamdel-theme-owner";

function readCache(): ThemeSettings | null {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (!raw) return null;
    return normalizeTheme(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeCache(theme: ThemeSettings, ownerId: string) {
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(theme));
    localStorage.setItem(OWNER_KEY, ownerId);
  } catch {
    /* حافظه پر است: پوسته تا بستن صفحه می‌ماند */
  }
}

/** کش فقط وقتی معتبر است که مال همین کاربر باشد (روی دستگاه مشترک، پوسته‌ی نفر قبلی نیاید) */
function cacheForUser(ownerId: string): ThemeSettings | null {
  try {
    if (localStorage.getItem(OWNER_KEY) !== ownerId) return null;
  } catch {
    return null;
  }
  return readCache();
}

function currentTheme(): ThemeSettings {
  const me = currentUser();
  if (me?.theme) return normalizeTheme(me.theme);
  return (me && cacheForUser(me.id)) || DEFAULT_THEME;
}

/** ذخیره در رکورد کاربر (همگام‌سازی با سرور). برای کاربر توسعه‌دهنده که رکورد ندارد false برمی‌گرداند */
function saveAccountTheme(theme: ThemeSettings): boolean {
  const me = currentUser();
  if (!me || me.id === DEV_USER_ID) return false;
  const users = DB.users();
  if (!users.some((u) => u.id === me.id)) return false;
  DB.saveUsers(users.map((u) => (u.id === me.id ? { ...u, theme } : u)));
  return true;
}

/**
 * همگام‌سازی سراسری پوسته با حساب کاربر. در Shell فراخوانی می‌شود تا روی همه‌ی بخش‌ها اعمال شود.
 */
export function useThemeSync() {
  useDbTick();
  const me = currentUser();
  const remoteKey = me?.theme ? JSON.stringify(normalizeTheme(me.theme)) : "";
  const meId = me?.id ?? "";

  useEffect(() => {
    if (remoteKey) {
      const t = normalizeTheme(JSON.parse(remoteKey));
      applyTheme(t);
      writeCache(t, meId);
      return;
    }
    if (!meId) return;
    const local = cacheForUser(meId);
    if (local) {
      // پوسته‌ای که قبلاً روی همین دستگاه برای همین کاربر ساخته شده، یک‌بار به حساب منتقل می‌شود
      applyTheme(local);
      saveAccountTheme(local);
    } else {
      applyTheme(DEFAULT_THEME);
    }
  }, [remoteKey, meId]);
}

/** ساخت یک نسخه‌ی فشرده از تصویر برای پس‌زمینه‌ی گفتگو (JPEG، حداکثر ۱۶۰۰ پیکسل) */
async function wallpaperBlob(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("تصویر خوانده نشد"));
      i.src = url;
    });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("مرورگر پردازش تصویر را پشتیبانی نمی‌کند");
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("تصویر ساخته نشد");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Hook کامل تنظیمات پوسته برای کارت پروفایل */
export function useThemeSettings() {
  useDbTick();
  const [, bump] = useState(0);
  const settings = currentTheme();

  const update = (patch: Partial<ThemeSettings>, presetId: string = "custom") => {
    const next = normalizeTheme({ ...currentTheme(), ...patch, presetId });
    applyTheme(next);
    const me = currentUser();
    writeCache(next, me?.id ?? "");
    saveAccountTheme(next);
    bump((n) => n + 1);
    return next;
  };

  return { settings, update };
}

// ----------------------------------------------------------------------------
// اجزای کوچک
// ----------------------------------------------------------------------------

const PRESET_VARS = THEME_PRESETS.map((p) => themeVars(p.values).vars);

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
      style={{ background: value }}
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

/** رنگ با حالت «خودکار» (مقدار خالی): نمایش رنگ پیش‌فرض و دکمه‌ی بازگشت */
function AutoColor({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[12px] font-black text-slate-600 dark:text-slate-300">{label}</div>
      <div className="flex items-center gap-2.5">
        <ColorInput value={value || fallback} onChange={onChange} label={label} />
        <span className="text-[11px] font-semibold text-slate-400">{value ? value.toUpperCase() : "خودکار"}</span>
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-[11.5px] font-bold text-accent">
            خودکار
          </button>
        )}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between text-[12px] font-black text-slate-600 dark:text-slate-300">
        <span>{label}</span>
        <span className="tabular-nums text-slate-400">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--t-accent)]"
      />
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[12px] font-black text-slate-600 dark:text-slate-300">{title}</div>
      {children}
    </div>
  );
}

/** کاشی‌های انتخاب نقش، با پیش‌نمایش واقعی همان نقش */
function TexturePicker({ s, texVars, onPick }: { s: ThemeSettings; texVars: Record<string, string>; onPick: (id: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {TEXTURES.map((t) => {
        const on = s.texture === t.id;
        const img = t.id === "none" ? "none" : texVars["--t-tex-" + t.id] || "none";
        const size = t.id === "none" ? "auto" : texVars["--t-tex-size-" + t.id] || "auto";
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.id)}
            className={`overflow-hidden rounded-xl border text-center transition active:scale-[0.98] ${
              on ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-line-strong"
            }`}
          >
            <div
              className="h-12"
              style={{ backgroundColor: s.chatBg, backgroundImage: img, backgroundSize: size }}
            />
            <div className="bg-surface px-1 py-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">{t.label}</div>
          </button>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// کارت «ظاهر و پوسته» در پروفایل
// ----------------------------------------------------------------------------

/** کارت کامل تنظیمات ظاهری. bare=true یعنی داخل صفحه‌ی تمام‌صفحه‌ی «تنظیمات ظاهری» (عنوان آن صفحه نمایش داده می‌شود) */
export function AppearanceCard({ bare = false }: { bare?: boolean } = {}) {
  const toast = useToast();
  const { settings: s, update } = useThemeSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const sKey = JSON.stringify(s);
  const texVars = useMemo(() => themeVars(JSON.parse(sKey) as ThemeSettings).vars, [sKey]);
  const dark = s.mode !== "light";
  const fallbackBg = dark ? "#0b0c0e" : "#e4ebe6";

  const pickWallpaper = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!f.type.startsWith("image/")) return toast("error", "فقط فایل تصویر انتخاب کنید");
    setBusy(true);
    try {
      const blob = await wallpaperBlob(f);
      const form = new FormData();
      form.append("file", blob, "wallpaper.jpg");
      const res = await api<{ url: string }>("/api/upload", { form });
      update({ wallpaperUrl: res.url, texture: s.texture === "none" ? "doodle" : s.texture });
      toast("success", "تصویر پس‌زمینه ذخیره شد");
    } catch (err) {
      toast("error", (err as Error).message || "تصویر ذخیره نشد");
    } finally {
      setBusy(false);
    }
  };

  const applyPreset = (id: string) => {
    const v = presetValues(id);
    if (v) update({ ...v }, id);
  };

  const resetAll = () => {
    const v = presetValues("eitaa-dark");
    if (v) update({ ...v, wallpaperUrl: "", wallpaperDim: 0 }, "eitaa-dark");
    toast("success", "پوسته به ایتا شب برگشت");
  };

  return (
    <div className={bare ? "pb-8" : "card anim-fade-up mb-5 p-5"}>
      <div className="mb-1 flex items-center justify-between gap-2">
        {bare ? (
          <div className="text-[12.5px] font-bold text-slate-500">هر تغییری بلافاصله اعمال و در حساب شما ذخیره می‌شود</div>
        ) : (
          <div className="flex items-center gap-2 text-[13px] font-black text-slate-700 dark:text-slate-200">
            <Palette className="size-4 text-accent" />
            ظاهر و پوسته
          </div>
        )}
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
        پوسته‌ی شما در حساب کاربری ذخیره می‌شود و با ورود از هر دستگاهی همان ظاهر برمی‌گردد.
      </p>

      {/* پیش‌تنظیم‌ها */}
      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {THEME_PRESETS.map((p, i) => {
          const active = s.presetId === p.id;
          const v = PRESET_VARS[i];
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
                style={{
                  backgroundColor: p.values.chatBg,
                  backgroundImage: v["--t-texture"] || "none",
                  backgroundSize: v["--t-texture-size"] || "auto",
                }}
              >
                <div className="ms-auto mb-1.5 h-2.5 w-14 rounded-full" style={{ background: p.values.mine }} />
                <div className="h-2.5 w-20 rounded-full" style={{ background: p.values.other || (p.values.mode === "light" ? "#ffffff" : "#262626") }} />
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
        <Section title="حالت نمایش">
          <Seg<"dark" | "light">
            options={[
              { value: "dark", label: "تیره" },
              { value: "light", label: "روشن" },
            ]}
            value={s.mode}
            // تغییر حالت، زمینه‌ی گفتگو را به پیش‌فرض همان حالت می‌برد (تا گفتگوی تیره در حالت روشن نماند)
            onChange={(mode) => update(mode === "light" ? { mode, chatBg: "#e4ebe6" } : { mode, chatBg: "#0b0c0e" })}
          />
        </Section>

        <Section title="رنگ اصلی (دکمه‌ها، تب‌ها و نشان‌ها)">
          <div className="flex flex-wrap items-center gap-2.5">
            {ACCENT_SWATCHES.map((c) => (
              <ColorDot key={c} color={c} selected={s.accent === c} onPick={() => update({ accent: c })} label={`رنگ ${c}`} />
            ))}
            <ColorInput value={s.accent} onChange={(accent) => update({ accent })} label="رنگ اصلی دلخواه" />
          </div>
        </Section>

        <Section title="حباب پیام‌های من">
          <div className="flex flex-wrap items-center gap-2.5">
            {MINE_SWATCHES.map((c) => (
              <ColorDot key={c} color={c} selected={s.mine === c} onPick={() => update({ mine: c })} label={`حباب ${c}`} />
            ))}
            <ColorInput value={s.mine} onChange={(mine) => update({ mine })} label="رنگ حباب من دلخواه" />
          </div>
        </Section>

        <div className="grid gap-4 sm:grid-cols-2">
          <AutoColor label="رنگ متن حباب من" value={s.mineText} fallback="#ffffff" onChange={(mineText) => update({ mineText })} />
          <AutoColor
            label="حباب پیام دیگران"
            value={s.other}
            fallback={dark ? "#262626" : "#ffffff"}
            onChange={(other) => update({ other })}
          />
          <AutoColor label="رنگ متن حباب دیگران" value={s.otherText} fallback="#e8e8ec" onChange={(otherText) => update({ otherText })} />
          <AutoColor label="پس‌زمینه‌ی کلی برنامه" value={s.appBg} fallback={dark ? "#161616" : "#f2f4f7"} onChange={(appBg) => update({ appBg })} />
          <AutoColor label="رنگ کارت‌ها و لیست‌ها" value={s.surface} fallback={dark ? "#1e1e1e" : "#ffffff"} onChange={(surface) => update({ surface })} />
        </div>

        {/* زمینه‌ی گفتگو */}
        <Section title="پس‌زمینه‌ی گفتگو">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-[11.5px] font-bold text-slate-400">رنگ:</span>
              <ColorInput value={s.chatBg} onChange={(chatBg) => update({ chatBg })} label="رنگ زمینه‌ی گفتگو" />
              <span className="text-[11px] font-semibold text-slate-400">{s.chatBg.toUpperCase()}</span>
              {s.chatBg !== fallbackBg && (
                <button type="button" onClick={() => update({ chatBg: fallbackBg })} className="text-[11.5px] font-bold text-accent">
                  پیش‌فرض
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Toggle
                checked={!!s.chatBg2}
                onChange={(on) => update({ chatBg2: on ? (dark ? "#1f2a24" : "#cfe3d6") : "" })}
                label="گرادیان دورنگ"
              />
              {s.chatBg2 && <ColorInput value={s.chatBg2} onChange={(chatBg2) => update({ chatBg2 })} label="رنگ دوم گرادیان" />}
            </div>
            {s.chatBg2 && <Slider label="زاویه‌ی گرادیان" value={s.chatAngle} min={0} max={360} unit="°" onChange={(chatAngle) => update({ chatAngle })} />}

            <div>
              <div className="mb-2 text-[12px] font-black text-slate-600 dark:text-slate-300">نقش و بافت</div>
              <TexturePicker s={s} texVars={texVars} onPick={(texture) => update({ texture })} />
            </div>

            {s.texture !== "none" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <AutoColor label="رنگ نقش" value={s.textureColor} fallback={dark ? "#ffffff" : "#000000"} onChange={(textureColor) => update({ textureColor })} />
                <div className="space-y-3">
                  <Slider label="شفافیت نقش" value={s.textureOpacity} min={0} max={60} unit="%" onChange={(textureOpacity) => update({ textureOpacity })} />
                  <Slider label="اندازه‌ی نقش" value={s.textureScale} min={40} max={300} unit="%" onChange={(textureScale) => update({ textureScale })} />
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-2 text-[12px] font-bold text-slate-600 transition hover:bg-surface-3 disabled:opacity-60 dark:text-slate-300"
              >
                <ImagePlus className="size-4" />
                {busy ? "در حال بارگذاری…" : s.wallpaperUrl ? "تعویض تصویر پس‌زمینه" : "تصویر پس‌زمینه از گالری"}
              </button>
              {s.wallpaperUrl && (
                <button
                  type="button"
                  onClick={() => update({ wallpaperUrl: "", wallpaperDim: 0 })}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  <Trash2 className="size-4" />
                  حذف تصویر
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickWallpaper} />
            </div>
            {s.wallpaperUrl && (
              <Slider label="تیرگی تصویر" value={s.wallpaperDim} min={0} max={80} unit="%" onChange={(wallpaperDim) => update({ wallpaperDim })} />
            )}
          </div>
        </Section>

        {/* پیش‌نمایش زنده */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-black text-slate-600 dark:text-slate-300">
            {dark ? <Moon className="size-3.5" /> : <Sun className="size-3.5" />}
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
