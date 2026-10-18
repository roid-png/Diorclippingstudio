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
  (table) => [
    index("quotas_user_idx").on(table.userId),
  ],
);

export type Quota = typeof quotas.$inferSelect;
export type NewQuota = typeof quotas.$inferInsert;
