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
    startTime: integer("start_time").notNull(),
    endTime: integer("end_time").notNull(),
    duration: integer("duration").notNull(),
    viralScore: numeric("viral_score", { precision: 5, scale: 2 }),
    rank: integer("rank"),
    highlightMoment: text("highlight_moment"),
    isSelected: boolean("is_selected").default(false).notNull(),
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
  ],
);

export type Clip = typeof clips.$inferSelect;
export type NewClip = typeof clips.$inferInsert;
