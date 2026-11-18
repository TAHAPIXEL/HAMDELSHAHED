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
  uploadImage,
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
      setAvatar(await uploadImage(file, 420, 0.75, "registration"));
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
    <div className="relative min-h-dvh overflow-hidden">
      {/* بنر تیره‌ی بالای گوشی (بدون blur و انیمیشن سنگین) */}
      <div className="ink-panel absolute inset-x-0 top-0 h-64 lg:hidden" aria-hidden="true">
        <div className="ink-grid absolute inset-0" />
      </div>

      <div className="relative mx-auto grid min-h-dvh w-full max-w-6xl items-center gap-10 px-4 pb-10 pt-8 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-10">
        {/* سمت برند */}
        <div className="anim-fade-up hidden min-h-[calc(100dvh-5rem)] flex-col justify-center gap-7 overflow-hidden rounded-[2rem] relative p-10 text-white ink-panel lg:flex">
          <div className="ink-grid pointer-events-none absolute inset-0" />
          <div className="flex items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 via-violet-600 to-sky-500 shadow-[0_18px_40px_-14px_rgb(124_58_237/0.8)]">
              <GraduationCap className="size-7 text-white" />
            </div>
            <div>
              <div className="text-2xl font-black text-white">هَمدِل</div>
              <div className="text-[13px] font-semibold text-indigo-200/70">دبیرستان شاهد شهیدان فهیمی</div>
            </div>
          </div>
          <h1 className="text-4xl font-black leading-[1.35] text-white">
            کلاسِ ما،
            <span className="bg-gradient-to-l from-sky-300 via-violet-300 to-indigo-300 bg-clip-text text-transparent"> همیشه کنارِ هم</span>
          </h1>
          <p className="max-w-md text-[15px] leading-8 text-indigo-100/70">
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
              <div key={i} className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-[13px] font-bold text-indigo-50">
                <span className="text-sky-300">{x.icon}</span>
                {x.t}
              </div>
            ))}
          </div>
        </div>

        {/* کارت اصلی */}
        <div key={shake} className={`anim-pop mx-auto w-full max-w-md pt-6 lg:pt-0 ${shake ? "shake" : ""}`}>
          <div className="card overflow-hidden p-0 shadow-[0_30px_60px_-30px_rgb(11_15_36/0.45)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 pb-0 pt-5">
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-600/30 lg:hidden">
                  <GraduationCap className="size-5 text-white" />
                </div>
                <div className="pb-4 text-base font-black text-slate-800">
                  {mode === "login" ? "ورود به هَمدِل" : "ساخت حساب کاربری"}
                </div>
              </div>
            </div>

            {/* تب نوع کاربر */}
            <div className="px-6 pt-5">
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1.5">
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
                        ? "bg-white text-indigo-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
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
                  <Btn className="w-full !py-3.5" onClick={() => void submitLogin()} loading={busy}>
                    ورود
                    <ChevronLeft className="size-4" />
                  </Btn>
                  <button
                    onClick={() => { setMode("register"); setErrors({}); }}
                    className="w-full pt-1 text-center text-[13px] font-semibold text-slate-500 transition hover:text-indigo-600"
                  >
                    حساب ندارید؟ <span className="font-bold text-indigo-600">ثبت‌نام کنید</span>
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
                      <div className="rounded-xl bg-indigo-50 px-3.5 py-2.5 text-[12px] font-bold text-indigo-700">
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
                              className={`rounded-xl border px-3 py-2.5 text-right transition active:scale-[0.98] ${
                                staffRole === o.value
                                  ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-500/15"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <div className="text-[13px] font-bold text-slate-700">{o.label}</div>
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
                        className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-3 py-3 text-[13px] font-bold text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600"
                      >
                        <Camera className="size-4" />
                        {avatar ? "تغییر عکس" : "انتخاب عکس از گالری"}
                      </button>
                      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />
                    </div>
                  </Field>

                  <Btn className="w-full !py-3.5" onClick={() => void submitRegister()} loading={busy}>
                    ثبت‌نام و ورود
                    <ChevronLeft className="size-4" />
                  </Btn>
                  <button
                    onClick={() => { setMode("login"); setErrors({}); }}
                    className="w-full pt-1 text-center text-[13px] font-semibold text-slate-500 transition hover:text-indigo-600"
                  >
                    حساب دارید؟ <span className="font-bold text-indigo-600">وارد شوید</span>
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="mt-4 text-center text-[11px] font-semibold text-slate-500 lg:text-indigo-200/60">
            دبیرستان شاهد شهیدان فهیمی
          </p>
        </div>
      </div>
    </div>
  );
}
