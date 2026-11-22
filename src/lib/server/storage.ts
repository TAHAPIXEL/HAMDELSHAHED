// ----------------------------------------------------------------------------
//  ذخیره‌ی تصاویر در Supabase Storage (سطل عمومی با کلید سرویس)
// ----------------------------------------------------------------------------

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { query } from "@/db";
import { HttpError } from "./http";

export const BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "hamdel-media";
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
/** فایل‌های پیام (صوت و سند): MIME مجاز => پسوند ذخیره‌سازی */
export const CHAT_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/aac": "aac",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "text/plain": "txt",
  "application/zip": "zip",
  "application/vnd.rar": "rar",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
/** حداکثر حجم فایل پیام و ویس (بایت). آپلود مستقیم به فضای ابری است و از سقف بدنه‌ی Vercel نمی‌گذرد. */
export const CHAT_MAX_BYTES = 25 * 1024 * 1024;
export const VOICE_MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_MIME = Object.keys(CHAT_MIME);

let client: SupabaseClient | null = null;

function storageClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new HttpError(503, "ذخیره‌سازی تصاویر هنوز پیکربندی نشده است.");
  }
  client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

let bucketReady: Promise<void> | null = null;

function ensureBucket(): Promise<void> {
  bucketReady ??= (async () => {
    const s = storageClient();
    const existing = await s.storage.getBucket(BUCKET);
    if (!existing.error) {
      // تنظیمات سطل را برای فایل‌های پیام به‌روز می‌کند (MIME و حجم)
      const upd = await s.storage.updateBucket(BUCKET, {
        public: true,
        fileSizeLimit: CHAT_MAX_BYTES,
        allowedMimeTypes: ALLOWED_MIME,
      });
      if (upd.error) console.error("[storage bucket update]", upd.error.message);
      return;
    }
    const created = await s.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: CHAT_MAX_BYTES,
      allowedMimeTypes: ALLOWED_MIME,
    });
    if (created.error && !/already exists|duplicate/i.test(created.error.message)) {
      throw created.error;
    }
  })().catch((err: unknown) => {
    bucketReady = null;
    throw err;
  });
  return bucketReady;
}

/** پیشوند آدرس عمومی فایل‌های این سطل؛ هر تصویر معتبر باید با این پیشوند شروع شود */
export function storedImagePrefix(): string | null {
  const base = process.env.SUPABASE_URL?.trim().replace(/\/+$/, "");
  return base ? `${base}/storage/v1/object/public/${BUCKET}/` : null;
}

/** آیا آدرس، فایلی است که از همین سامانه در فضای ابری ذخیره شده است؟ */
export function isStoredImageUrl(url: unknown): url is string {
  const prefix = storedImagePrefix();
  return typeof url === "string" && !!prefix && url.length <= 1000 && url.startsWith(prefix)
    && url.length > prefix.length;
}

/**
 * عکس پروفایل به‌صورت داده‌ی درون‌خطی (data URL کوچک، ۱۲۸ پیکسلی) ذخیره می‌شود،
 * مثل تصاویر پیام‌ها. این مسیر مستقل از آدرس عمومی فضای ابری است که برای بعضی فایل‌ها خطا می‌داد.
 */
export const AVATAR_MAX_CHARS = 40_000;

/** آیا مقدار، عکس پروفایل درون‌خطی معتبر است؟ (نوع فایل از روی بایت‌ها بررسی می‌شود) */
export function isInlineAvatar(url: unknown): url is string {
  if (typeof url !== "string" || url.length > AVATAR_MAX_CHARS) return false;
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(url);
  if (!m) return false;
  const bytes = new Uint8Array(Buffer.from(m[2], "base64"));
  return sniffImage(bytes) !== null;
}

/** تشخیص نوع تصویر از روی امضای فایل (نه از روی نام یا MIME ارسالی) */
export function sniffImage(b: Uint8Array): string | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp";
  }
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  return null;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * وضعیت سطل تصاویر برای پایش (بدون هیچ رمز یا آدرس محرمانه).
 * فقط می‌گوید سطل در دسترس است و عمومی است یا نه؛ فایلی نمی‌نویسد.
 */
export async function storageStatus(): Promise<{ ok: boolean; bucket: string; public?: boolean; error?: string }> {
  try {
    const s = storageClient();
    const { data, error } = await s.storage.getBucket(BUCKET);
    if (error || !data) {
      return { ok: false, bucket: BUCKET, error: error?.message ?? "bucket not found" };
    }
    return { ok: true, bucket: BUCKET, public: data.public };
  } catch (err) {
    return { ok: false, bucket: BUCKET, error: err instanceof Error ? err.message : "unknown" };
  }
}

export async function storeImage(bytes: Uint8Array, mime: string): Promise<{ path: string; url: string }> {
  try {
    await ensureBucket();
  } catch (err) {
    console.error("[storage bucket]", err instanceof Error ? err.message : err);
    throw new HttpError(503, "فضای ذخیره‌ی تصاویر در دسترس نیست؛ کمی بعد دوباره تلاش کنید.");
  }
  const s = storageClient();
  const now = new Date();
  const path = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${EXT[mime]}`;
  const { error } = await s.storage.from(BUCKET).upload(path, bytes, {
    contentType: mime,
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) {
    console.error("[storage upload]", error.message);
    throw new HttpError(502, "ذخیره‌ی تصویر در فضای ابری ناموفق بود؛ دوباره تلاش کنید.");
  }
  const url = s.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  await query(
    `insert into hamdel_media (path, public_url) values ($1, $2) on conflict (path) do nothing`,
    [path, url],
  );
  return { path, url };
}

/** حذف همه‌ی تصاویر ذخیره‌شده (برای پاک‌سازی کامل سامانه) */
export async function purgeAllMedia(): Promise<number> {
  const { rows } = await query<{ path: string }>(`select path from hamdel_media`);
  if (rows.length === 0) return 0;
  const s = storageClient();
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100).map((r) => r.path);
    const { error } = await s.storage.from(BUCKET).remove(chunk);
    if (error) {
      console.error("[storage purge]", error.message);
      throw new HttpError(502, "حذف فایل‌های تصویری ناموفق بود؛ دوباره تلاش کنید.");
    }
  }
  await query(`delete from hamdel_media`);
  return rows.length;
}

/** آیا آدرس، فایل پیامی است که از همین سامانه در پوشه‌ی chat/ ذخیره شده است؟ */
export function isStoredChatUrl(url: unknown): url is string {
  const base = storedImagePrefix();
  return typeof url === "string" && !!base && url.length <= 1000 && url.startsWith(`${base}chat/`) && url.length > base.length + 5;
}

/**
 * آدرس آپلود مستقیم (امضاشده) برای فایل پیام. مرورگر مستقیم به فضای ابری PUT می‌کند،
 * پس حجم فایل از سقف بدنه‌ی Vercel عبور نمی‌کند.
 */
export async function createChatUpload(mime: string): Promise<{ uploadUrl: string; url: string }> {
  const ext = CHAT_MIME[mime];
  if (!ext) throw new HttpError(415, "این نوع فایل پذیرفته نمی‌شود.");
  await ensureBucket();
  const base = storedImagePrefix();
  if (!base) throw new HttpError(503, "ذخیره‌سازی فایل هنوز پیکربندی نشده است.");
  const path = `chat/${randomUUID()}.${ext}`;
  const { data, error } = await storageClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[storage sign]", error?.message);
    throw new HttpError(503, "آپلود فایل در این لحظه ممکن نیست؛ کمی بعد دوباره تلاش کنید.");
  }
  return { uploadUrl: data.signedUrl, url: `${base}${path}` };
}
