"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UserCheck,
} from "lucide-react";
import { api, errorMessage, useApi } from "@/lib/client";
import { fa, deadlineLabel, isPast, jalaliDateTime, statusLabel } from "@/lib/format";
import type { AssignmentItem, Me, SubmissionItem } from "@/lib/types";
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
  Progress,
  Select,
  Tabs,
  Textarea,
  useToast,
} from "./ui";
import type { Meta } from "./Shell";

type Filter = "all" | "pending" | "done";

export default function Assignments({ user }: { user: Me }) {
  const toast = useToast();
  const { data, loading, error, reload } = useApi<{
    items: AssignmentItem[];
    canCreate: boolean;
  }>("/api/assignments");
  const { data: meta } = useApi<Meta>("/api/meta");
  const [filter, setFilter] = useState<Filter>("all");
  const [classFilter, setClassFilter] = useState<string>("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const items = useMemo(() => {
    let list = data?.items ?? [];
    if (classFilter) list = list.filter((a) => String(a.classId) === classFilter);
    if (filter === "pending")
      list = list.filter((a) =>
        user.role === "student"
          ? !a.mySubmissionId && !isPast(a.dueAt)
          : (a.submissionCount ?? 0) < (a.studentCount ?? 0),
      );
    if (filter === "done")
      list = list.filter((a) =>
        user.role === "student" ? Boolean(a.mySubmissionId) : (a.gradedCount ?? 0) > 0,
      );
    return list;
  }, [data, filter, classFilter, user.role]);

  return (
    <div>
      <PageHeader
        title="تکالیف"
        subtitle={
          user.role === "student"
            ? "تکالیف کلاس را ببینید، پاسخ بفرستید و نمره بگیرید"
            : "تکالیف ثبت‌شده، پاسخ‌های دانش‌آموزان و نمره‌دهی"
        }
        action={
          data?.canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> تکلیف جدید
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tabs
          tabs={[
            { id: "all", label: "همه" },
            { id: "pending", label: "در جریان" },
            { id: "done", label: "انجام‌شده" },
          ]}
          value={filter}
          onChange={(id) => setFilter(id as Filter)}
        />
        <div className="mb-4 mr-auto w-40">
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">همه‌ی کلاس‌ها</option>
            {(meta?.classes ?? []).map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

      {loading && !data ? (
        <LoadingBlock rows={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-5" />}
          title="تکلیفی در این فیلتر نیست"
          description="فیلتر را تغییر دهید یا بعداً سر بزنید."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((assignment) => {
            const overdue = isPast(assignment.dueAt);
            const submitted = Boolean(assignment.mySubmissionId);
            return (
              <li key={assignment.id} className="card flex flex-col p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="grid size-9 shrink-0 place-items-center rounded-xl text-[11px] font-black text-white"
                      style={{ backgroundColor: assignment.subjectColor }}
                    >
                      {assignment.subjectName.slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-extrabold text-slate-800">
                        {assignment.title}
                      </h3>
                      <p className="text-[10px] text-slate-500">
                        {assignment.className} · {assignment.subjectName}
                      </p>
                    </div>
                  </div>
                  {user.role === "student" ? (
                    assignment.mySubmissionStatus === "graded" ? (
                      <Badge tone="emerald">
                        <CheckCircle2 className="size-3" />
                        {fa(Number(assignment.myScore ?? 0).toFixed(1))} از {fa(Number(assignment.maxScore))}
                      </Badge>
                    ) : submitted ? (
                      <Badge tone="sky">{statusLabel[assignment.mySubmissionStatus ?? ""] ?? "ارسال شد"}</Badge>
                    ) : overdue ? (
                      <Badge tone="rose">مهلت گذشته</Badge>
                    ) : (
                      <Badge tone="amber">
                        <Clock3 className="size-3" /> {deadlineLabel(assignment.dueAt)}
                      </Badge>
                    )
                  ) : (
                    <Badge tone={overdue ? "slate" : "indigo"}>
                      {fa(assignment.submissionCount ?? 0)}/{fa(assignment.studentCount ?? 0)} پاسخ
                    </Badge>
                  )}
                </div>

                <p className="user-text mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">
                  {assignment.description || "بدون توضیح"}
                </p>

                {user.role !== "student" && (
                  <div className="mt-3">
                    <Progress
                      value={
                        assignment.studentCount
                          ? ((assignment.submissionCount ?? 0) / assignment.studentCount) * 100
                          : 0
                      }
                      tone="indigo"
                    />
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <p className="text-[10px] text-slate-400">
                    مهلت: {jalaliDateTime(assignment.dueAt)}
                  </p>
                  <Button size="sm" variant="soft" onClick={() => setOpenId(assignment.id)}>
                    {user.role === "student"
                      ? submitted
                        ? "مشاهده‌ی پاسخ"
                        : "ارسال پاسخ"
                      : "بررسی پاسخ‌ها"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AssignmentDetail
        id={openId}
        user={user}
        onClose={() => setOpenId(null)}
        onChanged={reload}
      />

      <CreateAssignment
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        meta={meta}
        onCreated={reload}
      />
    </div>
  );
}

/* ---------------------------- جزئیات تکلیف ------------------------------- */

type Detail = {
  assignment: AssignmentItem;
  submissions: SubmissionItem[];
  canManage: boolean;
};

function AssignmentDetail({
  id,
  user,
  onClose,
  onChanged,
}: {
  id: number | null;
  user: Me;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { data, loading, reload } = useApi<Detail>(id ? `/api/assignments/${id}` : null);
  const [answer, setAnswer] = useState("");
  const [answerImage, setAnswerImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [grading, setGrading] = useState<SubmissionItem | null>(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setAnswer("");
    setAnswerImage(null);
    setGrading(null);
  }, [id]);

  const mySubmission = data?.submissions?.[0] ?? null;
  const canDeleteAssignment =
    Boolean(data) && (user.role === "admin" || data?.assignment.teacherId === user.id);

  const submitAnswer = async () => {
    if (!id) return;
    if (!answer.trim() && !answerImage) {
      toast.push("متن پاسخ یا تصویر پاسخ را ارسال کنید", "error");
      return;
    }
    setSaving(true);
    try {
      await api(`/api/assignments/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ content: answer, imageUrl: answerImage }),
      });
      toast.push("پاسخ شما ثبت شد");
      await reload();
      onChanged();
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const openGrade = (submission: SubmissionItem) => {
    setGrading(submission);
    setScore(submission.score ?? "");
    setFeedback(submission.feedback ?? "");
  };

  const saveGrade = async () => {
    if (!grading) return;
    setSaving(true);
    try {
      await api(`/api/submissions/${grading.id}/grade`, {
        method: "POST",
        body: JSON.stringify({ score: Number(score), feedback }),
      });
      toast.push("نمره ثبت شد");
      setGrading(null);
      await reload();
      onChanged();
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const max = Number(data?.assignment.maxScore ?? 20);

  return (
    <>
    <Modal
      open={id !== null}
      onClose={onClose}
      wide
      title={data?.assignment.title ?? "جزئیات تکلیف"}
      subtitle={
        data
          ? `${data.assignment.className} · ${data.assignment.subjectName} · مهلت ${jalaliDateTime(data.assignment.dueAt)}`
          : undefined
      }
    >
      {loading || !data ? (
        <LoadingBlock rows={2} />
      ) : (
        <div className="space-y-4">
          {canDeleteAssignment && (
            <div className="flex justify-end">
              <Button size="sm" variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-3.5" /> حذف تکلیف
              </Button>
            </div>
          )}
          <div className="rounded-2xl bg-slate-50 p-3.5">
            <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
              <BookOpenCheck className="size-3.5 text-indigo-500" /> شرح تکلیف
            </p>
            <p className="user-text text-xs leading-6 whitespace-pre-line text-slate-600">
              {data.assignment.description || "توضیحی ثبت نشده است."}
            </p>
            {data.assignment.imageUrl && (
              <div className="mt-3">
                <ImageAttachment src={data.assignment.imageUrl} alt="تصویر تکلیف" className="max-h-72" />
              </div>
            )}
          </div>

          {user.role === "student" ? (
            mySubmission ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 p-3.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-600">پاسخ ارسالی شما</p>
                    <Badge tone={mySubmission.status === "graded" ? "emerald" : "sky"}>
                      {statusLabel[mySubmission.status]}
                    </Badge>
                  </div>
                  {mySubmission.content && (
                    <p className="user-text text-xs leading-6 whitespace-pre-line text-slate-600">
                      {mySubmission.content}
                    </p>
                  )}
                  {mySubmission.imageUrl && (
                    <div className="mt-2">
                      <ImageAttachment src={mySubmission.imageUrl} alt="تصویر پاسخ" className="max-h-64" />
                    </div>
                  )}
                  <p className="mt-2 text-[10px] text-slate-400">
                    ارسال: {jalaliDateTime(mySubmission.submittedAt)}
                  </p>
                </div>

                {mySubmission.status === "graded" ? (
                  <div className="rounded-2xl bg-emerald-50 p-3.5 ring-1 ring-emerald-200">
                    <div className="flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                        <Sparkles className="size-3.5" /> نمره‌ی شما
                      </p>
                      <p className="text-lg font-black text-emerald-700">
                        {fa(Number(mySubmission.score ?? 0).toFixed(1))}
                        <span className="text-xs font-bold text-emerald-500"> / {fa(max)}</span>
                      </p>
                    </div>
                    {mySubmission.feedback && (
                      <p className="user-text mt-1.5 text-[11px] leading-6 text-emerald-800">
                        {mySubmission.feedback}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                    پاسخ شما ثبت شده و در انتظار تصحیح دبیر است.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Field label="پاسخ شما" hint="متن یا تصویر پاسخ (یا هر دو)">
                  <Textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    rows={5}
                    placeholder="پاسخ خود را اینجا بنویسید…"
                  />
                </Field>
                <ImageUploader
                  folder="submissions"
                  value={answerImage}
                  onChange={setAnswerImage}
                  label="پیوست تصویر پاسخ (مثلاً عکس برگه‌ی حل‌شده)"
                />
                {isPast(data.assignment.dueAt) && (
                  <p className="rounded-xl bg-rose-50 px-3 py-2 text-[11px] text-rose-600">
                    مهلت این تکلیف گذشته است؛ ارسال شما با برچسب «تأخیر» ثبت می‌شود.
                  </p>
                )}
                <div className="flex justify-end">
                  <Button onClick={submitAnswer} loading={saving}>
                    <Send className="size-4" /> ارسال پاسخ
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <UserCheck className="size-4 text-indigo-500" />
                  پاسخ‌های دریافت‌شده ({fa(data.submissions.length)})
                </p>
              </div>
              {data.submissions.length === 0 ? (
                <EmptyState
                  icon={<ClipboardList className="size-5" />}
                  title="هنوز پاسخی ثبت نشده است"
                  description="دانش‌آموزان می‌توانند تا مهلت مقرر پاسخ بفرستند."
                />
              ) : (
                <ul className="max-h-80 space-y-2 overflow-y-auto pl-1">
                  {data.submissions.map((submission) => (
                    <li
                      key={submission.id}
                      className="rounded-xl border border-slate-100 p-3 transition hover:border-indigo-100"
                    >
                      <div className="flex items-start gap-2">
                        <Avatar
                          name={submission.studentName}
                          color={submission.studentColor}
                          src={submission.studentAvatar}
                          size={32}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-xs font-bold text-slate-800">
                              {submission.studentName}
                            </p>
                            <Badge tone={submission.status === "graded" ? "emerald" : "amber"}>
                              {statusLabel[submission.status]}
                            </Badge>
                            {submission.score != null && (
                              <span className="text-[10px] font-bold text-emerald-600">
                                {fa(Number(submission.score).toFixed(1))} / {fa(max)}
                              </span>
                            )}
                          </div>
                          {submission.content && (
                            <p className="user-text mt-1 line-clamp-2 text-[11px] leading-5 text-slate-500">
                              {submission.content}
                            </p>
                          )}
                          {submission.imageUrl && (
                            <div className="mt-1.5">
                              <ImageAttachment
                                src={submission.imageUrl}
                                alt={`پاسخ ${submission.studentName}`}
                                className="max-h-40"
                              />
                            </div>
                          )}
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">
                              {jalaliDateTime(submission.submittedAt)}
                            </span>
                            <Button
                              size="sm"
                              variant="soft"
                              className="mr-auto"
                              onClick={() => openGrade(submission)}
                            >
                              {submission.status === "graded" ? "ویرایش نمره" : "ثبت نمره"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {grading && (
                <div className="mt-3 rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3.5">
                  <p className="mb-2 text-xs font-bold text-indigo-800">
                    نمره‌دهی به {grading.studentName}
                  </p>
                  {grading.content && (
                    <p className="user-text mb-3 rounded-xl bg-white p-2.5 text-[11px] leading-5 text-slate-600">
                      {grading.content}
                    </p>
                  )}
                  {grading.imageUrl && (
                    <div className="mb-3">
                      <ImageAttachment src={grading.imageUrl} alt="پاسخ دانش‌آموز" className="max-h-72" />
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                    <Field label={`نمره (از ${fa(max)})`}>
                      <Input
                        type="number"
                        min={0}
                        max={max}
                        step={0.25}
                        value={score}
                        onChange={(e) => setScore(e.target.value)}
                      />
                    </Field>
                    <Field label="بازخورد">
                      <Input
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="مثلاً پاسخ‌ها دقیق بود…"
                      />
                    </Field>
                  </div>
                  <div className="mt-2 flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setGrading(null)}>
                      انصراف
                    </Button>
                    <Button size="sm" onClick={saveGrade} loading={saving}>
                      ثبت نمره
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
    <DeleteConfirmModal
      open={deleteOpen}
      onClose={() => setDeleteOpen(false)}
      title="حذف تکلیف"
      description="تکلیف به‌همراه همه‌ی پاسخ‌ها و تصاویر ارسالی حذف می‌شود. رمز حذف سامانه را وارد کنید."
      onConfirm={async (deletePassword) => {
        if (!id) return;
        await api(`/api/assignments/${id}`, {
          method: "DELETE",
          body: JSON.stringify({ deletePassword }),
        });
        toast.push("تکلیف حذف شد", "info");
        onChanged();
        onClose();
      }}
    />
    </>
  );
}

/* ---------------------------- ساخت تکلیف -------------------------------- */

function CreateAssignment({
  open,
  onClose,
  meta,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  meta: Meta | null;
  onCreated: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    classId: "",
    subjectId: "",
    title: "",
    description: "",
    dueAt: "",
    maxScore: "20",
    imageUrl: null as string | null,
  });

  const subjects = useMemo(() => {
    if (!form.classId) return meta?.subjects ?? [];
    const allowed = (meta?.teaching ?? [])
      .filter((t) => String(t.classId) === form.classId)
      .map((t) => t.subjectId);
    if (allowed.length === 0) return meta?.subjects ?? [];
    return (meta?.subjects ?? []).filter((s) => allowed.includes(s.id));
  }, [meta, form.classId]);

  useEffect(() => {
    if (!form.classId && meta?.classes?.[0]) {
      setForm((prev) => ({ ...prev, classId: String(meta.classes[0].id) }));
    }
  }, [meta, form.classId]);

  useEffect(() => {
    if (!form.subjectId && subjects[0]) {
      setForm((prev) => ({ ...prev, subjectId: String(subjects[0].id) }));
    }
  }, [subjects, form.subjectId]);

  const submit = async () => {
    if (!form.title.trim() || !form.classId || !form.subjectId || !form.dueAt) {
      toast.push("همه‌ی فیلدهای ضروری را کامل کنید", "error");
      return;
    }
    setSaving(true);
    try {
      await api("/api/assignments", {
        method: "POST",
        body: JSON.stringify({
          classId: Number(form.classId),
          subjectId: Number(form.subjectId),
          title: form.title,
          description: form.description,
          imageUrl: form.imageUrl,
          dueAt: new Date(form.dueAt).toISOString(),
          maxScore: Number(form.maxScore),
        }),
      });
      toast.push("تکلیف ایجاد شد");
      setForm({ ...form, title: "", description: "", dueAt: "", imageUrl: null });
      onClose();
      onCreated();
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="تکلیف جدید" subtitle="برای یک کلاس و درس مشخص">
      <div className="space-y-3">
        {(meta?.classes ?? []).length === 0 && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-700 ring-1 ring-amber-200">
            هنوز کلاسی به شما تخصیص داده نشده است. ابتدا مدیر مدرسه کلاس و درس شما را در «مدیریت سامانه» ثبت کند.
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="کلاس">
            <Select
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value, subjectId: "" })}
            >
              {(meta?.classes ?? []).map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="درس">
            <Select
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="عنوان">
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="مثلاً حل تمرین‌های فصل ۲"
            maxLength={160}
          />
        </Field>
        <Field label="توضیحات">
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            placeholder="شرح تکلیف و شرایط تحویل…"
          />
        </Field>
        <ImageUploader
          folder="assignments"
          value={form.imageUrl}
          onChange={(imageUrl) => setForm({ ...form, imageUrl })}
          label="پیوست تصویر صورت‌سؤال یا جزوه (اختیاری)"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="مهلت تحویل">
            <Input
              type="datetime-local"
              value={form.dueAt}
              onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
            />
          </Field>
          <Field label="بارم">
            <Input
              type="number"
              min={1}
              max={100}
              value={form.maxScore}
              onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={submit} loading={saving} disabled={(meta?.classes ?? []).length === 0}>
            ایجاد تکلیف
          </Button>
        </div>
      </div>
    </Modal>
  );
}
