import {
	pgTable,
	uuid,
	timestamp,
	text,
	integer,
	index,
} from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";
import { releases } from "./releases";

export const listeningLogs = pgTable(
	"listening_logs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id").notNull(),
		releaseId: uuid("release_id")
			.notNull()
			.references(() => releases.id, { onDelete: "cascade" }),
		caption: text("caption"),
		rating: integer("rating"), // 1-5, optional
		listenedAt: timestamp("listened_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		// RLS: own user can select their own logs
		pgPolicy("listening_logs_select_own", {
			for: "select",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
		}),
		// RLS: only insert own
		pgPolicy("listening_logs_insert_own", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.userId} = ${authUid}`,
		}),
		index("listening_logs_user_id_idx").on(table.userId),
		index("listening_logs_listened_at_idx").on(table.listenedAt),
	],
);
