// ============================================================================
//  «همدل» — سامانه گفتگو و کلاس مدرسه
//  لایه‌ی داده: کش همگام با سرور (PostgreSQL) — ورود و ثبت‌نام روی سرور انجام می‌شود
// ============================================================================

import {
  api,
  cacheUpsert,
  clearLocal,
  getCollection,
  getSession,
  hydrate,
  setCollection,
  setSession as storeSetSession,
  type ApiErrorLike,
} from "./store";
import type { CollectionKey } from "./collections";
import type { ThemeSettings } from "./theme";

export type Grade = 7 | 8 | 9;
export const GRADES: Grade[] = [7, 8, 9];
export const SECTIONS: Record<Grade, string[]> = {
  7: ["1", "2", "3", "4"],
  8: ["1", "2", "3", "4"],
  9: ["1", "2"],
};

// کدهای محرمانه فقط روی سرور و به‌صورت هش نگهداری می‌شوند (src/lib/secrets.ts).

// در هر مدرسه می‌تواند به تعداد نامحدود از هر سمت وجود داشته باشد
export type StaffRole =
  | "teacher"
  | "edu_deputy"
  | "cultural_deputy"
  | "tech_deputy"
  | "counselor"
  | "principal";
export type Role = "student" | StaffRole | "developer";

export interface User {
  id: string;
  role: Role;
  firstName: string;
  lastName: string;
  fatherName?: string;
  nationalId?: string;
  address?: string;
  birthDate?: string; // تاریخ تولد شمسی مثل 1387/5/12
  phone: string;
  password: string;
  grade?: Grade;
  section?: string;
  staffRole?: StaffRole;
  avatar?: string; // dataURL فشرده
  theme?: ThemeSettings; // پوسته‌ی شخصی (ذخیره در پایگاه‌داده)
  createdAt: number;
  lastLoginAt?: number;
}

export type ChatType = "group" | "channel" | "direct";

// اختیارات قابل‌تعیین برای مدیران گروه/کانال
export interface ChatAdminPerms {
  post?: boolean; // ارسال پیام در کانال
  members?: boolean; // افزودن و حذف اعضا
  pin?: boolean; // سنجاق کردن پیام خود
  lock?: boolean; // قفل/باز کردن گروه
  remove?: boolean; // حذف کامل گفتگو
}

export const ALL_CHAT_PERMS: { key: keyof ChatAdminPerms; label: string; hint: string }[] = [
  { key: "post", label: "ارسال پیام در کانال", hint: "اجازه نوشتن پیام در کانال" },
  { key: "members", label: "مدیریت اعضا", hint: "افزودن و حذف اعضای گفتگو" },
  { key: "pin", label: "سنجاق پیام", hint: "سنجاق کردن پیام خودش بالای گفتگو" },
  { key: "lock", label: "قفل گروه", hint: "محدود کردن ارسال پیام به کادر" },
  { key: "remove", label: "حذف گفتگو", hint: "حذف کامل این گروه یا کانال" },
];

export const FULL_CHAT_PERMS: ChatAdminPerms = {
  post: true,
  members: true,
  pin: true,
  lock: true,
  remove: false,
};

export interface Chat {
  id: string;
  type: ChatType;
  title: string;
  description?: string;
  memberIds: string[];
  locked?: boolean; // فقط برای گروه‌ها — محدودیت پیام به کادر
  createdBy: string;
  ownerId?: string; // مالک (سازنده) گروه/کانال
  admins?: string[]; // مدیران تعیین‌شده توسط مالک — فقط از کادر مدرسه
  adminPerms?: Record<string, ChatAdminPerms>; // اختیارات هر مدیر
  createdAt: number;
  directKey?: string; // برای چت شخصی
  lastActivity: number;
  pinnedId?: string; // پیام سنجاق‌شده
  grade?: Grade; // سازگاری با داده‌های قدیمی
  section?: string;
}

export interface Poll {
  question: string;
  options: string[];
  votes: Record<string, number>; // userId -> optionIndex
}

/** فایل پیوست‌شده‌ی پیام: ویس یا سند؛ url فقط به فضای ذخیره‌ی همین سامانه اشاره می‌کند */
export interface ChatMedia {
  kind: "voice" | "file";
  url: string;
  name: string;
  mime: string;
  size: number;
  duration?: number; // ms
  wave?: number[]; // ۴۸ مقدار بین ۰ تا ۱ برای نمایش شکل موج
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  image?: string; // dataURL
  media?: ChatMedia;
  poll?: Poll; // نظرسنجی
  createdAt: number;
  editedAt?: number;
  deleted?: boolean;
}

export type QuestionType = "mcq" | "tf" | "blank" | "short" | "descriptive";

