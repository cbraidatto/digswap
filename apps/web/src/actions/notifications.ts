"use server";

import {
	getNotificationPage,
	getPreferences,
	getRecentNotifications,
	getUnreadCount,
	upsertPreferences,
} from "@/lib/notifications/queries";
import { apiRateLimit, safeLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
	notificationIdSchema,
	notificationPageSchema,
	recentNotificationsSchema,
	updatePreferencesSchema,
} from "@/lib/validations/notifications";

/**
 * Get a page of notifications for the current user.
 */
export async function getNotificationsAction(page = 1) {
	try {
		const parsed = notificationPageSchema.safeParse({ page });
		if (!parsed.success) {
			return { items: [], total: 0, page: 1, pageSize: 20 };
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { items: [], total: 0, page: 1, pageSize: 20 };
		}

		return getNotificationPage(user.id, parsed.data.page);
	} catch (err) {
		console.error("[getNotificationsAction] error:", err);
		return { items: [], total: 0, page: 1, pageSize: 20 };
	}
}

/**
 * Get recent notifications for the current user (for dropdown display).
 */
export async function getRecentNotificationsAction(limit = 5) {
	try {
		const parsed = recentNotificationsSchema.safeParse({ limit });
		if (!parsed.success) {
			return [];
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return [];
		}

		return getRecentNotifications(user.id, parsed.data.limit);
	} catch (err) {
		console.error("[getRecentNotificationsAction] error:", err);
		return [];
	}
}

/**
 * Get the unread notification count for the current user.
 */
export async function getUnreadCountAction(): Promise<number> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return 0;
		}

		return getUnreadCount(user.id);
	} catch (err) {
		console.error("[getUnreadCountAction] error:", err);
		return 0;
	}
}

/**
 * Mark a single notification as read.
 * Includes ownership check -- user can only mark their own notifications.
 */
export async function markNotificationRead(
	notificationId: string,
): Promise<{ success?: boolean; error?: string }> {
	try {
		const parsed = notificationIdSchema.safeParse({ notificationId });
		if (!parsed.success) {
			return { error: "Invalid notification ID" };
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { error: "Not authenticated" };
		}

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const admin = createAdminClient();

		const { data, error } = await admin
			.from("notifications")
			.update({ read: true })
			.eq("id", parsed.data.notificationId)
			.eq("user_id", user.id) // Ownership check
			.select("id")
			.maybeSingle();

		if (error) {
			return { error: "Could not mark notification as read." };
		}

		if (!data) {
			return { error: "Notification not found." };
		}

		return { success: true };
	} catch (err) {
		console.error("[markNotificationRead] error:", err);
		return { error: "Failed to mark notification as read." };
	}
}

/**
 * Mark all unread notifications as read for the current user.
 */
export async function markAllRead(): Promise<{
	success?: boolean;
	error?: string;
}> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { error: "Not authenticated" };
		}

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const admin = createAdminClient();

		const { error } = await admin
			.from("notifications")
			.update({ read: true })
			.eq("user_id", user.id)
			.eq("read", false);

		if (error) {
			return { error: "Could not mark notifications as read." };
		}

		return { success: true };
	} catch (err) {
		console.error("[markAllRead] error:", err);
		return { error: "Failed to mark notifications as read." };
	}
}

/**
 * Get notification preferences for the current user.
 * Lazy-creates default preferences row if none exists (per D-18).
 */
export async function getPreferencesAction() {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return null;
		}

		const existing = await getPreferences(user.id);
		if (existing) {
			return existing;
		}

		// Lazy-create defaults
		const admin = createAdminClient();
		const { data: created, error } = await admin
			.from("notification_preferences")
			.insert({
				user_id: user.id,
			})
			.select()
			.single();

		if (error) {
			console.error("[getPreferencesAction] create defaults error:", error);
			return null;
		}

		return created;
	} catch (err) {
		console.error("[getPreferencesAction] error:", err);
		return null;
	}
}

/**
 * Update notification preferences for the current user.
 */
export async function updatePreferencesAction(prefs: {
	wantlistMatchInapp?: boolean;
	wantlistMatchEmail?: boolean;
	tradeRequestInapp?: boolean;
	tradeRequestEmail?: boolean;
	tradeCompletedInapp?: boolean;
	rankingChangeInapp?: boolean;
	newBadgeInapp?: boolean;
	pushEnabled?: boolean;
}): Promise<{ success?: boolean; error?: string }> {
	try {
		const parsed = updatePreferencesSchema.safeParse(prefs);
		if (!parsed.success) {
			return { error: "Invalid preferences data" };
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { error: "Not authenticated" };
		}

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		await upsertPreferences(user.id, prefs);
		return { success: true };
	} catch (err) {
		console.error("[updatePreferencesAction] error:", err);
		return { error: "Failed to update preferences. Please try again." };
	}
}
