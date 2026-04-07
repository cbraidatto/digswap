import { sql } from "drizzle-orm";
import {
	index,
	integer,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
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
		previewAcceptedByRecipientAt: timestamp("preview_accepted_by_recipient_at", {
			withTimezone: true,
		}),
		lastJoinedLobbyAt: timestamp("last_joined_lobby_at", { withTimezone: true }),
		requesterLastReadAt: timestamp("requester_last_read_at", { withTimezone: true }),
		providerLastReadAt: timestamp("provider_last_read_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
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

export const tradeMessages = pgTable(
	"trade_messages",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		tradeId: uuid("trade_id")
			.references(() => tradeRequests.id, { onDelete: "cascade" })
			.notNull(),
		senderId: uuid("sender_id").notNull(),
		kind: varchar("kind", { length: 16 }).default("user").notNull(),
		body: text("body").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("trade_messages_select_participants", {
			for: "select",
			to: authenticatedRole,
			using: sql`EXISTS (
        SELECT 1 FROM trade_requests tr
        WHERE tr.id = ${table.tradeId}
          AND (tr.requester_id = ${authUid} OR tr.provider_id = ${authUid})
      )`,
		}),
		pgPolicy("trade_messages_insert_participants", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.senderId} = ${authUid}
        AND ${table.kind} = 'user'
        AND EXISTS (
          SELECT 1 FROM trade_requests tr
          WHERE tr.id = ${table.tradeId}
            AND (tr.requester_id = ${authUid} OR tr.provider_id = ${authUid})
        )`,
		}),
		index("trade_messages_trade_id_idx").on(table.tradeId),
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
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("trade_reviews_select_all", {
			for: "select",
			to: authenticatedRole,
			using: sql`true`, // All authenticated users can view reviews
		}),
		// NOTE: Production migration (20260405) has a simpler check (reviewer_id = auth.uid() only).
		// The schema version is more secure - validates trade completion + participant role.
		// If drizzle-kit push runs, it will UPGRADE production security for this table.
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

/**
 * Short-TTL HMAC-SHA256 signed tokens for web→desktop handoff.
 * RLS blocks all direct access — only server actions (using the Drizzle db client
 * directly) can read or write this table.
 *
 * See: src/lib/desktop/handoff-token.ts
 * See: ADR-002-desktop-trade-runtime.md D-08
 */
export const handoffTokens = pgTable(
	"handoff_tokens",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		tradeId: uuid("trade_id")
			.notNull()
			.references(() => tradeRequests.id, { onDelete: "cascade" }),
		userId: uuid("user_id").notNull(),
		/** Hex-encoded HMAC-SHA256 of the plaintext token — never store plaintext */
		tokenHmac: varchar("token_hmac", { length: 64 }).notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		/** Set atomically on first consumption — second call finds usedAt IS NOT NULL */
		usedAt: timestamp("used_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	() => [
		pgPolicy("handoff_tokens_no_direct_access", {
			for: "all",
			to: authenticatedRole,
			using: sql`false`,
			withCheck: sql`false`,
		}),
	],
);

/**
 * Desktop runtime authority per trade participant.
 * Only RPCs should mutate these rows; direct table access stays blocked.
 *
 * See: Phase 17 / ADR-002 D-06
 */
export const tradeRuntimeSessions = pgTable(
	"trade_runtime_sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		tradeId: uuid("trade_id")
			.notNull()
			.references(() => tradeRequests.id, { onDelete: "cascade" }),
		userId: uuid("user_id").notNull(),
		deviceId: varchar("device_id", { length: 255 }).notNull(),
		clientKind: varchar("client_kind", { length: 20 }).default("desktop").notNull(),
		desktopVersion: integer("desktop_version").default(1).notNull(),
		tradeProtocolVersion: integer("trade_protocol_version").default(1).notNull(),
		peerId: varchar("peer_id", { length: 100 }),
		lastIceCandidateType: varchar("last_ice_candidate_type", { length: 16 }),
		acquiredAt: timestamp("acquired_at", { withTimezone: true }).defaultNow().notNull(),
		heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }).defaultNow().notNull(),
		releasedAt: timestamp("released_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	() => [
		pgPolicy("trade_runtime_sessions_no_direct_access", {
			for: "all",
			to: authenticatedRole,
			using: sql`false`,
		}),
	],
);

/**
 * Finalized transfer receipts written after the receiver has the full file.
 * Local pending receipts live in Electron until they can be reconciled here.
 *
 * See: Phase 17 / ADR-002 D-06
 */
export const tradeTransferReceipts = pgTable(
	"trade_transfer_receipts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		tradeId: uuid("trade_id")
			.notNull()
			.references(() => tradeRequests.id, { onDelete: "cascade" }),
		userId: uuid("user_id").notNull(),
		deviceId: varchar("device_id", { length: 255 }).notNull(),
		fileName: varchar("file_name", { length: 255 }).notNull(),
		fileSizeBytes: integer("file_size_bytes").notNull(),
		fileHashSha256: varchar("file_hash_sha256", { length: 64 }).notNull(),
		iceCandidateType: varchar("ice_candidate_type", { length: 16 }).notNull(),
		tradeProtocolVersion: integer("trade_protocol_version").default(1).notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }).notNull(),
		reconciledAt: timestamp("reconciled_at", { withTimezone: true }).defaultNow().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	() => [
		pgPolicy("trade_transfer_receipts_no_direct_access", {
			for: "all",
			to: authenticatedRole,
			using: sql`false`,
		}),
	],
);
