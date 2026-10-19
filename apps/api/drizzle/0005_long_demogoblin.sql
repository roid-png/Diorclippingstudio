ALTER TABLE "projects" ADD COLUMN "source_type" text DEFAULT 'youtube' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "source_file_name" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "channel_or_creator" text DEFAULT 'YouTube Creator';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "stage" text DEFAULT 'auto-edit' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "stage_label" text DEFAULT 'Auto-Edit Siap';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "edit_style" text DEFAULT 'theo-podcast';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "motion_graphic_style" text DEFAULT 'theo-infographics';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "subtitle_style" text DEFAULT 'theo-red-pill';--> statement-breakpoint
CREATE INDEX "projects_user_pinned_idx" ON "projects" USING btree ("user_id","is_pinned","created_at" DESC NULLS LAST);