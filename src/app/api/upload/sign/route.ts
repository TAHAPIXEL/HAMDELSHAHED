import { HttpError, NO_STORE, clientIp, errorResponse, rateLimit } from "@/lib/server/http";
import { requireViewer } from "@/lib/server/session";
import { CHAT_MAX_BYTES, CHAT_MIME, VOICE_MAX_BYTES, createChatUpload } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

/**
 * امضای آپلود فایل پیام (ویس یا سند). فقط کاربران واردشده؛ نوع و حجم بررسی می‌شود.
 * پاسخ: uploadUrl (برای PUT مستقیم) و url (آدرس نهایی فایل در پیام).
 */
export async function POST(req: Request) {
  try {
    await requireViewer(req);
    rateLimit(`upload-chat:${clientIp(req)}`, 300, 10 * 60 * 1000);
    const body = (await req.json().catch(() => null)) as { mime?: unknown; size?: unknown } | null;
    const mime = typeof body?.mime === "string" ? body.mime.split(";")[0].trim().toLowerCase() : "";
    if (!CHAT_MIME[mime]) throw new HttpError(415, "این نوع فایل پذیرفته نمی‌شود.");
    const size = Number(body?.size);
    const limit = mime.startsWith("audio/") ? VOICE_MAX_BYTES : CHAT_MAX_BYTES;
    if (!Number.isFinite(size) || size <= 0 || size > limit) {
      throw new HttpError(413, "حجم فایل بیش از حد مجاز است.");
    }
    return Response.json(await createChatUpload(mime), { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
