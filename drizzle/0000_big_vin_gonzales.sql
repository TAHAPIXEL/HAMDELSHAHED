CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('present', 'absent', 'late', 'excused');--> statement-breakpoint
CREATE TYPE "public"."announcement_audience" AS ENUM('all', 'students', 'teachers', 'class');--> statement-breakpoint
CREATE TYPE "public"."message_scope" AS ENUM('direct', 'class', 'staff');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('mcq', 'truefalse', 'short');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('submitted', 'late', 'graded');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'teacher', 'student');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"audience" "announcement_audience" DEFAULT 'all' NOT NULL,
	"class_id" integer,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	"teacher_id" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"max_score" numeric(5, 2) DEFAULT '20' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"session_date" date NOT NULL,
	"period" smallint DEFAULT 1 NOT NULL,
	"status" "attendance_status" DEFAULT 'present' NOT NULL,
	"note" text,
	"recorded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actor_id" integer,
	"action" varchar(60) NOT NULL,
	"entity" varchar(40) NOT NULL,
	"entity_id" integer,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	"teacher_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"grade" smallint NOT NULL,
	"field" varchar(60) NOT NULL,
	"academic_year" varchar(12) DEFAULT '1404-1405' NOT NULL,
	"room" varchar(20),
	"homeroom_teacher_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"student_id" integer NOT NULL,
	"class_id" integer NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_student_id_class_id_pk" PRIMARY KEY("student_id","class_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sender_id" integer NOT NULL,
	"scope" "message_scope" NOT NULL,
	"class_id" integer,
	"recipient_id" integer,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "quiz_answers" (
	"id" serial PRIMARY KEY NOT NULL,
	"attempt_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"answer" text DEFAULT '' NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"awarded_points" numeric(4, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"quiz_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"status" "attempt_status" DEFAULT 'in_progress' NOT NULL,
	"score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"max_score" numeric(5, 2) DEFAULT '0' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"quiz_id" integer NOT NULL,
	"order_index" smallint DEFAULT 0 NOT NULL,
	"type" "question_type" DEFAULT 'mcq' NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"correct_answer" text NOT NULL,
	"points" numeric(4, 2) DEFAULT '1' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	"teacher_id" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"duration_minutes" smallint DEFAULT 20 NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"user_agent" varchar(240),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"code" varchar(24) NOT NULL,
	"weekly_hours" smallint DEFAULT 2 NOT NULL,
	"color" varchar(16) DEFAULT '#6366f1' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignment_id" integer NOT NULL,
	"student_id" integer NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"status" "submission_status" DEFAULT 'submitted' NOT NULL,
	"score" numeric(5, 2),
	"feedback" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"graded_at" timestamp with time zone,
	"graded_by" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(64) NOT NULL,
	"password_hash" text NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"role" "user_role" DEFAULT 'student' NOT NULL,
	"national_id" varchar(10),
	"phone" varchar(20),
	"email" varchar(160),
	"avatar_color" varchar(16) DEFAULT '#6366f1' NOT NULL,
	"bio" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_homeroom_teacher_id_users_id_fk" FOREIGN KEY ("homeroom_teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_id_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_created_idx" ON "announcements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "announcements_audience_idx" ON "announcements" USING btree ("audience");--> statement-breakpoint
CREATE INDEX "assignments_class_idx" ON "assignments" USING btree ("class_id","due_at");--> statement-breakpoint
CREATE INDEX "assignments_teacher_idx" ON "assignments" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_uq" ON "attendance" USING btree ("student_id","session_date","period");--> statement-breakpoint
CREATE INDEX "attendance_class_date_idx" ON "attendance" USING btree ("class_id","session_date");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "class_subjects_uq" ON "class_subjects" USING btree ("class_id","subject_id");--> statement-breakpoint
CREATE INDEX "class_subjects_teacher_idx" ON "class_subjects" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "classes_name_year_uq" ON "classes" USING btree ("name","academic_year");--> statement-breakpoint
CREATE INDEX "enrollments_class_idx" ON "enrollments" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "messages_scope_class_idx" ON "messages" USING btree ("scope","class_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_direct_idx" ON "messages" USING btree ("sender_id","recipient_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_answers_uq" ON "quiz_answers" USING btree ("attempt_id","question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempts_quiz_student_uq" ON "quiz_attempts" USING btree ("quiz_id","student_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_student_idx" ON "quiz_attempts" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "quiz_questions_quiz_idx" ON "quiz_questions" USING btree ("quiz_id","order_index");--> statement-breakpoint
CREATE INDEX "quizzes_class_idx" ON "quizzes" USING btree ("class_id","starts_at");--> statement-breakpoint
CREATE INDEX "quizzes_teacher_idx" ON "quizzes" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_code_uq" ON "subjects" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_assignment_student_uq" ON "submissions" USING btree ("assignment_id","student_id");--> statement-breakpoint
CREATE INDEX "submissions_student_idx" ON "submissions" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_national_id_uq" ON "users" USING btree ("national_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_full_name_idx" ON "users" USING btree ("full_name");