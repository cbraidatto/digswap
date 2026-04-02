import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema/subscriptions";
import type { SubscriptionPlan } from "@/lib/stripe";

export type { SubscriptionPlan };

export const FREE_TRADE_LIMIT = 5;

export type TradeEntitlementReason = "no_limit" | "under_limit" | "limit_reached";

export interface UserSubscriptionSnapshot {
	plan: SubscriptionPlan;
	status: string;
	tradesMonthReset: Date | null;
	tradesThisMonth: number;
}

export interface TradeEntitlementResult {
	allowed: boolean;
	reason: TradeEntitlementReason;
	tradesLimit: number | null;
	tradesUsed: number;
}

export interface QuotaStatus {
	isPremium: boolean;
	percentUsed: number | null;
	plan: SubscriptionPlan;
	tradesLimit: number | null;
	tradesUsed: number;
}

function isResetExpired(tradesMonthReset: Date | null, now: Date) {
	if (!tradesMonthReset) {
		return true;
	}

	const resetCutoff = new Date(tradesMonthReset.getTime() + 30 * 24 * 60 * 60 * 1000);
	return now > resetCutoff;
}

/** Statuses that grant premium access */
const PREMIUM_ACTIVE_STATUSES = new Set(["active", "trialing"]);

export function isPremium(plan: SubscriptionPlan, status?: string): boolean {
	const isPremiumPlan = plan === "premium_monthly" || plan === "premium_annual";
	if (!isPremiumPlan) return false;
	// If status is provided, it must be in the allowed set
	if (status !== undefined) return PREMIUM_ACTIVE_STATUSES.has(status);
	return true; // Backwards compat: no status = trust the plan
}

async function readSubscriptionRow(userId: string) {
	const rows = await db
		.select({
			plan: subscriptions.plan,
			status: subscriptions.status,
			tradesMonthReset: subscriptions.tradesMonthReset,
			tradesThisMonth: subscriptions.tradesThisMonth,
			userId: subscriptions.userId,
		})
		.from(subscriptions)
		.where(eq(subscriptions.userId, userId))
		.limit(1);

	return rows[0] ?? null;
}

async function resetTradeWindow(userId: string, now: Date) {
	await db
		.update(subscriptions)
		.set({
			tradesMonthReset: now,
			tradesThisMonth: 0,
			updatedAt: now,
		})
		.where(eq(subscriptions.userId, userId));
}

export async function getUserSubscription(
	userId: string,
): Promise<UserSubscriptionSnapshot | null> {
	const row = await readSubscriptionRow(userId);
	if (!row) {
		return null;
	}

	const plan = (row.plan ?? "free") as SubscriptionPlan;
	const status = row.status ?? "active";
	const now = new Date();
	const tradesMonthReset =
		row.tradesMonthReset instanceof Date
			? row.tradesMonthReset
			: row.tradesMonthReset
				? new Date(row.tradesMonthReset)
				: null;

	if (isResetExpired(tradesMonthReset, now)) {
		await resetTradeWindow(userId, now);
		return {
			plan,
			status,
			tradesMonthReset: now,
			tradesThisMonth: 0,
		};
	}

	return {
		plan,
		status,
		tradesMonthReset,
		tradesThisMonth: row.tradesThisMonth ?? 0,
	};
}

export async function canInitiateTrade(userId: string): Promise<TradeEntitlementResult> {
	const subscription = await getUserSubscription(userId);
	const plan = subscription?.plan ?? "free";
	const status = subscription?.status ?? "active";
	const tradesUsed = subscription?.tradesThisMonth ?? 0;

	if (isPremium(plan, status)) {
		return {
			allowed: true,
			reason: "no_limit",
			tradesLimit: null,
			tradesUsed,
		};
	}

	if (tradesUsed >= FREE_TRADE_LIMIT) {
		return {
			allowed: false,
			reason: "limit_reached",
			tradesLimit: FREE_TRADE_LIMIT,
			tradesUsed,
		};
	}

	return {
		allowed: true,
		reason: "under_limit",
		tradesLimit: FREE_TRADE_LIMIT,
		tradesUsed,
	};
}

export async function incrementTradeCount(userId: string): Promise<void> {
	const subscription = await getUserSubscription(userId);
	const plan = subscription?.plan ?? "free";
	const status = subscription?.status ?? "active";

	if (isPremium(plan, status)) {
		return;
	}

	const now = new Date();
	const shouldInitializeReset = !subscription?.tradesMonthReset;
	await db
		.update(subscriptions)
		.set({
			tradesMonthReset: shouldInitializeReset ? now : subscription.tradesMonthReset,
			tradesThisMonth: sql`${subscriptions.tradesThisMonth} + 1`,
			updatedAt: now,
		})
		.where(eq(subscriptions.userId, userId));
}

export async function getQuotaStatus(userId: string): Promise<QuotaStatus> {
	const subscription = await getUserSubscription(userId);
	const plan = subscription?.plan ?? "free";
	const status = subscription?.status ?? "active";
	const premium = isPremium(plan, status);
	const tradesUsed = subscription?.tradesThisMonth ?? 0;
	const tradesLimit = premium ? null : FREE_TRADE_LIMIT;

	return {
		isPremium: premium,
		percentUsed: tradesLimit ? Math.min(Math.round((tradesUsed / tradesLimit) * 100), 100) : null,
		plan,
		tradesLimit,
		tradesUsed,
	};
}
