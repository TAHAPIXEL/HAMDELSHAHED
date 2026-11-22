// ----------------------------------------------------------------------------
// موتور پوسته (تم) — کاملاً قابل شخصی‌سازی
// همه رنگ‌های سایت از متغیرهای CSS گرفته می‌شوند؛ با تغییر این متغیرها
// کل سایت (لیست گفتگو، هدر، حباب‌ها، تب‌ها، دکمه‌ها، والپیپر) عوض می‌شود.
// ----------------------------------------------------------------------------

export type WallpaperKind = "doodle" | "dots" | "solid" | "image";

export interface ThemeSettings {
  presetId: string; // شناسه پیش‌تنظیم انتخاب‌شده یا "custom"
  mode: "light" | "dark";
  accent: string; // رنگ اصلی (دکمه‌ها، تب فعال، نشان‌ها)
  mine: string; // رنگ حباب پیام‌های من
  other: string; // رنگ حباب پیام‌های دیگران ("" = پیش‌فرض حالت)
  bg: string; // پس‌زمینه‌ی کلی سایت ("" = پیش‌فرض حالت)
  wallpaper: WallpaperKind; // نقش پس‌زمینه‌ی گفتگو
  wallpaperColor: string; // رنگ زمینه‌ی گفتگو
}

export const THEME_KEY = "hamdel-theme-v1";
export const WALLPAPER_KEY = "hamdel-wallpaper-v1";

export const DEFAULT_THEME: ThemeSettings = {
  presetId: "eitaa-dark",
  mode: "dark",
  accent: "#58b662",
  mine: "#6f3b86",
  other: "",
  bg: "",
  wallpaper: "doodle",
  wallpaperColor: "#0b0c0e",
};

export interface ThemePreset {
  id: string;
  label: string;
  hint: string;
  values: Omit<ThemeSettings, "presetId">;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "eitaa-dark",
    label: "ایتا تیره",
    hint: "سبز و بنفش، مثل ایتا",
    values: { mode: "dark", accent: "#58b662", mine: "#6f3b86", other: "", bg: "", wallpaper: "doodle", wallpaperColor: "#0b0c0e" },
  },
  {
    id: "eitaa-light",
    label: "ایتا روشن",
    hint: "سبز روشن و روشن",
    values: { mode: "light", accent: "#4fa85c", mine: "#d9f2de", other: "#ffffff", bg: "", wallpaper: "doodle", wallpaperColor: "#e4ebe6" },
  },
  {
    id: "tg-dark",
    label: "تلگرام تیره",
    hint: "آبی و خاکستری تیره",
    values: { mode: "dark", accent: "#5b9cf6", mine: "#2b5278", other: "", bg: "", wallpaper: "doodle", wallpaperColor: "#0e1621" },
  },
  {
    id: "tg-light",
    label: "تلگرام روشن",
    hint: "آبی روشن با حباب سبز",
    values: { mode: "light", accent: "#3390ec", mine: "#effdde", other: "#ffffff", bg: "", wallpaper: "doodle", wallpaperColor: "#dce6ee" },
  },
  {
    id: "midnight",
    label: "شب مشکی",
    hint: "مشکی کامل، کم‌نور",
    values: { mode: "dark", accent: "#8b7cf6", mine: "#3b2f63", other: "#111111", bg: "#000000", wallpaper: "dots", wallpaperColor: "#000000" },
  },
];

export const ACCENT_SWATCHES = ["#58b662", "#3390ec", "#6366f1", "#8e5bd6", "#e0524a", "#e0873a", "#1fa39a", "#e0609a"];
export const MINE_SWATCHES = ["#6f3b86", "#2b5278", "#2f7d4a", "#4a4fb8", "#8c3b4f", "#1f6f6a", "#3a3f47", "#effdde"];

/**
 * اعمال پوسته روی صفحه. عمداً خودکفا (بدون وابستگی به متغیرهای ماژول) نوشته شده
 * تا بشود آن را به‌صورت رشته در اسکریپت اولیه‌ی <head> هم اجرا کرد (بدون چشمک رنگ).
 */
