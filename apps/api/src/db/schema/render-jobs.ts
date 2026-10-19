import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { clips } from "./clips";

export const renderJobs = pgTable(
  "render_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clipId: uuid("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    subtitleEnabled: boolean("subtitle_enabled").default(true).notNull(),
    motionGraphicStyle: text("motion_graphic_style").default("theo-infographics").notNull(),
    editStyle: text("edit_style").default("theo-podcast").notNull(),
    status: text("status").default("queued").notNull(),
    progress: integer("progress").default(0).notNull(),
    outputUrl: text("output_url"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("render_jobs_clip_idx").on(table.clipId, table.createdAt.desc()),
    index("render_jobs_status_idx").on(table.status),
  ],
);

export type RenderJob = typeof renderJobs.$inferSelect;
export type NewRenderJob = typeof renderJobs.$inferInsert;

