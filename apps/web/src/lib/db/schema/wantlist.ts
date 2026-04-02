import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";
import { releases } from "./releases";

export const wantlistItems = pgTable(
  "wantlist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    releaseId: uuid("release_id").references(() => releases.id),
    notes: text("notes"),
    priority: integer("priority").default(0).notNull(),
    addedVia: varchar("added_via", { length: 20 }), // "discogs" or "manual"
    foundAt: timestamp("found_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("wantlist_items_select_all", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`, // Public wantlists
    }),
    pgPolicy("wantlist_items_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("wantlist_items_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
    index("wantlist_items_user_id_idx").on(table.userId),
  ],
);
