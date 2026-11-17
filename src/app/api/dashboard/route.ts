import { and, count, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  announcements,
  assignments,
  attendance,
  classSubjects,
  classes,
  enrollments,
  messages,
  quizAttempts,
  quizzes,
  subjects,
  submissions,
  users,
} from "@/db/schema";
import { requireUser, route } from "@/lib/api";
import { accessibleClassIds, announcementCondition } from "@/lib/access";
import { qc } from "@/lib/sql";

export const dynamic = "force-dynamic";

const num = (v: unknown) => Number(v ?? 0);
const round1 = (v: number) => Math.round(v * 10) / 10;

export const GET = route(async () => {
  const user = await requireUser();
  const db = await getDb();
  const now = new Date();
  const classIds = await accessibleClassIds(user);
  const condition = await announcementCondition(user);

  const announcementQuery = db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      imageUrl: announcements.imageUrl,
      audience: announcements.audience,
      isPinned: announcements.isPinned,
      createdAt: announcements.createdAt,
      authorName: users.fullName,
      authorColor: users.avatarColor,
      authorAvatar: users.avatarUrl,
      classId: announcements.classId,
      className: classes.name,
    })
    .from(announcements)
    .innerJoin(users, eq(users.id, announcements.authorId))
    .leftJoin(classes, eq(classes.id, announcements.classId))
    .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
    .limit(5);

  const recentAnnouncements = condition
    ? await announcementQuery.where(condition)
    : await announcementQuery;

  const classList =
    classIds.length > 0
      ? await db
          .select({ id: classes.id, name: classes.name, grade: classes.grade, field: classes.field })
          .from(classes)
          .where(inArray(classes.id, classIds))
          .orderBy(classes.grade, classes.name)
      : [];

  /* ------------------------------- دانش‌آموز ------------------------------- */

  if (user.role === "student") {
    const myClassIds = classIds;

    const upcomingAssignments =
      myClassIds.length === 0
        ? []
        : await db
            .select({
              id: assignments.id,
              title: assignments.title,
              dueAt: assignments.dueAt,
              className: classes.name,
              subjectName: subjects.name,
              subjectColor: subjects.color,
              submissionId: submissions.id,
              submissionStatus: submissions.status,
              score: submissions.score,
            })
            .from(assignments)
            .innerJoin(classes, eq(classes.id, assignments.classId))
            .innerJoin(subjects, eq(subjects.id, assignments.subjectId))
            .leftJoin(
              submissions,
              and(
                eq(submissions.assignmentId, assignments.id),
                eq(submissions.studentId, user.id),
              ),
            )
            .where(inArray(assignments.classId, myClassIds))
            .orderBy(desc(assignments.dueAt))
            .limit(6);

    const upcomingQuizzes =
      myClassIds.length === 0
        ? []
        : await db
            .select({
              id: quizzes.id,
              title: quizzes.title,
              startsAt: quizzes.startsAt,
              endsAt: quizzes.endsAt,
              durationMinutes: quizzes.durationMinutes,
              subjectName: subjects.name,
              subjectColor: subjects.color,
              className: classes.name,
              attemptId: quizAttempts.id,
              attemptStatus: quizAttempts.status,
              score: quizAttempts.score,
            })
            .from(quizzes)
            .innerJoin(subjects, eq(subjects.id, quizzes.subjectId))
            .innerJoin(classes, eq(classes.id, quizzes.classId))
            .leftJoin(
              quizAttempts,
              and(eq(quizAttempts.quizId, quizzes.id), eq(quizAttempts.studentId, user.id)),
            )
            .where(
              and(
                inArray(quizzes.classId, myClassIds),
                eq(quizzes.isPublished, true),
                gte(quizzes.endsAt, now),
              ),
            )
            .orderBy(quizzes.startsAt)
            .limit(5);

    const [gradeStats] = await db
      .select({
        avgScore: sql<string>`coalesce(avg(case when ${qc(submissions.score)} is not null then ${qc(submissions.score)} / nullif(${qc(assignments.maxScore)}, 0) * 20 end), 0)`,
        graded: count(submissions.id),
      })
      .from(submissions)
      .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
      .where(and(eq(submissions.studentId, user.id), eq(submissions.status, "graded")));

    const [quizStats] = await db
      .select({
        avgPercent: sql<string>`coalesce(avg(case when ${qc(quizAttempts.maxScore)} > 0 then ${qc(quizAttempts.score)} / ${qc(quizAttempts.maxScore)} * 100 end), 0)`,
        taken: count(quizAttempts.id),
      })
      .from(quizAttempts)
      .where(
        and(eq(quizAttempts.studentId, user.id), eq(quizAttempts.status, "submitted")),
      );

    const [attendanceStats] = await db
      .select({
        total: count(attendance.id),
        present: sql<number>`count(*) filter (where ${qc(attendance.status)} = 'present')::int`,
        absent: sql<number>`count(*) filter (where ${qc(attendance.status)} = 'absent')::int`,
        late: sql<number>`count(*) filter (where ${qc(attendance.status)} = 'late')::int`,
      })
      .from(attendance)
      .where(and(eq(attendance.studentId, user.id), gte(attendance.sessionDate, daysAgo(30))));

    const totalSessions = num(attendanceStats?.total);
    const presentSessions = num(attendanceStats?.present) + num(attendanceStats?.late);

    const pendingAssignments = upcomingAssignments.filter(
      (a) => !a.submissionId && a.dueAt.getTime() > now.getTime(),
    ).length;

    return {
      role: user.role,
      classes: classList,
      stats: {
        average: round1(num(gradeStats?.avgScore)),
        gradedCount: num(gradeStats?.graded),
        quizPercent: round1(num(quizStats?.avgPercent)),
        quizzesTaken: num(quizStats?.taken),
        attendanceRate: totalSessions ? round1((presentSessions / totalSessions) * 100) : 100,
        absentCount: num(attendanceStats?.absent),
        lateCount: num(attendanceStats?.late),
        pendingAssignments,
      },
      assignments: upcomingAssignments.map((a) => ({
        ...a,
        dueAt: a.dueAt.toISOString(),
      })),
      quizzes: upcomingQuizzes.map((q) => ({
        ...q,
        startsAt: q.startsAt.toISOString(),
        endsAt: q.endsAt.toISOString(),
      })),
      announcements: recentAnnouncements.map(serializeAnnouncement),
    };
  }

  /* ------------------------------- دبیر/مدیر ------------------------------ */

  if (user.role === "teacher") {
    const myClassIds = classIds;

    const [studentsCount] = await db
      .select({ n: count(enrollments.studentId) })
      .from(enrollments)
      .where(myClassIds.length ? inArray(enrollments.classId, myClassIds) : sql`false`);

    const [pendingGrading] = await db
      .select({ n: count(submissions.id) })
      .from(submissions)
      .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
      .where(and(eq(assignments.teacherId, user.id), eq(submissions.status, "submitted")));

    const [assignmentCount] = await db
      .select({ n: count(assignments.id) })
      .from(assignments)
      .where(eq(assignments.teacherId, user.id));

    const [quizCount] = await db
      .select({ n: count(quizzes.id) })
      .from(quizzes)
      .where(eq(quizzes.teacherId, user.id));

    const [todayAttendance] = await db
      .select({
        marked: count(attendance.id),
        absent: sql<number>`count(*) filter (where ${qc(attendance.status)} = 'absent')::int`,
      })
      .from(attendance)
      .where(
        and(
          eq(attendance.sessionDate, today()),
          myClassIds.length ? inArray(attendance.classId, myClassIds) : sql`false`,
        ),
      );

    const toGrade = await db
      .select({
        id: submissions.id,
        studentName: users.fullName,
        studentAvatar: users.avatarUrl,
        studentColor: users.avatarColor,
        assignmentTitle: assignments.title,
        assignmentId: assignments.id,
        submittedAt: submissions.submittedAt,
        status: submissions.status,
      })
      .from(submissions)
      .innerJoin(assignments, eq(assignments.id, submissions.assignmentId))
      .innerJoin(users, eq(users.id, submissions.studentId))
      .where(and(eq(assignments.teacherId, user.id), eq(submissions.status, "submitted")))
      .orderBy(desc(submissions.submittedAt))
      .limit(6);

    const myQuizzes = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        startsAt: quizzes.startsAt,
        endsAt: quizzes.endsAt,
        className: classes.name,
        subjectName: subjects.name,
        attempts: sql<number>`(select count(*) from ${quizAttempts} where ${qc(quizAttempts.quizId)} = ${qc(quizzes.id)})::int`,
      })
      .from(quizzes)
      .innerJoin(classes, eq(classes.id, quizzes.classId))
      .innerJoin(subjects, eq(subjects.id, quizzes.subjectId))
      .where(eq(quizzes.teacherId, user.id))
      .orderBy(desc(quizzes.startsAt))
      .limit(5);

    return {
      role: user.role,
      classes: classList,
      stats: {
        classes: myClassIds.length,
        students: num(studentsCount?.n),
        pendingGrading: num(pendingGrading?.n),
        assignments: num(assignmentCount?.n),
        quizzes: num(quizCount?.n),
        markedToday: num(todayAttendance?.marked),
        absentToday: num(todayAttendance?.absent),
      },
      toGrade: toGrade.map((s) => ({ ...s, submittedAt: s.submittedAt.toISOString() })),
      quizzes: myQuizzes.map((q) => ({
        ...q,
        startsAt: q.startsAt.toISOString(),
        endsAt: q.endsAt.toISOString(),
      })),
      announcements: recentAnnouncements.map(serializeAnnouncement),
    };
  }

  // admin
  const [userStats] = await db
    .select({
      total: count(users.id),
      students: sql<number>`count(*) filter (where ${qc(users.role)} = 'student')::int`,
      teachers: sql<number>`count(*) filter (where ${qc(users.role)} = 'teacher')::int`,
      admins: sql<number>`count(*) filter (where ${qc(users.role)} = 'admin')::int`,
      active: sql<number>`count(*) filter (where ${qc(users.isActive)})::int`,
    })
    .from(users);

  const content = (await db.execute<{
    classes: number;
    subjects: number;
    assignments: number;
    quizzes: number;
    messages: number;
    submissions: number;
  }>(sql`select
      (select count(*) from ${classes})::int as classes,
      (select count(*) from ${subjects})::int as subjects,
      (select count(*) from ${assignments})::int as assignments,
      (select count(*) from ${quizzes})::int as quizzes,
      (select count(*) from ${messages})::int as messages,
      (select count(*) from ${submissions})::int as submissions`)).rows[0];

  const [rate] = await db
    .select({
      total: count(attendance.id),
      present: sql<number>`count(*) filter (where ${qc(attendance.status)} in ('present','late'))::int`,
      absent: sql<number>`count(*) filter (where ${qc(attendance.status)} = 'absent')::int`,
    })
    .from(attendance)
    .where(gte(attendance.sessionDate, daysAgo(14)));

  const [messagesToday] = await db
    .select({ n: count(messages.id) })
    .from(messages)
    .where(gte(messages.createdAt, startOfToday()));

  const classOverview = await db
    .select({
      id: classes.id,
      name: classes.name,
      grade: classes.grade,
      field: classes.field,
      room: classes.room,
      students: sql<number>`(select count(*) from ${enrollments} where ${qc(enrollments.classId)} = ${qc(classes.id)})::int`,
      teacherCount: sql<number>`(select count(distinct ${qc(classSubjects.teacherId)}) from ${classSubjects} where ${qc(classSubjects.classId)} = ${qc(classes.id)})::int`,
      homeroom: sql<string>`(select full_name from ${users} where ${qc(users.id)} = ${qc(classes.homeroomTeacherId)})`,
    })
    .from(classes)
    .orderBy(classes.grade, classes.name);

  return {
    role: user.role,
    classes: classList,
    stats: {
      users: num(userStats?.total),
      students: num(userStats?.students),
      teachers: num(userStats?.teachers),
      admins: num(userStats?.admins),
      activeUsers: num(userStats?.active),
      classes: num(content?.classes),
      subjects: num(content?.subjects),
      assignments: num(content?.assignments),
      quizzes: num(content?.quizzes),
      messages: num(content?.messages),
      submissions: num(content?.submissions),
      attendanceRate: num(rate?.total)
        ? round1((num(rate?.present) / num(rate?.total)) * 100)
        : 100,
      absentRecent: num(rate?.absent),
      messagesToday: num(messagesToday?.n),
    },
    classesOverview: classOverview,
    announcements: recentAnnouncements.map(serializeAnnouncement),
  };
});

function serializeAnnouncement(a: {
  createdAt: Date;
  [key: string]: unknown;
}) {
  return { ...a, createdAt: a.createdAt.toISOString() };
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export const revalidate = 0;
export const runtime = "nodejs";
