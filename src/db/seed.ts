import { eq, sql } from "drizzle-orm";
import { hashPassword } from "@/lib/auth";
import type { Database } from "./index";
import { systemSettings, users } from "./schema";

/**
 * راه‌اندازی اولیه‌ی سامانه (بدون هیچ داده‌ی نمونه‌ای)
 * -----------------------------------------------------------------
 * سامانه کاملاً صفر و تمیز بالا می‌آید و تنها موارد ضروریِ ورود و
 * امنیت را (در صورتی که قبلاً ثبت نشده باشند) یک‌بار ایجاد می‌کند:
 *   ۱. حساب مدیر اصلی مدرسه (در صورتی که هیچ مدیری وجود نداشته باشد)
 *   ۲. رمز پیش‌فرض حذف و عملیات حساس (قابل تغییر از پنل مدیریت)
 *   ۳. تنظیمات پایه‌ی نام مدرسه و سال تحصیلی
 */
export const DEFAULT_ADMIN_USERNAME =
  process.env.DEFAULT_ADMIN_USERNAME?.trim().toLowerCase() || "admin";
export const DEFAULT_ADMIN_PASSWORD =
  process.env.DEFAULT_ADMIN_PASSWORD?.trim() || "admin1234";
export const DEFAULT_DELETE_PASSWORD =
  process.env.DEFAULT_DELETE_PASSWORD?.trim() || "delete1234";

export async function seedDatabase(db: Database): Promise<void> {
  // ۱. اطمینان از وجود حداقل یک مدیر در سامانه
  const adminCheck = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.role, "admin"));

  if ((adminCheck[0]?.count ?? 0) === 0) {
    await db
      .insert(users)
      .values({
        username: DEFAULT_ADMIN_USERNAME,
        passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
        fullName: "مدیر مدرسه",
        role: "admin",
        avatarColor: "#6366f1",
        bio: "مدیریت دبیرستان شاهد شهیدان فهیمی",
      })
      .onConflictDoNothing();
  }

  // ۲. رمز پیش‌فرض حذف و تنظیمات پایه (فقط اگر از قبل وجود نداشته باشند)
  const existingKeys = await db
    .select({ key: systemSettings.key })
    .from(systemSettings);
  const existingSet = new Set(existingKeys.map((r) => r.key));

  const defaults: { key: string; value: string }[] = [];
  if (!existingSet.has("delete_password_hash")) {
    defaults.push({
      key: "delete_password_hash",
      value: hashPassword(DEFAULT_DELETE_PASSWORD),
    });
  }
  if (!existingSet.has("school_name")) {
    defaults.push({
      key: "school_name",
      value: "دبیرستان شاهد شهیدان فهیمی",
    });
  }
  if (!existingSet.has("academic_year")) {
    defaults.push({
      key: "academic_year",
      value: "1405-1406",
    });
  }
  if (!existingSet.has("allow_student_dm")) {
    defaults.push({
      key: "allow_student_dm",
      value: "false",
    });
  }

  if (defaults.length > 0) {
    await db.insert(systemSettings).values(defaults).onConflictDoNothing();
  }
}