export interface Question {
  id: string;
  type: QuestionType;
  text: string;
  score: number;
  options?: string[]; // برای تستی
}

export type ExamStatus = "draft" | "published" | "closed";

export interface Exam {
  id: string;
  title: string;
  description?: string;
  grade: Grade;
  section: string;
  durationMin: number;
  questions: Question[];
  status: ExamStatus;
  createdBy: string;
  createdAt: number;
}

export interface Submission {
  id: string;
  examId: string;
  studentId: string;
  answers: Record<string, string>;
  startedAt: number;
  submittedAt?: number;
  grades?: Record<string, number>;
  feedback?: string;
  total?: number;
  graded?: boolean;
}

export type AttStatus = "present" | "absent" | "excused";
export interface AttendanceRec {
  id: string; // `${date}:${studentId}`
  date: string; // YYYY-MM-DD
  studentId: string;
  status: AttStatus;
  note?: string;
  auto?: boolean;
  loginAt?: number;
  updatedBy?: string;
  updatedAt?: number;
}

// ----------------------------------------------------------------------------
// تکالیف و تمرین‌ها
// ----------------------------------------------------------------------------

export interface Homework {
  id: string;
  title: string;
  description?: string;
  grade: Grade;
  section: string;
  due?: string; // تاریخ شمسی مثل 1404/8/15
  createdBy: string;
  createdAt: number;
  closed?: boolean;
}

export type HwStatus = "submitted" | "approved" | "returned";
export interface HwSub {
  id: string;
  homeworkId: string;
  studentId: string;
  text: string;
  images?: string[]; // تصاویر پیوست‌شده (dataURL)
  submittedAt: number;
  status: HwStatus;
  note?: string; // یادداشت دبیر
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  image?: string;
  audience: "all" | "students" | "staff";
  createdBy: string;
  createdAt: number;
}

export interface ChatPerm {
  id: string;
  a: string;
  b: string;
  grantedBy: string;
  createdAt: number;
}

// ----------------------------------------------------------------------------
// ابزارهای پایه
// ----------------------------------------------------------------------------

