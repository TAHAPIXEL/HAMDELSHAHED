"use client";

import { useRef, useState } from "react";
import { useDraft } from "@/lib/drafts";
import {
  BookOpen,
  Plus,
  Trash2,
  GraduationCap,
  CircleCheckBig,
  RotateCcw,
  CalendarDays,
  Send,
  Pencil,
  Lock,
  ImagePlus,
  X,
} from "lucide-react";
import {
  DB,
  JALALI_MONTHS,
  SECTIONS,
  className,
  fa,
  faDateTime,
  uploadImage,
  isStaff,
  canTeach,
  jalaaliDaysOfMonth,
  todayJalali,
  uid,
  type Grade,
  type Homework as Hw,
  type HwSub,
  type User,
} from "@/lib/model";
import { Avatar, Btn, Chip, Confirm, Empty, Field, Modal, inputCls, useDbTick, useToast } from "./ui";

export default function Homework({ user }: { user: User }) {
  useDbTick();
  const student = user.role === "student";
  const teach = canTeach(user); // فقط دبیران و مدیران می‌توانند تکلیف بدهند
  const list = DB.homeworks()
    .filter((h) => (student ? h.grade === user.grade && h.section === user.section : true))
    .sort((a, b) => b.createdAt - a.createdAt);

  const toast = useToast();
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<Hw | null>(null);
  const [subsOf, setSubsOf] = useState<Hw | null>(null);
  const [answerOf, setAnswerOf] = useState<Hw | null>(null);
  const [del, setDel] = useState<Hw | null>(null);

  const mySub = (h: Hw) => DB.hwsubs().find((s) => s.homeworkId === h.id && s.studentId === user.id);

  const remove = (h: Hw) => {
    DB.saveHomeworks(DB.homeworks().filter((x) => x.id !== h.id));
    DB.saveHwsubs(DB.hwsubs().filter((s) => s.homeworkId !== h.id));
    toast("success", "تکلیف حذف شد");
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        {teach && (
          <Btn className="mb-5" onClick={() => setCreate(true)}>
            <Plus className="size-4" />
            تعیین تکلیف جدید
          </Btn>
        )}

        {list.length === 0 && (
          <Empty
            icon={<BookOpen className="size-7" />}
            title="تکلیفی وجود ندارد"
            desc={teach ? "اولین تکلیف را برای کلاس تعیین کنید" : "تکالیف تعیین‌شده اینجا نمایش داده می‌شود"}
          />
        )}

        <div className="stagger space-y-3">
          {list.map((h) => {
            const sub = student ? mySub(h) : undefined;
            const subs = DB.hwsubs().filter((s) => s.homeworkId === h.id);
            const submittedCount = subs.length;
            return (
              <div key={h.id} className="card p-4 sm:p-5">
                <div className="flex items-start gap-3.5">
                  <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${h.closed ? "bg-gradient-to-br from-slate-400 to-slate-500" : "bg-gradient-to-br from-teal-500 to-emerald-600 shadow-teal-600/20"}`}>
                    <BookOpen className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-black text-slate-800 dark:text-slate-100">{h.title}</span>
                      {h.closed ? <Chip>بسته</Chip> : <Chip tone="green">باز</Chip>}
                      {h.due && (
                        <Chip tone="amber">
                          <CalendarDays className="size-3" />
                          موعد: {fa(h.due)}
                        </Chip>
                      )}
                    </div>
                    <div className="mt-1 text-[12px] font-semibold text-slate-400">
                      کلاس {className(h.grade, h.section)}
                      {isStaff(user) && ` • ${fa(submittedCount)} تحویل`}
                    </div>
                  </div>
                </div>
                {h.description && <p className="user-text mt-3 whitespace-pre-wrap text-[13px] leading-7 text-slate-500 dark:text-slate-400">{h.description}</p>}

                {student && (
                  <div className="mt-4">
                    {!h.closed ? (
                      <Btn onClick={() => setAnswerOf(h)}>
                        <Send className="size-4" />
                        {sub ? "ویرایش پاسخم" : "تحویل تکلیف"}
                      </Btn>
                    ) : (
                      <Chip>مهلت این تکلیف به پایان رسیده</Chip>
                    )}
                    {sub && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {sub.status === "approved" ? (
                          <Chip tone="green"><CircleCheckBig className="size-3.5" /> تأیید شد</Chip>
                        ) : sub.status === "returned" ? (
                          <Chip tone="red"><RotateCcw className="size-3.5" /> برگشت برای اصلاح</Chip>
                        ) : (
                          <Chip tone="amber">تحویل شد — در انتظار بررسی دبیر</Chip>
                        )}
                        {sub.note && <span className="text-[12px] font-semibold text-slate-400">یادداشت دبیر: {sub.note}</span>}
                      </div>
                    )}
                  </div>
                )}

                {isStaff(user) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Btn kind="soft" onClick={() => setSubsOf(h)}>
                      <GraduationCap className="size-4" />
                      پاسخ‌ها ({fa(subs.length)})
                    </Btn>
                    <Btn kind="ghost" onClick={() => setEdit(h)}>
                      <Pencil className="size-4" />
                      ویرایش
                    </Btn>
                    {!h.closed ? (
                      <Btn kind="ghost" onClick={() => {
                        DB.saveHomeworks(DB.homeworks().map((x) => x.id === h.id ? { ...x, closed: true } : x));
                        toast("success", "تکلیف بسته شد");
                      }}>
                        <Lock className="size-4" />
                        بستن
                      </Btn>
                    ) : (
                      <Btn kind="ghost" onClick={() => {
                        DB.saveHomeworks(DB.homeworks().map((x) => x.id === h.id ? { ...x, closed: false } : x));
                        toast("success", "تکلیف دوباره باز شد");
                      }}>
                        باز کردن مجدد
                      </Btn>
                    )}
                    <Btn kind="danger" onClick={() => setDel(h)}>
                      <Trash2 className="size-4" />
                    </Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {(create || edit) && (
        <HwForm hw={edit} user={user} onClose={() => { setCreate(false); setEdit(null); }} />
      )}
      {subsOf && <SubsModal hw={subsOf} onClose={() => setSubsOf(null)} />}
      {answerOf && <AnswerModal hw={answerOf} user={user} onClose={() => setAnswerOf(null)} />}
      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onYes={() => del && remove(del)}
        title="حذف تکلیف"
        desc={`«${del?.title}» و همه پاسخ‌های آن حذف می‌شود.`}
        yesLabel="حذف"
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// فرم تعیین / ویرایش تکلیف
// ----------------------------------------------------------------------------

function HwForm({ hw, user, onClose }: { hw: Hw | null; user: User; onClose: () => void }) {
  const toast = useToast();
  const tj = todayJalali();
  const [title, setTitle] = useState(hw?.title ?? "");
  const [desc, setDesc] = useState(hw?.description ?? "");
  const [grade, setGrade] = useState<Grade>(hw?.grade ?? 7);
  const [section, setSection] = useState(hw?.section ?? "1");
  const [useDue, setUseDue] = useState(!!hw?.due);
  const [dy, setDy] = useState(tj.jy);
  const [dm, setDm] = useState(tj.jm);
  const [dd, setDd] = useState(tj.jd);

  const save = () => {
    if (!title.trim()) return toast("error", "عنوان تکلیف را بنویسید");
    const homeworks = DB.homeworks();
    const due = useDue ? `${dy}/${dm}/${dd}` : undefined;
    if (hw) {
      const idx = homeworks.findIndex((x) => x.id === hw.id);
      homeworks[idx] = { ...homeworks[idx], title: title.trim(), description: desc.trim(), grade, section, due };
    } else {
      homeworks.push({
        id: uid("hw"),
        title: title.trim(),
        description: desc.trim() || undefined,
        grade,
        section,
        due,
        createdBy: user.id,
        createdAt: Date.now(),
      });
    }
    DB.saveHomeworks(homeworks);
    toast("success", hw ? "تکلیف به‌روزرسانی شد" : "تکلیف برای دانش‌آموزان کلاس تعیین شد");
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={hw ? "ویرایش تکلیف" : "تعیین تکلیف جدید"} icon={<BookOpen className="size-5 text-teal-500" />}>
      <div className="space-y-4">
        <Field label="عنوان تکلیف" required>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً تمرین‌های صفحه ۴۲ کتاب" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="پایه" required>
            <select className={inputCls} value={grade} onChange={(e) => { setGrade(Number(e.target.value) as Grade); setSection("1"); }}>
              {([7, 8, 9] as Grade[]).map((g) => (
                <option key={g} value={g}>پایه {className(g, "1").split(" ")[0]}</option>
              ))}
            </select>
          </Field>
          <Field label="شعبه" required>
            <select className={inputCls} value={section} onChange={(e) => setSection(e.target.value)}>
              {SECTIONS[grade].map((s) => (
                <option key={s} value={s}>شعبه {s}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="متن تکلیف (اختیاری)">
          <textarea rows={3} className={`${inputCls} resize-none leading-7`} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <div>
          <label className="mb-2 flex items-center gap-2 text-[13px] font-bold text-slate-600 dark:text-slate-300">
            <input type="checkbox" checked={useDue} onChange={(e) => setUseDue(e.target.checked)} className="size-4 accent-indigo-600" />
            تعیین موعد تحویل (شمسی)
          </label>
          {useDue && (
            <div className="grid grid-cols-3 gap-2">
              <select className={inputCls} value={dd} onChange={(e) => setDd(Number(e.target.value))}>
                {Array.from({ length: jalaaliDaysOfMonth(dy, dm) }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{fa(d)}</option>
                ))}
              </select>
              <select className={inputCls} value={dm} onChange={(e) => { const m = Number(e.target.value); setDm(m); setDd((d) => Math.min(d, jalaaliDaysOfMonth(dy, m))); }}>
                {JALALI_MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <select className={inputCls} value={dy} onChange={(e) => { const y = Number(e.target.value); setDy(y); setDd((d) => Math.min(d, jalaaliDaysOfMonth(y, dm))); }}>
                {[tj.jy, tj.jy + 1].map((y) => (
                  <option key={y} value={y}>{fa(y)}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <Btn className="w-full" onClick={save}>{hw ? "ذخیره تغییرات" : "تعیین تکلیف"}</Btn>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// پاسخ دانش‌آموز
// ----------------------------------------------------------------------------

function AnswerModal({ hw, user, onClose }: { hw: Hw; user: User; onClose: () => void }) {
  const toast = useToast();
  const existing = DB.hwsubs().find((s) => s.homeworkId === hw.id && s.studentId === user.id);
  // پیش‌نویس پاسخ در پایگاه‌داده می‌ماند تا بستن یا رفرش صفحه متن را از بین نبرد
  const draft = useDraft<{ text: string; images: string[] }>(
    user.id,
    "hw",
    hw.id,
    () => ({ text: existing?.text ?? "", images: existing?.images ?? [] }),
    { isEmpty: (v) => !v.text.trim() && v.images.length === 0 },
  );
  const { text, images } = draft.value;
  const setText = (t: string) => draft.set((d) => ({ ...d, text: t }));
  const setImages = (fn: (prev: string[]) => string[]) => draft.set((d) => ({ ...d, images: fn(d.images) }));
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const MAX_IMAGES = 4;

  const addImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return toast("error", `حداکثر ${fa(MAX_IMAGES)} تصویر می‌توانید پیوست کنید`);
    setBusy(true);
    try {
      const picked = files.slice(0, room);
      const urls = await Promise.all(picked.map((f) => uploadImage(f, 1000, 0.7)));
      setImages((prev) => [...prev, ...urls]);
      if (files.length > room) toast("info", `فقط ${fa(room)} تصویر اضافه شد (حداکثر ${fa(MAX_IMAGES)} تصویر)`);
    } catch (err) {
      toast("error", (err as Error).message || "بارگذاری تصویر ممکن نشد");
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!text.trim() && images.length === 0)
      return toast("error", "متن پاسخ را بنویسید یا تصویری پیوست کنید");
    const subs = DB.hwsubs();
    const idx = subs.findIndex((s) => s.homeworkId === hw.id && s.studentId === user.id);
    if (idx >= 0) {
      subs[idx] = {
        ...subs[idx],
        text: text.trim(),
        images: images.length ? images : undefined,
        submittedAt: Date.now(),
        status: "submitted" as const,
        note: undefined,
      };
    } else {
      subs.push({
        id: uid("hws"),
        homeworkId: hw.id,
        studentId: user.id,
        text: text.trim(),
        images: images.length ? images : undefined,
        submittedAt: Date.now(),
        status: "submitted" as const,
      });
    }
    DB.saveHwsubs(subs);
    draft.clear();
    toast("success", "پاسخ شما برای دبیر ارسال شد");
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`تحویل: ${hw.title}`} icon={<Send className="size-5 text-teal-500" />}>
      <div className="space-y-4">
        {hw.description && (
          <div className="user-text rounded-2xl bg-app px-4 py-3 text-[13px] leading-7 text-slate-600 dark:bg-white/5 dark:text-slate-300">
            {hw.description}
          </div>
        )}
        <Field label="پاسخ شما (متن)">
          <textarea rows={5} className={`${inputCls} resize-y leading-8`} value={text} onChange={(e) => setText(e.target.value)} placeholder="پاسخ تکلیف را اینجا بنویسید..." />
        </Field>

        <Field label={`تصویر پاسخ (اختیاری — حداکثر ${fa(MAX_IMAGES)} تصویر)`} hint="می‌توانید از برگه تکلیف خود عکس بگیرید و ارسال کنید">
          <div className="space-y-2.5">
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {images.map((img, i) => (
                  <div key={i} className="relative overflow-hidden rounded-xl ring-1 ring-line dark:ring-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={`پیوست ${fa(i + 1)}`} className="h-24 w-full object-cover" />
                    <button
                      onClick={() => setImages((prev) => prev.filter((_, xi) => xi !== i))}
                      className="absolute left-1 top-1 rounded-full bg-rose-500 p-1 text-white shadow"
                      aria-label="حذف تصویر"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {images.length < MAX_IMAGES && (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line px-3 py-4 text-[13px] font-bold text-slate-500 transition hover:border-teal-300 hover:text-teal-600 disabled:opacity-50 dark:border-white/10 dark:hover:border-teal-400/50"
              >
                <ImagePlus className="size-4.5" />
                {busy ? "در حال افزودن..." : images.length === 0 ? "افزودن تصویر" : "افزودن تصویر دیگر"}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={addImages} />
          </div>
        </Field>

        <Btn className="w-full" onClick={submit} loading={busy}>
          <Send className="size-4" />
          {existing ? "ثبت دوباره پاسخ" : "ارسال برای دبیر"}
        </Btn>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// بررسی پاسخ‌ها (کادر)
// ----------------------------------------------------------------------------

function SubsModal({ hw, onClose }: { hw: Hw; onClose: () => void }) {
  useDbTick();
  const toast = useToast();
  const [open, setOpen] = useState<HwSub | null>(null);
  const [note, setNote] = useState("");
  const [viewer, setViewer] = useState<string | null>(null);

  const students = DB.users().filter((u) => u.role === "student" && u.grade === hw.grade && u.section === hw.section);
  const subs = DB.hwsubs().filter((s) => s.homeworkId === hw.id);
  const subOf = (sid: string) => subs.find((s) => s.studentId === sid);
  const notSubmitted = students.filter((s) => !subOf(s.id));

  const setStatus = (sub: HwSub, status: "approved" | "returned") => {
    const all = DB.hwsubs();
    const idx = all.findIndex((s) => s.id === sub.id);
    all[idx] = { ...all[idx], status, note: note.trim() || undefined };
    DB.saveHwsubs(all);
    toast("success", status === "approved" ? "تأیید شد" : "برای اصلاح برگردانده شد");
    setOpen(null);
    setNote("");
  };

  return (
    <Modal open onClose={onClose} title={`پاسخ‌های «${hw.title}»`} wide icon={<GraduationCap className="size-5 text-indigo-500" />}>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[12px] font-bold">
        <Chip tone="green">تحویل‌شده: {fa(subs.length)}</Chip>
        <Chip tone="red">تحویل‌نشده: {fa(notSubmitted.length)}</Chip>
      </div>

      <div className="space-y-2">
        {subs.map((s) => {
          const st = students.find((u) => u.id === s.studentId);
          return (
            <div key={s.id} className="rounded-2xl border border-line p-3.5 dark:border-white/5">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar user={st ?? null} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-black text-slate-800 dark:text-slate-100">
                    {st ? `${st.firstName} ${st.lastName}` : "دانش‌آموز"}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-slate-400">
                    <span>{faDateTime(s.submittedAt)}</span>
                    {s.images && s.images.length > 0 && (
                      <span className="flex items-center gap-1 text-teal-600 dark:text-teal-400">
                        <ImagePlus className="size-3" />
                        {fa(s.images.length)} تصویر
                      </span>
                    )}
                  </div>
                </div>
                {s.status === "approved" ? <Chip tone="green">تأیید شد</Chip> : s.status === "returned" ? <Chip tone="red">برگشت</Chip> : <Chip tone="amber">جدید</Chip>}
                <Btn kind="soft" className="!py-2 !text-[12px]" onClick={() => { setOpen(open?.id === s.id ? null : s); setNote(s.note ?? ""); }}>
                  {open?.id === s.id ? "بستن" : "بررسی"}
                </Btn>
              </div>
              {open?.id === s.id && (
                <div className="anim-fade-up mt-3 space-y-3 border-t border-line pt-3 dark:border-white/5">
                  {s.text && (
                    <div className="user-text rounded-xl bg-app px-4 py-3 text-[13px] leading-8 text-slate-600 dark:bg-white/5 dark:text-slate-300">
                      {s.text}
                    </div>
                  )}
                  {s.images && s.images.length > 0 && (
                    <div>
                      <div className="mb-2 text-[11.5px] font-black text-slate-400">
                        تصاویر پیوست‌شده — {fa(s.images.length)} تصویر (برای بزرگ‌نمایی کلیک کنید)
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {s.images.map((img, i) => (
                          <button
                            key={i}
                            onClick={() => setViewer(img)}
                            className="overflow-hidden rounded-xl ring-1 ring-line transition hover:opacity-90 dark:ring-white/10"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt={`پیوست ${fa(i + 1)}`} className="h-24 w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <Field label="یادداشت برای دانش‌آموز (اختیاری)">
                    <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثلاً فصل سوم را دوباره مرور کن" />
                  </Field>
                  <div className="flex justify-end gap-2">
                    <Btn kind="danger" onClick={() => setStatus(s, "returned")}>
                      <RotateCcw className="size-4" />
                      برگشت برای اصلاح
                    </Btn>
                    <Btn onClick={() => setStatus(s, "approved")}>
                      <CircleCheckBig className="size-4" />
                      تأیید
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {notSubmitted.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 text-[12px] font-black text-slate-400">تحویل نداده‌اند — {fa(notSubmitted.length)} نفر</div>
          <div className="flex flex-wrap gap-1.5">
            {notSubmitted.map((s) => (
              <Chip key={s.id} tone="slate">{s.firstName} {s.lastName}</Chip>
            ))}
          </div>
        </div>
      )}

      {/* بزرگ‌نمایی تصویر پیوست */}
      {viewer && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-scrim/85 p-4 backdrop-blur-sm" onClick={() => setViewer(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewer} alt="تصویر پیوست" className="max-h-[88vh] max-w-full rounded-2xl shadow-2xl" />
          <button className="absolute left-4 top-4 rounded-full bg-surface/10 p-2.5 text-white backdrop-blur hover:bg-surface/20" aria-label="بستن">
            <X className="size-5" />
          </button>
        </div>
      )}
    </Modal>
  );
}
