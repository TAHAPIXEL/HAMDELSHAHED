import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { classSubjects, classes, subjects, users } from "@/db/schema";
import { ApiError, audit, body, num, requireUser, route } from "@/lib/api";

export const dynamic = "force-dynamic";

/** مدیریت برنامه‌ی تدریس (تخصیص دبیر به درس در هر کلاس) */
export const GET = route(async () => {
  await requireUser(["admin"]);
  const db = await getDb();
  const items = await db
    .select({
      id: classSubjects.id,
      classId: classSubjects.classId,
      className: classes.name,
      subjectId: classSubjects.subjectId,
      subjectName: subjects.name,
      subjectColor: subjects.color,
      teacherId: classSubjects.teacherId,
      teacherName: users.fullName,
    })
    .from(classSubjects)
    .innerJoin(classes, eq(classes.id, classSubjects.classId))
    .innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
    .innerJoin(users, eq(users.id, classSubjects.teacherId))
    .orderBy(asc(classes.grade), asc(classes.name), asc(subjects.name));

  return { items };
});

export const POST = route(async (req: NextRequest) => {
  const admin = await requireUser(["admin"]);
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "classId",
    "subjectId",
    "teacherId",
  ]);
  const classId = num(payload.classId, "کلاس");
  const subjectId = num(payload.subjectId, "درس");
  const teacherId = num(payload.teacherId, "دبیر");

  const db = await getDb();
  const [created] = await db
    .insert(classSubjects)
    .values({ classId, subjectId, teacherId })
    .onConflictDoUpdate({
      target: [classSubjects.classId, classSubjects.subjectId],
      set: { teacherId },
    })
    .returning();

  await audit(admin.id, "assign", "class_subject", created.id, { classId, subjectId, teacherId });
  return { item: created };
});

export const DELETE = route(async (req: NextRequest) => {
  const admin = await requireUser(["admin"]);
  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = num(req.nextUrl.searchParams.get("id") ?? payload.id, "شناسه");
  const db = await getDb();
  const [existing] = await db.select().from(classSubjects).where(eq(classSubjects.id, id)).limit(1);
  if (!existing) throw new ApiError("تخصیص یافت نشد", 404);
  await db.delete(classSubjects).where(eq(classSubjects.id, id));
  await audit(admin.id, "unassign", "class_subject", id);
  return { ok: true };
});
