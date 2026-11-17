import { verifyWipePassword } from "@/lib/secrets";
import { HttpError, NO_STORE, errorResponse, readJson } from "@/lib/server/http";
import { requireManager } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** بررسی رمز پاک‌سازی بدون انجام عملیات (برای مرحله‌ی اول در پنل مدیریت) */
export async function POST(req: Request) {
  try {
    await requireManager(req);
    const body = await readJson<{ deletePassword?: unknown }>(req);
    const password = typeof body.deletePassword === "string" ? body.deletePassword : "";
    if (!password || !(await verifyWipePassword(password))) {
      throw new HttpError(403, "رمز پاک‌سازی اشتباه است.");
    }
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
