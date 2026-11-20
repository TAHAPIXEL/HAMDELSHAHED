"use client";

import { useMemo, useRef, useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserRoundPlus,
  MessagesSquare,
  Handshake,
  Database,
  Search,
  KeyRound,
  Trash2,
  Lock,
  Unlock,
  Megaphone,
  Download,
  Upload,
  FileJson,
  ShieldAlert,
  TriangleAlert,
  GraduationCap,
  School,
  ClipboardList,
  Camera,
  X,
  Crown,
  Check,
  Eye,
  CameraOff,
  CalendarCheck2,
  BookOpen,
  Lock as LockIcon,
  UserCheck2,
  UserX2,
  AlarmClock,
} from "lucide-react";
import {
  DB,
  SECTIONS,
  canAddStaff,
  canChangePasswords,
  canDeleteUsers,
  canViewAdminData,
  canViewSensitive,
  className,
  dateKeyFa,
  exportSelected,
  inspectBackup,
  importBackup,
  deleteAllMessages,
  backupCounts,
  canWipeData,
  canManage,
  canViewPasswords,
  canAddStudent,
  BACKUP_PARTS,
  ALL_BACKUP_KEYS,
  type BackupKey,
  fa,
  faDate,
  todayKey,
  todayJalali,
  jalaaliDaysOfMonth,
  JALALI_MONTHS,
  faDateTime,
  avatarDataUrl,
  isStaff,
  registerUser,
  roleFa,
  stats,
  uid,
  wipeAll,
  verifyWipePassword,
  GRADES,
  type AttStatus as _a,
  type Chat,
  type Grade,
  type StaffRole,
  type User,
} from "@/lib/model";
import { Avatar, Btn, Chip, Confirm, Empty, Field, Modal, PasswordInput, SecretReveal, Stat, inputCls, useDbTick, useToast } from "./ui";

type Tab = "dash" | "users" | "addstaff" | "addstudent" | "chats" | "content" | "attendance" | "perms" | "data";

