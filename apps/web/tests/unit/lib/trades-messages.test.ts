import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const TRADE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_A = "user-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_B = "user-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

let selectResults: unknown[][] = [];
let queryCallCount = 0;

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = [
		"select", "selectDistinctOn", "from", "where", "orderBy",
		"limit", "offset", "innerJoin", "leftJoin",
	];
	for (const m of methods) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}

	chain.then = (resolve: (v: unknown) => void) => {
		const result = selectResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};

	chain.execute = vi.fn().mockImplementation(() => ({
		then: (resolve: (v: unknown) => void) => {
			const result = selectResults[queryCallCount] ?? [];
			queryCallCount++;
			return resolve(result);
		},
	}));

	return { db: chain };
});

vi.mock("@/lib/db/schema/trades", () => ({
	tradeRequests: {
		id: "id",
		requesterId: "requester_id",
		providerId: "provider_id",
		status: "status",
		createdAt: "created_at",
		updatedAt: "updated_at",
		requesterLastReadAt: "requester_last_read_at",
		providerLastReadAt: "provider_last_read_at",
	},
	tradeMessages: {
		id: "id",
		tradeId: "trade_id",
		senderId: "sender_id",
		kind: "kind",
		body: "body",
		createdAt: "created_at",
	},
}));

vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		id: "id",
		username: "username",
		avatarUrl: "avatar_url",
		displayName: "display_name",
		discogsConnected: "discogs_connected",
	},
}));

vi.mock("@/lib/db/schema/social", () => ({
	follows: { id: "id", followerId: "follower_id", followingId: "following_id", createdAt: "created_at" },
	activityFeed: { id: "id" },
}));

vi.mock("@/lib/db/schema/groups", () => ({
	groupMembers: { groupId: "group_id", userId: "user_id" },
}));

const { getTradeParticipantContext, getTradeUnreadCount } =
	await import("@/lib/trades/messages");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tradeRow(overrides?: Record<string, unknown>) {
	return {
		id: TRADE_ID,
		requesterId: USER_A,
		providerId: USER_B,
		status: "pending",
		createdAt: new Date("2024-06-01T00:00:00Z"),
		updatedAt: new Date("2024-06-01T00:00:00Z"),
		requesterLastReadAt: null,
		providerLastReadAt: null,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("getTradeParticipantContext", () => {
	it("returns context for requester", async () => {
		selectResults = [[tradeRow()]];

		const ctx = await getTradeParticipantContext(TRADE_ID, USER_A);
		expect(ctx).not.toBeNull();
		expect(ctx!.isRequester).toBe(true);
		expect(ctx!.counterpartyId).toBe(USER_B);
		expect(ctx!.tradeId).toBe(TRADE_ID);
		expect(ctx!.status).toBe("pending");
	});

	it("returns context for provider", async () => {
		selectResults = [[tradeRow()]];

		const ctx = await getTradeParticipantContext(TRADE_ID, USER_B);
		expect(ctx).not.toBeNull();
		expect(ctx!.isRequester).toBe(false);
		expect(ctx!.counterpartyId).toBe(USER_A);
	});

	it("returns null when trade not found", async () => {
		selectResults = [[]];

		const ctx = await getTradeParticipantContext(TRADE_ID, USER_A);
		expect(ctx).toBeNull();
	});

	it("includes lastReadAt when set for requester", async () => {
		const readAt = new Date("2024-06-02T12:00:00Z");
		selectResults = [[tradeRow({ requesterLastReadAt: readAt })]];

		const ctx = await getTradeParticipantContext(TRADE_ID, USER_A);
		expect(ctx!.lastReadAt).toBe(readAt.toISOString());
	});

	it("includes lastReadAt when set for provider", async () => {
		const readAt = new Date("2024-06-02T12:00:00Z");
		selectResults = [[tradeRow({ providerLastReadAt: readAt })]];

		const ctx = await getTradeParticipantContext(TRADE_ID, USER_B);
		expect(ctx!.lastReadAt).toBe(readAt.toISOString());
	});
});

describe("getTradeUnreadCount", () => {
	it("throws when trade not found", async () => {
		selectResults = [[]];

		await expect(getTradeUnreadCount(TRADE_ID, USER_A)).rejects.toThrow(
			"Trade not found or forbidden.",
		);
	});

	it("returns count when trade exists", async () => {
		// First query: getTradeParticipantContext
		selectResults = [
			[tradeRow()],
			// Second query: count result
			[{ count: 3 }],
		];

		const count = await getTradeUnreadCount(TRADE_ID, USER_A);
		expect(count).toBe(3);
	});

	it("returns 0 when no unread messages", async () => {
		selectResults = [
			[tradeRow()],
			[{ count: 0 }],
		];

		const count = await getTradeUnreadCount(TRADE_ID, USER_A);
		expect(count).toBe(0);
	});
});
