import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "11111111-1111-4111-8111-111111111111";

let selectResults: unknown[] = [];
const updateSetMock = vi.fn();
const updateWhereMock = vi.fn();

function nextSelectResult() {
	if (selectResults.length === 0) {
		return [];
	}

	return selectResults.shift();
}

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn(() => {
			const chain = {
				from: vi.fn(() => chain),
				limit: vi.fn(() => Promise.resolve(nextSelectResult())),
				where: vi.fn(() => chain),
			};

			return chain;
		}),
		update: vi.fn(() => ({
			set: updateSetMock.mockImplementation(() => ({
				where: updateWhereMock.mockImplementation(() => Promise.resolve(undefined)),
			})),
		})),
	},
}));

vi.mock("@/lib/db/schema/subscriptions", () => ({
	subscriptions: {
		plan: "plan",
		tradesMonthReset: "trades_month_reset",
		tradesThisMonth: "trades_this_month",
		updatedAt: "updated_at",
		userId: "user_id",
	},
}));

vi.mock("server-only", () => ({}));

const { FREE_TRADE_LIMIT, canInitiateTrade, getUserSubscription, incrementTradeCount } =
	await import("@/lib/entitlements");

beforeEach(() => {
	selectResults = [];
	vi.clearAllMocks();
	vi.useFakeTimers();
	vi.setSystemTime(new Date("2026-04-15T12:00:00.000Z"));
});

describe("canInitiateTrade", () => {
	it("allows a free user under the monthly limit", async () => {
		selectResults = [
			[
				{
					plan: "free",
					tradesMonthReset: new Date("2026-04-01T00:00:00.000Z"),
					tradesThisMonth: 2,
					userId: USER_ID,
				},
			],
		];

		await expect(canInitiateTrade(USER_ID)).resolves.toEqual({
			allowed: true,
			reason: "under_limit",
			tradesLimit: FREE_TRADE_LIMIT,
			tradesUsed: 2,
		});
	});

	it("blocks a free user at the monthly limit", async () => {
		selectResults = [
			[
				{
					plan: "free",
					tradesMonthReset: new Date("2026-04-01T00:00:00.000Z"),
					tradesThisMonth: FREE_TRADE_LIMIT,
					userId: USER_ID,
				},
			],
		];

		await expect(canInitiateTrade(USER_ID)).resolves.toEqual({
			allowed: false,
			reason: "limit_reached",
			tradesLimit: FREE_TRADE_LIMIT,
			tradesUsed: FREE_TRADE_LIMIT,
		});
	});

	it("allows a premium user with no quota cap", async () => {
		selectResults = [
			[
				{
					plan: "premium_monthly",
					tradesMonthReset: new Date("2026-04-01T00:00:00.000Z"),
					tradesThisMonth: 100,
					userId: USER_ID,
				},
			],
		];

		await expect(canInitiateTrade(USER_ID)).resolves.toEqual({
			allowed: true,
			reason: "no_limit",
			tradesLimit: null,
			tradesUsed: 100,
		});
	});
});

describe("getUserSubscription", () => {
	it("returns null when no subscription row exists", async () => {
		selectResults = [[]];

		await expect(getUserSubscription(USER_ID)).resolves.toBeNull();
	});

	it("lazily resets the trade window when the reset date is older than 30 days", async () => {
		const now = new Date("2026-04-15T12:00:00.000Z");
		selectResults = [
			[
				{
					plan: "free",
					tradesMonthReset: new Date("2026-03-01T00:00:00.000Z"),
					tradesThisMonth: 4,
					userId: USER_ID,
				},
			],
		];

		await expect(getUserSubscription(USER_ID)).resolves.toEqual({
			plan: "free",
			status: "active",
			tradesMonthReset: now,
			tradesThisMonth: 0,
		});
		expect(updateSetMock).toHaveBeenCalledWith({
			tradesMonthReset: now,
			tradesThisMonth: 0,
			updatedAt: now,
		});
	});
});

describe("incrementTradeCount", () => {
	it("increments the counter for a free user", async () => {
		const resetDate = new Date("2026-04-01T00:00:00.000Z");
		selectResults = [
			[
				{
					plan: "free",
					tradesMonthReset: resetDate,
					tradesThisMonth: 2,
					userId: USER_ID,
				},
			],
		];

		await incrementTradeCount(USER_ID);

		expect(updateSetMock).toHaveBeenCalledWith({
			tradesMonthReset: resetDate,
			tradesThisMonth: expect.anything(),
			updatedAt: new Date("2026-04-15T12:00:00.000Z"),
		});
		expect(updateWhereMock).toHaveBeenCalledTimes(1);
	});

	it("is a no-op for a premium user", async () => {
		selectResults = [
			[
				{
					plan: "premium_annual",
					tradesMonthReset: new Date("2026-04-01T00:00:00.000Z"),
					tradesThisMonth: 100,
					userId: USER_ID,
				},
			],
		];

		await incrementTradeCount(USER_ID);

		expect(updateSetMock).not.toHaveBeenCalled();
	});
});
