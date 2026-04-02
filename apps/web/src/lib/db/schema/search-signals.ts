import {
	pgTable,
	uuid,
	text,
	real,
	timestamp,
	index,
} from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";

export const searchSignals = pgTable(
	"search_signals",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id").notNull(),
		terms: text("terms").array().default([]).notNull(),
		genres: text("genres").array().default([]).notNull(),
		strength: real("strength").default(0.1).notNull(), // 0.0–1.0, decays over time
		lastReinforcedAt: timestamp("last_reinforced_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("search_signals_user_id_idx").on(table.userId),
		pgPolicy("search_signals_select_own", {
			for: "select",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("search_signals_insert_own", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("search_signals_update_own", {
			for: "update",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
		}),
	],
);
