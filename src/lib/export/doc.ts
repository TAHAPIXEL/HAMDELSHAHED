// ----------------------------------------------------------------------------
//  مدل سندِ خروجی (مستقل از فرمت). PDF، Word و Excel هر سه از همین ساختار ساخته می‌شوند.
// ----------------------------------------------------------------------------

import { DB, JALALI_MONTHS, attFa, fa, type AttStatus } from "../model";
import {
  attCode,
  attLabel,
  buildAttendanceReport,
  buildReportCard,
  type AttendanceReport,
  type ReportCard,
  type ReportPeriod,
} from "../reports";

export type Tone = "ok" | "bad" | "warn" | "muted" | "strong";
export type Cell = string | { t: string; tone?: Tone };

export interface ExportTable {
  heading?: string;
  headers: string[];
  rows: Cell[][];
  /** وزن نسبی ستون‌ها (اختیاری)؛ ستون اول معمولاً پهن‌تر است */
  widths?: number[];
  /** ردیف جمع: پررنگ و متمایز */
  totalRow?: Cell[];
}

export interface ExportDoc {
  file: string; // نام پایه‌ی فایل بدون پسوند
  title: string;
  subtitle: string;
  orientation: "portrait" | "landscape";
  meta: [string, string][];
  summary?: { label: string; value: string; tone?: Tone }[];
  tables: ExportTable[];
  notes: string[];
}

export const SITE_NAME = "همدل";
const FOOTER = `این سند از اطلاعات ثبت‌شده در سامانه ${SITE_NAME} تهیه شده است.`;
export const pct = (n: number) => `${fa(n)}٪`;
const dash = "—";
export const fmtDays = (n: number) => `${fa(n)} روز`;

const statusTone = (s: AttStatus | null): Tone => (s === "present" ? "ok" : s === "absent" ? "bad" : s === "excused" ? "warn" : "muted");

// ----------------------------------------------------------------------------
//  حضور و غیاب کلاس
// ----------------------------------------------------------------------------

export function attendanceDoc(grade: 7 | 8 | 9, section: string, period: ReportPeriod): ExportDoc {
  const rep: AttendanceReport = buildAttendanceReport(grade, section, period);
  const many = rep.days.length > 7; // ماهانه: کد کوتاه ح/غ/م برای جا شدن ستون‌ها
  const hasData = rep.days.length > 0 && rep.rows.length > 0;
  const dayCols = rep.days.map((d, i) => ({ label: d.label, idx: i }));

  const headers = ["ردیف", "نام و نام خانوادگی", ...dayCols.map((d) => d.label), "حاضر", "غایب", "مرخصی", "درصد حضور"];
  const widths = [6, 26, ...dayCols.map(() => (many ? 3.2 : 9)), 8, 8, 8, 9];

  const rows: Cell[][] = rep.rows.map((r) => [
    fa(r.no),
    `${r.student.firstName} ${r.student.lastName}`,
    ...r.cells.map((c) => (many ? { t: attCode(c), tone: statusTone(c) } : { t: attLabel(c), tone: statusTone(c) })),
    { t: fa(r.present), tone: "ok" },
    { t: fa(r.absent), tone: r.absent ? "bad" : "muted" },
    { t: fa(r.excused), tone: r.excused ? "warn" : "muted" },
    `${pct(r.rate)}`,
  ]);

  const totalRow: Cell[] = [
    "",
    "جمع کلاس",
    ...dayCols.map(() => ""),
    fa(rep.totals.present),
    fa(rep.totals.absent),
    fa(rep.totals.excused),
    pct(rep.totals.rate),
  ];

  const kindLabel = period.kind === "day" ? "روزانه" : period.kind === "week" ? "هفتگی" : "ماهانه";
  const notes = [FOOTER];
  if (many) notes.unshift("راهنما: ح = حاضر، غ = غایب، م = مرخصی، – = ثبت‌نشده");
  if (!hasData) notes.unshift("برای این بازه هیچ حضور و غیابی برای این کلاس ثبت نشده است.");

  return {
    file: `attendance-${period.kind}-g${grade}s${section}-${period.from}`,
    title: `گزارش حضور و غیاب ${kindLabel}`,
    subtitle: `${rep.classLabel} • ${period.rangeLabel}`,
    orientation: "landscape",
    meta: [
      ["کلاس", rep.classLabel],
      ["بازه گزارش", period.rangeLabel],
      ["تعداد دانش‌آموزان", fa(rep.rows.length)],
      ["روزهای ثبت‌شده", fa(rep.days.length)],
    ],
    summary: [
      { label: "حاضر", value: fa(rep.totals.present), tone: "ok" },
      { label: "غایب", value: fa(rep.totals.absent), tone: "bad" },
      { label: "مرخصی", value: fa(rep.totals.excused), tone: "warn" },
      { label: "درصد حضور کلاس", value: pct(rep.totals.rate), tone: "strong" },
    ],
    tables: hasData ? [{ heading: "جدول حضور و غیاب", headers, rows, widths, totalRow }] : [],
    notes,
  };
}

