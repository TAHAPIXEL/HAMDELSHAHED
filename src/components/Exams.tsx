"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Clock3,
  ListChecks,
  ChevronRight,
  Play,
  CircleCheckBig,
  Eye,
  Send,
  AlertTriangle,
  GraduationCap,
  Lock,
} from "lucide-react";
import {
  DB,
  SECTIONS,
  className,
  fa,
  faDateTime,
  isStaff,
  canTeach,
  qTypeFa,
  roleFa,
  uid,
  type Exam,
  type Grade,
  type Question,
  type QuestionType,
  type Submission,
  type User,
} from "@/lib/model";
import { Avatar, Btn, Chip, Confirm, Empty, Field, Modal, inputCls, useDbTick, useToast } from "./ui";

const totalScore = (e: Exam) => e.questions.reduce((a, q) => a + (q.score || 0), 0);

export default function Exams({ user }: { user: User }) {
  useDbTick();
  const toast = useToast();
  const [builder, setBuilder] = useState<Exam | null | "new">(null);
  const [runner, setRunner] = useState<Exam | null>(null);
  const [subsOf, setSubsOf] = useState<Exam | null>(null);
  const [result, setResult] = useState<{ exam: Exam; sub: Submission } | null>(null);
  const [del, setDel] = useState<Exam | null>(null);

  // بدون memo — لیست آزمون‌ها همیشه تازه بماند
  const teach = canTeach(user); // طراحی و ویرایش آزمون
  const exams = (() => {
    const all = DB.exams();
    if (user.role === "student") {
      return all.filter((e) => e.grade === user.grade && e.section === user.section && e.status !== "draft");
    }
    return all;
  })();

  const mySub = (examId: string) => DB.subs().find((s) => s.examId === examId && s.studentId === user.id);

  const remove = (e: Exam) => {
    DB.saveExams(DB.exams().filter((x) => x.id !== e.id));
    DB.saveSubs(DB.subs().filter((s) => s.examId !== e.id));
    toast("success", "آزمون حذف شد");
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        {teach && (
          <Btn className="mb-5" onClick={() => setBuilder("new")}>
            <Plus className="size-4" />
            طراحی آزمون جدید
          </Btn>
        )}

        {exams.length === 0 && (
          <Empty
            icon={<ClipboardList className="size-7" />}
            title="آزمونی وجود ندارد"
            desc={teach ? "اولین آزمون خود را طراحی کنید" : "آزمون‌های طراحی‌شده اینجا نمایش داده می‌شود"}
          />
        )}

        <div className="stagger space-y-3">
          {exams.map((e) => {
            const sub = user.role === "student" ? mySub(e.id) : undefined;
            const subs = DB.subs().filter((s) => s.examId === e.id);
            return (
              <div key={e.id} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-600/20">
                    <ClipboardList className="size-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-black text-slate-800 dark:text-slate-100">{e.title}</span>
                      {e.status === "published" ? (
                        <Chip tone="green">فعال</Chip>
                      ) : e.status === "draft" ? (
                        <Chip tone="amber">پیش‌نویس</Chip>
                      ) : (
                        <Chip>پایان‌یافته</Chip>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] font-semibold text-slate-400">
                      <span>کلاس {className(e.grade, e.section)}</span>
                      <span className="flex items-center gap-1"><ListChecks className="size-3.5" /> {fa(e.questions.length)} سؤال ({fa(totalScore(e))} نمره)</span>
                      <span className="flex items-center gap-1"><Clock3 className="size-3.5" /> {fa(e.durationMin)} دقیقه</span>
                    </div>
                  </div>
                </div>
                {e.description && <p className="user-text mt-3 text-[13px] leading-6 text-slate-500 dark:text-slate-400">{e.description}</p>}

                {/* اکشن‌های دانش‌آموز */}
                {user.role === "student" && (
                  <div className="mt-4">
                    {!sub ? (
                      e.status === "published" ? (
                        <Btn onClick={() => setRunner(e)}>
                          <Play className="size-4" />
                          شروع آزمون
                        </Btn>
                      ) : (
                        <Chip>این آزمون بسته شده است</Chip>
                      )
                    ) : sub.graded ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <Chip tone="green">
                          <CircleCheckBig className="size-3.5" />
                          تصحیح شد — نمره: {fa(sub.total ?? 0)} از {fa(totalScore(e))}
                        </Chip>
                        <Btn kind="soft" onClick={() => setResult({ exam: e, sub })}>
                          <Eye className="size-4" />
                          مشاهده کارنامه
                        </Btn>
                      </div>
                    ) : (
                      <Chip tone="amber">پاسخ‌های شما ثبت شد — در انتظار تصحیح دبیر</Chip>
                    )}
                  </div>
                )}

                {/* اکشن‌های کادر */}
                {isStaff(user) && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Btn kind="soft" onClick={() => setSubsOf(e)}>
                      <GraduationCap className="size-4" />
                      پاسخ‌ها ({fa(subs.length)})
                    </Btn>
                    {teach && (<>
                    <Btn kind="ghost" onClick={() => setBuilder(e)}>
                      <Pencil className="size-4" />
                      ویرایش
                    </Btn>
                    {e.status !== "published" ? (
                      <Btn kind="ghost" onClick={() => {
                        DB.saveExams(DB.exams().map((x) => x.id === e.id ? { ...x, status: "published" } : x));
                        toast("success", "آزمون منتشر شد و برای دانش‌آموزان فعال است");
                      }}>
                        انتشار
                      </Btn>
                    ) : (
                      <Btn kind="ghost" onClick={() => {
                        DB.saveExams(DB.exams().map((x) => x.id === e.id ? { ...x, status: "closed" } : x));
                        toast("success", "آزمون بسته شد");
                      }}>
                        <Lock className="size-4" />
                        بستن آزمون
                      </Btn>
                    )}
                    <Btn kind="danger" onClick={() => setDel(e)}>
                      <Trash2 className="size-4" />
                    </Btn>
                    </>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {builder && (
        <ExamBuilder
          exam={builder === "new" ? null : builder}
          user={user}
          onClose={() => setBuilder(null)}
        />
      )}
      {runner && <ExamRunner exam={runner} user={user} onClose={() => setRunner(null)} onDone={() => setRunner(null)} />}
      {subsOf && <SubmissionsModal exam={subsOf} onClose={() => setSubsOf(null)} onResult={(sub) => setResult({ exam: subsOf, sub })} />}
      {result && (
        <ResultModal exam={result.exam} sub={result.sub} viewer={user} onClose={() => setResult(null)} />
      )}
      <Confirm
        open={!!del}
        onClose={() => setDel(null)}
        onYes={() => del && remove(del)}
        title="حذف آزمون"
        desc={`آزمون «${del?.title}» و همه پاسخ‌های ثبت‌شده حذف می‌شوند.`}
        yesLabel="حذف"
      />
    </div>
  );
}

// ----------------------------------------------------------------------------
// سازنده آزمون (کادر)
// ----------------------------------------------------------------------------

const emptyQ = (type: QuestionType): Question => ({
  id: uid("q"),
  type,
  text: "",
  score: 1,
  options: type === "mcq" ? ["", "", "", ""] : undefined,
});

function ExamBuilder({ exam, user, onClose }: { exam: Exam | null; user: User; onClose: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState(exam?.title ?? "");
  const [desc, setDesc] = useState(exam?.description ?? "");
  const [grade, setGrade] = useState<Grade>(exam?.grade ?? 7);
  const [section, setSection] = useState(exam?.section ?? "1");
  const [duration, setDuration] = useState(exam?.durationMin ?? 30);
  const [questions, setQuestions] = useState<Question[]>(exam?.questions ? [...exam.questions] : []);
  const [qType, setQType] = useState<QuestionType>("mcq");

  const save = () => {
    if (!title.trim()) return toast("error", "عنوان آزمون را بنویسید");
    if (questions.length === 0) return toast("error", "حداقل یک سؤال اضافه کنید");
    for (const q of questions) {
      if (!q.text.trim()) return toast("error", "متن همه سؤال‌ها باید نوشته شود");
      if (q.type === "mcq" && (q.options ?? []).some((o) => !o.trim()))
        return toast("error", "همه گزینه‌های سؤال‌های تستی باید پر شوند");
    }
    const exams = DB.exams();
    if (exam) {
      const idx = exams.findIndex((x) => x.id === exam.id);
      exams[idx] = { ...exams[idx], title: title.trim(), description: desc.trim(), grade, section, durationMin: duration, questions };
    } else {
      exams.push({
        id: uid("ex"),
        title: title.trim(),
        description: desc.trim(),
        grade,
        section,
        durationMin: Math.max(1, duration),
        questions,
        status: "draft",
        createdBy: user.id,
        createdAt: Date.now(),
      });
    }
    DB.saveExams(exams);
    toast("success", exam ? "آزمون به‌روزرسانی شد" : "آزمون ساخته شد — برای فعال شدن، آن را منتشر کنید");
    onClose();
  };

  const updQ = (id: string, patch: Partial<Question>) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  return (
    <Modal open onClose={onClose} title={exam ? "ویرایش آزمون" : "طراحی آزمون جدید"} wide icon={<ClipboardList className="size-5 text-indigo-500" />}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="عنوان آزمون" required>
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً آزمون فصل ۳ ریاضی" />
          </Field>
          <Field label="مدت آزمون (دقیقه)" required>
            <input type="number" min={1} className={inputCls} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
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
          <Field label="کلاس مقصد">
            <div className="rounded-xl bg-indigo-50 px-3.5 py-2.5 text-[13px] font-black text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
              {className(grade, section)}
            </div>
          </Field>
        </div>
        <Field label="توضیحات برای دانش‌آموزان (اختیاری)">
          <textarea rows={2} className={`${inputCls} resize-none`} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </Field>

        {/* سؤال‌ها */}
        <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-black text-slate-700 dark:text-slate-200">
              سؤال‌ها — {fa(questions.length)} سؤال ، {fa(questions.reduce((a, q) => a + q.score, 0))} نمره
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select className={`${inputCls} !w-auto !py-2 !text-[12px]`} value={qType} onChange={(e) => setQType(e.target.value as QuestionType)}>
                {(Object.keys(qTypeFa) as QuestionType[]).map((t) => (
                  <option key={t} value={t}>{qTypeFa[t]}</option>
                ))}
              </select>
              <Btn kind="soft" className="!py-2 !text-[12px]" onClick={() => setQuestions((qs) => [...qs, emptyQ(qType)])}>
                <Plus className="size-3.5" />
                افزودن سؤال
              </Btn>
            </div>
          </div>

          <div className="space-y-3">
            {questions.length === 0 && (
              <div className="rounded-xl bg-slate-50 py-6 text-center text-[12.5px] font-semibold text-slate-400 dark:bg-white/5">
                هنوز سؤالی اضافه نشده است
              </div>
            )}
            {questions.map((q, i) => (
              <div key={q.id} className="rounded-xl bg-slate-50 p-3.5 dark:bg-white/5">
                <div className="mb-2.5 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[12px] font-black text-indigo-600 dark:text-indigo-300">
                    سؤال {fa(i + 1)} <Chip tone="indigo">{qTypeFa[q.type]}</Chip>
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
                      نمره:
                      <input
                        type="number" min={0.25} step={0.25}
                        className={`${inputCls} !w-16 !px-2 !py-1 text-center !text-[12px]`}
                        value={q.score}
                        onChange={(e) => updQ(q.id, { score: Number(e.target.value) || 0 })}
                      />
                    </label>
                    <button
                      onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                      aria-label="حذف سؤال"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
                <textarea
                  rows={2}
                  className={`${inputCls} resize-none !text-[13px] leading-7`}
                  placeholder="متن سؤال را بنویسید..."
                  value={q.text}
                  onChange={(e) => updQ(q.id, { text: e.target.value })}
                />
                {q.type === "mcq" && (
                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    {(q.options ?? []).map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-white text-[11px] font-black text-slate-500 ring-1 ring-slate-200 dark:bg-white/10 dark:ring-white/10">
                          {["الف", "ب", "ج", "د"][oi]}
                        </span>
                        <input
                          className={`${inputCls} !py-1.5 !text-[12.5px]`}
                          placeholder={`گزینه ${fa(oi + 1)}`}
                          value={o}
                          onChange={(e) =>
                            updQ(q.id, { options: (q.options ?? []).map((x, xi) => (xi === oi ? e.target.value : x)) })
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
                {q.type === "tf" && (
                  <div className="mt-2 text-[11.5px] font-semibold text-slate-400">دانش‌آموز یکی از «صحیح» یا «غلط» را انتخاب می‌کند.</div>
                )}
                {(q.type === "blank" || q.type === "short") && (
                  <div className="mt-2 text-[11.5px] font-semibold text-slate-400">دانش‌آموز پاسخ کوتاه می‌نویسد؛ تصحیح با شماست.</div>
                )}
                {q.type === "descriptive" && (
                  <div className="mt-2 text-[11.5px] font-semibold text-slate-400">دانش‌آموز پاسخ تشریحی می‌نویسد؛ تصحیح با شماست.</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Btn kind="ghost" onClick={onClose}>انصراف</Btn>
          <Btn onClick={save}>ذخیره آزمون</Btn>
        </div>
      </div>
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// اجرای آزمون (دانش‌آموز)
// ----------------------------------------------------------------------------

function ExamRunner({ exam, user, onClose, onDone }: { exam: Exam; user: User; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [left, setLeft] = useState(exam.durationMin * 60);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const submittedRef = useRef(false);

  const doSubmit = useCallback(
    (auto = false) => {
      if (submittedRef.current) return; // جلوگیری از ثبت دوباره (دابل‌کلیک یا زمان‌تمام)
      submittedRef.current = true;
      const subs = DB.subs();
      subs.push({
        id: uid("sub"),
        examId: exam.id,
        studentId: user.id,
        answers,
        startedAt: Date.now() - (exam.durationMin * 60 - left) * 1000,
        submittedAt: Date.now(),
      });
      DB.saveSubs(subs);
      toast("success", auto ? "زمان تمام شد؛ پاسخ‌ها ثبت شد" : "پاسخ‌های شما ثبت شد و برای دبیر ارسال شد");
      onDone();
    },
    [answers, left, exam.id, exam.durationMin, user.id, toast, onDone],
  );

  useEffect(() => {
    const iv = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (left <= 0) doSubmit(true);
  }, [left, doSubmit]);

  const set = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: v }));
  const answered = exam.questions.filter((q) => (answers[q.id] ?? "").trim() !== "").length;
  const mm = Math.max(0, Math.floor(left / 60));
  const ss = Math.max(0, left % 60);
  const danger = left < 60;

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* هدر آزمون */}
      <div className="border-b border-slate-200/70 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-white/5 dark:bg-slate-900/70 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black text-slate-800 dark:text-slate-100">{exam.title}</div>
            <div className="mt-0.5 text-[11.5px] font-semibold text-slate-400">
              پاسخ‌داده‌شده: {fa(answered)} از {fa(exam.questions.length)}
            </div>
          </div>
          <div className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-black tabular-nums ${danger ? "animate-pulse bg-rose-100 text-rose-600 dark:bg-rose-500/15" : "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"}`}>
            <Clock3 className="size-4.5" />
            {fa(String(mm).padStart(2, "0"))}:{fa(String(ss).padStart(2, "0"))}
          </div>
          <Btn onClick={() => setConfirmSubmit(true)}>
            <Send className="size-4" />
            پایان و ثبت
          </Btn>
        </div>
      </div>

      {/* بدنه */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {exam.description && (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] font-semibold leading-7 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              {exam.description}
            </div>
          )}
          {exam.questions.map((q, i) => (
            <div key={q.id} className="card p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="text-[14.5px] font-bold leading-8 text-slate-800 dark:text-slate-100">
                  <span className="ml-1 inline-flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-[12px] font-black text-white">
                    {fa(i + 1)}
                  </span>
                  {q.text}
                </div>
                <Chip tone="indigo">{fa(q.score)} نمره</Chip>
              </div>

              {q.type === "mcq" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {(q.options ?? []).map((o, oi) => {
                    const val = String(oi);
                    const on = answers[q.id] === val;
                    return (
                      <button
                        key={oi}
                        onClick={() => set(q.id, val)}
                        className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-right transition ${
                          on
                            ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-500/15 dark:border-indigo-400/50 dark:bg-indigo-500/10"
                            : "border-slate-200 hover:border-slate-300 dark:border-white/10 dark:hover:border-white/20"
                        }`}
                      >
                        <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${on ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>
                          {["الف", "ب", "ج", "د"][oi]}
                        </span>
                        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{o}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === "tf" && (
                <div className="flex gap-2">
                  {["صحیح", "غلط"].map((o) => {
                    const on = answers[q.id] === o;
                    return (
                      <button
                        key={o}
                        onClick={() => set(q.id, o)}
                        className={`flex-1 rounded-xl border px-4 py-3 text-sm font-black transition ${
                          on
                            ? o === "صحیح"
                              ? "border-emerald-400 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/15 dark:border-emerald-400/50 dark:bg-emerald-500/10 dark:text-emerald-300"
                              : "border-rose-400 bg-rose-50 text-rose-700 ring-2 ring-rose-500/15 dark:border-rose-400/50 dark:bg-rose-500/10 dark:text-rose-300"
                            : "border-slate-200 text-slate-500 dark:border-white/10"
                        }`}
                      >
                        {o}
                      </button>
                    );
                  })}
                </div>
              )}

              {(q.type === "blank" || q.type === "short") && (
                <input
                  className={inputCls}
                  placeholder="پاسخ کوتاه خود را بنویسید..."
                  value={answers[q.id] ?? ""}
                  onChange={(e) => set(q.id, e.target.value)}
                />
              )}

              {q.type === "descriptive" && (
                <textarea
                  rows={4}
                  className={`${inputCls} resize-y leading-8`}
                  placeholder="پاسخ تشریحی خود را کامل بنویسید..."
                  value={answers[q.id] ?? ""}
                  onChange={(e) => set(q.id, e.target.value)}
                />
              )}
            </div>
          ))}
          <div className="flex justify-center pb-6 pt-2">
            <Btn className="!px-8" onClick={() => setConfirmSubmit(true)}>
              <Send className="size-4" />
              پایان آزمون و ثبت پاسخ‌ها
            </Btn>
          </div>
        </div>
      </div>

      <Modal open={confirmSubmit} onClose={() => setConfirmSubmit(false)} title="ثبت پاسخ‌ها" icon={<AlertTriangle className="size-5 text-amber-500" />}>
        <p className="mb-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
          {fa(answered)} سؤال از {fa(exam.questions.length)} سؤال را پاسخ داده‌اید. بعد از ثبت، امکان تغییر پاسخ‌ها نیست.
        </p>
        <p className="mb-5 text-[12.5px] font-semibold text-slate-400">پاسخ‌ها برای دبیر ارسال و توسط ایشان تصحیح می‌شود.</p>
        <div className="flex justify-end gap-2">
          <Btn kind="ghost" onClick={() => setConfirmSubmit(false)}>ادامه آزمون</Btn>
          <Btn onClick={() => doSubmit(false)}>ثبت نهایی</Btn>
        </div>
      </Modal>
    </div>
  );
}

// ----------------------------------------------------------------------------
// پاسخ‌های ارسالی (کادر)
// ----------------------------------------------------------------------------

function SubmissionsModal({
  exam,
  onClose,
  onResult,
}: {
  exam: Exam;
  onClose: () => void;
  onResult: (sub: Submission) => void;
}) {
  useDbTick();
  const subs = DB.subs().filter((s) => s.examId === exam.id);
  const studentOf = (id: string) => DB.users().find((u) => u.id === id);

  return (
    <Modal open onClose={onClose} title={`پاسخ‌های «${exam.title}»`} icon={<GraduationCap className="size-5 text-indigo-500" />}>
      {subs.length === 0 ? (
        <Empty icon={<GraduationCap className="size-7" />} title="هنوز پاسخی نیست" desc="وقتی دانش‌آموزان آزمون را بدهند، پاسخ‌ها اینجا می‌آید" />
      ) : (
        <div className="space-y-2">
          {subs.map((s) => {
            const st = studentOf(s.studentId);
            return (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3 dark:border-white/5">
                <Avatar user={st ?? null} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-black text-slate-800 dark:text-slate-100">
                    {st ? `${st.firstName} ${st.lastName}` : "دانش‌آموز"}
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold text-slate-400">
                    {s.submittedAt ? faDateTime(s.submittedAt) : ""}
                    {s.graded && ` • نمره: ${fa(s.total ?? 0)} از ${fa(totalScore(exam))}`}
                  </div>
                </div>
                {s.graded ? <Chip tone="green">تصحیح شد</Chip> : <Chip tone="amber">در انتظار تصحیح</Chip>}
                <Btn kind="soft" className="!py-2 !text-[12px]" onClick={() => onResult(s)}>
                  {s.graded ? "مشاهده" : "تصحیح"}
                </Btn>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ----------------------------------------------------------------------------
// تصحیح / کارنامه
// ----------------------------------------------------------------------------

function ResultModal({ exam, sub, viewer, onClose }: { exam: Exam; sub: Submission; viewer: User; onClose: () => void }) {
  const toast = useToast();
  const student = DB.users().find((u) => u.id === sub.studentId);
  const staffCanGrade = isStaff(viewer);
  const [grades, setGrades] = useState<Record<string, number>>(sub.grades ?? {});
  const [feedback, setFeedback] = useState(sub.feedback ?? "");

  const finalize = () => {
    const subs = DB.subs();
    const idx = subs.findIndex((s) => s.id === sub.id);
    if (idx < 0) return;
    const total = exam.questions.reduce((a, q) => a + Math.min(q.score, Math.max(0, grades[q.id] ?? 0)), 0);
    subs[idx] = {
      ...subs[idx],
      grades,
      feedback: feedback.trim(),
      total: Math.round(total * 100) / 100,
      graded: true,
    };
    DB.saveSubs(subs);
    toast("success", "تصحیح ثبت شد و برای دانش‌آموز قابل مشاهده است");
    onClose();
  };

  const answerLabel = (q: Question): string => {
    const a = sub.answers[q.id];
    if (a === undefined || a === "") return "— پاسخ نداده —";
    if (q.type === "mcq") {
      const oi = Number(a);
      return `گزینه ${["الف", "ب", "ج", "د"][oi] ?? "?"}: ${q.options?.[oi] ?? ""}`;
    }
    return a;
  };

  return (
    <Modal open onClose={onClose} title={staffCanGrade ? `تصحیح پاسخ‌های ${student?.firstName ?? ""} ${student?.lastName ?? ""}` : "کارنامه آزمون"} wide icon={<CircleCheckBig className="size-5 text-emerald-500" />}>
      {sub.graded && (
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-gradient-to-l from-emerald-500 to-teal-500 px-5 py-4 text-white">
          <div>
            <div className="text-[12px] font-bold text-white/80">نمره نهایی</div>
            <div className="text-2xl font-black">{fa(sub.total ?? 0)} <span className="text-sm font-bold text-white/80">از {fa(totalScore(exam))}</span></div>
          </div>
          <CircleCheckBig className="size-9 text-white/80" />
        </div>
      )}
      <div className="space-y-3">
        {exam.questions.map((q, i) => (
          <div key={q.id} className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="text-[13.5px] font-bold leading-7 text-slate-800 dark:text-slate-100">
                <span className="ml-1 text-indigo-500">{fa(i + 1)}.</span>
                {q.text}
              </div>
              <Chip tone="slate">{qTypeFa[q.type]} • {fa(q.score)} نمره</Chip>
            </div>
            <div className="user-text rounded-xl bg-white px-3.5 py-2.5 text-[13px] leading-7 text-slate-600 ring-1 ring-slate-200/70 dark:bg-white/5 dark:text-slate-300 dark:ring-white/10">
              <span className="ml-1 text-[11px] font-black text-slate-400">پاسخ:</span>
              {answerLabel(q)}
            </div>
            {staffCanGrade ? (
              <div className="mt-2.5 flex items-center justify-end gap-2">
                <label className="flex items-center gap-2 text-[12px] font-bold text-slate-500">
                  نمره این سؤال:
                  <input
                    type="number" min={0} max={q.score} step={0.25}
                    className={`${inputCls} !w-20 !px-2 !py-1.5 text-center`}
                    value={grades[q.id] ?? ""}
                    onChange={(e) =>
                      setGrades((g) => ({
                        ...g,
                        [q.id]: Math.min(q.score, Math.max(0, Number(e.target.value) || 0)),
                      }))
                    }
                  />
                  از {fa(q.score)}
                </label>
              </div>
            ) : (
              sub.graded && (
                <div className="mt-2 text-left text-[12px] font-black text-emerald-600">
                  {fa(grades[q.id] ?? 0)} از {fa(q.score)}
                </div>
              )
            )}
          </div>
        ))}
      </div>
      {staffCanGrade ? (
        <div className="mt-4 space-y-3">
          <Field label="بازخورد کلی برای دانش‌آموز (اختیاری)">
            <textarea rows={2} className={`${inputCls} resize-none`} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn kind="ghost" onClick={onClose}>بستن</Btn>
            <Btn onClick={finalize}>ثبت نهایی تصحیح</Btn>
          </div>
        </div>
      ) : (
        sub.feedback && (
          <div className="mt-4 rounded-2xl bg-indigo-50 px-4 py-3 text-[13px] font-semibold leading-7 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-200">
            نظر دبیر: {sub.feedback}
          </div>
        )
      )}
    </Modal>
  );
}
