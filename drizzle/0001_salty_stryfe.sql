CREATE TABLE "media_files" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"uploader_id" integer,
	"folder" varchar(32) NOT NULL,
	"storage_path" text NOT NULL,
	"public_url" text NOT NULL,
	"mime_type" varchar(64) NOT NULL,
	"size_bytes" integer NOT NULL,
	"fallback_data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" varchar(64) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "classes" ALTER COLUMN "academic_year" SET DEFAULT '1405-1406';--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "body" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "announcements" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "assignments" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "image_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_files_uploader_idx" ON "media_files" USING btree ("uploader_id");--> statement-breakpoint
CREATE INDEX "media_files_public_url_idx" ON "media_files" USING btree ("public_url");