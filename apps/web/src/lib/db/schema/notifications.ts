import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    type: varchar("type", { length: 50 }),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    read: boolean("read").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("notifications_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("notifications_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    index("notifications_user_id_idx").on(table.userId),
  ],
);

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().unique(),
    wantlistMatchInapp: boolean("wantlist_match_inapp").default(true).notNull(),
    wantlistMatchEmail: boolean("wantlist_match_email").default(true).notNull(),
    tradeRequestInapp: boolean("trade_request_inapp").default(true).notNull(),
    tradeRequestEmail: boolean("trade_request_email").default(true).notNull(),
    tradeCompletedInapp: boolean("trade_completed_inapp")
      .default(true)
      .notNull(),
    rankingChangeInapp: boolean("ranking_change_inapp")
      .default(true)
      .notNull(),
    newBadgeInapp: boolean("new_badge_inapp").default(true).notNull(),
    pushEnabled: boolean("push_enabled").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("notification_prefs_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("notification_prefs_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("notification_prefs_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
  ],
);
