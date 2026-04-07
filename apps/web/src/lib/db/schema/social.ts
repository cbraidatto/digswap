import { sql } from "drizzle-orm";
import {
	index,
	jsonb,
	pgPolicy,
	pgTable,
	timestamp,
	unique,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";

export const follows = pgTable(
	"follows",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		followerId: uuid("follower_id").notNull(),
		followingId: uuid("following_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		unique("follows_unique_pair").on(table.followerId, table.followingId),
		pgPolicy("follows_select_all", {
			for: "select",
			to: authenticatedRole,
			using: sql`true`, // All authenticated users can view follows
		}),
		pgPolicy("follows_insert_own", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.followerId} = ${authUid}`,
		}),
		pgPolicy("follows_delete_own", {
			for: "delete",
			to: authenticatedRole,
			using: sql`${table.followerId} = ${authUid}`,
		}),
	],
);

export const activityFeed = pgTable(
	"activity_feed",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id").notNull(),
		actionType: varchar("action_type", { length: 50 }).notNull(), // "added_record"/"wrote_review"/"completed_trade"/etc
		targetType: varchar("target_type", { length: 50 }),
		targetId: uuid("target_id"),
		metadata: jsonb("metadata"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("activity_feed_select_own", {
			for: "select",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("activity_feed_insert_own", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.userId} = ${authUid}`,
		}),
		index("activity_feed_user_id_idx").on(table.userId),
		index("activity_feed_created_at_idx").on(table.createdAt),
	],
);
