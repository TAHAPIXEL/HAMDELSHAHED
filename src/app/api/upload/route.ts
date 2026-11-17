import { HttpError, NO_STORE, clientIp, errorResponse, rateLimit } from "@/lib/server/http";
import { requireViewer } from "@/lib/server/session";
import { MAX_UPLOAD_BYTES, sniffImage, storeImage } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

/** آپلود تصویر (پروفایل، پیام، اطلاعیه، تکلیف، پاسخ، آزمون) در Supabase Storage */
export async function POST(req: Request) {
  try {
    await requireViewer(req);
    rateLimit(`upload:${clientIp(req)}`, 120, 10 * 60 * 1000);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new HttpError(400, "فایلی ارسال نشده است.");
    if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
      throw new HttpError(413, "حجم تصویر باید بین ۱ بایت و ۳ مگابایت باشد.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = sniffImage(bytes);
    if (!mime) throw new HttpError(415, "فقط تصویر JPEG، PNG، WebP یا GIF پذیرفته می‌شود.");
    const stored = await storeImage(bytes, mime);
    return Response.json({ url: stored.url, path: stored.path }, { headers: NO_STORE });
  } catch (err) {
    return errorResponse(err);
  }
}
