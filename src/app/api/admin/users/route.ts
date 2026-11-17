import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { enrollments, messages, submissions, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { ApiError, audit, body, num, requireUser, route, str } from "@/lib/api";
import { deleteStoredImages, sanitizeImageUrl } from "@/lib/storage";
import { assertDeletePassword } from "@/lib/settings";
import { qc } from "@/lib/sql";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  await requireUser(["admin"]);
  const db = await getDb();
  const params = req.nextUrl.searchParams;
  const q = params.get("q")?.trim();
  const role = params.get("role")?.trim();
  const limit = Math.min(Number(params.get("limit") ?? 150), 500);

  const filters = [];
  if (q)
    filters.push(
      or(
        ilike(users.fullName, `%${q}%`),
        ilike(users.username, `%${q}%`),
        ilike(users.nationalId, `%${q}%`),
      ),
    );
  if (role && ["admin", "teacher", "student"].includes(role))
    filters.push(eq(users.role, role as "admin" | "teacher" | "student"));

  const items = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      nationalId: users.nationalId,
      phone: users.phone,
      email: users.email,
      bio: users.bio,
      avatarColor: users.avatarColor,
      avatarUrl: users.avatarUrl,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      classId: sql<number | null>`(select e.class_id from ${enrollments} e where e.student_id = ${qc(users.id)} limit 1)`,
      className: sql<string | null>`(select c.name from ${enrollments} e join classes c on c.id = e.class_id where e.student_id = ${qc(users.id)} limit 1)`,
    })
    .from(users)
    .where(filters.length ? and(...filters) : sql`true`)
    .orderBy(asc(users.role), asc(users.fullName))
    .limit(limit);

  return {
    items: items.map((u) => ({
      ...u,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
  };
});

export const POST = route(async (req: NextRequest) => {
  const admin = await requireUser(["admin"]);
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "username",
    "fullName",
    "password",
    "role",
    "classId",
    "phone",
    "email",
    "nationalId",
    "bio",
    "avatarUrl",
    "avatarColor",
  ]);

  const username = str(payload.username, "نام کاربری", { max: 64 }).toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(username))
    throw new ApiError("نام کاربری فقط حروف لاتین کوچک، عدد، نقطه و خط تیره (حداقل ۳ کاراکتر)", 400);
  const fullName = str(payload.fullName, "نام و نام خانوادگی", { max: 120 });
  const password = str(payload.password, "رمز عبور", { max: 200 });
  if (password.length < 8) throw new ApiError("رمز عبور باید حداقل ۸ کاراکتر باشد", 400);
  if (!["admin", "teacher", "student"].includes(String(payload.role)))
    throw new ApiError("نقش نامعتبر است", 400);
  const role = String(payload.role) as "admin" | "teacher" | "student";
  const avatarUrl = sanitizeImageUrl(payload.avatarUrl);
  const nationalId = payload.nationalId ? String(payload.nationalId).trim().slice(0, 10) || null : null;

  const db = await getDb();
  const [dupe] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (dupe) throw new ApiError("این نام کاربری قبلاً ثبت شده است", 409);

  if (nationalId) {
    const [dupeNid] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.nationalId, nationalId))
      .limit(1);
    if (dupeNid) throw new ApiError("این کد ملی قبلاً برای کاربر دیگری ثبت شده است", 409);
  }

  const palette = ["#6366f1", "#8b5cf6", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444"];
  const chosenColor =
    typeof payload.avatarColor === "string" && /^#[0-9a-f]{6}$/i.test(payload.avatarColor)
      ? payload.avatarColor
      : palette[Math.floor(Math.random() * palette.length)];

  const [created] = await db
    .insert(users)
    .values({
      username,
      fullName,
      passwordHash: hashPassword(password),
      role,
      phone: payload.phone ? String(payload.phone).trim().slice(0, 20) || null : null,
      email: payload.email ? String(payload.email).trim().slice(0, 160) || null : null,
      nationalId,
      bio: payload.bio ? String(payload.bio).trim().slice(0, 400) || null : null,
      avatarUrl,
      avatarColor: chosenColor,
    })
    .returning();

  if (role === "student" && payload.classId != null && payload.classId !== "") {
    const classId = num(payload.classId, "کلاس");
    await db.insert(enrollments).values({ studentId: created.id, classId }).onConflictDoNothing();
  }

  await audit(admin.id, "create", "user", created.id, { username, role });
  return { item: { ...created, passwordHash: undefined } };
});

