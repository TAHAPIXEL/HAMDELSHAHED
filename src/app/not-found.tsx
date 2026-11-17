import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#f6f7fb] px-6 text-center">
      <div className="grid size-16 place-items-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-black text-white shadow-lg shadow-indigo-500/25">
        هـ
      </div>
      <h1 className="text-2xl font-extrabold text-slate-800">صفحه پیدا نشد</h1>
      <p className="max-w-sm text-sm leading-7 text-slate-500">
        آدرسی که باز کرده‌اید وجود ندارد یا جابه‌جا شده است. می‌توانید به صفحه‌ی اصلی برگردید.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-indigo-500/25 transition hover:brightness-105"
      >
        بازگشت به هَمدِل
      </Link>
    </div>
  );
}
