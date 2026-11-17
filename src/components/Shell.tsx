"use client";

import { useMemo, useState } from "react";
import {
  BookOpenCheck,
  CalendarCheck2,
  ChevronLeft,
  ClipboardList,
  FileCheck2,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessagesSquare,
  RefreshCw,
  UserCog,
  Users,
} from "lucide-react";
import { api } from "@/lib/client";
import { fa, jalaliDate, roleLabel, weekdayName } from "@/lib/format";
import type { ClassInfo, Me, SubjectInfo } from "@/lib/types";
import { Avatar, useToast } from "./ui";
import Dashboard from "./Dashboard";
import Announcements from "./Announcements";
import Chat from "./Chat";
import Assignments from "./Assignments";
import Quizzes from "./Quizzes";
import Attendance from "./Attendance";
import Admin from "./Admin";
import ProfileModal from "./ProfileModal";

export type Meta = {
  role: string;
  schoolName?: string;
  academicYear?: string;
  allowStudentDm?: boolean;
  classes: ClassInfo[];
  allClasses?: ClassInfo[];
  subjects: SubjectInfo[];
  teaching: { id?: number; classId: number; subjectId: number; teacherId: number }[];
  teachers: {
    id: number;
    fullName: string;
    role: string;
    avatarColor: string;
    avatarUrl?: string | null;
  }[];
  students: {
    id: number;
    fullName: string;
    avatarColor: string;
    avatarUrl?: string | null;
    username: string;
    role: string;
    className: string | null;
  }[];
};

export type TabId =
  | "dashboard"
  | "announcements"
  | "chat"
  | "assignments"
  | "quizzes"
  | "attendance"
  | "admin";

type NavItem = { id: TabId; label: string; icon: typeof LayoutDashboard; mobile?: boolean };

export default function Shell({
  user,
  onUserUpdated,
  onLogout,
}: {
  user: Me;
  onUserUpdated: (next: Me) => void;
  onLogout: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<TabId>("dashboard");
  const [metaVersion, setMetaVersion] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const nav = useMemo<NavItem[]>(() => {
    const items: NavItem[] = [
      { id: "dashboard", label: "داشبورد", icon: LayoutDashboard, mobile: true },
      { id: "announcements", label: "اطلاعیه‌ها", icon: Megaphone, mobile: true },
      { id: "chat", label: "گفت‌وگو", icon: MessagesSquare, mobile: true },
      { id: "assignments", label: "تکالیف", icon: ClipboardList, mobile: true },
      { id: "quizzes", label: "آزمون‌ها", icon: FileCheck2, mobile: true },
      { id: "attendance", label: "حضور", icon: CalendarCheck2, mobile: true },
    ];
    if (user.role === "admin") items.push({ id: "admin", label: "مدیریت سامانه", icon: Users });
    return items;
  }, [user.role]);

  const today = new Date();
  const mobileItems = nav.filter((item) => item.mobile || item.id === "admin");
  const active = nav.find((item) => item.id === tab) ?? nav[0];

  const logout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* بی‌اهمیت */
    }
    toast.push("از حساب خود خارج شدید", "info");
    onLogout();
  };

  return (
    <div className="min-h-dvh bg-[#f6f7fb]">
      {/* هدر */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            className="flex items-center gap-2.5 rounded-xl p-1 transition hover:bg-slate-100/70 lg:pointer-events-none"
            onClick={() => setTab("dashboard")}
          >
            <span className="grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-base font-black text-white shadow-md shadow-indigo-500/25">
              هـ
            </span>
            <span className="text-right">
              <span className="block text-sm leading-tight font-extrabold text-slate-800">هَمدِل</span>
              <span className="hidden text-[10px] text-slate-500 sm:block">
                دبیرستان شاهد شهیدان فهیمی
              </span>
            </span>
          </button>

          <div className="mx-auto hidden items-center gap-1 rounded-2xl bg-slate-100/70 p-1 lg:flex">
            {nav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition ${
                  tab === item.id
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <item.icon className="size-4" />
                {item.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-left sm:block">
              <p className="text-[11px] font-semibold text-slate-500">
                {weekdayName(today)} — {jalaliDate(today)}
              </p>
              <p className="text-[10px] text-slate-400">{fa(user.username)}@hamdelshahed</p>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-2xl p-1 pr-2 transition hover:bg-slate-100"
              >
                <Avatar
                  name={user.fullName}
                  color={user.avatarColor}
                  src={user.avatarUrl}
                  size={34}
                />
                <span className="hidden text-right sm:block">
                  <span className="block max-w-32 truncate text-xs font-bold text-slate-700">
                    {user.fullName}
                  </span>
                  <span className="block text-[10px] text-indigo-500">{roleLabel[user.role]}</span>
                </span>
              </button>

              {menuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    aria-label="بستن"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="modal-pop absolute left-0 z-20 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
                    <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 p-2.5">
                      <Avatar
                        name={user.fullName}
                        color={user.avatarColor}
                        src={user.avatarUrl}
                        size={40}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold text-slate-800">{user.fullName}</p>
                        <p className="truncate text-[10px] text-slate-500" dir="ltr">
                          @{user.username}
                        </p>
                      </div>
                    </div>
                    {user.bio && (
                      <p className="mt-2 px-1 text-[11px] leading-5 text-slate-500">{user.bio}</p>
                    )}
                    <div className="mt-2 space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setProfileOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        <UserCog className="size-4" /> پروفایل و عکس من
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setMetaVersion((v) => v + 1);
                          toast.push("اطلاعات به‌روزرسانی شد", "info");
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                      >
                        <RefreshCw className="size-4" /> به‌روزرسانی داده‌ها
                      </button>
                      <button
                        type="button"
                        onClick={logout}
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        <LogOut className="size-4" /> خروج از حساب
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* محتوا */}
      <main className="mx-auto max-w-7xl px-4 pt-5 pb-28 sm:px-6 lg:pb-10">
        <div className="mb-4 flex items-center gap-1 text-[11px] font-medium text-slate-400 lg:hidden">
          <BookOpenCheck className="size-3.5" />
          <span>هَمدِل</span>
          <ChevronLeft className="size-3" />
          <span className="text-slate-600">{active.label}</span>
        </div>

        <div key={`${tab}-${metaVersion}`} className="anim-fade-up">
          {tab === "dashboard" && (
            <Dashboard user={user} onNavigate={(next) => setTab(next as TabId)} />
          )}
          {tab === "announcements" && <Announcements user={user} />}
          {tab === "chat" && <Chat user={user} />}
          {tab === "assignments" && <Assignments user={user} />}
          {tab === "quizzes" && <Quizzes user={user} />}
          {tab === "attendance" && <Attendance user={user} />}
          {tab === "admin" && user.role === "admin" && <Admin user={user} />}
        </div>
      </main>

      {/* ناوبری موبایل */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
          {mobileItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-bold transition ${
                tab === item.id ? "text-indigo-600" : "text-slate-400"
              }`}
            >
              <item.icon className={`size-5 ${tab === item.id ? "scale-110" : ""}`} />
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        user={user}
        onSaved={(next) => {
          onUserUpdated(next);
          setMetaVersion((v) => v + 1);
        }}
      />
    </div>
  );
}
