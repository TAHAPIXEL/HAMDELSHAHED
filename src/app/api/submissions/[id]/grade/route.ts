import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { assignments, submissions } from "@/db/schema";
import { ApiError, audit, body, num, requireUser, route, str } from "@/lib/api";
import { canManageClass } from "@/lib/access";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest, ctx) => {
  const user = await requireUser(["admin", "teacher"]);
  const id = num((await ctx.params).id, "شناسه");
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "score",
    "feedback",
  ]);

  const db = await getDb();
  const [row] = await db
    .select({
      submission: submissions,
      assignment: assignments,
    })
    .from(submissions)
    .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
    .where(eq(submissions.id, id))
    .limit(1);
  if (!row) throw new ApiError("پاسخ یافت نشد", 404);

  if (!(await canManageClass(user, row.assignment.classId)) && user.role !== "admin")
    throw new ApiError("دسترسی ندارید", 403);

  const max = Number(row.assignment.maxScore);
  const score = num(payload.score, "نمره");
  if (score < 0 || score > max) throw new ApiError(`نمره باید بین ۰ و ${max} باشد`, 400);
  const feedback = payload.feedback == null ? null : str(payload.feedback, "بازخورد", { min: 0, max: 2000 });

  const [updated] = await db
    .update(submissions)
    .set({
      score: score.toFixed(2),
      feedback,
      status: "graded",
      gradedAt: new Date(),
      gradedBy: user.id,
    })
    .where(eq(submissions.id, id))
    .returning();

  await audit(user.id, "grade", "submission", id, { score });
  return { item: { ...updated, submittedAt: updated.submittedAt.toISOString() } };
});
