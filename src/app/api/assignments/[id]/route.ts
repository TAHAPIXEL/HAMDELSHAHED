import { and, asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { assignments, classes, subjects, submissions, users } from "@/db/schema";
import { ApiError, audit, num, requireUser, route } from "@/lib/api";
import { accessibleClassIds, canManageClass } from "@/lib/access";
import { deleteStoredImages } from "@/lib/storage";
import { assertDeletePassword } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const GET = route(async (_req, ctx) => {
  const user = await requireUser();
  const id = num((await ctx.params).id, "شناسه");
  const db = await getDb();

  const [assignment] = await db
    .select({
      id: assignments.id,
      title: assignments.title,
      description: assignments.description,
      imageUrl: assignments.imageUrl,
      dueAt: assignments.dueAt,
      maxScore: assignments.maxScore,
      classId: assignments.classId,
      className: classes.name,
      subjectId: assignments.subjectId,
      subjectName: subjects.name,
      subjectColor: subjects.color,
      teacherId: assignments.teacherId,
      teacherName: users.fullName,
    })
    .from(assignments)
    .innerJoin(classes, eq(classes.id, assignments.classId))
    .innerJoin(subjects, eq(subjects.id, assignments.subjectId))
    .innerJoin(users, eq(users.id, assignments.teacherId))
    .where(eq(assignments.id, id))
    .limit(1);

  if (!assignment) throw new ApiError("تکلیف یافت نشد", 404);

  const manage = await canManageClass(user, assignment.classId);
  if (user.role === "student") {
    const classIds = await accessibleClassIds(user);
    if (!classIds.includes(assignment.classId)) throw new ApiError("دسترسی ندارید", 403);
  } else if (!manage && user.role !== "admin") {
    throw new ApiError("دسترسی ندارید", 403);
  }

  const list = await db
    .select({
      id: submissions.id,
      studentId: submissions.studentId,
      studentName: users.fullName,
      studentColor: users.avatarColor,
      studentAvatar: users.avatarUrl,
      content: submissions.content,
      imageUrl: submissions.imageUrl,
      status: submissions.status,
      score: submissions.score,
      feedback: submissions.feedback,
      submittedAt: submissions.submittedAt,
      gradedAt: submissions.gradedAt,
    })
    .from(submissions)
    .innerJoin(users, eq(users.id, submissions.studentId))
    .where(
      user.role === "student"
        ? and(eq(submissions.assignmentId, id), eq(submissions.studentId, user.id))
        : eq(submissions.assignmentId, id),
    )
    .orderBy(asc(users.fullName));

  return {
    assignment: { ...assignment, dueAt: assignment.dueAt.toISOString() },
    submissions: list.map((s) => ({
      ...s,
      submittedAt: s.submittedAt.toISOString(),
      gradedAt: s.gradedAt?.toISOString() ?? null,
    })),
    canManage: manage,
  };
});

export const DELETE = route(async (req: NextRequest, ctx) => {
  const user = await requireUser(["admin", "teacher"]);
  const id = num((await ctx.params).id, "شناسه");
  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const db = await getDb();

  const [assignment] = await db.select().from(assignments).where(eq(assignments.id, id)).limit(1);
  if (!assignment) throw new ApiError("تکلیف یافت نشد", 404);
  if (user.role !== "admin" && assignment.teacherId !== user.id) {
    throw new ApiError("فقط سازنده‌ی تکلیف یا مدیر می‌تواند آن را حذف کند", 403);
  }

  await assertDeletePassword(payload.deletePassword);

  const subImages = await db
    .select({ imageUrl: submissions.imageUrl })
    .from(submissions)
    .where(eq(submissions.assignmentId, id));

  await db.delete(assignments).where(eq(assignments.id, id));
  await deleteStoredImages([assignment.imageUrl, ...subImages.map((s) => s.imageUrl)]);
  await audit(user.id, "delete", "assignment", id, { title: assignment.title });
  return { ok: true };
});
