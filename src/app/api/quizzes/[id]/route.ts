import { and, asc, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import {
  classes,
  quizAnswers,
  quizAttempts,
  quizQuestions,
  quizzes,
  subjects,
  users,
} from "@/db/schema";
import { ApiError, audit, num, requireUser, route } from "@/lib/api";
import { accessibleClassIds, canManageClass } from "@/lib/access";
import { deleteStoredImages } from "@/lib/storage";
import { assertDeletePassword } from "@/lib/settings";
import { qc } from "@/lib/sql";

export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx) => {
  const user = await requireUser();
  const id = num((await ctx.params).id, "شناسه");
  const db = await getDb();

  const [quiz] = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      durationMinutes: quizzes.durationMinutes,
      startsAt: quizzes.startsAt,
      endsAt: quizzes.endsAt,
      isPublished: quizzes.isPublished,
      classId: quizzes.classId,
      className: classes.name,
      subjectName: subjects.name,
      subjectColor: subjects.color,
      teacherId: quizzes.teacherId,
      teacherName: users.fullName,
    })
    .from(quizzes)
    .innerJoin(classes, eq(classes.id, quizzes.classId))
    .innerJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .innerJoin(users, eq(users.id, quizzes.teacherId))
    .where(eq(quizzes.id, id))
    .limit(1);

  if (!quiz) throw new ApiError("آزمون یافت نشد", 404);

  if (user.role === "student") {
    const classIds = await accessibleClassIds(user);
    if (!classIds.includes(quiz.classId)) throw new ApiError("دسترسی ندارید", 403);
  }

  const manage = await canManageClass(user, quiz.classId);
  const questions = await db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, id))
    .orderBy(asc(quizQuestions.orderIndex));

  const now = Date.now();
  const isOpen = quiz.startsAt.getTime() <= now && quiz.endsAt.getTime() >= now;

  const [attempt] =
    user.role === "student"
      ? await db
          .select()
          .from(quizAttempts)
          .where(and(eq(quizAttempts.quizId, id), eq(quizAttempts.studentId, user.id)))
          .limit(1)
      : [];

  const answers = attempt
    ? await db.select().from(quizAnswers).where(eq(quizAnswers.attemptId, attempt.id))
    : [];

  const leaderboard = manage
    ? await db
        .select({
          studentName: users.fullName,
          studentColor: users.avatarColor,
          studentAvatar: users.avatarUrl,
          score: quizAttempts.score,
          maxScore: quizAttempts.maxScore,
          submittedAt: quizAttempts.submittedAt,
          status: quizAttempts.status,
        })
        .from(quizAttempts)
        .innerJoin(users, eq(users.id, quizAttempts.studentId))
        .where(and(eq(quizAttempts.quizId, id), eq(quizAttempts.status, "submitted")))
        .orderBy(sql`(${qc(quizAttempts.score)}::numeric / nullif(${qc(quizAttempts.maxScore)}, 0)) desc`)
        .limit(100)
    : [];

  return {
    quiz: {
      ...quiz,
      startsAt: quiz.startsAt.toISOString(),
      endsAt: quiz.endsAt.toISOString(),
    },
    questions: questions.map((q) => ({
      id: q.id,
      orderIndex: q.orderIndex,
      type: q.type,
      prompt: q.prompt,
      imageUrl: q.imageUrl,
      options: q.options,
      points: q.points,
      ...(manage || attempt?.status === "submitted"
        ? { correctAnswer: q.correctAnswer }
        : {}),
    })),
    attempt: attempt
      ? {
          id: attempt.id,
          status: attempt.status,
          score: attempt.score,
          maxScore: attempt.maxScore,
          startedAt: attempt.startedAt.toISOString(),
          submittedAt: attempt.submittedAt?.toISOString() ?? null,
          answers: answers.map((a) => ({
            questionId: a.questionId,
            answer: a.answer,
            isCorrect: a.isCorrect,
            awardedPoints: a.awardedPoints,
          })),
        }
      : null,
    canManage: manage,
    isOpen,
    leaderboard: leaderboard.map((l) => ({
      ...l,
      submittedAt: l.submittedAt?.toISOString() ?? null,
    })),
  };
});

export const DELETE = route(async (req: NextRequest, ctx) => {
  const user = await requireUser(["admin", "teacher"]);
  const id = num((await ctx.params).id, "شناسه");
  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = await getDb();

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
  if (!quiz) throw new ApiError("آزمون یافت نشد", 404);
  if (user.role !== "admin" && quiz.teacherId !== user.id) {
    throw new ApiError("فقط سازنده‌ی آزمون یا مدیر می‌تواند آن را حذف کند", 403);
  }

  await assertDeletePassword(payload.deletePassword);

  const qImages = await db
    .select({ imageUrl: quizQuestions.imageUrl })
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, id));

  await db.delete(quizzes).where(eq(quizzes.id, id));
  await deleteStoredImages(qImages.map((q) => q.imageUrl));
  await audit(user.id, "delete", "quiz", id, { title: quiz.title });
  return { ok: true };
});
