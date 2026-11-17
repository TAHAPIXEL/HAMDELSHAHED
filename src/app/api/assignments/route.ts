import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { assignments, classes, subjects, submissions, users } from "@/db/schema";
import { ApiError, audit, body, dateValue, num, requireUser, route, str } from "@/lib/api";
import { accessibleClassIds, assertCanManageClass } from "@/lib/access";
import { sanitizeImageUrl } from "@/lib/storage";
import { qc } from "@/lib/sql";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const user = await requireUser();
  const db = await getDb();
  const classIds = await accessibleClassIds(user);
  const classIdParam = req.nextUrl.searchParams.get("classId");
  const targetClass = classIdParam ? num(classIdParam, "کلاس") : null;
  const mine = req.nextUrl.searchParams.get("mine") === "1";

  const filters = [];
  if (user.role === "student") {
    if (!classIds.length) return { items: [], canCreate: false };
    filters.push(inArray(assignments.classId, classIds));
  } else if (targetClass) {
    await assertCanManageClass(user, targetClass).catch(() => {
      if (user.role !== "admin") throw new ApiError("دسترسی ندارید", 403);
    });
    filters.push(eq(assignments.classId, targetClass));
  } else if (user.role === "teacher" && mine) {
    filters.push(eq(assignments.teacherId, user.id));
  } else if (user.role === "teacher") {
    if (!classIds.length) return { items: [], canCreate: false };
    filters.push(inArray(assignments.classId, classIds));
  }

  const items = await db
    .select({
      id: assignments.id,
      title: assignments.title,
      description: assignments.description,
      imageUrl: assignments.imageUrl,
      dueAt: assignments.dueAt,
      maxScore: assignments.maxScore,
      createdAt: assignments.createdAt,
      classId: assignments.classId,
      className: classes.name,
      subjectId: assignments.subjectId,
      subjectName: subjects.name,
      subjectColor: subjects.color,
      teacherId: assignments.teacherId,
      teacherName: users.fullName,
      submissionCount: sql<number>`(select count(*) from ${submissions} s where s.assignment_id = ${qc(assignments.id)})::int`,
      gradedCount: sql<number>`(select count(*) from ${submissions} s where s.assignment_id = ${qc(assignments.id)} and s.status = 'graded')::int`,
      studentCount: sql<number>`(select count(*) from enrollments e where e.class_id = ${qc(assignments.classId)})::int`,
      mySubmissionId:
        user.role === "student"
          ? sql<number | null>`(select s.id from ${submissions} s where s.assignment_id = ${qc(assignments.id)} and s.student_id = ${user.id} limit 1)`
          : sql<number | null>`null`,
      mySubmissionStatus:
        user.role === "student"
          ? sql<string | null>`(select s.status::text from ${submissions} s where s.assignment_id = ${qc(assignments.id)} and s.student_id = ${user.id} limit 1)`
          : sql<string | null>`null`,
      myScore:
        user.role === "student"
          ? sql<string | null>`(select s.score from ${submissions} s where s.assignment_id = ${qc(assignments.id)} and s.student_id = ${user.id} limit 1)`
          : sql<string | null>`null`,
    })
    .from(assignments)
    .innerJoin(classes, eq(classes.id, assignments.classId))
    .innerJoin(subjects, eq(subjects.id, assignments.subjectId))
    .innerJoin(users, eq(users.id, assignments.teacherId))
    .where(filters.length ? and(...filters) : sql`true`)
    .orderBy(desc(assignments.dueAt));

  return {
    items: items.map((a) => ({
      ...a,
      dueAt: a.dueAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
    })),
    canCreate: user.role === "admin" || (user.role === "teacher" && classIds.length > 0),
  };
});

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser(["admin", "teacher"]);
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "classId",
    "subjectId",
    "title",
    "description",
    "imageUrl",
    "dueAt",
    "maxScore",
  ]);
  const classId = num(payload.classId, "کلاس");
  const subjectId = num(payload.subjectId, "درس");
  const title = str(payload.title, "عنوان", { max: 160 });
  const description = str(payload.description ?? "", "توضیحات", { min: 0, max: 8000 });
  const imageUrl = sanitizeImageUrl(payload.imageUrl);
  const dueAt = dateValue(payload.dueAt, "مهلت تحویل");
  const maxScore = payload.maxScore == null ? 20 : num(payload.maxScore, "بارم");
  if (maxScore <= 0 || maxScore > 100) throw new ApiError("بارم باید بین ۰ و ۱۰۰ باشد", 400);

  await assertCanManageClass(user, classId);

  const db = await getDb();
  const [created] = await db
    .insert(assignments)
    .values({
      classId,
      subjectId,
      teacherId: user.id,
      title,
      description,
      imageUrl,
      dueAt,
      maxScore: maxScore.toFixed(2),
    })
    .returning();

  await audit(user.id, "create", "assignment", created.id, { title });
  return { item: { ...created, dueAt: created.dueAt.toISOString() } };
});

export const revalidate = 0;
