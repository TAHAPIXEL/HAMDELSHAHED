"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ClipboardList,
  Eraser,
  History,
  KeyRound,
  Link2,
  Pencil,
  Plus,
  Save,
  School,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  UserCog,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { api, errorMessage, useApi } from "@/lib/client";
import { fa, jalaliDateTime, roleLabel, timeAgo } from "@/lib/format";
import type { ClassInfo, Me, SubjectInfo } from "@/lib/types";
import {
  Avatar,
  Badge,
  Button,
  DeleteConfirmModal,
  EmptyState,
  Field,
  ImageUploader,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Tabs,
  Textarea,
  useToast,
} from "./ui";
import type { Meta } from "./Shell";

type Role = "admin" | "teacher" | "student";

type AdminUser = {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  nationalId: string | null;
  phone: string | null;
  email: string | null;
  bio: string | null;
  avatarColor: string;
  avatarUrl: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  classId: number | null;
  className: string | null;
};

type TeachingRow = {
  id: number;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  subjectColor: string;
  teacherId: number;
  teacherName: string;
};

type Teacher = Meta["teachers"][number];

type Tab = "users" | "classes" | "subjects" | "teaching" | "settings";

const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function Admin({ user }: { user: Me }) {
  const [view, setView] = useState<Tab>("users");
  const { data: meta, reload: reloadMeta } = useApi<Meta>("/api/meta");

  const classes = meta?.allClasses ?? [];
  const subjects = meta?.subjects ?? [];
  const teachers = meta?.teachers ?? [];
  const refreshMeta = () => void reloadMeta(true);

  return (
    <div>
      <PageHeader
        title="مدیریت سامانه"
        subtitle="کاربران، کلاس‌ها، دروس، برنامه‌ی تدریس و تنظیمات امنیتی"
      />

      <div className="mb-4">
        <Tabs
          tabs={[
            { id: "users", label: "کاربران", icon: <Users className="size-3.5" /> },
            { id: "classes", label: "کلاس‌ها", icon: <School className="size-3.5" /> },
            { id: "subjects", label: "دروس", icon: <BookOpen className="size-3.5" /> },
            { id: "teaching", label: "برنامه‌ی تدریس", icon: <Link2 className="size-3.5" /> },
            { id: "settings", label: "تنظیمات و امنیت", icon: <Settings2 className="size-3.5" /> },
          ]}
          value={view}
          onChange={(id) => setView(id)}
        />
      </div>

      {view === "users" && <UsersPanel user={user} classes={classes} onChanged={refreshMeta} />}
      {view === "classes" && (
        <ClassesPanel classes={classes} teachers={teachers} onChanged={refreshMeta} />
      )}
      {view === "subjects" && <SubjectsPanel subjects={subjects} onChanged={refreshMeta} />}
      {view === "teaching" && (
        <TeachingPanel classes={classes} subjects={subjects} teachers={teachers} />
      )}
      {view === "settings" && <SettingsPanel onChanged={refreshMeta} />}

      <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl bg-white/70 px-4 py-3 text-[10px] text-slate-500 ring-1 ring-slate-200">
        <ShieldCheck className="size-3.5 text-emerald-500" />
        رمز عبور همه‌ی کاربران و رمز حذف سامانه به‌صورت هش‌شده (scrypt) ذخیره می‌شود؛ هیچ‌کدام قابل بازیابی به‌صورت متن ساده نیستند.
      </div>
    </div>
  );
}

/* =============================== کاربران =============================== */

