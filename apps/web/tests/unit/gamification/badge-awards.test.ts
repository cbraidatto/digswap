import { describe, test, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Supabase admin client mock (chainable query pattern)
// ---------------------------------------------------------------------------
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: mockFrom,
	})),
}));

// ---------------------------------------------------------------------------
// Helper: build a chainable Supabase query mock
// ---------------------------------------------------------------------------
function createQueryChain(result: { data?: unknown; error?: unknown }) {
	const chain: Record<string, unknown> = {};
	const methods = ["select", "eq", "neq", "single", "maybeSingle", "insert"];
	for (const method of methods) {
		chain[method] = vi.fn().mockReturnValue(chain);
	}
	// Terminal resolution
	chain.then = (resolve: (v: unknown) => void) => resolve(result);
	return chain;
}

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { awardBadge } from "@/lib/gamification/badge-awards";

describe("awardBadge", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("awardBadge returns true when badge is successfully awarded", async () => {
		// Mock: badges table returns badge for slug "first_dig"
		const badgesChain = createQueryChain({
			data: { id: "badge-1", name: "FIRST_DIG" },
		});
		// Mock: user_badges select returns null (no existing award)
		const existingCheckChain = createQueryChain({ data: null });
		// Mock: user_badges insert succeeds
		const insertBadgeChain = createQueryChain({ error: null });
		// Mock: notifications insert succeeds
		const notificationChain = createQueryChain({ error: null });

		let fromCallCount = 0;
		mockFrom.mockImplementation((table: string) => {
			fromCallCount++;
			// Call 1: badges.select("id, name").eq("slug", "first_dig").single()
			if (table === "badges") return badgesChain;
			// Call 2 & 3: user_badges (first check, then insert)
			if (table === "user_badges") {
				if (fromCallCount <= 3) return existingCheckChain; // check
				return insertBadgeChain; // should not be reached in this flow
			}
			// Call 4: notifications insert
			if (table === "notifications") return notificationChain;
			return createQueryChain({ data: null });
		});

		// The actual implementation calls from("user_badges") twice:
		// once for select (check existing) and once for insert
		// We need to track the second user_badges call as insert
		let userBadgesCallCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "badges") return badgesChain;
			if (table === "user_badges") {
				userBadgesCallCount++;
				if (userBadgesCallCount === 1) return existingCheckChain;
				return insertBadgeChain;
			}
			if (table === "notifications") return notificationChain;
			return createQueryChain({ data: null });
		});

		const result = await awardBadge("user-1", "first_dig");
		expect(result).toBe(true);
	});

	test("awardBadge returns false when badge already awarded (idempotent)", async () => {
		// Mock: badges returns badge
		const badgesChain = createQueryChain({
			data: { id: "badge-1", name: "FIRST_DIG" },
		});
		// Mock: user_badges select returns existing row
		const existingCheckChain = createQueryChain({
			data: { id: "existing-1" },
		});

		mockFrom.mockImplementation((table: string) => {
			if (table === "badges") return badgesChain;
			if (table === "user_badges") return existingCheckChain;
			return createQueryChain({ data: null });
		});

		const result = await awardBadge("user-1", "first_dig");
		expect(result).toBe(false);

		// Insert should NOT have been called on user_badges for a duplicate
		// Verify notifications was never reached
		const notificationCalls = mockFrom.mock.calls.filter(
			(c: string[]) => c[0] === "notifications",
		);
		expect(notificationCalls).toHaveLength(0);
	});

	test("awardBadge returns false when badge slug does not exist", async () => {
		// Mock: badges returns null for unknown slug (with error)
		const badgesChain = createQueryChain({
			data: null,
			error: { message: "not found" },
		});

		mockFrom.mockImplementation((table: string) => {
			if (table === "badges") return badgesChain;
			return createQueryChain({ data: null });
		});

		const result = await awardBadge("user-1", "nonexistent");
		expect(result).toBe(false);

		// Should not have attempted user_badges or notifications
		const userBadgeCalls = mockFrom.mock.calls.filter(
			(c: string[]) => c[0] === "user_badges",
		);
		expect(userBadgeCalls).toHaveLength(0);
	});

	test("awardBadge creates notification with correct type and link", async () => {
		const badgesChain = createQueryChain({
			data: { id: "badge-1", name: "FIRST_DIG" },
		});
		const existingCheckChain = createQueryChain({ data: null });
		const insertBadgeChain = createQueryChain({ error: null });

		// Capture notification insert payload
		let notificationPayload: unknown = null;
		const notificationChain: Record<string, unknown> = {};
		notificationChain.insert = vi.fn().mockImplementation((payload: unknown) => {
			notificationPayload = payload;
			return { then: (resolve: (v: unknown) => void) => resolve({ error: null }) };
		});
		notificationChain.select = vi.fn().mockReturnValue(notificationChain);
		notificationChain.eq = vi.fn().mockReturnValue(notificationChain);
		notificationChain.single = vi.fn().mockReturnValue(notificationChain);
		notificationChain.maybeSingle = vi.fn().mockReturnValue(notificationChain);
		notificationChain.then = (resolve: (v: unknown) => void) =>
			resolve({ error: null });

		let userBadgesCallCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "badges") return badgesChain;
			if (table === "user_badges") {
				userBadgesCallCount++;
				if (userBadgesCallCount === 1) return existingCheckChain;
				return insertBadgeChain;
			}
			if (table === "notifications") return notificationChain;
			return createQueryChain({ data: null });
		});

		await awardBadge("user-1", "first_dig");

		// Verify notification was created with correct shape
		expect(notificationPayload).toEqual(
			expect.objectContaining({
				user_id: "user-1",
				type: "new_badge",
				title: "Badge earned: FIRST_DIG",
				link: "/perfil",
			}),
		);
	});

	test("awardBadge returns false on insert error (never throws)", async () => {
		const badgesChain = createQueryChain({
			data: { id: "badge-1", name: "FIRST_DIG" },
		});
		const existingCheckChain = createQueryChain({ data: null });
		// Insert returns an error
		const insertBadgeChain = createQueryChain({
			error: { message: "some error" },
		});

		let userBadgesCallCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "badges") return badgesChain;
			if (table === "user_badges") {
				userBadgesCallCount++;
				if (userBadgesCallCount === 1) return existingCheckChain;
				return insertBadgeChain;
			}
			return createQueryChain({ data: null });
		});

		// Should NOT throw
		const result = await awardBadge("user-1", "first_dig");
		expect(result).toBe(false);
	});
});
