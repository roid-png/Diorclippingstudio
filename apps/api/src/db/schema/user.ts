import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  avatarUrl: text("avatar_url").default("/images/michael_avatar.png"),
  bio: text("bio"),
  badge: text("badge").default("Content Creator"),
  // Better Auth admin plugin. `role` holds one name, or several separated by
  // commas. Signup cannot set it; see packages/shared/src/permissions.ts.
  role: text("role").default("user"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const users = user;
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
