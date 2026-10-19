CREATE TABLE "clip_edit_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clip_id" uuid NOT NULL,
	"subtitle_enabled" boolean DEFAULT true NOT NULL,
	"editing_style_id" text DEFAULT 'theo-podcast' NOT NULL,
	"motion_graphic_id" text DEFAULT 'theo-infographics' NOT NULL,
	"subtitle_style_id" text DEFAULT 'theo-red-pill' NOT NULL,
	"word_by_word_animation" boolean DEFAULT true NOT NULL,
	"highlight_color" text DEFAULT '#DC2626' NOT NULL,
	"font_position" text DEFAULT 'Lower-Third Center (76% Y)' NOT NULL,
	"sfx_transition_enabled" boolean DEFAULT true NOT NULL,
	"color_grading_filter" text DEFAULT 'Warm Studio Contrast + Desaturated Background' NOT NULL,
	"zoom_intensity" integer DEFAULT 118 NOT NULL,
	"custom_overlay_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clip_edit_settings_clip_id_unique" UNIQUE("clip_id")
);
--> statement-breakpoint
CREATE TABLE "style_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text NOT NULL,
	"description" text NOT NULL,
	"badge" text NOT NULL,
	"accent_color" text DEFAULT '#E50914' NOT NULL,
	"source_reference" text,
	"is_custom" boolean DEFAULT false NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clip_edit_settings" ADD CONSTRAINT "clip_edit_settings_clip_id_clips_id_fk" FOREIGN KEY ("clip_id") REFERENCES "public"."clips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clip_edit_settings_clip_idx" ON "clip_edit_settings" USING btree ("clip_id");--> statement-breakpoint
CREATE INDEX "clip_edit_settings_styles_idx" ON "clip_edit_settings" USING btree ("editing_style_id","motion_graphic_id","subtitle_style_id");--> statement-breakpoint
CREATE INDEX "style_presets_category_idx" ON "style_presets" USING btree ("category","is_custom","created_at" DESC NULLS LAST);