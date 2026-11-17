import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { enrollments, quizAttempts, quizzes } from "@/db/schema";
import { ApiError, audit, num, requireUser, route } from "@/lib/api";

export const dynamic = "force-dynamic";

export const POST = route(async (_req, ctx) => {
  const user = await requireUser(["student"]);
  const id = num((await ctx.params).id, "شناسه");
  const db = await getDb();

  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
  if (!quiz) throw new ApiError("آزمون یافت نشد", 404);
  if (!quiz.isPublished) throw new ApiError("این آزمون منتشر نشده است", 403);

  const [enrolled] = await db
    .select({ classId: enrollments.classId })
    .from(enrollments)
    .where(and(eq(enrollments.studentId, user.id), eq(enrollments.classId, quiz.classId)))
    .limit(1);
  if (!enrolled) throw new ApiError("این آزمون مربوط به کلاس شما نیست", 403);

  const now = Date.now();
  if (now < quiz.startsAt.getTime())
    throw new ApiError("زمان شروع آزمون فرا نرسیده است", 409);
  if (now > quiz.endsAt.getTime()) throw new ApiError("مهلت شرکت در آزمون تمام شده است", 409);

  const [existing] = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, id), eq(quizAttempts.studentId, user.id)))
    .limit(1);

  if (existing) {
    if (existing.status === "submitted")
      throw new ApiError("شما قبلاً در این آزمون شرکت کرده‌اید", 409);
    return {
      attempt: {
        id: existing.id,
        startedAt: existing.startedAt.toISOString(),
        deadline: new Date(
          Math.min(
            existing.startedAt.getTime() + quiz.durationMinutes * 60_000,
            quiz.endsAt.getTime(),
          ),
        ).toISOString(),
      },
    };
  }

  const [created] = await db
    .insert(quizAttempts)
    .values({ quizId: id, studentId: user.id, status: "in_progress" })
    .returning();

  await audit(user.id, "start", "quiz", id);
  return {
    attempt: {
      id: created.id,
      startedAt: created.startedAt.toISOString(),
      deadline: new Date(
        Math.min(
          created.startedAt.getTime() + quiz.durationMinutes * 60_000,
          quiz.endsAt.getTime(),
        ),
      ).toISOString(),
    },
  };
});
