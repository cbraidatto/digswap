import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-111111111111";

let mockAuthUser: { id: string } | null = { id: USER_ID };
let queryCallCount = 0;
const mockInsertValues = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
				error: mockAuthUser ? null : { message: "Not authenticated" },
			})),
		},
	})),
}));

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};
	const methods = ["select", "from", "where", "orderBy", "limit"];
	for (const m of methods) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}
	chain.then = (resolve: (v: unknown) => void) => {
		queryCallCount++;
		return resolve([]);
	};
	chain.insert = vi.fn().mockImplementation(() => ({
		values: mockInsertValues.mockImplementation(() => ({
			onConflictDoUpdate: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					queryCallCount++;
					return resolve([]);
				},
			})),
			then: (resolve: (v: unknown) => void) => {
				queryCallCount++;
				return resolve([]);
			},
		})),
	}));
	return { db: chain };
});

vi.mock("@/lib/db/schema/search-signals", () => ({
	searchSignals: {
		userId: "user_id",
		terms: "terms",
		genres: "genres",
		strength: "strength",
		lastReinforcedAt: "last_reinforced_at",
	},
}));

const { logSearchSignal } = await import("@/actions/search-signals");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("logSearchSignal", () => {
	it("does nothing when not authenticated", async () => {
		mockAuthUser = null;
		await logSearchSignal(["jazz"], ["Jazz"]);
		// Should return early without inserting
		expect(mockInsertValues).not.toHaveBeenCalled();
	});

	it("does nothing with invalid input (terms too long array)", async () => {
		const tooManyTerms = Array.from({ length: 51 }, (_, i) => `term${i}`);
		await logSearchSignal(tooManyTerms, []);
		expect(mockInsertValues).not.toHaveBeenCalled();
	});

	it("inserts search signal for valid authenticated request", async () => {
		await logSearchSignal(["coltrane"], ["Jazz"]);
		expect(mockInsertValues).toHaveBeenCalled();
	});

	it("handles empty arrays gracefully", async () => {
		await logSearchSignal([], []);
		expect(mockInsertValues).toHaveBeenCalled();
	});
});
