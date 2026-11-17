"use client";

import { useMemo, useState } from "react";
import {
  Globe,
  GraduationCap,
  Megaphone,
  Pin,
  Plus,
  School,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { api, errorMessage, useApi } from "@/lib/client";
import { fa, jalaliDateTime, timeAgo } from "@/lib/format";
import type { Announcement, Me } from "@/lib/types";
import {
  Avatar,
  Badge,
  Button,
  DeleteConfirmModal,
  EmptyState,
  Field,
  ImageAttachment,
  ImageUploader,
  Input,
  LoadingBlock,
  Modal,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from "./ui";
import type { Meta } from "./Shell";

const audienceMeta: Record<
  Announcement["audience"],
  { label: string; tone: "indigo" | "emerald" | "violet" | "amber"; icon: typeof Globe }
> = {
  all: { label: "همه", tone: "indigo", icon: Globe },
  students: { label: "دانش‌آموزان", tone: "emerald", icon: GraduationCap },
  teachers: { label: "دبیران", tone: "violet", icon: Users },
  class: { label: "کلاس", tone: "amber", icon: School },
};

export default function Announcements({ user }: { user: Me }) {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{ items: Announcement[]; canCreate: boolean }>(
    "/api/announcements",
  );
  const { data: meta } = useApi<Meta>("/api/meta");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: "",
    body: "",
    imageUrl: null as string | null,
    audience: "all" as Announcement["audience"],
    classId: "",
    isPinned: false,
  });

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    if (!query.trim()) return items;
    const q = query.trim();
    return items.filter(
      (a) => a.title.includes(q) || a.body.includes(q) || a.authorName.includes(q),
    );
  }, [data, query]);

  const submit = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast.push("عنوان و متن اطلاعیه را کامل کنید", "error");
      return;
    }
    if (form.audience === "class" && !form.classId) {
      toast.push("کلاس مقصد را انتخاب کنید", "error");
      return;
    }
    setSaving(true);
    try {
      await api("/api/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          imageUrl: form.imageUrl,
          audience: form.audience,
          classId: form.audience === "class" ? Number(form.classId) : null,
          isPinned: form.isPinned,
        }),
      });
      toast.push("اطلاعیه منتشر شد");
      setOpen(false);
      setForm({ title: "", body: "", imageUrl: null, audience: "all", classId: "", isPinned: false });
      await reload();
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (item: Announcement) => {
    try {
      await api("/api/announcements", {
        method: "PATCH",
        body: JSON.stringify({ id: item.id, isPinned: !item.isPinned }),
      });
      await reload();
    } catch (e) {
      toast.push(errorMessage(e), "error");
    }
  };

  return (
    <div>
      <PageHeader
        title="اطلاعیه‌ها"
        subtitle="آخرین خبرها، پوسترها و اطلاعیه‌های مدرسه و کلاس‌ها"
        action={
          data?.canCreate ? (
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> اطلاعیه جدید
            </Button>
          ) : undefined
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجو در اطلاعیه‌ها…"
          className="pr-9"
        />
      </div>

      {error && (
        <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
      )}

      {loading && !data ? (
        <LoadingBlock rows={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="size-5" />}
          title="هنوز اطلاعیه‌ای ثبت نشده است"
          description={
            query.trim()
              ? "عبارت جست‌وجو را تغییر دهید."
              : data?.canCreate
                ? "با کلیک روی «اطلاعیه جدید»، اولین اطلاعیه مدرسه را منتشر کنید."
                : "اطلاعیه‌های مدرسه و کلاس شما در این بخش نمایش داده می‌شود."
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {filtered.map((item) => {
            const audience = audienceMeta[item.audience];
            const canDelete = user.role === "admin" || item.authorId === user.id;
            return (
              <li
                key={item.id}
                className={`card flex flex-col p-4 ${item.isPinned ? "ring-1 ring-amber-200" : ""}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    {item.isPinned && <Pin className="mt-1 size-3.5 shrink-0 text-amber-500" />}
                    <h3 className="text-sm font-extrabold text-slate-800">{item.title}</h3>
                  </div>
                  <Badge tone={audience.tone}>
                    <audience.icon className="size-3" />
                    {audience.label}
                    {item.className ? ` ${item.className}` : ""}
                  </Badge>
                </div>
                {item.imageUrl && (
                  <div className="mb-3">
                    <ImageAttachment
                      src={item.imageUrl}
                      alt={item.title}
                      className="max-h-56 w-full object-cover"
                    />
                  </div>
                )}
                <p className="user-text text-xs leading-6 whitespace-pre-line text-slate-600">
                  {item.body}
                </p>
                <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3">
                  <Avatar
                    name={item.authorName}
                    color={item.authorColor ?? "#6366f1"}
                    src={item.authorAvatar}
                    size={26}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-bold text-slate-700">{item.authorName}</p>
                    <p className="text-[10px] text-slate-400" title={jalaliDateTime(item.createdAt)}>
                      {timeAgo(item.createdAt)}
                    </p>
                  </div>
                  {(user.role === "admin" || item.authorId === user.id) && (
                    <div className="mr-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => togglePin(item)}
                        title={item.isPinned ? "برداشتن سنجاق" : "سنجاق‌کردن"}
                        className={`rounded-lg p-1.5 transition hover:bg-amber-50 ${
                          item.isPinned ? "text-amber-500" : "text-slate-400"
                        }`}
                      >
                        <Pin className="size-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleteId(item.id)}
                          title="حذف اطلاعیه"
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="انتشار اطلاعیه"
        subtitle="اطلاعیه و تصویر پیوست آن برای مخاطبان انتخاب‌شده نمایش داده می‌شود."
      >
        <div className="space-y-3">
          <Field label="عنوان">
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثلاً برنامه‌ی امتحانات نوبت اول"
              maxLength={160}
            />
          </Field>
          <Field label="متن اطلاعیه">
            <Textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="توضیحات کامل…"
              rows={5}
            />
          </Field>
          <Field label="تصویر یا پوستر" hint="اختیاری">
            <ImageUploader
              folder="announcements"
              value={form.imageUrl}
              onChange={(imageUrl) => setForm({ ...form, imageUrl })}
              label="افزودن تصویر به اطلاعیه"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="مخاطبان">
              <Select
                value={form.audience}
                onChange={(e) =>
                  setForm({ ...form, audience: e.target.value as Announcement["audience"] })
                }
              >
                <option value="all">همه‌ی کاربران</option>
                <option value="students">دانش‌آموزان</option>
                <option value="teachers">دبیران</option>
                <option value="class">یک کلاس مشخص</option>
              </Select>
            </Field>
            {form.audience === "class" && (
              <Field label="کلاس">
                <Select
                  value={form.classId}
                  onChange={(e) => setForm({ ...form, classId: e.target.value })}
                >
                  <option value="">انتخاب کلاس…</option>
                  {(meta?.classes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
              className="size-4 accent-indigo-600"
            />
            <span className="text-xs font-semibold text-slate-600">
              سنجاق‌کردن در بالای فهرست
            </span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button onClick={submit} loading={saving}>
              انتشار
            </Button>
          </div>
        </div>
      </Modal>

      <DeleteConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="حذف اطلاعیه"
        onConfirm={async (deletePassword) => {
          if (!deleteId) return;
          await api("/api/announcements", {
            method: "DELETE",
            body: JSON.stringify({ id: deleteId, deletePassword }),
          });
          toast.push("اطلاعیه حذف شد", "info");
          await reload();
        }}
      />

      {filtered.length > 0 && (
        <p className="mt-6 text-center text-[10px] text-slate-400">
          {fa(filtered.length)} اطلاعیه نمایش داده شد
        </p>
      )}
    </div>
  );
}
