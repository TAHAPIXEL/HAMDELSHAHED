/** تبدیل عدد/رشته به رقم‌های فارسی */
const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function fa(value: string | number): string {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

export const WEEKDAYS = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];

/* -------------------- تبدیل تاریخ میلادی به شمسی -------------------- */

const div = (a: number, b: number) => Math.trunc(a / b);
const mod = (a: number, b: number) => a - Math.floor(a / b) * b;

/** پیاده‌سازی الگوریتم استاندارد جلالی (jalaali-js) */
function jalCal(jy: number) {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324,
    2394, 2456, 3178,
  ];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jump = 0;

  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number) {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div((div(gy + 100100 + div(gm - 8, 6), 100) * 3) / 4, 1) + 752;
  return d;
}

function d2g(jdn: number) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function d2j(jdn: number) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  let jm: number;
  let jd: number;

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

export function toJalali(date: Date): { jy: number; jm: number; jd: number } {
  return d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()));
}

/** تبدیل رشته‌ی تاریخ (YYYY-MM-DD) به Date محلی، بدون جابه‌جایی منطقه‌زمانی */
function asLocalDate(value: Date | string): Date {
  if (typeof value === "string") {
    const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (plain) return new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]));
  }
  return typeof value === "string" ? new Date(value) : value;
}

export function jalaliDate(date: Date | string): string {
  const d = asLocalDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  const { jy, jm, jd } = toJalali(d);
  return `${fa(jd)} ${JALALI_MONTHS[jm - 1]} ${fa(jy)}`;
}

export function jalaliShort(date: Date | string): string {
  const d = asLocalDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  const { jy, jm, jd } = toJalali(d);
  return `${fa(jy)}/${fa(String(jm).padStart(2, "0"))}/${fa(String(jd).padStart(2, "0"))}`;
}

export function clockTime(date: Date | string): string {
  const d = asLocalDate(date);
  if (Number.isNaN(d.getTime())) return "—";
  return fa(
    `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  );
}

export function jalaliDateTime(date: Date | string): string {
  return `${jalaliDate(date)} • ${clockTime(date)}`;
}

export function weekdayName(date: Date | string): string {
  const d = asLocalDate(date);
  return WEEKDAYS[d.getDay()] ?? "";
}

export function timeAgo(date: Date | string): string {
  const d = asLocalDate(date);
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "پیش" : "بعد";
  const minutes = Math.round(abs / 60_000);
  if (minutes < 1) return "همین حالا";
  if (minutes < 60) return `${fa(minutes)} دقیقه ${suffix}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${fa(hours)} ساعت ${suffix}`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${fa(days)} روز ${suffix}`;
  return jalaliDate(d);
}

/** آیا تاریخ گذشته است؟ */
export function isPast(date: Date | string): boolean {
  return new Date(date).getTime() < Date.now();
}

/** فاصله تا مهلت به شکل خوانا */
export function deadlineLabel(date: Date | string): string {
  const diff = new Date(date).getTime() - Date.now();
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  if (days > 0) return `${fa(days)} روز ${diff > 0 ? "مانده" : "گذشته"}`;
  if (hours > 0) return `${fa(hours)} ساعت ${diff > 0 ? "مانده" : "گذشته"}`;
  return `${fa(minutes)} دقیقه ${diff > 0 ? "مانده" : "گذشته"}`;
}

/** تاریخ ISO محلی (برای input date) */
export function isoDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
}

export const roleLabel: Record<string, string> = {
  admin: "مدیر",
  teacher: "دبیر",
  student: "دانش‌آموز",
};

export const attendanceLabel: Record<string, string> = {
  present: "حاضر",
  absent: "غایب",
  late: "تأخیر",
  excused: "موجه",
};

export const statusLabel: Record<string, string> = {
  submitted: "ارسال‌شده",
  late: "با تأخیر",
  graded: "تصحیح‌شده",
  in_progress: "در حال انجام",
};
