// ----------------------------------------------------------------------------
// موتور پوسته (تم) — کاملاً قابل شخصی‌سازی
// تنظیمات هر کاربر در رکورد خودش (فیلد theme در جدول کاربران) ذخیره می‌شود،
// پس با ورود از هر دستگاهی همان ظاهر برمی‌گردد. همه‌ی رنگ‌ها از متغیرهای CSS
// خوانده می‌شوند و با تغییر آن‌ها کل سایت عوض می‌شود.
// این فایل بدون وابستگی است تا هم در مرورگر و هم در سرور (اعتبارسنجی) استفاده شود.
// ----------------------------------------------------------------------------

export interface ThemeSettings {
  presetId: string; // پیش‌تنظیم انتخاب‌شده یا "custom"
  mode: "light" | "dark";
  accent: string; // رنگ اصلی (دکمه‌ها، تب‌ها، نشان‌ها)
  mine: string; // رنگ حباب پیام‌های من
  mineText: string; // رنگ متن حباب من ("" = خودکار بر اساس روشنی حباب)
  other: string; // رنگ حباب پیام‌های دیگران ("" = پیش‌فرض حالت)
  otherText: string; // رنگ متن حباب دیگران ("" = خودکار)
  appBg: string; // پس‌زمینه‌ی کلی برنامه ("" = پیش‌فرض حالت)
  surface: string; // رنگ کارت‌ها و لیست‌ها ("" = پیش‌فرض حالت)
  chatBg: string; // رنگ زمینه‌ی گفتگو
  chatBg2: string; // رنگ دوم گرادیان زمینه ("" = بدون گرادیان)
  chatAngle: number; // زاویه‌ی گرادیان (درجه)
  texture: string; // نقش پس‌زمینه (شناسه‌ی TEXTURES)
  textureColor: string; // رنگ نقش ("" = خودکار)
  textureOpacity: number; // شفافیت نقش (درصد ۰ تا ۶۰)
  textureScale: number; // اندازه‌ی نقش (درصد ۴۰ تا ۳۰۰)
  wallpaperUrl: string; // تصویر دلخواه گفتگو (آدرس فضای ابری)
  wallpaperDim: number; // تیرگی تصویر (درصد ۰ تا ۸۰)
}

export type ThemeValues = Omit<ThemeSettings, "presetId">;

export const THEME_KEY = "hamdel-theme-v2"; // کش محلی برای نمایش فوری قبل از دریافت حساب
const LEGACY_KEY = "hamdel-theme-v1";

export const TEXTURES: { id: string; label: string }[] = [
  { id: "none", label: "بدون نقش" },
  { id: "doodle", label: "نقش‌دار" },
  { id: "dots", label: "نقطه" },
  { id: "grid", label: "شطرنجی" },
  { id: "waves", label: "موج" },
  { id: "diamonds", label: "لوزی" },
  { id: "circles", label: "دایره" },
  { id: "hearts", label: "قلب" },
  { id: "stars", label: "ستاره" },
  { id: "stripes", label: "راه‌راه" },
  { id: "noise", label: "دانه‌ای" },
];
export const TEXTURE_IDS = TEXTURES.map((t) => t.id);

const HEX = /^#[0-9a-fA-F]{6}$/;

const BASE_DARK: ThemeValues = {
  mode: "dark",
  accent: "#58b662",
  mine: "#6f3b86",
  mineText: "",
  other: "",
  otherText: "",
  appBg: "",
  surface: "",
  chatBg: "#0b0c0e",
  chatBg2: "",
  chatAngle: 135,
  texture: "doodle",
  textureColor: "",
  textureOpacity: 8,
  textureScale: 100,
  wallpaperUrl: "",
  wallpaperDim: 0,
};
const BASE_LIGHT: ThemeValues = {
  ...BASE_DARK,
  mode: "light",
  accent: "#4fa85c",
  mine: "#d9f2de",
  other: "#ffffff",
  chatBg: "#e4ebe6",
};

