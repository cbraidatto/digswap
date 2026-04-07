"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import {
	areMutualFriends,
	type ChatMessage,
	type ConversationPreview,
	type Friend,
	getConversations,
	getMessages,
	getMutualFriends,
} from "@/lib/chat/queries";
import { db } from "@/lib/db";
import { directMessages } from "@/lib/db/schema/direct-messages";
import { apiRateLimit, safeLimit } from "@/lib/rate-limit";
import { uuidSchema } from "@/lib/validations/common";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const sendMessageSchema = z.object({
	receiverId: uuidSchema,
	body: z.string().trim().min(1, "Message cannot be empty.").max(2000, "Message is too long."),
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Get all mutual followers (friends) for the current user.
 */
export async function getFriendsAction(): Promise<Friend[]> {
	try {
		const user = await requireUser();
		return getMutualFriends(user.id);
	} catch (err) {
		console.error("[getFriendsAction] error:", err);
		return [];
	}
}

/**
 * Get all conversation previews for the current user.
 */
export async function getConversationsAction(): Promise<ConversationPreview[]> {
	try {
		const user = await requireUser();
		return getConversations(user.id);
	} catch (err) {
		console.error("[getConversationsAction] error:", err);
		return [];
	}
}

/**
 * Get messages in a conversation between the current user and a friend.
 */
export async function getMessagesAction(friendId: string, cursor?: string): Promise<ChatMessage[]> {
	try {
		const user = await requireUser();

		const parsed = uuidSchema.safeParse(friendId);
		if (!parsed.success) return [];

		return getMessages(user.id, parsed.data, cursor);
	} catch (err) {
		console.error("[getMessagesAction] error:", err);
		return [];
	}
}

/**
 * Send a direct message to a mutual follower.
 *
 * Authorization: Both users must follow each other (mutual friends).
 * Rate limited: uses apiRateLimit (30 req/60s per user).
 */
export async function sendMessageAction(input: {
	receiverId: string;
	body: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { success: false, error: "Too many requests. Please wait a moment." };
		}

		const parsed = sendMessageSchema.safeParse(input);
		if (!parsed.success) {
			return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
		}

		if (parsed.data.receiverId === user.id) {
			return { success: false, error: "Cannot send a message to yourself." };
		}

		// Verify mutual follow
		const isFriend = await areMutualFriends(user.id, parsed.data.receiverId);
		if (!isFriend) {
			return { success: false, error: "You can only message mutual followers." };
		}

		const [row] = await db
			.insert(directMessages)
			.values({
				senderId: user.id,
				receiverId: parsed.data.receiverId,
				body: parsed.data.body,
			})
			.returning({ id: directMessages.id });

		if (!row) {
			return { success: false, error: "Failed to send message." };
		}

		return { success: true, messageId: row.id };
	} catch (err) {
		console.error("[sendMessageAction] error:", err);
		return { success: false, error: "Failed to send message. Please try again." };
	}
}
