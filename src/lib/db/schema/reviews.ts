import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";
import { releases } from "./releases";

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    releaseId: uuid("release_id")
      .references(() => releases.id)
      .notNull(),
    rating: integer("rating").notNull(), // 1-5
    title: varchar("title", { length: 200 }),
    body: text("body"),
    isPressingSpecific: boolean("is_pressing_specific")
      .default(false)
      .notNull(),
    pressingDetails: text("pressing_details"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("reviews_select_all", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`, // All authenticated users can view reviews
    }),
    pgPolicy("reviews_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("reviews_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("reviews_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
  ],
);
