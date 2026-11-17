"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarCheck2,
  CalendarDays,
  CheckCheck,
  Eraser,
  Save,
  UserCheck,
  UserX,
  Clock3,
  ShieldCheck,
} from "lucide-react";
import { api, errorMessage, useApi } from "@/lib/client";
import { fa, isoDate, jalaliDate, weekdayName } from "@/lib/format";
import type { Me, RosterEntry } from "@/lib/types";
import {
  Avatar,
  Badge,
  Button,
  DeleteConfirmModal,
  EmptyState,
  Field,
  LoadingBlock,
  PageHeader,
  Progress,
  Select,
  StatCard,
  useToast,
} from "./ui";
import type { Meta } from "./Shell";

type Status = "present" | "absent" | "late" | "excused";

const STATUS_OPTIONS: { id: Status; label: string; tone: "emerald" | "rose" | "amber" | "sky" }[] = [
  { id: "present", label: "حاضر", tone: "emerald" },
  { id: "absent", label: "غایب", tone: "rose" },
  { id: "late", label: "تأخیر", tone: "amber" },
  { id: "excused", label: "موجه", tone: "sky" },
];

type StudentData = {
  items: {
    id: number;
    sessionDate: string;
    period: number;
    status: Status;
    note: string | null;
    className: string;
  }[];
  summary: {
    total: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
  } | null;
};

type TeacherData = {
  class?: { id: number; name: string };
  date: string;
  period: number;
  roster: RosterEntry[];
  canRecord: boolean;
};

