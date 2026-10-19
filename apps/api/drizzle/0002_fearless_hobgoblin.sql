ALTER TABLE "clips" ADD COLUMN "title" text DEFAULT 'Momen Viral Pilihan AI' NOT NULL;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "category" text DEFAULT 'kontroversi' NOT NULL;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "viral_label" text DEFAULT '🔥 Sangat Berpotensi Viral' NOT NULL;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "is_primary_recommendation" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "why_viral" text;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "emotional_trigger" text;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "peak_retention" integer DEFAULT 92 NOT NULL;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "subtitle_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "editing_style_id" text DEFAULT 'theo-podcast' NOT NULL;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "motion_graphic_id" text DEFAULT 'theo-infographics' NOT NULL;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "subtitle_style_id" text DEFAULT 'theo-red-pill' NOT NULL;--> statement-breakpoint
CREATE INDEX "clips_project_viral_score_idx" ON "clips" USING btree ("project_id","viral_score" DESC NULLS LAST,"rank");