import { beforeEach, describe, expect, test, vi } from "vitest";

// -- Mocks --

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
	computeRarityScore: vi.fn(() => 0.5),
}));

const mockBroadcastProgress = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/discogs/broadcast", () => ({
	broadcastProgress: (...args: unknown[]) => mockBroadcastProgress(...args),
}));

import { processImportPage } from "@/lib/discogs/import-worker";

describe("Delta sync", () => {
	const JOB_ID = "sync-job-uuid";
	const USER_ID = "sync-user-uuid";

	beforeEach(() => {
		vi.clearAllMocks();
		fromHandlers = {};
	});

	test("sync processes all new records on page and returns done: false for next page", async () => {
		// Create a sync job (type=sync, but processImportPage handles it the same as collection)
		const jobChain = createChainedMock({
			data: {
				id: JOB_ID,
				user_id: USER_ID,
				type: "sync",
				status: "processing",
				current_page: 1,
				processed_items: 0,
				total_items: 0,
				started_at: new Date().toISOString(),
			},
			error: null,
		});
		fromHandlers.import_jobs = jobChain;

		// All records are recent (would be new in a sync)
		const recentDate = new Date(2025, 11, 1).toISOString();
		mockGetIdentity.mockResolvedValue({
			data: { username: "syncuser", id: 99 },
		});
		mockGetReleases.mockResolvedValue({
			data: {
				releases: [
					{
						id: 1001,
						instance_id: 50001,
						date_added: recentDate,
						basic_information: {
							id: 1001,
							title: "New Record",
							artists: [{ name: "New Artist", id: 10010 }],
							year: 2024,
							genres: ["Electronic"],
							styles: ["House"],
							formats: [{ name: "Vinyl" }],
							cover_image: "",
							thumb: "",
						},
					},
				],
				pagination: { page: 1, pages: 3, per_page: 100, items: 250 },
			},
		});

		// Releases upsert + select("id").single() — returns the UUID in one round trip
		const releasesChain = createChainedMock();
		releasesChain.upsert = vi.fn().mockReturnValue({
			select: vi.fn().mockReturnValue({
				single: vi.fn().mockResolvedValue({
					data: { id: "release-uuid-sync" },
					error: null,
				}),
			}),
		});
		fromHandlers.releases = releasesChain;

		// Collection items -- no existing
		const collectionChain = createChainedMock({ data: null, error: null });
		collectionChain.insert = vi.fn().mockResolvedValue({ error: null });
		fromHandlers.collection_items = collectionChain;

		const result = await processImportPage(JOB_ID);

		// Not done yet since pagination.pages = 3
		expect(result.done).toBe(false);
		expect(result.type).toBe("sync");
	});

	test("sync with single page returns done: true", async () => {
		const jobChain = createChainedMock({
			data: {
				id: JOB_ID,
				user_id: USER_ID,
				type: "sync",
				status: "processing",
				current_page: 1,
				processed_items: 0,
				total_items: 0,
				started_at: new Date().toISOString(),
			},
			error: null,
		});
		fromHandlers.import_jobs = jobChain;

		mockGetIdentity.mockResolvedValue({
			data: { username: "syncuser", id: 99 },
		});
		mockGetReleases.mockResolvedValue({
			data: {
				releases: [
					{
						id: 2001,
						instance_id: 60001,
						date_added: new Date(2024, 0, 1).toISOString(),
						basic_information: {
							id: 2001,
							title: "Old Record",
							artists: [{ name: "Old Artist", id: 20010 }],
							year: 1990,
							genres: ["Jazz"],
							styles: ["Bebop"],
							formats: [{ name: "Vinyl" }],
							cover_image: "",
							thumb: "",
						},
					},
				],
				pagination: { page: 1, pages: 1, per_page: 100, items: 1 },
			},
		});

		const releasesChain = createChainedMock();
		releasesChain.upsert = vi.fn().mockReturnValue({
			select: vi.fn().mockReturnValue({
				single: vi.fn().mockResolvedValue({
					data: { id: "release-uuid-old" },
					error: null,
				}),
			}),
		});
		fromHandlers.releases = releasesChain;

		const collectionChain = createChainedMock({ data: null, error: null });
		collectionChain.insert = vi.fn().mockResolvedValue({ error: null });
		fromHandlers.collection_items = collectionChain;

		const result = await processImportPage(JOB_ID);

		// Single page -- done
		expect(result.done).toBe(true);
		expect(result.type).toBe("sync");
		expect(mockBroadcastProgress).toHaveBeenCalled();
	});

	test("sync with non-processing status stops immediately", async () => {
		const jobChain = createChainedMock({
			data: {
				id: JOB_ID,
				user_id: USER_ID,
				type: "sync",
				status: "completed",
				current_page: 1,
				processed_items: 50,
				total_items: 50,
				started_at: new Date().toISOString(),
			},
			error: null,
		});
		fromHandlers.import_jobs = jobChain;

		const result = await processImportPage(JOB_ID);

		expect(result.done).toBe(true);
		expect(result.reason).toBe("not-processing");
		expect(mockGetIdentity).not.toHaveBeenCalled();
	});
});