export const PATCH = route(async (req: NextRequest) => {
  const admin = await requireUser(["admin"]);
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "id",
    "fullName",
    "isActive",
    "password",
    "role",
    "classId",
    "phone",
    "email",
    "nationalId",
    "bio",
    "avatarUrl",
  ]);
  const id = num(payload.id, "شناسه");
  if (id === admin.id && payload.isActive === false)
    throw new ApiError("نمی‌توانید حساب خودتان را غیرفعال کنید", 400);
  if (id === admin.id && payload.role && payload.role !== "admin")
    throw new ApiError("نمی‌توانید نقش مدیریت خودتان را تغییر دهید", 400);

  const db = await getDb();
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new ApiError("کاربر یافت نشد", 404);

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (payload.fullName !== undefined) {
    patch.fullName = str(payload.fullName, "نام و نام خانوادگی", { max: 120 });
  }
  if (typeof payload.isActive === "boolean") patch.isActive = payload.isActive;
  if (payload.role && ["admin", "teacher", "student"].includes(String(payload.role)))
    patch.role = String(payload.role);
  if (payload.phone !== undefined) patch.phone = String(payload.phone ?? "").trim().slice(0, 20) || null;
  if (payload.email !== undefined) patch.email = String(payload.email ?? "").trim().slice(0, 160) || null;
  if (payload.nationalId !== undefined)
    patch.nationalId = String(payload.nationalId ?? "").trim().slice(0, 10) || null;
  if (payload.bio !== undefined) patch.bio = String(payload.bio ?? "").trim().slice(0, 400) || null;

  let oldAvatar: string | null = null;
  if ("avatarUrl" in payload) {
    const nextUrl = sanitizeImageUrl(payload.avatarUrl);
    if (target.avatarUrl && target.avatarUrl !== nextUrl) oldAvatar = target.avatarUrl;
    patch.avatarUrl = nextUrl;
  }

  if (payload.password != null && String(payload.password).length > 0) {
    const password = str(payload.password, "رمز عبور", { max: 200 });
    if (password.length < 8) throw new ApiError("رمز عبور باید حداقل ۸ کاراکتر باشد", 400);
    patch.passwordHash = hashPassword(password);
  }

  const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning();

  // به‌روزرسانی کلاس دانش‌آموز
  if ("classId" in payload) {
    await db.delete(enrollments).where(eq(enrollments.studentId, id));
    const effectiveRole = (patch.role as string | undefined) ?? target.role;
    if (effectiveRole === "student" && payload.classId != null && payload.classId !== "") {
      const classId = num(payload.classId, "کلاس");
      await db.insert(enrollments).values({ studentId: id, classId }).onConflictDoNothing();
    }
  }

  if (oldAvatar) await deleteStoredImages([oldAvatar]);
  await audit(admin.id, "update", "user", id, {
    fields: Object.keys(patch).filter((k) => k !== "passwordHash" && k !== "updatedAt"),
  });
  return { item: { ...updated, passwordHash: undefined } };
});

export const DELETE = route(async (req: NextRequest) => {
  const admin = await requireUser(["admin"]);
  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = num(req.nextUrl.searchParams.get("id") ?? payload.id, "شناسه");
  if (id === admin.id) throw new ApiError("نمی‌توانید حساب خودتان را حذف کنید", 400);

  await assertDeletePassword(payload.deletePassword);

  const db = await getDb();
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target) throw new ApiError("کاربر یافت نشد", 404);

  const [msgImgs, subImgs] = await Promise.all([
    db.select({ imageUrl: messages.imageUrl }).from(messages).where(eq(messages.senderId, id)),
    db.select({ imageUrl: submissions.imageUrl }).from(submissions).where(eq(submissions.studentId, id)),
  ]);

  await db.delete(users).where(eq(users.id, id));
  await deleteStoredImages([
    target.avatarUrl,
    ...msgImgs.map((m) => m.imageUrl),
    ...subImgs.map((s) => s.imageUrl),
  ]);
  await audit(admin.id, "delete", "user", id, { username: target.username, fullName: target.fullName });
  return { ok: true };
});

export const revalidate = 0;
