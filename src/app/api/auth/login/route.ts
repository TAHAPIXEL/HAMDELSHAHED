import { query } from "@/db";
import { DEV_USER_ID } from "@/lib/collections";
import { verifyDevLogin } from "@/lib/secrets";
import { HttpError, NO_STORE, clientIp, errorResponse, rateLimit, readJson } from "@/lib/server/http";
import { createSession } from "@/lib/server/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    rateLimit(`login:${clientIp(req)}`, 30, 10 * 60 * 1000);
    const body = await readJson<{ phone?: unknown; password?: unknown }>(req);
    const phone = String(body.phone ?? "").trim();
    const password = String(body.password ?? "").trim();
    if (!phone || !password) throw new HttpError(400, "شماره تلفن و رمز عبور را وارد کنید.");

    // ورود ویژه‌ی مدیر ارشد (کد آن فقط به صورت هش در secrets.ts است)
    if (await verifyDevLogin(phone, password)) {
      const token = await createSession(DEV_USER_ID, true);
      return Response.json({ token, dev: true, user: null }, { headers: NO_STORE });
    }

    const found = await query<{ id: string; data: Record<string, unknown> }>(
      `select id, data from hamdel_records
        where collection = 'users' and deleted = false and data->>'phone' = $1
        limit 1`,
      [phone],
    );
    const row = found.rows[0];
    if (!row) throw new HttpError(401, "کاربری با این شماره تلفن یافت نشد.");
    if (String(row.data.password ?? "") !== password) throw new HttpError(401, "رمز عبور اشتباه است.");

    const now = Date.now();
    await query(
      `update hamdel_records
          set data = jsonb_set(data, '{lastLoginAt}', to_jsonb($2::bigint)),
              rev = nextval('hamdel_rev_seq'),
              updated_at = now()
        where collection = 'users' and id = $1`,
      [row.id, now],
    );
    const token = await createSession(row.id, false);
    return Response.json(
      { token, dev: false, user: { ...row.data, id: row.id, lastLoginAt: now } },
      { headers: NO_STORE },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
