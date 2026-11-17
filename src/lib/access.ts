import { and, eq, inArray, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  announcements,
  classSubjects,
  classes,
  enrollments,
  quizAttempts,
} from "@/db/schema";
import { ApiError, type SessionUser } from "./api";
import { qc } from "@/lib/sql";

/** شناسه‌ی کلاس‌هایی که کاربر به آن‌ها دسترسی دارد */
export async function accessibleClassIds(user: SessionUser): Promise<number[]> {
  const db = await getDb();
  if (user.role === "admin") {
    const rows = await db.select({ id: classes.id }).from(classes);
    return rows.map((r) => r.id);
  }
  if (user.role === "student") {
    const rows = await db
      .select({ id: enrollments.classId })
      .from(enrollments)
      .where(eq(enrollments.studentId, user.id));
    return rows.map((r) => r.id);
  }
  const rows = await db
    .select({ id: classSubjects.classId })
    .from(classSubjects)
    .where(eq(classSubjects.teacherId, user.id));
  const homeroom = await db
    .select({ id: classes.id })
    .from(classes)
    .where(eq(classes.homeroomTeacherId, user.id));
  return [...new Set([...rows.map((r) => r.id), ...homeroom.map((r) => r.id)])];
}

export async function assertClassAccess(user: SessionUser, classId: number) {
  const ids = await accessibleClassIds(user);
  if (!ids.includes(classId)) throw new ApiError("به این کلاس دسترسی ندارید", 403);
}

/** آیا کاربر دبیر (یا مدیر) این درس/کلاس است؟ */
export async function canManageClass(user: SessionUser, classId: number) {
  if (user.role === "admin") return true;
  if (user.role !== "teacher") return false;
  const db = await getDb();
  const rows = await db
    .select({ id: classSubjects.id })
    .from(classSubjects)
    .where(and(eq(classSubjects.classId, classId), eq(classSubjects.teacherId, user.id)))
    .limit(1);
  if (rows.length) return true;
  const homeroom = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.homeroomTeacherId, user.id)))
    .limit(1);
  return homeroom.length > 0;
}

export async function assertCanManageClass(user: SessionUser, classId: number) {
  if (!(await canManageClass(user, classId)))
    throw new ApiError("فقط دبیر همین کلاس می‌تواند این کار را انجام دهد", 403);
}

/** شرط SQL اطلاعیه‌های قابل مشاهده برای کاربر */
export async function announcementCondition(user: SessionUser) {
  if (user.role === "admin") return undefined;
  const classIds = await accessibleClassIds(user);
  const audience =
    user.role === "teacher"
      ? or(eq(announcements.audience, "all"), eq(announcements.audience, "teachers"))
      : or(eq(announcements.audience, "all"), eq(announcements.audience, "students"));

  const classPart =
    classIds.length > 0
      ? and(eq(announcements.audience, "class"), inArray(announcements.classId, classIds))
      : undefined;

  return and(
    or(audience, classPart),
    or(sql`${qc(announcements.expiresAt)} is null`, sql`${qc(announcements.expiresAt)} > now()`),
  );
}

/** خلاصه‌ی حضور و غیاب یک دانش‌آموز */
export async function attemptForQuiz(quizId: number, studentId: number) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, quizId), eq(quizAttempts.studentId, studentId)))
    .limit(1);
  return rows[0] ?? null;
}
