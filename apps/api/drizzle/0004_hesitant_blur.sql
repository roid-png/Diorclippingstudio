CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"clip_id" uuid,
	"render_job_id" uuid,
	"type" text DEFAULT 'info' NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"file_name" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "render_jobs" ADD COLUMN "speed_mode" text DEFAULT 'turbo-fast' NOT NULL;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD COLUMN "resolution" text DEFAULT '1080x1920' NOT NULL;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD COLUMN "fps" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD COLUMN "active_step_id" text;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD COLUMN "active_step_label" text;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD COLUMN "file_size_mb" numeric(6, 2);--> statement-breakpoint
ALTER TABLE "render_jobs" ADD COLUMN "download_file_name" text;--> statement-breakpoint
ALTER TABLE "render_jobs" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_render_job_id_render_jobs_id_fk" FOREIGN KEY ("render_job_id") REFERENCES "public"."render_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id","is_read");