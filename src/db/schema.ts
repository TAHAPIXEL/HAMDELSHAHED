import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/*                                   Enums                                    */
/* -------------------------------------------------------------------------- */

export const userRoleEnum = pgEnum("user_role", ["admin", "teacher", "student"]);
export const audienceEnum = pgEnum("announcement_audience", [
  "all",
  "students",
  "teachers",
  "class",
]);
export const messageScopeEnum = pgEnum("message_scope", ["direct", "class", "staff"]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "submitted",
  "late",
  "graded",
]);
export const questionTypeEnum = pgEnum("question_type", ["mcq", "truefalse", "short"]);
export const attemptStatusEnum = pgEnum("attempt_status", ["in_progress", "submitted"]);
export const attendanceStatusEnum = pgEnum("attendance_status", [
  "present",
  "absent",
  "late",
  "excused",
]);

/* -------------------------------------------------------------------------- */
/*                                   Users                                    */
/* -------------------------------------------------------------------------- */

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 64 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: varchar("full_name", { length: 120 }).notNull(),
    role: userRoleEnum("role").notNull().default("student"),
    nationalId: varchar("national_id", { length: 10 }),
    phone: varchar("phone", { length: 20 }),
    email: varchar("email", { length: 160 }),
    avatarColor: varchar("avatar_color", { length: 16 }).notNull().default("#6366f1"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_username_uq").on(t.username),
    uniqueIndex("users_national_id_uq").on(t.nationalId),
    index("users_role_idx").on(t.role),
    index("users_full_name_idx").on(t.fullName),
  ],
);

/* -------------------------------------------------------------------------- */
/*                             Classes & subjects                             */
/* -------------------------------------------------------------------------- */

export const classes = pgTable(
  "classes",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    grade: smallint("grade").notNull(),
    field: varchar("field", { length: 60 }).notNull(),
    academicYear: varchar("academic_year", { length: 12 }).notNull().default("1405-1406"),
    room: varchar("room", { length: 20 }),
    homeroomTeacherId: integer("homeroom_teacher_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("classes_name_year_uq").on(t.name, t.academicYear)],
);

export const subjects = pgTable(
  "subjects",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    code: varchar("code", { length: 24 }).notNull(),
    weeklyHours: smallint("weekly_hours").notNull().default(2),
    color: varchar("color", { length: 16 }).notNull().default("#6366f1"),
  },
  (t) => [uniqueIndex("subjects_code_uq").on(t.code)],
);

