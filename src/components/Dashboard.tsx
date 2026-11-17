"use client";

import {
  ArrowLeft,
  BookOpenCheck,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileCheck2,
  GraduationCap,
  Megaphone,
  MessageSquareText,
  Pin,
  School,
  TriangleAlert,
  Users,
} from "lucide-react";
import { useApi } from "@/lib/client";
import { fa, jalaliDate, deadlineLabel, timeAgo, isPast, statusLabel } from "@/lib/format";
import type { Announcement, Me } from "@/lib/types";
import {
  Avatar,
  Badge,
  EmptyState,
  ImageAttachment,
  LoadingBlock,
  PageHeader,
  Progress,
  StatCard,
} from "./ui";

type StudentDash = {
  role: "student";
  stats: {
    average: number;
    gradedCount: number;
    quizPercent: number;
    quizzesTaken: number;
    attendanceRate: number;
    absentCount: number;
    lateCount: number;
    pendingAssignments: number;
  };
  assignments: {
    id: number;
    title: string;
    dueAt: string;
    className: string;
    subjectName: string;
    subjectColor: string;
    submissionId: number | null;
    submissionStatus: string | null;
    score: string | null;
  }[];
  quizzes: {
    id: number;
    title: string;
    startsAt: string;
    endsAt: string;
    durationMinutes: number;
    subjectName: string;
    subjectColor: string;
    className: string;
    attemptId: number | null;
    attemptStatus: string | null;
    score: string | null;
  }[];
  announcements: Announcement[];
  classes: { id: number; name: string }[];
};

type TeacherDash = {
  role: "teacher";
  stats: {
    classes: number;
    students: number;
    pendingGrading: number;
    assignments: number;
    quizzes: number;
    markedToday: number;
    absentToday: number;
  };
  toGrade: {
    id: number;
    studentName: string;
    studentAvatar?: string | null;
    studentColor?: string;
    assignmentTitle: string;
    assignmentId: number;
    submittedAt: string;
    status: string;
  }[];
  quizzes: {
    id: number;
    title: string;
    startsAt: string;
    endsAt: string;
    className: string;
    subjectName: string;
    attempts: number;
  }[];
  announcements: Announcement[];
  classes: { id: number; name: string }[];
};

type AdminDash = {
  role: "admin";
  stats: {
    users: number;
    students: number;
    teachers: number;
    admins: number;
    activeUsers: number;
    classes: number;
    subjects: number;
    assignments: number;
    quizzes: number;
    messages: number;
    submissions: number;
    attendanceRate: number;
    absentRecent: number;
    messagesToday: number;
  };
  classesOverview: {
    id: number;
    name: string;
    grade: number;
    field: string;
    room: string | null;
    students: number;
    teacherCount: number;
    homeroom: string | null;
  }[];
  announcements: Announcement[];
};

type DashData = StudentDash | TeacherDash | AdminDash;

export default function Dashboard({
  user,
  onNavigate,
}: {
  user: Me;
  onNavigate: (tab: string) => void;
}) {
  const { data, loading, error } = useApi<DashData>("/api/dashboard");
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "صبح بخیر" : hour < 17 ? "وقت بخیر" : hour < 20 ? "عصر بخیر" : "شب بخیر";

  return (
    <div>
      <div className="card mb-5 flex flex-wrap items-center gap-4 overflow-hidden bg-gradient-to-l from-indigo-600 to-violet-600 p-5 text-white ring-0 sm:p-6">
        <Avatar name={user.fullName} color="#ffffff33" src={user.avatarUrl} size={52} ring />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-indigo-100/90">{greeting}</p>
          <h1 className="mt-0.5 truncate text-lg font-extrabold sm:text-xl">{user.fullName}</h1>
          <p className="mt-1 text-[11px] text-indigo-100/80">
            {user.bio ?? "به سامانه‌ی هَمدِل خوش آمدید"}
          </p>
        </div>
        <div className="rounded-2xl bg-white/15 px-4 py-2.5 text-center backdrop-blur">
          <p className="text-[10px] text-indigo-100/90">امروز</p>
          <p className="mt-0.5 text-xs font-bold">{jalaliDate(new Date())}</p>
        </div>
      </div>

      {loading && !data && <LoadingBlock rows={4} />}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-600 ring-1 ring-rose-200">
          <TriangleAlert className="size-4" /> {error}
        </div>
      )}

      {data?.role === "student" && <StudentView data={data} onNavigate={onNavigate} />}
      {data?.role === "teacher" && <TeacherView data={data} onNavigate={onNavigate} />}
      {data?.role === "admin" && <AdminView data={data} onNavigate={onNavigate} />}
    </div>
  );
}

