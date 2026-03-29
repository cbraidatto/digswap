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
    status: varchar("status", { length: 20 }).default("pending").notNull(), // pending/lobby/previewing/accepted/transferring/declined/completed/cancelled/expired
    message: text("message"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    fileName: varchar("file_name", { length: 255 }),
    fileFormat: varchar("file_format", { length: 50 }),
    declaredBitrate: varchar("declared_bitrate", { length: 50 }),
    fileSizeBytes: integer("file_size_bytes"),
    offeringReleaseId: uuid("offering_release_id").references(() => releases.id),
    conditionNotes: text("condition_notes"),
    declaredQuality: varchar("declared_quality", { length: 50 }),
    fileHash: varchar("file_hash", { length: 64 }),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
    termsAcceptedByRecipientAt: timestamp("terms_accepted_by_recipient_at", { withTimezone: true }),
    previewAcceptedAt: timestamp("preview_accepted_at", { withTimezone: true }),
    previewAcceptedByRecipientAt: timestamp("preview_accepted_by_recipient_at", { withTimezone: true }),
    lastJoinedLobbyAt: timestamp("last_joined_lobby_at", { withTimezone: true }),
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
      withCheck: sql`${table.reviewerId} = ${authUid}
        AND EXISTS (
          SELECT 1 FROM trade_requests tr
          WHERE tr.id = ${table.tradeId}
            AND tr.status = 'completed'
            AND (tr.requester_id = ${authUid} OR tr.provider_id = ${authUid})
            AND ${table.reviewedId} = CASE
              WHEN tr.requester_id = ${authUid} THEN tr.provider_id
              ELSE tr.requester_id
            END
        )`,
    }),
  ],
);
