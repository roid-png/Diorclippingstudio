import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./user";

export const quotas = pgTable(
  "quotas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    totalQuota: integer("total_quota").default(50).notNull(),
    usedQuota: integer("used_quota").default(0).notNull(),
    resetDate: timestamp("reset_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("quotas_user_idx").on(table.userId)],
);

export const clipUsages = pgTable(
  "clip_usages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: uuid("project_id"),
    clipsUsed: integer("clips_used").notNull(),
    remainingAfter: integer("remaining_after").notNull(),
    sourceTitle: text("source_title"),
    actionType: text("action_type").default("auto_cut").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("clip_usages_user_idx").on(table.userId),
    index("clip_usages_created_idx").on(table.createdAt),
  ],
);

export type Quota = typeof quotas.$inferSelect;
export type NewQuota = typeof quotas.$inferInsert;
export type ClipUsage = typeof clipUsages.$inferSelect;
export type NewClipUsage = typeof clipUsages.$inferInsert;
