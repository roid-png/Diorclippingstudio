import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { projects } from "./projects";

export const clips = pgTable(
  "clips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").default("Momen Viral Pilihan AI").notNull(),
    category: text("category").default("kontroversi").notNull(),
    startTime: integer("start_time").notNull(),
    endTime: integer("end_time").notNull(),
    duration: integer("duration").notNull(),
    viralScore: numeric("viral_score", { precision: 5, scale: 2 }),
    viralLabel: text("viral_label")
      .default("🔥 Sangat Berpotensi Viral")
      .notNull(),
    rank: integer("rank"),
    isPrimaryRecommendation: boolean("is_primary_recommendation")
      .default(false)
      .notNull(),
    highlightMoment: text("highlight_moment"),
    whyViral: text("why_viral"),
    emotionalTrigger: text("emotional_trigger"),
    peakRetention: integer("peak_retention").default(92).notNull(),
    isSelected: boolean("is_selected").default(false).notNull(),
    subtitleEnabled: boolean("subtitle_enabled").default(true).notNull(),
    editingStyleId: text("editing_style_id").default("theo-podcast").notNull(),
    motionGraphicId: text("motion_graphic_id")
      .default("theo-infographics")
      .notNull(),
    subtitleStyleId: text("subtitle_style_id")
      .default("theo-red-pill")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("clips_project_rank_idx").on(
      table.projectId,
      table.rank.asc(),
      table.id.desc(),
    ),
    index("clips_project_viral_score_idx").on(
      table.projectId,
      table.viralScore.desc(),
      table.rank.asc(),
    ),
  ],
);

export type Clip = typeof clips.$inferSelect;
export type NewClip = typeof clips.$inferInsert;

