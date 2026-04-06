import { sql } from "drizzle-orm";
import { index, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";

/**
 * Direct messages between mutual followers ("friends").
 *
 * Authorization model:
 * - SELECT: participant only (sender or receiver)
 * - INSERT: sender must be auth.uid(), and a mutual follow must exist
 * - No UPDATE/DELETE — messages are immutable once sent
 *
 * The mutual-follow check is enforced at the server action layer (not in RLS)
 * because RLS subqueries on follows would be expensive on every insert.
 * RLS restricts visibility to participants only.
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
		pgPolicy("dm_insert_own", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.senderId} = ${authUid}`,
		}),
		index("dm_sender_receiver_idx").on(table.senderId, table.receiverId),
		index("dm_receiver_sender_idx").on(table.receiverId, table.senderId),
		index("dm_created_at_idx").on(table.createdAt),
	],
);
