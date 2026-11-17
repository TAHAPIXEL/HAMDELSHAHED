import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { ApiError, audit, body, getSessionUser, requireUser, route, str } from "@/lib/api";
import { accessibleClassIds } from "@/lib/access";
import { deleteStoredImages, sanitizeImageUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

const ALLOWED_COLORS = new Set([
  "#6366f1",
  "#8b5cf6",
  "#0ea5e9",
  "#14b8a6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#f43f5e",
  "#334155",
]);

export const GET = route(async () => {
  const user = await getSessionUser();
  if (!user) return { user: null };
  const classIds = await accessibleClassIds(user);
  return { user, classIds };
});

/** ویرایش پروفایل، عکس پروفایل، اطلاعات تماس و رمز عبور توسط خود کاربر */
export const PATCH = route(async (req: NextRequest) => {
  const current = await requireUser();
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "fullName",
    "bio",
    "phone",
    "email",
    "avatarColor",
    "avatarUrl",
    "currentPassword",
    "newPassword",
  ]);

  const db = await getDb();
  const [record] = await db.select().from(users).where(eq(users.id, current.id)).limit(1);
  if (!record) throw new ApiError("کاربر یافت نشد", 404);

  const patch: Record<string, unknown> = { updatedAt: new Date() };

  if (payload.fullName !== undefined) {
    patch.fullName = str(payload.fullName, "نام و نام خانوادگی", { max: 120 });
  }
  if (payload.bio !== undefined) {
    const bio = String(payload.bio ?? "").trim().slice(0, 400);
    patch.bio = bio || null;
  }
  if (payload.phone !== undefined) {
    const phone = String(payload.phone ?? "").trim().slice(0, 20);
    patch.phone = phone || null;
  }
  if (payload.email !== undefined) {
    const email = String(payload.email ?? "").trim().slice(0, 160);
    patch.email = email || null;
  }
  if (payload.avatarColor !== undefined) {
    const color = String(payload.avatarColor).trim();
    if (ALLOWED_COLORS.has(color)) patch.avatarColor = color;
  }

  let oldAvatarToDelete: string | null = null;
  if ("avatarUrl" in payload) {
    const nextUrl = sanitizeImageUrl(payload.avatarUrl);
    if (record.avatarUrl && record.avatarUrl !== nextUrl) {
      oldAvatarToDelete = record.avatarUrl;
    }
    patch.avatarUrl = nextUrl;
  }

  if (payload.newPassword !== undefined && String(payload.newPassword).length > 0) {
    const currentPwd = str(payload.currentPassword, "رمز عبور فعلی", { max: 200 });
    if (!verifyPassword(currentPwd, record.passwordHash)) {
      throw new ApiError("رمز عبور فعلی نادرست است", 403);
    }
    const nextPwd = str(payload.newPassword, "رمز عبور جدید", { max: 200 });
    if (nextPwd.length < 8) {
      throw new ApiError("رمز عبور جدید باید حداقل ۸ کاراکتر باشد", 400);
    }
    patch.passwordHash = hashPassword(nextPwd);
  }

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, current.id))
    .returning();

  if (oldAvatarToDelete) {
    await deleteStoredImages([oldAvatarToDelete]);
  }

  await audit(current.id, "update_profile", "user", current.id, {
    fields: Object.keys(patch).filter((k) => k !== "passwordHash" && k !== "updatedAt"),
    passwordChanged: "passwordHash" in patch,
  });

  return {
    user: {
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName,
      role: updated.role,
      avatarColor: updated.avatarColor,
      avatarUrl: updated.avatarUrl,
      bio: updated.bio,
      email: updated.email,
      phone: updated.phone,
      nationalId: updated.nationalId,
    },
  };
});