function UsersPanel({
  user,
  classes,
  onChanged,
}: {
  user: Me;
  classes: ClassInfo[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  const path = useMemo(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (roleFilter) params.set("role", roleFilter);
    params.set("limit", "500");
    return `/api/admin/users?${params.toString()}`;
  }, [query, roleFilter]);

  const { data, loading, reload } = useApi<{ items: AdminUser[] }>(path);
  const refreshAll = async () => {
    await reload(true);
    onChanged();
  };

  const toggleActive = async (target: AdminUser) => {
    try {
      await api("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ id: target.id, isActive: !target.isActive }),
      });
      toast.push(target.isActive ? "حساب غیرفعال شد" : "حساب فعال شد", "info");
      await refreshAll();
    } catch (e) {
      toast.push(errorMessage(e), "error");
    }
  };

  const items = data?.items ?? [];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جست‌وجوی نام، نام کاربری یا کد ملی…"
            className="pr-9"
          />
        </div>
        <div className="w-40">
          <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">همه‌ی نقش‌ها</option>
            <option value="student">دانش‌آموزان</option>
            <option value="teacher">دبیران</option>
            <option value="admin">مدیران</option>
          </Select>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> کاربر جدید
        </Button>
      </div>

      {loading && !data ? (
        <LoadingBlock rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Users className="size-5" />}
          title="کاربری یافت نشد"
          description="با دکمه‌ی «کاربر جدید» اولین دانش‌آموز، دبیر یا مدیر را ثبت کنید."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-right text-xs">
              <thead className="bg-slate-50/90 text-[10px] text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">کاربر</th>
                  <th className="px-4 py-2.5 font-semibold">نقش</th>
                  <th className="px-4 py-2.5 font-semibold">کلاس</th>
                  <th className="px-4 py-2.5 font-semibold">تماس</th>
                  <th className="px-4 py-2.5 font-semibold">آخرین ورود</th>
                  <th className="px-4 py-2.5 font-semibold">وضعیت</th>
                  <th className="px-4 py-2.5 font-semibold">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => {
                  const self = item.id === user.id;
                  return (
                    <tr key={item.id} className="transition hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar
                            name={item.fullName}
                            color={item.avatarColor}
                            src={item.avatarUrl}
                            size={30}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-bold text-slate-800">
                              {item.fullName}
                              {self && <span className="mr-1 text-[9px] text-indigo-500">(شما)</span>}
                            </p>
                            <p className="text-[10px] text-slate-400" dir="ltr">
                              {item.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          tone={
                            item.role === "admin" ? "indigo" : item.role === "teacher" ? "violet" : "sky"
                          }
                        >
                          {roleLabel[item.role]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{item.className ?? "—"}</td>
                      <td className="px-4 py-2.5 text-slate-500" dir="ltr">
                        {item.phone ?? item.email ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {item.lastLoginAt ? timeAgo(item.lastLoginAt) : "هرگز"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge tone={item.isActive ? "emerald" : "rose"}>
                          {item.isActive ? "فعال" : "غیرفعال"}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditing(item)}
                            title="ویرایش، تغییر رمز و کلاس"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(item)}
                            disabled={self}
                            title={item.isActive ? "غیرفعال‌کردن" : "فعال‌کردن"}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 disabled:opacity-30"
                          >
                            <UserCog className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(item)}
                            disabled={self}
                            title="حذف کاربر"
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
            {fa(items.length)} کاربر نمایش داده شد
          </p>
        </div>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `ویرایش ${editing.fullName}` : "کاربر جدید"}
        subtitle={
          editing
            ? "مشخصات، عکس پروفایل، کلاس و رمز عبور را ویرایش کنید."
            : "دانش‌آموز، دبیر یا مدیر جدید را ثبت کنید."
        }
        wide
      >
        <UserForm
          initial={editing}
          classes={classes}
          onSaved={async () => {
            setCreating(false);
            setEditing(null);
            await refreshAll();
          }}
        />
      </Modal>

      <DeleteConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف کاربر"
        description={`حساب «${deleting?.fullName ?? ""}» به‌همراه عکس پروفایل و فایل‌های ارسالی‌اش حذف می‌شود. رمز حذف را وارد کنید.`}
        onConfirm={async (deletePassword) => {
          if (!deleting) return;
          await api(`/api/admin/users?id=${deleting.id}`, {
            method: "DELETE",
            body: JSON.stringify({ deletePassword }),
          });
          toast.push("کاربر حذف شد", "info");
          await refreshAll();
        }}
      />
    </div>
  );
}

function UserForm({
  initial,
  classes,
  onSaved,
}: {
  initial: AdminUser | null;
  classes: ClassInfo[];
  onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: initial?.fullName ?? "",
    username: initial?.username ?? "",
    password: "",
    role: (initial?.role ?? "student") as Role,
    classId: initial?.classId ? String(initial.classId) : "",
    phone: initial?.phone ?? "",
    email: initial?.email ?? "",
    nationalId: initial?.nationalId ?? "",
    bio: initial?.bio ?? "",
    avatarUrl: initial?.avatarUrl ?? (null as string | null),
  });

  const submit = async () => {
    if (!form.fullName.trim()) {
      toast.push("نام و نام خانوادگی را وارد کنید", "error");
      return;
    }
    if (!initial && (!form.username.trim() || form.password.length < 8)) {
      toast.push("نام کاربری و رمز عبور (حداقل ۸ کاراکتر) را کامل کنید", "error");
      return;
    }
    if (initial && form.password && form.password.length < 8) {
      toast.push("رمز عبور جدید باید حداقل ۸ کاراکتر باشد", "error");
      return;
    }
    if (form.nationalId && !/^\d{10}$/.test(form.nationalId.trim())) {
      toast.push("کد ملی باید ۱۰ رقم باشد", "error");
      return;
    }

    const classIdValue = form.role === "student" && form.classId ? Number(form.classId) : null;

    setSaving(true);
    try {
      if (initial) {
        await api("/api/admin/users", {
          method: "PATCH",
          body: JSON.stringify({
            id: initial.id,
            fullName: form.fullName.trim(),
            role: form.role,
            classId: classIdValue,
            phone: form.phone,
            email: form.email,
            nationalId: form.nationalId || null,
            bio: form.bio,
            avatarUrl: form.avatarUrl,
            ...(form.password ? { password: form.password } : {}),
          }),
        });
        toast.push("اطلاعات کاربر ذخیره شد");
      } else {
        await api("/api/admin/users", {
          method: "POST",
          body: JSON.stringify({
            username: form.username.trim(),
            fullName: form.fullName.trim(),
            password: form.password,
            role: form.role,
            classId: classIdValue,
            phone: form.phone || undefined,
            email: form.email || undefined,
            nationalId: form.nationalId || undefined,
            bio: form.bio || undefined,
            avatarUrl: form.avatarUrl,
          }),
        });
        toast.push("کاربر ایجاد شد");
      }
      await onSaved();
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-slate-50 p-3">
        <Avatar
          name={form.fullName || "؟"}
          color={initial?.avatarColor ?? "#6366f1"}
          src={form.avatarUrl}
          size={60}
          ring
        />
        <div className="min-w-0 flex-1">
          <p className="mb-1.5 text-xs font-semibold text-slate-600">عکس پروفایل</p>
          <ImageUploader
            folder="avatars"
            value={form.avatarUrl}
            onChange={(avatarUrl) => setForm({ ...form, avatarUrl })}
            label="آپلود عکس پروفایل"
            compact
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="نام و نام خانوادگی">
          <Input
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="مثلاً سارا احمدی"
          />
        </Field>
        <Field label="نقش">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            <option value="student">دانش‌آموز</option>
            <option value="teacher">دبیر</option>
            <option value="admin">مدیر</option>
          </Select>
        </Field>
      </div>

      {form.role === "student" && (
        <Field label="کلاس">
          <Select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
            <option value="">بدون کلاس</option>
            {classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="نام کاربری" hint={initial ? "قابل تغییر نیست" : "حروف لاتین کوچک"}>
          <Input
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            placeholder="s.ahmadi"
            dir="ltr"
            disabled={Boolean(initial)}
          />
        </Field>
        <Field label={initial ? "رمز عبور جدید (اختیاری)" : "رمز عبور"} hint="حداقل ۸ کاراکتر">
          <Input
            type="text"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder={initial ? "خالی = بدون تغییر" : ""}
            dir="ltr"
            autoComplete="new-password"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="تلفن">
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="0912…"
            dir="ltr"
          />
        </Field>
        <Field label="ایمیل">
          <Input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="name@example.com"
            dir="ltr"
          />
        </Field>
        <Field label="کد ملی">
          <Input
            value={form.nationalId}
            onChange={(e) => setForm({ ...form, nationalId: e.target.value.replace(/\D/g, "").slice(0, 10) })}
            placeholder="۱۰ رقم"
            dir="ltr"
          />
        </Field>
      </div>

      <Field label="توضیحات / بیوگرافی" hint="اختیاری">
        <Textarea
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          rows={2}
          maxLength={400}
          className="min-h-16"
        />
      </Field>

      <div className="flex justify-end gap-2 pt-1">
        <Button onClick={submit} loading={saving}>
          <Save className="size-4" /> {initial ? "ذخیره تغییرات" : "ایجاد کاربر"}
        </Button>
      </div>
    </div>
  );
}

/* ================================ کلاس‌ها ================================ */

function ClassesPanel({
  classes,
  teachers,
  onChanged,
}: {
  classes: ClassInfo[];
  teachers: Teacher[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<ClassInfo | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<ClassInfo | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = classes.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> کلاس جدید
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="grid content-start gap-3 sm:grid-cols-2">
          {classes.map((cls) => (
            <div
              key={cls.id}
              onClick={() => setSelectedId(cls.id)}
              className={`card cursor-pointer p-4 transition hover:-translate-y-0.5 ${
                selectedId === cls.id ? "ring-2 ring-indigo-300" : ""
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    <School className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-slate-800">{cls.name}</p>
                    <p className="text-[10px] text-slate-500">
                      پایه {fa(cls.grade)} · {cls.field}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(cls);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                    title="ویرایش کلاس"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleting(cls);
                    }}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                    title="حذف کلاس"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                  <dt className="text-[10px] text-slate-500">دانش‌آموز</dt>
                  <dd className="font-bold text-slate-800">{fa(cls.studentCount ?? 0)}</dd>
                </div>
                <div className="rounded-xl bg-slate-50 px-2.5 py-2">
                  <dt className="text-[10px] text-slate-500">کلاس/اتاق</dt>
                  <dd className="font-bold text-slate-800">{cls.room ?? "—"}</dd>
                </div>
                <div className="col-span-2 rounded-xl bg-slate-50 px-2.5 py-2">
                  <dt className="text-[10px] text-slate-500">مربی کلاس</dt>
                  <dd className="font-bold text-slate-800">{cls.homeroomName ?? "—"}</dd>
                </div>
              </dl>
              <p className="mt-2 text-[10px] text-slate-400">سال تحصیلی {cls.academicYear ?? "—"}</p>
            </div>
          ))}
          {classes.length === 0 && (
            <div className="sm:col-span-2">
              <EmptyState
                icon={<School className="size-5" />}
                title="هنوز کلاسی تعریف نشده است"
                description="با دکمه‌ی «کلاس جدید» اولین کلاس را بسازید."
              />
            </div>
          )}
        </div>

        <div>
          {selected ? (
            <ClassRoster key={selected.id} cls={selected} onChanged={onChanged} />
          ) : (
            <EmptyState
              icon={<UserPlus className="size-5" />}
              title="یک کلاس را انتخاب کنید"
              description="برای مدیریت دانش‌آموزان هر کلاس، روی کارت آن کلیک کنید."
            />
          )}
        </div>
      </div>

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `ویرایش کلاس ${editing.name}` : "کلاس جدید"}
        subtitle="پایه، رشته، اتاق، سال تحصیلی و مربی کلاس"
      >
        <ClassForm
          initial={editing}
          teachers={teachers}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            onChanged();
          }}
        />
      </Modal>

      <DeleteConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف کلاس"
        description={`کلاس «${deleting?.name ?? ""}» و ثبت‌نام دانش‌آموزان و برنامه‌ی تدریس آن حذف می‌شود. رمز حذف را وارد کنید.`}
        onConfirm={async (deletePassword) => {
          if (!deleting) return;
          await api(`/api/admin/classes?id=${deleting.id}`, {
            method: "DELETE",
            body: JSON.stringify({ deletePassword }),
          });
          if (selectedId === deleting.id) setSelectedId(null);
          toast.push("کلاس حذف شد", "info");
          onChanged();
        }}
      />
    </div>
  );
}

function ClassForm({
  initial,
  teachers,
  onSaved,
}: {
  initial: ClassInfo | null;
  teachers: Teacher[];
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    grade: String(initial?.grade ?? 10),
    field: initial?.field ?? "",
    room: initial?.room ?? "",
    academicYear: initial?.academicYear ?? "",
    homeroomTeacherId: initial?.homeroomTeacherId ? String(initial.homeroomTeacherId) : "",
  });

  const submit = async () => {
    if (!form.name.trim() || !form.field.trim()) {
      toast.push("نام کلاس و رشته را وارد کنید", "error");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      grade: Number(form.grade),
      field: form.field.trim(),
      room: form.room.trim() || null,
      academicYear: form.academicYear.trim() || undefined,
      homeroomTeacherId: form.homeroomTeacherId ? Number(form.homeroomTeacherId) : null,
    };
    try {
      if (initial) {
        await api("/api/admin/classes", {
          method: "PATCH",
          body: JSON.stringify({ id: initial.id, ...payload }),
        });
        toast.push("کلاس به‌روزرسانی شد");
      } else {
        await api("/api/admin/classes", { method: "POST", body: JSON.stringify(payload) });
        toast.push("کلاس ایجاد شد");
      }
      onSaved();
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="نام کلاس" hint="مثلاً ۱۰-ریاضی-۲">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="پایه">
          <Select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
            {GRADE_OPTIONS.map((g) => (
              <option key={g} value={g}>
                پایه {fa(g)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="رشته">
          <Input
            value={form.field}
            onChange={(e) => setForm({ ...form, field: e.target.value })}
            placeholder="ریاضی / تجربی / انسانی / عمومی"
          />
        </Field>
        <Field label="اتاق یا شماره کلاس" hint="اختیاری">
          <Input value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
        </Field>
        <Field label="سال تحصیلی" hint="خالی = سال پیش‌فرض">
          <Input
            value={form.academicYear}
            onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
            dir="ltr"
            placeholder="1405-1406"
          />
        </Field>
        <Field label="مربی کلاس">
          <Select
            value={form.homeroomTeacherId}
            onChange={(e) => setForm({ ...form, homeroomTeacherId: e.target.value })}
          >
            <option value="">بدون مربی</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex justify-end pt-1">
        <Button onClick={submit} loading={saving}>
          <Save className="size-4" /> {initial ? "ذخیره" : "ایجاد کلاس"}
        </Button>
      </div>
    </div>
  );
}

function ClassRoster({ cls, onChanged }: { cls: ClassInfo; onChanged: () => void }) {
  const toast = useToast();
  const [pickId, setPickId] = useState("");
  const [busy, setBusy] = useState(false);
  const { data, loading, reload } = useApi<{ items: AdminUser[] }>(
    "/api/admin/users?role=student&limit=500",
  );

  useEffect(() => setPickId(""), [cls.id]);

  const students = data?.items ?? [];
  const roster = students.filter((s) => s.classId === cls.id);
  const candidates = students.filter((s) => s.classId !== cls.id);

  const update = async (studentId: number, classId: number | null, message: string) => {
    setBusy(true);
    try {
      await api("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ id: studentId, classId }),
      });
      toast.push(message);
      await reload(true);
      onChanged();
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-slate-800">دانش‌آموزان {cls.name}</p>
          <p className="text-[10px] text-slate-500">{fa(roster.length)} نفر ثبت‌نام‌شده</p>
        </div>
        <Badge tone="indigo">
          <Users className="size-3" /> {fa(roster.length)}
        </Badge>
      </div>

      <div className="mb-3 flex gap-2">
        <div className="flex-1">
          <Select value={pickId} onChange={(e) => setPickId(e.target.value)} disabled={busy}>
            <option value="">افزودن دانش‌آموز به این کلاس…</option>
            {candidates.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
                {s.className ? ` (${s.className})` : " (بدون کلاس)"}
              </option>
            ))}
          </Select>
        </div>
        <Button
          size="md"
          disabled={!pickId || busy}
          onClick={() => {
            const id = Number(pickId);
            setPickId("");
            void update(id, cls.id, "دانش‌آموز به کلاس افزوده شد");
          }}
        >
          <UserPlus className="size-4" /> افزودن
        </Button>
      </div>

      {loading && !data ? (
        <LoadingBlock rows={2} />
      ) : roster.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-[11px] text-slate-400">
          هنوز دانش‌آموزی در این کلاس ثبت نشده است.
        </p>
      ) : (
        <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {roster.map((s) => (
            <li key={s.id} className="flex items-center gap-2.5 py-2">
              <Avatar name={s.fullName} color={s.avatarColor} src={s.avatarUrl} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-slate-700">{s.fullName}</p>
                <p className="truncate text-[10px] text-slate-400" dir="ltr">
                  {s.username}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => void update(s.id, null, "دانش‌آموز از کلاس خارج شد")}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-40"
              >
                <UserMinus className="size-3.5" /> خروج از کلاس
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ================================ دروس ================================ */

type SubjectRow = SubjectInfo;

function SubjectsPanel({ subjects, onChanged }: { subjects: SubjectRow[]; onChanged: () => void }) {
  const toast = useToast();
  const [editing, setEditing] = useState<SubjectRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<SubjectRow | null>(null);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> درس جدید
        </Button>
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="size-5" />}
          title="هنوز درسی ثبت نشده است"
          description="دروس مدرسه را تعریف کنید تا بعداً به کلاس‌ها و دبیران تخصیص داده شوند."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <div key={subject.id} className="card flex items-center gap-3 p-4">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-2xl text-[11px] font-black text-white"
                style={{ backgroundColor: subject.color }}
              >
                {subject.code}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-slate-800">{subject.name}</p>
                <p className="text-[10px] text-slate-500">{fa(subject.weeklyHours)} ساعت در هفته</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(subject)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                title="ویرایش"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setDeleting(subject)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                title="حذف"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `ویرایش ${editing.name}` : "درس جدید"}
      >
        <SubjectForm
          initial={editing}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            onChanged();
          }}
        />
      </Modal>

      <DeleteConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="حذف درس"
        description={`درس «${deleting?.name ?? ""}» حذف می‌شود. اگر تکلیف یا آزمونی با این درس ثبت شده باشد، حذف انجام نمی‌شود.`}
        onConfirm={async (deletePassword) => {
          if (!deleting) return;
          await api(`/api/admin/subjects?id=${deleting.id}`, {
            method: "DELETE",
            body: JSON.stringify({ deletePassword }),
          });
          toast.push("درس حذف شد", "info");
          onChanged();
        }}
      />
    </div>
  );
}

function SubjectForm({ initial, onSaved }: { initial: SubjectRow | null; onSaved: () => void }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    code: initial?.code ?? "",
    weeklyHours: String(initial?.weeklyHours ?? 2),
    color: initial?.color ?? "#6366f1",
  });

  const submit = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.push("نام و کد درس را وارد کنید", "error");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      weeklyHours: Number(form.weeklyHours),
      color: form.color,
    };
    try {
      if (initial) {
        await api("/api/admin/subjects", {
          method: "PATCH",
          body: JSON.stringify({ id: initial.id, ...payload }),
        });
        toast.push("درس به‌روزرسانی شد");
      } else {
        await api("/api/admin/subjects", { method: "POST", body: JSON.stringify(payload) });
        toast.push("درس ایجاد شد");
      }
      onSaved();
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="نام درس">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="کد درس" hint="حداکثر ۲۴ کاراکتر">
          <Input
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            dir="ltr"
            placeholder="MATH1"
          />
        </Field>
        <Field label="ساعت در هفته">
          <Input
            type="number"
            min={1}
            max={30}
            value={form.weeklyHours}
            onChange={(e) => setForm({ ...form, weeklyHours: e.target.value })}
            dir="ltr"
          />
        </Field>
        <Field label="رنگ درس">
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm({ ...form, color: e.target.value })}
            className="h-10 w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
          />
        </Field>
      </div>
      <div className="flex justify-end pt-1">
        <Button onClick={submit} loading={saving}>
          <Save className="size-4" /> {initial ? "ذخیره" : "ایجاد درس"}
        </Button>
      </div>
    </div>
  );
}

/* ========================= برنامه‌ی تدریس ========================= */

function TeachingPanel({
  classes,
  subjects,
  teachers,
}: {
  classes: ClassInfo[];
  subjects: SubjectRow[];
  teachers: Teacher[];
}) {
  const toast = useToast();
  const { data, loading, reload } = useApi<{ items: TeachingRow[] }>("/api/admin/teaching");
  const [form, setForm] = useState({ classId: "", subjectId: "", teacherId: "" });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const assign = async () => {
    if (!form.classId || !form.subjectId || !form.teacherId) {
      toast.push("کلاس، درس و دبیر را انتخاب کنید", "error");
      return;
    }
    setSaving(true);
    try {
      await api("/api/admin/teaching", {
        method: "POST",
        body: JSON.stringify({
          classId: Number(form.classId),
          subjectId: Number(form.subjectId),
          teacherId: Number(form.teacherId),
        }),
      });
      toast.push("تخصیص ثبت شد (در صورت وجود، دبیر قبلی جایگزین شد)");
      await reload(true);
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    setRemoving(id);
    try {
      await api(`/api/admin/teaching?id=${id}`, { method: "DELETE" });
      toast.push("تخصیص حذف شد", "info");
      await reload(true);
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setRemoving(null);
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <p className="mb-3 text-sm font-extrabold text-slate-800">تخصیص دبیر به درس در کلاس</p>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <Field label="کلاس">
            <Select value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })}>
              <option value="">انتخاب کلاس…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="درس">
            <Select value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
              <option value="">انتخاب درس…</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="دبیر">
            <Select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })}>
              <option value="">انتخاب دبیر…</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </Select>
          </Field>
          <Button onClick={assign} loading={saving}>
            <Link2 className="size-4" /> ثبت تخصیص
          </Button>
        </div>
        {(classes.length === 0 || subjects.length === 0 || teachers.length === 0) && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700 ring-1 ring-amber-200">
            برای تخصیص، ابتدا حداقل یک کلاس، یک درس و یک دبیر ثبت کنید.
          </p>
        )}
      </div>

      {loading && !data ? (
        <LoadingBlock rows={2} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="هنوز تخصیصی ثبت نشده است"
          description="با فرم بالا مشخص کنید هر درس در هر کلاس توسط کدام دبیر تدریس می‌شود."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/90 text-[10px] text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">کلاس</th>
                <th className="px-4 py-2.5 font-semibold">درس</th>
                <th className="px-4 py-2.5 font-semibold">دبیر</th>
                <th className="px-4 py-2.5 font-semibold">حذف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-bold text-slate-700">{row.className}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: row.subjectColor }}
                      />
                      {row.subjectName}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{row.teacherName}</td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => void remove(row.id)}
                      disabled={removing === row.id}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                      title="حذف تخصیص"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ========================= تنظیمات و امنیت ========================= */

const PURGE_OPTIONS = [
  { id: "messages", label: "همه‌ی پیام‌ها و تصاویر گفت‌وگوها", hint: "کلاسی، مستقیم و اتاق همکاران" },
  { id: "announcements", label: "همه‌ی اطلاعیه‌ها", hint: "به‌همراه تصاویر پیوست" },
  { id: "assignments", label: "همه‌ی تکالیف و ارسال‌های دانش‌آموزان", hint: "به‌همراه فایل‌های ارسالی" },
  { id: "quizzes", label: "همه‌ی آزمون‌ها و پاسخ‌ها", hint: "شامل کارنامه‌ها" },
  { id: "attendance", label: "همه‌ی سوابق حضور و غیاب", hint: "تمام کلاس‌ها و زنگ‌ها" },
] as const;

type SettingsData = {
  schoolName: string;
  academicYear: string;
  allowStudentDm: boolean;
  mediaCount: number;
  mediaBytes: number;
  logs: {
    id: number;
    action: string;
    entity: string;
    entityId: number | null;
    createdAt: string;
    actorName: string | null;
  }[];
};

function SettingsPanel({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const { data, loading, reload } = useApi<SettingsData>("/api/admin/settings");
  const [schoolName, setSchoolName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [allowDm, setAllowDm] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);
  const [purgeTarget, setPurgeTarget] = useState<(typeof PURGE_OPTIONS)[number] | null>(null);

  useEffect(() => {
    if (!data) return;
    setSchoolName(data.schoolName);
    setAcademicYear(data.academicYear);
    setAllowDm(data.allowStudentDm);
  }, [data]);

  const saveGeneral = async () => {
    setSavingGeneral(true);
    try {
      await api("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          academicYear: academicYear.trim(),
          allowStudentDm: allowDm,
        }),
      });
      toast.push("تنظیمات مدرسه ذخیره شد");
      await reload(true);
      onChanged();
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setSavingGeneral(false);
    }
  };

  const changeDeletePassword = async () => {
    if (pw.next.length < 8) {
      toast.push("رمز حذف جدید باید حداقل ۸ کاراکتر باشد", "error");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.push("تکرار رمز جدید با آن یکسان نیست", "error");
      return;
    }
    setSavingPw(true);
    try {
      await api("/api/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({ currentDeletePassword: pw.current, newDeletePassword: pw.next }),
      });
      toast.push("رمز حذف با موفقیت تغییر کرد");
      setPw({ current: "", next: "", confirm: "" });
      await reload(true);
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setSavingPw(false);
    }
  };

  if (loading && !data) return <LoadingBlock rows={3} />;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* مشخصات مدرسه */}
      <section className="card space-y-3 p-4">
        <p className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
          <School className="size-4 text-indigo-500" /> اطلاعات مدرسه
        </p>
        <Field label="نام مدرسه">
          <Input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} maxLength={120} />
        </Field>
        <Field label="سال تحصیلی جاری">
          <Input
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            dir="ltr"
            maxLength={16}
            placeholder="1405-1406"
          />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={allowDm}
            onChange={(e) => setAllowDm(e.target.checked)}
            className="mt-0.5 size-4 accent-indigo-600"
          />
          <span>
            <span className="block text-xs font-semibold text-slate-700">
              گفت‌وگوی مستقیم دانش‌آموزان با یکدیگر
            </span>
            <span className="block text-[10px] leading-5 text-slate-500">
              در حالت فعال، دانش‌آموزان می‌توانند با هم‌کلاسی‌ها و دبیران گفت‌وگوی خصوصی داشته باشند. در حالت غیرفعال، فقط با دبیران و مدیر.
            </span>
          </span>
        </label>
        <div className="flex justify-end">
          <Button onClick={saveGeneral} loading={savingGeneral}>
            <Save className="size-4" /> ذخیره تنظیمات
          </Button>
        </div>
      </section>

      {/* تغییر رمز حذف */}
      <section className="card space-y-3 p-4">
        <p className="flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
          <KeyRound className="size-4 text-amber-500" /> تغییر رمز حذف
        </p>
        <p className="text-[11px] leading-5 text-slate-500">
          این رمز برای تأیید همه‌ی حذف‌ها (کاربر، کلاس، درس، اطلاعیه، تکلیف، آزمون، پیام و پاک‌سازی بخش‌ها) لازم است. برای تغییر، رمز فعلی حذف (یا رمز حساب مدیر) را وارد کنید.
        </p>
        <Field label="رمز حذف فعلی">
          <Input
            type="password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
            dir="ltr"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="رمز حذف جدید" hint="حداقل ۸ کاراکتر">
            <Input
              type="password"
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              dir="ltr"
            />
          </Field>
          <Field label="تکرار رمز جدید">
            <Input
              type="password"
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              dir="ltr"
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            variant="danger"
            onClick={changeDeletePassword}
            loading={savingPw}
            disabled={!pw.current || !pw.next}
          >
            <KeyRound className="size-4" /> تغییر رمز حذف
          </Button>
        </div>
      </section>

      {/* پاک‌سازی انتخابی */}
      <section className="card space-y-3 p-4 lg:col-span-1">
        <p className="flex items-center gap-1.5 text-sm font-extrabold text-rose-600">
          <Eraser className="size-4" /> پاک‌سازی انتخابی داده‌ها
        </p>
        <p className="text-[11px] leading-5 text-slate-500">
          با هر پاک‌سازی، بخش انتخابی به‌طور کامل خالی شده و فایل‌های مرتبط از فضای ذخیره‌سازی هم حذف می‌شوند. حساب کاربران، کلاس‌ها و دروس دست‌نخورده می‌مانند.
        </p>
        <div className="space-y-2">
          {PURGE_OPTIONS.map((opt) => (
            <div
              key={opt.id}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-700">{opt.label}</p>
                <p className="text-[10px] text-slate-400">{opt.hint}</p>
              </div>
              <Button size="sm" variant="danger" onClick={() => setPurgeTarget(opt)}>
                <Trash2 className="size-3.5" /> پاک‌سازی
              </Button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400">
          فایل‌های ذخیره‌شده: {fa(data?.mediaCount ?? 0)} · حجم تقریبی:{" "}
          {fa(Math.round((data?.mediaBytes ?? 0) / 1024))} کیلوبایت
        </p>
      </section>

      {/* گزارش فعالیت */}
      <section className="card p-4">
        <p className="mb-3 flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
          <History className="size-4 text-slate-500" /> گزارش فعالیت‌های اخیر
        </p>
        {(data?.logs ?? []).length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-[11px] text-slate-400">
            هنوز فعالیتی ثبت نشده است.
          </p>
        ) : (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {(data?.logs ?? []).map((log) => (
              <li key={log.id} className="flex items-center gap-2 py-2 text-[11px]">
                <span className="min-w-0 flex-1">
                  <span className="font-bold text-slate-700">{log.actorName ?? "سیستم"}</span>
                  <span className="text-slate-500">
                    {" "}
                    · {log.action} · {log.entity}
                    {log.entityId ? ` #${fa(log.entityId)}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-[10px] text-slate-400" title={jalaliDateTime(log.createdAt)}>
                  {timeAgo(log.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <DeleteConfirmModal
        open={purgeTarget !== null}
        onClose={() => setPurgeTarget(null)}
        title="پاک‌سازی انتخابی"
        description={`«${purgeTarget?.label ?? ""}» برای همیشه حذف می‌شود. این عملیات قابل بازگشت نیست؛ رمز حذف را وارد کنید.`}
        onConfirm={async (deletePassword) => {
          if (!purgeTarget) return;
          await api("/api/admin/settings", {
            method: "POST",
            body: JSON.stringify({ action: "purge", target: purgeTarget.id, deletePassword }),
          });
          toast.push("پاک‌سازی انجام شد", "info");
          await reload(true);
          onChanged();
        }}
      />
    </div>
  );
}
