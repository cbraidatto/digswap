import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const TRADE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VIEWER_ID = "user-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const OTHER_USER = "user-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

let selectResults: unknown[][] = [];
let queryCallCount = 0;

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = ["select", "from", "where", "orderBy", "limit", "innerJoin", "leftJoin"];
	for (const m of methods) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}

	chain.then = (resolve: (v: unknown) => void) => {
		const result = selectResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};

	return { db: chain };
});

vi.mock("@/lib/db/schema/trades", () => ({
	tradeRequests: {
		id: "id",
		requesterId: "requester_id",
		providerId: "provider_id",
	},
	tradeProposals: {
		id: "id",
		tradeId: "trade_id",
		proposerId: "proposer_id",
		sequenceNumber: "sequence_number",
		status: "status",
		message: "message",
		createdAt: "created_at",
	},
	tradeProposalItems: {
		id: "id",
		proposalId: "proposal_id",
		side: "side",
		collectionItemId: "collection_item_id",
		releaseId: "release_id",
		declaredQuality: "declared_quality",
		conditionNotes: "condition_notes",
	},
}));

vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: {
		id: "id",
		userId: "user_id",
		releaseId: "release_id",
		visibility: "visibility",
		conditionGrade: "condition_grade",
		audioFormat: "audio_format",
		bitrate: "bitrate",
		sampleRate: "sample_rate",
	},
}));

vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		title: "title",
		artist: "artist",
		year: "year",
		coverImageUrl: "cover_image_url",
	},
}));

const { getTradeableCollectionItems, getProposalHistory } = await import(
	"@/lib/trades/proposal-queries"
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("getTradeableCollectionItems", () => {
	it("returns mapped tradeable items", async () => {
		const item = {
			id: "ci-1",
			releaseId: "rel-1",
			title: "Kind of Blue",
			artist: "Miles Davis",
			year: 1959,
			coverImageUrl: "https://example.com/cover.jpg",
			conditionGrade: "VG+",
			audioFormat: "FLAC",
			bitrate: null,
			sampleRate: 44100,
		};
		selectResults = [[item]];

		const result = await getTradeableCollectionItems(VIEWER_ID);
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual(item);
	});

	it("returns empty array when user has no tradeable items", async () => {
		selectResults = [[]];

		const result = await getTradeableCollectionItems(VIEWER_ID);
		expect(result).toEqual([]);
	});

	it("maps multiple items", async () => {
		selectResults = [
			[
				{
					id: "ci-1",
					releaseId: "r-1",
					title: "A",
					artist: "X",
					year: null,
					coverImageUrl: null,
					conditionGrade: null,
					audioFormat: null,
					bitrate: null,
					sampleRate: null,
				},
				{
					id: "ci-2",
					releaseId: "r-2",
					title: "B",
					artist: "Y",
					year: 2020,
					coverImageUrl: null,
					conditionGrade: "M",
					audioFormat: "MP3",
					bitrate: 320,
					sampleRate: null,
				},
			],
		];

		const result = await getTradeableCollectionItems(VIEWER_ID);
		expect(result).toHaveLength(2);
		expect(result[0].title).toBe("A");
		expect(result[1].title).toBe("B");
	});
});

describe("getProposalHistory", () => {
	it("returns empty array when viewer is not a participant", async () => {
		// Step 1 returns no trade
		selectResults = [[]];

		const result = await getProposalHistory(TRADE_ID, VIEWER_ID);
		expect(result).toEqual([]);
	});

	it("returns empty array when trade has no proposals", async () => {
		// Step 1: trade exists
		selectResults = [
			[{ id: TRADE_ID }],
			// Step 2: no proposals
			[],
		];

		const result = await getProposalHistory(TRADE_ID, VIEWER_ID);
		expect(result).toEqual([]);
	});

	it("returns proposals with assembled items", async () => {
		const proposal = {
			id: "prop-1",
			proposerId: VIEWER_ID,
			sequenceNumber: 1,
			status: "pending",
			message: "How about this?",
			createdAt: new Date("2024-06-01"),
		};

		const item = {
			id: "pi-1",
			proposalId: "prop-1",
			side: "offer",
			collectionItemId: "ci-1",
			releaseId: "r-1",
			declaredQuality: "VG+",
			conditionNotes: "Light surface noise",
			title: "Kind of Blue",
			artist: "Miles Davis",
			coverImageUrl: null,
		};

		// Step 1: trade exists
		// Step 2: proposals
		// Step 3: items
		selectResults = [[{ id: TRADE_ID }], [proposal], [item]];

		const result = await getProposalHistory(TRADE_ID, VIEWER_ID);
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("prop-1");
		expect(result[0].items).toHaveLength(1);
		expect(result[0].items[0].side).toBe("offer");
		expect(result[0].items[0].title).toBe("Kind of Blue");
	});

	it("assembles items to correct proposals", async () => {
		const prop1 = {
			id: "prop-1",
			proposerId: VIEWER_ID,
			sequenceNumber: 1,
			status: "rejected",
			message: null,
			createdAt: new Date("2024-06-01"),
		};
		const prop2 = {
			id: "prop-2",
			proposerId: OTHER_USER,
			sequenceNumber: 2,
			status: "pending",
			message: "Counter",
			createdAt: new Date("2024-06-02"),
		};

		const item1 = {
			id: "pi-1",
			proposalId: "prop-1",
			side: "offer",
			collectionItemId: "ci-1",
			releaseId: "r-1",
			declaredQuality: null,
			conditionNotes: null,
			title: "A",
			artist: "X",
			coverImageUrl: null,
		};
		const item2 = {
			id: "pi-2",
			proposalId: "prop-2",
			side: "want",
			collectionItemId: null,
			releaseId: "r-2",
			declaredQuality: "M",
			conditionNotes: null,
			title: "B",
			artist: "Y",
			coverImageUrl: null,
		};

		selectResults = [[{ id: TRADE_ID }], [prop1, prop2], [item1, item2]];

		const result = await getProposalHistory(TRADE_ID, VIEWER_ID);
		expect(result).toHaveLength(2);
		expect(result[0].items).toHaveLength(1);
		expect(result[0].items[0].id).toBe("pi-1");
		expect(result[1].items).toHaveLength(1);
		expect(result[1].items[0].id).toBe("pi-2");
	});

	it("returns proposals with empty items when no items match", async () => {
		const proposal = {
			id: "prop-1",
			proposerId: VIEWER_ID,
			sequenceNumber: 1,
			status: "pending",
			message: null,
			createdAt: new Date("2024-06-01"),
		};

		selectResults = [
			[{ id: TRADE_ID }],
			[proposal],
			[], // no items
		];

		const result = await getProposalHistory(TRADE_ID, VIEWER_ID);
		expect(result).toHaveLength(1);
		expect(result[0].items).toEqual([]);
	});
});
