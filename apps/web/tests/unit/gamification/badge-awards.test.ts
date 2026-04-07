import { beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Supabase admin client mock
// The new awardBadge uses:
//   badges.select("id, name").eq("slug", slug).single()
//   user_badges.insert({...}).select("id").single()  ← ON CONFLICT DO NOTHING
//   notifications.insert({...})
// ---------------------------------------------------------------------------
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: mockFrom,
	})),
}));

function createChain(terminalResult: {
	data?: unknown;
	error?: { code?: string; message?: string } | null;
}) {
	const chain: Record<string, unknown> = {};
	const methods = ["select", "eq", "single", "maybeSingle", "insert"];
	for (const m of methods) {
		chain[m] = vi.fn().mockReturnValue(chain);
	}
	chain.then = (resolve: (v: unknown) => void) => resolve(terminalResult);
	return chain;
}

import { awardBadge } from "@/lib/gamification/badge-awards";

describe("awardBadge", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("awardBadge returns true when badge is successfully awarded", async () => {
		const badgesChain = createChain({ data: { id: "badge-1", name: "FIRST_DIG" } });
		// insert().select("id").single() → returns the inserted row
		const insertBadgeChain = createChain({ data: { id: "user-badge-1" }, error: null });
		const notificationChain = createChain({ error: null });

		mockFrom.mockImplementation((table: string) => {
			if (table === "badges") return badgesChain;
			if (table === "user_badges") return insertBadgeChain;
			if (table === "notifications") return notificationChain;
			return createChain({ data: null });
		});

		const result = await awardBadge("user-1", "first_dig");
		expect(result).toBe(true);
	});

	test("awardBadge returns false when badge already awarded (idempotent via 23505)", async () => {
		const badgesChain = createChain({ data: { id: "badge-1", name: "FIRST_DIG" } });
		// ON CONFLICT DO NOTHING → unique_violation
		const insertConflictChain = createChain({
			data: null,
			error: { code: "23505", message: "unique_violation" },
		});

		mockFrom.mockImplementation((table: string) => {
			if (table === "badges") return badgesChain;
			if (table === "user_badges") return insertConflictChain;
			return createChain({ data: null });
		});

		const result = await awardBadge("user-1", "first_dig");
		expect(result).toBe(false);

		// Notifications should NOT have been created for a duplicate
		const notificationCalls = mockFrom.mock.calls.filter((c: string[]) => c[0] === "notifications");
		expect(notificationCalls).toHaveLength(0);
	});

	test("awardBadge returns false when badge slug does not exist", async () => {
		const badgesChain = createChain({ data: null, error: { message: "not found" } });

		mockFrom.mockImplementation((table: string) => {
			if (table === "badges") return badgesChain;
			return createChain({ data: null });
		});

		const result = await awardBadge("user-1", "nonexistent");
		expect(result).toBe(false);

		const userBadgeCalls = mockFrom.mock.calls.filter((c: string[]) => c[0] === "user_badges");
		expect(userBadgeCalls).toHaveLength(0);
	});

	test("awardBadge creates notification with correct type and link", async () => {
		const badgesChain = createChain({ data: { id: "badge-1", name: "FIRST_DIG" } });
		const insertBadgeChain = createChain({ data: { id: "user-badge-1" }, error: null });

		let notificationPayload: unknown = null;
		const notificationChain: Record<string, unknown> = {};
		notificationChain.insert = vi.fn().mockImplementation((payload: unknown) => {
			notificationPayload = payload;
			return { then: (resolve: (v: unknown) => void) => resolve({ error: null }) };
		});
		notificationChain.select = vi.fn().mockReturnValue(notificationChain);
		notificationChain.eq = vi.fn().mockReturnValue(notificationChain);
		notificationChain.single = vi.fn().mockReturnValue(notificationChain);
		notificationChain.then = (resolve: (v: unknown) => void) => resolve({ error: null });

		mockFrom.mockImplementation((table: string) => {
			if (table === "badges") return badgesChain;
			if (table === "user_badges") return insertBadgeChain;
			if (table === "notifications") return notificationChain;
			return createChain({ data: null });
		});

		await awardBadge("user-1", "first_dig");

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
		const badgesChain = createChain({ data: { id: "badge-1", name: "FIRST_DIG" } });
		const insertBadgeChain = createChain({ data: null, error: { message: "some error" } });

		mockFrom.mockImplementation((table: string) => {
			if (table === "badges") return badgesChain;
			if (table === "user_badges") return insertBadgeChain;
			return createChain({ data: null });
		});

		const result = await awardBadge("user-1", "first_dig");
		expect(result).toBe(false);
	});
});
