import { desc, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { announcements, classes, users } from "@/db/schema";
import { ApiError, audit, body, num, requireUser, route, str } from "@/lib/api";
import { announcementCondition, assertCanManageClass } from "@/lib/access";
import { deleteStoredImages, sanitizeImageUrl } from "@/lib/storage";
import { assertDeletePassword } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const GET = route(async (req: NextRequest) => {
  const user = await requireUser();
  const db = await getDb();
  const limit = Math.min(num(req.nextUrl.searchParams.get("limit") ?? 50, "limit"), 100);
  const condition = await announcementCondition(user);

  const query = db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      imageUrl: announcements.imageUrl,
      audience: announcements.audience,
      isPinned: announcements.isPinned,
      createdAt: announcements.createdAt,
      expiresAt: announcements.expiresAt,
      authorId: announcements.authorId,
      authorName: users.fullName,
      authorRole: users.role,
      authorColor: users.avatarColor,
      authorAvatar: users.avatarUrl,
      classId: announcements.classId,
      className: classes.name,
    })
    .from(announcements)
    .innerJoin(users, eq(users.id, announcements.authorId))
    .leftJoin(classes, eq(classes.id, announcements.classId))
    .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
    .limit(limit);

  const rows = condition ? await query.where(condition) : await query;
  return {
    items: rows.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      expiresAt: a.expiresAt?.toISOString() ?? null,
    })),
    canCreate: user.role !== "student",
  };
});

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser(["admin", "teacher"]);
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "title",
    "body",
    "imageUrl",
    "audience",
    "classId",
    "isPinned",
  ]);

  const title = str(payload.title, "عنوان", { max: 160 });
  const text = str(payload.body, "متن اطلاعیه", { max: 5000 });
  const imageUrl = sanitizeImageUrl(payload.imageUrl);
  const audience = ["all", "students", "teachers", "class"].includes(String(payload.audience))
    ? (String(payload.audience) as "all" | "students" | "teachers" | "class")
    : "all";

  let classId: number | null = null;
  if (audience === "class") {
    if (payload.classId == null) throw new ApiError("کلاس مقصد را انتخاب کنید", 400);
    classId = num(payload.classId, "کلاس");
    await assertCanManageClass(user, classId);
  }

  const db = await getDb();
  const [created] = await db
    .insert(announcements)
    .values({
      authorId: user.id,
      title,
      body: text,
      imageUrl,
      audience,
      classId,
      isPinned: Boolean(payload.isPinned),
    })
    .returning();

  await audit(user.id, "create", "announcement", created.id, { title });
  return { item: { ...created, createdAt: created.createdAt.toISOString() } };
});

export const DELETE = route(async (req: NextRequest) => {
  const user = await requireUser(["admin", "teacher"]);
  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = num(req.nextUrl.searchParams.get("id") ?? payload.id, "شناسه");
  const db = await getDb();
  const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!row) throw new ApiError("اطلاعیه یافت نشد", 404);
  if (user.role !== "admin" && row.authorId !== user.id)
    throw new ApiError("فقط نویسنده یا مدیر می‌تواند حذف کند", 403);

  await assertDeletePassword(payload.deletePassword);

  await db.delete(announcements).where(eq(announcements.id, id));
  if (row.imageUrl) await deleteStoredImages([row.imageUrl]);
  await audit(user.id, "delete", "announcement", id, { title: row.title });
  return { ok: true };
});

export const PATCH = route(async (req: NextRequest) => {
  const user = await requireUser(["admin", "teacher"]);
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "id",
    "isPinned",
  ]);
  const id = num(payload.id, "شناسه");
  const db = await getDb();
  const [row] = await db.select().from(announcements).where(eq(announcements.id, id)).limit(1);
  if (!row) throw new ApiError("اطلاعیه یافت نشد", 404);
  if (user.role !== "admin" && row.authorId !== user.id)
    throw new ApiError("دسترسی ندارید", 403);
  await db
    .update(announcements)
    .set({ isPinned: Boolean(payload.isPinned) })
    .where(eq(announcements.id, id));
  return { ok: true };
});

export const revalidate = 0;
