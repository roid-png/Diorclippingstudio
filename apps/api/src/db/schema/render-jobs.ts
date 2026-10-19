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
    speedMode: text("speed_mode").default("turbo-fast").notNull(),
    resolution: text("resolution").default("1080x1920").notNull(),
    fps: integer("fps").default(60).notNull(),
    status: text("status").default("queued").notNull(), // 'queued' | 'rendering' | 'completed' | 'failed'
    progress: integer("progress").default(0).notNull(),
    activeStepId: text("active_step_id"),
    activeStepLabel: text("active_step_label"),
    outputUrl: text("output_url"),
    fileSizeMb: numeric("file_size_mb", { precision: 6, scale: 2 }),
    downloadFileName: text("download_file_name"),
    errorMessage: text("error_message"),
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
