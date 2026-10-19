import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { clips } from "./clips";

export const stylePresets = pgTable(
  "style_presets",
  {
    id: text("id").primaryKey(),
    category: text("category").notNull(), // 'editing_style' | 'motion_graphic' | 'subtitle_style'
    name: text("name").notNull(),
    tagline: text("tagline").notNull(),
    description: text("description").notNull(),
    badge: text("badge").notNull(),
    accentColor: text("accent_color").default("#E50914").notNull(),
    sourceReference: text("source_reference"),
    isCustom: boolean("is_custom").default(false).notNull(),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("style_presets_category_idx").on(
      table.category,
      table.isCustom,
      table.createdAt.desc(),
    ),
  ],
);

export const clipEditSettings = pgTable(
  "clip_edit_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clipId: uuid("clip_id")
      .notNull()
      .unique()
      .references(() => clips.id, { onDelete: "cascade" }),
    subtitleEnabled: boolean("subtitle_enabled").default(true).notNull(),
    editingStyleId: text("editing_style_id").default("theo-podcast").notNull(),
    motionGraphicId: text("motion_graphic_id")
      .default("theo-infographics")
      .notNull(),
    subtitleStyleId: text("subtitle_style_id")
      .default("theo-red-pill")
      .notNull(),
    wordByWordAnimation: boolean("word_by_word_animation")
      .default(true)
      .notNull(),
    highlightColor: text("highlight_color").default("#DC2626").notNull(),
    fontPosition: text("font_position")
      .default("Lower-Third Center (76% Y)")
      .notNull(),
    sfxTransitionEnabled: boolean("sfx_transition_enabled")
      .default(true)
      .notNull(),
    colorGradingFilter: text("color_grading_filter")
      .default("Warm Studio Contrast + Desaturated Background")
      .notNull(),
    zoomIntensity: integer("zoom_intensity").default(118).notNull(),
    customOverlayText: text("custom_overlay_text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("clip_edit_settings_clip_idx").on(table.clipId),
    index("clip_edit_settings_styles_idx").on(
      table.editingStyleId,
      table.motionGraphicId,
      table.subtitleStyleId,
    ),
  ],
);

export type StylePresetRecord = typeof stylePresets.$inferSelect;
export type NewStylePresetRecord = typeof stylePresets.$inferInsert;

export type ClipEditSetting = typeof clipEditSettings.$inferSelect;
export type NewClipEditSetting = typeof clipEditSettings.$inferInsert;