export const DEFAULT_THEME: ThemeSettings = { presetId: "eitaa-dark", ...BASE_DARK };

export interface ThemePreset {
  id: string;
  label: string;
  hint: string;
  values: ThemeValues;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "eitaa-dark", label: "ایتا شب · Eitaa Night", hint: "سبز و بنفش، پیش‌فرض ایتا", values: BASE_DARK },
  { id: "eitaa-light", label: "ایتا روز · Eitaa Day", hint: "سبز روشن، پیش‌فرض ایتا", values: BASE_LIGHT },
  {
    id: "tg-dark",
    label: "شب آبی · Night Blue",
    hint: "آبی تیره با حباب آبی",
    values: { ...BASE_DARK, accent: "#5b9cf6", mine: "#2b5278", chatBg: "#0e1621", texture: "doodle", textureOpacity: 7 },
  },
  {
    id: "tg-light",
    label: "روز کلاسیک · Day Classic",
    hint: "آبی با حباب سبز روشن",
    values: { ...BASE_LIGHT, accent: "#3390ec", mine: "#effdde", chatBg: "#dce6ee", textureOpacity: 7 },
  },
  {
    id: "midnight",
    label: "شب · Night",
    hint: "مشکی کامل و کم‌نور",
    values: { ...BASE_DARK, accent: "#8b7cf6", mine: "#3b2f63", other: "#111111", appBg: "#000000", chatBg: "#000000", texture: "dots", textureOpacity: 14 },
  },
  {
    id: "ocean",
    label: "آبی تیره · Dark Blue",
    hint: "آبی عمیق با موج",
    values: { ...BASE_DARK, accent: "#38bdf8", mine: "#0e7490", other: "#0f2735", appBg: "#071b26", surface: "#0c2331", chatBg: "#0b2a3c", chatBg2: "#061722", chatAngle: 160, texture: "waves", textureColor: "#67e8f9", textureOpacity: 12 },
  },
  {
    id: "forest",
    label: "نعنایی · Dracula Mint",
    hint: "سبز تیره با لوزی",
    values: { ...BASE_DARK, accent: "#4ade80", mine: "#166534", other: "#1a2e22", appBg: "#0c1a12", surface: "#12241a", chatBg: "#0f2418", chatBg2: "#08130d", chatAngle: 170, texture: "diamonds", textureColor: "#86efac", textureOpacity: 9 },
  },
  {
    id: "sunset",
    label: "غروب · Sunset",
    hint: "بنفش و نارنجی با ستاره",
    values: { ...BASE_DARK, accent: "#f97316", mine: "#9a3412", other: "#2a1b2e", appBg: "#140c1c", surface: "#1f1428", chatBg: "#3b1d4a", chatBg2: "#1a0c22", chatAngle: 180, texture: "stars", textureColor: "#fdba74", textureOpacity: 14 },
  },
  {
    id: "paper",
    label: "کاغذی · Sepia",
    hint: "کرم روشن با خط شطرنجی",
    values: { ...BASE_LIGHT, accent: "#b45309", mine: "#fde68a", other: "#fffdf6", appBg: "#faf6ec", surface: "#fffdf7", chatBg: "#f5efe0", texture: "grid", textureColor: "#a16207", textureOpacity: 12 },
  },
  {
    id: "pink",
    label: "صورتی · Pink",
    hint: "روشن با قلب",
    values: { ...BASE_LIGHT, accent: "#db2777", mine: "#fbcfe8", other: "#ffffff", appBg: "#fdf2f8", surface: "#ffffff", chatBg: "#fce7f3", chatBg2: "#fbcfe8", chatAngle: 160, texture: "hearts", textureColor: "#ec4899", textureOpacity: 16 },
  },
  {
    id: "neon",
    label: "بخار نئون · Vapor Neon",
    hint: "مشکی با خط فیروزه‌ای",
    values: { ...BASE_DARK, accent: "#22d3ee", mine: "#7c3aed", mineText: "#ffffff", other: "#18181b", appBg: "#050507", chatBg: "#050507", texture: "diamonds", textureColor: "#22d3ee", textureOpacity: 18, textureScale: 80 },
  },
  {
    id: "graphite",
    label: "خاکستری فضایی · Space Grey",
    hint: "خاکستری مات با دایره",
    values: { ...BASE_DARK, accent: "#d4d4d8", mine: "#3f3f46", other: "#27272a", appBg: "#111113", surface: "#18181b", chatBg: "#18181b", texture: "circles", textureColor: "#71717a", textureOpacity: 14 },
  },
  {
    id: "gold",
    label: "طلایی · Gold",
    hint: "مشکی قهوه‌ای با راه‌راه",
    values: { ...BASE_DARK, accent: "#d4a017", mine: "#8a6d1d", other: "#1f1b12", appBg: "#120f09", surface: "#1b170e", chatBg: "#17130b", chatBg2: "#0c0a06", chatAngle: 200, texture: "stripes", textureColor: "#d4a017", textureOpacity: 9 },
  },
];

