import { sql } from "drizzle-orm";
import {
	index,
	integer,
	jsonb,
	pgPolicy,
	pgTable,
	real,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { authenticatedRole, supabaseAuthAdminRole } from "drizzle-orm/supabase";

export const releases = pgTable(
	"releases",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		discogsId: integer("discogs_id").unique(),
		youtubeVideoId: varchar("youtube_video_id", { length: 20 }).unique(),
		title: varchar("title", { length: 500 }).notNull(),
		artist: varchar("artist", { length: 500 }).notNull(),
		year: integer("year"),
		genre: text("genre").array(), // Array of genres
		style: text("style").array(), // Array of styles
		country: varchar("country", { length: 100 }),
		format: varchar("format", { length: 100 }), // LP/CD/7"/etc
		label: varchar("label", { length: 500 }),
		coverImageUrl: text("cover_image_url"),
		/** Tracklist from Discogs API: [{position, title, duration}] */
		tracklist: jsonb("tracklist"),
		discogsHave: integer("discogs_have").default(0).notNull(),
		discogsWant: integer("discogs_want").default(0).notNull(),
		rarityScore: real("rarity_score"), // Computed from have/want ratio
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		// GIN indexes for array containment queries (@>, &&) on genre and style.
		// Required for genre leaderboard and explore feed — without GIN these use seq scans.
		index("releases_genre_gin_idx").using("gin", table.genre),
		index("releases_style_gin_idx").using("gin", table.style),
		pgPolicy("releases_select_all", {
			for: "select",
			to: authenticatedRole,
			using: sql`true`, // All authenticated users can view releases
		}),
		pgPolicy("releases_insert_service", {
			for: "insert",
			to: supabaseAuthAdminRole,
			withCheck: sql`true`, // Service role only (import pipeline)
		}),
		pgPolicy("releases_update_service", {
			for: "update",
			to: supabaseAuthAdminRole,
			using: sql`true`,
			withCheck: sql`true`, // Service role only (import pipeline)
		}),
	],
);
