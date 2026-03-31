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
import {
	authenticatedRole,
	authUid,
	supabaseAuthAdminRole,
} from "drizzle-orm/supabase";

export const importJobs = pgTable(
	"import_jobs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id").notNull(),
		type: varchar("type", { length: 20 }).notNull(), // 'collection' | 'wantlist' | 'sync'
		status: varchar("status", { length: 20 }).notNull().default("pending"),
		// 'pending' | 'processing' | 'completed' | 'failed'
		totalItems: integer("total_items").default(0),
		processedItems: integer("processed_items").default(0),
		currentPage: integer("current_page").default(1),
		totalPages: integer("total_pages"),
		currentRecord: text("current_record"), // "Kind of Blue -- Miles Davis"
		errorMessage: text("error_message"),
		startedAt: timestamp("started_at", { withTimezone: true }),
		completedAt: timestamp("completed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		pgPolicy("import_jobs_select_own", {
			for: "select",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("import_jobs_insert_service", {
			for: "insert",
			to: supabaseAuthAdminRole,
			withCheck: sql`true`,
		}),
		pgPolicy("import_jobs_update_service", {
			for: "update",
			to: supabaseAuthAdminRole,
			using: sql`true`,
			withCheck: sql`true`,
		}),
	],
);
