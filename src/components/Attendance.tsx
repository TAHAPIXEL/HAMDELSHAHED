"use client";

import { useMemo, useState } from "react";
import {
  CalendarCheck2,
  UserCheck2,
  UserX2,
  AlarmClock,
  CircleCheckBig,
  StickyNote,
} from "lucide-react";
import {
  DB,
  JALALI_MONTHS,
  SECTIONS,
  attFa,
  className,
  dateKeyFa,
  fa,
  faTime,
  isStaff,
  jalaaliDaysOfMonth,
  jalaliToDateKey,
  setAttendance,
  todayJalali,
  type AttStatus,
  type Grade,
  type User,
} from "@/lib/model";
import { Avatar, Chip, Empty, Seg, inputCls, useDbTick, useToast } from "./ui";
import { ExportButtons } from "./ExportPanel";
import { attendanceDoc, reportCardDoc } from "@/lib/export/doc";
import { periodFor, type ReportKind } from "@/lib/reports";

export default function Attendance({ user }: { user: User }) {
  useDbTick();
  if (isStaff(user)) return <StaffAttendance user={user} />;
  return <StudentAttendance user={user} />;
}

// ----------------------------------------------------------------------------
// ویوی دانش‌آموز
// ----------------------------------------------------------------------------

function StudentAttendance({ user }: { user: User }) {
  useDbTick();
  const recs = DB.attendance()
    .filter((r) => r.studentId === user.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const count = (s: AttStatus) => recs.filter((r) => r.status === s).length;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="stagger mb-5 grid grid-cols-3 gap-3">
          <div className="card flex flex-col items-center gap-1.5 p-4">
            <UserCheck2 className="size-6 text-emerald-500" />
            <div className="text-xl font-black text-slate-800 dark:text-slate-100">{fa(count("present"))}</div>
            <div className="text-[11px] font-bold text-slate-400">روز حاضر</div>
          </div>
          <div className="card flex flex-col items-center gap-1.5 p-4">
            <UserX2 className="size-6 text-rose-500" />
            <div className="text-xl font-black text-slate-800 dark:text-slate-100">{fa(count("absent"))}</div>
            <div className="text-[11px] font-bold text-slate-400">روز غایب</div>
          </div>
          <div className="card flex flex-col items-center gap-1.5 p-4">
            <AlarmClock className="size-6 text-amber-500" />
            <div className="text-xl font-black text-slate-800 dark:text-slate-100">{fa(count("excused"))}</div>
            <div className="text-[11px] font-bold text-slate-400">روز موجه</div>
          </div>
        </div>

        <div className="mb-3 rounded-2xl bg-indigo-50 px-4 py-3 text-[12.5px] font-semibold leading-6 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">
          هر روزی که وارد سایت شوید، حضور شما به‌صورت خودکار ثبت می‌شود. کادر مدرسه می‌توانند آن را اصلاح کنند.
        </div>

        <ReportCardCard students={[user]} lockedToSelf />

        {recs.length === 0 && (
          <Empty icon={<CalendarCheck2 className="size-7" />} title="سابقه‌ای نیست" />
        )}
        <div className="stagger space-y-2">
          {recs.map((r) => (
            <div key={r.id} className="card flex items-center gap-3.5 p-4">
              <div className={`flex size-10 shrink-0 items-center justify-center rounded-2xl ${r.status === "present" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15" : r.status === "absent" ? "bg-rose-100 text-rose-600 dark:bg-rose-500/15" : "bg-amber-100 text-amber-600 dark:bg-amber-500/15"}`}>
                {r.status === "present" ? <UserCheck2 className="size-5" /> : r.status === "absent" ? <UserX2 className="size-5" /> : <AlarmClock className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-black text-slate-800 dark:text-slate-100">{dateKeyFa(r.date)}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-400">
                  {r.loginAt && <span>ورود: {faTime(r.loginAt)}</span>}
                  {r.auto && <span>ثبت خودکار</span>}
                  {r.note && <span className="flex items-center gap-1"><StickyNote className="size-3" />{r.note}</span>}
                </div>
              </div>
              <Chip tone={r.status === "present" ? "green" : r.status === "absent" ? "red" : "amber"}>{attFa[r.status]}</Chip>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// ویوی کادر
// ----------------------------------------------------------------------------

function StaffAttendance({ user }: { user: User }) {
  useDbTick();
  const toast = useToast();
  const [jy, setJy] = useState(() => todayJalali().jy);
  const [jm, setJm] = useState(() => todayJalali().jm);
  const [jd, setJd] = useState(() => todayJalali().jd);
  const date = jalaliToDateKey(jy, jm, jd); // کلید ذخیره‌سازی استاندارد
  const [grade, setGrade] = useState<Grade>(7);
  const [section, setSection] = useState("1");
  const [savedTick, setSavedTick] = useState(0);
  const jDays = jalaaliDaysOfMonth(jy, jm);

  const students = useMemo(
    () => DB.users().filter((u) => u.role === "student" && u.grade === grade && u.section === section),
    [grade, section]
  );

  const recOf = (sid: string) => DB.attendance().find((r) => r.id === `${date}:${sid}`);
  const counts = {
    present: students.filter((s) => (recOf(s.id)?.status) === "present").length,
    absent: students.filter((s) => (recOf(s.id)?.status) === "absent").length,
    excused: students.filter((s) => (recOf(s.id)?.status) === "excused").length,
    none: students.filter((s) => !recOf(s.id)).length,
  };

  const setStatus = (sid: string, status: AttStatus) => {
    setAttendance(sid, date, status, user.id);
    setSavedTick((t) => t + 1);
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        {/* فیلترها */}
        <div className="card mb-5 grid gap-3 p-4 sm:grid-cols-3">
          <div>
            <span className="mb-1.5 block text-[12px] font-bold text-slate-500 dark:text-slate-400">تاریخ (شمسی)</span>
            <div className="grid grid-cols-3 gap-1.5">
              <select className={`${inputCls} !px-2 text-center !text-[12px]`} value={jd} onChange={(e) => setJd(Number(e.target.value))}>
                {Array.from({ length: jDays }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{fa(d)}</option>
                ))}
              </select>
              <select className={`${inputCls} !px-2 !text-[12px]`} value={jm} onChange={(e) => { const m = Number(e.target.value); setJm(m); setJd((d) => Math.min(d, jalaaliDaysOfMonth(jy, m))); }}>
                {JALALI_MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <select className={`${inputCls} !px-2 text-center !text-[12px]`} value={jy} onChange={(e) => { const y = Number(e.target.value); setJy(y); setJd((d) => Math.min(d, jalaaliDaysOfMonth(y, jm))); }}>
                {[jy - 1, jy, jy + 1].sort((a, b) => b - a).map((y) => (
                  <option key={y} value={y}>{fa(y)}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-bold text-slate-500 dark:text-slate-400">پایه</span>
            <select className={inputCls} value={grade} onChange={(e) => { setGrade(Number(e.target.value) as Grade); setSection("1"); }}>
              {([7, 8, 9] as Grade[]).map((g) => (
                <option key={g} value={g}>پایه {className(g, "1").split(" ")[0]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-bold text-slate-500 dark:text-slate-400">شعبه</span>
            <select className={inputCls} value={section} onChange={(e) => setSection(e.target.value)}>
              {SECTIONS[grade].map((s) => (
                <option key={s} value={s}>شعبه {s}</option>
              ))}
            </select>
          </label>
        </div>

        {/* خروجی بازه‌ای حضور و غیاب */}
        <AttendanceExportCard grade={grade} section={section} jy={jy} jm={jm} jd={jd} />

        {/* خلاصه */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] font-bold">
          <Chip tone="green">حاضر: {fa(counts.present)}</Chip>
          <Chip tone="red">غایب: {fa(counts.absent)}</Chip>
          <Chip tone="amber">موجه: {fa(counts.excused)}</Chip>
          <Chip>بدون ثبت: {fa(counts.none)}</Chip>
          {savedTick > 0 && (
            <span key={savedTick} className="anim-fade-up mr-auto flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <CircleCheckBig className="size-3.5" />
              ذخیره شد
            </span>
          )}
        </div>

        {students.length === 0 && (
          <Empty
            icon={<CalendarCheck2 className="size-7" />}
            title="دانش‌آموزی در این کلاس نیست"
            desc="وقتی دانش‌آموزان کلاس ثبت‌نام کنند، لیستشان اینجا می‌آید"
          />
        )}

        <ReportCardCard students={students} />

        <div className="stagger space-y-2.5">
          {students.map((s) => {
            const rec = recOf(s.id);
            return (
              <div key={s.id} className="card flex flex-wrap items-center gap-3 p-3.5">
                <Avatar user={s} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-black text-slate-800 dark:text-slate-100">{s.firstName} {s.lastName}</div>
                  <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                    {rec?.loginAt ? `ورود امروز: ${faTime(rec.loginAt)}` : "امروز وارد نشده"}
                    {rec?.auto ? " • ثبت خودکار" : rec ? " • ثبت دستی" : ""}
                  </div>
                </div>
                <div className="flex rounded-xl border border-line bg-app p-1 dark:border-white/10 dark:bg-white/5">
                  {(
                    [
                      { v: "present", l: "حاضر", on: "bg-emerald-500 text-white" },
                      { v: "absent", l: "غایب", on: "bg-rose-500 text-white" },
                      { v: "excused", l: "موجه", on: "bg-amber-500 text-white" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.v}
                      onClick={() => setStatus(s.id, o.v)}
                      className={`rounded-lg px-3 py-1.5 text-[12px] font-black transition ${
                        rec?.status === o.v ? o.on : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {o.l}
                    </button>
                  ))}
                </div>
                <input
                  className={`${inputCls} !w-36 !py-1.5 !text-[12px]`}
                  placeholder="یادداشت..."
                  defaultValue={rec?.note ?? ""}
                  key={`${s.id}-${date}-${rec?.note ?? ""}`}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (rec?.note ?? "")) {
                      setAttendance(s.id, date, rec?.status ?? "present", user.id, v || undefined);
                      setSavedTick((t) => t + 1);
                      toast("success", "یادداشت ذخیره شد");
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// خروجی‌ها: حضور و غیاب بازه‌ای (روزانه/هفتگی/ماهانه) و کارنامه‌ی ماهانه
// ----------------------------------------------------------------------------

function MonthYearPicker({ jy, jm, onChange }: { jy: number; jm: number; onChange: (jy: number, jm: number) => void }) {
  const t = todayJalali();
  const years = [t.jy - 1, t.jy, t.jy + 1].sort((a, b) => b - a);
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <select className={`${inputCls} !px-2 !text-[12px]`} value={jm} onChange={(e) => onChange(jy, Number(e.target.value))}>
        {JALALI_MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
      <select className={`${inputCls} !px-2 text-center !text-[12px]`} value={jy} onChange={(e) => onChange(Number(e.target.value), jm)}>
        {years.map((y) => (
          <option key={y} value={y}>{fa(y)}</option>
        ))}
      </select>
    </div>
  );
}

function AttendanceExportCard({ grade, section, jy, jm, jd }: { grade: Grade; section: string; jy: number; jm: number; jd: number }) {
  const [kind, setKind] = useState<ReportKind>("day");
  const period = periodFor(kind, jy, jm, jd);
  return (
    <div className="card mb-5 space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[13.5px] font-black text-slate-800 dark:text-slate-100">خروجی حضور و غیاب</div>
          <div className="mt-0.5 text-[11.5px] font-semibold text-slate-400">{period.title}</div>
        </div>
        <Seg<ReportKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: "day", label: "روزانه" },
            { value: "week", label: "هفتگی" },
            { value: "month", label: "ماهانه" },
          ]}
        />
      </div>
      <ExportButtons
        build={() => attendanceDoc(grade, section, periodFor(kind, jy, jm, jd))}
      />
    </div>
  );
}

function ReportCardCard({ students, lockedToSelf }: { students: User[]; lockedToSelf?: boolean }) {
  const t = todayJalali();
  const [jy, setJy] = useState(t.jy);
  const [jm, setJm] = useState(t.jm);
  const [sid, setSid] = useState(students[0]?.id ?? "");
  const current = students.find((s) => s.id === sid) ?? students[0];
  if (!current) return null;
  return (
    <div className="card mb-5 space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-[13.5px] font-black text-slate-800 dark:text-slate-100">کارنامه ماهانه</div>
          <div className="mt-0.5 text-[11.5px] font-semibold text-slate-400">
            {lockedToSelf ? "کارنامه ماه انتخابی شما" : `کارنامه ماه انتخابی برای ${current.firstName} ${current.lastName}`}
          </div>
        </div>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {!lockedToSelf && (
          <select className={inputCls} value={current.id} onChange={(e) => setSid(e.target.value)}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
            ))}
          </select>
        )}
        <MonthYearPicker jy={jy} jm={jm} onChange={(y, m) => { setJy(y); setJm(m); }} />
      </div>
      <ExportButtons build={() => reportCardDoc(current.id, jy, jm)} />
    </div>
  );
}
