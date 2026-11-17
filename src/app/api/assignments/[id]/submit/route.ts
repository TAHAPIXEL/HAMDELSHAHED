import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { assignments, enrollments, submissions } from "@/db/schema";
import { ApiError, audit, body, num, requireUser, route } from "@/lib/api";
import { deleteStoredImages, sanitizeImageUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest, ctx) => {
  const user = await requireUser(["student"]);
  const id = num((await ctx.params).id, "شناسه");
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "content",
    "imageUrl",
  ]);
  const content = typeof payload.content === "string" ? payload.content.trim() : "";
  if (content.length > 8000) throw new ApiError("پاسخ بیش از حد طولانی است", 400);
  const imageUrl = sanitizeImageUrl(payload.imageUrl);
  if (!content && !imageUrl) {
    throw new ApiError("متن پاسخ یا تصویر تکلیف را وارد کنید", 400);
  }

  const db = await getDb();
  const [assignment] = await db
    .select()
    .from(assignments)
    .where(eq(assignments.id, id))
    .limit(1);
  if (!assignment) throw new ApiError("تکلیف یافت نشد", 404);

  const [enrolled] = await db
    .select({ classId: enrollments.classId })
    .from(enrollments)
    .where(and(eq(enrollments.studentId, user.id), eq(enrollments.classId, assignment.classId)))
    .limit(1);
  if (!enrolled) throw new ApiError("این تکلیف مربوط به کلاس شما نیست", 403);

  const [existing] = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.assignmentId, id), eq(submissions.studentId, user.id)))
    .limit(1);

  const late = Date.now() > assignment.dueAt.getTime();

  if (existing) {
    if (existing.status === "graded")
      throw new ApiError("این تکلیف تصحیح شده و قابل ویرایش نیست", 409);
    const oldImage =
      existing.imageUrl && existing.imageUrl !== imageUrl ? existing.imageUrl : null;
    const [updated] = await db
      .update(submissions)
      .set({
        content,
        imageUrl,
        status: late ? "late" : "submitted",
        submittedAt: new Date(),
      })
      .where(eq(submissions.id, existing.id))
      .returning();
    if (oldImage) await deleteStoredImages([oldImage]);
    await audit(user.id, "update", "submission", updated.id);
    return { item: { ...updated, submittedAt: updated.submittedAt.toISOString() } };
  }

  const [created] = await db
    .insert(submissions)
    .values({
      assignmentId: id,
      studentId: user.id,
      content,
      imageUrl,
      status: late ? "late" : "submitted",
    })
    .returning();
  await audit(user.id, "create", "submission", created.id);
  return { item: { ...created, submittedAt: created.submittedAt.toISOString() } };
});
