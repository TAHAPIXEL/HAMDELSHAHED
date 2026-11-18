"use client";

import { useState } from "react";
import {
  Users,
  ClipboardList,
  ChevronLeft,
  GraduationCap,
  Search,
  BookOpen,
  MessageSquareText,
  Megaphone,
  Lock,
  CalendarDays,
  CircleCheckBig,
  RotateCcw,
} from "lucide-react";
import {
  DB,
  GRADES,
  SECTIONS,
  className,
  fa,
  isStaff,
  userChats,
  type Grade,
  type User,
} from "@/lib/model";
import { Avatar, Chip, Empty, inputCls, useDbTick } from "./ui";

const gradeGrad: Record<number, string> = {
  7: "from-indigo-500 to-violet-500",
  8: "from-emerald-500 to-teal-500",
  9: "from-amber-500 to-orange-500",
};

type Tab = "groups" | "members" | "exams" | "homework";

export default function Classes({
  user,
  selected,
  onSelect,
  onOpenChat,
}: {
  user: User;
  selected: { grade: Grade; section: string } | null;
  onSelect: (v: { grade: Grade; section: string } | null) => void;
  onOpenChat: (chatId: string) => void;
}) {
  useDbTick();
  const staff = isStaff(user);
  const [tab, setTab] = useState<Tab>(staff ? "members" : "groups");
  const [q, setQ] = useState("");

  // دانش‌آموز فقط کلاس خودش را می‌بیند
  const visibleClasses: { grade: Grade; section: string }[] = staff
    ? GRADES.flatMap((g) => SECTIONS[g].map((s) => ({ grade: g, section: s })))
    : user.grade && user.section
    ? [{ grade: user.grade, section: user.section }]
    : [];

  // اگر دانش‌آموز سعی کند کلاس دیگری را ببیند، به کلاس خودش هدایت می‌شود
  const allowed =
    !selected ||
    staff ||
    (selected.grade === user.grade && selected.section === user.section);
  const active = allowed ? selected : null;

  if (!active) {
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-4xl">
          {!staff && (
            <div className="anim-fade-up mb-4 rounded-2xl bg-indigo-50/80 px-4 py-3 text-[12.5px] font-semibold leading-6 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
              کلاس شما در زیر نمایش داده شده است؛ با انتخاب آن، گروه‌ها، آزمون‌ها و تکالیف کلاس را می‌بینید.
            </div>
          )}
          <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleClasses.map(({ grade: g, section: s }) => {
              const members = DB.users().filter((u) => u.role === "student" && u.grade === g && u.section === s).length;
              const exams = DB.exams().filter((e) => e.grade === g && e.section === s).length;
              const hws = DB.homeworks().filter((h) => h.grade === g && h.section === s).length;
              return (
                <button
                  key={`${g}-${s}`}
                  onClick={() => { onSelect({ grade: g, section: s }); setTab(staff ? "members" : "groups"); }}
                  className="card group relative overflow-hidden p-5 text-right transition hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-900/10"
                >
                  <div className={`absolute -left-8 -top-8 size-28 rounded-full bg-gradient-to-br opacity-[0.08] transition group-hover:scale-125 ${gradeGrad[g]}`} />
                  <div className={`mb-4 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${gradeGrad[g]}`}>
                    <GraduationCap className="size-6" />
                  </div>
                  <div className="text-base font-black text-slate-800 dark:text-slate-100">کلاس {className(g, s)}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] font-semibold text-slate-400">
                    {staff && <span className="flex items-center gap-1"><Users className="size-3.5" /> {fa(members)} دانش‌آموز</span>}
                    <span className="flex items-center gap-1"><ClipboardList className="size-3.5" /> {fa(exams)} آزمون</span>
                    <span className="flex items-center gap-1"><BookOpen className="size-3.5" /> {fa(hws)} تکلیف</span>
                  </div>
                </button>
              );
            })}
            {visibleClasses.length === 0 && (
              <Empty icon={<GraduationCap className="size-7" />} title="کلاسی برای نمایش نیست" />
            )}
          </div>
        </div>
      </div>
    );
  }

  const { grade, section } = active;
  const members = DB.users()
    .filter((u) => u.role === "student" && u.grade === grade && u.section === section)
    .filter((u) => `${u.firstName} ${u.lastName}`.includes(q.trim()));
  const memberCount = DB.users().filter((u) => u.role === "student" && u.grade === grade && u.section === section).length;
  const exams = DB.exams()
    .filter((e) => e.grade === grade && e.section === section)
    .filter((e) => (staff ? true : e.status !== "draft"));
  const homeworks = DB.homeworks().filter((h) => h.grade === grade && h.section === section);
  // گروه‌ها و کانال‌های خود دانش‌آموز
  const myChats = userChats(user).filter((c) => c.type !== "direct");

  const tabs: { v: Tab; label: string; icon: React.ReactNode; show: boolean }[] = [
    { v: "groups", label: "گروه‌های من", icon: <MessageSquareText className="size-4" />, show: !staff },
    { v: "members", label: "دانش‌آموزان", icon: <Users className="size-4" />, show: staff },
    { v: "exams", label: "آزمون‌ها", icon: <ClipboardList className="size-4" />, show: true },
    { v: "homework", label: "تکالیف", icon: <BookOpen className="size-4" />, show: true },
  ];
  const visibleTabs = tabs.filter((t) => t.show);
  const activeTab = visibleTabs.some((t) => t.v === tab) ? tab : visibleTabs[0].v;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        {/* سربرگ کلاس */}
        <div className={`anim-fade-up relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-l p-6 text-white shadow-xl ${gradeGrad[grade]}`}>
          <div className="absolute -left-10 -top-10 size-44 rounded-full bg-white/10 blur-xl" />
          <div className="absolute -bottom-14 right-1/3 size-44 rounded-full bg-white/10 blur-xl" />
          {(staff || visibleClasses.length > 1) && (
            <button onClick={() => onSelect(null)} className="relative mb-3 flex items-center gap-1 text-[12px] font-bold text-white/80 transition hover:text-white">
              <ChevronLeft className="size-4 rotate-180" />
              همه کلاس‌ها
            </button>
          )}
          <div className="relative text-2xl font-black">کلاس {className(grade, section)}</div>
          <div className="relative mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-bold text-white/85">
            {staff && <span>{fa(memberCount)} دانش‌آموز</span>}
            <span>{fa(exams.length)} آزمون</span>
            <span>{fa(homeworks.length)} تکلیف</span>
          </div>
        </div>

        {/* تب‌ها */}
        <div className="mb-5 flex gap-1.5 rounded-2xl bg-slate-100 p-1.5 dark:bg-white/5">
          {visibleTabs.map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[12.5px] font-bold transition ${
                activeTab === t.v ? "bg-white text-indigo-700 shadow-sm dark:bg-white/15 dark:text-indigo-200" : "text-slate-500"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* گروه‌های دانش‌آموز */}
        {activeTab === "groups" && (
          <div className="stagger space-y-3">
            {myChats.length === 0 && (
              <Empty
                icon={<MessageSquareText className="size-7" />}
                title="هنوز عضو گروهی نیستید"
                desc="وقتی کادر مدرسه شما را عضو گروه یا کانالی کنند، اینجا نمایش داده می‌شود"
              />
            )}
            {myChats.map((c) => (
              <div key={c.id} className="card flex items-center gap-3.5 p-4 transition hover:shadow-lg hover:shadow-indigo-900/5">
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow ${c.type === "channel" ? "bg-gradient-to-br from-amber-500 to-orange-500" : "bg-gradient-to-br from-emerald-500 to-teal-500"}`}>
                  {c.type === "channel" ? <Megaphone className="size-5" /> : <Users className="size-5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-black text-slate-800 dark:text-slate-100">
                    <span className="truncate">{c.title}</span>
                    {c.locked && c.type === "group" && <Lock className="size-3.5 shrink-0 text-amber-500" />}
                  </div>
                  <div className="mt-0.5 text-[11.5px] font-semibold text-slate-400">
                    {c.type === "channel" ? "کانال" : "گروه"} • {fa(c.memberIds.length)} عضو
                  </div>
                </div>
                <button
                  onClick={() => onOpenChat(c.id)}
                  className="flex items-center gap-1 rounded-xl bg-indigo-50 px-3.5 py-2 text-[12px] font-black text-indigo-700 transition hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20"
                >
                  ورود
                  <ChevronLeft className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* دانش‌آموزان — فقط کادر */}
        {activeTab === "members" && staff && (
          <div>
            <div className="relative mb-4">
              <Search className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input className={`${inputCls} pr-10`} placeholder="جست‌وجوی دانش‌آموز..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {members.length === 0 ? (
              <Empty icon={<Users className="size-7" />} title="دانش‌آموزی نیست" desc="وقتی دانش‌آموزان این کلاس ثبت‌نام کنند، اینجا نمایش داده می‌شوند" />
            ) : (
              <div className="stagger grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {members.map((m) => (
                  <div key={m.id} className="card flex items-center gap-3 p-3.5">
                    <Avatar user={m} size={42} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13.5px] font-black text-slate-800 dark:text-slate-100">{m.firstName} {m.lastName}</div>
                      <div className="text-[11px] font-semibold text-slate-400" dir="ltr">{m.phone}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* آزمون‌ها */}
        {activeTab === "exams" && (
          <div className="stagger space-y-3">
            {exams.length === 0 && (
              <Empty icon={<ClipboardList className="size-7" />} title="آزمونی نیست" desc={staff ? "از بخش آزمون‌ها برای این کلاس آزمون بسازید" : "وقتی دبیران آزمون بسازند، اینجا می‌آید"} />
            )}
            {exams.map((e) => (
              <div key={e.id} className="card flex items-center gap-3.5 p-4">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 text-white shadow">
                  <ClipboardList className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-black text-slate-800 dark:text-slate-100">{e.title}</div>
                  <div className="mt-0.5 text-[11.5px] font-semibold text-slate-400">
                    {fa(e.questions.length)} سؤال • {fa(e.durationMin)} دقیقه
                  </div>
                </div>
                {e.status === "published" ? <Chip tone="green">فعال</Chip> : e.status === "draft" ? <Chip tone="amber">پیش‌نویس</Chip> : <Chip>پایان‌یافته</Chip>}
              </div>
            ))}
          </div>
        )}

        {/* تکالیف */}
        {activeTab === "homework" && (
          <div className="stagger space-y-3">
            {homeworks.length === 0 && (
              <Empty icon={<BookOpen className="size-7" />} title="تکلیفی نیست" desc={staff ? "از بخش تکالیف برای این کلاس تکلیف تعیین کنید" : "وقتی دبیران تکلیف بدهند، اینجا می‌آید"} />
            )}
            {homeworks.map((h) => {
              const sub = !staff ? DB.hwsubs().find((s) => s.homeworkId === h.id && s.studentId === user.id) : undefined;
              const subCount = DB.hwsubs().filter((s) => s.homeworkId === h.id).length;
              return (
                <div key={h.id} className="card p-4">
                  <div className="flex items-center gap-3.5">
                    <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow ${h.closed ? "bg-gradient-to-br from-slate-400 to-slate-500" : "bg-gradient-to-br from-teal-500 to-emerald-600"}`}>
                      <BookOpen className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black text-slate-800 dark:text-slate-100">{h.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] font-semibold text-slate-400">
                        {h.due && (
                          <span className="flex items-center gap-1">
                            <CalendarDays className="size-3" />
                            موعد: {fa(h.due)}
                          </span>
                        )}
                        {staff && <span>{fa(subCount)} تحویل</span>}
                      </div>
                    </div>
                    {h.closed ? <Chip>بسته</Chip> : <Chip tone="green">باز</Chip>}
                  </div>
                  {h.description && <p className="mt-2.5 whitespace-pre-wrap text-[12.5px] leading-7 text-slate-500 dark:text-slate-400">{h.description}</p>}
                  {sub && (
                    <div className="mt-2.5">
                      {sub.status === "approved" ? (
                        <Chip tone="green"><CircleCheckBig className="size-3.5" /> تأیید شد</Chip>
                      ) : sub.status === "returned" ? (
                        <Chip tone="red"><RotateCcw className="size-3.5" /> برگشت برای اصلاح</Chip>
                      ) : (
                        <Chip tone="amber">تحویل شد — در انتظار بررسی</Chip>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