export const ACCENT_SWATCHES = ["#58b662", "#3390ec", "#6366f1", "#8e5bd6", "#e0524a", "#e0873a", "#1fa39a", "#e0609a"];
export const MINE_SWATCHES = ["#6f3b86", "#2b5278", "#2f7d4a", "#4a4fb8", "#8c3b4f", "#1f6f6a", "#3a3f47", "#effdde", "#d9f2de", "#fde68a"];

/** آدرس تصویر پس‌زمینه فقط اگر http(s) ساده باشد پذیرفته می‌شود (بدون کاراکتر خطرناک برای CSS) */
export function safeImageUrl(v: unknown): string {
  if (typeof v !== "string" || v.length > 1000) return "";
  if (!/^https?:\/\/[^\s"'()\\<>]+$/.test(v)) return "";
  return v;
}

/** تنظیمات خام (از کاربر یا سرور) را به شکل معتبر و امن تبدیل می‌کند */
export function normalizeTheme(raw: unknown): ThemeSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const D = DEFAULT_THEME;
  const color = (v: unknown, fb: string) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : fb);
  const colorOrAuto = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v.toLowerCase() : "");
  const num = (v: unknown, fb: number, lo: number, hi: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : fb;
  const str = (v: unknown, fb: string, max: number) => (typeof v === "string" && v.length <= max ? v : fb);

  // پشتیبانی از تنظیمات نسخه‌ی قبل (wallpaper = doodle | dots | solid | image)
  let texture = D.texture;
  if (typeof r.texture === "string") texture = TEXTURE_IDS.includes(r.texture) ? r.texture : "none";
  else if (typeof r.wallpaper === "string") texture = ({ doodle: "doodle", dots: "dots", solid: "none", image: "none" } as Record<string, string>)[r.wallpaper] ?? "doodle";

  const mode = r.mode === "light" ? "light" : "dark";
  const isLight = mode === "light";
  return {
    presetId: str(r.presetId, "custom", 40),
    mode,
    accent: color(r.accent, D.accent),
    mine: color(r.mine, "#6f3b86"),
    mineText: colorOrAuto(r.mineText),
    other: colorOrAuto(r.other),
    otherText: colorOrAuto(r.otherText),
    appBg: colorOrAuto(r.appBg),
    surface: colorOrAuto(r.surface),
    chatBg: color(r.chatBg, isLight ? "#e4ebe6" : "#0b0c0e"),
    chatBg2: colorOrAuto(r.chatBg2),
    chatAngle: num(r.chatAngle, D.chatAngle, 0, 360),
    texture,
    textureColor: colorOrAuto(r.textureColor),
    textureOpacity: num(r.textureOpacity, D.textureOpacity, 0, 60),
    textureScale: num(r.textureScale, D.textureScale, 40, 300),
    wallpaperUrl: safeImageUrl(r.wallpaperUrl),
    wallpaperDim: num(r.wallpaperDim, 0, 0, 80),
  };
}

