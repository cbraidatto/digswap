import { sql } from "drizzle-orm";
import { integer, pgPolicy, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, serviceRole } from "drizzle-orm/supabase";

export const subscriptions = pgTable(
	"subscriptions",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: uuid("user_id").notNull().unique(),
		stripeCustomerId: text("stripe_customer_id").unique(),
		stripeSubscriptionId: text("stripe_subscription_id").unique(),
		status: varchar("status", { length: 50 }).default("active").notNull(), // active/cancelled/past_due/etc
		plan: varchar("plan", { length: 50 }).default("free").notNull(), // free/premium_monthly/premium_annual
		currentPeriodStart: timestamp("current_period_start", {
			withTimezone: true,
		}),
		currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
		tradesThisMonth: integer("trades_this_month").default(0).notNull(),
		tradesMonthReset: timestamp("trades_month_reset", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		pgPolicy("subscriptions_select_own", {
			for: "select",
			to: authenticatedRole,
			using: sql`${table.userId} = ${authUid}`,
		}),
		pgPolicy("subscriptions_insert_service", {
			for: "insert",
			to: serviceRole,
			withCheck: sql`true`, // Service role only (webhook-driven)
		}),
		pgPolicy("subscriptions_update_service", {
			for: "update",
			to: serviceRole,
			using: sql`true`,
			withCheck: sql`true`, // Service role only (webhook-driven)
		}),
	],
);
