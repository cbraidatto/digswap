import { describe, test, expect, vi, beforeEach } from "vitest";
import { mockCollectionPage } from "../../../__mocks__/discogs";

// -- Mocks --

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();
const mockUpsert = vi.fn();
const mockDelete = vi.fn();

function createChainedMock(resolveValue: unknown = { data: null, error: null }) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	chain.select = vi.fn().mockReturnValue(chain);
	chain.insert = vi.fn().mockReturnValue(chain);
	chain.update = vi.fn().mockReturnValue(chain);
	chain.upsert = vi.fn().mockReturnValue(chain);
	chain.delete = vi.fn().mockReturnValue(chain);
	chain.eq = vi.fn().mockReturnValue(chain);
	chain.in = vi.fn().mockReturnValue(chain);
	chain.single = vi.fn().mockResolvedValue(resolveValue);
	chain.maybeSingle = vi.fn().mockResolvedValue(resolveValue);
	return chain;
}

let fromHandlers: Record<string, ReturnType<typeof createChainedMock>> = {};

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: vi.fn((table: string) => {
			if (fromHandlers[table]) return fromHandlers[table];
			return createChainedMock();
		}),
	})),
}));

const mockGetIdentity = vi.fn();
const mockGetReleases = vi.fn();

vi.mock("@/lib/discogs/client", () => ({
	createDiscogsClient: vi.fn(() => ({
		getIdentity: mockGetIdentity,
		user: () => ({
			collection: () => ({
				getReleases: mockGetReleases,
			}),
		}),
	})),
	computeRarityScore: vi.fn((have: number | undefined, want: number | undefined) => {
		const h = have ?? 0;
		const w = want ?? 0;
		if (h === 0 && w === 0) return null;
		if (h === 0) return 1.0;
		return Math.min(1.0, w / h);
	}),
}));

const mockBroadcastProgress = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/discogs/broadcast", () => ({
	broadcastProgress: (...args: unknown[]) => mockBroadcastProgress(...args),
}));

import { processImportPage } from "@/lib/discogs/import-worker";
import { computeRarityScore } from "@/lib/discogs/client";

describe("Import worker", () => {
	const JOB_ID = "job-uuid-123";
	const USER_ID = "user-uuid-456";

	beforeEach(() => {
		vi.clearAllMocks();
		fromHandlers = {};
	});

	function setupJobMock(overrides: Record<string, unknown> = {}) {
		const jobData = {
			id: JOB_ID,
			user_id: USER_ID,
			type: "collection",
			status: "processing",
			current_page: 1,
			processed_items: 0,
			total_items: 0,
			started_at: new Date().toISOString(),
			...overrides,
		};

		const jobChain = createChainedMock({ data: jobData, error: null });
		fromHandlers["import_jobs"] = jobChain;
		return jobChain;
	}

	function setupCollectionMocks(page: number, totalPages: number, itemCount: number) {
		const mockResponse = mockCollectionPage(page, itemCount, itemCount * totalPages, totalPages);
		mockGetIdentity.mockResolvedValue({
			data: { username: "testuser", id: 42 },
		});
		mockGetReleases.mockResolvedValue({
			data: { releases: mockResponse.releases, pagination: mockResponse.pagination },
		});

		// Releases table: upsert with RETURNING — returns UUID in one call
		const releasesChain = createChainedMock();
		const upsertSelectChain = {
			select: vi.fn().mockReturnValue({
				single: vi.fn().mockResolvedValue({
					data: { id: "release-uuid-001" },
					error: null,
				}),
			}),
		};
		releasesChain.upsert = vi.fn().mockReturnValue(upsertSelectChain);
		fromHandlers["releases"] = releasesChain;

		// Collection items: upsert (ON CONFLICT DO NOTHING)
		const collectionChain = createChainedMock({ data: null, error: null });
		collectionChain.upsert = vi.fn().mockResolvedValue({ error: null });
		fromHandlers["collection_items"] = collectionChain;
	}

	test("processImportPage with 1 page returns done: true", async () => {
		setupJobMock({ current_page: 1 });
		setupCollectionMocks(1, 1, 3);

		const result = await processImportPage(JOB_ID);

		expect(result.done).toBe(true);
		expect(result.jobId).toBe(JOB_ID);
		expect(result.userId).toBe(USER_ID);
		expect(mockBroadcastProgress).toHaveBeenCalled();
	});

	test("processImportPage with multiple pages returns done: false", async () => {
		setupJobMock({ current_page: 1 });
		setupCollectionMocks(1, 3, 5);

		const result = await processImportPage(JOB_ID);

		expect(result.done).toBe(false);
		expect(result.jobId).toBe(JOB_ID);
	});

	test("processImportPage with completed job returns done with not-processing", async () => {
		setupJobMock({ status: "completed" });

		const result = await processImportPage(JOB_ID);

		expect(result.done).toBe(true);
		expect(result.reason).toBe("not-processing");
		// No API calls should be made
		expect(mockGetIdentity).not.toHaveBeenCalled();
	});

	test("processImportPage error handling marks job as failed", async () => {
		setupJobMock({ current_page: 1 });
		mockGetIdentity.mockRejectedValue(new Error("Discogs API rate limited"));

		const result = await processImportPage(JOB_ID);

		expect(result.done).toBe(true);
		expect(result.error).toBe(true);
		expect(mockBroadcastProgress).toHaveBeenCalledWith(
			USER_ID,
			expect.objectContaining({
				status: "failed",
			}),
		);
	});

	test("processImportPage broadcasts progress after processing", async () => {
		setupJobMock({ current_page: 1 });
		setupCollectionMocks(1, 1, 2);

		await processImportPage(JOB_ID);

		expect(mockBroadcastProgress).toHaveBeenCalledWith(
			USER_ID,
			expect.objectContaining({
				jobId: JOB_ID,
				type: "collection",
				status: "processing",
			}),
		);
	});

	test("processImportPage with job not found returns done", async () => {
		fromHandlers["import_jobs"] = createChainedMock({ data: null, error: { message: "not found" } });

		const result = await processImportPage(JOB_ID);

		expect(result.done).toBe(true);
		expect(result.reason).toBe("job-not-found");
	});
});

describe("computeRarityScore", () => {
	test("returns null for (0, 0)", () => {
		expect(computeRarityScore(0, 0)).toBeNull();
	});

	test("returns 0.5 for (100, 50)", () => {
		expect(computeRarityScore(100, 50)).toBe(0.5);
	});

	test("returns 1.0 for (0, 10) -- nobody has it", () => {
		expect(computeRarityScore(0, 10)).toBe(1.0);
	});

	test("returns 0.5 for (200, 100)", () => {
		expect(computeRarityScore(200, 100)).toBe(0.5);
	});

	test("returns 1.0 capped for (10, 100)", () => {
		// want/have = 10 -> capped at 1.0
		expect(computeRarityScore(10, 100)).toBe(1.0);
	});
});
