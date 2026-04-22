import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "11111111-1111-4111-8111-111111111111";
const FRIEND_ID = "22222222-2222-4222-8222-222222222222";

let mockAuthUser: { id: string; email?: string } | null = { id: USER_ID };
let mockMutualFriends = true;
let mockInsertResult: { id: string } | null = { id: "msg-001" };

vi.mock("@/lib/auth/require-user", () => ({
	requireUser: vi.fn(async () => {
		if (!mockAuthUser) throw new Error("Not authenticated");
		return mockAuthUser;
	}),
}));

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/chat/queries", () => ({
	getMutualFriends: vi.fn(async () => [{ id: FRIEND_ID, displayName: "Friend" }]),
	getConversations: vi.fn(async () => []),
	getMessages: vi.fn(async () => []),
	areMutualFriends: vi.fn(async () => mockMutualFriends),
}));

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};
	chain.insert = vi.fn().mockImplementation(() => ({
		values: vi.fn().mockImplementation(() => ({
			returning: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) =>
					resolve(mockInsertResult ? [mockInsertResult] : []),
			})),
		})),
	}));
	return { db: chain };
});

vi.mock("@/lib/db/schema/direct-messages", () => ({
	directMessages: {
		id: "id",
		senderId: "sender_id",
		receiverId: "receiver_id",
		body: "body",
	},
}));

const { getFriendsAction, getConversationsAction, getMessagesAction, sendMessageAction } =
	await import("@/actions/chat");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	mockMutualFriends = true;
	mockInsertResult = { id: "msg-001" };
	vi.clearAllMocks();
});

describe("getFriendsAction", () => {
	it("returns friends for authenticated user", async () => {
		const result = await getFriendsAction();
		expect(Array.isArray(result)).toBe(true);
	});

	it("returns empty array when not authenticated", async () => {
		mockAuthUser = null;
		const result = await getFriendsAction();
		expect(result).toEqual([]);
	});
});

describe("getConversationsAction", () => {
	it("returns conversations for authenticated user", async () => {
		const result = await getConversationsAction();
		expect(Array.isArray(result)).toBe(true);
	});
});

describe("getMessagesAction", () => {
	it("returns messages for valid friend ID", async () => {
		const result = await getMessagesAction(FRIEND_ID);
		expect(Array.isArray(result)).toBe(true);
	});

	it("returns empty for invalid friend ID", async () => {
		const result = await getMessagesAction("not-a-uuid");
		expect(result).toEqual([]);
	});
});

describe("sendMessageAction", () => {
	it("sends message to mutual friend", async () => {
		const result = await sendMessageAction({
			receiverId: FRIEND_ID,
			body: "Hello!",
		});
		expect(result.success).toBe(true);
		expect(result.messageId).toBeDefined();
	});

	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await sendMessageAction({
			receiverId: FRIEND_ID,
			body: "Hello!",
		});
		expect(result.success).toBe(false);
	});

	it("rejects sending message to yourself", async () => {
		const result = await sendMessageAction({
			receiverId: USER_ID,
			body: "Hello!",
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("yourself");
	});

	it("rejects when not mutual friends", async () => {
		mockMutualFriends = false;
		const result = await sendMessageAction({
			receiverId: FRIEND_ID,
			body: "Hello!",
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("mutual");
	});

	it("rejects empty message body", async () => {
		const result = await sendMessageAction({
			receiverId: FRIEND_ID,
			body: "",
		});
		expect(result.success).toBe(false);
	});
});
