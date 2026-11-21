// ============================================================================
//  فایل محرمانه — کدهای ورود ویژه
//  این ماژول فقط در سرور استفاده می‌شود؛ هیچ کد خامی در مرورگر ارسال نمی‌شود.
// ============================================================================

// هش‌های پیش‌فرض همان‌هایی است که در نسخه‌ی اصلی بود. اگر متغیرهای محیطی
// HAMDEL_STAFF_KEY_HASH / HAMDEL_DEV_LOGIN_HASH / HAMDEL_WIPE_HASH تنظیم شوند، همان‌ها به‌کار می‌روند.
const STAFF_KEY_HASH = process.env.HAMDEL_STAFF_KEY_HASH?.trim() || "cb335f269ee1ad2666ed37d1ef5b47ac51be675275b2749a8807226e850068a9";
const DEV_LOGIN_HASH = process.env.HAMDEL_DEV_LOGIN_HASH?.trim() || "5d7e93b5b4e722847b43a975781ccf010b7eeac0017698171f8188aeaece2e1b";
const WIPE_HASH = process.env.HAMDEL_WIPE_HASH?.trim() || "408a5ee676694af19215cb22b2cd871e39c693f907933583ece00eda8d73ee16";

/** محاسبه SHA-256 یک رشته (فقط سمت سرور اجرا می‌شود) */
async function sha256(text: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** مقایسه با زمان ثابت تا از حدس‌زدن تدریجی جلوگیری شود */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** بررسی کد ثبت‌نام کادر مدرسه */
export async function verifyStaffKey(input: string): Promise<boolean> {
  return safeEqual(await sha256(input.trim()), STAFF_KEY_HASH);
}

/** بررسی ورود ویژه مدیر ارشد (شماره + رمز) */
export async function verifyDevLogin(phone: string, password: string): Promise<boolean> {
  return safeEqual(await sha256(`${phone.trim()}|${password.trim()}`), DEV_LOGIN_HASH);
}

/** بررسی رمز پاک‌سازی سامانه */
export async function verifyWipePassword(input: string): Promise<boolean> {
  return safeEqual(await sha256(input.trim()), WIPE_HASH);
}
