"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Award,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Plus,
  Timer,
  Trash2,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { api, errorMessage, useApi } from "@/lib/client";
import { fa, isPast, jalaliDateTime } from "@/lib/format";
import type { Me, QuizDetail, QuizItem } from "@/lib/types";
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

type Filter = "active" | "upcoming" | "past" | "all";

export default function Quizzes({ user }: { user: Me }) {
  const { data, loading, error, reload } = useApi<{ items: QuizItem[]; canCreate: boolean }>(
    "/api/quizzes",
  );
  const { data: meta } = useApi<Meta>("/api/meta");
  const [filter, setFilter] = useState<Filter>("active");
  const [openId, setOpenId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const items = useMemo(() => {
    const list = data?.items ?? [];
    const now = Date.now();
    if (filter === "all") return list;
    if (filter === "active")
      return list.filter(
        (q) =>
          new Date(q.startsAt).getTime() <= now && new Date(q.endsAt).getTime() >= now,
      );
    if (filter === "upcoming") return list.filter((q) => new Date(q.startsAt).getTime() > now);
    return list.filter((q) => new Date(q.endsAt).getTime() < now);
  }, [data, filter]);

  return (
    <div>
      <PageHeader
        title="آزمون‌های آنلاین"
        subtitle={
          user.role === "student"
            ? "آزمون‌های فعال را در زمان مقرر بدهید و نتیجه را ببینید"
            : "آزمون بسازید، زمان‌بندی کنید و نتایج را تحلیل کنید"
        }
        action={
          data?.canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" /> آزمون جدید
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4">
        <Tabs
          tabs={[
            { id: "active", label: "فعال" },
            { id: "upcoming", label: "پیش‌رو" },
            { id: "past", label: "برگزارشده" },
            { id: "all", label: "همه" },
          ]}
          value={filter}
          onChange={(id) => setFilter(id as Filter)}
        />
      </div>

      {error && <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>}

      {loading && !data ? (
        <LoadingBlock rows={3} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileCheck2 className="size-5" />}
          title="آزمونی در این بخش نیست"
          description="با تغییر فیلتر، آزمون‌های دیگر را ببینید."
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((quiz) => {
            const now = Date.now();
            const upcoming = new Date(quiz.startsAt).getTime() > now;
            const finished = new Date(quiz.endsAt).getTime() < now;
            const taken = quiz.myAttemptStatus === "submitted";
            return (
              <li key={quiz.id} className="card flex flex-col p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-xl text-[11px] font-black text-white"
                    style={{ backgroundColor: quiz.subjectColor }}
                  >
                    {quiz.subjectName.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-extrabold text-slate-800">{quiz.title}</h3>
                    <p className="text-[10px] text-slate-500">
                      {quiz.className} · {fa(quiz.questionCount)} سؤال · {fa(quiz.durationMinutes)} دقیقه
                    </p>
                  </div>
                  {upcoming ? (
                    <Badge tone="amber">آینده</Badge>
                  ) : finished ? (
                    <Badge tone="slate">پایان‌یافته</Badge>
                  ) : (
                    <Badge tone="emerald">فعال</Badge>
                  )}
                </div>

                <p className="line-clamp-2 text-[11px] leading-5 text-slate-500">
                  {quiz.description || "بدون توضیح"}
                </p>

                <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                  <span>شروع: {jalaliDateTime(quiz.startsAt)}</span>
                </div>

                {user.role !== "student" && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                      <span>{fa(quiz.attemptCount)} از {fa(quiz.participantCount)} نفر شرکت کرده‌اند</span>
                      <span>{fa(quiz.avgPercent)}٪ میانگین</span>
                    </div>
                    <Progress
                      value={quiz.participantCount ? (quiz.attemptCount / quiz.participantCount) * 100 : 0}
                      tone="violet"
                    />
                  </div>
                )}

                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  {user.role === "student" ? (
                    taken ? (
                      <Badge tone="emerald">
                        <Award className="size-3" /> نمره: {fa(Number(quiz.myScore ?? 0))} از{" "}
                        {fa(Number(quiz.maxScore))}
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-slate-400">
                        {quiz.myAttemptId ? "در حال انجام" : "شرکت نکرده‌اید"}
                      </span>
                    )
                  ) : (
                    <span className="text-[10px] text-slate-400">{quiz.teacherName}</span>
                  )}
                  <Button
                    size="sm"
                    variant={user.role === "student" && !taken && !upcoming && !finished ? "primary" : "soft"}
                    onClick={() => setOpenId(quiz.id)}
                  >
                    {user.role === "student"
                      ? taken
                        ? "نتیجه"
                        : upcoming
                          ? "جزئیات"
                          : finished
                            ? "جزئیات"
                            : "شرکت در آزمون"
                      : "نتایج و سؤالات"}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <QuizDialog id={openId} user={user} onClose={() => setOpenId(null)} onChanged={reload} />
      <CreateQuiz open={createOpen} onClose={() => setCreateOpen(false)} meta={meta} onCreated={reload} />
    </div>
  );
}

/* --------------------------- پنجره‌ی آزمون ------------------------------- */

function QuizDialog({
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
  const { data, loading, reload } = useApi<QuizDetail>(id ? `/api/quizzes/${id}` : null);
  const [phase, setPhase] = useState<"intro" | "taking" | "result">("intro");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [saving, setSaving] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    setPhase("intro");
    setAnswers({});
    setDeadline(null);
    submittedRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!data?.attempt) return;
    if (data.attempt.status === "submitted") {
      setPhase("result");
      const map: Record<number, string> = {};
      for (const answer of data.attempt.answers) map[answer.questionId] = answer.answer;
      setAnswers(map);
    } else if (data.attempt.status === "in_progress" && phase === "intro") {
      const start = new Date(data.attempt.startedAt).getTime();
      setDeadline(Math.min(start + data.quiz.durationMinutes * 60_000, new Date(data.quiz.endsAt).getTime()));
      setPhase("taking");
    }
  }, [data, phase]);

  useEffect(() => {
    if (phase !== "taking") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const submit = useCallback(
    async (auto = false) => {
      if (!id || submittedRef.current) return;
      submittedRef.current = true;
      setSaving(true);
      try {
        const result = await api<{ result: { score: string; maxScore: string; percent: number } }>(
          `/api/quizzes/${id}/submit`,
          {
            method: "POST",
            body: JSON.stringify({
              answers: Object.entries(answers).map(([questionId, answer]) => ({
                questionId: Number(questionId),
                answer,
              })),
            }),
          },
        );
        toast.push(
          auto
            ? `زمان تمام شد! نمره‌ی شما ${fa(Number(result.result.score))} از ${fa(Number(result.result.maxScore))}`
            : `آزمون ثبت شد — نمره ${fa(Number(result.result.score))} از ${fa(Number(result.result.maxScore))}`,
          auto ? "info" : "success",
        );
        setPhase("result");
        await reload();
        onChanged();
      } catch (e) {
        submittedRef.current = false;
        toast.push(errorMessage(e), "error");
      } finally {
        setSaving(false);
      }
    },
    [answers, id, onChanged, reload, toast],
  );

  const remaining = deadline ? Math.max(0, deadline - now) : 0;
  const remainingLabel = `${fa(String(Math.floor(remaining / 60000)).padStart(2, "0"))}:${fa(
    String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0"),
  )}`;

  useEffect(() => {
    if (phase === "taking" && deadline && remaining === 0) void submit(true);
  }, [phase, deadline, remaining, submit]);

  const start = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const result = await api<{ attempt: { deadline: string } }>(`/api/quizzes/${id}/start`, {
        method: "POST",
      });
      setDeadline(new Date(result.attempt.deadline).getTime());
      setPhase("taking");
      await reload();
    } catch (e) {
      toast.push(errorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const quiz = data?.quiz;
  const questions = data?.questions ?? [];
  const isStudent = user.role === "student";
  const canStart = quiz && !isPast(quiz.startsAt) && !isPast(quiz.endsAt);

  return (
    <Modal
      open={id !== null}
      onClose={onClose}
      wide
      title={quiz?.title ?? "آزمون"}
      subtitle={quiz ? `${quiz.className} · ${quiz.subjectName} · ${fa(quiz.durationMinutes)} دقیقه` : undefined}
    >
      {loading || !data || !quiz ? (
        <LoadingBlock rows={3} />
      ) : (
        <div className="space-y-4">
          {phase === "intro" && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoBox label="تعداد سؤال" value={fa(questions.length)} />
                <InfoBox label="مدت آزمون" value={`${fa(quiz.durationMinutes)} دقیقه`} />
                <InfoBox
                  label="مجموع بارم"
                  value={fa(questions.reduce((sum, q) => sum + Number(q.points), 0))}
                />
              </div>
              <div className="rounded-2xl bg-slate-50 p-3.5">
                <p className="text-[11px] font-bold text-slate-600">توضیحات</p>
                <p className="user-text mt-1 text-xs leading-6 text-slate-600">
                  {quiz.description || "—"}
                </p>
                <p className="mt-2 text-[10px] text-slate-400">
                  بازه‌ی برگزاری: {jalaliDateTime(quiz.startsAt)} تا {jalaliDateTime(quiz.endsAt)}
                </p>
              </div>

              {isStudent ? (
                data.attempt?.status === "submitted" ? (
                  <ResultView detail={data} />
                ) : canStart ? (
                  <div className="flex justify-end">
                    <Button onClick={start} loading={saving}>
                      <Timer className="size-4" /> شروع آزمون
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                    {isPast(quiz.endsAt)
                      ? "مهلت شرکت در این آزمون به پایان رسیده است."
                      : "این آزمون هنوز آغاز نشده است."}
                  </p>
                )
              ) : (
                <ManagerView
                  detail={data}
                  user={user}
                  onChanged={reload}
                  onDeleted={() => {
                    onClose();
                    onChanged();
                  }}
                />
              )}
            </>
          )}

          {phase === "taking" && (
            <>
              <div
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold ${
                  remaining < 60_000 ? "bg-rose-50 text-rose-600" : "bg-indigo-50 text-indigo-700"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Clock3 className="size-4" /> زمان باقی‌مانده
                </span>
                <span className="font-mono text-sm">{remainingLabel}</span>
              </div>

              <ol className="space-y-3">
                {questions.map((question, index) => (
                  <li key={question.id} className="rounded-2xl border border-slate-200 p-3.5">
                    <div className="mb-2 flex items-start gap-2">
                      <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-indigo-50 text-[10px] font-black text-indigo-600">
                        {fa(index + 1)}
                      </span>
                      <p className="user-text flex-1 text-xs leading-6 font-semibold text-slate-800">
                        {question.prompt}
                      </p>
                      <Badge tone="slate">{fa(Number(question.points))} نمره</Badge>
                    </div>
                    {question.imageUrl && (
                      <div className="mb-2">
                        <ImageAttachment src={question.imageUrl} alt="تصویر سؤال" className="max-h-56" />
                      </div>
                    )}
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {question.options.map((option) => {
                        const selected = answers[question.id] === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() =>
                              setAnswers((prev) => ({ ...prev, [question.id]: option }))
                            }
                            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-right text-[11px] transition ${
                              selected
                                ? "border-indigo-400 bg-indigo-50 font-bold text-indigo-700"
                                : "border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-slate-50"
                            }`}
                          >
                            <span
                              className={`size-3.5 shrink-0 rounded-full border-2 ${
                                selected ? "border-indigo-500 bg-indigo-500" : "border-slate-300"
                              }`}
                            />
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ol>

              <div className="sticky bottom-0 flex items-center justify-between gap-2 rounded-2xl bg-white/95 py-2 backdrop-blur">
                <p className="text-[11px] text-slate-500">
                  {fa(Object.keys(answers).length)} از {fa(questions.length)} سؤال پاسخ داده شده
                </p>
                <Button onClick={() => void submit(false)} loading={saving}>
                  <CheckCircle2 className="size-4" /> ثبت نهایی
                </Button>
              </div>
            </>
          )}

          {phase === "result" && <ResultView detail={data} />}
        </div>
      )}
    </Modal>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-center">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-extrabold text-slate-800">{value}</p>
    </div>
  );
}

function ResultView({ detail }: { detail: QuizDetail }) {
  const attempt = detail.attempt;
  if (!attempt) return null;
  const score = Number(attempt.score);
  const max = Number(attempt.maxScore);
  const percent = max > 0 ? (score / max) * 100 : 0;
  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a]));

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-gradient-to-l from-indigo-600 to-violet-600 p-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] text-indigo-100">نتیجه‌ی آزمون</p>
            <p className="mt-1 text-2xl font-black">
              {fa(score)}
              <span className="text-sm font-bold text-indigo-100"> از {fa(max)}</span>
            </p>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-2 text-center backdrop-blur">
            <p className="text-[10px] text-indigo-100">درصد</p>
            <p className="text-lg font-black">{fa(Math.round(percent))}٪</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
          <div className="h-full rounded-full bg-white" style={{ width: `${percent}%` }} />
        </div>
        {attempt.submittedAt && (
          <p className="mt-2 text-[10px] text-indigo-100/80">
            زمان ثبت: {jalaliDateTime(attempt.submittedAt)}
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {detail.questions.map((question, index) => {
          const answer = answerMap.get(question.id);
          const correct = answer?.isCorrect;
          return (
            <li
              key={question.id}
              className={`rounded-xl border p-3 ${
                correct ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"
              }`}
            >
              <div className="flex items-start gap-2">
                {correct ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="mt-0.5 size-4 shrink-0 text-rose-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="user-text text-[11px] leading-6 font-semibold text-slate-800">
                    {fa(index + 1)}. {question.prompt}
                  </p>
                  {question.imageUrl && (
                    <div className="mt-1.5">
                      <ImageAttachment src={question.imageUrl} alt="تصویر سؤال" className="max-h-44" />
                    </div>
                  )}
                  <p className="mt-1 text-[10px] text-slate-500">
                    پاسخ شما: <span className="font-bold">{answer?.answer || "بدون پاسخ"}</span>
                  </p>
                  {!correct && question.correctAnswer && (
                    <p className="text-[10px] text-emerald-600">
                      پاسخ صحیح: <span className="font-bold">{question.correctAnswer}</span>
                    </p>
                  )}
                </div>
                <Badge tone={correct ? "emerald" : "rose"}>
                  {fa(Number(answer?.awardedPoints ?? 0))}/{fa(Number(question.points))}
                </Badge>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ManagerView({
  detail,
  user,
  onChanged,
  onDeleted,
}: {
  detail: QuizDetail;
  user: Me;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [publishing, setPublishing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const leaderboard = detail.leaderboard;
  const canDelete = user.role === "admin" || detail.quiz.teacherId === user.id;

  const togglePublish = async () => {
    setPublishing(true);
    try {
      await api("/api/quizzes", {
        method: "PATCH",
        body: JSON.stringify({ id: detail.quiz.id, isPublished: !detail.quiz.isPublished }),
      });
      toast.push(detail.quiz.isPublished ? "آزمون از دسترس خارج شد" : "آزمون منتشر شد");
      onChanged();
    } catch (e) {
      toast.push(errorMessage(e), "info");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <Trophy className="size-4 text-amber-500" /> رتبه‌بندی شرکت‌کنندگان
        </p>
        {leaderboard.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="هنوز کسی در آزمون شرکت نکرده"
            description="پس از پایان آزمون، نتایج اینجا نمایش داده می‌شود."
          />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
            {leaderboard.map((row, index) => (
              <li key={`${row.studentName}-${index}`} className="flex items-center gap-2.5 px-3 py-2">
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-lg text-[10px] font-black ${
                    index === 0
                      ? "bg-amber-100 text-amber-700"
                      : index === 1
                        ? "bg-slate-200 text-slate-700"
                        : index === 2
                          ? "bg-orange-100 text-orange-700"
                          : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {fa(index + 1)}
                </span>
                <Avatar
                  name={row.studentName}
                  size={28}
                  color={row.studentColor ?? "#818cf8"}
                  src={row.studentAvatar}
                />
                <p className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700">
                  {row.studentName}
                </p>
                <span className="text-[11px] font-black text-indigo-600">
                  {fa(Number(row.score))}
                  <span className="text-[9px] font-bold text-slate-400"> / {fa(Number(row.maxScore))}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <FileCheck2 className="size-4 text-indigo-500" /> سؤالات و کلید پاسخ
        </p>
        <ul className="space-y-2">
          {detail.questions.map((question, index) => (
            <li key={question.id} className="rounded-xl border border-slate-200 p-3">
              <p className="user-text text-[11px] leading-6 font-semibold text-slate-800">
                {fa(index + 1)}. {question.prompt}
              </p>
              {question.imageUrl && (
                <div className="mt-1.5">
                  <ImageAttachment src={question.imageUrl} alt="تصویر سؤال" className="max-h-44" />
                </div>
              )}
              <div className="mt-1.5 flex flex-wrap gap-1">
                {question.options.map((option) => (
                  <span
                    key={option}
                    className={`rounded-lg px-2 py-1 text-[10px] ${
                      option === question.correctAnswer
                        ? "bg-emerald-100 font-bold text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {option}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {canDelete && (
          <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-3.5" /> حذف آزمون
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={togglePublish} loading={publishing}>
          {detail.quiz.isPublished ? "لغو انتشار آزمون" : "انتشار آزمون"}
        </Button>
      </div>

      {typeof document !== "undefined" &&
        createPortal(
          <DeleteConfirmModal
            open={deleteOpen}
            onClose={() => setDeleteOpen(false)}
            title="حذف آزمون"
            description="آزمون به‌همراه سؤالات، تصاویر، پاسخ‌ها و کارنامه‌ها حذف می‌شود. رمز حذف سامانه را وارد کنید."
            onConfirm={async (deletePassword) => {
              await api(`/api/quizzes/${detail.quiz.id}`, {
                method: "DELETE",
                body: JSON.stringify({ deletePassword }),
              });
              toast.push("آزمون حذف شد", "info");
              onDeleted();
            }}
          />,
          document.body,
        )}
    </div>
  );
}

/* ----------------------------- ساخت آزمون -------------------------------- */

type DraftQuestion = {
  prompt: string;
  imageUrl: string | null;
  options: string[];
  correct: string;
  points: string;
};

const emptyQuestion = (): DraftQuestion => ({
  prompt: "",
  imageUrl: null,
  options: ["", "", "", ""],
  correct: "",
  points: "1",
});

function CreateQuiz({
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
    durationMinutes: "20",
    startsAt: "",
    endsAt: "",
  });
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);

  const subjects = useMemo(() => {
    if (!form.classId) return meta?.subjects ?? [];
    const allowed = (meta?.teaching ?? [])
      .filter((t) => String(t.classId) === form.classId)
      .map((t) => t.subjectId);
    if (allowed.length === 0) return meta?.subjects ?? [];
    return (meta?.subjects ?? []).filter((s) => allowed.includes(s.id));
  }, [meta, form.classId]);

  useEffect(() => {
    if (!form.classId && meta?.classes?.[0])
      setForm((prev) => ({ ...prev, classId: String(meta.classes[0].id) }));
  }, [meta, form.classId]);

  useEffect(() => {
    if (!form.subjectId && subjects[0])
      setForm((prev) => ({ ...prev, subjectId: String(subjects[0].id) }));
  }, [subjects, form.subjectId]);

  const updateQuestion = (index: number, patch: Partial<DraftQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const submit = async () => {
    if (!form.classId || !form.subjectId || !form.title.trim() || !form.startsAt || !form.endsAt) {
      toast.push("فیلدهای ضروری آزمون را کامل کنید", "error");
      return;
    }
    for (const [index, question] of questions.entries()) {
      const options = question.options.filter((o) => o.trim());
      if (!question.prompt.trim() || options.length < 2 || !options.includes(question.correct)) {
        toast.push(`سؤال ${index + 1} ناقص است (متن، گزینه‌ها و پاسخ صحیح)`, "error");
        return;
      }
    }
    setSaving(true);
    try {
      await api("/api/quizzes", {
        method: "POST",
        body: JSON.stringify({
          classId: Number(form.classId),
          subjectId: Number(form.subjectId),
          title: form.title,
          description: form.description,
          durationMinutes: Number(form.durationMinutes),
          startsAt: new Date(form.startsAt).toISOString(),
          endsAt: new Date(form.endsAt).toISOString(),
          questions: questions.map((q) => ({
            prompt: q.prompt,
            imageUrl: q.imageUrl,
            options: q.options.filter((o) => o.trim()),
            correctAnswer: q.correct,
            points: Number(q.points || 1),
          })),
        }),
      });
      toast.push("آزمون ایجاد شد");
      setQuestions([emptyQuestion()]);
      setForm({ ...form, title: "", description: "", startsAt: "", endsAt: "" });
      onClose();
      onCreated();
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
      wide
      title="ساخت آزمون آنلاین"
      subtitle="سؤالات چهارگزینه‌ای، زمان‌بندی و بارم را مشخص کنید"
    >
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

        <Field label="عنوان آزمون">
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="مثلاً آزمون فصل ۳ ریاضی"
          />
        </Field>
        <Field label="توضیحات">
          <Textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            placeholder="شرایط و نکات آزمون…"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="شروع">
            <Input
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </Field>
          <Field label="پایان">
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </Field>
          <Field label="مدت (دقیقه)">
            <Input
              type="number"
              min={1}
              max={180}
              value={form.durationMinutes}
              onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
            />
          </Field>
        </div>

        <div className="rounded-2xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold text-slate-700">سؤالات ({fa(questions.length)})</p>
            <Button size="sm" variant="soft" onClick={() => setQuestions((q) => [...q, emptyQuestion()])}>
              <Plus className="size-3.5" /> سؤال
            </Button>
          </div>
          <div className="space-y-3">
            {questions.map((question, index) => (
              <div key={index} className="rounded-xl bg-slate-50 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-500">سؤال {fa(index + 1)}</span>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuestions((q) => q.filter((_, i) => i !== index))}
                      className="mr-auto rounded-lg p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                      aria-label="حذف سؤال"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
                <Input
                  value={question.prompt}
                  onChange={(e) => updateQuestion(index, { prompt: e.target.value })}
                  placeholder="متن سؤال"
                  className="mb-2"
                />
                <div className="mb-2">
                  <ImageUploader
                    folder="quizzes"
                    compact
                    value={question.imageUrl}
                    onChange={(imageUrl) => updateQuestion(index, { imageUrl })}
                    label="افزودن تصویر به سؤال (اختیاری)"
                  />
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          option.trim() && updateQuestion(index, { correct: option })
                        }
                        title="انتخاب به‌عنوان پاسخ صحیح"
                        className={`grid size-6 shrink-0 place-items-center rounded-full border-2 text-[9px] font-black transition ${
                          question.correct === option && option
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-slate-300 text-slate-400"
                        }`}
                      >
                        {["ا", "ب", "پ", "ت", "ث", "ج"][optionIndex]}
                      </button>
                      <Input
                        value={option}
                        onChange={(e) => {
                          const options = [...question.options];
                          options[optionIndex] = e.target.value;
                          const correct =
                            question.correct === option ? e.target.value : question.correct;
                          updateQuestion(index, { options, correct });
                        }}
                        placeholder={`گزینه ${fa(optionIndex + 1)}`}
                        className="py-1.5 text-xs"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">بارم:</span>
                  <Input
                    type="number"
                    min={0.25}
                    step={0.25}
                    value={question.points}
                    onChange={(e) => updateQuestion(index, { points: e.target.value })}
                    className="w-20 py-1 text-xs"
                  />
                  <span className="text-[10px] text-emerald-600">
                    {question.correct ? `پاسخ صحیح: ${question.correct}` : "پاسخ صحیح را با دایره‌ی کنار گزینه انتخاب کنید"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            انصراف
          </Button>
          <Button onClick={submit} loading={saving} disabled={(meta?.classes ?? []).length === 0}>
            ایجاد آزمون
          </Button>
        </div>
      </div>
    </Modal>
  );
}
