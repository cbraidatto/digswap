import { describe, test, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// DB mock with thenable chain (project pattern)
// ---------------------------------------------------------------------------
let queryCallCount = 0;
let queryResults: unknown[][] = [];

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
		"offset",
	];

	for (const method of methods) {
		chain[method] = vi.fn().mockImplementation(() => chain);
	}

	// Thenable: resolves with the next result set
	chain.then = (resolve: (v: unknown) => void) => {
		const result = queryResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};

	return { db: chain };
});

// ---------------------------------------------------------------------------
// Schema mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		discogsId: "discogs_id",
		youtubeVideoId: "youtube_video_id",
		title: "title",
		artist: "artist",
		year: "year",
		genre: "genre",
		style: "style",
		country: "country",
		format: "format",
		label: "label",
		coverImageUrl: "cover_image_url",
		discogsHave: "discogs_have",
		discogsWant: "discogs_want",
		rarityScore: "rarity_score",
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
}));

vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: {
		id: "id",
		userId: "user_id",
		releaseId: "release_id",
		conditionGrade: "condition_grade",
	},
}));

vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		id: "id",
		username: "username",
		avatarUrl: "avatar_url",
		displayName: "display_name",
	},
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import {
	getReleaseByDiscogsId,
	getOwnersByReleaseId,
	getOwnerCountByReleaseId,
} from "@/lib/release/queries";

describe("getReleaseByDiscogsId", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	test("returns release for valid discogsId", async () => {
		queryResults = [
			[
				{
					id: "rel-uuid-1",
					discogsId: 123456,
					title: "Kind of Blue",
					artist: "Miles Davis",
					youtubeVideoId: "abc123",
					year: 1959,
					genre: ["Jazz"],
					coverImageUrl: "https://i.discogs.com/kob.jpg",
				},
			],
		];

		const release = await getReleaseByDiscogsId(123456);

		expect(release).not.toBeNull();
		expect(release!.title).toBe("Kind of Blue");
		expect(release!.artist).toBe("Miles Davis");
		expect(release!.discogsId).toBe(123456);
		expect(release!.youtubeVideoId).toBe("abc123");
	});

	test("returns null for unknown discogsId", async () => {
		queryResults = [[]];

		const release = await getReleaseByDiscogsId(999999);

		expect(release).toBeNull();
	});
});

describe("getOwnersByReleaseId", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	test("returns owners with profile data", async () => {
		queryResults = [
			[
				{
					userId: "user-1",
					username: "jazzhound",
					avatarUrl: null,
					displayName: "Jazz Hound",
					conditionGrade: "VG+",
				},
				{
					userId: "user-2",
					username: "digger99",
					avatarUrl: "https://example.com/avatar.jpg",
					displayName: "Digger 99",
					conditionGrade: "Mint",
				},
				{
					userId: "user-3",
					username: "cratekid",
					avatarUrl: null,
					displayName: null,
					conditionGrade: null,
				},
			],
		];

		const owners = await getOwnersByReleaseId("rel-uuid-1");

		expect(owners).toHaveLength(3);
		expect(owners[0].userId).toBe("user-1");
		expect(owners[0].username).toBe("jazzhound");
		expect(owners[0].displayName).toBe("Jazz Hound");
		expect(owners[0].conditionGrade).toBe("VG+");
		expect(owners[1].avatarUrl).toBe("https://example.com/avatar.jpg");
		expect(owners[2].displayName).toBeNull();
	});

	test("respects limit parameter", async () => {
		const { db } = await import("@/lib/db");

		queryResults = [
			[
				{ userId: "user-1", username: "a", avatarUrl: null, displayName: null, conditionGrade: null },
			],
		];

		await getOwnersByReleaseId("rel-uuid-1", 5);

		// Verify limit was called (it's in the chain)
		expect((db as unknown as Record<string, ReturnType<typeof vi.fn>>).limit).toHaveBeenCalled();
	});
});

describe("getOwnerCountByReleaseId", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	test("returns correct count", async () => {
		queryResults = [[{ count: 42 }]];

		const count = await getOwnerCountByReleaseId("rel-uuid-1");

		expect(count).toBe(42);
	});

	test("returns 0 for release with no owners", async () => {
		queryResults = [[{ count: 0 }]];

		const count = await getOwnerCountByReleaseId("rel-uuid-1");

		expect(count).toBe(0);
	});
});
