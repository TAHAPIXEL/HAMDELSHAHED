import { HttpError, NO_STORE, clientIp, errorResponse, rateLimit } from "@/lib/server/http";
import { requireViewer } from "@/lib/server/session";
import { MAX_UPLOAD_BYTES, sniffImage, storeImage } from "@/lib/server/storage";

export const dynamic = "force-dynamic";

/**
 * آپلود تصویر (پروفایل، پیام، اطلاعیه، تکلیف، پاسخ، آزمون) در Supabase Storage.
 *
 * عکس پروفایل در فرم ثبت‌نام قبل از ورود انتخاب می‌شود، پس با `purpose=registration`
 * بدون نشست پذیرفته می‌شود؛ این مسیر فقط تصویر، با سقف حجم و سقف تعداد درخواست per IP است.
 * بقیه‌ی آپلودها نیاز به نشست معتبر دارند.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData().catch(() => null);
    const purpose = form?.get("purpose");
    if (purpose === "registration") {
      rateLimit(`upload-reg:${clientIp(req)}`, 20, 60 * 60 * 1000);
    } else {
      await requireViewer(req);
      rateLimit(`upload:${clientIp(req)}`, 120, 10 * 60 * 1000);
    }
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
