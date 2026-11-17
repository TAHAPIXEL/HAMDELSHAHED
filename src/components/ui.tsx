"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  Download,
  ImagePlus,
  Info,
  KeyRound,
  Loader2,
  Trash2,
  X,
  XCircle,
  ZoomIn,
} from "lucide-react";
import { createPortal } from "react-dom";
import { fa, initials } from "@/lib/format";
import { errorMessage, uploadImage, type ImageFolder } from "@/lib/client";

/* ------------------------------- Toastها -------------------------------- */

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; text: string };

const ToastContext = createContext<{
  push: (text: string, kind?: ToastKind) => void;
}>({ push: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((text: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, kind, text }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {items.map((toast) => (
          <div
            key={toast.id}
            className={`toast-in pointer-events-auto flex max-w-md items-start gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ring-1 backdrop-blur-xl ${
              toast.kind === "success"
                ? "bg-emerald-50/95 text-emerald-800 ring-emerald-200"
                : toast.kind === "error"
                  ? "bg-rose-50/95 text-rose-700 ring-rose-200"
                  : "bg-white/95 text-slate-700 ring-slate-200"
            }`}
          >
            {toast.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : toast.kind === "error" ? (
              <XCircle className="mt-0.5 size-4 shrink-0" />
            ) : (
              <Info className="mt-0.5 size-4 shrink-0" />
            )}
            <span className="user-text">{toast.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* -------------------------------- Splash -------------------------------- */

export function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gradient-to-b from-indigo-50 via-white to-white">
      <div className="splash-logo grid size-24 place-items-center rounded-[28px] bg-gradient-to-br from-indigo-500 to-violet-600 text-4xl font-black text-white shadow-xl shadow-indigo-500/30">
        هـ
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-extrabold text-slate-800">هَمدِل</h1>
        <p className="mt-1 text-sm text-slate-500">دبیرستان شاهد شهیدان فهیمی</p>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="splash-dot size-2 rounded-full bg-indigo-400"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

/* -------------------------------- Avatar -------------------------------- */

export function Avatar({
  name,
  color = "#6366f1",
  src,
  size = 40,
  ring = false,
}: {
  name: string;
  color?: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(src && src !== failedUrl);

  if (showImage && src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        onError={() => setFailedUrl(src)}
        className={`shrink-0 select-none rounded-full object-cover ${
          ring ? "ring-2 ring-white" : "ring-1 ring-slate-200/80"
        }`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className={`grid shrink-0 select-none place-items-center rounded-full font-bold text-white ${
        ring ? "ring-2 ring-white" : ""
      }`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* -------------------------------- Badge --------------------------------- */

type Tone = "indigo" | "emerald" | "amber" | "rose" | "slate" | "sky" | "violet";

const toneClasses: Record<Tone, string> = {
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function Badge({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* -------------------------------- Button -------------------------------- */

type ButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "outline" | "danger" | "soft";
  size?: "sm" | "md";
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  title?: string;
};

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  disabled,
  loading,
  className = "",
  title,
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-60";
  const sizes = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm";
  const variants = {
    primary:
      "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/30 hover:brightness-105 active:scale-[0.98]",
    ghost: "text-slate-600 hover:bg-slate-100 active:scale-[0.98]",
    outline:
      "border border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/60 active:scale-[0.98]",
    danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:scale-[0.98]",
    soft: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 active:scale-[0.98]",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      className={`${base} ${sizes} ${variants[variant]} ${className}`}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

/* -------------------------------- Fields -------------------------------- */

export function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        {hint && <span className="text-[11px] font-normal text-slate-400">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-50";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`${inputClass} ${className}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea {...rest} className={`${inputClass} min-h-24 resize-y leading-6 ${className}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return (
    <select {...rest} className={`${inputClass} appearance-none ${className}`}>
      {children}
    </select>
  );
}

/* -------------------------------- Modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="بستن"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        className={`modal-pop relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl ${
          wide ? "sm:max-w-3xl" : "sm:max-w-lg"
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-800">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="بستن"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------- آپلود و نمایش تصویر -------------------------- */

export function ImageUploader({
  value,
  onChange,
  folder,
  label = "پیوست تصویر (اختیاری)",
  compact = false,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  folder: ImageFolder;
  label?: string;
  compact?: boolean;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, folder);
      onChange(url);
      toast.push("تصویر با موفقیت بارگذاری شد");
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="relative inline-block overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="پیش‌نمایش"
            className={compact ? "max-h-24 w-auto object-cover" : "max-h-44 w-auto object-contain"}
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            title="حذف تصویر"
            className="absolute top-1.5 left-1.5 grid size-7 place-items-center rounded-full bg-slate-900/70 text-white transition hover:bg-rose-600"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className={`inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50/50 hover:text-indigo-600 disabled:opacity-60 ${
            compact ? "px-2.5 py-1.5 text-[11px]" : "px-3.5 py-2.5 text-xs"
          }`}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin text-indigo-500" />
          ) : (
            <ImagePlus className="size-4 text-indigo-500" />
          )}
          {uploading ? "در حال آپلود تصویر…" : label}
        </button>
      )}
    </div>
  );
}

export function ImageAttachment({
  src,
  alt = "تصویر پیوست",
  className = "max-h-60",
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoomed]);

  if (!src) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="group relative block overflow-hidden rounded-xl ring-1 ring-black/5 transition hover:brightness-95"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={`w-auto max-w-full rounded-xl object-contain ${className}`}
        />
        <span className="pointer-events-none absolute bottom-1.5 left-1.5 grid size-6 place-items-center rounded-full bg-slate-900/60 text-white opacity-0 transition group-hover:opacity-100">
          <ZoomIn className="size-3.5" />
        </span>
      </button>

      {zoomed && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm"
          onClick={() => setZoomed(false)}
        >
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              download
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/25"
            >
              <Download className="size-4" /> دریافت اصلی
            </a>
            <button
              type="button"
              onClick={() => setZoomed(false)}
              className="grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
              aria-label="بستن"
            >
              <X className="size-5" />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88dvh] max-w-[92vw] rounded-2xl object-contain shadow-2xl"
          />
        </div>
        ,document.body)}
    </>
  );
}

/* --------------------------- پنجره‌ی تأیید حذف -------------------------- */

export function DeleteConfirmModal({
  open,
  onClose,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  onConfirm: (deletePassword: string) => Promise<void>;
}) {
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setPassword("");
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.push("رمز حذف را وارد کنید", "error");
      return;
    }
    setLoading(true);
    try {
      await onConfirm(password);
      setPassword("");
      onClose();
    } catch (err) {
      toast.push(errorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={description ?? "برای تأیید این عملیات، رمز حذف سامانه را وارد کنید."}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="رمز حذف">
          <div className="relative">
            <KeyRound className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="رمز حذف سامانه…"
              autoFocus
              className="pr-9"
              dir="ltr"
            />
          </div>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button type="submit" variant="danger" loading={loading}>
            <Trash2 className="size-4" /> تأیید و حذف
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/* ------------------------------ Misc UI --------------------------------- */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight text-slate-800 sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-slate-500 sm:text-sm">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-500">
        {icon}
      </div>
      <div>
        <p className="font-bold text-slate-700">{title}</p>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card p-4">
          <Skeleton className="mb-3 h-4 w-1/3" />
          <Skeleton className="mb-2 h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "indigo",
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  const bg: Record<Tone, string> = {
    indigo: "from-indigo-500/10 to-violet-500/5 text-indigo-600",
    emerald: "from-emerald-500/10 to-teal-500/5 text-emerald-600",
    amber: "from-amber-500/10 to-orange-500/5 text-amber-600",
    rose: "from-rose-500/10 to-pink-500/5 text-rose-600",
    slate: "from-slate-500/10 to-slate-400/5 text-slate-600",
    sky: "from-sky-500/10 to-blue-500/5 text-sky-600",
    violet: "from-violet-500/10 to-purple-500/5 text-violet-600",
  };
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${bg[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-slate-500">{label}</p>
        <p className="mt-0.5 text-lg font-extrabold text-slate-800">{fa(value)}</p>
        {hint && <p className="truncate text-[11px] text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

export function Progress({ value, tone = "indigo" }: { value: number; tone?: Tone }) {
  const colors: Record<string, string> = {
    indigo: "from-indigo-500 to-violet-500",
    emerald: "from-emerald-500 to-teal-500",
    amber: "from-amber-500 to-orange-500",
    rose: "from-rose-500 to-pink-500",
    slate: "from-slate-400 to-slate-500",
    sky: "from-sky-500 to-blue-500",
    violet: "from-violet-500 to-purple-500",
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={`h-full rounded-full bg-gradient-to-l ${colors[tone]} transition-all duration-500`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-slate-100/80 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
            value === tab.id
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}
