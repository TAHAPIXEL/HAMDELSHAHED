"use client";

import { useMemo, useRef, useState } from "react";
import { Megaphone, Plus, Trash2, ImagePlus, X } from "lucide-react";
import {
  DB,
  faDateTime,
  uploadImage,
  isStaff,
  canAdminPanel,
  readNoticeKey,
  recordNoticeRead,
  uid,
  visibleNotices,
  type Notice,
  type User,
} from "@/lib/model";
import { Avatar, Btn, Confirm, Empty, Field, Modal, Chip, inputCls, useDbTick, useToast } from "./ui";

export default function Notices({ user }: { user: User }) {
  useDbTick();
  const toast = useToast();
  const [showNew, setShowNew] = useState(false);
  const [del, setDel] = useState<Notice | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // بدون memo — همیشه تازه‌ترین اطلاعیه‌ها
  const notices = visibleNotices(user);
  const reads = DB.noticeReads();

  const open = (n: Notice) => {
    setExpanded(expanded === n.id ? null : n.id);
    recordNoticeRead(user.id, n.id);
  };

  const remove = (n: Notice) => {
    DB.saveNotices(DB.notices().filter((x) => x.id !== n.id));
    toast("success", "اطلاعیه حذف شد");
  };

  const staffName = (id: string) => {
    const u = DB.users().find((x) => x.id === id);
    return u ? `${u.firstName} ${u.lastName}` : "مدیریت مدرسه";
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        {isStaff(user) && (
          <Btn className="mb-5" onClick={() => setShowNew(true)}>
            <Plus className="size-4" />
            انتشار اطلاعیه جدید
          </Btn>
        )}
        {notices.length === 0 && (
          <Empty
            icon={<Megaphone className="size-7" />}
            title="اطلاعیه‌ای وجود ندارد"
            desc={isStaff(user) ? "اولین اطلاعیه مدرسه را منتشر کنید" : "وقتی مدرسه اطلاعیه‌ای منتشر کند، اینجا می‌آید"}
          />
        )}
        <div className="stagger space-y-3">
          {notices.map((n) => {
            const unread = !reads[readNoticeKey(user.id, n.id)];
            const open_ = expanded === n.id;
            return (
              <div key={n.id} className={`card overflow-hidden transition ${unread ? "ring-1 ring-indigo-400/40" : ""}`}>
                <button onClick={() => open(n)} className="flex w-full items-center gap-3.5 p-4 text-right">
                  <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${unread ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/25" : "bg-slate-100 text-slate-400"}`}>
                    <Megaphone className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {unread && <span className="size-2 shrink-0 rounded-full bg-rose-500" />}
                      <span className="truncate text-sm font-black text-slate-800">{n.title}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold text-slate-400">
                      <span>{staffName(n.createdBy)}</span>
                      <span>•</span>
                      <span>{faDateTime(n.createdAt)}</span>
                      {n.audience !== "all" && (
                        <Chip tone={n.audience === "students" ? "indigo" : "violet"}>
                          {n.audience === "students" ? "ویژه دانش‌آموزان" : "ویژه کادر"}
                        </Chip>
                      )}
                    </div>
                  </div>
                </button>
                {open_ && (
                  <div className="anim-fade-up border-t border-slate-100 px-5 py-4">
                    {n.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={n.image} alt={n.title} className="mb-3 max-h-72 w-full rounded-2xl object-cover" />
                    )}
                    <p className="user-text whitespace-pre-wrap text-sm leading-8 text-slate-600">{n.body}</p>
                    {(n.createdBy === user.id || canAdminPanel(user)) && (
                      <div className="mt-4 flex justify-end">
                        <Btn kind="danger" onClick={() => setDel(n)}>
                          <Trash2 className="size-4" />
                          حذف اطلاعیه
                        </Btn>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showNew && <NewNoticeModal user={user} onClose={() => setShowNew(false)} />}
      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onYes={() => del && remove(del)}
        title="حذف اطلاعیه"
        desc={`«${del?.title}» برای همه حذف می‌شود. مطمئن هستید؟`}
        yesLabel="حذف"
      />
    </div>
  );
}

function NewNoticeModal({ user, onClose }: { user: User; onClose: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Notice["audience"]>("all");
  const [image, setImage] = useState<string | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const publish = () => {
    if (!title.trim()) return toast("error", "عنوان اطلاعیه را بنویسید");
    if (!body.trim()) return toast("error", "متن اطلاعیه را بنویسید");
    const notices = DB.notices();
    notices.push({
      id: uid("n"),
      title: title.trim(),
      body: body.trim(),
      image,
      audience,
      createdBy: user.id,
      createdAt: Date.now(),
    });
    DB.saveNotices(notices);
    toast("success", "اطلاعیه منتشر شد");
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="انتشار اطلاعیه جدید" icon={<Megaphone className="size-5 text-indigo-500" />}>
      <div className="space-y-4">
        <Field label="عنوان اطلاعیه" required>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً مراسم جشن پایان سال" />
        </Field>
        <Field label="متن اطلاعیه" required>
          <textarea rows={5} className={`${inputCls} resize-none leading-7`} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label="مخاطبان" required>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { v: "all", l: "همه" },
                { v: "students", l: "دانش‌آموزان" },
                { v: "staff", l: "کادر مدرسه" },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                onClick={() => setAudience(o.v)}
                className={`rounded-xl border px-3 py-2.5 text-[13px] font-bold transition ${
                  audience === o.v
                    ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-500"
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </Field>
        <Field label="تصویر (اختیاری)">
          {image ? (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image} alt="اطلاعیه" className="max-h-40 rounded-2xl object-cover" />
              <button onClick={() => setImage(undefined)} className="absolute -left-2 -top-2 rounded-full bg-rose-500 p-1.5 text-white shadow" aria-label="حذف تصویر">
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 px-3 py-4 text-[13px] font-bold text-slate-500 transition hover:border-indigo-300 hover:text-indigo-600"
            >
              <ImagePlus className="size-4.5" />
              افزودن تصویر
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                try {
                  setImage(await uploadImage(f, 1000, 0.72));
                } catch (err) {
                  toast("error", (err as Error).message || "بارگذاری تصویر ممکن نشد");
                }
              }
              e.target.value = "";
            }}
          />
        </Field>
        <Btn className="w-full" onClick={publish}>انتشار اطلاعیه</Btn>
      </div>
    </Modal>
  );
}
