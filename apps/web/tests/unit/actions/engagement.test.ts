import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-1111";
const FEED_ITEM_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RELEASE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let mockAuthUser: { id: string } | null = { id: USER_ID };
let selectResults: unknown[][] = [];
let queryCallCount = 0;

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

vi.mock("drizzle-orm", () => ({
	and: vi.fn((...args: unknown[]) => args),
	count: vi.fn(() => "count"),
	eq: vi.fn((a: unknown, b: unknown) => [a, b]),
	isNull: vi.fn((col: unknown) => ({ col, op: "isNull" })),
	sql: vi.fn(),
}));

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = [
		"select",
		"from",
		"where",
		"orderBy",
		"limit",
		"innerJoin",
		"leftJoin",
		"groupBy",
	];
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
			returning: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = selectResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
			onConflictDoUpdate: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = selectResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
			then: (resolve: (v: unknown) => void) => {
				const result = selectResults[queryCallCount] ?? [];
				queryCallCount++;
				return resolve(result);
			},
		})),
	}));

	chain.update = vi.fn().mockImplementation(() => ({
		set: vi.fn().mockImplementation(() => ({
			where: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = selectResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
		})),
	}));

	chain.delete = vi.fn().mockImplementation(() => ({
		where: vi.fn().mockImplementation(() => ({
			then: (resolve: (v: unknown) => void) => {
				const result = selectResults[queryCallCount] ?? [];
				queryCallCount++;
				return resolve(result);
			},
		})),
	}));

	// Transaction support
	chain.transaction = vi.fn().mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
		const tx: Record<string, unknown> = {};
		const txMethods = ["select", "from", "where", "orderBy", "limit", "groupBy"];
		for (const m of txMethods) {
			tx[m] = vi.fn().mockImplementation(() => tx);
		}
		tx.then = (resolve: (v: unknown) => void) => {
			const result = selectResults[queryCallCount] ?? [];
			queryCallCount++;
			return resolve(result);
		};
		tx.insert = vi.fn().mockImplementation(() => ({
			values: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					queryCallCount++;
					return resolve(undefined);
				},
			})),
		}));
		tx.delete = vi.fn().mockImplementation(() => ({
			where: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					queryCallCount++;
					return resolve(undefined);
				},
			})),
		}));
		return fn(tx);
	});

	return { db: chain };
});

vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: { userId: "user_id", releaseId: "release_id" },
}));
vi.mock("@/lib/db/schema/engagement", () => ({
	digs: { id: "id", userId: "user_id", feedItemId: "feed_item_id" },
	diggerDna: {
		userId: "user_id",
		topGenres: "top_genres",
		topDecades: "top_decades",
		topCountries: "top_countries",
		rarityProfile: "rarity_profile",
		avgRarity: "avg_rarity",
		totalRecords: "total_records",
		updatedAt: "updated_at",
	},
}));
vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		genre: "genre",
		style: "style",
		year: "year",
		country: "country",
		rarityScore: "rarity_score",
	},
}));
vi.mock("@/lib/db/schema/listening-logs", () => ({
	listeningLogs: {
		id: "id",
		userId: "user_id",
		releaseId: "release_id",
		caption: "caption",
		rating: "rating",
	},
}));
vi.mock("@/lib/db/schema/social", () => ({
	activityFeed: {
		id: "id",
		userId: "user_id",
		actionType: "action_type",
		targetType: "target_type",
		targetId: "target_id",
		metadata: "metadata",
	},
}));

const { toggleDig, getDigState, computeDiggerDna, getDiggerDna, logListening } = await import(
	"@/actions/engagement"
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("toggleDig", () => {
	it("rejects invalid feed item ID", async () => {
		const result = await toggleDig("not-a-uuid");
		expect(result.error).toBeDefined();
	});

	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await toggleDig(FEED_ITEM_ID);
		expect(result.error).toBeDefined();
	});

	it("toggles dig for valid input (new dig)", async () => {
		// tx.select existing digs -> none, tx.select count -> 1
		selectResults = [[], [{ count: 1 }]];
		const result = await toggleDig(FEED_ITEM_ID);
		expect(result.dug).toBe(true);
	});
});

describe("getDigState", () => {
	it("returns empty for empty array", async () => {
		const result = await getDigState([]);
		expect(result).toEqual({});
	});

	it("returns dig states for authenticated user", async () => {
		// user digs query, counts query
		selectResults = [[{ feedItemId: FEED_ITEM_ID }], [{ feedItemId: FEED_ITEM_ID, count: 3 }]];
		const result = await getDigState([FEED_ITEM_ID]);
		expect(result[FEED_ITEM_ID]).toBeDefined();
	});

	it("returns empty on auth failure", async () => {
		mockAuthUser = null;
		const result = await getDigState([FEED_ITEM_ID]);
		expect(result).toEqual({});
	});
});

describe("computeDiggerDna", () => {
	it("rejects mismatched userId", async () => {
		const result = await computeDiggerDna("other-user-id");
		expect(result.error).toBe("Forbidden");
	});

	it("returns empty profile when no collection items", async () => {
		selectResults = [[]];
		const result = await computeDiggerDna();
		expect(result.totalRecords).toBe(0);
		expect(result.topGenres).toEqual([]);
	});

	it("computes DNA for user with collection", async () => {
		selectResults = [
			[
				{ genre: ["Jazz"], style: ["Bop"], year: 1965, country: "US", rarityScore: 80 },
				{ genre: ["Jazz", "Funk"], style: null, year: 1972, country: "US", rarityScore: 60 },
			],
		];
		const result = await computeDiggerDna();
		expect(result.totalRecords).toBe(2);
		expect(result.topGenres.length).toBeGreaterThan(0);
		expect(result.rarityProfile).toBeDefined();
	});
});

describe("getDiggerDna", () => {
	it("returns DNA data for valid user", async () => {
		selectResults = [[{ userId: USER_ID, topGenres: [], rarityProfile: "quartz_collector" }]];
		const result = await getDiggerDna(USER_ID);
		expect(result).not.toBeNull();
	});

	it("returns null on auth failure", async () => {
		mockAuthUser = null;
		const result = await getDiggerDna(USER_ID);
		expect(result).toBeNull();
	});
});

describe("logListening", () => {
	it("logs a listening entry", async () => {
		const result = await logListening(RELEASE_ID, "Great album!", 5);
		expect(result.success).toBe(true);
	});

	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await logListening(RELEASE_ID);
		expect(result.success).toBe(false);
	});

	it("rejects invalid rating", async () => {
		const result = await logListening(RELEASE_ID, undefined, 10);
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects invalid release ID", async () => {
		const result = await logListening("not-uuid");
		expect(result.success).toBe(false);
	});
});
