import { beforeEach, describe, expect, it, vi } from "vitest";

const TRADE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const COUNTERPARTY_ID = "33333333-3333-4333-8333-333333333333";

let selectResults: unknown[] = [];

function nextResult() {
	if (selectResults.length === 0) {
		return [];
	}

	return selectResults.shift();
}

function createQueryResult(result: unknown) {
	const queryResult = Promise.resolve(result);

	return Object.assign(queryResult, {
		limit: vi.fn(() => queryResult),
	});
}

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn(() => {
			const chain = {
				from: vi.fn(() => chain),
				leftJoin: vi.fn(() => chain),
				orderBy: vi.fn(() => chain),
				selectDistinctOn: vi.fn(() => chain),
				where: vi.fn(() => createQueryResult(nextResult())),
			};

			return chain;
		}),
		selectDistinctOn: vi.fn(() => {
			const chain = {
				from: vi.fn(() => chain),
				orderBy: vi.fn(() => chain),
				where: vi.fn(() => createQueryResult(nextResult())),
			};

			return chain;
		}),
	},
}));

vi.mock("@/lib/db/schema/trades", () => ({
	tradeMessages: {
		body: "body",
		createdAt: "created_at",
		id: "id",
		kind: "kind",
		senderId: "sender_id",
		tradeId: "trade_id",
	},
	tradeRequests: {
		createdAt: "created_at",
		id: "id",
		providerId: "provider_id",
		providerLastReadAt: "provider_last_read_at",
		requesterId: "requester_id",
		requesterLastReadAt: "requester_last_read_at",
		status: "status",
		updatedAt: "updated_at",
	},
}));

vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		avatarUrl: "avatar_url",
		id: "id",
		username: "username",
	},
}));

const { getTradeUnreadCount } = await import("@/lib/trades/messages");

beforeEach(() => {
	selectResults = [];
	vi.clearAllMocks();
});

describe("getTradeUnreadCount", () => {
	it("returns the correct unread count for incoming messages", async () => {
		selectResults = [
			[
				{
					createdAt: new Date("2026-03-31T12:00:00.000Z"),
					id: TRADE_ID,
					providerId: COUNTERPARTY_ID,
					providerLastReadAt: null,
					requesterId: USER_ID,
					requesterLastReadAt: null,
					status: "lobby",
					updatedAt: new Date("2026-03-31T12:00:00.000Z"),
				},
			],
			[{ count: 2 }],
		];

		await expect(getTradeUnreadCount(TRADE_ID, USER_ID)).resolves.toBe(2);
	});

	it("returns 0 after the read timestamp has been advanced", async () => {
		selectResults = [
			[
				{
					createdAt: new Date("2026-03-31T12:00:00.000Z"),
					id: TRADE_ID,
					providerId: COUNTERPARTY_ID,
					providerLastReadAt: null,
					requesterId: USER_ID,
					requesterLastReadAt: new Date("2026-03-31T12:10:00.000Z"),
					status: "lobby",
					updatedAt: new Date("2026-03-31T12:10:00.000Z"),
				},
			],
			[{ count: 0 }],
		];

		await expect(getTradeUnreadCount(TRADE_ID, USER_ID)).resolves.toBe(0);
	});
});
