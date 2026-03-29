import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  date,
  check,
} from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";
import { releases } from "./releases";

// ---------------------------------------------------------------------------
// crates — a named digging session or event prep list
// ---------------------------------------------------------------------------
export const crates = pgTable(
  "crates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 100 }).notNull(),
    date: date("date").default(sql`CURRENT_DATE`),
    sessionType: varchar("session_type", { length: 20 })
      .notNull()
      .default("digging_trip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "crates_session_type_check",
      sql`${table.sessionType} IN ('digging_trip','event_prep','wish_list','other')`,
    ),
    pgPolicy("crates_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("crates_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("crates_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("crates_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
  ],
);

// ---------------------------------------------------------------------------
// crate_items — individual records added to a crate
// ---------------------------------------------------------------------------
export const crateItems = pgTable(
  "crate_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    crateId: uuid("crate_id")
      .notNull()
      .references(() => crates.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(), // denormalized for RLS
    releaseId: uuid("release_id").references(() => releases.id), // nullable
    discogsId: integer("discogs_id"), // nullable snapshot
    title: varchar("title", { length: 255 }), // nullable snapshot
    artist: varchar("artist", { length: 255 }), // nullable snapshot
    coverImageUrl: text("cover_image_url"), // nullable snapshot
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "crate_items_status_check",
      sql`${table.status} IN ('active','found')`,
    ),
    pgPolicy("crate_items_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("crate_items_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("crate_items_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("crate_items_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
  ],
);

// ---------------------------------------------------------------------------
// sets — a set (played track sequence) that belongs to a crate
// ---------------------------------------------------------------------------
export const sets = pgTable(
  "sets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    crateId: uuid("crate_id")
      .notNull()
      .references(() => crates.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(), // denormalized for RLS
    eventDate: date("event_date"), // nullable
    venueName: varchar("venue_name", { length: 200 }), // nullable
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("sets_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("sets_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("sets_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("sets_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
  ],
);

// ---------------------------------------------------------------------------
// set_tracks — ordered tracks within a set
// ---------------------------------------------------------------------------
export const setTracks = pgTable(
  "set_tracks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    setId: uuid("set_id")
      .notNull()
      .references(() => sets.id, { onDelete: "cascade" }),
    crateItemId: uuid("crate_item_id")
      .notNull()
      .references(() => crateItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull(), // denormalized for RLS
    position: integer("position").notNull(), // 1-based, contiguous, recomputed on save
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    pgPolicy("set_tracks_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("set_tracks_insert_own", {
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("set_tracks_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
      withCheck: sql`${table.userId} = ${authUid}`,
    }),
    pgPolicy("set_tracks_delete_own", {
      for: "delete",
      to: authenticatedRole,
      using: sql`${table.userId} = ${authUid}`,
    }),
  ],
);
