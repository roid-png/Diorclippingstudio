CREATE TABLE "clip_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"project_id" uuid,
	"clips_used" integer NOT NULL,
	"remaining_after" integer NOT NULL,
	"source_title" text,
	"action_type" text DEFAULT 'auto_cut' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "daily_quota" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "used_quota" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "quota_reset_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clip_usages" ADD CONSTRAINT "clip_usages_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clip_usages_user_idx" ON "clip_usages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "clip_usages_created_idx" ON "clip_usages" USING btree ("created_at");