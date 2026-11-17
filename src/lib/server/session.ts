import { createHash, randomBytes } from "node:crypto";
import { query } from "@/db";
import { DEV_USER_ID, isManagerRole } from "@/lib/collections";
import { HttpError } from "./http";

export const SESSION_TTL_DAYS = 30;

export interface Viewer {
  id: string;
  role: string;
  dev: boolean;
  name: string;
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,128})$/.exec(header);
  return match ? match[1] : null;
}

export async function createSession(userId: string, dev: boolean): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await query(
    `insert into hamdel_sessions (token_hash, user_id, is_dev, expires_at)
     values ($1, $2, $3, now() + make_interval(days => $4))`,
    [hashToken(token), userId, dev, SESSION_TTL_DAYS],
  );
  // پاک‌سازی نشست‌های منقضی‌شده (بدون هزینه‌ی قابل توجه)
  await query(`delete from hamdel_sessions where expires_at < now()`);
  return token;
}

export async function viewerFromRequest(req: Request): Promise<Viewer | null> {
  const token = bearerToken(req);
  if (!token) return null;
  const { rows } = await query<{ user_id: string; is_dev: boolean }>(
    `select user_id, is_dev from hamdel_sessions where token_hash = $1 and expires_at > now()`,
    [hashToken(token)],
  );
  const session = rows[0];
  if (!session) return null;
  if (session.is_dev) {
    return { id: DEV_USER_ID, role: "developer", dev: true, name: "مدیر ارشد" };
  }
  const user = await query<{ data: Record<string, unknown> }>(
    `select data from hamdel_records where collection = 'users' and id = $1 and deleted = false`,
    [session.user_id],
  );
  const data = user.rows[0]?.data;
  if (!data) return null;
  return {
    id: session.user_id,
    role: String(data.role ?? "student"),
    dev: false,
    name: `${String(data.firstName ?? "")} ${String(data.lastName ?? "")}`.trim(),
  };
}

export async function requireViewer(req: Request): Promise<Viewer> {
  const viewer = await viewerFromRequest(req);
  if (!viewer) throw new HttpError(401, "نشست شما معتبر نیست؛ دوباره وارد شوید.");
  return viewer;
}

export async function requireManager(req: Request): Promise<Viewer> {
  const viewer = await requireViewer(req);
  if (!isManagerRole(viewer.role)) {
    throw new HttpError(403, "این عملیات فقط برای مدیریت مدرسه مجاز است.");
  }
  return viewer;
}

export async function destroySession(req: Request): Promise<void> {
  const token = bearerToken(req);
  if (token) await query(`delete from hamdel_sessions where token_hash = $1`, [hashToken(token)]);
}
