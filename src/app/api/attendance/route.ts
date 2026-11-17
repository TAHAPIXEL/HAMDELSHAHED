import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { attendance, classes, enrollments, users } from "@/db/schema";
import { ApiError, audit, body, num, requireUser, route } from "@/lib/api";
import { accessibleClassIds, assertCanManageClass } from "@/lib/access";
import { assertDeletePassword } from "@/lib/settings";
import { qc } from "@/lib/sql";

export const dynamic = "force-dynamic";

const STATUSES = ["present", "absent", "late", "excused"] as const;
type Status = (typeof STATUSES)[number];

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const GET = route(async (req: NextRequest) => {
  const user = await requireUser();
  const db = await getDb();
  const params = req.nextUrl.searchParams;
  const classIds = await accessibleClassIds(user);

  if (user.role === "student") {
    const rows = await db
      .select({
        id: attendance.id,
        sessionDate: attendance.sessionDate,
        period: attendance.period,
        status: attendance.status,
        note: attendance.note,
        className: classes.name,
      })
      .from(attendance)
      .innerJoin(classes, eq(classes.id, attendance.classId))
      .where(eq(attendance.studentId, user.id))
      .orderBy(desc(attendance.sessionDate), asc(attendance.period))
      .limit(120);

    const [summary] = await db
      .select({
        total: sql<number>`count(*)::int`,
        present: sql<number>`count(*) filter (where ${qc(attendance.status)} = 'present')::int`,
        absent: sql<number>`count(*) filter (where ${qc(attendance.status)} = 'absent')::int`,
        late: sql<number>`count(*) filter (where ${qc(attendance.status)} = 'late')::int`,
        excused: sql<number>`count(*) filter (where ${qc(attendance.status)} = 'excused')::int`,
      })
      .from(attendance)
      .where(eq(attendance.studentId, user.id));

    return { items: rows, summary: summary ?? null, canRecord: false };
  }

  const classIdParam = params.get("classId");
  const date = params.get("date") ?? todayStr();
  const period = Number(params.get("period") ?? 1);

  if (!classIdParam) {
    const overview = classIds.length
      ? await db
          .select({
            classId: classes.id,
            className: classes.name,
            date: attendance.sessionDate,
            present: sql<number>`count(*) filter (where ${qc(attendance.status)} in ('present','late'))::int`,
            absent: sql<number>`count(*) filter (where ${qc(attendance.status)} = 'absent')::int`,
            total: sql<number>`count(*)::int`,
          })
          .from(attendance)
          .innerJoin(classes, eq(classes.id, attendance.classId))
          .where(and(gte(attendance.sessionDate, daysAgo(14)), inArray(attendance.classId, classIds)))
          .groupBy(classes.id, classes.name, attendance.sessionDate)
          .orderBy(desc(attendance.sessionDate))
          .limit(80)
      : [];
    return { overview, date, period, canRecord: true };
  }

  const classId = num(classIdParam, "کلاس");
  await assertCanManageClass(user, classId);

  const roster = await db
    .select({
      studentId: users.id,
      fullName: users.fullName,
      avatarColor: users.avatarColor,
      avatarUrl: users.avatarUrl,
      username: users.username,
      status: attendance.status,
      note: attendance.note,
      attendanceId: attendance.id,
    })
    .from(enrollments)
    .innerJoin(users, eq(users.id, enrollments.studentId))
    .leftJoin(
      attendance,
      and(
        eq(attendance.studentId, enrollments.studentId),
        eq(attendance.sessionDate, date),
        eq(attendance.period, period),
      ),
    )
    .where(eq(enrollments.classId, classId))
    .orderBy(asc(users.fullName));

  const [classRow] = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(eq(classes.id, classId))
    .limit(1);

  return { class: classRow, date, period, roster, canRecord: true };
});

export const POST = route(async (req: NextRequest) => {
  const user = await requireUser(["admin", "teacher"]);
  const db = await getDb();
  const payload = body<Record<string, unknown>>(await req.json().catch(() => null), [
    "classId",
    "date",
    "period",
    "entries",
  ]);

  const classId = num(payload.classId, "کلاس");
  const date = String(payload.date ?? todayStr());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError("تاریخ نامعتبر است", 400);
  const period = num(payload.period ?? 1, "زنگ");
  if (period < 1 || period > 8) throw new ApiError("شماره زنگ باید بین ۱ تا ۸ باشد", 400);

  await assertCanManageClass(user, classId);

  const entries = Array.isArray(payload.entries)
    ? (payload.entries as { studentId?: unknown; status?: unknown; note?: unknown }[])
    : [];
  if (entries.length === 0) throw new ApiError("هیچ دانش‌آموزی ارسال نشده است", 400);

  const enrolled = await db
    .select({ studentId: enrollments.studentId })
    .from(enrollments)
    .where(eq(enrollments.classId, classId));
  const validIds = new Set(enrolled.map((e) => e.studentId));

  const values = entries.map((entry) => {
    const studentId = Number(entry.studentId);
    if (!validIds.has(studentId))
      throw new ApiError("دانش‌آموز خارج از این کلاس است", 400);
    const status = STATUSES.includes(String(entry.status) as Status)
      ? (String(entry.status) as Status)
      : "present";
    return {
      classId,
      studentId,
      sessionDate: date,
      period,
      status,
      note: entry.note == null || entry.note === "" ? null : String(entry.note).slice(0, 300),
      recordedBy: user.id,
    };
  });

  await db
    .insert(attendance)
    .values(values)
    .onConflictDoUpdate({
      target: [attendance.studentId, attendance.sessionDate, attendance.period],
      set: {
        status: sql`excluded.status`,
        note: sql`excluded.note`,
        recordedBy: sql`excluded.recorded_by`,
        classId: sql`excluded.class_id`,
      },
    });

  await audit(user.id, "record", "attendance", classId, { date, period, count: values.length });

  return { ok: true, saved: values.length, date, period };
});

export const DELETE = route(async (req: NextRequest) => {
  const user = await requireUser(["admin", "teacher"]);
  const payload = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const classId = num(payload.classId, "کلاس");
  const date = String(payload.date ?? "");
  const period = num(payload.period, "زنگ");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ApiError("تاریخ نامعتبر است", 400);

  await assertCanManageClass(user, classId);
  await assertDeletePassword(payload.deletePassword);

  const db = await getDb();
  await db
    .delete(attendance)
    .where(
      and(
        eq(attendance.classId, classId),
        eq(attendance.sessionDate, date),
        eq(attendance.period, period),
      ),
    );
  await audit(user.id, "delete", "attendance", classId, { date, period });
  return { ok: true };
});

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const revalidate = 0;