// ----------------------------------------------------------------------------
//  کارنامه‌ی ماهانه‌ی یک دانش‌آموز
// ----------------------------------------------------------------------------

export function reportCardDoc(studentId: string, jy: number, jm: number): ExportDoc | null {
  const student = DB.users().find((u) => u.id === studentId);
  if (!student) return null;
  const card: ReportCard = buildReportCard(student, jy, jm);
  const monthName = JALALI_MONTHS[jm - 1];
  const name = `${student.firstName} ${student.lastName}`;

  const examRows: Cell[][] = card.exams.map((e, i) => [
    fa(i + 1),
    e.title,
    e.date,
    { t: fa(e.score), tone: "strong" },
    fa(e.total),
    { t: pct(e.percent), tone: e.percent >= 50 ? "ok" : "bad" },
  ]);
  const dayRows: Cell[][] = card.days.map((d, i) => [
    fa(i + 1),
    d.label,
    d.weekday,
    { t: d.status ? attFa[d.status] : "ثبت نشده", tone: statusTone(d.status) },
  ]);

  const a = card.attendance;
  const tables: ExportDoc["tables"] = [];
  // جدول آزمون فقط وقتی ساخته می‌شود که ردیف داشته باشد؛ در غیر این صورت یادداشت زیر سند می‌آید
  if (examRows.length) {
    tables.push({
      heading: "نمرات آزمون‌های ماه",
      headers: ["ردیف", "عنوان آزمون", "تاریخ", "نمره", "از", "درصد"],
      rows: examRows,
      widths: [6, 34, 20, 10, 10, 12],
      totalRow: card.average === null ? undefined : ["", "میانگین", "", "", "", { t: pct(card.average), tone: "strong" }],
    });
  }
  if (dayRows.length) {
    tables.push({
      heading: "حضور و غیاب روزانه",
      headers: ["ردیف", "تاریخ", "روز هفته", "وضعیت"],
      rows: dayRows,
      widths: [6, 24, 20, 20],
    });
  }

  const notes: string[] = [];
  if (!card.exams.length) notes.push("در این ماه آزمون تصحیح‌شده‌ای برای این دانش‌آموز ثبت نشده است.");
  if (!card.days.length) notes.push("در این ماه حضور و غیابی برای کلاس ثبت نشده است.");
  notes.push(FOOTER);

  return {
    file: `report-card-${student.id}-${jy}-${String(jm).padStart(2, "0")}`,
    title: `کارنامه ماهانه ${monthName} ${fa(jy)}`,
    subtitle: `${name} • ${card.classLabel}`,
    orientation: "portrait",
    meta: [
      ["نام و نام خانوادگی", name],
      ["نام پدر", student.fatherName || dash],
      ["کد ملی", student.nationalId ? fa(student.nationalId) : dash],
      ["پایه / شعبه", card.classLabel || dash],
      ["ماه", `${monthName} ${fa(jy)}`],
      ["تاریخ صدور", card.issuedAt],
    ],
    summary: [
      { label: "روزهای درسی", value: fmtDays(a.schoolDays) },
      { label: "حاضر", value: fmtDays(a.present), tone: "ok" },
      { label: "غایب", value: fmtDays(a.absent), tone: "bad" },
      { label: "مرخصی", value: fmtDays(a.excused), tone: "warn" },
      { label: "درصد حضور", value: pct(a.rate), tone: "strong" },
      { label: "میانگین نمرات", value: card.average === null ? dash : pct(card.average), tone: "strong" },
    ],
    tables,
    notes,
  };
}

