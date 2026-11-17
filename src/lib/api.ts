import { cookies, headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { auditLogs, sessions, users } from "@/db/schema";
import { SESSION_COOKIE, SESSION_TTL_MS, createSessionToken } from "./auth";

export type Role = "admin" | "teacher" | "student";

export type SessionUser = {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  avatarColor: string;
  avatarUrl: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  nationalId: string | null;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** اعتبارسنجی ساده‌ی ورودی‌ها */
export function body<T extends Record<string, unknown>>(value: unknown, keys: (keyof T)[]): T {
  if (!value || typeof value !== "object") throw new ApiError("بدنه‌ی درخواست نامعتبر است", 400);
  const src = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in src) out[key as string] = src[key as string];
  }
  return out as T;
}

export function str(value: unknown, field: string, opts: { max?: number; min?: number } = {}) {
  if (typeof value !== "string") throw new ApiError(`${field} باید متن باشد`, 400);
  const trimmed = value.trim();
  const min = opts.min ?? 1;
  if (trimmed.length < min) throw new ApiError(`${field} نمی‌تواند خالی باشد`, 400);
  if (opts.max && trimmed.length > opts.max)
    throw new ApiError(`${field} بیش از حد طولانی است (حداکثر ${opts.max} کاراکتر)`, 400);
  return trimmed;
}

export function num(value: unknown, field: string) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) throw new ApiError(`${field} باید عدد باشد`, 400);
  return n;
}

export function dateValue(value: unknown, field: string) {
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) throw new ApiError(`${field} تاریخ نامعتبر است`, 400);
  return d;
}

/** کاربر جاری بر اساس کوکی نشست */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = await getDb();
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      role: users.role,
      avatarColor: users.avatarColor,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      email: users.email,
      phone: users.phone,
      nationalId: users.nationalId,
      isActive: users.isActive,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row || !row.isActive) return null;
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    role: row.role,
    avatarColor: row.avatarColor,
    avatarUrl: row.avatarUrl,
    bio: row.bio,
    email: row.email,
    phone: row.phone,
    nationalId: row.nationalId,
  };
}

export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError("ابتدا وارد سامانه شوید", 401);
  if (roles && !roles.includes(user.role))
    throw new ApiError("شما به این بخش دسترسی ندارید", 403);
  return user;
}

export async function createSession(userId: number, userAgent?: string | null) {
  const db = await getDb();
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({
    token,
    userId,
    expiresAt,
    userAgent: userAgent?.slice(0, 240) ?? null,
  });
  const jar = await cookies();
  const forwardedProto = (await headers()).get("x-forwarded-proto");
  const secure =
    forwardedProto === "https" ||
    (process.env.NODE_ENV === "production" && forwardedProto === null);
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  jar.delete(SESSION_COOKIE);
}

export async function audit(
  actorId: number | null,
  action: string,
  entity: string,
  entityId?: number | null,
  meta?: Record<string, unknown>,
) {
  const db = await getDb();
  await db.insert(auditLogs).values({ actorId, action, entity, entityId: entityId ?? null, meta });
}

export type RouteContext = { params: Promise<Record<string, string>> };

/** پوشش خطاها برای Route Handlerها */
export function route<T>(handler: (req: NextRequest, ctx: RouteContext) => Promise<T>) {
  return async (req: NextRequest, ctx: RouteContext): Promise<Response> => {
    try {
      const result = await handler(req, ctx);
      if (result instanceof Response) return result;
      return Response.json(result ?? { ok: true });
    } catch (error) {
      if (error instanceof ApiError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      console.error("[api]", error);
      const message =
        process.env.NODE_ENV === "production"
          ? "خطای داخلی سرور"
          : error instanceof Error
            ? error.message
            : "خطای نامشخص";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