export default function Attendance({ user }: { user: Me }) {
  const { data: meta } = useApi<Meta>("/api/meta");
  const classes = useMemo(() => meta?.classes ?? [], [meta]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(isoDate());
  const [period, setPeriod] = useState("1");

  useEffect(() => {
    if (!classId && classes[0]) setClassId(String(classes[0].id));
  }, [classes, classId]);

  if (user.role === "student") return <StudentAttendance />;

  if (classes.length === 0)
    return (
      <div>
        <PageHeader title="حضور و غیاب" subtitle="ثبت حضور هر زنگ و پیگیری وضعیت کلاس‌ها" />
        <EmptyState
          icon={<CalendarCheck2 className="size-5" />}
          title="کلاسی برای ثبت حضور و غیاب ندارید"
          description={
            user.role === "admin"
              ? "ابتدا از «مدیریت سامانه ← کلاس‌ها» کلاس بسازید و دانش‌آموز اضافه کنید."
              : "هنوز کلاسی به شما تخصیص داده نشده است. با مدیر مدرسه هماهنگ کنید."
          }
        />
      </div>
    );

  return (
    <div>
      <PageHeader
        title="حضور و غیاب"
        subtitle="ثبت حضور هر زنگ و پیگیری وضعیت کلاس‌ها"
      />

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-3">
        <Field label="کلاس">
          <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="تاریخ">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
          />
        </Field>
        <Field label="زنگ">
          <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((p) => (
              <option key={p} value={p}>
                زنگ {fa(p)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {classId && (
        <RosterEditor
          key={`${classId}-${date}-${period}`}
          classId={Number(classId)}
          date={date}
          period={Number(period)}
          className={classes.find((c) => String(c.id) === classId)?.name ?? ""}
        />
      )}
    </div>
  );
}

/* ----------------------------- ثبت برای دبیر ---------------------------- */

function RosterEditor({
  classId,
  date,
  period,
  className,
}: {
  classId: number;
  date: string;
  period: number;
  className: string;
}) {
  const toast = useToast();
  const { data, loading, reload } = useApi<TeacherData>(
    `/api/attendance?classId=${classId}&date=${date}&period=${period}`,
  );
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [saving, setSaving] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);

  useEffect(() => {
    if (!data?.roster) return;
    const next: Record<number, Status> = {};
    for (const row of data.roster) next[row.studentId] = row.status ?? "present";
    setStatuses(next);
  }, [data]);

  const rows = data?.roster ?? [];
  const counts = useMemo(() => {
    const values = Object.values(statuses);
    return {
      present: values.filter((s) => s === "present").length,
      absent: values.filter((s) => s === "absent").length,
      late: values.filter((s) => s === "late").length,
      excused: values.filter((s) => s === "excused").length,
    };
  }, [statuses]);

  const save = async () => {
    setSaving(true);
    try {
      await api("/api/attendance", {
        method: "POST",
        body: JSON.stringify({
          classId,
          date,
          period,
          entries: rows.map((row) => ({
            studentId: row.studentId,
            status: statuses[row.studentId] ?? "present",
          })),
        }),
      });
      toast.push(`حضور و غیاب ${className} ذخیره شد`);
      await reload();
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const markAll = (status: Status) => {
    const next: Record<number, Status> = {};
    for (const row of rows) next[row.studentId] = status;
    setStatuses(next);
  };

  const hasRecords = rows.some((row) => row.attendanceId != null);

  if (loading && !data) return <LoadingBlock rows={4} />;

  if (rows.length === 0)
    return (
      <EmptyState
        icon={<UserX className="size-5" />}
        title="دانش‌آموزی در این کلاس نیست"
        description="ابتدا از بخش مدیریت، دانش‌آموز به کلاس اضافه کنید."
      />
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<UserCheck className="size-5" />} label="حاضر" value={counts.present} tone="emerald" />
        <StatCard icon={<UserX className="size-5" />} label="غایب" value={counts.absent} tone="rose" />
        <StatCard icon={<Clock3 className="size-5" />} label="تأخیر" value={counts.late} tone="amber" />
        <StatCard icon={<ShieldCheck className="size-5" />} label="موجه" value={counts.excused} tone="sky" />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-xs font-extrabold text-slate-800">
              {className} — {weekdayName(date)} {jalaliDate(date)}
            </p>
            <p className="text-[10px] text-slate-500">
              زنگ {fa(period)} · {fa(rows.length)} دانش‌آموز
            </p>
          </div>
          <div className="mr-auto flex items-center gap-1.5">
            <Button size="sm" variant="outline" onClick={() => markAll("present")}>
              <CheckCheck className="size-3.5" /> همه حاضر
            </Button>
            {hasRecords && (
              <Button size="sm" variant="danger" onClick={() => setClearOpen(true)}>
                <Eraser className="size-3.5" /> پاک‌سازی این زنگ
              </Button>
            )}
            <Button size="sm" onClick={save} loading={saving}>
              <Save className="size-3.5" /> ذخیره
            </Button>
          </div>
        </div>

        <ul className="divide-y divide-slate-100">
          {rows.map((row) => {
            const current = statuses[row.studentId] ?? "present";
            return (
              <li key={row.studentId} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <Avatar name={row.fullName} color={row.avatarColor} src={row.avatarUrl} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-800">{row.fullName}</p>
                  <p className="text-[10px] text-slate-400" dir="ltr">
                    {row.username}
                  </p>
                </div>
                <div className="flex gap-1">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setStatuses((prev) => ({ ...prev, [row.studentId]: option.id }))
                      }
                      className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition ${
                        current === option.id
                          ? option.id === "present"
                            ? "bg-emerald-500 text-white"
                            : option.id === "absent"
                              ? "bg-rose-500 text-white"
                              : option.id === "late"
                                ? "bg-amber-500 text-white"
                                : "bg-sky-500 text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <DeleteConfirmModal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        title="پاک‌سازی حضور و غیاب این زنگ"
        description={`سوابق حضور «${className}» در ${weekdayName(date)} ${jalaliDate(date)} — زنگ ${fa(period)} حذف می‌شود. رمز حذف سامانه را وارد کنید.`}
        onConfirm={async (deletePassword) => {
          await api("/api/attendance", {
            method: "DELETE",
            body: JSON.stringify({ classId, date, period, deletePassword }),
          });
          toast.push("سوابق این زنگ پاک شد", "info");
          await reload(true);
        }}
      />
    </div>
  );
}

/* --------------------------- نمای دانش‌آموز ----------------------------- */

function StudentAttendance() {
  const { data, loading } = useApi<StudentData>("/api/attendance");
  const summary = data?.summary;

  const rate = summary && summary.total ? ((summary.present + summary.late) / summary.total) * 100 : 100;

  return (
    <div>
      <PageHeader title="کارنامه‌ی حضور" subtitle="سابقه‌ی حضور، غیبت و تأخیر شما در کلاس‌ها" />

      {loading && !data ? (
        <LoadingBlock rows={3} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              icon={<CalendarCheck2 className="size-5" />}
              label="درصد حضور"
              value={`${Math.round(rate)}٪`}
              tone={rate >= 90 ? "emerald" : "amber"}
            />
            <StatCard icon={<UserCheck className="size-5" />} label="حاضر" value={summary?.present ?? 0} tone="emerald" />
            <StatCard icon={<UserX className="size-5" />} label="غایب" value={summary?.absent ?? 0} tone="rose" />
            <StatCard
              icon={<Clock3 className="size-5" />}
              label="تأخیر و موجه"
              value={`${fa(summary?.late ?? 0)} / ${fa(summary?.excused ?? 0)}`}
              tone="amber"
            />
          </div>

          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-extrabold text-slate-800">نرخ حضور کل</p>
              <span className="text-[11px] font-bold text-slate-500">{fa(Math.round(rate))}٪</span>
            </div>
            <Progress value={rate} tone={rate >= 90 ? "emerald" : "amber"} />
            <p className="mt-2 text-[10px] text-slate-400">
              بر پایه‌ی {fa(summary?.total ?? 0)} جلسه‌ی ثبت‌شده
            </p>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <CalendarDays className="size-4 text-indigo-500" />
              <p className="text-xs font-extrabold text-slate-800">ریز حضور</p>
            </div>
            {(data?.items ?? []).length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="size-5" />}
                title="سابقه‌ای ثبت نشده است"
                description="پس از اولین ثبت حضور توسط دبیر، اینجا نمایش داده می‌شود."
              />
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-right text-xs">
                  <thead className="sticky top-0 bg-slate-50/95 text-[10px] text-slate-500 backdrop-blur">
                    <tr>
                      <th className="px-4 py-2 font-semibold">تاریخ</th>
                      <th className="px-4 py-2 font-semibold">روز</th>
                      <th className="px-4 py-2 font-semibold">زنگ</th>
                      <th className="px-4 py-2 font-semibold">کلاس</th>
                      <th className="px-4 py-2 font-semibold">وضعیت</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(data?.items ?? []).map((row) => (
                      <tr key={row.id} className="transition hover:bg-slate-50/60">
                        <td className="px-4 py-2 text-slate-700">{jalaliDate(row.sessionDate)}</td>
                        <td className="px-4 py-2 text-slate-500">{weekdayName(row.sessionDate)}</td>
                        <td className="px-4 py-2 text-slate-500">{fa(row.period)}</td>
                        <td className="px-4 py-2 text-slate-500">{row.className}</td>
                        <td className="px-4 py-2">
                          <Badge
                            tone={
                              row.status === "present"
                                ? "emerald"
                                : row.status === "absent"
                                  ? "rose"
                                  : row.status === "late"
                                    ? "amber"
                                    : "sky"
                            }
                          >
                            {STATUS_OPTIONS.find((s) => s.id === row.status)?.label ?? row.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
