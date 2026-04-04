import { pgTable, uuid, varchar, timestamp } from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";
import { groups } from "./groups";

export const groupInvites = pgTable(
  "group_invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .references(() => groups.id)
      .notNull(),
    token: varchar("token", { length: 36 }).unique().notNull(),
    createdBy: uuid("created_by").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // NOTE: This schema currently models token invites without an invitee_id column,
    // so the production invitee-specific UPDATE policy cannot be represented here yet.
    pgPolicy("group_invites_select_participant", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.createdBy} = ${authUid}`,
    }),
    pgPolicy("group_invites_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.createdBy} = ${authUid}`,
    }),
  ],
);
