import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";
import { releases } from "./releases";
import { reviews } from "./reviews";

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    creatorId: uuid("creator_id").notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    slug: varchar("slug", { length: 250 }).unique().notNull(),
    description: text("description"),
    category: varchar("category", { length: 100 }), // genre/era/region/style
    visibility: varchar("visibility", { length: 20 }).default("public").notNull(),
    memberCount: integer("member_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("groups_select_all", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`, // All authenticated users can view groups
    }),
    pgPolicy("groups_insert_authenticated", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.creatorId} = ${authUid}`,
    }),
    pgPolicy("groups_update_creator", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.creatorId} = ${authUid}`,
      withCheck: sql`${table.creatorId} = ${authUid}`,
    }),
    pgPolicy("groups_delete_creator", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.creatorId} = ${authUid}`,
    }),
  ],
);

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .references(() => groups.id)
      .notNull(),
    userId: uuid("user_id").notNull(),
    role: varchar("role", { length: 20 }).default("member").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("group_members_select_all", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`, // All authenticated users can see group members
    }),
    pgPolicy("group_members_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("group_members_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("group_members_update_admin_only", {
      for: "update",
      to: authenticatedRole,
      using: sql`
        EXISTS (
          SELECT 1 FROM group_members admin_check
          WHERE admin_check.group_id = ${table.groupId}
            AND admin_check.user_id = ${authUid}
            AND admin_check.role = 'admin'
        )
      `,
      withCheck: sql`${table.groupId} = group_id`,
    }),
  ],
);

export const groupPosts = pgTable(
  "group_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    groupId: uuid("group_id")
      .references(() => groups.id)
      .notNull(),
    userId: uuid("user_id").notNull(),
    content: text("content").notNull(),
    releaseId: uuid("release_id").references(() => releases.id),
    reviewId: uuid("review_id").references(() => reviews.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("group_posts_select_member", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.groupId} IN (SELECT group_id FROM group_members WHERE user_id = ${authUid})`,
    }),
    pgPolicy("group_posts_insert_member", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}
        AND ${table.groupId} IN (SELECT group_id FROM group_members WHERE user_id = ${authUid})`,
    }),
    pgPolicy("group_posts_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("group_posts_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
  ],
);
