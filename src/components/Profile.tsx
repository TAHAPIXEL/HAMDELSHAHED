"use client";

import { AppearanceCard } from "./Appearance";
import { useRef, useState } from "react";
import { THEME_PRESETS } from "@/lib/theme";
import {
  ChevronLeft,
  Palette,
  Camera,
  Loader2,
  LogOut,
  Pencil,
  Lock,
  Phone,
  IdCard,
  MapPin,
  UserRound,
  CalendarDays,
  Cake,
  KeyRound,
  ShieldCheck,
  MessagesSquare,
  CalendarCheck2,
  ShieldHalf,
  UserCheck2,
  UserX2,
  AlarmClock,
  Copy,
  Crown,
  ClipboardList,
  Megaphone,
} from "lucide-react";
import {
  DB,
  canAdminPanel,
  className,
  currentUser,
  fa,
  faDate,
  faDateTime,
  avatarDataUrl,
  isStaff,
  JALALI_MONTHS,
  jalaaliDaysOfMonth,
  roleFa,
  type User,
} from "@/lib/model";
import { Avatar, Btn, Chip, Field, Modal, SecretReveal, inputCls, useDbTick, useToast } from "./ui";
import { useThemeSettings } from "./Appearance";

/** ذخیره‌ی آدرس عکس (که قبلاً در فضای ابری ذخیره شده) در پروفایل کاربر؛ اگر کاربر پیدا نشود false */
function saveAvatarUrl(userId: string, url: string): boolean {
  const users = DB.users();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx < 0) return false;
  users[idx] = { ...users[idx], avatar: url };
  DB.saveUsers(users);
  return true;
}

// ⚠️ مهم: این کامپوننت بیرون از Profile تعریف شده تا با هر به‌روزرسانی دوباره ساخته نشود
// (تعریف داخلی باعث چشمک‌زدن کارت‌ها می‌شد)
function InfoRow({
  icon,
  label,
  value,
  ltr,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  ltr?: boolean;
  action?: React.ReactNode;
}) {
  if (!value || value === "—") return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-app px-4 py-5 transition hover:bg-surface-2/80 dark:bg-white/5 dark:hover:bg-white/[0.07]">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-indigo-500 shadow-sm ring-1 ring-line/60 dark:bg-white/10 dark:ring-white/10">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-bold text-slate-400">{label}</div>
        {/* نمایش کامل متن بدون بریدن — حتی اگر خیلی طولانی باشد */}
        <div className={`user-text mt-1 text-[13.5px] font-black leading-6.5 text-slate-700 dark:text-slate-200 ${ltr ? "text-left" : ""}`} dir={ltr ? "ltr" : undefined}>
          {value}
        </div>
      </div>
      {action}
    </div>
  );
}

function MiniStat({ icon, value, label, tone }: { icon: React.ReactNode; value: string | number; label: string; tone: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <span className={`flex size-8 items-center justify-center rounded-xl ${tone}`}>{icon}</span>
      <div className="text-lg font-black text-slate-800 dark:text-slate-100">{fa(value)}</div>
      <div className="text-[10.5px] font-bold text-slate-400">{label}</div>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card group flex flex-col items-center gap-2 !rounded-2xl p-4 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-900/5"
    >
      <span className="flex size-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-indigo-500 transition group-hover:from-indigo-600 group-hover:to-violet-600 group-hover:text-white dark:from-indigo-500/15 dark:to-violet-500/15">
        {icon}
      </span>
      <span className="text-[12px] font-black text-slate-600 dark:text-slate-300">{label}</span>
    </button>
  );
}

// ----------------------------------------------------------------------------
// ویرایش اطلاعات شخصی
// قابل ویرایش: نام، نام خانوادگی، نام پدر، تاریخ تولد، آدرس و عکس
// غیرقابل ویرایش (تنظیم اداری): شماره تلفن، کد ملی، کلاس/سمت و رمز عبور
// ----------------------------------------------------------------------------

function EditProfileModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const toast = useToast();
  const me = DB.users().find((u) => u.id === userId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(me?.firstName ?? "");
  const [lastName, setLastName] = useState(me?.lastName ?? "");
  const [fatherName, setFatherName] = useState(me?.fatherName ?? "");
  const [address, setAddress] = useState(me?.address ?? "");
  const [avatar, setAvatar] = useState<string | undefined>(me?.avatar);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const isStudent = me?.role === "student";
  // تاریخ تولد شمسی
  const parseBirth = (bd?: string) => {
    if (!bd) return { y: 1390, m: 1, d: 1 };
    const [y, m, d] = bd.split("/").map(Number);
    return { y: y || 1390, m: m || 1, d: d || 1 };
  };
  const [bY, setBY] = useState(parseBirth(me?.birthDate).y);
  const [bM, setBM] = useState(parseBirth(me?.birthDate).m);
  const [bD, setBD] = useState(parseBirth(me?.birthDate).d);

  if (!me) return null;

  const save = () => {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = "نام الزامی است";
    if (!lastName.trim()) e.lastName = "نام خانوادگی الزامی است";
    if (isStudent && !fatherName.trim()) e.fatherName = "نام پدر الزامی است";
    if (isStudent && !address.trim()) e.address = "آدرس منزل الزامی است";
    if (Object.keys(e).length) {
      setErr(e);
      return;
    }
    setBusy(true);
    const users = DB.users();
    const idx = users.findIndex((u) => u.id === me.id);
    if (idx < 0) {
      setBusy(false);
      toast("error", "حساب شما پیدا نشد؛ یک بار خارج و دوباره وارد شوید.");
      return;
    }
    users[idx] = {
      ...users[idx],
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      ...(isStudent
        ? {
            fatherName: fatherName.trim(),
            address: address.trim(),
            birthDate: `${bY}/${bM}/${bD}`,
          }
        : {}),
      ...(avatar !== undefined ? { avatar } : {}),
    };
    DB.saveUsers(users);
    setBusy(false);
    toast("success", "اطلاعات شما با موفقیت به‌روزرسانی شد");
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="ویرایش اطلاعات من" icon={<Pencil className="size-5 text-indigo-500" />}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="نام" required error={err.firstName}>
            <input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field label="نام خانوادگی" required error={err.lastName}>
            <input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
        </div>

        {isStudent && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="نام پدر" required error={err.fatherName}>
                <input className={inputCls} value={fatherName} onChange={(e) => setFatherName(e.target.value)} />
              </Field>
              <Field label="تاریخ تولد (شمسی)" required>
                <div className="grid grid-cols-3 gap-1.5">
                  <select className={`${inputCls} !px-1.5 !text-[12px]`} value={bD} onChange={(e) => setBD(Number(e.target.value))}>
                    {Array.from({ length: jalaaliDaysOfMonth(bY, bM) }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{fa(d)}</option>
                    ))}
                  </select>
                  <select className={`${inputCls} !px-1.5 !text-[12px]`} value={bM} onChange={(e) => { const m = Number(e.target.value); setBM(m); setBD((d) => Math.min(d, jalaaliDaysOfMonth(bY, m))); }}>
                    {JALALI_MONTHS.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <select className={`${inputCls} !px-1 !text-[12px]`} value={bY} onChange={(e) => { const y = Number(e.target.value); setBY(y); setBD((d) => Math.min(d, jalaaliDaysOfMonth(y, bM))); }}>
                    {Array.from({ length: 27 }, (_, i) => 1400 - i).map((y) => (
                      <option key={y} value={y}>{fa(y)}</option>
                    ))}
                  </select>
                </div>
              </Field>
            </div>
            <Field label="آدرس منزل" required error={err.address}>
              <textarea
                rows={3}
                className={`${inputCls} resize-none leading-7`}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="آدرس را کامل بنویسید..."
              />
            </Field>
          </>
        )}

        <Field label="عکس پروفایل" hint="برای تغییر، روی دکمه بزنید">
          <div className="flex items-center gap-3">
            <Avatar user={{ id: me.id, firstName: firstName || "؟", lastName: "", avatar }} size={46} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-3 py-3 text-[12.5px] font-bold text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-60"
            >
              {photoBusy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              {avatar ? "تغییر عکس" : "انتخاب عکس"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setPhotoBusy(true);
                  try {
                    // عکس بلافاصله ذخیره می‌شود (مثل دکمه‌ی دوربین کارت پروفایل)،
                    // تا با خطای فرم‌های دیگر گم نشود
                    const url = await avatarDataUrl(f);
                    if (!saveAvatarUrl(userId, url)) throw new Error("حساب شما پیدا نشد؛ یک بار خارج و دوباره وارد شوید.");
                    setAvatar(url);
                    toast("success", "عکس پروفایل به‌روز شد");
                  } catch (err) {
                    toast("error", (err as Error).message || "بارگذاری تصویر ممکن نشد");
                  } finally {
                    setPhotoBusy(false);
                  }
                }
                e.target.value = "";
              }}
            />
          </div>
        </Field>

        {/* موارد غیرقابل تغییر توسط کاربر */}
        <div className="space-y-2">
          <div className="text-[11px] font-black text-slate-400">این موارد فقط توسط مدیر قابل تغییر است:</div>
          <div className="flex items-center justify-between gap-2 rounded-xl bg-app px-3.5 py-2.5">
            <span className="text-[11px] font-bold text-slate-400">شماره تلفن (شناسه ورود)</span>
            <span className="text-[12.5px] font-black text-slate-600">{me.phone}</span>
          </div>
          {isStudent && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-app px-3.5 py-2.5">
              <span className="text-[11px] font-bold text-slate-400">کد ملی</span>
              <span className="text-[12.5px] font-black text-slate-600">{fa(me.nationalId ?? "")}</span>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 rounded-xl bg-app px-3.5 py-2.5">
            <span className="text-[11px] font-bold text-slate-400">{isStudent ? "کلاس" : "سمت در مدرسه"}</span>
            <span className="text-[12.5px] font-black text-slate-600">
              {isStudent && me.grade ? className(me.grade, me.section!) : roleFa(me)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-xl bg-app px-3.5 py-2.5">
            <span className="text-[11px] font-bold text-slate-400">رمز عبور</span>
            <span className="flex items-center gap-1 text-[12px] font-bold text-slate-500">
              <Lock className="size-3 text-slate-300" />
              فقط با مدیر مدرسه
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Btn kind="ghost" onClick={onClose}>انصراف</Btn>
          <Btn onClick={save} loading={busy}>ذخیره تغییرات</Btn>
        </div>
      </div>
    </Modal>
  );
}

