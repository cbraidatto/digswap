import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";
import { profiles } from "./users";

export const leads = pgTable(
	"leads",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id")
			.notNull()
			.references(() => profiles.id, { onDelete: "cascade" }),
		targetType: text("target_type").notNull(), // 'release' | 'user' | 'radar_match'
		targetId: text("target_id").notNull(),
		note: text("note"),
		status: text("status").notNull().default("watching"), // 'watching' | 'contacted' | 'dead_end' | 'found'
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		unique().on(table.userId, table.targetType, table.targetId),
		pgPolicy("leads_select_own", {
			for: "select",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("leads_insert_own", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("leads_update_own", {
			for: "update",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
			withCheck: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("leads_delete_own", {
			for: "delete",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
		}),
	],
);

export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type LeadStatus = "watching" | "contacted" | "dead_end" | "found";
export type LeadTargetType = "release" | "user" | "radar_match";
