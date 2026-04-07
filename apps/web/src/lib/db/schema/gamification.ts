import { sql } from "drizzle-orm";
import {
	integer,
	pgPolicy,
	pgTable,
	real,
	text,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { authenticatedRole, supabaseAuthAdminRole } from "drizzle-orm/supabase";

export const userRankings = pgTable(
	"user_rankings",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id").notNull().unique(),
		rarityScore: real("rarity_score").default(0).notNull(),
		contributionScore: real("contribution_score").default(0).notNull(),
		globalRank: integer("global_rank"),
		title: varchar("title", { length: 100 }), // "Crate Digger"/"Wax Prophet"/etc
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(_table) => [
		pgPolicy("user_rankings_select_all", {
			for: "select",
			to: authenticatedRole,
			using: sql`true`, // All authenticated users can view rankings
		}),
		pgPolicy("user_rankings_insert_service", {
			for: "insert",
			to: supabaseAuthAdminRole,
			withCheck: sql`true`, // Service role only (gamification system manages rankings)
		}),
	],
);

export const badges = pgTable(
	"badges",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		slug: varchar("slug", { length: 100 }).unique().notNull(),
		name: varchar("name", { length: 200 }).notNull(),
		description: text("description"),
		iconUrl: text("icon_url"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	() => [
		pgPolicy("badges_select_all", {
			for: "select",
			to: authenticatedRole,
			using: sql`true`, // All authenticated users can view badges
		}),
	],
);

export const userBadges = pgTable(
	"user_badges",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id").notNull(),
		badgeId: uuid("badge_id")
			.references(() => badges.id)
			.notNull(),
		earnedAt: timestamp("earned_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		unique("user_badges_user_badge_unique").on(table.userId, table.badgeId),
		pgPolicy("user_badges_select_all", {
			for: "select",
			to: authenticatedRole,
			using: sql`true`, // All authenticated users can view earned badges
		}),
		pgPolicy("user_badges_insert_service", {
			for: "insert",
			to: supabaseAuthAdminRole,
			withCheck: sql`true`, // Service role only (gamification system awards badges)
		}),
	],
);
