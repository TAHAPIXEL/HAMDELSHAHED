// ----------------------------------------------------------------------------
//  کلیدهای داده‌ی سامانه‌ی همدل — مشترک بین سرور و مرورگر
//  هر کلید یک «مجموعه» در جدول hamdel_records است.
//  kind = "array"  : مقدار یک آرایه از رکوردها با فیلد id است
//  kind = "record" : مقدار یک شیء کلید/مقدار (مثلاً زمان آخرین مشاهده)
// ----------------------------------------------------------------------------

export const COLLECTION_KINDS = {
  users: "array",
  chats: "array",
  messages: "array",
  exams: "array",
  subs: "array",
  attendance: "array",
  notices: "array",
  noticeReads: "record",
  perms: "array",
  seen: "record",
  homeworks: "array",
  hwsubs: "array",
} as const;

export type CollectionKey = keyof typeof COLLECTION_KINDS;
export const COLLECTION_KEYS = Object.keys(COLLECTION_KINDS) as CollectionKey[];

export const isCollectionKey = (v: unknown): v is CollectionKey =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(COLLECTION_KINDS, v);

/** نقش‌هایی که به پنل مدیریت و تغییر کاربران دسترسی کامل دارند */
export const MANAGER_ROLES = ["developer", "principal", "edu_deputy", "cultural_deputy"] as const;

/** نقش‌هایی که اطلاعات حساس دانش‌آموزان (کد ملی، رمز، آدرس، …) را می‌بینند */
export const SENSITIVE_VIEWER_ROLES = [...MANAGER_ROLES, "teacher"] as const;

/** فیلدهای خصوصی هر کاربر که برای بیننده‌ی غیرمجاز از سرور ارسال نمی‌شوند */
export const PRIVATE_USER_FIELDS = ["password", "nationalId", "address", "birthDate", "phone", "fatherName"] as const;

export const STAFF_ROLE_VALUES = [
  "teacher",
  "edu_deputy",
  "cultural_deputy",
  "tech_deputy",
  "counselor",
  "principal",
] as const;

export const REGISTRABLE_ROLES = ["student", ...STAFF_ROLE_VALUES] as const;

export const DEV_USER_ID = "dev-root";

export const isManagerRole = (role?: string | null) =>
  (MANAGER_ROLES as readonly string[]).includes(role ?? "");

export const isSensitiveViewerRole = (role?: string | null) =>
  (SENSITIVE_VIEWER_ROLES as readonly string[]).includes(role ?? "");
