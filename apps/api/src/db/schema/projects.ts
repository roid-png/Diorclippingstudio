import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./user";

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    youtubeUrl: text("youtube_url").notNull(),
    sourceType: text("source_type").default("youtube").notNull(), // 'youtube' | 'upload'
    sourceFileName: text("source_file_name"),
    channelOrCreator: text("channel_or_creator").default("YouTube Creator"),
    thumbnailUrl: text("thumbnail_url"),
    videoTitle: text("video_title"),
    videoDuration: integer("video_duration"),
    clipDuration: integer("clip_duration").default(45).notNull(), // 30 | 45 | 60
    maxClips: integer("max_clips").default(10).notNull(), // 1..10
    status: text("status").default("pending").notNull(), // 'pending' | 'processing' | 'completed' | 'failed'
    stage: text("stage").default("auto-edit").notNull(), // 'completed' | 'rendering' | 'auto-edit' | 'viral-detected' | 'failed'
    stageLabel: text("stage_label").default("Auto-Edit Siap"),
    isPinned: boolean("is_pinned").default(false).notNull(),
    editStyle: text("edit_style").default("theo-podcast"),
    motionGraphicStyle: text("motion_graphic_style").default("theo-infographics"),
    subtitleStyle: text("subtitle_style").default("theo-red-pill"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("projects_user_created_idx").on(
      table.userId,
      table.createdAt.desc(),
      table.id.desc(),
    ),
    index("projects_user_pinned_idx").on(
      table.userId,
      table.isPinned,
      table.createdAt.desc(),
    ),
  ],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
