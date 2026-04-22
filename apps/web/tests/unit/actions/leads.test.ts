import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-1111";
const TARGET_ID = "target-2222-2222-2222-2222";

let mockAuthUser: { id: string } | null = { id: USER_ID };
let selectResults: unknown[][] = [];
let queryCallCount = 0;

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
			})),
		},
	})),
}));

vi.mock("@/lib/validations/leads", () => ({
	saveLeadSchema: {
		safeParse: vi.fn((val: Record<string, unknown>) => {
			if (!val.targetType || !val.targetId || !val.status) {
				return { success: false, error: { issues: [{ message: "Invalid input" }] } };
			}
			return { success: true, data: val };
		}),
	},
	getLeadSchema: {
		safeParse: vi.fn((val: Record<string, unknown>) => {
			if (!val.targetType || !val.targetId) {
				return { success: false, error: { issues: [{ message: "Invalid" }] } };
			}
			return { success: true, data: val };
		}),
	},
	getLeadsFilterSchema: {
		safeParse: vi.fn((val: unknown) => ({
			success: true,
			data: val ?? {},
		})),
	},
}));

vi.mock("drizzle-orm", () => ({
	and: vi.fn((...args: unknown[]) => args),
	eq: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};
	const methods = ["select", "from", "where", "orderBy", "limit"];
	for (const m of methods) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}
	chain.then = (resolve: (v: unknown) => void) => {
		const result = selectResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};
	chain.insert = vi.fn().mockImplementation(() => ({
		values: vi.fn().mockImplementation(() => ({
			onConflictDoUpdate: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					queryCallCount++;
					return resolve(undefined);
				},
			})),
		})),
	}));
	return { db: chain };
});

vi.mock("@/lib/db/schema/leads", () => ({
	leads: {
		userId: "user_id",
		targetType: "target_type",
		targetId: "target_id",
		note: "note",
		status: "status",
		updatedAt: "updated_at",
	},
}));

const { saveLead, getLead, getLeads } = await import("@/actions/leads");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("saveLead", () => {
	it("saves a lead for authenticated user", async () => {
		const result = await saveLead("release", TARGET_ID, "Great find", "watching");
		expect(result.success).toBe(true);
	});

	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await saveLead("release", TARGET_ID, null, "watching");
		expect(result.error).toContain("Not authenticated");
	});

	it("rejects invalid input", async () => {
		const result = await saveLead("" as "release", "", null, "" as "watching");
		expect(result.error).toBeDefined();
	});
});

describe("getLead", () => {
	it("returns lead for authenticated user", async () => {
		selectResults = [
			[{ userId: USER_ID, targetType: "release", targetId: TARGET_ID, status: "watching" }],
		];
		const result = await getLead("release", TARGET_ID);
		expect(result).not.toBeNull();
	});

	it("returns null for unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await getLead("release", TARGET_ID);
		expect(result).toBeNull();
	});

	it("returns null when lead not found", async () => {
		selectResults = [[]];
		const result = await getLead("release", TARGET_ID);
		expect(result).toBeNull();
	});
});

describe("getLeads", () => {
	it("returns leads for authenticated user", async () => {
		selectResults = [[{ id: "lead-1" }, { id: "lead-2" }]];
		const result = await getLeads();
		expect(result).toHaveLength(2);
	});

	it("returns empty for unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await getLeads();
		expect(result).toEqual([]);
	});

	it("returns leads with filter", async () => {
		selectResults = [[{ id: "lead-1" }]];
		const result = await getLeads({ status: "watching" });
		expect(result).toHaveLength(1);
	});
});
