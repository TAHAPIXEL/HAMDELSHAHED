import { query } from "@/db";
import { verifyWipePassword } from "@/lib/secrets";
import { HttpError, NO_STORE, errorResponse, readJson } from "@/lib/server/http";
import { softDeleteAllRecords } from "@/lib/server/records";
import { purgeAllMedia } from "@/lib/server/storage";
import { requireManager } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** پاک‌سازی کامل داده‌های سامانه؛ فقط مدیریت، با رمز پاک‌سازی. همه‌ی نشست‌ها پایان می‌یابد. */
export async function POST(req: Request) {
  try {
    await requireManager(req);
    const body = await readJson<{ deletePassword?: unknown }>(req);
    const password = typeof body.deletePassword === "string" ? body.deletePassword : "";
    if (!password || !(await verifyWipePassword(password))) {
      throw new HttpError(403, "رمز پاک‌سازی اشتباه است.");
    }
    const removedFiles = await purgeAllMedia();
    const removedRecords = await softDeleteAllRecords();
    await query(`delete from hamdel_sessions`);
    return Response.json({ ok: true, removedRecords, removedFiles }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
