import {
	pgTable,
	uuid,
	timestamp,
	unique,
	integer,
	varchar,
	text,
	real,
	jsonb,
	index,
} from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";

// ── "Dig!" reactions on feed items ─────────────────────────
export const digs = pgTable(
	"digs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id").notNull(),
		feedItemId: uuid("feed_item_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		unique("digs_user_feed_item").on(table.userId, table.feedItemId),
		pgPolicy("digs_select_all", {
			for: "select",
			to: authenticatedRole,
			using: sql`true`,
		}),
		pgPolicy("digs_insert_own", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("digs_delete_own", {
			for: "delete",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
		}),
	],
);

// ── Dig Challenges ─────────────────────────────────────────
export const challenges = pgTable(
	"challenges",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		title: varchar("title", { length: 200 }).notNull(),
		description: text("description"),
		type: varchar("type", { length: 50 }).notNull(), // "genre_dive" | "decade_dig" | "label_hunt" | "country_quest"
		criteria: jsonb("criteria").notNull(), // { genre: "Jazz", count: 5 } or { decade: "1970", count: 3 }
		startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
		endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	() => [
		pgPolicy("challenges_select_all", {
			for: "select",
			to: authenticatedRole,
			using: sql`true`,
		}),
	],
);

export const challengeEntries = pgTable(
	"challenge_entries",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		challengeId: uuid("challenge_id").notNull(),
		userId: uuid("user_id").notNull(),
		progress: integer("progress").default(0).notNull(),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		joinedAt: timestamp("joined_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		unique("challenge_entries_user_challenge").on(
			table.userId,
			table.challengeId,
		),
		pgPolicy("challenge_entries_select_all", {
			for: "select",
			to: authenticatedRole,
			using: sql`true`,
		}),
		pgPolicy("challenge_entries_insert_own", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("challenge_entries_update_own", {
			for: "update",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
			withCheck: sql`${table.userId} = ${authUid}`,
		}),
		index("challenge_entries_challenge_id_idx").on(table.challengeId),
	],
);

// ── Digger DNA (computed taste profile) ────────────────────
export const diggerDna = pgTable(
	"digger_dna",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id").notNull().unique(),
		topGenres: jsonb("top_genres").$type<{ name: string; percentage: number }[]>().notNull(),
		topDecades: jsonb("top_decades").$type<{ decade: string; percentage: number }[]>().notNull(),
		topCountries: jsonb("top_countries").$type<{ name: string; count: number }[]>().notNull(),
		rarityProfile: varchar("rarity_profile", { length: 50 }).notNull(), // "deep_cutter" | "mainstream_maven" | "balanced_digger" | "ultra_rare_hunter"
		avgRarity: real("avg_rarity").default(0).notNull(),
		totalRecords: integer("total_records").default(0).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		pgPolicy("digger_dna_select_all", {
			for: "select",
			to: authenticatedRole,
			using: sql`true`,
		}),
		pgPolicy("digger_dna_upsert_own", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("digger_dna_update_own", {
			for: "update",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
		}),
	],
);
