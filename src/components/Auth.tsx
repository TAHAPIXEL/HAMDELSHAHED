"use client";

import { useMemo, useRef, useState } from "react";
import {
  GraduationCap,
  UserRound,
  Phone,
  KeyRound,
  Camera,
  ChevronLeft,
  ShieldCheck,
  School,
  Sparkles,
} from "lucide-react";
import {
  GRADES,
  SECTIONS,
  className,
  fa,
  avatarDataUrl,
  gradeFa,
  jalaaliDaysOfMonth,
  login,
  registerUser,
  type Grade,
  type StaffRole,
  type User,
} from "@/lib/model";
import { Avatar, Btn, Field, PasswordInput, inputCls, useToast } from "./ui";

type Tab = "student" | "staff";
type Mode = "login" | "register";

const staffRoleOptions: { value: StaffRole; label: string; hint: string }[] = [
  { value: "teacher", label: "دبیر", hint: "درس‌دهنده کلاس‌ها" },
  { value: "principal", label: "مدیر", hint: "دسترسی پنل مدیریت کامل" },
  { value: "edu_deputy", label: "معاون آموزشی", hint: "دسترسی پنل مدیریت" },
  { value: "cultural_deputy", label: "معاون پرورشی", hint: "بدون پنل مدیریت" },
  { value: "tech_deputy", label: "معاون فناوری", hint: "بدون پنل مدیریت" },
  { value: "counselor", label: "مشاور", hint: "مشاور و راهنمای مدرسه" },
];

const J_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];
const J_YEARS = Array.from({ length: 27 }, (_, i) => 1400 - i); // ۱۳۷۴ تا ۱۴۰۰