export default function Profile({
  user,
  onLogout,
  onGo,
}: {
  user: User;
  onLogout: () => void;
  onGo: (v: "chats" | "classes" | "exams" | "attendance" | "notices" | "admin") => void;
}) {
  useDbTick();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const me = currentUser() ?? user;
  const [changing, setChanging] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const { settings: themeSettings } = useThemeSettings();
  const themeLabel = THEME_PRESETS.find((p) => p.id === themeSettings.presetId)?.label ?? "پوسته‌ی سفارشی";
  const isDev = me.role === "developer";

  const changeAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (isDev) return toast("info", "حساب مدیر ارشد عکس ندارد");
    setChanging(true);
    try {
      const data = await avatarDataUrl(f);
      if (!saveAvatarUrl(me.id, data)) throw new Error("حساب شما پیدا نشد؛ یک بار خارج و دوباره وارد شوید.");
      toast("success", "عکس پروفایل به‌روز شد");
    } catch (err) {
      toast("error", (err as Error).message || "بارگذاری تصویر ممکن نشد");
    } finally {
      setChanging(false);
    }
    e.target.value = "";
  };

  const copyPhone = () => {
    navigator.clipboard?.writeText(me.phone).then(
      () => toast("success", "شماره تلفن کپی شد"),
      () => toast("error", "کپی ممکن نشد")
    );
  };

  // آمار بر اساس نقش
  let stats: { icon: React.ReactNode; value: number | string; label: string; tone: string }[] = [];
  if (me.role === "student") {
    const recs = DB.attendance().filter((r) => r.studentId === me.id);
    stats = [
      { icon: <UserCheck2 className="size-4" />, value: recs.filter((r) => r.status === "present").length, label: "روز حاضر", tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
      { icon: <UserX2 className="size-4" />, value: recs.filter((r) => r.status === "absent").length, label: "روز غایب", tone: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" },
      { icon: <AlarmClock className="size-4" />, value: recs.filter((r) => r.status === "excused").length, label: "روز موجه", tone: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" },
    ];
  } else if (isDev) {
    stats = [
      { icon: <UserRound className="size-4" />, value: DB.users().length, label: "کاربر سامانه", tone: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300" },
      { icon: <MessagesSquare className="size-4" />, value: DB.messages().length, label: "پیام ارسالی کل", tone: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" },
      { icon: <ClipboardList className="size-4" />, value: DB.exams().length, label: "آزمون سامانه", tone: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
    ];
  } else {
    stats = [
      { icon: <MessagesSquare className="size-4" />, value: DB.messages().filter((m) => m.senderId === me.id && !m.deleted).length, label: "پیام ارسالی", tone: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300" },
      { icon: <Megaphone className="size-4" />, value: DB.chats().filter((c) => c.createdBy === me.id && c.type !== "direct").length, label: "گروه/کانال ساخته", tone: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" },
      { icon: <ClipboardList className="size-4" />, value: DB.exams().filter((e) => e.createdBy === me.id).length, label: "آزمون طراحی‌شده", tone: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" },
    ];
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-2xl">
        {/* کارت هویت */}
        <div className="card anim-fade-up relative mb-5 overflow-hidden p-0">
          <div className={`relative h-32 ${isDev ? "bg-gradient-to-l from-ink via-ink to-ink" : "bg-gradient-to-l from-indigo-600 via-violet-600 to-fuchsia-500"}`}>
            <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1px)", backgroundSize: "18px 18px" }} />
            <div className="absolute -top-10 left-8 size-40 rounded-full bg-surface/10 blur-2xl" />
            <div className="absolute -bottom-16 right-1/4 size-40 rounded-full bg-surface/10 blur-2xl" />
            {isDev && <Crown className="absolute left-5 top-5 size-6 text-amber-400/80" />}
          </div>

          <div className="relative flex flex-col items-center px-6 pb-6">
            <div className="-mt-14 mb-3 rounded-full bg-gradient-to-br from-indigo-500/40 to-violet-500/40 p-[3px] shadow-xl">
              <div className="relative rounded-full bg-surface p-1 dark:bg-ink">
                <Avatar user={me} size={96} />
                {!isDev && (
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={changing}
                    className="absolute bottom-1 left-1 rounded-full bg-surface p-2.5 text-slate-600 shadow-lg ring-1 ring-line transition hover:scale-105 hover:text-indigo-600 active:scale-95 dark:bg-ink dark:text-slate-300 dark:ring-white/10"
                    aria-label="تغییر عکس پروفایل"
                    title="تغییر عکس پروفایل"
                  >
                    <Camera className="size-4" />
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={changeAvatar} />
              </div>
            </div>

            <div className="text-xl font-black text-slate-800 dark:text-white">
              {me.firstName} {me.lastName}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              <Chip tone={isDev ? "amber" : "indigo"}>
                {isDev ? <Crown className="size-3" /> : <ShieldCheck className="size-3" />}
                {roleFa(me)}
              </Chip>
              {me.role === "student" && me.grade && <Chip tone="violet">کلاس {className(me.grade, me.section!)}</Chip>}
              {isStaff(me) && !isDev && <Chip tone="green">عضو کادر مدرسه</Chip>}
              {isDev && <Chip tone="slate">بالاترین سطح دسترسی</Chip>}
            </div>

            {/* آمار کوچک */}
            <div className="mt-6 grid w-full grid-cols-3 divide-x divide-x-reverse divide-line rounded-2xl bg-app/70 py-3 dark:divide-white/5 dark:bg-white/[0.03]">
              {stats.map((s, i) => (
                <MiniStat key={i} {...s} />
              ))}
            </div>
          </div>
        </div>

        {/* دسترسی سریع */}
        <div className="anim-fade-up mb-5 grid grid-cols-3 gap-2.5">
          <QuickAction icon={<MessagesSquare className="size-5" />} label="گفتگوها" onClick={() => onGo("chats")} />
          {canAdminPanel(me) ? (
            <QuickAction icon={<ShieldHalf className="size-5" />} label="پنل مدیریت" onClick={() => onGo("admin")} />
          ) : (
            <QuickAction icon={<CalendarCheck2 className="size-5" />} label="حضور و غیاب" onClick={() => onGo("attendance")} />
          )}
          <QuickAction icon={<ClipboardList className="size-5" />} label="آزمون‌ها" onClick={() => onGo("exams")} />
        </div>

        {/* تنظیمات ظاهری: با کلیک، کل بخش پوسته در یک صفحه‌ی تمام‌صفحه باز می‌شود */}
        <button
          type="button"
          onClick={() => setAppearanceOpen(true)}
          className="card anim-fade-up mb-5 flex w-full items-center gap-3 p-4 text-right transition hover:bg-surface-2 active:scale-[0.99]"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Palette className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-black text-slate-800 dark:text-slate-100">تنظیمات ظاهری</span>
            <span className="mt-0.5 block truncate text-[11.5px] font-semibold text-slate-400">{themeLabel}</span>
          </span>
          <ChevronLeft className="size-5 shrink-0 text-slate-400" />
        </button>
        <Modal open={appearanceOpen} onClose={() => setAppearanceOpen(false)} title="تنظیمات ظاهری" icon={<Palette className="size-4 text-accent" />} page>
          <AppearanceCard bare />
        </Modal>

        {/* اطلاعات حساب */}
        <div className="card anim-fade-up mb-5 p-5">
          <div className="mb-3.5 flex items-center justify-between gap-2">
            <div className="text-[13px] font-black text-slate-700 dark:text-slate-200">اطلاعات حساب کاربری</div>
            {!isDev && (
              <Btn kind="soft" className="!py-2 !text-[12px]" onClick={() => setEditOpen(true)}>
                <Pencil className="size-3.5" />
                ویرایش اطلاعات من
              </Btn>
            )}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <InfoRow
              icon={<Phone className="size-4" />}
              label="شماره تلفن"
              value={me.phone}
              ltr
              action={
                <button
                  onClick={copyPhone}
                  className="rounded-lg p-1.5 text-slate-300 transition hover:bg-surface hover:text-indigo-500 dark:hover:bg-white/10"
                  aria-label="کپی شماره"
                  title="کپی شماره"
                >
                  <Copy className="size-3.5" />
                </button>
              }
            />
            {me.password && (
              <div className="flex items-start gap-3 rounded-2xl bg-app px-4 py-5 transition hover:bg-surface-2/80 dark:bg-white/5 dark:hover:bg-white/[0.07]">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-indigo-500 shadow-sm ring-1 ring-line/60 dark:bg-white/10 dark:ring-white/10">
                  <KeyRound className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[10.5px] font-bold text-slate-400">رمز عبور من</div>
                  <div className="mt-1"><SecretReveal value={me.password} /></div>
                </div>
              </div>
            )}
            {me.role === "student" && (
              <>
                <InfoRow icon={<IdCard className="size-4" />} label="کد ملی" value={fa(me.nationalId ?? "")} ltr />
                <InfoRow icon={<Cake className="size-4" />} label="تاریخ تولد" value={me.birthDate ? fa(me.birthDate) : undefined} />
                <InfoRow icon={<UserRound className="size-4" />} label="نام پدر" value={me.fatherName} />
                <InfoRow icon={<MapPin className="size-4" />} label="آدرس منزل" value={me.address} />
              </>
            )}
            <InfoRow icon={<CalendarDays className="size-4" />} label="تاریخ عضویت" value={me.createdAt ? faDate(me.createdAt) : "—"} />
            <InfoRow icon={<CalendarDays className="size-4" />} label="آخرین ورود" value={me.lastLoginAt ? faDateTime(me.lastLoginAt) : "همین حالا"} />
          </div>
        </div>

        <div className="anim-fade-up rounded-2xl bg-surface-2 px-4 py-3.5 text-[12.5px] font-semibold leading-6 text-slate-500 dark:bg-white/5 dark:text-slate-400">
          <KeyRound className="ml-1 inline size-4 text-slate-400" />
          تغییر رمز عبور فقط توسط مدیر و معاونان آموزشی و پرورشی از «پنل مدیریت» انجام می‌شود.
        </div>

        <button
          onClick={onLogout}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 py-3.5 text-sm font-black text-rose-600 transition hover:bg-rose-100 active:scale-[0.99] dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
        >
          <LogOut className="size-5" />
          خروج از حساب کاربری
        </button>

        {/* مودال ویرایش اطلاعات */}
        {editOpen && !isDev && <EditProfileModal userId={me.id} onClose={() => setEditOpen(false)} />}
      </div>
    </div>
  );
}
