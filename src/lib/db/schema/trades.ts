import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";
import { releases } from "./releases";

export const tradeRequests = pgTable(
  "trade_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    requesterId: uuid("requester_id").notNull(),
    providerId: uuid("provider_id").notNull(),
    releaseId: uuid("release_id").references(() => releases.id),
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending/accepted/declined/completed/cancelled
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("trade_requests_select_participant", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.requesterId} = ${authUid} OR ${table.providerId} = ${authUid}`,
    }),
    pgPolicy("trade_requests_insert_authenticated", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.requesterId} = ${authUid}`,
    }),
    pgPolicy("trade_requests_update_participant", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.requesterId} = ${authUid} OR ${table.providerId} = ${authUid}`,
      withCheck: sql`${table.requesterId} = ${authUid} OR ${table.providerId} = ${authUid}`,
    }),
  ],
);

export const tradeReviews = pgTable(
  "trade_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tradeId: uuid("trade_id")
      .references(() => tradeRequests.id)
      .notNull(),
    reviewerId: uuid("reviewer_id").notNull(),
    reviewedId: uuid("reviewed_id").notNull(),
    qualityRating: integer("quality_rating").notNull(), // 1-5
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("trade_reviews_select_all", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`, // All authenticated users can view reviews
    }),
    pgPolicy("trade_reviews_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.reviewerId} = ${authUid}`,
    }),
  ],
);