export function applyTheme(input: Partial<ThemeSettings>, wallpaperImage?: string | null) {
  const s = input as ThemeSettings;
  const root = document.documentElement;
  const dark = s.mode !== "light";
  const isHex = (h: unknown): h is string => typeof h === "string" && /^#[0-9a-fA-F]{6}$/.test(h);
  const pick = (v: unknown, fallback: string) => (isHex(v) ? v : fallback);
  const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const hex = (c: number[]) => "#" + c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
  // t = سهم رنگ اول (a) در ترکیب
  const mix = (a: string, b: string, t: number) => {
    const A = rgb(a);
    const B = rgb(b);
    return hex(A.map((x, i) => x * t + B[i] * (1 - t)));
  };
  const lum = (h: string) => {
    const [r, g, b] = rgb(h).map((x) => {
      const c = x / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const set = (k: string, v: string) => root.style.setProperty(k, v);

  const accent = pick(s.accent, "#58b662");
  const mineC = pick(s.mine, "#6f3b86");
  const base = dark
    ? {
        bg: "#161616", surface: "#1e1e1e", surface2: "#262626", surface3: "#2e2e2e",
        line: "#2a2a2a", lineStrong: "#3b3b3b", scrim: "#000000", ink: "#2e2e30",
        other: "#262626", wall: "#0b0c0e",
        t: ["#141414", "#f0f0f2", "#e6e6ea", "#d2d2d8", "#9b9ba3", "#8e8e96", "#b0b0b8", "#cacad0", "#e4e4e8", "#f5f5f7", "#0c0c0e"],
      }
    : {
        bg: "#f2f4f7", surface: "#ffffff", surface2: "#f1f3f6", surface3: "#e4e8ee",
        line: "#e3e7ed", lineStrong: "#cfd6df", scrim: "#0f172a", ink: "#0f172a",
        other: "#ffffff", wall: "#dce6ee",
        t: ["#f8fafc", "#f1f5f9", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b", "#475569", "#334155", "#1e293b", "#0f172a", "#020617"],
      };
  const bg = pick(s.bg, base.bg);
  const otherC = pick(s.other, base.other);
  const wallC = pick(s.wallpaperColor, base.wall);

  // رنگ‌های سطح (کارت‌ها و پس‌زمینه) — در حالت تیره از پس‌زمینه‌ی انتخابی مشتق می‌شوند
  const surface = dark ? mix("#ffffff", bg, 0.06) : base.surface;
  const surface2 = dark ? mix("#ffffff", bg, 0.1) : base.surface2;
  const surface3 = dark ? mix("#ffffff", bg, 0.16) : base.surface3;
  const line = dark ? mix("#ffffff", bg, 0.1) : base.line;
  const lineStrong = dark ? mix("#ffffff", bg, 0.2) : base.lineStrong;

  set("--t-bg", bg);
  set("--t-surface", surface);
  set("--t-surface-2", surface2);
  set("--t-surface-3", surface3);
  set("--t-line", line);
  set("--t-line-strong", lineStrong);
  set("--t-scrim", base.scrim);
  set("--t-ink", base.ink);
  set("--t-other", otherC);
  set("--t-mine", mineC);
  set("--t-mine-text", lum(mineC) > 0.45 ? "#101418" : "#ffffff");
  set("--t-other-text", dark ? "#e8e8ec" : "#1e293b");
  set("--t-accent", accent);
  set("--t-on-accent", lum(accent) > 0.45 ? "#101418" : "#ffffff");

  // مقیاس اصلی سبز/آبی/بنفش سایت (indigo) از رنگ اصلی ساخته می‌شود
  const acc = dark
    ? [mix(accent, surface, 0.14), mix(accent, surface, 0.22), mix(accent, surface, 0.36), mix(accent, "#ffffff", 0.45), mix(accent, "#ffffff", 0.22), accent, mix(accent, "#000000", 0.85), mix(accent, "#ffffff", 0.25), mix(accent, "#ffffff", 0.4), mix(accent, "#ffffff", 0.58), mix(accent, "#ffffff", 0.76)]
    : [mix(accent, "#ffffff", 0.1), mix(accent, "#ffffff", 0.18), mix(accent, "#ffffff", 0.32), mix(accent, "#ffffff", 0.52), mix(accent, "#ffffff", 0.75), accent, mix(accent, "#000000", 0.88), mix(accent, "#000000", 0.75), mix(accent, "#000000", 0.6), mix(accent, "#000000", 0.45), mix(accent, "#000000", 0.3)];
  // ترتیب: 50 100 200 300 400 500 600 700 800 900 950 (با ۵۰ و ۱۰۰ و ۲۰۰ برای زمینه‌ها)
  const accKeys = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
  const accVals = dark
    ? [acc[0], acc[1], acc[2], acc[3], acc[4], acc[5], acc[6], acc[7], acc[8], acc[9], acc[10]]
    : [acc[0], acc[1], acc[2], acc[3], acc[4], acc[5], acc[6], acc[7], acc[8], acc[9], acc[10]];
  accKeys.forEach((k, i) => set("--t-accent-" + k, accVals[i]));

  // مقیاس متن (slate): در حالت تیره روشن‌تر است تا متن‌ها خوانا باشند
  const slateKeys = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
  slateKeys.forEach((k, i) => set("--t-slate-" + k, base.t[i]));

  // پس‌زمینه‌ی گفتگو
  let wallpaper = "none";
  let wallSize = "auto";
  const stroke = dark ? "%23ffffff" : "%23000000";
  const alpha = dark ? "0.075" : "0.07";
  if (s.wallpaper === "image" && wallpaperImage) {
    wallpaper = 'url("' + wallpaperImage + '")';
    wallSize = "cover";
  } else if (s.wallpaper === "dots") {
    wallpaper = "radial-gradient(circle, " + (dark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.07)") + " 1.2px, transparent 1.6px)";
    wallSize = "22px 22px";
  } else if (s.wallpaper === "doodle") {
    // الگوی تکرارشونده‌ی ساده با شکل‌های کوچک (ستاره، دایره، مثلث، قلب)
    const g =
      "<g fill='none' stroke='" + stroke + "' stroke-opacity='" + alpha + "' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'>" +
      "<circle cx='30' cy='30' r='5'/><path d='M100 18l3.5 7 7.7 1.1-5.6 5.4 1.3 7.6-6.9-3.6-6.9 3.6 1.3-7.6-5.6-5.4 7.7-1.1z'/>" +
      "<path d='M32 118c3-6 9-6 10 0 1-6 7-6 10 0 2 5-6 10-10 14-4-4-12-9-10-14z'/><path d='M120 96l8 14h-16z'/>" +
      "<rect x='70' y='80' width='10' height='10' rx='2'/><path d='M18 74q6-6 12 0t12 0'/><circle cx='112' cy='132' r='2.2' fill='" + stroke + "'/>" +
      "<path d='M70 130l6-6 6 6-6 6z'/><circle cx='54' cy='54' r='1.8' fill='" + stroke + "'/></g>";
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='150' height='150' viewBox='0 0 150 150'>" + g + "</svg>";
    wallpaper = 'url("data:image/svg+xml;utf8,' + svg.replace(/#/g, "%23").replace(/"/g, "'") + '")';
    wallSize = "150px 150px";
  } else if (s.wallpaper === "solid") {
    wallpaper = "none";
  }
  set("--t-wallpaper-bg", wallC);
  set("--t-wallpaper", wallpaper);
  set("--t-wallpaper-size", wallSize);

  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#17181c" : "#f2f4f7");
}

/** اسکریپت اولیه‌ی <head>: پوسته‌ی ذخیره‌شده را قبل از رسم صفحه اعمال می‌کند */
export function themeBootScript(): string {
  return (
    "(function(){try{var s={};try{s=JSON.parse(localStorage.getItem('" +
    THEME_KEY +
    "')||'{}')}catch(e){}var w=null;try{w=localStorage.getItem('" +
    WALLPAPER_KEY +
    "')}catch(e){}(" +
    applyTheme.toString() +
    ")(Object.assign({}," +
    JSON.stringify(DEFAULT_THEME) +
    ",s),w);}catch(e){}})();"
  );
}
