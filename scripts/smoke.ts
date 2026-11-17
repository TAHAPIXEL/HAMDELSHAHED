import { sql } from "drizzle-orm";
import { closeDb, getDb } from "@/db";
import { classes, users } from "@/db/schema";

async function main() {
  // از یک مسیر جدا استفاده می‌کنیم تا با سرور در حال اجرا تداخل نکند
  process.env.PGLITE_DATA_DIR ??= "./.data/smoke";
  const db = await getDb();
  const counts = await db.execute(sql`select
    (select count(*) from users)::int as users,
    (select count(*) from classes)::int as classes,
    (select count(*) from enrollments)::int as enrollments,
    (select count(*) from assignments)::int as assignments,
    (select count(*) from submissions)::int as submissions,
    (select count(*) from quizzes)::int as quizzes,
    (select count(*) from quiz_questions)::int as questions,
    (select count(*) from quiz_attempts)::int as attempts,
    (select count(*) from quiz_answers)::int as answers,
    (select count(*) from attendance)::int as attendance,
    (select count(*) from messages)::int as messages,
    (select count(*) from announcements)::int as announcements`);
  console.log(counts.rows[0]);
  console.log((await db.select({ u: users.username, n: users.fullName, r: users.role }).from(users).limit(6)));
  console.log((await db.select().from(classes)).map((c) => `${c.id}:${c.name}`).join(" | "));
  await closeDb();
}

void main();
