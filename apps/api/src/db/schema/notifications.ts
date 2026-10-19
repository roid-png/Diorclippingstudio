import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./user";
import { clips } from "./clips";
import { renderJobs } from "./render-jobs";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clipId: uuid("clip_id").references(() => clips.id, { onDelete: "set null" }),
    renderJobId: uuid("render_job_id").references(() => renderJobs.id, {
      onDelete: "set null",
    }),
    type: text("type").default("info").notNull(), // 'success' | 'error' | 'info'
    title: text("title").notNull(),
    message: text("message").notNull(),
    fileName: text("file_name"),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("notifications_user_idx").on(table.userId, table.createdAt.desc()),
    index("notifications_user_unread_idx").on(table.userId, table.isRead),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
