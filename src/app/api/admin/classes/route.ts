import { asc, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { classes, enrollments, users } from "@/db/schema";
import { ApiError, audit, body, num, requireUser, route, str } from "@/lib/api";
import { assertDeletePassword, getSetting } from "@/lib/settings";
import { qc } from "@/lib/sql";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireUser(["admin"]);
  const db = await getDb();
  const rows = await db
    .select({
      id: classes.id,
      name: classes.name,
      grade: classes.grade,
      field: classes.field,
      room: classes.room,
      academicYear: classes.academicYear,
      homeroomTeacherId: classes.homeroomTeacherId,
      homeroomName: sql<string | null>`(select full_name from ${users} u where u.id = ${qc(classes.homeroomTeacherId)})`,
      studentCount: sql<number>`(select count(*) from ${enrollments} e where e.class_id = ${qc(classes.id)})::int`,
    })
    .from(classes)
    .orderBy(asc(classes.grade), asc(classes.name));
  return { items: rows };
});

export const POST = route(async (req: NextRequest) => {
  const admin = await requireUser(["admin"]);
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "name",
    "grade",
    "field",
    "room",
    "academicYear",
    "homeroomTeacherId",
  ]);

  const name = str(payload.name, "نام کلاس", { max: 80 });
  const grade = num(payload.grade, "پایه");
  if (grade < 1 || grade > 12) throw new ApiError("پایه تحصیلی باید بین ۱ تا ۱۲ باشد", 400);
  const field = str(payload.field, "رشته", { max: 60 });
  const room = payload.room ? String(payload.room).trim().slice(0, 20) || null : null;
  const defaultYear = (await getSetting("academic_year")) ?? "1405-1406";
  const academicYear = payload.academicYear
    ? String(payload.academicYear).trim().slice(0, 12) || defaultYear
    : defaultYear;
  const homeroomTeacherId =
    payload.homeroomTeacherId != null && payload.homeroomTeacherId !== ""
      ? num(payload.homeroomTeacherId, "مربی کلاس")
      : null;

  const db = await getDb();
  try {
    const [created] = await db
      .insert(classes)
      .values({ name, grade, field, room, academicYear, homeroomTeacherId })
      .returning();
    await audit(admin.id, "create", "class", created.id, { name, grade });
    return { item: created };
  } catch (err) {
    if (String(err).includes("classes_name_year_uq") || String(err).includes("duplicate")) {
      throw new ApiError("این کلاس در همین سال تحصیلی قبلاً ثبت شده است", 409);
    }
    throw err;
  }
});

export const PATCH = route(async (req: NextRequest) => {
  const admin = await requireUser(["admin"]);
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "id",
    "name",
    "grade",
    "field",
    "room",
    "academicYear",
    "homeroomTeacherId",
  ]);
  const id = num(payload.id, "شناسه کلاس");
  const patch: Record<string, unknown> = {};
  if (payload.name !== undefined) patch.name = str(payload.name, "نام کلاس", { max: 80 });
  if (payload.grade !== undefined) {
    const g = num(payload.grade, "پایه");
    if (g < 1 || g > 12) throw new ApiError("پایه تحصیلی باید بین ۱ تا ۱۲ باشد", 400);
    patch.grade = g;
  }
  if (payload.field !== undefined) patch.field = str(payload.field, "رشته", { max: 60 });
  if (payload.room !== undefined) patch.room = String(payload.room ?? "").trim().slice(0, 20) || null;
  if (payload.academicYear !== undefined)
    patch.academicYear = str(payload.academicYear, "سال تحصیلی", { max: 12 });
  if ("homeroomTeacherId" in payload) {
    patch.homeroomTeacherId =
      payload.homeroomTeacherId != null && payload.homeroomTeacherId !== ""
        ? num(payload.homeroomTeacherId, "مربی کلاس")
        : null;
  }

  const db = await getDb();
  const [updated] = await db.update(classes).set(patch).where(eq(classes.id, id)).returning();
  if (!updated) throw new ApiError("کلاس یافت نشد", 404);
  await audit(admin.id, "update", "class", id, { name: updated.name });
  return { item: updated };
});

export const DELETE = route(async (req: NextRequest) => {
  const admin = await requireUser(["admin"]);
  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = num(req.nextUrl.searchParams.get("id") ?? payload.id, "شناسه کلاس");
  await assertDeletePassword(payload.deletePassword);

  const db = await getDb();
  const [existing] = await db.select().from(classes).where(eq(classes.id, id)).limit(1);
  if (!existing) throw new ApiError("کلاس یافت نشد", 404);
  await db.delete(classes).where(eq(classes.id, id));
  await audit(admin.id, "delete", "class", id, { name: existing.name });
  return { ok: true };
});
