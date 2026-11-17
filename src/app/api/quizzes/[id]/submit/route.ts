import { and, asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { quizAnswers, quizAttempts, quizQuestions, quizzes } from "@/db/schema";
import { ApiError, audit, body, num, requireUser, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest, ctx) => {
  const user = await requireUser(["student"]);
  const id = num((await ctx.params).id, "شناسه");
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), ["answers"]);
  const db = await getDb();

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
  if (!quiz) throw new ApiError("آزمون یافت نشد", 404);

  const [attempt] = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, id), eq(quizAttempts.studentId, user.id)))
    .limit(1);

  if (!attempt) throw new ApiError("ابتدا آزمون را شروع کنید", 409);
  if (attempt.status === "submitted") throw new ApiError("این آزمون قبلاً ثبت شده است", 409);

  const questions = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, id))
    .orderBy(asc(quizQuestions.orderIndex));

  const submitted = Array.isArray(payload.answers)
    ? (payload.answers as { questionId?: unknown; answer?: unknown }[])
    : [];
  const byQuestion = new Map<number, string>();
  for (const item of submitted) {
    const qid = Number(item.questionId);
    if (!Number.isFinite(qid)) continue;
    byQuestion.set(qid, typeof item.answer === "string" ? item.answer.slice(0, 1000) : "");
  }

  let score = 0;
  let maxScore = 0;
  const rows = questions.map((question) => {
    const given = (byQuestion.get(question.id) ?? "").trim();
    const isCorrect = given.length > 0 && given === question.correctAnswer;
    const points = Number(question.points);
    maxScore += points;
    if (isCorrect) score += points;
    return {
      attemptId: attempt.id,
      questionId: question.id,
      answer: given,
      isCorrect,
      awardedPoints: (isCorrect ? points : 0).toFixed(2),
    };
  });

  await db.delete(quizAnswers).where(eq(quizAnswers.attemptId, attempt.id));
  if (rows.length) await db.insert(quizAnswers).values(rows);

  await db
    .update(quizAttempts)
    .set({
      status: "submitted",
      submittedAt: new Date(),
      score: score.toFixed(2),
      maxScore: maxScore.toFixed(2),
    })
    .where(eq(quizAttempts.id, attempt.id));

  await audit(user.id, "submit", "quiz", id, { score, maxScore });

  return {
    result: {
      attemptId: attempt.id,
      score: score.toFixed(2),
      maxScore: maxScore.toFixed(2),
      percent: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
      correctCount: rows.filter((r) => r.isCorrect).length,
      totalCount: rows.length,
    },
  };
});