/* -------------------------------- دانش‌آموز ------------------------------- */

function StudentView({
  data,
  onNavigate,
}: {
  data: StudentDash;
  onNavigate: (tab: string) => void;
}) {
  const { stats, assignments, quizzes, announcements } = data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<BookOpenCheck className="size-5" />}
          label="معدل تکالیف"
          value={stats.average.toFixed(1)}
          hint={`${fa(stats.gradedCount)} تکلیف تصحیح‌شده`}
          tone="indigo"
        />
        <StatCard
          icon={<FileCheck2 className="size-5" />}
          label="میانگین آزمون‌ها"
          value={`${Math.round(stats.quizPercent)}٪`}
          hint={`${fa(stats.quizzesTaken)} آزمون داده‌شده`}
          tone="violet"
        />
        <StatCard
          icon={<CalendarCheck2 className="size-5" />}
          label="درصد حضور"
          value={`${Math.round(stats.attendanceRate)}٪`}
          hint={`${fa(stats.absentCount)} غیبت · ${fa(stats.lateCount)} تأخیر`}
          tone={stats.attendanceRate >= 90 ? "emerald" : "amber"}
        />
        <StatCard
          icon={<ClipboardList className="size-5" />}
          label="تکلیف باقی‌مانده"
          value={stats.pendingAssignments}
          hint="تا مهلت ارسال"
          tone={stats.pendingAssignments > 0 ? "rose" : "slate"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <SectionTitle
            icon={<FileCheck2 className="size-4" />}
            title="آزمون‌های پیش‌رو"
            action={
              <button
                type="button"
                onClick={() => onNavigate("quizzes")}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600"
              >
                همه <ArrowLeft className="size-3" />
              </button>
            }
          />
          {quizzes.length === 0 ? (
            <EmptyState
              icon={<FileCheck2 className="size-5" />}
              title="آزمونی در پیش نیست"
              description="به‌محض انتشار آزمون جدید، همین‌جا نمایش داده می‌شود."
            />
          ) : (
            <ul className="space-y-2">
              {quizzes.map((quiz) => {
                const started = !isPast(quiz.startsAt);
                return (
                  <li
                    key={quiz.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-indigo-100 hover:bg-indigo-50/30"
                  >
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-xl text-xs font-black text-white"
                      style={{ backgroundColor: quiz.subjectColor }}
                    >
                      {quiz.subjectName.slice(0, 1)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-800">{quiz.title}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {fa(quiz.durationMinutes)} دقیقه · {started ? "شروع" : "پایان"}{" "}
                        {timeAgo(started ? quiz.startsAt : quiz.endsAt)}
                      </p>
                    </div>
                    {quiz.attemptStatus === "submitted" ? (
                      <Badge tone="emerald">
                        <CheckCircle2 className="size-3" /> {fa(Number(quiz.score ?? 0))}
                      </Badge>
                    ) : started ? (
                      <Badge tone="amber">
                        <Clock3 className="size-3" /> به‌زودی
                      </Badge>
                    ) : (
                      <Badge tone="indigo">فعال</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <SectionTitle
            icon={<ClipboardList className="size-4" />}
            title="تکالیف اخیر"
            action={
              <button
                type="button"
                onClick={() => onNavigate("assignments")}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600"
              >
                همه <ArrowLeft className="size-3" />
              </button>
            }
          />
          {assignments.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="size-5" />}
              title="تکلیفی ثبت نشده است"
              description="تکالیف جدید کلاس شما اینجا نمایش داده می‌شود."
            />
          ) : (
            <ul className="space-y-2">
              {assignments.map((a) => {
                const overdue = isPast(a.dueAt) && !a.submissionId;
                return (
                  <li key={a.id} className="rounded-xl border border-slate-100 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-800">{a.title}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {a.subjectName} · مهلت {jalaliDate(a.dueAt)}
                        </p>
                      </div>
                      {a.submissionStatus === "graded" ? (
                        <Badge tone="emerald">
                          {fa(Number(a.score ?? 0).toFixed(1))} از ۲۰
                        </Badge>
                      ) : a.submissionId ? (
                        <Badge tone="sky">{statusLabel[a.submissionStatus ?? ""] ?? "ارسال‌شده"}</Badge>
                      ) : overdue ? (
                        <Badge tone="rose">مهلت گذشته</Badge>
                      ) : (
                        <Badge tone="amber">{deadlineLabel(a.dueAt)}</Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <AnnouncementList items={announcements} onMore={() => onNavigate("announcements")} />
    </div>
  );
}

/* --------------------------------- دبیر --------------------------------- */

function TeacherView({ data, onNavigate }: { data: TeacherDash; onNavigate: (tab: string) => void }) {
  const { stats, toGrade, quizzes, announcements } = data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<School className="size-5" />}
          label="کلاس‌های من"
          value={stats.classes}
          hint={`${fa(stats.students)} دانش‌آموز`}
          tone="indigo"
        />
        <StatCard
          icon={<ClipboardList className="size-5" />}
          label="در انتظار تصحیح"
          value={stats.pendingGrading}
          hint={`از ${fa(stats.assignments)} تکلیف`}
          tone={stats.pendingGrading ? "amber" : "emerald"}
        />
        <StatCard
          icon={<FileCheck2 className="size-5" />}
          label="آزمون‌های من"
          value={stats.quizzes}
          hint="آزمون‌های آنلاین ثبت‌شده"
          tone="violet"
        />
        <StatCard
          icon={<CalendarCheck2 className="size-5" />}
          label="غیبت امروز"
          value={stats.absentToday}
          hint={`${fa(stats.markedToday)} حضور ثبت‌شده`}
          tone={stats.absentToday ? "rose" : "emerald"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <SectionTitle
            icon={<ClipboardList className="size-4" />}
            title="پاسخ‌های نیازمند تصحیح"
            action={
              <button
                type="button"
                onClick={() => onNavigate("assignments")}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600"
              >
                تکالیف <ArrowLeft className="size-3" />
              </button>
            }
          />
          {toGrade.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 className="size-5" />}
              title="همه‌چیز تصحیح شده است"
              description="پاسخ جدیدی در انتظار نمره‌دهی نیست."
            />
          ) : (
            <ul className="space-y-2">
              {toGrade.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <Avatar
                    name={item.studentName}
                    size={34}
                    color={item.studentColor ?? "#818cf8"}
                    src={item.studentAvatar}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800">{item.studentName}</p>
                    <p className="truncate text-[10px] text-slate-500">{item.assignmentTitle}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-slate-400">
                    {timeAgo(item.submittedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-4">
          <SectionTitle
            icon={<FileCheck2 className="size-4" />}
            title="آزمون‌های اخیر"
            action={
              <button
                type="button"
                onClick={() => onNavigate("quizzes")}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600"
              >
                همه <ArrowLeft className="size-3" />
              </button>
            }
          />
          {quizzes.length === 0 ? (
            <EmptyState
              icon={<FileCheck2 className="size-5" />}
              title="آزمونی ثبت نکرده‌اید"
              description="می‌توانید از بخش آزمون‌ها آزمون جدید بسازید."
            />
          ) : (
            <ul className="space-y-2">
              {quizzes.map((quiz) => (
                <li
                  key={quiz.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800">{quiz.title}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {quiz.className} · {jalaliDate(quiz.startsAt)}
                    </p>
                  </div>
                  <Badge tone={isPast(quiz.endsAt) ? "slate" : "indigo"}>
                    {fa(quiz.attempts)} شرکت‌کننده
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <AnnouncementList items={announcements} onMore={() => onNavigate("announcements")} />
    </div>
  );
}

/* --------------------------------- مدیر --------------------------------- */

function AdminView({ data, onNavigate }: { data: AdminDash; onNavigate: (tab: string) => void }) {
  const { stats, classesOverview, announcements } = data;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Users className="size-5" />}
          label="کاربران سامانه"
          value={stats.users}
          hint={`${fa(stats.students)} دانش‌آموز · ${fa(stats.teachers)} دبیر`}
          tone="indigo"
        />
        <StatCard
          icon={<CalendarCheck2 className="size-5" />}
          label="حضور ۱۴ روز"
          value={`${Math.round(stats.attendanceRate)}٪`}
          hint={`${fa(stats.absentRecent)} غیبت ثبت‌شده`}
          tone={stats.attendanceRate >= 90 ? "emerald" : "amber"}
        />
        <StatCard
          icon={<MessageSquareText className="size-5" />}
          label="پیام‌های امروز"
          value={stats.messagesToday}
          hint={`${fa(stats.messages)} پیام در کل`}
          tone="sky"
        />
        <StatCard
          icon={<FileCheck2 className="size-5" />}
          label="آزمون و تکلیف"
          value={stats.assignments + stats.quizzes}
          hint={`${fa(stats.submissions)} پاسخ ثبت‌شده`}
          tone="violet"
        />
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <School className="size-4 text-indigo-500" />
            <h3 className="text-sm font-extrabold text-slate-800">وضعیت کلاس‌ها</h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("admin")}
            className="flex items-center gap-1 text-[11px] font-bold text-indigo-600"
          >
            مدیریت <ArrowLeft className="size-3" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-right text-xs">
            <thead className="bg-slate-50/80 text-[11px] text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">کلاس</th>
                <th className="px-4 py-2.5 font-semibold">پایه</th>
                <th className="px-4 py-2.5 font-semibold">دانش‌آموز</th>
                <th className="px-4 py-2.5 font-semibold">دبیران</th>
                <th className="px-4 py-2.5 font-semibold">مربی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {classesOverview.map((cls) => (
                <tr key={cls.id} className="transition hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-bold text-slate-800">{cls.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fa(cls.grade)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fa(cls.students)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fa(cls.teacherCount)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{cls.homeroom ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 border-t border-slate-100 p-4 sm:grid-cols-3">
          <MiniStat label="درس‌های فعال" value={stats.subjects} />
          <MiniStat label="کاربران فعال" value={stats.activeUsers} />
          <MiniStat label="مدیران" value={stats.admins} />
        </div>
      </section>

      <section className="card p-4">
        <div className="mb-3 flex items-center gap-2">
          <GraduationCap className="size-4 text-indigo-500" />
          <h3 className="text-sm font-extrabold text-slate-800">نرخ حضور کل مدرسه</h3>
          <span className="mr-auto text-[11px] font-bold text-slate-500">
            {fa(Math.round(stats.attendanceRate))}٪
          </span>
        </div>
        <Progress value={stats.attendanceRate} tone={stats.attendanceRate >= 90 ? "emerald" : "amber"} />
        <p className="mt-2 text-[11px] text-slate-500">
          بر پایه‌ی {fa(stats.absentRecent)} غیبت ثبت‌شده در دو هفته‌ی گذشته.
        </p>
      </section>

      <AnnouncementList items={announcements} onMore={() => onNavigate("announcements")} />
    </div>
  );
}

/* ------------------------------- بخش‌های مشترک ---------------------------- */

function SectionTitle({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="grid size-7 place-items-center rounded-lg bg-indigo-50 text-indigo-500">
        {icon}
      </span>
      <h3 className="text-sm font-extrabold text-slate-800">{title}</h3>
      <span className="mr-auto">{action}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-base font-extrabold text-slate-800">{fa(value)}</p>
    </div>
  );
}

function AnnouncementList({ items, onMore }: { items: Announcement[]; onMore: () => void }) {
  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-amber-50 text-amber-500">
          <Megaphone className="size-4" />
        </span>
        <h3 className="text-sm font-extrabold text-slate-800">آخرین اطلاعیه‌ها</h3>
        <button
          type="button"
          onClick={onMore}
          className="mr-auto flex items-center gap-1 text-[11px] font-bold text-indigo-600"
        >
          همه <ArrowLeft className="size-3" />
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState icon={<Megaphone className="size-5" />} title="اطلاعیه‌ای وجود ندارد" />
      ) : (
        <ul className="grid gap-2 md:grid-cols-2">
          {items.map((a) => (
            <li key={a.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-start gap-2">
                {a.isPinned && <Pin className="mt-0.5 size-3.5 shrink-0 text-amber-500" />}
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-800">{a.title}</p>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">{a.body}</p>
                  {a.imageUrl && (
                    <div className="mt-2">
                      <ImageAttachment src={a.imageUrl} alt={a.title} className="max-h-40" />
                    </div>
                  )}
                  <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Avatar
                      name={a.authorName}
                      color={a.authorColor ?? "#6366f1"}
                      src={a.authorAvatar}
                      size={16}
                    />
                    {a.authorName} · {timeAgo(a.createdAt)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