export default function Auth({ onAuth }: { onAuth: (u: User) => void }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("student");
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // فرم ورود
  const [phone, setPhone] = useState("");
  const [pass, setPass] = useState("");

  // فرم ثبت‌نام
  const [f, setF] = useState({
    firstName: "", lastName: "", fatherName: "", nationalId: "",
    address: "", phone: "", password: "", password2: "", staffKey: "",
  });
  const [grade, setGrade] = useState<Grade>(7);
  const [section, setSection] = useState("1");
  const [bYear, setBYear] = useState(1390);
  const [bMonth, setBMonth] = useState(1);
  const [bDay, setBDay] = useState(1);
  const [staffRole, setStaffRole] = useState<StaffRole>("teacher");
  const [avatar, setAvatar] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const sections = useMemo(() => SECTIONS[grade], [grade]);

  const fail = (errs: Record<string, string>, msg?: string) => {
    setErrors(errs);
    setShake((s) => s + 1);
    if (msg) toast("error", msg);
  };

  const submitLogin = async () => {
    const errs: Record<string, string> = {};
    if (!phone.trim()) errs.phone = "شماره تلفن را وارد کنید";
    if (!pass.trim()) errs.pass = "رمز عبور را وارد کنید";
    if (Object.keys(errs).length) return fail(errs);
    setBusy(true);
    await new Promise((r) => setTimeout(r, 380));
    const r = await login(phone, pass);
    setBusy(false);
    if (!r.ok || !r.user) {
      fail({ phone: " ", pass: " " }, r.error ?? "ورود ناموفق بود");
      return;
    }
    toast("success", r.dev ? "ورود مدیر ارشد انجام شد" : `خوش آمدید، ${r.user.firstName} عزیز`);
    onAuth(r.user);
  };

  const pickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatar(await avatarDataUrl(file));
    } catch (err) {
      toast("error", (err as Error).message || "بارگذاری تصویر ممکن نشد");
    }
  };

  const submitRegister = async () => {
    const errs: Record<string, string> = {};
    if (!f.firstName.trim()) errs.firstName = "نام الزامی است";
    if (!f.lastName.trim()) errs.lastName = "نام خانوادگی الزامی است";
    if (!/^09\d{9}$/.test(f.phone.trim())) errs.phone = "شماره تلفن معتبر نیست (مثل 09123456789)";
    if (!/^\d{4,}$/.test(f.password.trim())) errs.password = "رمز عبور فقط عدد و حداقل ۴ رقم";
    if (f.password !== f.password2) errs.password2 = "تکرار رمز مطابقت ندارد";
    if (tab === "student") {
      if (!f.fatherName.trim()) errs.fatherName = "نام پدر الزامی است";
      if (!/^\d{10}$/.test(f.nationalId.trim())) errs.nationalId = "کد ملی باید ۱۰ رقم باشد";
      if (!f.address.trim()) errs.address = "آدرس منزل الزامی است";
      if (!avatar) errs.avatar = "عکس پروفایل برای دانش‌آموز الزامی است";
    } else {
      if (!f.staffKey.trim()) errs.staffKey = "کد ثبت‌نام کادر را وارد کنید";
    }
    if (Object.keys(errs).length) return fail(errs, "لطفاً خطاهای فرم را برطرف کنید");
    setBusy(true);
    await new Promise((r) => setTimeout(r, 420));
    {
      const r = await registerUser({
        staffKey: tab === "student" ? undefined : f.staffKey.trim(),
        role: tab === "student" ? "student" : staffRole,
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim(),
        phone: f.phone.trim(),
        password: f.password.trim(),
        avatar,
        ...(tab === "student"
          ? {
              fatherName: f.fatherName.trim(),
              nationalId: f.nationalId.trim(),
              address: f.address.trim(),
              birthDate: `${bYear}/${bMonth}/${bDay}`,
              grade,
              section,
            }
          : { staffRole }),
      });
      setBusy(false);
      if (!r.ok || !r.user) {
        return fail({ [r.field ?? "phone"]: r.error ?? "خطا" }, r.error);
      }
      // ورود خودکار بعد از ثبت‌نام
      const lr = await login(f.phone, f.password);
      if (lr.ok && lr.user) {
        toast("success", "ثبت‌نام با موفقیت انجام شد. خوش آمدید!");
        onAuth(lr.user);
      }
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-app via-accent/10 to-app">
      {/* نورهای پس‌زمینه */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 right-1/4 size-96 rounded-full bg-indigo-400/20 blur-3xl dark:bg-indigo-600/10" />
        <div className="absolute bottom-0 left-1/4 size-96 rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-600/10" />
      </div>

      <div className="relative mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-2 lg:gap-16">
        {/* سمت برند */}
        <div className="anim-fade-up hidden flex-col gap-7 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-xl shadow-indigo-600/30">
              <GraduationCap className="size-7 text-white" />
            </div>
            <div>
              <div className="text-2xl font-black text-slate-800 dark:text-white">هَمدِل</div>
              <div className="text-[13px] font-semibold text-slate-400">دبیرستان شاهد شهیدان فهیمی</div>
            </div>
          </div>
          <h1 className="text-4xl font-black leading-[1.35] text-slate-800 dark:text-white">
            کلاسِ ما،
            <span className="bg-gradient-to-l from-indigo-600 to-violet-600 bg-clip-text text-transparent"> همیشه کنارِ هم</span>
          </h1>
          <p className="max-w-md text-[15px] leading-8 text-slate-500 dark:text-slate-400">
            سامانه اختصاصی دبیرستان شاهد شهیدان فهیمی: گفتگوی گروهی هر کلاس، پیام به دبیران،
            آزمون آنلاین، تکالیف، حضور و غیاب و اطلاعیه‌های مدرسه — همه در یک جای امن و ساده.
          </p>
          <div className="grid max-w-md grid-cols-2 gap-3">
            {[
              { icon: <School className="size-4.5" />, t: "گروه هر کلاس" },
              { icon: <Sparkles className="size-4.5" />, t: "آزمون آنلاین" },
              { icon: <ShieldCheck className="size-4.5" />, t: "امن و کنترل‌شده" },
              { icon: <UserRound className="size-4.5" />, t: "پروفایل شخصی" },
            ].map((x, i) => (
              <div key={i} className="card flex items-center gap-2.5 px-4 py-3 text-[13px] font-bold text-slate-600 dark:text-slate-300">
                <span className="text-indigo-500">{x.icon}</span>
                {x.t}
              </div>
            ))}
          </div>
        </div>

        {/* کارت اصلی */}
        <div key={shake} className={`anim-pop mx-auto w-full max-w-md ${shake ? "shake" : ""}`}>
          <div className="card overflow-hidden p-0 shadow-2xl shadow-indigo-900/5">
            <div className="flex items-center justify-between border-b border-line px-6 pb-0 pt-5 dark:border-white/5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 lg:hidden">
                  <GraduationCap className="size-5 text-white" />
                </div>
                <div className="pb-4 text-base font-black text-slate-800 dark:text-slate-100">
                  {mode === "login" ? "ورود به هَمدِل" : "ساخت حساب کاربری"}
                </div>
              </div>
            </div>

            {/* تب نوع کاربر */}
            <div className="px-6 pt-5">
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1.5 dark:bg-white/5">
                {(
                  [
                    { v: "student", label: "ورود دانش‌آموز", icon: <GraduationCap className="size-4" /> },
                    { v: "staff", label: "ورود کادر مدرسه", icon: <School className="size-4" /> },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.v}
                    onClick={() => { setTab(t.v); setErrors({}); }}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-bold transition ${
                      tab === t.v
                        ? "bg-surface text-indigo-700 shadow-sm dark:bg-white/15 dark:text-indigo-300"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                    }`}
                  >
                    {t.icon}
                    {mode === "login" ? t.label : t.v === "student" ? "ثبت‌نام دانش‌آموز" : "ثبت‌نام کادر"}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4 px-6 py-6">
              {mode === "login" ? (
                <>
                  <Field label="شماره تلفن" required error={errors.phone}>
                    <div className="relative">
                      <Phone className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                      <input
                        dir="ltr"
                        inputMode="numeric"
                        className={`${inputCls} pr-10 text-left`}
                        placeholder="09xxxxxxxxx"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                        onKeyDown={(e) => { if (e.key === "Enter") void submitLogin(); }}
                        maxLength={11}
                      />
                    </div>
                  </Field>
                  <Field label="رمز عبور" required error={errors.pass}>
                    <PasswordInput
                      value={pass}
                      onChange={setPass}
                      onEnter={() => void submitLogin()}
                      icon={<KeyRound className="size-4" />}
                    />
                  </Field>
                  <Btn className="w-full !py-3" onClick={() => void submitLogin()} loading={busy}>
                    ورود
                    <ChevronLeft className="size-4" />
                  </Btn>
                  <button
                    onClick={() => { setMode("register"); setErrors({}); }}
                    className="w-full pt-1 text-center text-[13px] font-semibold text-slate-400 transition hover:text-indigo-600"
                  >
                    حساب ندارید؟ <span className="font-bold text-indigo-600 dark:text-indigo-400">ثبت‌نام کنید</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="نام" required error={errors.firstName}>
                      <input className={inputCls} value={f.firstName} onChange={set("firstName")} placeholder="مثلاً علی" />
                    </Field>
                    <Field label="نام خانوادگی" required error={errors.lastName}>
                      <input className={inputCls} value={f.lastName} onChange={set("lastName")} placeholder="مثلاً رضایی" />
                    </Field>
                  </div>

                  {tab === "student" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="نام پدر" required error={errors.fatherName}>
                          <input className={inputCls} value={f.fatherName} onChange={set("fatherName")} />
                        </Field>
                        <Field label="کد ملی" required error={errors.nationalId}>
                          <input dir="ltr" inputMode="numeric" maxLength={10} className={`${inputCls} text-left`} value={f.nationalId}
                            onChange={(e) => setF((s) => ({ ...s, nationalId: e.target.value.replace(/[^\d]/g, "") }))} />
                        </Field>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="پایه تحصیلی" required>
                          <select className={inputCls} value={grade} onChange={(e) => { setGrade(Number(e.target.value) as Grade); setSection("1"); }}>
                            {GRADES.map((g) => (
                              <option key={g} value={g}>پایه {gradeFa[g]}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="شعبه کلاس" required>
                          <select className={inputCls} value={section} onChange={(e) => setSection(e.target.value)}>
                            {sections.map((s) => (
                              <option key={s} value={s}>شعبه {s}</option>
                            ))}
                          </select>
                        </Field>
                      </div>
                      <div className="rounded-xl bg-indigo-50/70 px-3.5 py-2.5 text-[12px] font-bold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                        کلاس شما: {className(grade, section)}
                      </div>
                      <Field label="تاریخ تولد (شمسی)" required>
                        <div className="grid grid-cols-3 gap-2">
                          <select className={inputCls} value={bDay} onChange={(e) => setBDay(Number(e.target.value))}>
                            {Array.from({ length: jalaaliDaysOfMonth(bYear, bMonth) }, (_, i) => i + 1).map((d) => (
                              <option key={d} value={d}>{fa(d)}</option>
                            ))}
                          </select>
                          <select className={inputCls} value={bMonth} onChange={(e) => { const m = Number(e.target.value); setBMonth(m); setBDay((d) => Math.min(d, jalaaliDaysOfMonth(bYear, m))); }}>
                            {J_MONTHS.map((m, i) => (
                              <option key={m} value={i + 1}>{m}</option>
                            ))}
                          </select>
                          <select className={inputCls} value={bYear} onChange={(e) => { const y = Number(e.target.value); setBYear(y); setBDay((d) => Math.min(d, jalaaliDaysOfMonth(y, bMonth))); }}>
                            {J_YEARS.map((y) => (
                              <option key={y} value={y}>{fa(y)}</option>
                            ))}
                          </select>
                        </div>
                      </Field>
                      <Field label="آدرس منزل" required error={errors.address}>
                        <textarea rows={2} className={`${inputCls} resize-none`} value={f.address} onChange={set("address")} />
                      </Field>
                    </>
                  )}

                  {tab === "staff" && (
                    <>
                      <Field label="سمت در مدرسه" required>
                        <div className="grid grid-cols-2 gap-2">
                          {staffRoleOptions.map((o) => (
                            <button
                              key={o.value}
                              onClick={() => setStaffRole(o.value)}
                              className={`rounded-xl border px-3 py-2.5 text-right transition ${
                                staffRole === o.value
                                  ? "border-indigo-400 bg-indigo-50/70 ring-2 ring-indigo-500/15 dark:border-indigo-400/50 dark:bg-indigo-500/10"
                                  : "border-line hover:border-line-strong dark:border-white/10 dark:hover:border-white/20"
                              }`}
                            >
                              <div className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{o.label}</div>
                              <div className="mt-0.5 text-[10.5px] text-slate-400">{o.hint}</div>
                            </button>
                          ))}
                        </div>
                      </Field>
                      <Field label="کد ثبت‌نام کادر" required error={errors.staffKey} hint="این کد را از مدیر مدرسه دریافت کنید">
                        <PasswordInput
                          value={f.staffKey}
                          onChange={(v) => setF((s) => ({ ...s, staffKey: v }))}
                          placeholder="••••••••"
                        />
                      </Field>
                    </>
                  )}

                  <Field label="شماره تلفن" required error={errors.phone}>
                    <input dir="ltr" inputMode="numeric" maxLength={11} className={`${inputCls} text-left`} value={f.phone}
                      onChange={(e) => setF((s) => ({ ...s, phone: e.target.value.replace(/[^\d]/g, "") }))} placeholder="09xxxxxxxxx" />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="رمز عبور (فقط عدد)" required error={errors.password}>
                      <PasswordInput value={f.password} onChange={(v) => setF((s) => ({ ...s, password: v }))} />
                    </Field>
                    <Field label="تکرار رمز" required error={errors.password2}>
                      <PasswordInput value={f.password2} onChange={(v) => setF((s) => ({ ...s, password2: v }))} />
                    </Field>
                  </div>

                  <Field
                    label={`عکس پروفایل ${tab === "student" ? "(الزامی)" : "(اختیاری)"}`}
                    required={tab === "student"}
                    error={errors.avatar}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar user={{ id: f.phone || "x", firstName: f.firstName || "؟", lastName: "", avatar }} size={52} ring />
                      <button
                        onClick={() => fileRef.current?.click()}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-3 py-3 text-[13px] font-bold text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 dark:border-white/10 dark:hover:border-indigo-400/50"
                      >
                        <Camera className="size-4" />
                        {avatar ? "تغییر عکس" : "انتخاب عکس از گالری"}
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
                    </div>
                  </Field>

                  <Btn className="w-full !py-3" onClick={() => void submitRegister()} loading={busy}>
                    ثبت‌نام و ورود
                    <ChevronLeft className="size-4" />
                  </Btn>
                  <button
                    onClick={() => { setMode("login"); setErrors({}); }}
                    className="w-full pt-1 text-center text-[13px] font-semibold text-slate-400 transition hover:text-indigo-600"
                  >
                    حساب دارید؟ <span className="font-bold text-indigo-600 dark:text-indigo-400">وارد شوید</span>
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="mt-4 text-center text-[11px] font-semibold text-slate-400">
            دبیرستان شاهد شهیدان فهیمی
          </p>
        </div>
      </div>
    </div>
  );
}
