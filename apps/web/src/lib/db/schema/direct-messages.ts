import { sql } from "drizzle-orm";
import { index, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";

/**
 * Direct messages between mutual followers ("friends").
 *
 * Authorization model:
 * - SELECT: participant only (sender or receiver)
 * - INSERT: sender must be auth.uid() AND is_mutual_follow(auth.uid(), receiver_id)
 *   Enforced at the database level via RLS + a SECURITY DEFINER function.
 * - No UPDATE/DELETE — messages are immutable once sent
 *
 * The mutual-follow check uses public.is_mutual_follow(), a STABLE SQL function
 * that leverages the unique index on follows(follower_id, following_id) for
 * efficient lookups. See migration 20260416_dm_mutual_follow_rls.sql.
 *
 * The DB also enforces dm_no_self_message CHECK (sender_id != receiver_id).
 */
export const directMessages = pgTable(
	"direct_messages",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		senderId: uuid("sender_id").notNull(),
		receiverId: uuid("receiver_id").notNull(),
		body: text("body").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("dm_select_participant", {
			for: "select",
			to: authenticatedRole,
			using: sql`${table.senderId} = ${authUid} OR ${table.receiverId} = ${authUid}`,
		}),
		pgPolicy("dm_insert_mutual_follow", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.senderId} = ${authUid} AND public.is_mutual_follow(${authUid}, ${table.receiverId})`,
		}),
		index("dm_sender_receiver_idx").on(table.senderId, table.receiverId),
		index("dm_receiver_sender_idx").on(table.receiverId, table.senderId),
		index("dm_created_at_idx").on(table.createdAt),
	],
);
