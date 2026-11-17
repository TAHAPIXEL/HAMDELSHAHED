import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { mediaFiles } from "@/db/schema";
import { ApiError } from "./api";

export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET?.trim() || "hamdel-media";
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // ۴ مگابایت

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const UPLOAD_FOLDERS = [
  "avatars",
  "messages",
  "announcements",
  "assignments",
  "submissions",
  "quizzes",
] as const;

export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

let cachedAdminClient: SupabaseClient | null | undefined;
let bucketEnsured = false;

/** کلاینت مدیریتی Supabase (فقط سمت سرور برای Storage) */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (cachedAdminClient !== undefined) return cachedAdminClient;
  const url =
    process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    cachedAdminClient = null;
    return null;
  }
  cachedAdminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAdminClient;
}

async function ensureBucket(supabase: SupabaseClient) {
  if (bucketEnsured) return;
  const { data } = await supabase.storage.getBucket(STORAGE_BUCKET);
  if (!data) {
    await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: Object.keys(ALLOWED_IMAGE_TYPES),
    });
  }
  bucketEnsured = true;
}

/** اعتبارسنجی آدرس تصویر ذخیره‌شده تا فقط URLهای مجاز خود سامانه پذیرفته شوند */
export function sanitizeImageUrl(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new ApiError("آدرس تصویر نامعتبر است", 400);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 1024) throw new ApiError("آدرس تصویر بیش از حد طولانی است", 400);
  if (trimmed.startsWith("/api/media/")) return trimmed;

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabaseUrl && trimmed.startsWith(`${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/`)) {
    return trimmed;
  }
  if (/^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(trimmed)) {
    return trimmed;
  }
  throw new ApiError("آدرس تصویر مورد تأیید نیست", 400);
}

/** آپلود دائمی تصویر در Supabase Storage (و ثبت متادیتا در دیتابیس) */
export async function saveUploadedImage(opts: {
  uploaderId: number;
  folder: UploadFolder;
  mimeType: string;
  buffer: Buffer;
}): Promise<{ id: string; url: string; sizeBytes: number }> {
  const mime = opts.mimeType.toLowerCase();
  const ext = ALLOWED_IMAGE_TYPES[mime];
  if (!ext) {
    throw new ApiError("فقط فایل‌های تصویری (JPG، PNG، WebP یا GIF) مجاز هستند", 400);
  }
  if (opts.buffer.byteLength === 0) {
    throw new ApiError("فایل انتخاب‌شده خالی است", 400);
  }
  if (opts.buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new ApiError("حجم تصویر باید کمتر از ۴ مگابایت باشد", 400);
  }

  const id = randomUUID();
  const ym = new Date().toISOString().slice(0, 7);
  const storagePath = `${opts.folder}/${ym}/${id}.${ext}`;
  const db = await getDb();
  const supabase = getSupabaseAdmin();

  if (supabase) {
    await ensureBucket(supabase);
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, opts.buffer, {
        contentType: mime,
        cacheControl: "31536000",
        upsert: false,
      });

    if (error) {
      console.error("[storage upload]", error);
      throw new ApiError("خطا در ذخیره‌سازی تصویر در فضای ابری", 500);
    }

    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    const publicUrl = pub.publicUrl;

    await db.insert(mediaFiles).values({
      id,
      uploaderId: opts.uploaderId,
      folder: opts.folder,
      storagePath,
      publicUrl,
      mimeType: mime,
      sizeBytes: opts.buffer.byteLength,
      fallbackData: null,
    });

    return { id, url: publicUrl, sizeBytes: opts.buffer.byteLength };
  }

  // حالت محلی (بدون Supabase Storage): ذخیره در جدول media_files و سرو از /api/media/[id]
  if (process.env.VERCEL) {
    throw new ApiError("تنظیمات Supabase Storage در سرور کامل نیست", 500);
  }
  const publicUrl = `/api/media/${id}`;
  await db.insert(mediaFiles).values({
    id,
    uploaderId: opts.uploaderId,
    folder: opts.folder,
    storagePath: `local:${storagePath}`,
    publicUrl,
    mimeType: mime,
    sizeBytes: opts.buffer.byteLength,
    fallbackData: opts.buffer.toString("base64"),
  });

  return { id, url: publicUrl, sizeBytes: opts.buffer.byteLength };
}

/** حذف تمیز فایل‌ها از Supabase Storage و جدول media_files هنگام حذف پیام/پروفایل/رکورد */
export async function deleteStoredImages(urls: (string | null | undefined)[]): Promise<void> {
  const valid = [...new Set(urls.filter((u): u is string => Boolean(u && u.trim())))];
  if (valid.length === 0) return;

  try {
    const db = await getDb();
    const rows = await db
      .select({ id: mediaFiles.id, storagePath: mediaFiles.storagePath })
      .from(mediaFiles)
      .where(inArray(mediaFiles.publicUrl, valid));

    const remotePaths = rows
      .map((r) => r.storagePath)
      .filter((p) => p && !p.startsWith("local:"));

    // اگر فایلی در Supabase Storage بود ولی رکوردش در media_files نبود، مسیر را از URL استخراج کن
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    for (const u of valid) {
      const idx = u.indexOf(marker);
      if (idx !== -1) {
        const extracted = decodeURIComponent(u.slice(idx + marker.length));
        if (extracted && !remotePaths.includes(extracted)) remotePaths.push(extracted);
      }
    }

    const supabase = getSupabaseAdmin();
    if (supabase && remotePaths.length > 0) {
      await supabase.storage.from(STORAGE_BUCKET).remove(remotePaths);
    }

    if (rows.length > 0) {
      await db.delete(mediaFiles).where(
        inArray(
          mediaFiles.id,
          rows.map((r) => r.id),
        ),
      );
    } else {
      for (const u of valid) {
        await db.delete(mediaFiles).where(eq(mediaFiles.publicUrl, u));
      }
    }
  } catch (err) {
    console.error("[storage cleanup]", err);
  }
}
