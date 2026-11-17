import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import {
  classes,
  quizAttempts,
  quizQuestions,
  quizzes,
  subjects,
  users,
} from "@/db/schema";
import { ApiError, audit, body, dateValue, num, requireUser, route, str } from "@/lib/api";
import { accessibleClassIds, assertCanManageClass } from "@/lib/access";
import { sanitizeImageUrl } from "@/lib/storage";
import { qc } from "@/lib/sql";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const user = await requireUser();
  const db = await getDb();
  const classIds = await accessibleClassIds(user);
  const mine = req.nextUrl.searchParams.get("mine") === "1";

  if (user.role === "student" && classIds.length === 0) return { items: [], canCreate: false };
  if (user.role === "teacher" && !mine && classIds.length === 0)
    return { items: [], canCreate: false };

  const filters = [];
  if (user.role === "student") {
    filters.push(eq(quizzes.isPublished, true));
    filters.push(inArray(quizzes.classId, classIds));
  } else if (user.role === "teacher" && mine) {
    filters.push(eq(quizzes.teacherId, user.id));
  } else if (user.role === "teacher") {
    filters.push(inArray(quizzes.classId, classIds));
  }

  const items = await db
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
      teacherName: users.fullName,
      questionCount: sql<number>`(select count(*) from ${quizQuestions} q where q.quiz_id = ${qc(quizzes.id)})::int`,
      maxScore: sql<string>`(select coalesce(sum(q.points), 0) from ${quizQuestions} q where q.quiz_id = ${qc(quizzes.id)})`,
      attemptCount: sql<number>`(select count(*) from ${quizAttempts} a where a.quiz_id = ${qc(quizzes.id)} and a.status = 'submitted')::int`,
      participantCount: sql<number>`(select count(*) from enrollments e where e.class_id = ${qc(quizzes.classId)})::int`,
      avgPercent: sql<number>`(select coalesce(round(avg(case when a.max_score > 0 then a.score / a.max_score * 100 end)), 0) from ${quizAttempts} a where a.quiz_id = ${qc(quizzes.id)} and a.status = 'submitted')::int`,
      myAttemptId:
        user.role === "student"
          ? sql<number | null>`(select a.id from ${quizAttempts} a where a.quiz_id = ${qc(quizzes.id)} and a.student_id = ${user.id} limit 1)`
          : sql<number | null>`null`,
      myAttemptStatus:
        user.role === "student"
          ? sql<string | null>`(select a.status::text from ${quizAttempts} a where a.quiz_id = ${qc(quizzes.id)} and a.student_id = ${user.id} limit 1)`
          : sql<string | null>`null`,
      myScore:
        user.role === "student"
          ? sql<string | null>`(select a.score from ${quizAttempts} a where a.quiz_id = ${qc(quizzes.id)} and a.student_id = ${user.id} limit 1)`
          : sql<string | null>`null`,
    })
    .from(quizzes)
    .innerJoin(classes, eq(classes.id, quizzes.classId))
    .innerJoin(subjects, eq(subjects.id, quizzes.subjectId))
    .innerJoin(users, eq(users.id, quizzes.teacherId))
    .where(filters.length ? and(...filters) : sql`true`)
    .orderBy(desc(quizzes.startsAt));

  return {
    items: items.map((q) => ({
      ...q,
      startsAt: q.startsAt.toISOString(),
      endsAt: q.endsAt.toISOString(),
    })),
    canCreate: user.role === "admin" || (user.role === "teacher" && classIds.length > 0),
  };
});

