import { eq, lt } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth";
import { ApiError, audit, createSession, route, str } from "@/lib/api";
import { checkLoginAllowed, clearLoginAttempts, registerFailedLogin } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest) => {
  const payload = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const username = str(payload?.username, "نام کاربری", { max: 64 }).toLowerCase();
  const password = str(payload?.password, "رمز عبور", { max: 200 });

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "local";
  const limitKey = `${ip}:${username}`;
  const limit = checkLoginAllowed(limitKey);
  if (!limit.allowed) {
    throw new ApiError(
      `تلاش‌های ناموفق زیاد بود؛ ${Math.ceil(limit.retryAfterSec / 60)} دقیقه دیگر دوباره تلاش کنید`,
      429,
    );
  }

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    registerFailedLogin(limitKey);
    throw new ApiError("نام کاربری یا رمز عبور نادرست است", 401);
  }
  if (!user.isActive) throw new ApiError("حساب شما غیرفعال شده است", 403);

  clearLoginAttempts(limitKey);
  // پاک‌سازی نشست‌های منقضی‌شده
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id, req.headers.get("user-agent"));
  await audit(user.id, "login", "session");

  return {
    user: {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      email: user.email,
      phone: user.phone,
      nationalId: user.nationalId,
    },
  };
});
