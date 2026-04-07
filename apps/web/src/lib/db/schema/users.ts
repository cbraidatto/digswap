import { sql } from "drizzle-orm";
import {
	boolean,
	jsonb,
	pgPolicy,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";

export const profiles = pgTable(
	"profiles",
	{
		id: uuid("id").primaryKey(), // References auth.users.id
		displayName: varchar("display_name", { length: 50 }),
		username: varchar("username", { length: 30 }).unique(),
		avatarUrl: text("avatar_url"),
		coverUrl: text("cover_url"),
		coverPositionY: text("cover_position_y").default("50").notNull(),
		bio: text("bio"),
		location: varchar("location", { length: 100 }),
		discogsUsername: varchar("discogs_username", { length: 100 }),
		discogsConnected: boolean("discogs_connected").default(false).notNull(),
		lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
		onboardingCompleted: boolean("onboarding_completed").default(false).notNull(),
		showcaseSearchingId: uuid("showcase_searching_id"),
		showcaseRarestId: uuid("showcase_rarest_id"),
		showcaseFavoriteId: uuid("showcase_favorite_id"),
		youtubeUrl: text("youtube_url"),
		instagramUrl: text("instagram_url"),
		soundcloudUrl: text("soundcloud_url"),
		discogsUrl: text("discogs_url"),
		beatportUrl: text("beatport_url"),
		tradesTosAcceptedAt: timestamp("trades_tos_accepted_at", { withTimezone: true }),
		holyGrailIds: jsonb("holy_grail_ids").$type<string[]>().default([]),
		twoFactorEnabled: boolean("two_factor_enabled").default(false).notNull(),
		subscriptionTier: varchar("subscription_tier", { length: 20 }).default("free").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("profiles_select_policy", {
			for: "select",
			to: authenticatedRole,
			using: sql`true`, // All authenticated users can view profiles
		}),
		pgPolicy("profiles_update_own", {
			for: "update",
			to: authenticatedRole,
			using: sql`${table.id} = ${authUid}`,
			withCheck: sql`${table.id} = ${authUid}`,
		}),
		pgPolicy("profiles_insert_own", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.id} = ${authUid}`,
		}),
		pgPolicy("profiles_delete_own", {
			for: "delete",
			to: authenticatedRole,
			using: sql`${table.id} = ${authUid}`,
		}),
	],
);