type QuestionInput = {
  prompt?: unknown;
  imageUrl?: unknown;
  options?: unknown;
  correctAnswer?: unknown;
  points?: unknown;
};

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser(["admin", "teacher"]);
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "classId",
    "subjectId",
    "title",
    "description",
    "durationMinutes",
    "startsAt",
    "endsAt",
    "questions",
    "isPublished",
  ]);

  const classId = num(payload.classId, "کلاس");
  const subjectId = num(payload.subjectId, "درس");
  const title = str(payload.title, "عنوان", { max: 160 });
  const description = str(payload.description ?? "", "توضیحات", { min: 0, max: 4000 });
  const durationMinutes = num(payload.durationMinutes ?? 20, "مدت آزمون");
  if (durationMinutes < 1 || durationMinutes > 180)
    throw new ApiError("مدت آزمون باید بین ۱ تا ۱۸۰ دقیقه باشد", 400);
  const startsAt = dateValue(payload.startsAt, "زمان شروع");
  const endsAt = dateValue(payload.endsAt, "زمان پایان");
  if (endsAt <= startsAt) throw new ApiError("زمان پایان باید بعد از شروع باشد", 400);

  const rawQuestions = Array.isArray(payload.questions)
    ? (payload.questions as QuestionInput[])
    : [];
  if (rawQuestions.length === 0) throw new ApiError("حداقل یک سؤال لازم است", 400);
  if (rawQuestions.length > 50) throw new ApiError("حداکثر ۵۰ سؤال مجاز است", 400);

  const questions = rawQuestions.map((q, i) => {
    const prompt = str(q.prompt, `متن سؤال ${i + 1}`, { max: 1000 });
    const imageUrl = sanitizeImageUrl(q.imageUrl);
    const options = Array.isArray(q.options)
      ? q.options.map((o) => String(o).trim()).filter(Boolean)
      : [];
    if (options.length < 2 || options.length > 6)
      throw new ApiError(`سؤال ${i + 1} باید بین ۲ تا ۶ گزینه داشته باشد`, 400);
    const correctAnswer = str(q.correctAnswer, `پاسخ صحیح سؤال ${i + 1}`, { max: 500 });
    if (!options.includes(correctAnswer))
      throw new ApiError(`پاسخ صحیح سؤال ${i + 1} باید یکی از گزینه‌ها باشد`, 400);
    const points = q.points == null ? 1 : num(q.points, `بارم سؤال ${i + 1}`);
    if (points <= 0 || points > 100) throw new ApiError("بارم سؤال نامعتبر است", 400);
    return { prompt, imageUrl, options, correctAnswer, points: points.toFixed(2), orderIndex: i };
  });

  await assertCanManageClass(user, classId);

  const db = await getDb();
  const [created] = await db
    .insert(quizzes)
    .values({
      classId,
      subjectId,
      teacherId: user.id,
      title,
      description,
      durationMinutes,
      startsAt,
      endsAt,
      isPublished: payload.isPublished !== false,
    })
    .returning();

  await db.insert(quizQuestions).values(
    questions.map((q) => ({
      quizId: created.id,
      orderIndex: q.orderIndex,
      type: "mcq" as const,
      prompt: q.prompt,
      imageUrl: q.imageUrl,
      options: q.options,
      correctAnswer: q.correctAnswer,
      points: q.points,
    })),
  );

  await audit(user.id, "create", "quiz", created.id, { title });
  return {
    item: { ...created, startsAt: created.startsAt.toISOString(), endsAt: created.endsAt.toISOString() },
  };
});

export const revalidate = 0;

export const PATCH = route(async (req: NextRequest) => {
  const user = await requireUser(["admin", "teacher"]);
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "id",
    "isPublished",
  ]);
  const id = num(payload.id, "شناسه");
  const db = await getDb();
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id)).limit(1);
  if (!quiz) throw new ApiError("آزمون یافت نشد", 404);
  if (user.role !== "admin" && quiz.teacherId !== user.id)
    throw new ApiError("فقط سازنده‌ی آزمون می‌تواند آن را تغییر دهد", 403);
  await db
    .update(quizzes)
    .set({ isPublished: Boolean(payload.isPublished) })
    .where(eq(quizzes.id, id));
  await audit(user.id, "update", "quiz", id, { isPublished: Boolean(payload.isPublished) });
  return { ok: true };
});
