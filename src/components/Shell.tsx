"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  MessagesSquare,
  Search,
  LayoutGrid,
  ClipboardList,
  CalendarCheck2,
  Bell,
  ShieldHalf,
  LogOut,
  EllipsisVertical,
  X,
  GraduationCap,
  Megaphone,
  UserRound,
  ChevronLeft,
  BookOpen,
  Radio,
} from "lucide-react";
import {
  DB,
  GRADES,
  unreadCount,
  userChats,
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
import { Avatar, Confirm, useDbTick, useToast } from "./ui";
import { useThemeSync } from "./Appearance";
import Chats from "./Chats";
import Classes from "./Classes";
import Exams from "./Exams";
import Attendance from "./Attendance";
import { ClassroomPage } from "./Classroom";
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

// تاریخچه‌ی ناوبری فقط یک بار ساخته شود (در حالت توسعه effectها دوبار اجرا می‌شوند)
let navInit = false;

export default function Shell({ user: initialUser, onLogout }: { user: User; onLogout: () => void }) {
  useDbTick();
  useThemeSync();
  const user = currentUser() ?? initialUser;
  const [view, setView] = useState<View>("chats");
  // برچسب فعال نوار پایین فوری تغییر می‌کند؛ رندر صفحه‌ی سنگین در transition انجام می‌شود تا تپ آنی باشد
  const [tab, setTab] = useState<View>("chats");
  const [, startTransition] = useTransition();
  const [classSel, setClassSel] = useState<{ grade: Grade; section: string } | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [classroomOpen, setClassroomOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [logoutAsk, setLogoutAsk] = useState(false);
  const requestLogout = () => setLogoutAsk(true);

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

  // ---- تاریخچه‌ی ناوبری (دکمه‌ی بک) ----
  // هر بخش یا گفتگوی بازشده یک مرحله در تاریخچه است؛ بک فقط یک مرحله برمی‌گرداند.
  // در صفحه‌ی اصلی، بک اول پیام «دو بار کلیک کنید» را نشان می‌دهد و بک دوم از برنامه خارج می‌شود.
  type NavState = { v: View; c: string | null };
  const navRef = useRef<NavState>({ v: "chats", c: null });
  const lastRootBackRef = useRef(0);
  const [chatOpenId, setChatOpenId] = useState<string | null>(null);
  const [syncChat, setSyncChat] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });
  const [listScrolled, setListScrolled] = useState(false);
  const [searchSignal, setSearchSignal] = useState(0);
  const toast = useToast();
  const chatOpen = view === "chats" && chatOpenId !== null;

  const showView = (v: View) => {
    setTab(v);
    startTransition(() => setView(v));
    setDrawer(false);
    if (v !== "classes") setClassSel(null);
  };

  const applyNav = (next: NavState) => {
    navRef.current = next;
    setChatOpenId(next.c);
    setSyncChat((s) => ({ id: next.c, n: s.n + 1 }));
    showView(next.v);
  };

  // کلیدهای داخلی Next.js باید در هر ورودی تاریخچه کپی شوند، وگرنه روتر صفحه را دوباره بارگذاری می‌کند
  const nextMarks = () => {
    const s = (window.history.state ?? {}) as Record<string, unknown>;
    return { __NA: s.__NA, __PRIVATE_NEXTJS_INTERNALS_TREE: s.__PRIVATE_NEXTJS_INTERNALS_TREE };
  };

  const pushNav = (next: NavState) => {
    const cur = navRef.current;
    if (cur.v === next.v && cur.c === next.c) return;
    window.history.pushState({ ...nextMarks(), hamdel: next }, "");
    applyNav(next);
  };

  useEffect(() => {
    if (!navInit) {
      navInit = true;
      window.history.replaceState({ ...nextMarks(), hamdel: { root: true } }, "");
      window.history.pushState({ ...nextMarks(), hamdel: { v: "chats", c: null } }, "");
    }
    const onPop = (e: PopStateEvent) => {
      const st = (e.state?.hamdel ?? null) as (NavState & { root?: boolean }) | null;
      if (!st || st.root) {
        if (Date.now() - lastRootBackRef.current < 2000) {
          // دومین بک در صفحه‌ی اصلی: خروج از برنامه
          window.history.back();
          return;
        }
        lastRootBackRef.current = Date.now();
        toast("info", "برای خروج دو بار کلیک کنید");
        window.history.pushState({ ...nextMarks(), hamdel: { v: "chats", c: null } }, "");
        applyNav({ v: "chats", c: null });
        return;
      }
      applyNav({ v: st.v, c: st.c });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // گفتگو از داخل Chats باز یا بسته شد: همان را در تاریخچه ثبت می‌کنیم (بسته‌شدن = یک مرحله به عقب)
  const onChatChange = useCallback((id: string | null) => {
    if (id === navRef.current.c) return;
    if (id === null) window.history.back();
    else pushNav({ v: "chats", c: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (v: View) => {
    pushNav({ v, c: null });
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

  // ناوبری پایین موبایل: گفتگوها، کلاس‌ها، تکالیف، آزمون‌ها، پروفایل
  const unreadChatTotal = userChats(user).reduce((n, c) => n + unreadCount(user.id, c), 0);
  const bottomItems: { v: View; label: string; icon: React.ReactNode; badge: number }[] = [
    { v: "profile", label: "پروفایل", icon: <UserRound className="size-5" />, badge: 0 },
    { v: "classes", label: "کلاس‌ها", icon: <LayoutGrid className="size-5" />, badge: 0 },
    { v: "homework", label: "تکالیف", icon: <BookOpen className="size-5" />, badge: 0 },
    { v: "exams", label: "آزمون‌ها", icon: <ClipboardList className="size-5" />, badge: 0 },
    { v: "chats", label: "گفتگوها", icon: <MessagesSquare className="size-5" />, badge: unreadChatTotal },
  ];
  // امکانات داخل منوی سه‌نقطه (بیرون از ناوبری پایین)
  const menuFeatures = nav.filter((n) => n.show && ["attendance", "notices", "admin"].includes(n.v));
  const classItems = isStaff(user)
    ? GRADES.flatMap((g) => SECTIONS[g].map((s) => ({ g, s })))
    : user.grade && user.section
    ? [{ g: user.grade, s: user.section }]
    : [];

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 pb-6 pt-6">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-600/25">
          <GraduationCap className="size-6 text-white" />
        </div>
        <div>
          <div className="text-lg font-black text-slate-800 dark:text-white">هَمدِل</div>
          <div className="text-[11px] font-bold text-slate-400">شاهد شهیدان فهیمی</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {nav.filter((n) => n.show).map((n) => (
          <button
            key={n.v}
            onClick={() => go(n.v)}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
              view === n.v
                ? "bg-gradient-to-l from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/25"
                : "text-slate-500 hover:bg-surface-2 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
            }`}
          >
            {n.icon}
            {n.label}
            {n.v === "notices" && unreadN > 0 && (
              <span className={`mr-auto rounded-full px-2 py-0.5 text-[10px] font-black ${view === n.v ? "bg-surface/25 text-white" : "bg-rose-500 text-white"}`}>
                {fa(unreadN)}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="mt-6 px-5 text-[11px] font-black tracking-wide text-slate-400">
        {isStaff(user) ? "کلاس‌ها" : "کلاس من"}
      </div>
      <div className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
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
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                : "text-slate-500 hover:bg-surface-2 dark:text-slate-400 dark:hover:bg-white/5"
            }`}
          >
            کلاس {className(g, s)}
            <ChevronLeft className="size-3.5 opacity-60" />
          </button>
        ))}
      </div>

      <div className="border-t border-line p-3 dark:border-white/5">
        <button
          onClick={() => go("profile")}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-surface-2 dark:hover:bg-white/5"
        >
          <Avatar user={user} size={38} ring />
          <div className="min-w-0 flex-1 text-right">
            <div className="truncate text-[13px] font-bold text-slate-700 dark:text-slate-200">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-[11px] font-semibold text-slate-400">{roleFa(user)}</div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); requestLogout(); }}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
            aria-label="خروج"
            title="خروج از حساب"
          >
            <LogOut className="size-4.5" />
          </button>
        </button>
      </div>
    </div>
  );

  const drawerBody = (
    <div className="flex h-full flex-col">
      {/* بالاترین: پروفایل و خروج */}
      <div className="flex items-center gap-2 border-b border-line p-4 dark:border-white/5">
        <button
          onClick={() => go("profile")}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1.5 text-right transition hover:bg-surface-2 dark:hover:bg-white/5"
        >
          <Avatar user={user} size={44} ring />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black text-slate-800 dark:text-slate-100">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-[11px] font-semibold text-slate-400">پروفایل من • {roleFa(user)}</div>
          </div>
        </button>
        <button
          onClick={requestLogout}
          className="rounded-xl p-2.5 text-rose-500 transition hover:bg-rose-50 dark:hover:bg-rose-500/10"
          aria-label="خروج"
          title="خروج از حساب"
        >
          <LogOut className="size-5" />
        </button>
        <button
          onClick={() => setDrawer(false)}
          className="rounded-xl p-2.5 text-slate-400 transition hover:bg-surface-2 dark:hover:bg-white/10"
          aria-label="بستن منو"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* امکانات — قابل اسکرول */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-5 pb-2 pt-4 text-[11px] font-black tracking-wide text-slate-400">امکانات</div>
        <div className="max-h-[40%] shrink-0 space-y-1 overflow-y-auto px-3 pb-3">
          <button
            onClick={() => {
              setDrawer(false);
              setClassroomOpen(true);
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-surface-2 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <Radio className="size-5" />
            کلاس آنلاین
          </button>
          {menuFeatures.map((n) => (
            <button
              key={n.v}
              onClick={() => go(n.v)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${
                view === n.v
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                  : "text-slate-600 hover:bg-surface-2 dark:text-slate-300 dark:hover:bg-white/5"
              }`}
            >
              {n.icon}
              {n.label}
              {n.v === "notices" && unreadN > 0 && (
                <span className="mr-auto rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">{fa(unreadN)}</span>
              )}
            </button>
          ))}
        </div>

        {/* کلاس‌ها — قابل اسکرول */}
        <div className="px-5 pb-2 pt-3 text-[11px] font-black tracking-wide text-slate-400">
          {isStaff(user) ? "کلاس‌ها" : "کلاس من"}
        </div>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {classItems.map(({ g, s }) => (
            <button
              key={`d-${g}-${s}`}
              onClick={() => { setClassSel({ grade: g, section: s }); go("classes"); }}
              className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-[13px] font-bold transition ${
                view === "classes" && classSel?.grade === g && classSel?.section === s
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                  : "text-slate-500 hover:bg-surface-2 dark:text-slate-400 dark:hover:bg-white/5"
              }`}
            >
              کلاس {className(g, s)}
              <ChevronLeft className="size-3.5 opacity-60" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-app text-slate-900 dark:bg-scrim dark:text-slate-100">
      {/* سایدبار دسکتاپ */}
      <aside className="hidden w-72 shrink-0 border-l border-line/70 bg-surface/80 backdrop-blur-xl dark:border-white/5 dark:bg-ink/60 lg:block">
        {sidebar}
      </aside>

      {/* دراور موبایل */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="modal-bg absolute inset-0 bg-scrim/50 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className="modal-pop absolute right-0 top-0 h-full w-80 max-w-[85vw] border-l border-line bg-surface dark:border-white/10 dark:bg-ink">
            {drawerBody}
          </aside>
        </div>
      )}

      {/* بدنه */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* نوار بالا */}
        <header dir="ltr" className="z-30 flex items-center gap-3 border-b border-line/70 bg-surface/80 px-4 py-3 backdrop-blur-xl dark:border-white/5 dark:bg-ink/60 sm:px-6">
          {/* آواتار (پروفایل) */}
          <button onClick={() => go("profile")} className="shrink-0 transition active:scale-95" aria-label="پروفایل">
            <Avatar user={user} size={36} />
          </button>
          <h1 className="min-w-0 flex-1 truncate text-base font-black text-slate-800 dark:text-slate-100">
            {view === "classes" && classSel ? `کلاس ${className(classSel.grade, classSel.section)}` : titles[view]}
          </h1>
          <div className="flex items-center gap-1">
            {view === "chats" && listScrolled && !chatOpen && (
              <button
                onClick={() => setSearchSignal((n) => n + 1)}
                className="anim-pop rounded-xl p-2.5 text-slate-500 transition hover:bg-surface-2 dark:hover:bg-white/10"
                aria-label="جستجوی گفتگو"
              >
                <Search className="size-5" />
              </button>
            )}
            {/* زنگوله اطلاعیه‌ها */}
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => setBellOpen((o) => !o)}
                className="relative rounded-xl p-2.5 text-slate-500 transition hover:bg-surface-2 dark:hover:bg-white/10"
                aria-label="اطلاعیه‌ها"
              >
                <Bell className="size-5" />
                {unreadN > 0 && (
                  <span className="bell-dot absolute left-2 top-2 flex size-2.5 rounded-full bg-rose-500 ring-2 ring-surface dark:ring-slate-900" />
                )}
              </button>
              {bellOpen && (
                <div className="anim-pop absolute right-0 top-12 w-80 max-w-[86vw] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl dark:border-white/10 dark:bg-ink">
                  <div className="flex items-center justify-between border-b border-line px-4 py-3 dark:border-white/5">
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
                          className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-right transition hover:bg-app dark:border-white/5 dark:hover:bg-white/5"
                        >
                          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${read ? "bg-line dark:bg-white/15" : "bg-rose-500"}`} />
                          <span className="min-w-0">
                            <span className={`block truncate text-[13px] font-bold ${read ? "text-slate-500 dark:text-slate-400" : "text-slate-800 dark:text-slate-100"}`}>
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
                  <button onClick={() => { setBellOpen(false); go("notices"); }} className="w-full bg-app py-2.5 text-center text-[12px] font-black text-indigo-600 transition hover:bg-surface-2 dark:bg-white/5 dark:text-indigo-300 dark:hover:bg-white/10">
                    مشاهده همه
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => setDrawer(true)} className="rounded-xl p-2 text-slate-500 hover:bg-surface-2 dark:hover:bg-white/10 lg:hidden" aria-label="منو">
              <EllipsisVertical className="size-5" />
            </button>
          </div>
        </header>

        {/* محتوای ویو */}
        <main className={`min-h-0 flex-1 overflow-hidden ${chatOpen ? "" : "pb-24"} lg:pb-0`}>
          {view === "chats" && (
            <Chats
              user={user}
              externalChatId={openChatId}
              onConsumeExternal={() => setOpenChatId(null)}
              onChatChange={onChatChange}
              syncChat={syncChat}
              onListScroll={setListScrolled}
              searchSignal={searchSignal}
            />
          )}
          {view === "classes" && (
            <Classes user={user} selected={classSel} onSelect={setClassSel} onOpenChat={openChatFromShell} />
          )}
          {view === "homework" && <Homework user={user} />}
          {view === "exams" && <Exams user={user} />}
          {view === "attendance" && <Attendance user={user} />}
          {view === "notices" && <Notices user={user} />}
          {view === "admin" && <Admin user={user} />}
          {view === "profile" && <Profile user={user} onLogout={requestLogout} onGo={go} />}
        </main>

        <ClassroomPage open={classroomOpen} onClose={() => setClassroomOpen(false)} user={user} />

        {/* ناوبری پایین موبایل — کپسول شناور تیره با سایه، بدون نوار یا رنگ زیر آن؛ هنگام باز بودن گفتگو پنهان می‌شود */}
        {!chatOpen && (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 lg:hidden">
            <nav
              dir="ltr"
              className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-1 rounded-full bg-nav p-1.5 shadow-[0_8px_28px_rgba(15,23,42,0.22)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.55)]"
            >
              {bottomItems.map((n) => {
                const on = tab === n.v;
                return (
                  <button
                    key={n.v}
                    onClick={() => go(n.v)}
                    aria-current={on ? "page" : undefined}
                    className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-2 text-[11px] font-bold transition-colors duration-200 active:scale-95 ${
                      on ? "bg-accent/15 text-accent" : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <span className="relative">
                      {n.icon}
                      {n.badge > 0 && (
                        <span className="absolute -right-2.5 -top-1.5 flex min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-black leading-[18px] text-white">
                          {fa(n.badge)}
                        </span>
                      )}
                    </span>
                    <span className="truncate">{n.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* تأیید خروج از حساب — در همه‌ی نقاط برنامه */}
        <Confirm
          open={logoutAsk}
          onClose={() => setLogoutAsk(false)}
          onYes={onLogout}
          title="خروج از حساب"
          desc="آیا می‌خواهید از حساب کاربری خود خارج شوید؟"
          yesLabel="خروج"
        />
      </div>
    </div>
  );
}
