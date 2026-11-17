import { asc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { subjects } from "@/db/schema";
import { ApiError, audit, body, num, requireUser, route, str } from "@/lib/api";
import { assertDeletePassword } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireUser(["admin"]);
  const db = await getDb();
  const items = await db.select().from(subjects).orderBy(asc(subjects.name));
  return { items };
});

export const POST = route(async (req: NextRequest) => {
  const admin = await requireUser(["admin"]);
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "name",
    "code",
    "weeklyHours",
    "color",
  ]);
  const name = str(payload.name, "نام درس", { max: 80 });
  const code = str(payload.code, "کد درس", { max: 24 }).toUpperCase();
  const weeklyHours = num(payload.weeklyHours ?? 2, "ساعت هفتگی");
  if (weeklyHours < 1 || weeklyHours > 30)
    throw new ApiError("ساعت هفتگی باید بین ۱ تا ۳۰ باشد", 400);
  const color =
    typeof payload.color === "string" && /^#[0-9a-f]{6}$/i.test(payload.color)
      ? payload.color
      : "#6366f1";

  const db = await getDb();
  const [dupe] = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, code)).limit(1);
  if (dupe) throw new ApiError("این کد درس قبلاً ثبت شده است", 409);

  const [created] = await db
    .insert(subjects)
    .values({ name, code, weeklyHours, color })
    .returning();
  await audit(admin.id, "create", "subject", created.id, { name, code });
  return { item: created };
});

export const PATCH = route(async (req: NextRequest) => {
  const admin = await requireUser(["admin"]);
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "id",
    "name",
    "code",
    "weeklyHours",
    "color",
  ]);
  const id = num(payload.id, "شناسه درس");
  const patch: Record<string, unknown> = {};
  if (payload.name !== undefined) patch.name = str(payload.name, "نام درس", { max: 80 });
  if (payload.code !== undefined) patch.code = str(payload.code, "کد درس", { max: 24 }).toUpperCase();
  if (payload.weeklyHours !== undefined) {
    const h = num(payload.weeklyHours, "ساعت هفتگی");
    if (h < 1 || h > 30) throw new ApiError("ساعت هفتگی باید بین ۱ تا ۳۰ باشد", 400);
    patch.weeklyHours = h;
  }
  if (typeof payload.color === "string" && /^#[0-9a-f]{6}$/i.test(payload.color))
    patch.color = payload.color;

  const db = await getDb();
  const [updated] = await db.update(subjects).set(patch).where(eq(subjects.id, id)).returning();
  if (!updated) throw new ApiError("درس یافت نشد", 404);
  await audit(admin.id, "update", "subject", id, { name: updated.name });
  return { item: updated };
});

export const DELETE = route(async (req: NextRequest) => {
  const admin = await requireUser(["admin"]);
  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = num(req.nextUrl.searchParams.get("id") ?? payload.id, "شناسه درس");
  await assertDeletePassword(payload.deletePassword);

  const db = await getDb();
  const [existing] = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);
  if (!existing) throw new ApiError("درس یافت نشد", 404);
  try {
    await db.delete(subjects).where(eq(subjects.id, id));
  } catch {
    throw new ApiError(
      "برای این درس تکلیف یا آزمون ثبت شده است؛ ابتدا تکالیف/آزمون‌های مرتبط را حذف کنید",
      409,
    );
  }
  await audit(admin.id, "delete", "subject", id, { name: existing.name });
  return { ok: true };
});
