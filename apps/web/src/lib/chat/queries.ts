import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { directMessages } from "@/lib/db/schema/direct-messages";
import { follows } from "@/lib/db/schema/social";
import { profiles } from "@/lib/db/schema/users";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Friend {
	id: string;
	username: string | null;
	displayName: string | null;
	avatarUrl: string | null;
}

export interface ConversationPreview {
	friendId: string;
	friendUsername: string | null;
	friendDisplayName: string | null;
	friendAvatarUrl: string | null;
	lastMessageBody: string;
	lastMessageAt: string;
	lastMessageSenderId: string;
}

export interface ChatMessage {
	id: string;
	senderId: string;
	body: string;
	createdAt: string;
	isOwn: boolean;
}

// ---------------------------------------------------------------------------
// Mutual friends — both users follow each other
// ---------------------------------------------------------------------------

/**
 * Get all mutual followers for a user (A follows B AND B follows A).
 * Returns profiles sorted alphabetically by username.
 */
export async function getMutualFriends(userId: string): Promise<Friend[]> {
	const rows = await db
		.select({
			id: profiles.id,
			username: profiles.username,
			displayName: profiles.displayName,
			avatarUrl: profiles.avatarUrl,
		})
		.from(follows)
		.innerJoin(
			db
				.select({
					followerId: follows.followerId,
					followingId: follows.followingId,
				})
				.from(follows)
				.where(eq(follows.followingId, userId))
				.as("reverse"),
			and(
				sql`${follows.followingId} = "reverse"."follower_id"`,
				sql`${follows.followerId} = "reverse"."following_id"`,
			),
		)
		.innerJoin(profiles, eq(profiles.id, follows.followingId))
		.where(eq(follows.followerId, userId));

	return rows;
}

/**
 * Check if two users are mutual followers.
 */
export async function areMutualFriends(userA: string, userB: string): Promise<boolean> {
	const [forward] = await db
		.select({ id: follows.id })
		.from(follows)
		.where(and(eq(follows.followerId, userA), eq(follows.followingId, userB)))
		.limit(1);

	if (!forward) return false;

	const [reverse] = await db
		.select({ id: follows.id })
		.from(follows)
		.where(and(eq(follows.followerId, userB), eq(follows.followingId, userA)))
		.limit(1);

	return !!reverse;
}

// ---------------------------------------------------------------------------
// Conversations — list of recent DM threads
// ---------------------------------------------------------------------------

/**
 * Get a preview of all conversations for a user, sorted by most recent message.
 * Uses a lateral join pattern to get the last message per conversation partner.
 */
export async function getConversations(userId: string): Promise<ConversationPreview[]> {
	// Get all distinct conversation partners
	const partners = await db.execute(sql`
		SELECT DISTINCT
			CASE
				WHEN sender_id = ${userId} THEN receiver_id
				ELSE sender_id
			END AS friend_id
		FROM direct_messages
		WHERE sender_id = ${userId} OR receiver_id = ${userId}
	`);

	const rows = partners as unknown as { friend_id: string }[];
	if (!rows || rows.length === 0) return [];

	const friendIds = rows.map((r) => r.friend_id);

	// For each friend, get the latest message + profile
	const conversations: ConversationPreview[] = [];

	for (const friendId of friendIds) {
		const [lastMsg] = await db
			.select({
				body: directMessages.body,
				createdAt: directMessages.createdAt,
				senderId: directMessages.senderId,
			})
			.from(directMessages)
			.where(
				or(
					and(eq(directMessages.senderId, userId), eq(directMessages.receiverId, friendId)),
					and(eq(directMessages.senderId, friendId), eq(directMessages.receiverId, userId)),
				),
			)
			.orderBy(desc(directMessages.createdAt))
			.limit(1);

		if (!lastMsg) continue;

		const [friend] = await db
			.select({
				username: profiles.username,
				displayName: profiles.displayName,
				avatarUrl: profiles.avatarUrl,
			})
			.from(profiles)
			.where(eq(profiles.id, friendId))
			.limit(1);

		conversations.push({
			friendId,
			friendUsername: friend?.username ?? null,
			friendDisplayName: friend?.displayName ?? null,
			friendAvatarUrl: friend?.avatarUrl ?? null,
			lastMessageBody: lastMsg.body,
			lastMessageAt: lastMsg.createdAt.toISOString(),
			lastMessageSenderId: lastMsg.senderId,
		});
	}

	// Sort by most recent message
	conversations.sort(
		(a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
	);

	return conversations;
}

// ---------------------------------------------------------------------------
// Messages — load a thread between two users
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

/**
 * Get messages between the current user and a friend, ordered oldest-first.
 * Supports cursor-based pagination for loading older messages.
 */
export async function getMessages(
	userId: string,
	friendId: string,
	cursor?: string,
): Promise<ChatMessage[]> {
	const conditions = [
		or(
			and(eq(directMessages.senderId, userId), eq(directMessages.receiverId, friendId)),
			and(eq(directMessages.senderId, friendId), eq(directMessages.receiverId, userId)),
		)!,
	];

	if (cursor) {
		conditions.push(lt(directMessages.createdAt, new Date(cursor)));
	}

	const rows = await db
		.select({
			id: directMessages.id,
			senderId: directMessages.senderId,
			body: directMessages.body,
			createdAt: directMessages.createdAt,
		})
		.from(directMessages)
		.where(and(...conditions))
		.orderBy(desc(directMessages.createdAt))
		.limit(PAGE_SIZE);

	// Reverse to get oldest-first for display
	return rows.reverse().map((row) => ({
		id: row.id,
		senderId: row.senderId,
		body: row.body,
		createdAt: row.createdAt.toISOString(),
		isOwn: row.senderId === userId,
	}));
}
