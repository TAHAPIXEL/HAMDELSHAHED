// ----------------------------------------------------------------------------
//  داده‌ی گزارش‌ها: حضور و غیاب (روزانه/هفتگی/ماهانه) و کارنامه‌ی ماهانه
//  این فایل فقط محاسبه می‌کند؛ خروجی فایل (PDF/Word/Excel) در exporters.ts است.
//  همه‌ی فرمت‌ها از همین داده‌ها ساخته می‌شوند تا اعداد یکسان باشند.
// ----------------------------------------------------------------------------

import {
  DB,
  JALALI_MONTHS,
  attFa,
  dateKeyToJalali,
  fa,
  gradeFa,
  jalaaliDaysOfMonth,
  jalaliToDateKey,
  type AttStatus,
  type Exam,
  type Grade,
  type User,
} from "./model";

export type ReportKind = "day" | "week" | "month";

export interface ReportPeriod {
  kind: ReportKind;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  title: string;
  rangeLabel: string; // بازه‌ی خوانا، مثل «۱۲ آذر ۱۴۰۴» یا «۱ تا ۷ آذر ۱۴۰۴»
  monthLabel: string; // مثل «آذر ۱۴۰۴»
}

const pad = (n: number) => String(n).padStart(2, "0");
export const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keyToDate = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const tsToKey = (ts: number) => keyOf(new Date(ts));

