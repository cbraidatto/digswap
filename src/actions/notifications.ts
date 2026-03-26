"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
	getUnreadCount,
	getRecentNotifications,
	getNotificationPage,
	getPreferences,
	upsertPreferences,
} from "@/lib/notifications/queries";

/**
 * Get a page of notifications for the current user.
 */
export async function getNotificationsAction(page = 1) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	return getNotificationPage(user.id, page);
}

/**
 * Get the unread notification count for the current user.
 */
export async function getUnreadCountAction(): Promise<number> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	return getUnreadCount(user.id);
}

/**
 * Mark a single notification as read.
 * Includes ownership check -- user can only mark their own notifications.
 */
export async function markNotificationRead(
	notificationId: string,
): Promise<{ success?: boolean; error?: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	const admin = createAdminClient();

	const { data, error } = await admin
		.from("notifications")
		.update({ read: true })
		.eq("id", notificationId)
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
}

/**
 * Mark all unread notifications as read for the current user.
 */
export async function markAllRead(): Promise<{
	success?: boolean;
	error?: string;
}> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
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
}

/**
 * Get notification preferences for the current user.
 * Lazy-creates default preferences row if none exists (per D-18).
 */
export async function getPreferencesAction() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
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
		throw new Error("Could not create notification preferences.");
	}

	return created;
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
}) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	return upsertPreferences(user.id, prefs);
}
