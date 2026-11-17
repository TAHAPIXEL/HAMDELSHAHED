import { getTableName, sql, type AnyColumn } from "drizzle-orm";

/**
 * ارجاع کاملاً مشخص به یک ستون (مثلاً "classes"."id") داخل زیرپرس‌وجوهای SQL.
 * بدون این کار، Drizzle ستون را بدون نام جدول می‌نویسد و در زیرپرس‌وجوهایی که
 * جدول دیگری با همان نام ستون دارند (مثل id) اشتباه تفسیر می‌شود.
 */
export function qc(column: AnyColumn) {
  return sql.raw(`"${getTableName(column.table)}"."${column.name}"`);
}
