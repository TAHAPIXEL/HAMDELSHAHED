"use client";

import { useState } from "react";
import {
  BookOpenCheck,
  CalendarCheck2,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  MessagesSquare,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { api, errorMessage } from "@/lib/client";
import type { Me } from "@/lib/types";
import { Button, Field, Input, useToast } from "./ui";

const FEATURES = [
  {
    icon: MessagesSquare,
    title: "گفت‌وگوی کلاسی و ارسال تصویر",
    text: "ارتباط مستقیم دبیر و دانش‌آموز با ذخیره‌سازی دائمی پیام‌ها و تصاویر",
  },
  {
    icon: BookOpenCheck,
    title: "تکالیف و آزمون آنلاین",
    text: "ارسال تکلیف و تصویر پاسخ، تصحیح، آزمون زمان‌دار و کارنامه‌ی لحظه‌ای",
  },
  {
    icon: CalendarCheck2,
    title: "حضور و غیاب دقیق",
    text: "ثبت حضور هر زنگ و گزارش تجمعی برای دانش‌آموز، دبیر و مدیریت",
  },
];

export default function Auth({ onAuth }: { onAuth: (user: Me) => void }) {
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError("نام کاربری و رمز عبور را وارد کنید");
      return;
    }
    setLoading(true);
    try {
      const result = await api<{ user: Me }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: username.trim(), password }),
      });
      toast.push(`خوش آمدید، ${result.user.fullName}`, "success");
      onAuth(result.user);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* ستون برند */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35) 0, transparent 45%), radial-gradient(circle at 85% 70%, rgba(255,255,255,0.25) 0, transparent 40%)",
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-white/15 text-xl font-black backdrop-blur">
              هـ
            </div>
            <div>
              <p className="text-lg font-extrabold">هَمدِل</p>
              <p className="text-xs text-indigo-100/80">دبیرستان شاهد شهیدان فهیمی</p>
            </div>
          </div>

          <h1 className="mt-12 text-3xl leading-snug font-extrabold">
            همه‌ی مدرسه،
            <br />
            در یک سامانه‌ی یکپارچه
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-7 text-indigo-100/90">
            اطلاعیه‌ها، تکالیف، آزمون‌های آنلاین، حضور و غیاب و گفت‌وگو؛ همه با ذخیره‌سازی ابری امن
            و گزارش‌های دقیق.
          </p>

          <ul className="mt-10 space-y-5">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex gap-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/15">
                  <feature.icon className="size-4.5" />
                </span>
                <div>
                  <p className="text-sm font-bold">{feature.title}</p>
                  <p className="mt-0.5 text-xs leading-6 text-indigo-100/75">{feature.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center gap-2 text-[11px] text-indigo-100/70">
          <ShieldCheck className="size-4" />
          سامانه‌ی رسمی دبیرستان شاهد شهیدان فهیمی · حفاظت‌شده با رمزنگاری امن
        </div>
      </aside>

      {/* ستون فرم */}
      <main className="flex items-center justify-center bg-[#f6f7fb] px-5 py-10">
        <div className="anim-fade-up w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-black text-white shadow-lg shadow-indigo-500/25">
              هـ
            </div>
            <div>
              <p className="font-extrabold text-slate-800">هَمدِل</p>
              <p className="text-[11px] text-slate-500">دبیرستان شاهد شهیدان فهیمی</p>
            </div>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-800">ورود به سامانه</h2>
          <p className="mt-1 text-xs text-slate-500">
            با نام کاربری و رمز عبوری که مدرسه در اختیارتان گذاشته وارد شوید.
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="نام کاربری">
              <div className="relative">
                <UserRound className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="نام کاربری خود را وارد کنید"
                  autoComplete="username"
                  className="pr-9"
                  dir="ltr"
                />
              </div>
            </Field>

            <Field label="رمز عبور">
              <div className="relative">
                <KeyRound className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="pr-9 pl-10"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute top-1/2 left-2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label={showPassword ? "پنهان‌کردن رمز" : "نمایش رمز"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>

            {error && (
              <p className="shake rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 ring-1 ring-rose-200">
                {error}
              </p>
            )}

            <Button type="submit" loading={loading} className="w-full">
              <GraduationCap className="size-4" />
              ورود به هَمدِل
            </Button>
          </form>

          <p className="mt-8 text-center text-[11px] leading-6 text-slate-400">
            در صورت فراموشی رمز عبور یا نداشتن حساب کاربری، به مدیریت مدرسه مراجعه کنید.
          </p>
        </div>
      </main>
    </div>
  );
}
