import { desc, eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import {
  announcements,
  assignments,
  attendance,
  auditLogs,
  mediaFiles,
  messages,
  quizQuestions,
  quizzes,
  submissions,
  users,
} from "@/db/schema";
import { ApiError, audit, body, requireUser, route, str } from "@/lib/api";
import {
  assertDeletePassword,
  getSetting,
  setSetting,
  updateDeletePassword,
  verifyDeletePassword,
} from "@/lib/settings";
import { verifyPassword } from "@/lib/auth";
import { deleteStoredImages } from "@/lib/storage";
import { qc } from "@/lib/sql";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireUser(["admin"]);
  const db = await getDb();

  const [schoolName, academicYear, allowStudentDm, mediaStats, recentLogs] = await Promise.all([
    getSetting("school_name"),
    getSetting("academic_year"),
    getSetting("allow_student_dm"),
    db
      .select({
        count: sql<number>`count(*)::int`,
        bytes: sql<number>`coalesce(sum(${qc(mediaFiles.sizeBytes)}), 0)::bigint`,
      })
      .from(mediaFiles),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        createdAt: auditLogs.createdAt,
        actorName: users.fullName,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(30),
  ]);

  return {
    schoolName: schoolName ?? "دبیرستان شاهد شهیدان فهیمی",
    academicYear: academicYear ?? "1405-1406",
    allowStudentDm: allowStudentDm === "true",
    mediaCount: Number(mediaStats[0]?.count ?? 0),
    mediaBytes: Number(mediaStats[0]?.bytes ?? 0),
    logs: recentLogs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
  };
});

/** ویرایش تنظیمات سامانه و تغییر رمز حذف */
export const PATCH = route(async (req: NextRequest) => {
  const admin = await requireUser(["admin"]);
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "schoolName",
    "academicYear",
    "allowStudentDm",
    "currentDeletePassword",
    "newDeletePassword",
  ]);

  if (payload.schoolName !== undefined) {
    await setSetting("school_name", str(payload.schoolName, "نام مدرسه", { max: 120 }));
  }
  if (payload.academicYear !== undefined) {
    await setSetting("academic_year", str(payload.academicYear, "سال تحصیلی", { max: 16 }));
  }
  if (typeof payload.allowStudentDm === "boolean") {
    await setSetting("allow_student_dm", payload.allowStudentDm ? "true" : "false");
  }

  if (payload.newDeletePassword !== undefined && String(payload.newDeletePassword).length > 0) {
    const current = str(payload.currentDeletePassword, "رمز فعلی", { max: 200 });
    const matchesDelete = await verifyDeletePassword(current);
    let matchesAdmin = false;
    if (!matchesDelete) {
      const db = await getDb();
      const [row] = await db.select().from(users).where(eq(users.id, admin.id)).limit(1);
      matchesAdmin = Boolean(row && verifyPassword(current, row.passwordHash));
    }
    if (!matchesDelete && !matchesAdmin) {
      throw new ApiError("رمز حذف فعلی (یا رمز مدیر) نادرست است", 403);
    }
    const next = str(payload.newDeletePassword, "رمز حذف جدید", { max: 200 });
    await updateDeletePassword(next);
    await audit(admin.id, "change_delete_password", "system_settings");
  } else {
    await audit(admin.id, "update", "system_settings");
  }

  return { ok: true };
});

/** پاک‌سازی انتخابی یک بخش کامل از داده‌ها (محافظت‌شده با رمز حذف) */
export const POST = route(async (req: NextRequest) => {
  const admin = await requireUser(["admin"]);
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "action",
    "target",
    "deletePassword",
  ]);

  if (payload.action !== "purge") throw new ApiError("عملیات نامعتبر است", 400);
  await assertDeletePassword(payload.deletePassword);

  const target = String(payload.target ?? "");
  const db = await getDb();

  if (target === "messages") {
    const imgs = await db.select({ imageUrl: messages.imageUrl }).from(messages);
    await db.delete(messages);
    await deleteStoredImages(imgs.map((r) => r.imageUrl));
  } else if (target === "announcements") {
    const imgs = await db.select({ imageUrl: announcements.imageUrl }).from(announcements);
    await db.delete(announcements);
    await deleteStoredImages(imgs.map((r) => r.imageUrl));
  } else if (target === "assignments") {
    const [aImgs, sImgs] = await Promise.all([
      db.select({ imageUrl: assignments.imageUrl }).from(assignments),
      db.select({ imageUrl: submissions.imageUrl }).from(submissions),
    ]);
    await db.delete(assignments);
    await deleteStoredImages([...aImgs.map((r) => r.imageUrl), ...sImgs.map((r) => r.imageUrl)]);
  } else if (target === "quizzes") {
    const qImgs = await db.select({ imageUrl: quizQuestions.imageUrl }).from(quizQuestions);
    await db.delete(quizzes);
    await deleteStoredImages(qImgs.map((r) => r.imageUrl));
  } else if (target === "attendance") {
    await db.delete(attendance);
  } else {
    throw new ApiError("بخش انتخاب‌شده برای پاک‌سازی معتبر نیست", 400);
  }

  await audit(admin.id, "purge", target);
  return { ok: true };
});
