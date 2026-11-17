import type { NextRequest } from "next/server";
import { ApiError, audit, requireUser, route } from "@/lib/api";
import { UPLOAD_FOLDERS, type UploadFolder, saveUploadedImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser();
  const formData = await req.formData().catch(() => null);
  if (!formData) throw new ApiError("فرم آپلود نامعتبر است", 400);

  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    throw new ApiError("فایل تصویری انتخاب نشده است", 400);
  }

  const rawFolder = String(formData.get("folder") ?? "messages").trim();
  const folder: UploadFolder = UPLOAD_FOLDERS.includes(rawFolder as UploadFolder)
    ? (rawFolder as UploadFolder)
    : "messages";

  // دانش‌آموز فقط در بخش‌های پروفایل، گفت‌وگو و پاسخ تکلیف مجاز به آپلود است
  if (
    user.role === "student" &&
    !["avatars", "messages", "submissions"].includes(folder)
  ) {
    throw new ApiError("شما اجازه‌ی آپلود در این بخش را ندارید", 403);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const saved = await saveUploadedImage({
    uploaderId: user.id,
    folder,
    mimeType: file.type || "image/jpeg",
    buffer,
  });

  await audit(user.id, "upload", "media", null, {
    id: saved.id,
    folder,
    sizeBytes: saved.sizeBytes,
  });

  return { ok: true, id: saved.id, url: saved.url };
});
