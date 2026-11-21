"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { X, CheckCircle2, AlertTriangle, Info, Loader2, Eye, EyeOff, Copy, ArrowRight } from "lucide-react";
import { fa, type User } from "@/lib/model";

// ----------------------------------------------------------------------------
// Toast
// ----------------------------------------------------------------------------

type ToastKind = "success" | "error" | "info";
interface ToastItem { id: number; kind: ToastKind; msg: string }

const ToastCtx = createContext<(kind: ToastKind, msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(1);
  const push = useCallback((kind: ToastKind, msg: string) => {
    const id = idRef.current++;
    setItems((s) => [...s, { id, kind, msg }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3800);
  }, []);
  // خطاهای همگام‌سازی با سرور (مثلاً تغییری که سرور نپذیرفت) به کاربر نشان داده می‌شود
  useEffect(() => {
    const onError = (e: Event) => push("error", String((e as CustomEvent).detail ?? "خطا"));
    window.addEventListener("hamdel:error", onError);
    return () => window.removeEventListener("hamdel:error", onError);
  }, [push]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex flex-col items-center gap-2 px-4">
        {items.map((t) => (
          <div
            key={t.id}
            className={`toast-in pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-2xl backdrop-blur-xl ${
              t.kind === "success"
                ? "border-emerald-300/60 bg-emerald-50/90 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/80 dark:text-emerald-200"
                : t.kind === "error"
                ? "border-rose-300/60 bg-rose-50/90 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/80 dark:text-rose-200"
                : "border-sky-300/60 bg-sky-50/90 text-sky-800 dark:border-sky-500/30 dark:bg-sky-950/80 dark:text-sky-200"
            }`}
          >
            {t.kind === "success" ? <CheckCircle2 className="size-4.5 shrink-0" /> : t.kind === "error" ? <AlertTriangle className="size-4.5 shrink-0" /> : <Info className="size-4.5 shrink-0" />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ----------------------------------------------------------------------------
// هوک تغییر دیتابیس محلی (زنده)
// ----------------------------------------------------------------------------

export function useDbTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("hamdel:db", bump);
    const iv = setInterval(bump, 2500); // فقط بازرسم UI؛ دریافت داده در store انجام می‌شود
    return () => {
      window.removeEventListener("hamdel:db", bump);
      clearInterval(iv);
    };
  }, []);
  return tick;
}

// ----------------------------------------------------------------------------
// آواتار
// ----------------------------------------------------------------------------

const PALETTES = [
  "from-indigo-500 to-violet-500",
  "from-sky-500 to-cyan-500",
  "from-emerald-500 to-teal-500",
  "from-rose-500 to-pink-500",
  "from-amber-500 to-orange-500",
  "from-fuchsia-500 to-purple-500",
];

export function Avatar({
  user,
  size = 40,
  className = "",
  ring = false,
}: {
  user?: Pick<User, "firstName" | "lastName" | "avatar" | "id"> | null;
  size?: number;
  className?: string;
  ring?: boolean;
}) {
  const name = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "?";
  const initial = name ? name.charAt(0) : "؟";
  const palette =
    PALETTES[[...(user?.id ?? name)].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTES.length];
  return (
    <div
      className={`relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-bold text-white ${palette} ${
        ring ? "ring-2 ring-white/70 dark:ring-white/10" : ""
      } ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {user?.avatar ? (
        <AvatarImage key={user.avatar} src={user.avatar} alt={name} fallback={initial} />
      ) : (
        initial
      )}
    </div>
  );
}

/** عکس پروفایل؛ اگر فایل در دسترس نباشد، به‌جای تصویر شکسته حروف اول نام نمایش داده می‌شود */
function AvatarImage({ src, alt, fallback }: { src: string; alt: string; fallback: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

// ----------------------------------------------------------------------------
// مودال
// ----------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  icon,
  page = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  icon?: ReactNode;
  /** صفحه‌ی کامل (تمام صفحه، بدون پایین‌کشویی) با دکمه‌ی بازگشت */
  page?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  if (page) {
    return (
      <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[90] flex flex-col bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-6 dark:border-white/5">
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-white/10"
            aria-label="بازگشت"
          >
            <ArrowRight className="size-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2.5 font-bold text-slate-800 dark:text-slate-100">
            {icon}
            <span className="truncate">{title}</span>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="mx-auto w-full max-w-2xl">{children}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="modal-bg absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`modal-pop relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-slate-200/70 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 sm:rounded-3xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-white/5">
          <div className="flex items-center gap-2.5 font-bold text-slate-800 dark:text-slate-100">
            {icon}
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200"
            aria-label="بستن"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// فرم
// ----------------------------------------------------------------------------

export function Field({
  label,
  required,
  error,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-slate-600 dark:text-slate-300">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] font-medium text-rose-500">{error}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100 dark:focus:border-indigo-400/60 dark:focus:bg-white/[0.07]";

/**
 * ورودی رمز عبور با دکمه چشم برای نمایش/پنهان کردن رمز
 * در تمام بخش‌های سایت از همین کامپوننت استفاده می‌شود.
 */
export function PasswordInput({
  value,
  onChange,
  placeholder = "••••",
  numeric = true,
  icon,
  onEnter,
  autoFocus,
  className = "",
  tracking = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  numeric?: boolean;
  icon?: ReactNode;
  onEnter?: () => void;
  autoFocus?: boolean;
  className?: string;
  tracking?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      {icon && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
      <input
        dir="ltr"
        type={show ? "text" : "password"}
        inputMode={numeric ? "numeric" : "text"}
        autoFocus={autoFocus}
        className={`${inputCls} ${icon ? "pr-10" : ""} pl-11 text-left ${tracking ? "tracking-[0.35em]" : ""} ${className}`}
        value={value}
        onChange={(e) => onChange(numeric ? e.target.value.replace(/[^\d]/g, "") : e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) onEnter();
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-white/10"
        aria-label={show ? "پنهان کردن رمز" : "نمایش رمز"}
        title={show ? "پنهان کردن رمز" : "نمایش رمز"}
        tabIndex={-1}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

/** نمایش رمز ذخیره‌شده یک کاربر با قابلیت آشکارسازی (برای کادر مجاز) */
export function SecretReveal({ value, label = "رمز عبور" }: { value: string; label?: string }) {
  const [show, setShow] = useState(false);
  const push = useContext(ToastCtx);
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <span
        className="min-w-0 break-all font-black tabular-nums text-slate-700 dark:text-slate-200"
        dir="ltr"
        style={{ overflowWrap: "anywhere" }}
      >
        {show ? value : "•".repeat(Math.max(4, value.length))}
      </span>
      <button
        onClick={() => setShow((s) => !s)}
        className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-white/10"
        aria-label={show ? `پنهان کردن ${label}` : `نمایش ${label}`}
        title={show ? "پنهان کردن" : "نمایش"}
      >
        {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      </button>
      <button
        onClick={() =>
          navigator.clipboard?.writeText(value).then(
            () => push("success", `${label} کپی شد`),
            () => push("error", "کپی ممکن نشد")
          )
        }
        className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-white/10"
        aria-label={`کپی ${label}`}
        title="کپی"
      >
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}

export function Btn({
  children,
  onClick,
  kind = "primary",
  className = "",
  disabled,
  type = "button",
  loading,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "danger" | "soft";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  loading?: boolean;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";
  const kinds = {
    primary:
      "bg-gradient-to-l from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:brightness-110",
    soft: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20",
    ghost:
      "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:bg-transparent dark:text-slate-300 dark:hover:bg-white/5",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled || loading} className={`${base} ${kinds[kind]} ${className}`}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

// ----------------------------------------------------------------------------
// کنترل‌های کوچک
// ----------------------------------------------------------------------------

export function Chip({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "red" | "amber" | "indigo" | "violet" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300",
    green: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    red: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

export function Empty({ icon, title, desc, action }: { icon: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex size-16 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-indigo-500 dark:from-indigo-500/15 dark:to-violet-500/15">
        {icon}
      </div>
      <div className="text-base font-bold text-slate-700 dark:text-slate-200">{title}</div>
      {desc && <div className="max-w-xs text-[13px] leading-6 text-slate-400">{desc}</div>}
      {action}
    </div>
  );
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl border border-slate-200 bg-slate-100/70 p-1 dark:border-white/10 dark:bg-white/5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition ${
            value === o.value
              ? "bg-white text-indigo-700 shadow dark:bg-white/15 dark:text-indigo-200"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300"
    >
      <span
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-indigo-600" : "bg-slate-300 dark:bg-white/15"}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${checked ? "left-[1.4rem]" : "left-0.5"}`}
        />
      </span>
      {label}
    </button>
  );
}

export function Stat({ label, value, icon, tone }: { label: string; value: string | number; icon: ReactNode; tone: string }) {
  return (
    <div className="card flex items-center gap-3.5 p-4">
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xl font-black text-slate-800 dark:text-slate-100">{fa(value)}</div>
        <div className="truncate text-[12px] font-semibold text-slate-400">{label}</div>
      </div>
    </div>
  );
}

export function Splash() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-6 bg-gradient-to-br from-slate-50 via-indigo-50/60 to-violet-50 dark:from-slate-950 dark:via-indigo-950/40 dark:to-slate-950">
      <div className="splash-logo relative flex size-24 items-center justify-center rounded-[2rem] bg-gradient-to-br from-indigo-600 to-violet-600 shadow-2xl shadow-indigo-600/40">
        <svg viewBox="0 0 24 24" className="size-12 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10L12 5 2 10l10 5 10-5z" />
          <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
          <path d="M22 10v6" />
        </svg>
        <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-white/25 to-transparent" />
      </div>
      <div className="text-center">
        <div className="text-2xl font-black tracking-tight text-slate-800 dark:text-white">هَمدِل</div>
        <div className="mt-1 text-[13px] font-semibold text-slate-400">دبیرستان شاهد شهیدان فهیمی</div>
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="splash-dot size-2 rounded-full bg-indigo-500" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

export function Confirm({
  open,
  onClose,
  onYes,
  title,
  desc,
  yesLabel = "تأیید",
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onYes: () => void;
  title: string;
  desc?: string;
  yesLabel?: string;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      {desc && <p className="mb-5 text-sm leading-7 text-slate-500 dark:text-slate-400">{desc}</p>}
      <div className="flex justify-end gap-2">
        <Btn kind="ghost" onClick={onClose}>انصراف</Btn>
        <Btn kind={danger ? "danger" : "primary"} onClick={() => { onYes(); onClose(); }}>{yesLabel}</Btn>
      </div>
    </Modal>
  );
}
