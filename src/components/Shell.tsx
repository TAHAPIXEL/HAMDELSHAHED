"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessagesSquare,
  LayoutGrid,
  ClipboardList,
  CalendarCheck2,
  Bell,
  ShieldHalf,
  LogOut,
  Menu,
  X,
  GraduationCap,
  Megaphone,
  ChevronLeft,
  BookOpen,
} from "lucide-react";
import {
  DB,
  GRADES,
  SECTIONS,
  canAdminPanel,
  className,
  currentUser,
  fa,
  faDateShort,
  faTime,
  isStaff,
  readNoticeKey,
  recordNoticeRead,
  roleFa,
  unreadNotices,
  visibleNotices,
  type Grade,
  type User,
} from "@/lib/model";
import { Avatar, useDbTick } from "./ui";
import Chats from "./Chats";
import Classes from "./Classes";
import Exams from "./Exams";
import Attendance from "./Attendance";
import Notices from "./Notices";
import Admin from "./Admin";
import Profile from "./Profile";
import Homework from "./Homework";

export type View = "chats" | "classes" | "homework" | "exams" | "attendance" | "notices" | "admin" | "profile";

const titles: Record<View, string> = {
  chats: "گفتگوها",
  classes: "کلاس‌ها",
  homework: "تکالیف و تمرین‌ها",
  exams: "آزمون‌ها",
  attendance: "حضور و غیاب",
  notices: "اطلاعیه‌ها",
  admin: "پنل مدیریت",
  profile: "پروفایل من",
};

