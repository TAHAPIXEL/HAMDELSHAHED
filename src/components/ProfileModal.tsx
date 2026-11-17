"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, KeyRound, Loader2, Save, Trash2 } from "lucide-react";
import { api, errorMessage, uploadImage } from "@/lib/client";
import { roleLabel } from "@/lib/format";
import type { Me } from "@/lib/types";
import { Avatar, Badge, Button, Field, Input, Modal, Textarea, useToast } from "./ui";

const AVATAR_COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#f43f5e",
  "#334155",
];

export default function ProfileModal({
  open,
  onClose,
  user,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  user: Me;
  onSaved: (next: Me) => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [bio, setBio] = useState(user.bio ?? "");
  const [phone, setPhone] = useState(user.phone ?? "");
  const [email, setEmail] = useState(user.email ?? "");
  const [avatarColor, setAvatarColor] = useState(user.avatarColor);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatarUrl ?? null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    if (!open) return;
    setFullName(user.fullName);
    setBio(user.bio ?? "");
    setPhone(user.phone ?? "");
    setEmail(user.email ?? "");
    setAvatarColor(user.avatarColor);
    setAvatarUrl(user.avatarUrl ?? null);
    setCurrentPassword("");
    setNewPassword("");
  }, [open, user]);

  const handleAvatarFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, "avatars");
      setAvatarUrl(url);
      toast.push("عکس پروفایل بارگذاری شد؛ برای ثبت نهایی ذخیره را بزنید");
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const save = async () => {
    if (!fullName.trim()) {
      toast.push("نام و نام خانوادگی نمی‌تواند خالی باشد", "error");
      return;
    }
    if (newPassword && newPassword.length < 8) {
      toast.push("رمز عبور جدید باید حداقل ۸ کاراکتر باشد", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ user: Me }>("/api/me", {
        method: "PATCH",
        body: JSON.stringify({
          fullName: fullName.trim(),
          bio,
          phone,
          email,
          avatarColor,
          avatarUrl,
          ...(newPassword ? { currentPassword, newPassword } : {}),
        }),
      });
      onSaved(res.user);
      toast.push("پروفایل شما ذخیره شد");
      onClose();
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="پروفایل و تنظیمات حساب"
      subtitle="عکس پروفایل، مشخصات و رمز عبور شما به‌صورت دائمی در سامانه ذخیره می‌شود."
    >
      <div className="space-y-4">
        {/* بخش عکس پروفایل */}
        <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-slate-50 p-3.5">
          <div className="relative">
            <Avatar name={fullName || user.fullName} color={avatarColor} src={avatarUrl} size={68} ring />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => void handleAvatarFile(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              title="تغییر عکس پروفایل"
              className="absolute -bottom-1 -left-1 grid size-7 place-items-center rounded-full bg-indigo-600 text-white shadow-md ring-2 ring-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-extrabold text-slate-800">{user.fullName}</p>
              <Badge tone="indigo">{roleLabel[user.role]}</Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-400" dir="ltr">
              @{user.username}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Camera className="size-3.5" />
                {avatarUrl ? "تغییر عکس" : "آپلود عکس پروفایل"}
              </Button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  <Trash2 className="size-3" /> حذف عکس
                </button>
              )}
            </div>
          </div>
        </div>

        {/* رنگ آواتار */}
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">رنگ نمایه (در صورت نبود عکس)</span>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAvatarColor(c)}
                className={`size-7 rounded-full transition ${
                  avatarColor === c ? "scale-110 ring-2 ring-slate-800 ring-offset-2" : "opacity-80 hover:opacity-100"
                }`}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>

        <Field label="نام و نام خانوادگی">
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={120} />
        </Field>

        <Field label="درباره من / بیوگرافی" hint="اختیاری">
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            maxLength={400}
            placeholder="توضیح کوتاه درباره‌ی خودتان…"
            className="min-h-16"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="شماره تماس">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0912…" dir="ltr" />
          </Field>
          <Field label="ایمیل">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              dir="ltr"
            />
          </Field>
        </div>

        {/* تغییر رمز عبور */}
        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <KeyRound className="size-3.5 text-indigo-500" />
            تغییر رمز عبور (اختیاری)
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="رمز فعلی">
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
              />
            </Field>
            <Field label="رمز جدید" hint="حداقل ۸ کاراکتر">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
              />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={save} loading={saving} disabled={uploading}>
            <Save className="size-4" /> ذخیره تغییرات
          </Button>
        </div>
      </div>
    </Modal>
  );
}