/** مقادیر پیش‌تنظیم را (بدون شناسه) برای ذخیره آماده می‌کند */
export function presetValues(id: string): ThemeValues | null {
  const p = THEME_PRESETS.find((x) => x.id === id);
  return p ? p.values : null;
}

/**
 * محاسبه‌ی تمام متغیرهای CSS پوسته از روی تنظیمات.
 * عمداً تابعی خودکفاست (بدون ارجاع به متغیرهای سطح ماژول) تا با toString در اسکریپت اولیه‌ی <head>
 * هم اجرا شود و بعد از bundle شدن هم نام‌ها خراب نشوند.
 */
export function themeVars(input: Partial<ThemeSettings>): { dark: boolean; vars: Record<string, string> } {
  const s = (input || {}) as ThemeSettings;
  const vars: Record<string, string> = {};
  const set = (k: string, v: string) => {
    vars[k] = v;
  };
  const HEXRE = /^#[0-9a-fA-F]{6}$/;
  const isHex = (h: unknown): boolean => typeof h === "string" && HEXRE.test(h);
  const pick = (v: unknown, fallback: string): string => (isHex(v) ? (v as string) : fallback);
  const num = (v: unknown, fb: number, lo: number, hi: number): number =>
    typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb;
  const rgb = (h: string): number[] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const toHex = (c: number[]): string =>
    "#" + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
  // mix(a, b, t): t سهم رنگ a است
  const mix = (a: string, b: string, t: number): string => {
    const A = rgb(a);
    const B = rgb(b);
    return toHex(A.map((x, i) => x * t + B[i] * (1 - t)));
  };
  const lum = (h: string): number => {
    const ch = rgb(h).map((x) => {
      const c = x / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  };

  const dark = s.mode !== "light";
  const accent = pick(s.accent, "#58b662");
  const mineC = pick(s.mine, "#6f3b86");
  const base = dark
    ? {
        bg: "#161616", surface: "#1e1e1e", ink: "#2e2e30", other: "#262626", scrim: "#000000", tex: "#ffffff",
        t: ["#141414", "#f0f0f2", "#e6e6ea", "#d2d2d8", "#9b9ba3", "#8e8e96", "#b0b0b8", "#cacad0", "#e4e4e8", "#f5f5f7", "#0c0c0e"],
      }
    : {
        bg: "#f2f4f7", surface: "#ffffff", ink: "#0f172a", other: "#ffffff", scrim: "#0f172a", tex: "#000000",
        t: ["#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a", "#020617"],
      };

  const bg = pick(s.appBg, base.bg);
  const surface = isHex(s.surface) ? (s.surface as string) : dark ? mix("#ffffff", bg, 0.06) : base.surface;
  const surface2 = dark ? mix("#ffffff", surface, 0.05) : "#f1f3f6";
  const surface3 = dark ? mix("#ffffff", surface, 0.1) : "#e4e8ee";
  const line = dark ? mix("#ffffff", surface, 0.1) : "#e3e7ed";
  const lineStrong = dark ? mix("#ffffff", surface, 0.2) : "#cfd6df";
  // حباب‌ها باید همیشه از زمینه‌ی گفتگو به‌خوبی جدا باشند: اگر کنتراست کم بود، روشن‌تر/تیره‌تر می‌شوند
  const chatRef = pick(s.chatBg, dark ? "#0b0c0e" : "#e4ebe6");
  const contrast = (a: string, b: string): number => {
    const l1 = lum(a);
    const l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const apart = (c: string, ref: string, min: number): string => {
    if (contrast(c, ref) >= min) return c;
    const towards = lum(c) >= lum(ref) ? "#ffffff" : "#000000";
    let out = c;
    for (let i = 1; i <= 20 && contrast(out, ref) < min; i++) out = mix(towards, c, i * 0.05);
    return out;
  };
  const otherC = apart(pick(s.other, base.other), chatRef, 2.1);
  const mineC2 = apart(mineC, chatRef, 2.1);
  const mineText = isHex(s.mineText) ? (s.mineText as string) : lum(mineC2) > 0.45 ? "#101418" : "#ffffff";
  const otherText = isHex(s.otherText) ? (s.otherText as string) : lum(otherC) > 0.45 ? "#1e293b" : "#e8e8ec";

  set("--t-bg", bg);
  set("--t-surface", surface);
  // نوار ناوبری پایین: هم‌رنگ کارت‌ها تا در هر حالتی با پوسته هماهنگ باشد
  set("--t-nav", surface);
  set("--t-surface-2", surface2);
  set("--t-surface-3", surface3);
  set("--t-line", line);
  set("--t-line-strong", lineStrong);
  set("--t-scrim", base.scrim);
  set("--t-ink", base.ink);
  set("--t-other", otherC);
  set("--t-other-text", otherText);
  set("--t-mine", mineC2);
  set("--t-mine-text", mineText);
  set("--t-accent", accent);
  set("--t-on-accent", lum(accent) > 0.45 ? "#101418" : "#ffffff");

  // مقیاس رنگ اصلی (indigo و violet در کل سایت از همین مقیاس استفاده می‌کنند)
  const acc = dark
    ? [mix(accent, surface, 0.14), mix(accent, surface, 0.22), mix(accent, surface, 0.36), mix(accent, "#ffffff", 0.45), mix(accent, "#ffffff", 0.22), accent, mix(accent, "#000000", 0.85), mix(accent, "#ffffff", 0.25), mix(accent, "#ffffff", 0.4), mix(accent, "#ffffff", 0.58), mix(accent, "#ffffff", 0.76)]
    : [mix(accent, "#ffffff", 0.1), mix(accent, "#ffffff", 0.18), mix(accent, "#ffffff", 0.32), mix(accent, "#ffffff", 0.52), mix(accent, "#ffffff", 0.75), accent, mix(accent, "#000000", 0.88), mix(accent, "#000000", 0.75), mix(accent, "#000000", 0.6), mix(accent, "#000000", 0.45), mix(accent, "#000000", 0.3)];
  const accKeys = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
  accKeys.forEach((k, i) => set("--t-accent-" + k, acc[i]));
  const slateKeys = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
  slateKeys.forEach((k, i) => set("--t-slate-" + k, base.t[i]));

  // ---- نقش‌های پس‌زمینه (SVG) ----
  const tc = pick(s.textureColor, base.tex);
  const op = num(s.textureOpacity, 8, 0, 60) / 100;
  const scale = num(s.textureScale, 100, 40, 300) / 100;
  const uri = (inner: string, w: number, h: number): string => {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='" + w + "' height='" + h + "' viewBox='0 0 " + w + " " + h + "'>" + inner + "</svg>";
    return 'url("data:image/svg+xml;utf8,' + svg.replace(/#/g, "%23").replace(/"/g, "'") + '")';
  };
  const strokeG = "<g fill='none' stroke='" + tc + "' stroke-opacity='" + op + "' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'>";
  const fillG = "<g fill='" + tc + "' fill-opacity='" + op + "'>";
  const star = "M30 18L33.5 26L42 26.5L35.5 32L38 40.5L30 35.5L22 40.5L24.5 32L18 26.5L26.5 26Z";
  const TEX: Record<string, [number, number, string]> = {
    doodle: [150, 150, strokeG + "<circle cx='30' cy='30' r='5'/><path d='M100 18l3.5 7 7.7 1.1-5.6 5.4 1.3 7.6-6.9-3.6-6.9 3.6 1.3-7.6-5.6-5.4 7.7-1.1z'/><path d='M32 118c3-6 9-6 10 0 1-6 7-6 10 0 2 5-6 10-10 14-4-4-12-9-10-14z'/><path d='M120 96l8 14h-16z'/><rect x='70' y='80' width='10' height='10' rx='2'/><path d='M18 74q6-6 12 0t12 0'/><path d='M70 130l6-6 6 6-6 6z'/></g>"],
    dots: [40, 40, fillG + "<circle cx='20' cy='20' r='2'/></g>"],
    grid: [40, 40, strokeG + "<path d='M40 0H0V40'/></g>"],
    waves: [60, 30, strokeG + "<path d='M0 15q15-10 30 0t30 0'/></g>"],
    diamonds: [40, 40, strokeG + "<path d='M20 4L36 20 20 36 4 20Z'/></g>"],
    circles: [60, 60, strokeG + "<circle cx='30' cy='30' r='12'/><circle cx='30' cy='30' r='24'/></g>"],
    hearts: [60, 60, strokeG + "<path d='M30 46C10 32 4 24 6 16C8 8 20 6 30 16C40 6 52 8 54 16C56 24 50 32 30 46Z'/></g>"],
    stars: [60, 60, strokeG + "<path d='" + star + "'/></g>"],
    stripes: [20, 20, strokeG + "<path d='M0 20L20 0'/></g>"],
    noise: [120, 120, "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='120' height='120' filter='url(#n)' opacity='" + op + "'/>"],
  };
  Object.keys(TEX).forEach((k) => {
    set("--t-tex-" + k, uri(TEX[k][2], TEX[k][0], TEX[k][1]));
    set("--t-tex-size-" + k, Math.round(TEX[k][0] * scale) + "px " + Math.round(TEX[k][1] * scale) + "px");
  });
  const texKey = s.texture && Object.prototype.hasOwnProperty.call(TEX, s.texture) ? s.texture : "";
  set("--t-texture", texKey ? "var(--t-tex-" + texKey + ")" : "none");
  set("--t-texture-size", texKey ? "var(--t-tex-size-" + texKey + ")" : "auto");

  // ---- زمینه‌ی گفتگو: رنگ یا گرادیان + تصویر دلخواه با تیرگی ----
  const c1 = pick(s.chatBg, dark ? "#0b0c0e" : "#e4ebe6");
  const c2 = isHex(s.chatBg2) ? (s.chatBg2 as string) : "";
  const angle = num(s.chatAngle, 135, 0, 360);
  set("--t-wallpaper-bg", c1);
  set("--t-wallpaper-base", c2 ? "linear-gradient(" + angle + "deg, " + c1 + ", " + c2 + ")" : "none");
  const img = /^https?:\/\/[^\s"'()\\<>]+$/.test(String(s.wallpaperUrl || "")) && String(s.wallpaperUrl).length <= 1000 ? String(s.wallpaperUrl) : "";
  const dim = num(s.wallpaperDim, 0, 0, 80) / 100;
  set("--t-wallpaper-image", img ? "linear-gradient(rgb(0 0 0 / " + dim + "), rgb(0 0 0 / " + dim + ")), url(\"" + img + "\")" : "none");

  return { dark, vars };
}

/** اعمال پوسته روی صفحه‌ی فعلی */
export function applyTheme(input: Partial<ThemeSettings>): void {
  const r = themeVars(input);
  const root = document.documentElement;
  Object.keys(r.vars).forEach((k) => root.style.setProperty(k, r.vars[k]));
  root.classList.toggle("dark", r.dark);
  root.style.colorScheme = r.dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", r.vars["--t-bg"] || (r.dark ? "#161616" : "#f2f4f7"));
}

/** اسکریپت اولیه‌ی <head>: آخرین پوسته‌ی ذخیره‌شده را قبل از رسم صفحه اعمال می‌کند (بدون چشمک رنگ) */
export function themeBootScript(): string {
  return (
    "(function(){try{var s={};try{s=JSON.parse(localStorage.getItem('" +
    THEME_KEY +
    "')||localStorage.getItem('" +
    LEGACY_KEY +
    "')||'{}')||{}}catch(e){}var f=" +
    themeVars.toString() +
    ";var r=f(Object.assign({}," +
    JSON.stringify(DEFAULT_THEME) +
    ",s));var d=document.documentElement;Object.keys(r.vars).forEach(function(k){d.style.setProperty(k,r.vars[k])});d.classList.toggle('dark',r.dark);d.style.colorScheme=r.dark?'dark':'light';}catch(e){}})();"
  );
}