export default function Shell({ user: initialUser, onLogout }: { user: User; onLogout: () => void }) {
  useDbTick();
  const user = currentUser() ?? initialUser;
  const [view, setView] = useState<View>("chats");
  const [classSel, setClassSel] = useState<{ grade: Grade; section: string } | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [openChatId, setOpenChatId] = useState<string | null>(null);

  // دکمه‌ی فعال نوار پایین موبایل همیشه کامل دیده شود
  useEffect(() => {
    const active = tabsRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [view]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // بدون memo — همه رندرها تازه‌ترین داده (زنده بودن زنگوله اطلاعیه‌ها)
  const notices = visibleNotices(user);
  const unreadN = unreadNotices(user);

  const go = (v: View) => {
    setView(v);
    setDrawer(false);
    if (v !== "classes") setClassSel(null);
  };

  const openChatFromShell = (chatId: string) => {
    setOpenChatId(chatId);
    go("chats");
  };

  const nav: { v: View; label: string; icon: React.ReactNode; show: boolean }[] = [
    { v: "chats", label: "گفتگوها", icon: <MessagesSquare className="size-5" />, show: true },
    { v: "classes", label: "کلاس‌ها", icon: <LayoutGrid className="size-5" />, show: true },
    { v: "homework", label: "تکالیف", icon: <BookOpen className="size-5" />, show: true },
    { v: "exams", label: "آزمون‌ها", icon: <ClipboardList className="size-5" />, show: true },
    { v: "attendance", label: "حضور و غیاب", icon: <CalendarCheck2 className="size-5" />, show: true },
    { v: "notices", label: "اطلاعیه‌ها", icon: <Megaphone className="size-5" />, show: true },
    { v: "admin", label: "پنل مدیریت", icon: <ShieldHalf className="size-5" />, show: canAdminPanel(user) },
  ];

  const markNoticeRead = (nid: string) => recordNoticeRead(user.id, nid);

  const sidebar = (
    <div className="relative flex h-full flex-col overflow-hidden text-white ink-panel">
      <div className="ink-grid pointer-events-none absolute inset-0" />

      <div className="relative flex items-center gap-3 px-5 pb-6 pt-7">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-sky-500 shadow-[0_12px_28px_-10px_rgb(124_58_237/0.9)]">
          <GraduationCap className="size-6 text-white" />
        </div>
        <div>
          <div className="text-lg font-black tracking-tight text-white">هَمدِل</div>
          <div className="text-[11px] font-bold text-indigo-200/60">شاهد شهیدان فهیمی</div>
        </div>
      </div>

      <nav className="relative flex flex-col gap-1 px-3">
        {nav.filter((n) => n.show).map((n) => (
          <button
            key={n.v}
            onClick={() => go(n.v)}
            className={`relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
              view === n.v
                ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]"
                : "text-indigo-100/60 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            {view === n.v && (
              <span className="absolute inset-y-2.5 right-0 w-1 rounded-l-full bg-gradient-to-b from-sky-300 to-violet-400" />
            )}
            {n.icon}
            {n.label}
            {n.v === "notices" && unreadN > 0 && (
              <span className="mr-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
                {fa(unreadN)}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="relative mt-7 px-5 text-[11px] font-black tracking-wider text-indigo-200/50">
        {isStaff(user) ? "کلاس‌ها" : "کلاس من"}
      </div>
      <div className="relative mt-2 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {(isStaff(user)
          ? GRADES.flatMap((g) => SECTIONS[g].map((s) => ({ g, s })))
          : user.grade && user.section
          ? [{ g: user.grade, s: user.section }]
          : []
        ).map(({ g, s }) => (
          <button
            key={`${g}-${s}`}
            onClick={() => { setClassSel({ grade: g, section: s }); go("classes"); }}
            className={`flex w-full items-center justify-between rounded-xl px-4 py-2 text-[13px] font-bold transition ${
              view === "classes" && classSel?.grade === g && classSel?.section === s
                ? "bg-white/10 text-white"
                : "text-indigo-100/60 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            کلاس {className(g, s)}
            <ChevronLeft className="size-3.5 opacity-60" />
          </button>
        ))}
      </div>

      <div className="relative border-t border-white/10 p-3">
        <button
          onClick={() => go("profile")}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-white/[0.06]"
        >
          <Avatar user={user} size={38} ring />
          <div className="min-w-0 flex-1 text-right">
            <div className="truncate text-[13px] font-bold text-white">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-[11px] font-semibold text-indigo-200/60">{roleFa(user)}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onLogout(); }}
            className="rounded-xl p-2 text-indigo-200/60 transition hover:bg-rose-500/20 hover:text-rose-300"
            aria-label="خروج"
            title="خروج از حساب"
          >
            <LogOut className="size-4.5" />
          </button>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-[#f3f5fb] text-slate-900">
      {/* سایدبار دسکتاپ */}
      <aside className="hidden w-72 shrink-0 p-3 lg:block">
        <div className="h-full overflow-hidden rounded-[1.75rem] shadow-[0_24px_50px_-28px_rgb(11_15_36/0.7)]">
          {sidebar}
        </div>
      </aside>

      {/* دراور موبایل */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="modal-bg absolute inset-0 bg-[#0b0f24]/60" onClick={() => setDrawer(false)} />
          <aside className="modal-pop absolute right-0 top-0 h-full w-80 max-w-[85vw] shadow-2xl">
            <button
              onClick={() => setDrawer(false)}
              className="absolute left-3 top-5 z-10 rounded-xl p-2 text-indigo-200/70 hover:bg-white/10 hover:text-white"
              aria-label="بستن منو"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* بدنه */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* نوار بالا */}
        <header className="safe-t z-30 flex items-center gap-3 bg-white/95 px-4 py-3 shadow-[0_1px_0_rgb(18_24_40/0.06)] sm:px-6 lg:bg-transparent lg:pt-5 lg:shadow-none">
          <button
            onClick={() => setDrawer(true)}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition active:scale-95 lg:hidden"
            aria-label="منو"
          >
            <Menu className="size-5" />
          </button>
          <h1 className="min-w-0 truncate text-[17px] font-black tracking-tight text-slate-800 lg:text-2xl">
            {view === "classes" && classSel ? `کلاس ${className(classSel.grade, classSel.section)}` : titles[view]}
          </h1>
          <div className="mr-auto flex shrink-0 items-center gap-2">
            {/* زنگوله اطلاعیه‌ها */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setBellOpen((o) => !o)}
                className="relative flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 active:scale-95 lg:bg-white lg:shadow-[0_1px_2px_rgb(18_24_40/0.06)]"
                aria-label="اطلاعیه‌ها"
              >
                <Bell className="size-5" />
                {unreadN > 0 && (
                  <span className="bell-dot absolute left-2 top-2 flex size-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
                )}
              </button>
              {bellOpen && (
                <div className="anim-pop absolute left-0 top-12 z-40 w-80 max-w-[86vw] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_50px_-16px_rgb(11_15_36/0.35)]">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <span className="text-sm font-black">اطلاعیه‌ها</span>
                    {unreadN > 0 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">{fa(unreadN)} خوانده‌نشده</span>}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notices.length === 0 && (
                      <div className="px-4 py-10 text-center text-[13px] font-semibold text-slate-400">اطلاعیه‌ای وجود ندارد</div>
                    )}
                    {notices.slice(0, 8).map((n) => {
                      const read = !!DB.noticeReads()[readNoticeKey(user.id, n.id)];
                      return (
                        <button
                          key={n.id}
                          onClick={() => { markNoticeRead(n.id); setBellOpen(false); go("notices"); }}
                          className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-right transition hover:bg-slate-50"
                        >
                          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${read ? "bg-slate-200" : "bg-rose-500"}`} />
                          <span className="min-w-0">
                            <span className={`block truncate text-[13px] font-bold ${read ? "text-slate-500" : "text-slate-800"}`}>
                              {n.title}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-semibold text-slate-400">
                              {faDateShort(n.createdAt)} • {faTime(n.createdAt)}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <button onClick={() => { setBellOpen(false); go("notices"); }} className="w-full bg-slate-50 py-2.5 text-center text-[12px] font-black text-indigo-600 transition hover:bg-slate-100">
                    مشاهده همه
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => go("profile")} className="rounded-full transition active:scale-95" aria-label="پروفایل">
              <Avatar user={user} size={40} ring />
            </button>
          </div>
        </header>

        {/* محتوای ویو */}
        <main className="min-h-0 flex-1 overflow-hidden lg:px-5 lg:pb-5 lg:pt-3">
          {view === "chats" && <Chats user={user} externalChatId={openChatId} onConsumeExternal={() => setOpenChatId(null)} />}
          {view === "classes" && (
            <Classes user={user} selected={classSel} onSelect={setClassSel} onOpenChat={openChatFromShell} />
          )}
          {view === "homework" && <Homework user={user} />}
          {view === "exams" && <Exams user={user} />}
          {view === "attendance" && <Attendance user={user} />}
          {view === "notices" && <Notices user={user} />}
          {view === "admin" && <Admin user={user} />}
          {view === "profile" && <Profile user={user} onLogout={onLogout} onGo={go} />}
        </main>

        {/* ناوبری پایین موبایل: نوار افقی قابل اسکرول تا همه‌ی برچسب‌ها کامل دیده شوند */}
        <nav className="safe-b z-30 border-t border-slate-200/70 bg-white/95 lg:hidden">
          <div ref={tabsRef} className="flex gap-1.5 overflow-x-auto px-2.5 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {nav.filter((n) => n.show && ["chats", "classes", "homework", "exams", "attendance", "admin"].includes(n.v)).map((n) => (
              <button
                key={n.v}
                data-active={view === n.v}
                onClick={() => go(n.v)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-extrabold transition active:scale-95 ${
                  view === n.v ? "btn-brand text-white" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {n.icon}
                {n.label}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