/** هر دانش‌آموز در کدام کلاس‌ها ثبت‌نام شده است */
export const enrollments = pgTable(
  "enrollments",
  {
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    classId: integer("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.studentId, t.classId] }),
    index("enrollments_class_idx").on(t.classId),
  ],
);

/** تخصیص دبیر به درس در یک کلاس */
export const classSubjects = pgTable(
  "class_subjects",
  {
    id: serial("id").primaryKey(),
    classId: integer("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "cascade" }),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("class_subjects_uq").on(t.classId, t.subjectId),
    index("class_subjects_teacher_idx").on(t.teacherId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                              Announcements                                 */
/* -------------------------------------------------------------------------- */

export const announcements = pgTable(
  "announcements",
  {
    id: serial("id").primaryKey(),
    authorId: integer("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    body: text("body").notNull(),
    imageUrl: text("image_url"),
    audience: audienceEnum("audience").notNull().default("all"),
    classId: integer("class_id").references(() => classes.id, { onDelete: "cascade" }),
    isPinned: boolean("is_pinned").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("announcements_created_idx").on(t.createdAt),
    index("announcements_audience_idx").on(t.audience),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                   Chat                                     */
/* -------------------------------------------------------------------------- */

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    senderId: integer("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    scope: messageScopeEnum("scope").notNull(),
    /** برای گفت‌وگوی کلاسی */
    classId: integer("class_id").references(() => classes.id, { onDelete: "cascade" }),
    /** برای گفت‌وگوی دونفره */
    recipientId: integer("recipient_id").references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull().default(""),
    imageUrl: text("image_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    index("messages_scope_class_idx").on(t.scope, t.classId, t.createdAt),
    index("messages_direct_idx").on(t.senderId, t.recipientId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                Assignments                                 */
/* -------------------------------------------------------------------------- */

export const assignments = pgTable(
  "assignments",
  {
    id: serial("id").primaryKey(),
    classId: integer("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull().default(""),
    imageUrl: text("image_url"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    maxScore: numeric("max_score", { precision: 5, scale: 2 }).notNull().default("20"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("assignments_class_idx").on(t.classId, t.dueAt),
    index("assignments_teacher_idx").on(t.teacherId),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    assignmentId: integer("assignment_id")
      .notNull()
      .references(() => assignments.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    imageUrl: text("image_url"),
    status: submissionStatusEnum("status").notNull().default("submitted"),
    score: numeric("score", { precision: 5, scale: 2 }),
    feedback: text("feedback"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    gradedAt: timestamp("graded_at", { withTimezone: true }),
    gradedBy: integer("graded_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    uniqueIndex("submissions_assignment_student_uq").on(t.assignmentId, t.studentId),
    index("submissions_student_idx").on(t.studentId),
  ],
);

/* -------------------------------------------------------------------------- */
/*                                  Quizzes                                   */
/* -------------------------------------------------------------------------- */

export const quizzes = pgTable(
  "quizzes",
  {
    id: serial("id").primaryKey(),
    classId: integer("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    teacherId: integer("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 160 }).notNull(),
    description: text("description").notNull().default(""),
    durationMinutes: smallint("duration_minutes").notNull().default(20),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    isPublished: boolean("is_published").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("quizzes_class_idx").on(t.classId, t.startsAt),
    index("quizzes_teacher_idx").on(t.teacherId),
  ],
);

export const quizQuestions = pgTable(
  "quiz_questions",
  {
    id: serial("id").primaryKey(),
    quizId: integer("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    orderIndex: smallint("order_index").notNull().default(0),
    type: questionTypeEnum("type").notNull().default("mcq"),
    prompt: text("prompt").notNull(),
    imageUrl: text("image_url"),
    options: jsonb("options").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    correctAnswer: text("correct_answer").notNull(),
    points: numeric("points", { precision: 4, scale: 2 }).notNull().default("1"),
  },
  (t) => [index("quiz_questions_quiz_idx").on(t.quizId, t.orderIndex)],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: serial("id").primaryKey(),
    quizId: integer("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: attemptStatusEnum("status").notNull().default("in_progress"),
    score: numeric("score", { precision: 5, scale: 2 }).notNull().default("0"),
    maxScore: numeric("max_score", { precision: 5, scale: 2 }).notNull().default("0"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("quiz_attempts_quiz_student_uq").on(t.quizId, t.studentId),
    index("quiz_attempts_student_idx").on(t.studentId),
  ],
);

export const quizAnswers = pgTable(
  "quiz_answers",
  {
    id: serial("id").primaryKey(),
    attemptId: integer("attempt_id")
      .notNull()
      .references(() => quizAttempts.id, { onDelete: "cascade" }),
    questionId: integer("question_id")
      .notNull()
      .references(() => quizQuestions.id, { onDelete: "cascade" }),
    answer: text("answer").notNull().default(""),
    isCorrect: boolean("is_correct").notNull().default(false),
    awardedPoints: numeric("awarded_points", { precision: 4, scale: 2 })
      .notNull()
      .default("0"),
  },
  (t) => [uniqueIndex("quiz_answers_uq").on(t.attemptId, t.questionId)],
);

/* -------------------------------------------------------------------------- */
/*                                 Attendance                                 */
/* -------------------------------------------------------------------------- */

export const attendance = pgTable(
  "attendance",
  {
    id: serial("id").primaryKey(),
    classId: integer("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    studentId: integer("student_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionDate: date("session_date").notNull(),
    period: smallint("period").notNull().default(1),
    status: attendanceStatusEnum("status").notNull().default("present"),
    note: text("note"),
    recordedBy: integer("recorded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("attendance_uq").on(t.studentId, t.sessionDate, t.period),
    index("attendance_class_date_idx").on(t.classId, t.sessionDate),
  ],
);

/* -------------------------------------------------------------------------- */
/*                        Media, Settings & Security                          */
/* -------------------------------------------------------------------------- */

/** ثبت همه‌ی فایل‌ها و تصاویر آپلودشده (پروفایل، گفت‌وگو، اطلاعیه، تکلیف، آزمون) */
export const mediaFiles = pgTable(
  "media_files",
  {
    id: varchar("id", { length: 36 }).primaryKey(),
    uploaderId: integer("uploader_id").references(() => users.id, { onDelete: "set null" }),
    folder: varchar("folder", { length: 32 }).notNull(),
    storagePath: text("storage_path").notNull(),
    publicUrl: text("public_url").notNull(),
    mimeType: varchar("mime_type", { length: 64 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** فقط برای اجرای محلی بدون Supabase Storage */
    fallbackData: text("fallback_data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("media_files_uploader_idx").on(t.uploaderId),
    index("media_files_public_url_idx").on(t.publicUrl),
  ],
);

/** تنظیمات سامانه و رمزهای امنیتی (مثل رمز حذف) */
export const systemSettings = pgTable("system_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    token: varchar("token", { length: 64 }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userAgent: varchar("user_agent", { length: 240 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 60 }).notNull(),
    entity: varchar("entity", { length: 40 }).notNull(),
    entityId: integer("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt)],
);

/* -------------------------------------------------------------------------- */
/*                                 Relations                                  */
/* -------------------------------------------------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  enrollments: many(enrollments),
  submissions: many(submissions),
  attempts: many(quizAttempts),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  homeroomTeacher: one(users, {
    fields: [classes.homeroomTeacherId],
    references: [users.id],
  }),
  enrollments: many(enrollments),
  classSubjects: many(classSubjects),
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(users, { fields: [enrollments.studentId], references: [users.id] }),
  class: one(classes, { fields: [enrollments.classId], references: [classes.id] }),
}));

export const classSubjectsRelations = relations(classSubjects, ({ one }) => ({
  class: one(classes, { fields: [classSubjects.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [classSubjects.subjectId], references: [subjects.id] }),
  teacher: one(users, { fields: [classSubjects.teacherId], references: [users.id] }),
}));

export const assignmentsRelations = relations(assignments, ({ one, many }) => ({
  class: one(classes, { fields: [assignments.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [assignments.subjectId], references: [subjects.id] }),
  teacher: one(users, { fields: [assignments.teacherId], references: [users.id] }),
  submissions: many(submissions),
}));

export const submissionsRelations = relations(submissions, ({ one }) => ({
  assignment: one(assignments, {
    fields: [submissions.assignmentId],
    references: [assignments.id],
  }),
  student: one(users, { fields: [submissions.studentId], references: [users.id] }),
}));

export const quizzesRelations = relations(quizzes, ({ one, many }) => ({
  class: one(classes, { fields: [quizzes.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [quizzes.subjectId], references: [subjects.id] }),
  teacher: one(users, { fields: [quizzes.teacherId], references: [users.id] }),
  questions: many(quizQuestions),
  attempts: many(quizAttempts),
}));

export const quizQuestionsRelations = relations(quizQuestions, ({ one }) => ({
  quiz: one(quizzes, { fields: [quizQuestions.quizId], references: [quizzes.id] }),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one, many }) => ({
  quiz: one(quizzes, { fields: [quizAttempts.quizId], references: [quizzes.id] }),
  student: one(users, { fields: [quizAttempts.studentId], references: [users.id] }),
  answers: many(quizAnswers),
}));

export const quizAnswersRelations = relations(quizAnswers, ({ one }) => ({
  attempt: one(quizAttempts, {
    fields: [quizAnswers.attemptId],
    references: [quizAttempts.id],
  }),
  question: one(quizQuestions, {
    fields: [quizAnswers.questionId],
    references: [quizQuestions.id],
  }),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  class: one(classes, { fields: [attendance.classId], references: [classes.id] }),
  student: one(users, { fields: [attendance.studentId], references: [users.id] }),
}));