/** همه‌ی روزهای بین دو کلید (شامل ابتدا و انتها) */
export function dayKeysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const d = keyToDate(from);
  const end = keyToDate(to);
  while (d <= end) {
    out.push(keyOf(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/** تاریخ شمسی کامل برای نمایش: «۱۲ آذر ۱۴۰۴» */
export function jalaliLabel(key: string): string {
  const j = dateKeyToJalali(key);
  return `${fa(j.jd)} ${JALALI_MONTHS[j.jm - 1]} ${fa(j.jy)}`;
}

/** بازه‌ی گزارش بر اساس یک روز شمسی انتخاب‌شده */
export function periodFor(kind: ReportKind, jy: number, jm: number, jd: number): ReportPeriod {
  const monthLabel = `${JALALI_MONTHS[jm - 1]} ${fa(jy)}`;
  if (kind === "day") {
    const key = jalaliToDateKey(jy, jm, jd);
    return { kind, from: key, to: key, title: `گزارش روزانه ${jalaliLabel(key)}`, rangeLabel: jalaliLabel(key), monthLabel };
  }
  if (kind === "week") {
    // هفته‌ی ایرانی از شنبه شروع می‌شود (شنبه = ۰ ، جمعه = ۶)
    const day = keyToDate(jalaliToDateKey(jy, jm, jd));
    const back = (day.getDay() + 1) % 7;
    const start = new Date(day);
    start.setDate(day.getDate() - back);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const from = keyOf(start);
    const to = keyOf(end);
    return {
      kind,
      from,
      to,
      title: `گزارش هفتگی ${jalaliLabel(from)} تا ${jalaliLabel(to)}`,
      rangeLabel: `${jalaliLabel(from)} تا ${jalaliLabel(to)}`,
      monthLabel,
    };
  }
  const from = jalaliToDateKey(jy, jm, 1);
  const to = jalaliToDateKey(jy, jm, jalaaliDaysOfMonth(jy, jm));
  return { kind: "month", from, to, title: `گزارش ماهانه ${monthLabel}`, rangeLabel: monthLabel, monthLabel };
}

// ----------------------------------------------------------------------------
//  حضور و غیاب کلاس
// ----------------------------------------------------------------------------

export interface AttendanceRow {
  no: number;
  student: User;
  cells: (AttStatus | null)[];
  present: number;
  absent: number;
  excused: number;
  none: number;
  rate: number; // درصد حضور نسبت به روزهای نمایش‌داده‌شده
}

export interface AttendanceReport {
  period: ReportPeriod;
  classLabel: string;
  days: { key: string; label: string }[];
  rows: AttendanceRow[];
  totals: { present: number; absent: number; excused: number; rate: number };
}

export const studentsOfClass = (grade: Grade, section: string): User[] =>
  DB.users()
    .filter((u) => u.role === "student" && u.grade === grade && u.section === section)
    .sort((a, b) => `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`, "fa"));

export function classLabel(grade: Grade, section: string): string {
  return `پایه ${gradeFa[grade]} شعبه ${fa(section)}`;
}

export function buildAttendanceReport(grade: Grade, section: string, period: ReportPeriod): AttendanceReport {
  const students = studentsOfClass(grade, section);
  const recs = DB.attendance();
  const byKey = new Map(recs.map((r) => [r.id, r] as const));
  const allDays = dayKeysBetween(period.from, period.to);
  // روزهای درسی: روزی که حداقل برای یکی از دانش‌آموزان کلاس، حضور و غیاب ثبت شده
  const schoolDays =
    period.kind === "day"
      ? [period.from]
      : allDays.filter((k) => students.some((s) => byKey.has(`${k}:${s.id}`)));
  const short = (k: string) => {
    const j = dateKeyToJalali(k);
    return period.kind === "month" ? fa(j.jd) : `${fa(j.jd)} ${JALALI_MONTHS[j.jm - 1]}`;
  };

  const rows: AttendanceRow[] = students.map((s, i) => {
    const cells = schoolDays.map((k) => byKey.get(`${k}:${s.id}`)?.status ?? null);
    const count = (st: AttStatus) => cells.filter((c) => c === st).length;
    const present = count("present");
    return {
      no: i + 1,
      student: s,
      cells,
      present,
      absent: count("absent"),
      excused: count("excused"),
      none: cells.filter((c) => c === null).length,
      rate: schoolDays.length ? Math.round((present / schoolDays.length) * 100) : 0,
    };
  });

  const sum = (f: (r: AttendanceRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const totalCells = rows.length * schoolDays.length;
  const totalPresent = sum((r) => r.present);
  return {
    period,
    classLabel: classLabel(grade, section),
    days: schoolDays.map((k) => ({ key: k, label: short(k) })),
    rows,
    totals: {
      present: totalPresent,
      absent: sum((r) => r.absent),
      excused: sum((r) => r.excused),
      rate: totalCells ? Math.round((totalPresent / totalCells) * 100) : 0,
    },
  };
}

/** کد کوتاه وضعیت برای جدول‌های پرستون (ماهانه) */
export const attCode = (s: AttStatus | null) => (s === "present" ? "ح" : s === "absent" ? "غ" : s === "excused" ? "م" : "–");
export const attLabel = (s: AttStatus | null) => (s ? attFa[s] : "ثبت نشده");

// ----------------------------------------------------------------------------
//  کارنامه‌ی ماهانه‌ی یک دانش‌آموز
// ----------------------------------------------------------------------------

export interface ExamLine {
  title: string;
  date: string;
  score: number;
  total: number;
  percent: number;
}

export interface ReportCard {
  period: ReportPeriod;
  student: User;
  classLabel: string;
  attendance: { present: number; absent: number; excused: number; none: number; schoolDays: number; rate: number };
  days: { key: string; label: string; weekday: string; status: AttStatus | null }[];
  exams: ExamLine[];
  average: number | null;
  issuedAt: string;
}

export const WEEKDAYS_FA = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

const examTotal = (e: Exam) => e.questions.reduce((a, q) => a + (q.score || 0), 0);

export function buildReportCard(student: User, jy: number, jm: number): ReportCard {
  const from = jalaliToDateKey(jy, jm, 1);
  const to = jalaliToDateKey(jy, jm, jalaaliDaysOfMonth(jy, jm));
  const period: ReportPeriod = {
    kind: "month",
    from,
    to,
    title: `کارنامه ماهانه ${JALALI_MONTHS[jm - 1]} ${fa(jy)}`,
    rangeLabel: `${JALALI_MONTHS[jm - 1]} ${fa(jy)}`,
    monthLabel: `${JALALI_MONTHS[jm - 1]} ${fa(jy)}`,
  };

  // حضور و غیاب همین ماه
  // روز درسی = روزی از ماه که برای کلاس این دانش‌آموز حداقل یک حضور و غیاب ثبت شده
  const all = DB.attendance();
  const classmates = new Set(
    student.grade && student.section ? studentsOfClass(student.grade, student.section).map((s) => s.id) : [student.id],
  );
  const classDays = new Set(all.filter((r) => classmates.has(r.studentId) && r.date >= from && r.date <= to).map((r) => r.date));
  const schoolDays = classDays.size;
  const recs = all.filter((r) => r.studentId === student.id && r.date >= from && r.date <= to);
  const statusByDay = new Map(recs.map((r) => [r.date, r.status] as const));
  // ریز روزهای ماه: روزهای درسی کلاس (هر روزی که کلاس حضور و غیاب داشته)
  const dayRows = [...classDays]
    .sort()
    .map((k) => {
      const j = dateKeyToJalali(k);
      return {
        key: k,
        label: `${fa(j.jd)} ${JALALI_MONTHS[j.jm - 1]}`,
        weekday: WEEKDAYS_FA[keyToDate(k).getDay()],
        status: statusByDay.get(k) ?? null,
      };
    });
  const count = (st: AttStatus) => recs.filter((r) => r.status === st).length;
  const present = count("present");
  const recorded = new Set(recs.map((r) => r.date)).size;

  // نمره‌ی آزمون‌های تصحیح‌شده‌ی همین ماه
  const exams = DB.exams();
  const subs = DB.subs().filter((s) => s.studentId === student.id && s.graded);
  const lines: ExamLine[] = [];
  for (const sub of subs) {
    const ts = sub.submittedAt ?? sub.startedAt;
    const key = tsToKey(ts);
    if (key < from || key > to) continue;
    const exam = exams.find((e) => e.id === sub.examId);
    if (!exam) continue;
    const total = examTotal(exam);
    const score = sub.total ?? 0;
    lines.push({
      title: exam.title,
      date: jalaliLabel(key),
      score,
      total,
      percent: total > 0 ? Math.round((score / total) * 100) : 0,
    });
  }
  lines.sort((a, b) => a.date.localeCompare(b.date, "fa"));
  const average = lines.length ? Math.round(lines.reduce((a, l) => a + l.percent, 0) / lines.length) : null;

  const issued = new Date();
  return {
    period,
    student,
    classLabel: student.grade && student.section ? classLabel(student.grade, student.section) : "",
    attendance: {
      present,
      absent: count("absent"),
      excused: count("excused"),
      none: Math.max(0, schoolDays - recorded),
      schoolDays,
      rate: schoolDays ? Math.round((present / schoolDays) * 100) : 0,
    },
    days: dayRows,
    exams: lines,
    average,
    issuedAt: jalaliLabel(keyOf(issued)),
  };
}
