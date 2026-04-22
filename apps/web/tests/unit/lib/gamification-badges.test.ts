import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-1111";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();

function buildAdminChain() {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	chain.from = mockFrom.mockReturnValue(chain);
	chain.select = mockSelect.mockReturnValue(chain);
	chain.eq = mockEq.mockReturnValue(chain);
	chain.single = mockSingle;
	chain.insert = mockInsert.mockReturnValue(chain);
	return chain;
}

const adminChain = buildAdminChain();
let badgeLookupResult: { data: unknown; error: unknown } = {
	data: { id: "badge-001", name: "First Dig" },
	error: null,
};
let insertResult: { data: unknown; error: unknown } = {
	data: { id: "ub-001" },
	error: null,
};
let notificationInsertResult: { data: unknown; error: unknown } = {
	data: null,
	error: null,
};

let callIndex = 0;

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => {
		return {
			from: vi.fn((table: string) => {
				if (table === "badges") {
					return {
						select: vi.fn().mockReturnValue({
							eq: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue(badgeLookupResult),
							}),
						}),
					};
				}
				if (table === "user_badges") {
					return {
						insert: vi.fn().mockReturnValue({
							select: vi.fn().mockReturnValue({
								single: vi.fn().mockResolvedValue(insertResult),
							}),
						}),
					};
				}
				if (table === "notifications") {
					return {
						insert: vi.fn().mockResolvedValue(notificationInsertResult),
					};
				}
				return {};
			}),
		};
	}),
}));

const { awardBadge } = await import("@/lib/gamification/badge-awards");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	callIndex = 0;
	badgeLookupResult = {
		data: { id: "badge-001", name: "First Dig" },
		error: null,
	};
	insertResult = { data: { id: "ub-001" }, error: null };
	notificationInsertResult = { data: null, error: null };
	vi.clearAllMocks();
});

describe("awardBadge", () => {
	it("returns true when badge is newly awarded", async () => {
		const result = await awardBadge(USER_ID, "first_dig");
		expect(result).toBe(true);
	});

	it("returns false when badge slug not found", async () => {
		badgeLookupResult = { data: null, error: { message: "not found" } };
		const result = await awardBadge(USER_ID, "nonexistent_badge");
		expect(result).toBe(false);
	});

	it("returns false on duplicate award (unique constraint 23505)", async () => {
		insertResult = { data: null, error: { code: "23505", message: "unique_violation" } };
		const result = await awardBadge(USER_ID, "first_dig");
		expect(result).toBe(false);
	});

	it("returns false on other insert errors", async () => {
		insertResult = { data: null, error: { code: "42000", message: "some error" } };
		const result = await awardBadge(USER_ID, "first_dig");
		expect(result).toBe(false);
	});

	it("returns false when insert returns null data", async () => {
		insertResult = { data: null, error: null };
		const result = await awardBadge(USER_ID, "first_dig");
		expect(result).toBe(false);
	});
});