export const uid = (p = "id") =>
  `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;

export const isBrowser = () => typeof window !== "undefined";

// ----------------------------------------------------------------------------
// تبدیل تاریخ شمسی ↔ میلادی (الگوریتم استاندارد جلالی)
// ----------------------------------------------------------------------------

export const JALALI_MONTHS = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];

const J_BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
// تقسیم صحیح با برش به سمت صفر — دقیقاً مثل مرجع jalaali (برای اعداد منفی مهم است)
const divn = (a: number, b: number) => ~~(a / b);

function jalCal(jy: number) {
  const bl = J_BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = J_BREAKS[0];
  let jm = 0, jump = 0;
  for (let i = 1; i < bl; i++) {
    jm = J_BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += divn(jump, 33) * 8 + divn(jump % 33, 4);
    jp = jm;
  }
  let n = jy - jp;
  leapJ += divn(n, 33) * 8 + divn((n % 33) + 3, 4);
  if (jump % 33 === 4 && jump - n === 4) leapJ += 1;
  const leapG = divn(gy, 4) - divn((divn(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + divn(jump + 4, 33) * 33;
  let leap = (((n + 1) % 33) - 1) % 4;
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}
function g2d(gy: number, gm: number, gd: number) {
  let d =
    divn((gy + divn(gm - 8, 6) + 100100) * 1461, 4) +
    divn(153 * ((gm + 9) % 12) + 2, 5) +
    gd - 34840408;
  d = d - divn(divn(gy + 100100 + divn(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j += divn(divn(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = divn(j % 1461, 4) * 5 + 308;
  const gd = divn(i % 153, 5) + 1;
  const gm = (divn(i, 153) % 12) + 1;
  const gy = divn(j, 1461) - 100100 + divn(8 - gm, 6);
  return { gy, gm, gd };
}
export function j2g(jy: number, jm: number, jd: number) {
  const r = jalCal(jy);
  return d2g(g2d(r.gy, 3, r.march) + (jm - 1) * 31 - divn(jm, 7) * (jm - 7) + jd - 1);
}
export function g2j(gy: number, gm: number, gd: number) {
  const d = g2d(gy, gm, gd);
  const g = d2g(d);
  let jy = g.gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(r.gy, 3, r.march);
  let k = d - jdn1f;
  let jm: number, jd: number;
  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + divn(k, 31);
      jd = (k % 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + divn(k, 30);
  jd = (k % 30) + 1;
  return { jy, jm, jd };
}
export function todayJalali() {
  const n = new Date();
  return g2j(n.getFullYear(), n.getMonth() + 1, n.getDate());
}
export function jalaaliDaysOfMonth(jy: number, jm: number) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return jalCal(jy).leap === 0 ? 30 : 29; // در jalCal مقدار ۰ یعنی سال کبیسه
}
// ساخت کلید میلادی استاندارد YYYY-MM-DD از تاریخ شمسی
export function jalaliToDateKey(jy: number, jm: number, jd: number) {
  const g = j2g(jy, jm, jd);
  return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
}
export function dateKeyToJalali(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return g2j(y, m, d);
}

export const DB = {
  users: () => getCollection<User[]>("users"),
  saveUsers: (v: User[]) => setCollection("users", v),
  chats: () => getCollection<Chat[]>("chats"),
  saveChats: (v: Chat[]) => setCollection("chats", v),
  messages: () => getCollection<Message[]>("messages"),
  saveMessages: (v: Message[]) => setCollection("messages", v),
  exams: () => getCollection<Exam[]>("exams"),
  saveExams: (v: Exam[]) => setCollection("exams", v),
  subs: () => getCollection<Submission[]>("subs"),
  saveSubs: (v: Submission[]) => setCollection("subs", v),
  attendance: () => getCollection<AttendanceRec[]>("attendance"),
  saveAttendance: (v: AttendanceRec[]) => setCollection("attendance", v),
  notices: () => getCollection<Notice[]>("notices"),
  saveNotices: (v: Notice[]) => setCollection("notices", v),
  noticeReads: () => getCollection<Record<string, number>>("noticeReads"),
  saveNoticeReads: (v: Record<string, number>) => setCollection("noticeReads", v),
  perms: () => getCollection<ChatPerm[]>("perms"),
  savePerms: (v: ChatPerm[]) => setCollection("perms", v),
  seen: () => getCollection<Record<string, number>>("seen"), // chatSeen: `${userId}:${chatId}` -> ts
  saveSeen: (v: Record<string, number>) => setCollection("seen", v),
  homeworks: () => getCollection<Homework[]>("homeworks"),
  saveHomeworks: (v: Homework[]) => setCollection("homeworks", v),
  hwsubs: () => getCollection<HwSub[]>("hwsubs"),
  saveHwsubs: (v: HwSub[]) => setCollection("hwsubs", v),
};

// ----------------------------------------------------------------------------
// سِشن
// ----------------------------------------------------------------------------

export const DEV_USER: User = {
  id: "dev-root",
  role: "developer",
  firstName: "مدیر",
  lastName: "ارشد",
  phone: "",
  password: "",
  createdAt: 0,
};

export function currentUser(): User | null {
  const s = getSession();
  if (!s) return null;
  if (s.dev) return DEV_USER;
  return DB.users().find((u) => u.id === s.userId) ?? null;
}

export function logout() {
  storeSetSession(null);
  clearLocal();
}

/** ثبت‌نام روی سرور؛ برای کادر، کد ثبت‌نام کادر لازم است مگر اینکه مدیر وارد شده باشد. */
export async function registerUser(
  data: Omit<User, "id" | "createdAt" | "password"> & { password: string; staffKey?: string },
): Promise<{ ok: boolean; error?: string; user?: User; field?: "staffKey" | "phone" }> {
  const { staffKey, ...user } = data;
  try {
    const res = await api<{ user: User }>("/api/auth/register", { body: { user, staffKey } });
    cacheUpsert("users", res.user);
    return { ok: true, user: res.user };
  } catch (err) {
    const e = err as ApiErrorLike;
    const field = e.message.includes("کد ثبت‌نام") ? "staffKey" : e.message.includes("شماره تلفن") ? "phone" : undefined;
    return { ok: false, error: e.message, field };
  }
}

/** ورود: تأیید رمز روی سرور، سپس دریافت داده‌های قابل‌مشاهده */
export async function login(
  phone: string,
  password: string,
): Promise<{ ok: boolean; error?: string; dev?: boolean; user?: User }> {
  let res: { token: string; dev: boolean; user: User | null };
  try {
    res = await api("/api/auth/login", { body: { phone, password }, auth: false });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  storeSetSession({ token: res.token, dev: res.dev, userId: res.user?.id });
  await hydrate();
  if (res.dev) return { ok: true, dev: true, user: DEV_USER };
  const user = DB.users().find((u) => u.id === res.user?.id) ?? (res.user as User);
  if (user.role === "student") recordLoginAttendance(user.id);
  return { ok: true, user };
}

/** برای بازیابی پس از بارگذاری صفحه */
export async function restoreSession(): Promise<boolean> {
  if (!getSession()) return false;
  await hydrate();
  return true;
}

// ----------------------------------------------------------------------------
// مهاجرت داده‌ها
// ----------------------------------------------------------------------------

export function ensureSeed() {
  // طبق قانون جدید، هیچ گروه یا کانال از پیش ساخته‌شده‌ای وجود ندارد.
  // گروه‌های خودکار کلاسِ نسخه‌های قبلی (در صورت وجود) پاک می‌شوند.
  const chats = DB.chats();
  const legacy = chats.filter((c) => (c.type as string) === "class_group");
  if (legacy.length) {
    const ids = new Set(legacy.map((c) => c.id));
    DB.saveChats(chats.filter((c) => !ids.has(c.id)));
    DB.saveMessages(DB.messages().filter((m) => !ids.has(m.chatId)));
  }
}

// ----------------------------------------------------------------------------
// برچسب‌ها و قالب‌بندی فارسی
// ----------------------------------------------------------------------------

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
export const fa = (v: string | number) =>
  String(v).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);

export const gradeFa: Record<number, string> = { 7: "هفتم", 8: "هشتم", 9: "نهم" };
export const className = (g: Grade | number, s: string) => `${gradeFa[g]} ${fa(s)}`;

export const roleFa = (u: User | null | undefined): string => {
  if (!u) return "";
  switch (u.role) {
    case "student":
      return "دانش‌آموز";
    case "teacher":
      return "دبیر";
    case "edu_deputy":
      return "معاون آموزشی";
    case "cultural_deputy":
      return "معاون پرورشی";
    case "tech_deputy":
      return "معاون فناوری";
    case "counselor":
      return "مشاور";
    case "principal":
      return "مدیر";
    case "developer":
      return "مدیر ارشد";
  }
};

export const qTypeFa: Record<QuestionType, string> = {
  mcq: "تستی (چهارگزینه‌ای)",
  tf: "صحیح / غلط",
  blank: "جای خالی",
  short: "پاسخ کوتاه",
  descriptive: "تشریحی",
};

export const attFa: Record<AttStatus, string> = {
  present: "حاضر",
  absent: "غایب",
  excused: "موجه",
};

export function faDateTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString("fa-IR");
  }
}
export function faTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(ts));
  } catch {
    return "";
  }
}
/** ساعت کامل با ثانیه، مثل ۱۴:۰۵:۲۰ (برای پیام‌های گفتگو) */
export function faClock(ts: number): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(ts));
  } catch {
    return "";
  }
}
export function faDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "full" }).format(new Date(ts));
  } catch {
    return "";
  }
}
export function faDateShort(ts: number): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { month: "long", day: "numeric" }).format(new Date(ts));
  } catch {
    return "";
  }
}
export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const dateKeyFa = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return faDate(new Date(y, m - 1, d).getTime());
};

// ----------------------------------------------------------------------------
// سطح دسترسی
// ----------------------------------------------------------------------------

export const isStaff = (u: User | null) => !!u && u.role !== "student";
// همه اعضای کادر مدرسه پنل مدیریت دارند (برخی فقط در حالت مشاهده)
export const canAdminPanel = isStaff;

/**
 * مدیریت کامل سامانه — مدیر، معاون آموزشی و معاون پرورشی
 * فقط این‌ها می‌توانند در پنل مدیریت چیزی را تغییر دهند.
 */
export const canManage = (u: User | null) =>
  !!u &&
  (u.role === "developer" ||
    u.role === "principal" ||
    u.role === "edu_deputy" ||
    u.role === "cultural_deputy");

/** دبیران و مدیران — طراحی آزمون و تعیین تکلیف برای همه کلاس‌ها */
export const canTeach = (u: User | null) => canManage(u) || u?.role === "teacher";

export const isHighTrust = canManage;
export const canChangePasswords = canManage;
export const canViewAdminData = canManage;
export const canWipeData = canManage;
export const canAddStaff = canManage;
export const canAddStudent = canManage;

/**
 * مشاهده اطلاعات حساس دانش‌آموزان (کد ملی، آدرس و رمز عبور)
 * برای معاون فناوری و مشاور مخفی می‌ماند.
 */
export const canViewSensitive = (u: User | null) =>
  !!u &&
  (u.role === "developer" ||
    u.role === "principal" ||
    u.role === "edu_deputy" ||
    u.role === "cultural_deputy" ||
    u.role === "teacher");

/** هرکس اطلاعات حساس را می‌بیند، رمز عبور را هم می‌بیند */
export const canViewPasswords = canViewSensitive;

export const canDeleteUsers = (actor: User | null, target: User) =>
  canManage(actor) && target.role !== "developer";

// ----------------------------------------------------------------------------
// چت
// ----------------------------------------------------------------------------

export function userChats(u: User): Chat[] {
  const chats = DB.chats();
  if (isStaff(u)) {
    return chats
      .filter((c) => c.type !== "direct" || c.memberIds.includes(u.id))
      .sort((a, b) => b.lastActivity - a.lastActivity);
  }
  return chats
    .filter((c) => c.memberIds.includes(u.id))
    .sort((a, b) => b.lastActivity - a.lastActivity);
}

// مالک گروه/کانال (همان سازنده)
export const chatOwnerId = (c: Chat) => c.ownerId ?? c.createdBy;

// مدیران گروه/کانال: مالک + کادری که مالک تعیین کرده
export const isChatOwner = (c: Chat, u: User) => chatOwnerId(c) === u.id || u.role === "developer";
export function isChatAdmin(c: Chat, u: User): boolean {
  return isChatOwner(c, u) || (c.admins ?? []).includes(u.id);
}

/** بررسی یک اختیار مشخص برای مدیر گروه/کانال */
export function hasChatPerm(c: Chat, u: User, perm: keyof ChatAdminPerms): boolean {
  if (isChatOwner(c, u)) return true; // مالک همه اختیارات را دارد
  if (!(c.admins ?? []).includes(u.id)) return false;
  return !!c.adminPerms?.[u.id]?.[perm];
}

export function canPostInChat(c: Chat, u: User): boolean {
  if (c.type === "channel") return hasChatPerm(c, u, "post"); // در کانال فقط مالک و مدیرانِ دارای اجازه
  if (c.locked) return isStaff(u); // قفل گروه: فقط کادر پیام می‌دهند
  return true;
}

export function directBetween(aId: string, bId: string): Chat | undefined {
  const key = [aId, bId].sort().join("|");
  return DB.chats().find((c) => c.type === "direct" && c.directKey === key);
}

export function openDirect(a: User, b: User): Chat {
  const existing = directBetween(a.id, b.id);
  if (existing) return existing;
  const chats = DB.chats();
  const chat: Chat = {
    id: uid("dm"),
    type: "direct",
    title: "",
    memberIds: [a.id, b.id],
    createdBy: a.id,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    directKey: [a.id, b.id].sort().join("|"),
  };
  chats.push(chat);
  DB.saveChats(chats);
  return chat;
}

// آیا دانش‌آموز اجازه چت شخصی با کاربر دیگر را دارد؟
export function canDm(me: User, other: User): boolean {
  if (me.role === "developer") return true;
  if (me.role === "student") {
    if (other.role !== "student") return true; // دانش‌آموز → کادر
    return DB.perms().some(
      (p) => (p.a === me.id && p.b === other.id) || (p.a === other.id && p.b === me.id)
    );
  }
  return true; // کادر → همه
}

export function chatTitle(c: Chat, me: User): string {
  if (c.type === "direct") {
    const otherId = c.memberIds.find((id) => id !== me.id);
    const other = DB.users().find((u) => u.id === otherId);
    return other ? `${other.firstName} ${other.lastName}` : "گفتگو";
  }
  return c.title;
}
export function chatAvatarUser(c: Chat, me: User): User | undefined {
  if (c.type !== "direct") return undefined;
  const otherId = c.memberIds.find((id) => id !== me.id);
  return DB.users().find((u) => u.id === otherId);
}

export function sendMessage(chatId: string, sender: User, text: string, image?: string, media?: ChatMedia) {
  const messages = DB.messages();
  messages.push({
    id: uid("m"),
    chatId,
    senderId: sender.id,
    text: text.trim(),
    image,
    media,
    createdAt: Date.now(),
  });
  DB.saveMessages(messages);
  const chats = DB.chats();
  const idx = chats.findIndex((c) => c.id === chatId);
  if (idx >= 0) {
    chats[idx] = { ...chats[idx], lastActivity: Date.now() };
    DB.saveChats(chats);
  }
}

export function chatMessages(chatId: string): Message[] {
  return DB.messages()
    .filter((m) => m.chatId === chatId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

// ارسال نظرسنجی
export function sendPoll(chatId: string, sender: User, question: string, options: string[]) {
  const messages = DB.messages();
  messages.push({
    id: uid("m"),
    chatId,
    senderId: sender.id,
    text: "",
    poll: { question: question.trim(), options: options.map((o) => o.trim()), votes: {} },
    createdAt: Date.now(),
  });
  DB.saveMessages(messages);
  const chats = DB.chats();
  const idx = chats.findIndex((c) => c.id === chatId);
  if (idx >= 0) {
    chats[idx] = { ...chats[idx], lastActivity: Date.now() };
    DB.saveChats(chats);
  }
}

// رأی دادن یا لغو رأی در نظرسنجی
export function togglePollVote(messageId: string, optionIdx: number, userId: string) {
  const messages = DB.messages();
  const idx = messages.findIndex((m) => m.id === messageId);
  const m = messages[idx];
  if (!m?.poll) return;
  const votes = { ...m.poll.votes };
  if (votes[userId] === optionIdx) delete votes[userId]; // لغو رأی
  else votes[userId] = optionIdx;
  messages[idx] = { ...m, poll: { ...m.poll, votes } };
  DB.saveMessages(messages);
}

// سنجاق / برداشتن سنجاق پیام
export function togglePin(chatId: string, messageId: string | null) {
  const chats = DB.chats();
  const idx = chats.findIndex((c) => c.id === chatId);
  if (idx >= 0) {
    chats[idx] = { ...chats[idx], pinnedId: messageId ?? undefined };
    DB.saveChats(chats);
  }
}

export function markSeen(userId: string, chatId: string, lastActivity?: number) {
  const seen = DB.seen();
  const key = `${userId}:${chatId}`;
  // فقط درصورت نیاز بنویس تا حلقه به‌روزرسانی ایجاد نشود
  if (lastActivity !== undefined && (seen[key] ?? 0) >= lastActivity) return;
  seen[key] = Date.now();
  DB.saveSeen(seen);
}

export function unreadCount(userId: string, chat: Chat): number {
  const seen = DB.seen()[`${userId}:${chat.id}`] ?? 0;
  return DB.messages().filter((m) => m.chatId === chat.id && m.createdAt > seen && m.senderId !== userId).length;
}

// ----------------------------------------------------------------------------
// حضور و غیاب
// ----------------------------------------------------------------------------

export function recordLoginAttendance(studentId: string) {
  const date = todayKey();
  const id = `${date}:${studentId}`;
  const all = DB.attendance();
  const existing = all.find((r) => r.id === id);
  if (existing) return;
  all.push({ id, date, studentId, status: "present", auto: true, loginAt: Date.now() });
  DB.saveAttendance(all);
}

export function setAttendance(studentId: string, date: string, status: AttStatus, by: string, note?: string) {
  const all = DB.attendance();
  const id = `${date}:${studentId}`;
  const idx = all.findIndex((r) => r.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], status, note: note ?? all[idx].note, auto: false, updatedBy: by, updatedAt: Date.now() };
  } else {
    all.push({ id, date, studentId, status, note, auto: false, updatedBy: by, updatedAt: Date.now() });
  }
  DB.saveAttendance(all);
}

// ----------------------------------------------------------------------------
// اطلاعیه‌ها
// ----------------------------------------------------------------------------

export function visibleNotices(u: User): Notice[] {
  return DB.notices()
    .filter((n) => {
      if (n.audience === "all") return true;
      if (n.audience === "students") return u.role === "student";
      return isStaff(u);
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function unreadNotices(u: User): number {
  const reads = DB.noticeReads();
  return visibleNotices(u).filter((n) => {
    const r = reads[readNoticeKey(u.id, n.id)];
    return !r || r < n.createdAt;
  }).length;
}

export function readNoticeKey(userId: string, noticeId: string) {
  return `${userId}:${noticeId}`;
}

/** ثبت زمان خواندن یک اطلاعیه توسط کاربر */
export function recordNoticeRead(userId: string, noticeId: string) {
  const reads = DB.noticeReads();
  reads[readNoticeKey(userId, noticeId)] = Date.now();
  DB.saveNoticeReads(reads);
}

// ----------------------------------------------------------------------------
// فشرده‌سازی تصویر به dataURL (برای حافظه محلی)
// ----------------------------------------------------------------------------

function compressToDataURL(file: File, max: number, quality: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("پردازش تصویر ممکن نشد"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("این فایل تصویر معتبر نیست"));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error("خواندن فایل از دستگاه ممکن نشد؛ فایل را دوباره انتخاب کنید"));
    reader.readAsDataURL(file);
  });
}

/**
 * عکس پروفایل: کوچک (۱۲۸ پیکسل، JPEG) و به‌صورت داده‌ی درون‌خطی.
 * همین روش برای تصاویر پیام‌ها هم به‌درستی برای همه نمایش داده می‌شود؛ آدرس فضای ابری لازم نیست.
 */
export async function avatarDataUrl(file: File): Promise<string> {
  const dataUrl = await compressToDataURL(file, 128, 0.8);
  if (dataUrl.length > 40_000) throw new Error("تصویر پس از فشرده‌سازی هنوز بزرگ است؛ تصویر دیگری انتخاب کنید");
  return dataUrl;
}

/**
 * فشرده‌سازی تصویر در مرورگر و ذخیره در فضای ابری (Supabase Storage).
 * خروجی آدرس عمومی تصویر است که در رکوردها ذخیره می‌شود.
 */
export async function uploadImage(
  file: File,
  max = 720,
  quality = 0.72,
  purpose?: "registration",
): Promise<string> {
  const dataUrl = await compressToDataURL(file, max, quality);
  const blob = await (await fetch(dataUrl)).blob();
  const form = new FormData();
  form.append("file", blob, "image.jpg");
  if (purpose) form.append("purpose", purpose);
  const res = await api<{ url: string }>("/api/upload", { form });
  return res.url;
}

// ----------------------------------------------------------------------------
// آمار پنل مدیریت
// ----------------------------------------------------------------------------

export function stats() {
  const users = DB.users();
  return {
    students: users.filter((u) => u.role === "student").length,
    staff: users.filter((u) => u.role !== "student").length,
    messages: DB.messages().length,
    exams: DB.exams().length,
    presentToday: DB.attendance().filter((a) => a.date === todayKey() && a.status === "present").length,
    groups: DB.chats().filter((c) => c.type === "group").length,
    channels: DB.chats().filter((c) => c.type === "channel").length,
    notices: DB.notices().length,
  };
}

// ----------------------------------------------------------------------------
// پشتیبان‌گیری و بازیابی انتخابی
// ----------------------------------------------------------------------------

export const BACKUP_SIGNATURE = "hamdel-backup";
export const BACKUP_VERSION = 3;

export type BackupKey =
  | "users"
  | "chats"
  | "messages"
  | "exams"
  | "subs"
  | "homeworks"
  | "hwsubs"
  | "attendance"
  | "notices"
  | "perms";

export const BACKUP_PARTS: { key: BackupKey; label: string; hint: string }[] = [
  { key: "users", label: "کاربران", hint: "دانش‌آموزان و کادر مدرسه" },
  { key: "chats", label: "گفتگوها", hint: "گروه‌ها، کانال‌ها و چت‌های شخصی" },
  { key: "messages", label: "پیام‌ها", hint: "متن‌ها، تصاویر و نظرسنجی‌ها" },
  { key: "exams", label: "آزمون‌ها", hint: "آزمون‌های طراحی‌شده" },
  { key: "subs", label: "پاسخ آزمون‌ها", hint: "پاسخ دانش‌آموزان و نمره‌ها" },
  { key: "homeworks", label: "تکالیف", hint: "تکالیف تعیین‌شده" },
  { key: "hwsubs", label: "تحویل تکالیف", hint: "پاسخ و تصاویر دانش‌آموزان" },
  { key: "attendance", label: "حضور و غیاب", hint: "سوابق روزانه" },
  { key: "notices", label: "اطلاعیه‌ها", hint: "اطلاعیه‌های مدرسه" },
  { key: "perms", label: "مجوزهای چت", hint: "مجوز گفتگوی دانش‌آموزان" },
];

export const ALL_BACKUP_KEYS: BackupKey[] = BACKUP_PARTS.map((p) => p.key);

export type BackupFile = {
  signature?: string;
  version?: number;
  exportedAt?: number;
  parts?: BackupKey[];
} & Partial<Record<BackupKey, unknown[]>>;

const READERS: Record<BackupKey, () => unknown[]> = {
  users: DB.users,
  chats: DB.chats,
  messages: DB.messages,
  exams: DB.exams,
  subs: DB.subs,
  homeworks: DB.homeworks,
  hwsubs: DB.hwsubs,
  attendance: DB.attendance,
  notices: DB.notices,
  perms: DB.perms,
};

const WRITERS: Record<BackupKey, (v: never[]) => void> = {
  users: DB.saveUsers as (v: never[]) => void,
  chats: DB.saveChats as (v: never[]) => void,
  messages: DB.saveMessages as (v: never[]) => void,
  exams: DB.saveExams as (v: never[]) => void,
  subs: DB.saveSubs as (v: never[]) => void,
  homeworks: DB.saveHomeworks as (v: never[]) => void,
  hwsubs: DB.saveHwsubs as (v: never[]) => void,
  attendance: DB.saveAttendance as (v: never[]) => void,
  notices: DB.saveNotices as (v: never[]) => void,
  perms: DB.savePerms as (v: never[]) => void,
};

/** شمارش رکوردهای موجود هر بخش */
export function backupCounts(): Record<BackupKey, number> {
  const out = {} as Record<BackupKey, number>;
  for (const k of ALL_BACKUP_KEYS) out[k] = READERS[k]().length;
  return out;
}

/** خروجی گرفتن از بخش‌های انتخاب‌شده */
export function exportSelected(keys: BackupKey[]): string {
  const data: BackupFile = {
    signature: BACKUP_SIGNATURE,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    parts: keys,
  };
  for (const k of keys) data[k] = READERS[k]();
  return JSON.stringify(data, null, 2);
}

export const exportAll = () => exportSelected(ALL_BACKUP_KEYS);

/** شمارش رکوردهای موجود در یک فایل پشتیبان */
export function inspectBackup(json: string): { ok: boolean; error?: string; counts?: Partial<Record<BackupKey, number>> } {
  let data: BackupFile;
  try {
    data = JSON.parse(json) as BackupFile;
  } catch {
    return { ok: false, error: "فایل انتخاب‌شده یک فایل JSON معتبر نیست." };
  }
  if (!data || typeof data !== "object") return { ok: false, error: "ساختار فایل پشتیبان معتبر نیست." };
  const counts: Partial<Record<BackupKey, number>> = {};
  let any = false;
  for (const k of ALL_BACKUP_KEYS) {
    if (Array.isArray(data[k])) {
      counts[k] = (data[k] as unknown[]).length;
      any = true;
    }
  }
  if (!any) return { ok: false, error: "این فایل، پشتیبان معتبر هَمدِل نیست." };
  return { ok: true, counts };
}

export interface ImportResult {
  ok: boolean;
  error?: string;
  added?: Partial<Record<BackupKey, number>>;
  skipped?: number;
}

/**
 * وارد کردن بخش‌های انتخاب‌شده از فایل پشتیبان
 * mode = "merge"   : افزودن رکوردهای جدید (تکراری‌ها رد می‌شوند)
 * mode = "replace" : جایگزینی کامل همان بخش‌ها
 */
export function importBackup(
  json: string,
  mode: "merge" | "replace" = "merge",
  keys: BackupKey[] = ALL_BACKUP_KEYS
): ImportResult {
  let data: BackupFile;
  try {
    data = JSON.parse(json) as BackupFile;
  } catch {
    return { ok: false, error: "فایل انتخاب‌شده یک فایل JSON معتبر نیست." };
  }
  if (!data || typeof data !== "object") return { ok: false, error: "ساختار فایل پشتیبان معتبر نیست." };
  if (keys.length === 0) return { ok: false, error: "حداقل یک بخش را برای وارد کردن انتخاب کنید." };

  const added: Partial<Record<BackupKey, number>> = {};
  let skipped = 0;
  const replaceMode = mode === "replace";

  for (const key of keys) {
    const incoming = data[key];
    if (!Array.isArray(incoming)) continue;

    if (replaceMode) {
      WRITERS[key](incoming as never[]);
      added[key] = incoming.length;
      continue;
    }

    const current = READERS[key]() as { id: string }[];
    const list = incoming as { id: string; phone?: string }[];
    const ids = new Set(current.map((x) => x.id));
    const phones = new Set(
      key === "users" ? (current as { phone?: string }[]).map((x) => x.phone).filter(Boolean) : []
    );
    const result = [...current];
    let count = 0;
    for (const item of list) {
      const dupPhone = key === "users" && item.phone ? phones.has(item.phone) : false;
      if (ids.has(item.id) || dupPhone) {
        skipped++;
        continue;
      }
      result.push(item);
      ids.add(item.id);
      if (key === "users" && item.phone) phones.add(item.phone);
      count++;
    }
    if (count > 0) WRITERS[key](result as never[]);
    added[key] = count;
  }

  if (isBrowser()) window.dispatchEvent(new CustomEvent("hamdel:db"));
  return { ok: true, added, skipped };
}

/** حذف همه پیام‌ها (متن، تصویر و نظرسنجی) از کل سامانه */
export function deleteAllMessages(): number {
  const n = DB.messages().length;
  DB.saveMessages([]);
  // برداشتن سنجاق‌ها چون پیام‌ها دیگر وجود ندارند
  DB.saveChats(DB.chats().map((c) => ({ ...c, pinnedId: undefined })));
  return n;
}

/** پاک‌سازی کامل همه داده‌های سامانه روی سرور (با رمز پاک‌سازی) */
export async function wipeAll(deletePassword: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api("/api/state/wipe", { body: { deletePassword } });
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
  storeSetSession(null);
  clearLocal();
  return { ok: true };
}

/** بررسی رمز پاک‌سازی بدون انجام عملیات */
export async function verifyWipePassword(deletePassword: string): Promise<boolean> {
  try {
    await api("/api/state/wipe/verify", { body: { deletePassword } });
    return true;
  } catch {
    return false;
  }
}
