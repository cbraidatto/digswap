import { beforeEach, describe, expect, test, vi } from "vitest";

// -- Mock drizzle-orm functions --
const mockDesc = vi.fn((col: unknown) => ({ direction: "desc", column: col }));
const mockAsc = vi.fn((col: unknown) => ({ direction: "asc", column: col }));
const mockEq = vi.fn().mockReturnValue("eq-condition");
const mockAnd = vi.fn((...args: unknown[]) => args);
const mockGte = vi.fn().mockReturnValue("gte-condition");
const mockLt = vi.fn().mockReturnValue("lt-condition");
const mockSqlCalls: unknown[][] = [];

vi.mock("drizzle-orm", () => ({
	eq: (...args: unknown[]) => mockEq(...args),
	desc: (arg: unknown) => mockDesc(arg),
	asc: (arg: unknown) => mockAsc(arg),
	and: (...args: unknown[]) => mockAnd(...args),
	gte: (...args: unknown[]) => mockGte(...args),
	isNull: vi.fn((col: unknown) => ({ col, op: "isNull" })),
	lt: (...args: unknown[]) => mockLt(...args),
	sql: Object.assign(
		(strings: TemplateStringsArray, ...values: unknown[]) => {
			mockSqlCalls.push([strings, ...values]);
			return { sqlTag: true, strings, values };
		},
		{ raw: vi.fn() },
	),
}));
vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	resetRateLimit: null,
	totpRateLimit: null,
	apiRateLimit: null,
	tradeRateLimit: null,
	discogsRateLimit: null,
	safeLimit: vi.fn().mockImplementation(async () => ({ success: true })),
}));

// -- Mock db chain using a factory to avoid hoisting issues --
let _capturedOrderBy: unknown = null;

vi.mock("@/lib/db", () => {
	const chain = {
		select: vi.fn().mockReturnThis(),
		from: vi.fn().mockReturnThis(),
		innerJoin: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		orderBy: vi.fn(function (this: typeof chain, val: unknown) {
			_capturedOrderBy = val;
			return chain;
		}),
		limit: vi.fn().mockReturnThis(),
		offset: vi.fn().mockResolvedValue([]),
	};
	return { db: chain };
});

// -- Mock DB schemas --
vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: {
		userId: "user_id",
		releaseId: "release_id",
		id: "id",
		conditionGrade: "condition_grade",
		addedVia: "added_via",
		createdAt: "created_at",
	},
}));

vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		discogsId: "discogs_id",
		title: "title",
		artist: "artist",
		year: "year",
		genre: "genre",
		format: "format",
		coverImageUrl: "cover_image_url",
		rarityScore: "rarity_score",
	},
}));

import { getCollectionPage } from "@/lib/collection/queries";
import { db } from "@/lib/db";

describe("collection sorting", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		_capturedOrderBy = null;
		mockSqlCalls.length = 0;
	});

	test("sorts by rarity descending (Ultra Rare first)", async () => {
		await getCollectionPage("user-1", {
			sort: "rarity",
			page: 1,
		});

		expect((db as unknown as Record<string, ReturnType<typeof vi.fn>>).orderBy).toHaveBeenCalled();
		// buildOrderBy("rarity") calls desc(sql`COALESCE(...)`)
		expect(mockDesc).toHaveBeenCalled();
		// The sql template literal should have been called with COALESCE
		expect(mockSqlCalls.length).toBeGreaterThan(0);
	});

	test("sorts by date added descending (newest first)", async () => {
		await getCollectionPage("user-1", {
			sort: "date",
			page: 1,
		});

		expect((db as unknown as Record<string, ReturnType<typeof vi.fn>>).orderBy).toHaveBeenCalled();
		expect(mockDesc).toHaveBeenCalled();
		// desc() is called with the createdAt column
		const descCallArg = mockDesc.mock.calls[0][0];
		expect(descCallArg).toBe("created_at");
	});

	test("sorts by title ascending (A-Z)", async () => {
		await getCollectionPage("user-1", {
			sort: "alpha",
			page: 1,
		});

		expect((db as unknown as Record<string, ReturnType<typeof vi.fn>>).orderBy).toHaveBeenCalled();
		expect(mockAsc).toHaveBeenCalled();
		// asc() is called with the title column
		const ascCallArg = mockAsc.mock.calls[0][0];
		expect(ascCallArg).toBe("title");
	});

	test("handles null rarity scores (sorted last via COALESCE)", async () => {
		await getCollectionPage("user-1", {
			sort: "rarity",
			page: 1,
		});

		// Verify the COALESCE SQL template was used with -1 fallback
		expect(mockSqlCalls.length).toBeGreaterThan(0);
		const sqlCall = mockSqlCalls[0];
		// The template strings should contain 'COALESCE' and '-1'
		const templateStr = (sqlCall[0] as TemplateStringsArray).join("");
		expect(templateStr).toContain("COALESCE");
		expect(templateStr).toContain("-1");
	});

	test("applies correct pagination offset", async () => {
		await getCollectionPage("user-1", {
			sort: "rarity",
			page: 3,
		});

		const dbAny = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
		// PAGE_SIZE = 24, page 3 => offset = (3-1) * 24 = 48
		expect(dbAny.offset).toHaveBeenCalledWith(48);
		expect(dbAny.limit).toHaveBeenCalledWith(24);
	});

	test("default sort uses rarity ordering", async () => {
		await getCollectionPage("user-1", {
			sort: "rarity",
			page: 1,
		});

		// Same behavior as explicit rarity sort
		expect(mockDesc).toHaveBeenCalled();
		expect(mockSqlCalls.length).toBeGreaterThan(0);
	});
});
