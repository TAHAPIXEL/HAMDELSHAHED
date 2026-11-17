"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#f6f7fb] px-6 text-center">
      <div className="grid size-16 place-items-center rounded-3xl bg-rose-100 text-2xl text-rose-500">!</div>
      <h1 className="text-xl font-extrabold text-slate-800">خطایی رخ داد</h1>
      <p className="max-w-sm text-sm leading-7 text-slate-500">
        نمایش این بخش با مشکل مواجه شد. یک‌بار دیگر تلاش کنید؛ اگر تکرار شد با مدیر سامانه تماس بگیرید.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-900"
      >
        تلاش دوباره
      </button>
    </div>
  );
}
