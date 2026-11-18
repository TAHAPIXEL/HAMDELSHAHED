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
import { X, CheckCircle2, AlertTriangle, Info, Loader2, Eye, EyeOff, Copy } from "lucide-react";
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
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] z-[100] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => (
          <div
            key={t.id}
            className={`toast-in pointer-events-auto flex max-w-full items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-[0_18px_40px_-16px_rgb(18_24_40/0.35)] ${
              t.kind === "success"
                ? "border-emerald-200 bg-white text-emerald-700"
                : t.kind === "error"
                ? "border-rose-200 bg-white text-rose-600"
                : "border-sky-200 bg-white text-sky-700"
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
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-cyan-400",
  "from-emerald-500 to-teal-400",
  "from-rose-500 to-pink-500",
  "from-amber-500 to-orange-400",
  "from-fuchsia-500 to-purple-600",
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
      className={`relative flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-gradient-to-br font-black text-white ${palette} ${
        ring ? "ring-2 ring-white shadow-sm" : ""
      } ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {user?.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar} alt={name} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        initial
      )}
    </div>
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
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  icon?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="modal-bg absolute inset-0 bg-[#0b0f24]/55" onClick={onClose} />
      <div
        className={`modal-pop relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-[0_-20px_60px_-20px_rgb(11_15_36/0.45)] sm:rounded-3xl sm:shadow-[0_30px_80px_-24px_rgb(11_15_36/0.5)] ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="relative flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <span className="absolute left-1/2 top-1.5 block h-1 w-10 -translate-x-1/2 rounded-full bg-slate-200 sm:hidden" />
          <div className="flex items-center gap-2.5 text-[15px] font-black text-slate-800">
            {icon}
            <span>{title}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 active:scale-95"
            aria-label="بستن"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 [-webkit-overflow-scrolling:touch]">{children}</div>
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
      <span className="mb-1.5 flex items-center gap-1 text-[13px] font-bold text-slate-600">
        {label}
        {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-[11px] leading-5 text-slate-400">{hint}</span>}
      {error && <span className="mt-1.5 block text-[11px] font-semibold text-rose-500">{error}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] text-slate-800 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15";

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
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"
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
        className="min-w-0 break-all font-black tabular-nums text-slate-700"
        dir="ltr"
        style={{ overflowWrap: "anywhere" }}
      >
        {show ? value : "•".repeat(Math.max(4, value.length))}
      </span>
      <button
        onClick={() => setShow((s) => !s)}
        className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"
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
        className="shrink-0 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"
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
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-[transform,background,box-shadow] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50";
  const kinds = {
    primary:
      "btn-brand text-white hover:brightness-110",
    soft: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
    ghost:
      "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50",
    danger: "bg-rose-50 text-rose-600 hover:bg-rose-100",
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
    slate: "bg-slate-100 text-slate-600",
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70",
    red: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/70",
    amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/70",
    indigo: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/70",
    violet: "bg-violet-50 text-violet-700 ring-1 ring-violet-200/70",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${tones[tone]}`}>{children}</span>;
}

export function Empty({ icon, title, desc, action }: { icon: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="anim-fade-up flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500/12 to-violet-500/12 text-indigo-600 ring-1 ring-inset ring-indigo-500/10">
        {icon}
      </div>
      <div className="text-base font-black text-slate-700">{title}</div>
      {desc && <div className="max-w-xs text-[13px] leading-6 text-slate-500">{desc}</div>}
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
    <div className="flex rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] font-bold transition ${
            value === o.value
              ? "bg-white text-indigo-700 shadow-[0_1px_3px_rgb(18_24_40/0.12)]"
              : "text-slate-500 hover:text-slate-700"
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
      className="flex items-center gap-2.5 text-sm font-bold text-slate-600"
    >
      <span
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-indigo-600" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-all ${checked ? "left-[1.4rem]" : "left-0.5"}`}
        />
      </span>
      {label}
    </button>
  );
}

export function Stat({ label, value, icon, tone }: { label: string; value: string | number; icon: ReactNode; tone: string }) {
  return (
    <div className="card flex items-center gap-3.5 p-4 transition hover:-translate-y-0.5">
      <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xl font-black tabular-nums text-slate-800">{fa(value)}</div>
        <div className="truncate text-[12px] font-bold text-slate-500">{label}</div>
      </div>
    </div>
  );
}

export function Splash() {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-7 bg-[#0b0f24]">
      <div className="ink-grid pointer-events-none absolute inset-0" />
      <div className="splash-logo relative flex size-24 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-indigo-500 via-violet-600 to-sky-500 shadow-[0_20px_50px_-12px_rgb(124_58_237/0.7)]">
        <svg viewBox="0 0 24 24" className="size-12 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10L12 5 2 10l10 5 10-5z" />
          <path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" />
          <path d="M22 10v6" />
        </svg>
        <div className="absolute inset-0 rounded-[1.75rem] bg-gradient-to-br from-white/25 to-transparent" />
      </div>
      <div className="relative text-center">
        <div className="text-3xl font-black tracking-tight text-white">هَمدِل</div>
        <div className="mt-1.5 text-[13px] font-semibold text-indigo-200/70">دبیرستان شاهد شهیدان فهیمی</div>
      </div>
      <div className="relative flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="splash-dot size-2 rounded-full bg-sky-300" style={{ animationDelay: `${i * 0.15}s` }} />
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
      {desc && <p className="mb-5 text-sm leading-7 text-slate-500">{desc}</p>}
      <div className="flex justify-end gap-2">
        <Btn kind="ghost" onClick={onClose}>انصراف</Btn>
        <Btn kind={danger ? "danger" : "primary"} onClick={() => { onYes(); onClose(); }}>{yesLabel}</Btn>
      </div>
    </Modal>
  );
}
