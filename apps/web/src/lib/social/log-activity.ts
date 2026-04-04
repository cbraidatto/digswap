/**
 * Internal server-only helper for logging user activity to the feed.
 *
 * SECURITY: This file does NOT have "use server" — it cannot be called
 * directly from the client as a server action. Only server actions that
 * have already authenticated the user should call this function, passing
 * the userId from their verified session.
 */

import { db } from "@/lib/db";
import { activityFeed } from "@/lib/db/schema/social";
import { logActivitySchema } from "@/lib/validations/social";

export async function logActivity(
	userId: string,
	actionType: string,
	targetType: string | null,
	targetId: string | null,
	metadata: Record<string, unknown> | null,
): Promise<void> {
	try {
		const parsed = logActivitySchema.safeParse({ userId, actionType, targetType, targetId, metadata });
		if (!parsed.success) {
			return;
		}

		await db.insert(activityFeed).values({
			userId: parsed.data.userId,
			actionType: parsed.data.actionType,
			targetType: parsed.data.targetType,
			targetId: parsed.data.targetId,
			metadata: parsed.data.metadata,
		});
	} catch (err) {
		console.error("[logActivity] error:", err);
		// Non-blocking: activity logging failure should not crash the caller
	}
}
