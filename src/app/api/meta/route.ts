import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { classSubjects, classes, enrollments, subjects, users } from "@/db/schema";
import { requireUser, route } from "@/lib/api";
import { accessibleClassIds } from "@/lib/access";
import { getSetting } from "@/lib/settings";
import { qc } from "@/lib/sql";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  const db = await getDb();
  const classIds = await accessibleClassIds(user);

  const classRows = await db
    .select({
      id: classes.id,
      name: classes.name,
      grade: classes.grade,
      field: classes.field,
      room: classes.room,
      academicYear: classes.academicYear,
      homeroomTeacherId: classes.homeroomTeacherId,
      studentCount: sql<number>`(select count(*) from ${enrollments} e where e.class_id = ${qc(classes.id)})::int`,
      homeroomName: sql<string | null>`(select full_name from ${users} u where u.id = ${qc(classes.homeroomTeacherId)})`,
    })
    .from(classes)
    .orderBy(asc(classes.grade), asc(classes.name));

  const myClasses = classRows.filter((c) => classIds.includes(c.id));

  const subjectRows = await db.select().from(subjects).orderBy(asc(subjects.name));

  const assignmentsForPicker =
    user.role === "admin"
      ? await db
          .select({
            id: classSubjects.id,
            classId: classSubjects.classId,
            subjectId: classSubjects.subjectId,
            teacherId: classSubjects.teacherId,
          })
          .from(classSubjects)
      : await db
          .select({
            id: classSubjects.id,
            classId: classSubjects.classId,
            subjectId: classSubjects.subjectId,
            teacherId: classSubjects.teacherId,
          })
          .from(classSubjects)
          .where(eq(classSubjects.teacherId, user.id));

  const teachers = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      role: users.role,
      avatarColor: users.avatarColor,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(sql`${qc(users.role)} in ('teacher', 'admin') and ${qc(users.isActive)} = true`)
    .orderBy(asc(users.fullName));

  const students = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      avatarColor: users.avatarColor,
      avatarUrl: users.avatarUrl,
      username: users.username,
      role: users.role,
      className: sql<string | null>`(
        select c.name from ${enrollments} e
        join ${classes} c on c.id = e.class_id
        where e.student_id = ${qc(users.id)} limit 1
      )`,
    })
    .from(users)
    .where(sql`${qc(users.role)} = 'student' and ${qc(users.isActive)} = true`)
    .orderBy(asc(users.fullName))
    .limit(500);

  const [schoolName, academicYear, allowStudentDm] = await Promise.all([
    getSetting("school_name"),
    getSetting("academic_year"),
    getSetting("allow_student_dm"),
  ]);

  return {
    role: user.role,
    schoolName: schoolName ?? "دبیرستان شاهد شهیدان فهیمی",
    academicYear: academicYear ?? "1405-1406",
    allowStudentDm: allowStudentDm === "true",
    classes: myClasses,
    allClasses: user.role === "admin" ? classRows : undefined,
    subjects: subjectRows,
    teaching: assignmentsForPicker,
    teachers,
    students,
  };
});
