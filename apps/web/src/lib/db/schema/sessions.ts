import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";

// Custom session tracking table (D-13: max 3 simultaneous sessions)
export const userSessions = pgTable(
	"user_sessions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id").notNull(),
		sessionId: text("session_id").notNull().unique(), // Supabase session ID
		deviceInfo: text("device_info"), // User-Agent string
		ipAddress: text("ip_address"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("user_sessions_select_own", {
			for: "select",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("user_sessions_insert_authenticated", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("user_sessions_delete_own", {
			for: "delete",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
		}),
	],
);

// Backup codes for 2FA recovery (AUTH-06)
export const backupCodes = pgTable(
	"backup_codes",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id").notNull(),
		codeHash: text("code_hash").notNull(), // bcrypt hash of recovery code
		used: boolean("used").default(false).notNull(),
		usedAt: timestamp("used_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("backup_codes_select_own", {
			for: "select",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("backup_codes_update_own", {
			for: "update",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
			withCheck: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("backup_codes_insert_authenticated", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.userId} = ${authUid}`,
		}),
		// No DELETE policy -- codes are invalidated (used=true), not deleted
	],
);
