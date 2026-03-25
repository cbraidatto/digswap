import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey(), // References auth.users.id
    displayName: varchar("display_name", { length: 50 }),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    discogsUsername: varchar("discogs_username", { length: 100 }),
    discogsConnected: boolean("discogs_connected").default(false).notNull(),
    onboardingCompleted: boolean("onboarding_completed")
      .default(false)
      .notNull(),
    twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
    subscriptionTier: varchar("subscription_tier", { length: 20 })
      .default("free")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("profiles_select_policy", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`, // All authenticated users can view profiles
    }),
    pgPolicy("profiles_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.id} = ${authUid}`,
      withCheck: sql`${table.id} = ${authUid}`,
    }),
    pgPolicy("profiles_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.id} = ${authUid}`,
    }),
    pgPolicy("profiles_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.id} = ${authUid}`,
    }),
  ],
);