export default function Admin({ user }: { user: User }) {
  useDbTick();
  const [tab, setTab] = useState<Tab>("dash");
  const isDev = user.role === "developer";

  const tabs: { v: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { v: "dash", label: "داشبورد", icon: <LayoutDashboard className="size-4.5" />, show: true },
    { v: "users", label: "کاربران", icon: <Users className="size-4.5" />, show: true },
    { v: "addstaff", label: "افزودن کادر", icon: <UserRoundPlus className="size-4.5" />, show: canAddStaff(user) },
    { v: "addstudent", label: "افزودن دانش‌آموز", icon: <GraduationCap className="size-4.5" />, show: canAddStudent(user) },
    { v: "chats", label: "گروه‌ها و کانال‌ها", icon: <MessagesSquare className="size-4.5" />, show: true },
    { v: "content", label: "آزمون‌ها، تکالیف و اطلاعیه‌ها", icon: <ClipboardList className="size-4.5" />, show: true },
    { v: "attendance", label: "گزارش حضور و غیاب", icon: <CalendarCheck2 className="size-4.5" />, show: true },
    { v: "perms", label: "مجوز چت دانش‌آموزی", icon: <Handshake className="size-4.5" />, show: true },
    { v: "data", label: "داده‌ها", icon: <Database className="size-4.5" />, show: canViewAdminData(user) },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        {!canManage(user) && (
          <div className="anim-fade-up mb-5 flex items-center gap-3 rounded-2xl bg-amber-50 px-5 py-4 text-amber-800">
            <Eye className="size-6 shrink-0 text-amber-500" />
            <div>
              <div className="text-sm font-black">حالت مشاهده</div>
              <div className="text-[11.5px] font-semibold text-amber-700/80">
                شما به اطلاعات دسترسی دارید، اما امکان تغییر در پنل مدیریت فقط برای مدیر و معاونان آموزشی و پرورشی فعال است.
              </div>
            </div>
          </div>
        )}
        {isDev && (
          <div className="anim-fade-up mb-5 flex items-center gap-3 rounded-2xl bg-gradient-to-l from-slate-800 to-slate-900 px-5 py-4 text-white dark:from-indigo-950 dark:to-slate-900">
            <Crown className="size-6 shrink-0 text-amber-400" />
            <div>
              <div className="text-sm font-black">ورود مدیر ارشد</div>
              <div className="text-[11.5px] font-semibold text-white/60">دسترسی شما بالاتر از همه است و کنترل کامل سامانه در اختیار شماست.</div>
            </div>
          </div>
        )}

        {/* تب‌ها */}
        <div className="mb-6 flex gap-1.5 overflow-x-auto rounded-2xl bg-slate-100 p-1.5 dark:bg-white/5">
          {tabs.filter((t) => t.show).map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[12.5px] font-bold transition ${
                tab === t.v ? "bg-white text-indigo-700 shadow-sm dark:bg-white/15 dark:text-indigo-200" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {tab === "dash" && <Dash />}
        {tab === "users" && <UsersTab actor={user} />}
        {tab === "addstaff" && canAddStaff(user) && <AddStaff />}
        {tab === "addstudent" && canAddStudent(user) && <AddStudent />}
        {tab === "chats" && <ChatsTab actor={user} />}
        {tab === "content" && <ContentTab actor={user} />}
        {tab === "attendance" && <AttendanceReportTab />}
        {tab === "perms" && <PermsTab actor={user} />}
        {tab === "data" && <DataTab actor={user} />}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// داشبورد
// ----------------------------------------------------------------------------

function Dash() {
  useDbTick();
  const s = stats();
  const recent = DB.users().slice(-6).reverse();
  return (
    <div className="space-y-6">
      <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="دانش‌آموزان" value={s.students} icon={<GraduationCap className="size-5.5" />} tone="bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300" />
        <Stat label="کادر مدرسه" value={s.staff} icon={<School className="size-5.5" />} tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" />
        <Stat label="حاضران امروز" value={s.presentToday} icon={<Users className="size-5.5" />} tone="bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300" />
        <Stat label="پیام‌ها" value={s.messages} icon={<MessagesSquare className="size-5.5" />} tone="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" />
        <Stat label="گروه‌ها" value={s.groups} icon={<Users className="size-5.5" />} tone="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300" />
        <Stat label="کانال‌ها" value={s.channels} icon={<Megaphone className="size-5.5" />} tone="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" />
        <Stat label="آزمون‌ها" value={s.exams} icon={<ClipboardList className="size-5.5" />} tone="bg-fuchsia-100 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-300" />
        <Stat label="اطلاعیه‌ها" value={s.notices} icon={<Megaphone className="size-5.5" />} tone="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" />
      </div>

      <div className="card p-5">
        <div className="mb-4 text-sm font-black text-slate-700 dark:text-slate-200">آخرین عضویت‌ها</div>
        {recent.length === 0 && <Empty icon={<Users className="size-7" />} title="هنوز کاربری ثبت‌نام نکرده" />}
        <div className="space-y-1">
          {recent.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <Avatar user={u} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold text-slate-700 dark:text-slate-200">{u.firstName} {u.lastName}</div>
                <div className="text-[11px] font-semibold text-slate-400">
                  {roleFa(u)}{u.grade ? ` • ${className(u.grade, u.section!)}` : ""} • {faDate(u.createdAt)}
                </div>
              </div>
              <Chip tone={u.role === "student" ? "indigo" : "violet"}>{roleFa(u)}</Chip>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// کاربران
// ----------------------------------------------------------------------------

function UsersTab({ actor }: { actor: User }) {
  useDbTick();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [roleF, setRoleF] = useState<"all" | "student" | "staff">("all");
  const [classF, setClassF] = useState<string>("all");
  const [pwdUser, setPwdUser] = useState<User | null>(null);
  const [delUser, setDelUser] = useState<User | null>(null);
  const [detail, setDetail] = useState<User | null>(null);

  const users = useMemo(() => {
    return DB.users()
      .filter((u) => {
        if (roleF === "student" && u.role !== "student") return false;
        if (roleF === "staff" && u.role === "student") return false;
        if (classF !== "all") {
          const [g, s] = classF.split("_");
          if (u.grade !== Number(g) || u.section !== s) return false;
        }
        return `${u.firstName} ${u.lastName} ${u.phone}`.includes(q.trim());
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [q, roleF, classF]);

  const remove = (u: User) => {
    DB.saveUsers(DB.users().filter((x) => x.id !== u.id));
    // پاک‌سازی عضویت‌ها
    DB.saveChats(DB.chats().map((c) => ({ ...c, memberIds: c.memberIds.filter((id) => id !== u.id) })));
    toast("success", "کاربر حذف شد");
  };

  return (
    <div className="space-y-4">
      <div className="card grid gap-3 p-4 sm:grid-cols-3">
        <div className="relative sm:col-span-1">
          <Search className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className={`${inputCls} pr-10`} placeholder="جست‌وجوی نام یا تلفن..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className={inputCls} value={roleF} onChange={(e) => setRoleF(e.target.value as never)}>
          <option value="all">همه نقش‌ها</option>
          <option value="student">دانش‌آموزان</option>
          <option value="staff">کادر مدرسه</option>
        </select>
        <select className={inputCls} value={classF} onChange={(e) => setClassF(e.target.value)}>
          <option value="all">همه کلاس‌ها</option>
          {GRADES.flatMap((g) =>
            SECTIONS[g].map((s) => (
              <option key={`${g}_${s}`} value={`${g}_${s}`}>{className(g, s)}</option>
            ))
          )}
        </select>
      </div>

      <div className="text-[12px] font-bold text-slate-400">{fa(users.length)} کاربر</div>

      {users.length === 0 && <Empty icon={<Users className="size-7" />} title="کاربری یافت نشد" />}

      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="card p-3.5">
            <button onClick={() => setDetail(u)} className="flex min-w-0 w-full items-center gap-3 text-right">
              <Avatar user={u} size={42} />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-black text-slate-800 dark:text-slate-100">{u.firstName} {u.lastName}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                  <span dir="ltr">{u.phone}</span>
                  <Chip tone={u.role === "student" ? "indigo" : "violet"}>{roleFa(u)}</Chip>
                  {u.grade && <Chip>{className(u.grade, u.section!)}</Chip>}
                </div>
              </div>
            </button>
            {/* اکشن‌ها — در گوشی به ردیف بعدی می‌روند و از صفحه بیرون نمی‌زنند */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {canViewPasswords(actor) && (
                <div className="flex min-w-0 max-w-full flex-1 items-center gap-1 rounded-xl bg-slate-50 px-3 py-2 text-[11.5px] dark:bg-white/5 sm:flex-none">
                  <span className="shrink-0 text-[10px] font-bold text-slate-400">رمز:</span>
                  <SecretReveal value={u.password} />
                </div>
              )}
              {canChangePasswords(actor) && (
                <button
                  onClick={() => setPwdUser(u)}
                  className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-[12px] font-black text-amber-700 transition hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-300"
                >
                  <KeyRound className="size-3.5" />
                  تغییر رمز
                </button>
              )}
              {canDeleteUsers(actor, u) && (
                <button
                  onClick={() => setDelUser(u)}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-black text-rose-600 transition hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  <Trash2 className="size-3.5" />
                  حذف
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {pwdUser && <PasswordModal user={pwdUser} onClose={() => setPwdUser(null)} />}
      {detail && <UserDetailModal user={detail} viewer={actor} onClose={() => setDetail(null)} />}
      <Confirm
        open={!!delUser}
        onClose={() => setDelUser(null)}
        onYes={() => delUser && remove(delUser)}
        title="حذف کاربر"
        desc={`«${delUser?.firstName} ${delUser?.lastName}» به‌طور کامل حذف می‌شود. پیام‌های او باقی می‌ماند.`}
        yesLabel="حذف کاربر"
      />
    </div>
  );
}

function PasswordModal({ user, onClose }: { user: User; onClose: () => void }) {
  const toast = useToast();
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const save = () => {
    if (!/^\d{4,}$/.test(p1)) return toast("error", "رمز فقط باید عدد و حداقل ۴ رقم باشد");
    if (p1 !== p2) return toast("error", "تکرار رمز مطابقت ندارد");
    const users = DB.users();
    const idx = users.findIndex((u) => u.id === user.id);
    users[idx] = { ...users[idx], password: p1 };
    DB.saveUsers(users);
    toast("success", `رمز «${user.firstName} ${user.lastName}» تغییر کرد`);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={`تغییر رمز ${user.firstName} ${user.lastName}`} icon={<KeyRound className="size-5 text-amber-500" />}>
      <div className="space-y-4">
        <Field label="رمز جدید (فقط عدد)" required>
          <PasswordInput value={p1} onChange={setP1} />
        </Field>
        <Field label="تکرار رمز جدید" required>
          <PasswordInput value={p2} onChange={setP2} onEnter={save} />
        </Field>
        <Btn className="w-full" onClick={save}>ثبت رمز جدید</Btn>
      </div>
    </Modal>
  );
}

// بیرون از کامپوننت تعریف می‌شود تا با هر به‌روزرسانی دوباره ساخته نشود (رفع چشمک‌زدن)
function DetailItem({ label, value, ltr }: { label: string; value?: string; ltr?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-white/5">
      <div className="text-[10.5px] font-bold text-slate-400">{label}</div>
      <div className={`user-text mt-0.5 text-[13px] font-black text-slate-700 dark:text-slate-200 ${ltr ? "text-left" : ""}`} dir={ltr ? "ltr" : undefined}>
        {value || "—"}
      </div>
    </div>
  );
}

function UserDetailModal({ user, viewer, onClose }: { user: User; viewer: User; onClose: () => void }) {
  const sensitive = canViewSensitive(viewer);
  return (
    <Modal open onClose={onClose} title="پرونده کاربر" icon={<Users className="size-5 text-indigo-500" />}>
      <div className="mb-4 flex items-center gap-3.5">
        <Avatar user={user} size={60} ring />
        <div>
          <div className="text-base font-black text-slate-800 dark:text-slate-100">{user.firstName} {user.lastName}</div>
          <div className="mt-1 flex gap-1.5">
            <Chip tone={user.role === "student" ? "indigo" : "violet"}>{roleFa(user)}</Chip>
            {user.grade && <Chip>{className(user.grade, user.section!)}</Chip>}
          </div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <DetailItem label="شماره تلفن" value={user.phone} ltr />
        {canViewPasswords(viewer) && (
          <div className="rounded-xl bg-slate-50 px-3.5 py-3">
            <div className="text-[10.5px] font-bold text-slate-400">رمز عبور</div>
            <div className="mt-1"><SecretReveal value={user.password} /></div>
          </div>
        )}
        {user.role === "student" && (
          <>
            {sensitive ? (
              <>
                <DetailItem label="کد ملی" value={fa(user.nationalId ?? "")} ltr />
                <DetailItem label="تاریخ تولد" value={user.birthDate ? fa(user.birthDate) : undefined} />
                <DetailItem label="نام پدر" value={user.fatherName} />
                <DetailItem label="آدرس منزل" value={user.address} />
              </>
            ) : (
              <>
                <DetailItem label="تاریخ تولد" value={user.birthDate ? fa(user.birthDate) : undefined} />
                <DetailItem label="نام پدر" value={user.fatherName} />
                <div className="rounded-xl bg-amber-50 px-3.5 py-3 text-[11.5px] font-bold leading-6 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300 sm:col-span-2">
                  کد ملی و آدرس منزل دانش‌آموزان برای نقش شما نمایش داده نمی‌شود.
                </div>
              </>
            )}
          </>
        )}
        <DetailItem label="تاریخ عضویت" value={faDateTime(user.createdAt)} />
        <DetailItem label="آخرین ورود" value={user.lastLoginAt ? faDateTime(user.lastLoginAt) : "—"} />
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// افزودن کادر مدرسه
// ----------------------------------------------------------------------------

function AddStaff() {
  const toast = useToast();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [pass, setPass] = useState("");
  const [role, setRole] = useState<StaffRole>("teacher");
  const [avatar, setAvatar] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    if (!firstName.trim() || !lastName.trim()) return toast("error", "نام و نام خانوادگی الزامی است");
    if (!/^09\d{9}$/.test(phone)) return toast("error", "شماره تلفن معتبر نیست");
    if (!/^\d{4,}$/.test(pass)) return toast("error", "رمز فقط عدد و حداقل ۴ رقم");
    const r = await registerUser({ role, firstName: firstName.trim(), lastName: lastName.trim(), phone, password: pass, avatar, staffRole: role });
    if (!r.ok) return toast("error", r.error!);
    toast("success", `${roleFa(r.user!)} با موفقیت اضافه شد`);
    setFirstName(""); setLastName(""); setPhone(""); setPass(""); setAvatar(undefined);
  };

  return (
    <div className="card mx-auto max-w-xl p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200">
        <UserRoundPlus className="size-5 text-indigo-500" />
        افزودن عضو جدید کادر مدرسه
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="نام" required><input className={inputCls} value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Field>
          <Field label="نام خانوادگی" required><input className={inputCls} value={lastName} onChange={(e) => setLastName(e.target.value)} /></Field>
        </div>
        <Field label="سمت" required hint="از هر سمت می‌توان به تعداد نامحدود عضو اضافه کرد">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(
              [
                { v: "teacher", l: "دبیر" },
                { v: "principal", l: "مدیر" },
                { v: "edu_deputy", l: "معاون آموزشی" },
                { v: "cultural_deputy", l: "معاون پرورشی" },
                { v: "tech_deputy", l: "معاون فناوری" },
                { v: "counselor", l: "مشاور" },
              ] as { v: StaffRole; l: string }[]
            ).map((o) => (
              <button
                key={o.v}
                onClick={() => setRole(o.v)}
                className={`rounded-xl border px-2 py-2.5 text-[12px] font-black transition ${
                  role === o.v ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-400/50 dark:bg-indigo-500/10 dark:text-indigo-300" : "border-slate-200 text-slate-500 dark:border-white/10"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="شماره تلفن" required>
            <input dir="ltr" inputMode="numeric" maxLength={11} className={`${inputCls} text-left`} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))} />
          </Field>
          <Field label="رمز عبور (فقط عدد)" required>
            <PasswordInput value={pass} onChange={setPass} />
          </Field>
        </div>
        <Field label="عکس پروفایل (اختیاری)">
          <div className="flex items-center gap-3">
            <Avatar user={{ id: phone || "x", firstName: firstName || "؟", lastName: "", avatar }} size={46} />
            <button onClick={() => fileRef.current?.click()} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-3 py-3 text-[12.5px] font-bold text-slate-500 transition hover:border-indigo-300 dark:border-white/10">
              <Camera className="size-4" />
              {avatar ? "تغییر عکس" : "انتخاب عکس"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                try {
                  setAvatar(await avatarDataUrl(f));
                } catch (err) {
                  toast("error", (err as Error).message || "بارگذاری تصویر ممکن نشد");
                }
              }
              e.target.value = "";
            }} />
          </div>
        </Field>
        <Btn className="w-full" onClick={submit}>افزودن به کادر مدرسه</Btn>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// مدیریت گروه‌ها و کانال‌ها
// ----------------------------------------------------------------------------

function ChatsTab({ actor }: { actor: User }) {
  useDbTick();
  const manage = canManage(actor);
  const toast = useToast();
  const [del, setDel] = useState<Chat | null>(null);
  const chats = DB.chats().filter((c) => c.type !== "direct").sort((a, b) => b.createdAt - a.createdAt);

  const toggleLock = (c: Chat) => {
    const all = DB.chats();
    const idx = all.findIndex((x) => x.id === c.id);
    all[idx] = { ...all[idx], locked: !all[idx].locked };
    DB.saveChats(all);
    toast("success", all[idx].locked ? "ارسال پیام فقط برای کادر شد" : "محدودیت برداشته شد");
  };

  const remove = (c: Chat) => {
    DB.saveChats(DB.chats().filter((x) => x.id !== c.id));
    DB.saveMessages(DB.messages().filter((m) => m.chatId !== c.id));
    toast("success", "حذف شد");
  };

  return (
    <div className="space-y-2">
      {chats.length === 0 && <Empty icon={<MessagesSquare className="size-7" />} title="گروهی نیست" />}
      {chats.map((c) => (
        <div key={c.id} className="card flex flex-wrap items-center gap-3 p-3.5">
          <div className={`flex size-10 shrink-0 items-center justify-center rounded-2xl text-white ${c.type === "channel" ? "bg-gradient-to-br from-amber-500 to-orange-500" : "bg-gradient-to-br from-indigo-500 to-violet-500"}`}>
            {c.type === "channel" ? <Megaphone className="size-4.5" /> : <Users className="size-4.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 truncate text-[13.5px] font-black text-slate-800 dark:text-slate-100">
              {c.title}
              {c.locked && c.type === "group" && <Lock className="size-3.5 text-amber-500" />}
            </div>
            <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
              {c.type === "channel" ? "کانال" : "گروه"} • {fa(c.memberIds.length)} عضو
            </div>
          </div>
          {c.type === "group" && manage && (
            <button
              onClick={() => toggleLock(c)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-black transition ${c.locked ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300"}`}
            >
              {c.locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
              {c.locked ? "رفع محدودیت" : "فقط کادر"}
            </button>
          )}
          {manage && (
            <button onClick={() => setDel(c)} className="flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-black text-rose-600 transition hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300">
              <Trash2 className="size-3.5" />
              حذف
            </button>
          )}
        </div>
      ))}
      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onYes={() => del && remove(del)}
        title="حذف گروه / کانال"
        desc={`«${del?.title}» و همه پیام‌هایش حذف می‌شود.`}
        yesLabel="حذف"
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// مدیریت محتوا: آزمون‌ها، تکالیف و اطلاعیه‌ها
// ----------------------------------------------------------------------------

type ContentKind = "exams" | "homework" | "notices";

function ContentTab({ actor }: { actor: User }) {
  useDbTick();
  const manage = canManage(actor);
  const toast = useToast();
  const [kind, setKind] = useState<ContentKind>("exams");
  const [delId, setDelId] = useState<{ kind: ContentKind; id: string; title: string } | null>(null);

  const exams = DB.exams().sort((a, b) => b.createdAt - a.createdAt);
  const homeworks = DB.homeworks().sort((a, b) => b.createdAt - a.createdAt);
  const notices = DB.notices().sort((a, b) => b.createdAt - a.createdAt);

  const authorName = (id: string) => {
    const u = DB.users().find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : "مدیریت مدرسه";
  };

  const doDelete = () => {
    if (!delId) return;
    if (delId.kind === "exams") {
      DB.saveExams(DB.exams().filter((x) => x.id !== delId.id));
      DB.saveSubs(DB.subs().filter((s) => s.examId !== delId.id));
    } else if (delId.kind === "homework") {
      DB.saveHomeworks(DB.homeworks().filter((x) => x.id !== delId.id));
      DB.saveHwsubs(DB.hwsubs().filter((s) => s.homeworkId !== delId.id));
    } else {
      DB.saveNotices(DB.notices().filter((x) => x.id !== delId.id));
    }
    toast("success", "حذف شد");
  };

  const setExamStatus = (id: string, status: "draft" | "published" | "closed") => {
    DB.saveExams(DB.exams().map((e) => (e.id === id ? { ...e, status } : e)));
    toast("success", status === "published" ? "آزمون منتشر شد" : status === "closed" ? "آزمون بسته شد" : "به پیش‌نویس بازگشت");
  };

  const toggleHw = (id: string) => {
    const list = DB.homeworks();
    const idx = list.findIndex((h) => h.id === id);
    list[idx] = { ...list[idx], closed: !list[idx].closed };
    DB.saveHomeworks(list);
    toast("success", list[idx].closed ? "تکلیف بسته شد" : "تکلیف باز شد");
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1.5 dark:bg-white/5">
        {(
          [
            { v: "exams", l: "آزمون‌ها", i: <ClipboardList className="size-4" />, n: exams.length },
            { v: "homework", l: "تکالیف", i: <BookOpen className="size-4" />, n: homeworks.length },
            { v: "notices", l: "اطلاعیه‌ها", i: <Megaphone className="size-4" />, n: notices.length },
          ] as const
        ).map((t) => (
          <button
            key={t.v}
            onClick={() => setKind(t.v)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12.5px] font-bold transition ${
              kind === t.v ? "bg-white text-indigo-700 shadow-sm dark:bg-white/15 dark:text-indigo-200" : "text-slate-500"
            }`}
          >
            {t.i}
            {t.l}
            <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">{fa(t.n)}</span>
          </button>
        ))}
      </div>

      {kind === "exams" && (
        <div className="space-y-2">
          {exams.length === 0 && <Empty icon={<ClipboardList className="size-7" />} title="آزمونی ثبت نشده" />}
          {exams.map((e) => (
            <div key={e.id} className="card flex flex-wrap items-center gap-3 p-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white">
                <ClipboardList className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-black text-slate-800 dark:text-slate-100">{e.title}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                  {className(e.grade, e.section)} • {fa(e.questions.length)} سؤال • طراح: {authorName(e.createdBy)} • {fa(DB.subs().filter((s) => s.examId === e.id).length)} پاسخ
                </div>
              </div>
              {e.status === "published" ? <Chip tone="green">فعال</Chip> : e.status === "draft" ? <Chip tone="amber">پیش‌نویس</Chip> : <Chip>بسته</Chip>}
              {manage && (e.status !== "published" ? (
                <Btn kind="ghost" className="!py-2 !text-[12px]" onClick={() => setExamStatus(e.id, "published")}>انتشار</Btn>
              ) : (
                <Btn kind="ghost" className="!py-2 !text-[12px]" onClick={() => setExamStatus(e.id, "closed")}>
                  <LockIcon className="size-3.5" />
                  بستن
                </Btn>
              ))}
              {manage && (
                <Btn kind="danger" className="!px-3 !py-2" onClick={() => setDelId({ kind: "exams", id: e.id, title: e.title })}>
                  <Trash2 className="size-3.5" />
                </Btn>
              )}
            </div>
          ))}
        </div>
      )}

      {kind === "homework" && (
        <div className="space-y-2">
          {homeworks.length === 0 && <Empty icon={<BookOpen className="size-7" />} title="تکلیفی ثبت نشده" />}
          {homeworks.map((h) => (
            <div key={h.id} className="card flex flex-wrap items-center gap-3 p-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white">
                <BookOpen className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-black text-slate-800 dark:text-slate-100">{h.title}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                  {className(h.grade, h.section)}
                  {h.due ? ` • موعد: ${fa(h.due)}` : ""} • {authorName(h.createdBy)} • {fa(DB.hwsubs().filter((s) => s.homeworkId === h.id).length)} تحویل
                </div>
              </div>
              {h.closed ? <Chip>بسته</Chip> : <Chip tone="green">باز</Chip>}
              {manage && (
                <Btn kind="ghost" className="!py-2 !text-[12px]" onClick={() => toggleHw(h.id)}>
                  {h.closed ? "باز کردن" : "بستن"}
                </Btn>
              )}
              {manage && (
                <Btn kind="danger" className="!px-3 !py-2" onClick={() => setDelId({ kind: "homework", id: h.id, title: h.title })}>
                  <Trash2 className="size-3.5" />
                </Btn>
              )}
            </div>
          ))}
        </div>
      )}

      {kind === "notices" && (
        <div className="space-y-2">
          {notices.length === 0 && <Empty icon={<Megaphone className="size-7" />} title="اطلاعیه‌ای ثبت نشده" />}
          {notices.map((n) => (
            <div key={n.id} className="card flex flex-wrap items-center gap-3 p-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 text-white">
                <Megaphone className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-black text-slate-800 dark:text-slate-100">{n.title}</div>
                <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                  {authorName(n.createdBy)} • {faDate(n.createdAt)} •{" "}
                  {n.audience === "all" ? "همه" : n.audience === "students" ? "دانش‌آموزان" : "کادر"}
                </div>
              </div>
              {manage && (
                <Btn kind="danger" className="!px-3 !py-2" onClick={() => setDelId({ kind: "notices", id: n.id, title: n.title })}>
                  <Trash2 className="size-3.5" />
                </Btn>
              )}
            </div>
          ))}
        </div>
      )}

      <Confirm
        open={!!delId}
        onClose={() => setDelId(null)}
        onYes={doDelete}
        title="حذف"
        desc={`«${delId?.title}» و همه داده‌های مرتبط با آن حذف می‌شود.`}
        yesLabel="حذف"
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// گزارش حضور و غیاب همه کلاس‌ها
// ----------------------------------------------------------------------------

function AttendanceReportTab() {
  useDbTick();
  const all = DB.attendance();
  const students = DB.users().filter((u) => u.role === "student");
  const today = todayKey();

  const rows = GRADES.flatMap((g) =>
    SECTIONS[g].map((s) => {
      const ids = new Set(students.filter((u) => u.grade === g && u.section === s).map((u) => u.id));
      const todays = all.filter((r) => r.date === today && ids.has(r.studentId));
      return {
        key: `${g}-${s}`,
        label: className(g, s),
        total: ids.size,
        present: todays.filter((r) => r.status === "present").length,
        absent: todays.filter((r) => r.status === "absent").length,
        excused: todays.filter((r) => r.status === "excused").length,
      };
    })
  );

  const totals = rows.reduce(
    (a, r) => ({ total: a.total + r.total, present: a.present + r.present, absent: a.absent + r.absent, excused: a.excused + r.excused }),
    { total: 0, present: 0, absent: 0, excused: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="text-[12px] font-bold text-slate-400">وضعیت امروز — {dateKeyFa(today)}</div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="کل دانش‌آموزان" value={totals.total} icon={<Users className="size-5.5" />} tone="bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300" />
        <Stat label="حاضر امروز" value={totals.present} icon={<UserCheck2 className="size-5.5" />} tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" />
        <Stat label="غایب امروز" value={totals.absent} icon={<UserX2 className="size-5.5" />} tone="bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" />
        <Stat label="موجه امروز" value={totals.excused} icon={<AlarmClock className="size-5.5" />} tone="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" />
      </div>

      <div className="card overflow-hidden p-0">
        <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-black text-slate-700 dark:border-white/5 dark:text-slate-200">
          تفکیک کلاس‌ها
        </div>
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {rows.map((r) => {
            const pct = r.total > 0 ? Math.round((r.present / r.total) * 100) : 0;
            return (
              <div key={r.key} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-24 text-[13px] font-black text-slate-700 dark:text-slate-200">{r.label}</div>
                <div className="relative h-2 min-w-32 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                  <div className="absolute inset-y-0 right-0 rounded-full bg-gradient-to-l from-emerald-500 to-teal-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone="green">حاضر {fa(r.present)}</Chip>
                  <Chip tone="red">غایب {fa(r.absent)}</Chip>
                  <Chip tone="amber">موجه {fa(r.excused)}</Chip>
                  <Chip>کل {fa(r.total)}</Chip>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// مجوز چت دانش‌آموز با دانش‌آموز
// ----------------------------------------------------------------------------

// کامپوننت بیرونی — ثابت می‌ماند و چشمک نمی‌زند
function PermPicker({
  value,
  onChange,
  label,
  students,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  students: User[];
}) {
  return (
    <div>
      <div className="mb-2 text-[12px] font-bold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-2xl border border-slate-200 p-2 dark:border-white/10">
        {students.map((s) => (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 transition ${value === s.id ? "bg-indigo-50 ring-1 ring-indigo-300 dark:bg-indigo-500/10" : "hover:bg-slate-50 dark:hover:bg-white/5"}`}
          >
            <Avatar user={s} size={30} />
            <span className="truncate text-[12.5px] font-bold text-slate-700 dark:text-slate-200">{s.firstName} {s.lastName}</span>
            <span className="mr-auto text-[10px] font-semibold text-slate-400">{s.grade ? className(s.grade, s.section!) : ""}</span>
          </button>
        ))}
        {students.length === 0 && <div className="py-6 text-center text-[12px] font-semibold text-slate-400">دانش‌آموزی نیست</div>}
      </div>
    </div>
  );
}

function PermsTab({ actor }: { actor: User }) {
  useDbTick();
  const manage = canManage(actor);
  const toast = useToast();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [q, setQ] = useState("");
  const students = DB.users().filter((u) => u.role === "student").filter((u) => `${u.firstName} ${u.lastName}`.includes(q.trim()));
  const perms = DB.perms();
  const name = (id: string) => {
    const u = DB.users().find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : "—";
  };

  const grant = () => {
    if (!a || !b) return toast("error", "هر دو دانش‌آموز را انتخاب کنید");
    if (a === b) return toast("error", "دو دانش‌آموز متفاوت انتخاب کنید");
    if (perms.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a)))
      return toast("error", "این مجوز قبلاً داده شده است");
    const list = DB.perms();
    list.push({ id: uid("p"), a, b, grantedBy: actor.id, createdAt: Date.now() });
    DB.savePerms(list);
    toast("success", "مجوز چت شخصی داده شد — حالا هر دو می‌توانند گفتگو را شروع کنند");
    setA(""); setB("");
  };

  const revoke = (id: string) => {
    DB.savePerms(DB.perms().filter((p) => p.id !== id));
    toast("success", "مجوز لغو شد");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="card p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200">
          <Handshake className="size-5 text-indigo-500" />
          صدور مجوز گفتگوی شخصی بین دو دانش‌آموز
        </div>
        <div className="relative mb-3">
          <Search className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <input className={`${inputCls} pr-10 !py-2 !text-[12.5px]`} placeholder="جست‌وجوی دانش‌آموز..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <PermPicker label="دانش‌آموز اول" value={a} onChange={setA} students={students} />
          <PermPicker label="دانش‌آموز دوم" value={b} onChange={setB} students={students} />
        </div>
        <Btn className="mt-4 w-full" disabled={!manage} onClick={grant}>صدور مجوز چت</Btn>
      </div>
      <div className="card p-5">
        <div className="mb-3 text-sm font-black text-slate-700 dark:text-slate-200">مجوزهای فعال — {fa(perms.length)}</div>
        {perms.length === 0 && <Empty icon={<Handshake className="size-7" />} title="مجوزی نیست" desc="با صدور مجوز، یک چت شخصی بین دو دانش‌آموز ساخته می‌شود" />}
        <div className="space-y-2">
          {perms.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-[12.5px] font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
              <span className="truncate">{name(p.a)}</span>
              <Handshake className="size-4 shrink-0 text-indigo-400" />
              <span className="truncate">{name(p.b)}</span>
              {manage && (
                <button onClick={() => revoke(p.id)} className="mr-auto rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500" aria-label="لغو مجوز">
                  <X className="size-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// داده‌ها: پشتیبان‌گیری انتخابی، بازیابی انتخابی و عملیات خطرناک
// ----------------------------------------------------------------------------

function PartSelector({
  selected,
  onToggle,
  onAll,
  counts,
  tone = "indigo",
}: {
  selected: Set<BackupKey>;
  onToggle: (k: BackupKey) => void;
  onAll: (all: boolean) => void;
  counts: Partial<Record<BackupKey, number>>;
  tone?: "indigo" | "emerald";
}) {
  const parts = BACKUP_PARTS.filter((p) => counts[p.key] !== undefined);
  const allOn = parts.length > 0 && parts.every((p) => selected.has(p.key));
  const activeCls =
    tone === "emerald"
      ? "border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-500/15 dark:border-emerald-400/50 dark:bg-emerald-500/10"
      : "border-indigo-400 bg-indigo-50/70 ring-2 ring-indigo-500/15 dark:border-indigo-400/50 dark:bg-indigo-500/10";
  const boxCls = tone === "emerald" ? "border-emerald-500 bg-emerald-500" : "border-indigo-500 bg-indigo-500";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-black text-slate-400">بخش‌های انتخاب‌شده: {fa(selected.size)}</span>
        <Btn kind="soft" className="!py-1.5 !text-[11.5px]" onClick={() => onAll(!allOn)}>
          {allOn ? "لغو انتخاب همه" : "انتخاب همه"}
        </Btn>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {parts.map((p) => {
          const on = selected.has(p.key);
          const n = counts[p.key] ?? 0;
          return (
            <button
              key={p.key}
              onClick={() => onToggle(p.key)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-right transition ${
                on ? activeCls : "border-slate-200 hover:border-slate-300 dark:border-white/10"
              }`}
            >
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-md border-2 transition ${on ? `${boxCls} text-white` : "border-slate-300 dark:border-white/20"}`}>
                {on && <Check className="size-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-black text-slate-700 dark:text-slate-200">{p.label}</span>
                <span className="block truncate text-[10.5px] text-slate-400">{p.hint}</span>
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500 dark:bg-white/10 dark:text-slate-300">
                {fa(n)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DataTab({ actor }: { actor: User }) {
  useDbTick();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const allowed = canWipeData(actor);

  const counts = backupCounts();
  const [expSel, setExpSel] = useState<Set<BackupKey>>(new Set(ALL_BACKUP_KEYS));

  // بازیابی
  const [pending, setPending] = useState<{ name: string; json: string; counts: Partial<Record<BackupKey, number>> } | null>(null);
  const [impSel, setImpSel] = useState<Set<BackupKey>>(new Set());
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [busy, setBusy] = useState(false);

  // پاک کردن پیام‌ها
  const [purgeOpen, setPurgeOpen] = useState(false);
  const [purgePhrase, setPurgePhrase] = useState("");
  const [purgeErr, setPurgeErr] = useState("");

  // بازنشانی کامل
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeStep, setWipeStep] = useState(1);
  const [wipePass, setWipePass] = useState("");
  const [wipePhrase, setWipePhrase] = useState("");
  const [wipeErr, setWipeErr] = useState("");
  const [checking, setChecking] = useState(false);

  const toggle = (set: Set<BackupKey>, apply: (s: Set<BackupKey>) => void) => (k: BackupKey) => {
    const n = new Set(set);
    if (n.has(k)) n.delete(k);
    else n.add(k);
    apply(n);
  };

  const download = () => {
    if (expSel.size === 0) return toast("error", "حداقل یک بخش را برای پشتیبان‌گیری انتخاب کنید");
    const keys = ALL_BACKUP_KEYS.filter((k) => expSel.has(k));
    const blob = new Blob([exportSelected(keys)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const aEl = document.createElement("a");
    aEl.href = url;
    aEl.download = `hamdel-backup-${new Date().toISOString().slice(0, 10)}.json`;
    aEl.click();
    URL.revokeObjectURL(url);
    toast("success", `فایل پشتیبان با ${fa(keys.length)} بخش دانلود شد`);
  };

  const pickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const json = await f.text();
    const r = inspectBackup(json);
    if (!r.ok || !r.counts) {
      toast("error", r.error ?? "فایل معتبر نیست");
      return;
    }
    setPending({ name: f.name, json, counts: r.counts });
    setImpSel(new Set(Object.keys(r.counts) as BackupKey[]));
    setMode("merge");
  };

  const doImport = () => {
    if (!pending) return;
    if (impSel.size === 0) return toast("error", "حداقل یک بخش را برای وارد کردن انتخاب کنید");
    setBusy(true);
    setTimeout(() => {
      const keys = ALL_BACKUP_KEYS.filter((k) => impSel.has(k));
      const r = importBackup(pending.json, mode, keys);
      setBusy(false);
      if (!r.ok) return toast("error", r.error ?? "وارد کردن ناموفق بود");
      const total = Object.values(r.added ?? {}).reduce((a, b) => a + b, 0);
      toast(
        "success",
        mode === "replace"
          ? `${fa(keys.length)} بخش با محتوای فایل جایگزین شد`
          : `${fa(total)} رکورد جدید اضافه شد${r.skipped ? ` و ${fa(r.skipped)} مورد تکراری رد شد` : ""}`
      );
      setPending(null);
    }, 420);
  };

  const resetPurge = () => { setPurgeOpen(false); setPurgePhrase(""); setPurgeErr(""); };
  const doPurge = () => {
    if (purgePhrase.trim() !== "حذف پیام ها") {
      setPurgeErr("عبارت تأیید را دقیقاً «حذف پیام ها» بنویسید");
      return;
    }
    const n = deleteAllMessages();
    toast("success", `${fa(n)} پیام (متن، تصویر و نظرسنجی) حذف شد`);
    resetPurge();
  };

  const resetWipe = () => { setWipeOpen(false); setWipeStep(1); setWipePass(""); setWipePhrase(""); setWipeErr(""); };
  const wipeNext = async () => {
    if (wipeStep === 1) {
      setChecking(true);
      const ok = await verifyWipePassword(wipePass);
      setChecking(false);
      if (!ok) return setWipeErr("رمز پاک‌سازی نادرست است");
      setWipeErr("");
      setWipeStep(2);
      return;
    }
    if (wipePhrase.trim() !== "پاک کن") return setWipeErr("عبارت تأیید را دقیقاً «پاک کن» بنویسید");
    const r = await wipeAll(wipePass);
    if (!r.ok) return setWipeErr(r.error ?? "پاک‌سازی ناموفق بود");
    toast("success", "همه داده‌های سامانه پاک شد");
    resetWipe();
    window.location.reload();
  };

  return (
    <div className="space-y-4">
      {/* پشتیبان‌گیری انتخابی */}
      <div className="card p-5">
        <div className="mb-1 flex items-center gap-2.5">
          <Download className="size-6 text-indigo-500" />
          <div className="text-sm font-black text-slate-800 dark:text-slate-100">پشتیبان‌گیری از داده‌ها</div>
        </div>
        <p className="mb-4 text-[12.5px] font-semibold leading-6 text-slate-400">
          انتخاب کنید از چه بخش‌هایی پشتیبان گرفته شود؛ خروجی یک فایل JSON است.
        </p>
        <PartSelector
          selected={expSel}
          counts={counts}
          onToggle={toggle(expSel, setExpSel)}
          onAll={(all) => setExpSel(all ? new Set(ALL_BACKUP_KEYS) : new Set())}
        />
        <Btn className="mt-4" onClick={download}>
          <Download className="size-4" />
          دانلود فایل پشتیبان ({fa(expSel.size)} بخش)
        </Btn>
      </div>

      {/* بازیابی */}
      <div className="card p-5">
        <div className="mb-1 flex items-center gap-2.5">
          <Upload className="size-6 text-emerald-500" />
          <div className="text-sm font-black text-slate-800 dark:text-slate-100">وارد کردن فایل پشتیبان</div>
        </div>
        <p className="mb-4 text-[12.5px] font-semibold leading-6 text-slate-400">
          فایل پشتیبان را انتخاب کنید؛ سپس مشخص می‌کنید کدام بخش‌ها وارد شوند.
        </p>
        <Btn kind="soft" onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" />
          انتخاب فایل پشتیبان
        </Btn>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={pickFile} />
      </div>

      {/* عملیات خطرناک */}
      <div className="card border-rose-200 p-5 dark:border-rose-500/20">
        <div className="mb-4 flex items-center gap-2.5">
          <ShieldAlert className="size-6 text-rose-500" />
          <div className="text-sm font-black text-slate-800 dark:text-slate-100">عملیات خطرناک</div>
        </div>
        {!allowed && (
          <div className="mb-3 rounded-xl bg-slate-50 px-4 py-3 text-[12px] font-bold text-slate-500 dark:bg-white/5">
            این بخش فقط برای مدیر و معاون آموزشی فعال است.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <MessagesSquare className="mb-2 size-6 text-amber-500" />
            <div className="text-[13px] font-black text-slate-800 dark:text-slate-100">پاک کردن کل پیام‌ها</div>
            <p className="mb-3 mt-1 text-[11.5px] font-semibold leading-6 text-slate-400">
              همه متن‌ها، تصاویر و نظرسنجی‌های همه گفتگوها حذف می‌شود. گروه‌ها، کاربران و بقیه اطلاعات باقی می‌مانند.
            </p>
            <Btn kind="danger" disabled={!allowed} onClick={() => setPurgeOpen(true)}>
              <Trash2 className="size-4" />
              پاک کردن پیام‌ها ({fa(counts.messages)})
            </Btn>
          </div>
          <div className="rounded-2xl border border-rose-200 p-4 dark:border-rose-500/20">
            <TriangleAlert className="mb-2 size-6 text-rose-500" />
            <div className="text-[13px] font-black text-slate-800 dark:text-slate-100">بازنشانی کامل سامانه</div>
            <p className="mb-3 mt-1 text-[11.5px] font-semibold leading-6 text-slate-400">
              همه داده‌ها برای همیشه پاک می‌شود. نیازمند رمز پاک‌سازی و تأیید دو مرحله‌ای است.
            </p>
            <Btn kind="danger" disabled={!allowed} onClick={() => setWipeOpen(true)}>
              <ShieldAlert className="size-4" />
              شروع فرایند پاک‌سازی
            </Btn>
          </div>
        </div>
      </div>

      {/* مودال بازیابی */}
      <Modal open={!!pending} onClose={() => setPending(null)} title="بازیابی از فایل پشتیبان" wide icon={<Upload className="size-5 text-emerald-500" />}>
        {pending && (
          <div className="space-y-4">
            <div className="flex items-center gap-2.5 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-white/5">
              <FileJson className="size-5 shrink-0 text-emerald-500" />
              <span className="truncate text-[12.5px] font-black text-slate-700 dark:text-slate-200" dir="ltr">{pending.name}</span>
            </div>

            <PartSelector
              tone="emerald"
              selected={impSel}
              counts={pending.counts}
              onToggle={toggle(impSel, setImpSel)}
              onAll={(all) => setImpSel(all ? new Set(Object.keys(pending.counts) as BackupKey[]) : new Set())}
            />

            <div>
              <div className="mb-2 text-[12px] font-black text-slate-400">نحوه وارد کردن</div>
              <div className="space-y-2">
                <button
                  onClick={() => setMode("merge")}
                  className={`w-full rounded-2xl border px-4 py-3 text-right transition ${
                    mode === "merge"
                      ? "border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-500/15 dark:border-emerald-400/50 dark:bg-emerald-500/10"
                      : "border-slate-200 hover:border-slate-300 dark:border-white/10"
                  }`}
                >
                  <div className="text-[13px] font-black text-slate-700 dark:text-slate-200">افزودن به داده‌های فعلی (پیشنهادی)</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">فقط رکوردهای جدید اضافه می‌شود؛ موارد تکراری رد می‌شوند.</div>
                </button>
                <button
                  onClick={() => setMode("replace")}
                  className={`w-full rounded-2xl border px-4 py-3 text-right transition ${
                    mode === "replace"
                      ? "border-amber-400 bg-amber-50/70 ring-2 ring-amber-500/15 dark:border-amber-400/50 dark:bg-amber-500/10"
                      : "border-slate-200 hover:border-slate-300 dark:border-white/10"
                  }`}
                >
                  <div className="text-[13px] font-black text-slate-700 dark:text-slate-200">جایگزینی داده‌های فعلی</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">فقط بخش‌های انتخاب‌شده با محتوای فایل جایگزین می‌شوند.</div>
                </button>
              </div>
            </div>

            {mode === "replace" && (
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[12px] font-bold leading-6 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                توجه: داده‌های فعلی بخش‌های انتخاب‌شده از بین می‌رود. پیشنهاد می‌شود ابتدا پشتیبان جدید بگیرید.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Btn kind="ghost" onClick={() => setPending(null)}>انصراف</Btn>
              <Btn onClick={doImport} loading={busy}>
                <Upload className="size-4" />
                وارد کردن ({fa(impSel.size)} بخش)
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* مودال پاک کردن پیام‌ها */}
      <Modal open={purgeOpen} onClose={resetPurge} title="پاک کردن کل پیام‌ها" icon={<Trash2 className="size-5 text-rose-500" />}>
        <div className="space-y-4">
          <div className="rounded-2xl bg-rose-50 px-4 py-3.5 text-[12.5px] font-bold leading-7 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            {fa(counts.messages)} پیام شامل همه متن‌ها، تصاویر و نظرسنجی‌ها برای همیشه حذف می‌شود.
            گروه‌ها، کانال‌ها، کاربران، آزمون‌ها و تکالیف دست‌نخورده باقی می‌مانند.
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-[12px] font-semibold leading-6 text-slate-500 dark:bg-white/5 dark:text-slate-400">
            پیشنهاد: پیش از ادامه، از بخش «پیام‌ها» یک فایل پشتیبان بگیرید.
          </div>
          <Field label="برای تأیید، عبارت «حذف پیام ها» را بنویسید" required error={purgeErr}>
            <input
              className={inputCls}
              value={purgePhrase}
              onChange={(e) => { setPurgePhrase(e.target.value); setPurgeErr(""); }}
              onKeyDown={(e) => e.key === "Enter" && doPurge()}
              placeholder="حذف پیام ها"
              autoFocus
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn kind="ghost" onClick={resetPurge}>انصراف</Btn>
            <Btn kind="danger" onClick={doPurge}>حذف همه پیام‌ها</Btn>
          </div>
        </div>
      </Modal>

      {/* مودال بازنشانی دو مرحله‌ای */}
      <Modal open={wipeOpen} onClose={resetWipe} title="بازنشانی کامل سامانه" icon={<ShieldAlert className="size-5 text-rose-500" />}>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {[1, 2].map((s) => (
              <div key={s} className="flex flex-1 items-center gap-2">
                <span className={`flex size-7 items-center justify-center rounded-full text-[11px] font-black transition ${wipeStep >= s ? "bg-rose-500 text-white" : "bg-slate-200 text-slate-500 dark:bg-white/10"}`}>
                  {fa(s)}
                </span>
                <span className={`h-1 flex-1 rounded-full transition ${wipeStep > s ? "bg-rose-500" : "bg-slate-200 dark:bg-white/10"}`} />
              </div>
            ))}
          </div>

          {wipeStep === 1 ? (
            <>
              <div className="rounded-2xl bg-rose-50 px-4 py-3.5 text-[12.5px] font-bold leading-7 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                مرحله ۱ از ۲ — برای ادامه، رمز پاک‌سازی سامانه را وارد کنید. این عملیات غیرقابل بازگشت است.
              </div>
              <Field label="رمز پاک‌سازی" required error={wipeErr}>
                <PasswordInput
                  value={wipePass}
                  onChange={(v) => { setWipePass(v); setWipeErr(""); }}
                  onEnter={() => void wipeNext()}
                  tracking
                  autoFocus
                />
              </Field>
            </>
          ) : (
            <>
              <div className="rounded-2xl bg-rose-50 px-4 py-3.5 text-[12.5px] font-bold leading-7 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                مرحله ۲ از ۲ — تأیید نهایی. تمام کاربران، گفتگوها، پیام‌ها، آزمون‌ها، تکالیف، حضور و غیاب و اطلاعیه‌ها
                برای همیشه حذف می‌شود.
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-[12px] font-semibold leading-6 text-slate-500 dark:bg-white/5 dark:text-slate-400">
                پیشنهاد: پیش از ادامه، یک فایل پشتیبان کامل دانلود کنید.
              </div>
              <Field label="برای تأیید، عبارت «پاک کن» را بنویسید" required error={wipeErr}>
                <input
                  className={inputCls}
                  value={wipePhrase}
                  onChange={(e) => { setWipePhrase(e.target.value); setWipeErr(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") void wipeNext(); }}
                  placeholder="پاک کن"
                  autoFocus
                />
              </Field>
            </>
          )}

          <div className="flex justify-end gap-2">
            <Btn kind="ghost" onClick={resetWipe}>انصراف</Btn>
            {wipeStep === 2 && <Btn kind="ghost" onClick={() => { setWipeStep(1); setWipeErr(""); }}>بازگشت</Btn>}
            <Btn kind="danger" loading={checking} onClick={() => void wipeNext()}>
              {wipeStep === 1 ? "تأیید رمز و ادامه" : "پاک‌سازی نهایی"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ----------------------------------------------------------------------------
// افزودن دانش‌آموز توسط کادر مدرسه
// ----------------------------------------------------------------------------

function AddStudent() {
  const toast = useToast();
  const tj = todayJalali();
  const [f, setF] = useState({ firstName: "", lastName: "", fatherName: "", nationalId: "", address: "", phone: "", pass: "" });
  const [grade, setGrade] = useState<Grade>(7);
  const [section, setSection] = useState("1");
  const [bY, setBY] = useState(1390);
  const [bM, setBM] = useState(1);
  const [bD, setBD] = useState(1);
  const [avatar, setAvatar] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));
  const setNum = (k: keyof typeof f, max?: number) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value.replace(/[^\d]/g, "").slice(0, max) }));

  const submit = async () => {
    if (!f.firstName.trim() || !f.lastName.trim()) return toast("error", "نام و نام خانوادگی الزامی است");
    if (!f.fatherName.trim()) return toast("error", "نام پدر الزامی است");
    if (!/^\d{10}$/.test(f.nationalId)) return toast("error", "کد ملی باید ۱۰ رقم باشد");
    if (!/^09\d{9}$/.test(f.phone)) return toast("error", "شماره تلفن معتبر نیست");
    if (!/^\d{4,}$/.test(f.pass)) return toast("error", "رمز فقط عدد و حداقل ۴ رقم");
    if (!f.address.trim()) return toast("error", "آدرس منزل الزامی است");
    const r = await registerUser({
      role: "student",
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      fatherName: f.fatherName.trim(),
      nationalId: f.nationalId,
      address: f.address.trim(),
      birthDate: `${bY}/${bM}/${bD}`,
      phone: f.phone,
      password: f.pass,
      grade,
      section,
      avatar,
    });
    if (!r.ok) return toast("error", r.error!);
    toast("success", `دانش‌آموز «${r.user!.firstName} ${r.user!.lastName}» به کلاس ${className(grade, section)} اضافه شد`);
    setF({ firstName: "", lastName: "", fatherName: "", nationalId: "", address: "", phone: "", pass: "" });
    setAvatar(undefined);
  };

  return (
    <div className="card mx-auto max-w-xl p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-700 dark:text-slate-200">
        <GraduationCap className="size-5 text-indigo-500" />
        افزودن دانش‌آموز جدید
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="نام" required><input className={inputCls} value={f.firstName} onChange={set("firstName")} /></Field>
          <Field label="نام خانوادگی" required><input className={inputCls} value={f.lastName} onChange={set("lastName")} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="نام پدر" required><input className={inputCls} value={f.fatherName} onChange={set("fatherName")} /></Field>
          <Field label="کد ملی" required>
            <input dir="ltr" inputMode="numeric" className={`${inputCls} text-left`} value={f.nationalId} onChange={setNum("nationalId", 10)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="پایه" required>
            <select className={inputCls} value={grade} onChange={(e) => { setGrade(Number(e.target.value) as Grade); setSection("1"); }}>
              {GRADES.map((g) => (<option key={g} value={g}>پایه {className(g, "1").split(" ")[0]}</option>))}
            </select>
          </Field>
          <Field label="شعبه" required>
            <select className={inputCls} value={section} onChange={(e) => setSection(e.target.value)}>
              {SECTIONS[grade].map((s) => (<option key={s} value={s}>شعبه {s}</option>))}
            </select>
          </Field>
        </div>
        <Field label="تاریخ تولد (شمسی)" required>
          <div className="grid grid-cols-3 gap-2">
            <select className={inputCls} value={bD} onChange={(e) => setBD(Number(e.target.value))}>
              {Array.from({ length: jalaaliDaysOfMonth(bY, bM) }, (_, i) => i + 1).map((d) => (<option key={d} value={d}>{fa(d)}</option>))}
            </select>
            <select className={inputCls} value={bM} onChange={(e) => { const m = Number(e.target.value); setBM(m); setBD((d) => Math.min(d, jalaaliDaysOfMonth(bY, m))); }}>
              {JALALI_MONTHS.map((m, i) => (<option key={m} value={i + 1}>{m}</option>))}
            </select>
            <select className={inputCls} value={bY} onChange={(e) => { const y = Number(e.target.value); setBY(y); setBD((d) => Math.min(d, jalaaliDaysOfMonth(y, bM))); }}>
              {Array.from({ length: 27 }, (_, i) => tj.jy - 5 - i).map((y) => (<option key={y} value={y}>{fa(y)}</option>))}
            </select>
          </div>
        </Field>
        <Field label="آدرس منزل" required>
          <textarea rows={2} className={`${inputCls} resize-none`} value={f.address} onChange={set("address")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="شماره تلفن" required>
            <input dir="ltr" inputMode="numeric" className={`${inputCls} text-left`} value={f.phone} onChange={setNum("phone", 11)} placeholder="09xxxxxxxxx" />
          </Field>
          <Field label="رمز عبور (فقط عدد)" required>
            <PasswordInput value={f.pass} onChange={(v) => setF((s2) => ({ ...s2, pass: v }))} />
          </Field>
        </div>
        <Field label="عکس پروفایل (اختیاری)">
          <div className="flex items-center gap-3">
            <Avatar user={{ id: f.phone || "x", firstName: f.firstName || "؟", lastName: "", avatar }} size={46} />
            <button onClick={() => fileRef.current?.click()} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-3 py-3 text-[12.5px] font-bold text-slate-500 transition hover:border-indigo-300 dark:border-white/10">
              <Camera className="size-4" />
              {avatar ? "تغییر عکس" : "انتخاب عکس"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                try {
                  setAvatar(await avatarDataUrl(file));
                } catch (err) {
                  toast("error", (err as Error).message || "بارگذاری تصویر ممکن نشد");
                }
              }
              e.target.value = "";
            }} />
          </div>
        </Field>
        <Btn className="w-full" onClick={submit}>افزودن دانش‌آموز</Btn>
      </div>
    </div>
  );
}
