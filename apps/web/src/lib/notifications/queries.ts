import { db } from "@/lib/db";
import {
	notifications,
	notificationPreferences,
} from "@/lib/db/schema/notifications";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Get the count of unread notifications for a user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
	const result = await db
		.select({ count: count() })
		.from(notifications)
		.where(
			and(
				eq(notifications.userId, userId),
				eq(notifications.read, false),
			),
		);

	return Number(result[0]?.count ?? 0);
}

/**
 * Get recent notifications for a user (for the notification dropdown).
 */
export async function getRecentNotifications(
	userId: string,
	limit = 5,
) {
	return db
		.select()
		.from(notifications)
		.where(eq(notifications.userId, userId))
		.orderBy(desc(notifications.createdAt))
		.limit(limit);
}

/**
 * Get a paginated page of notifications with total count.
 */
export async function getNotificationPage(
	userId: string,
	page = 1,
	pageSize = 20,
) {
	const offset = (Math.max(1, page) - 1) * pageSize;

	const [items, totalResult] = await Promise.all([
		db
			.select()
			.from(notifications)
			.where(eq(notifications.userId, userId))
			.orderBy(desc(notifications.createdAt))
			.limit(pageSize)
			.offset(offset),
		db
			.select({ count: count() })
			.from(notifications)
			.where(eq(notifications.userId, userId)),
	]);

	return {
		items,
		total: Number(totalResult[0]?.count ?? 0),
		page,
		pageSize,
	};
}

/**
 * Get notification preferences for a user.
 * Returns null if no preferences row exists yet.
 */
export async function getPreferences(userId: string) {
	const rows = await db
		.select()
		.from(notificationPreferences)
		.where(eq(notificationPreferences.userId, userId))
		.limit(1);

	return rows[0] ?? null;
}

/**
 * Upsert notification preferences for a user.
 * Uses admin client for atomic insert-if-not-exists.
 */
export async function upsertPreferences(
	userId: string,
	prefs: Partial<{
		wantlistMatchInapp: boolean;
		wantlistMatchEmail: boolean;
		tradeRequestInapp: boolean;
		tradeRequestEmail: boolean;
		tradeCompletedInapp: boolean;
		rankingChangeInapp: boolean;
		newBadgeInapp: boolean;
		pushEnabled: boolean;
	}>,
) {
	const admin = createAdminClient();

	// Map camelCase to snake_case for Supabase
	const snakeCasePrefs: Record<string, unknown> = {};
	if (prefs.wantlistMatchInapp !== undefined)
		snakeCasePrefs.wantlist_match_inapp = prefs.wantlistMatchInapp;
	if (prefs.wantlistMatchEmail !== undefined)
		snakeCasePrefs.wantlist_match_email = prefs.wantlistMatchEmail;
	if (prefs.tradeRequestInapp !== undefined)
		snakeCasePrefs.trade_request_inapp = prefs.tradeRequestInapp;
	if (prefs.tradeRequestEmail !== undefined)
		snakeCasePrefs.trade_request_email = prefs.tradeRequestEmail;
	if (prefs.tradeCompletedInapp !== undefined)
		snakeCasePrefs.trade_completed_inapp = prefs.tradeCompletedInapp;
	if (prefs.rankingChangeInapp !== undefined)
		snakeCasePrefs.ranking_change_inapp = prefs.rankingChangeInapp;
	if (prefs.newBadgeInapp !== undefined)
		snakeCasePrefs.new_badge_inapp = prefs.newBadgeInapp;
	if (prefs.pushEnabled !== undefined)
		snakeCasePrefs.push_enabled = prefs.pushEnabled;

	const { data, error } = await admin
		.from("notification_preferences")
		.upsert(
			{
				user_id: userId,
				...snakeCasePrefs,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "user_id" },
		)
		.select()
		.single();

	if (error) {
		throw new Error(`Failed to upsert preferences: ${error.message}`);
	}

	return data;
}
