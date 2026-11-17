import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { systemSettings } from "@/db/schema";
import { DEFAULT_DELETE_PASSWORD } from "@/db/seed";
import { hashPassword, verifyPassword } from "./auth";
import { ApiError } from "./api";

export type SettingKey =
  | "delete_password_hash"
  | "school_name"
  | "academic_year"
  | "allow_student_dm";

export async function getSetting(key: SettingKey): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, key))
    .limit(1);
  return row?.value ?? null;
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(systemSettings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value, updatedAt: new Date() },
    });
}

/** بررسی صحت رمز حذف سامانه */
export async function verifyDeletePassword(candidate: unknown): Promise<boolean> {
  if (typeof candidate !== "string" || !candidate.trim()) return false;
  const stored = await getSetting("delete_password_hash");
  if (!stored) {
    // اگر به هر دلیل هنوز ذخیره نشده بود، با مقدار پیش‌فرض ثبت و مقایسه کن
    const fresh = hashPassword(DEFAULT_DELETE_PASSWORD);
    await setSetting("delete_password_hash", fresh);
    return verifyPassword(candidate, fresh);
  }
  return verifyPassword(candidate, stored);
}

/** الزام واردکردن رمز صحیح حذف پیش از عملیات‌های حذف حساس */
export async function assertDeletePassword(candidate: unknown): Promise<void> {
  const ok = await verifyDeletePassword(candidate);
  if (!ok) {
    throw new ApiError("رمز حذف نادرست است", 403);
  }
}

export async function updateDeletePassword(nextPassword: string): Promise<void> {
  if (nextPassword.length < 6) {
    throw new ApiError("رمز حذف جدید باید حداقل ۶ کاراکتر باشد", 400);
  }
  await setSetting("delete_password_hash", hashPassword(nextPassword));
}
