import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { clips } from "./clips";

export const subtitles = pgTable(
  "subtitles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clipId: uuid("clip_id")
      .notNull()
      .references(() => clips.id, { onDelete: "cascade" }),
    startTime: numeric("start_time", { precision: 8, scale: 3 }).notNull(),
    endTime: numeric("end_time", { precision: 8, scale: 3 }).notNull(),
    text: text("text").notNull(),
    speaker: text("speaker"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("subtitles_clip_time_idx").on(table.clipId, table.startTime.asc()),
  ],
);

export type Subtitle = typeof subtitles.$inferSelect;
export type NewSubtitle = typeof subtitles.$inferInsert;

