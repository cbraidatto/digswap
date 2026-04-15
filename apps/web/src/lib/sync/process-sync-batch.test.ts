import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dependencies before importing the module under test
vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
	db: {
		select: vi.fn(),
		insert: vi.fn(),
		update: vi.fn(),
	},
}));

import type { TrackSyncPayload } from "./process-sync-batch";

function makeTrack(overrides: Partial<TrackSyncPayload> = {}): TrackSyncPayload {
	return {
		localTrackId: "track-1",
		filePath: "/music/test.flac",
		artist: "The Beatles",
		album: "Abbey Road",
		title: "Come Together",
		year: 1969,
		trackNumber: 1,
		format: "FLAC",
		bitrate: 1411,
		sampleRate: 44100,
		duration: 259,
		artistConfidence: "high",
		albumConfidence: "high",
		...overrides,
	};
}

describe("processSyncBatch", () => {
	let processSyncBatch: typeof import("./process-sync-batch").processSyncBatch;
	let mockDb: { select: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
	let mockAdminClient: { from: ReturnType<typeof vi.fn> };

	beforeEach(async () => {
		vi.resetModules();

		// Re-setup mocks after reset
		const { createAdminClient } = await import("@/lib/supabase/admin");
		const dbModule = await import("@/lib/db");

		mockAdminClient = {
			from: vi.fn().mockReturnThis(),
		};
		vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as unknown as ReturnType<typeof createAdminClient>);

		mockDb = dbModule.db as unknown as typeof mockDb;

		// Default: select returns empty (no existing releases)
		const selectChain = {
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		};
		mockDb.select.mockReturnValue(selectChain);

		// Default: insert returns void-ish
		const insertChain = {
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ id: "new-release-id" }]),
				onConflictDoUpdate: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ id: "upserted-item-id" }]),
				}),
			}),
		};
		mockDb.insert.mockReturnValue(insertChain);

		// Default: update returns void
		const updateChain = {
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		};
		mockDb.update.mockReturnValue(updateChain);

		// Admin client from() for release inserts
		mockAdminClient.from.mockReturnValue({
			insert: vi.fn().mockReturnValue({
				select: vi.fn().mockResolvedValue({ data: [{ id: "admin-release-id" }], error: null }),
			}),
			update: vi.fn().mockReturnValue({
				eq: vi.fn().mockReturnValue({
					in: vi.fn().mockResolvedValue({ data: null, error: null }),
				}),
			}),
		});

		const mod = await import("./process-sync-batch");
		processSyncBatch = mod.processSyncBatch;
	});

	it("links to existing Discogs release when normalized match found", async () => {
		const { db } = await import("@/lib/db");
		const mDb = db as unknown as typeof mockDb;

		// Return an existing release with discogsId
		const selectFrom = vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue([{ id: "existing-discogs-release", discogsId: 12345 }]),
		});
		mDb.select.mockReturnValue({ from: selectFrom });

		// Upsert chain for collection items
		mDb.insert.mockReturnValue({
			values: vi.fn().mockReturnValue({
				onConflictDoUpdate: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ id: "item-1" }]),
				}),
			}),
		} as unknown as ReturnType<typeof vi.fn>);

		const result = await processSyncBatch("user-1", [makeTrack()], []);

		expect(result.ok).toBe(true);
		expect(result.linked).toBe(1);
		expect(result.created).toBe(0);
		expect(result.releaseMappings.length).toBeGreaterThan(0);
		expect(result.releaseMappings[0].releaseId).toBe("existing-discogs-release");
	});

	it("creates local-only release when no match found", async () => {
		const { db } = await import("@/lib/db");
		const mDb = db as unknown as typeof mockDb;

		// No existing releases
		mDb.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		});

		// Insert release returns new ID
		mDb.insert.mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ id: "new-local-release" }]),
				onConflictDoUpdate: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ id: "item-1" }]),
				}),
			}),
		} as unknown as ReturnType<typeof vi.fn>);

		const result = await processSyncBatch("user-1", [makeTrack()], []);

		expect(result.ok).toBe(true);
		expect(result.created).toBe(1);
		expect(result.releaseMappings).toContainEqual(
			expect.objectContaining({ releaseId: "new-local-release" }),
		);
	});

	it("soft-deletes collection items for deletedReleaseIds", async () => {
		const { db } = await import("@/lib/db");
		const mDb = db as unknown as typeof mockDb;

		const whereChain = vi.fn().mockResolvedValue([]);
		const setChain = vi.fn().mockReturnValue({ where: whereChain });
		mDb.update.mockReturnValue({ set: setChain } as unknown as ReturnType<typeof vi.fn>);

		const result = await processSyncBatch("user-1", [], ["release-to-delete"]);

		expect(result.ok).toBe(true);
		expect(result.deleted).toBe(1);
		expect(mDb.update).toHaveBeenCalled();
	});

	it("multiple tracks from same album share one release", async () => {
		const { db } = await import("@/lib/db");
		const mDb = db as unknown as typeof mockDb;

		// No existing releases
		mDb.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		});

		let insertCallCount = 0;
		mDb.insert.mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockImplementation(() => {
					insertCallCount++;
					return Promise.resolve([{ id: "shared-release" }]);
				}),
				onConflictDoUpdate: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ id: "item-1" }]),
				}),
			}),
		} as unknown as ReturnType<typeof vi.fn>);

		const tracks = [
			makeTrack({ localTrackId: "t1", title: "Come Together", trackNumber: 1 }),
			makeTrack({ localTrackId: "t2", title: "Something", trackNumber: 2 }),
		];

		const result = await processSyncBatch("user-1", tracks, []);

		expect(result.ok).toBe(true);
		// Should create only 1 release for both tracks
		expect(result.created).toBe(1);
		// But sync 2 tracks
		expect(result.synced).toBe(2);
	});

	it("returns releaseMappings for all processed albums", async () => {
		const { db } = await import("@/lib/db");
		const mDb = db as unknown as typeof mockDb;

		mDb.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		});

		let releaseCounter = 0;
		mDb.insert.mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockImplementation(() => {
					releaseCounter++;
					return Promise.resolve([{ id: `release-${releaseCounter}` }]);
				}),
				onConflictDoUpdate: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ id: "item-1" }]),
				}),
			}),
		} as unknown as ReturnType<typeof vi.fn>);

		const tracks = [
			makeTrack({ artist: "The Beatles", album: "Abbey Road" }),
			makeTrack({ localTrackId: "t2", artist: "Miles Davis", album: "Kind of Blue" }),
		];

		const result = await processSyncBatch("user-1", tracks, []);

		expect(result.releaseMappings).toHaveLength(2);
		const albumKeys = result.releaseMappings.map((m) => m.albumKey);
		expect(albumKeys).toContain("beatles::abbey road");
		expect(albumKeys).toContain("miles davis::kind of blue");
	});

	it("counts low-confidence items in dedupQueued", async () => {
		const { db } = await import("@/lib/db");
		const mDb = db as unknown as typeof mockDb;

		mDb.select.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([]),
			}),
		});

		mDb.insert.mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ id: "r1" }]),
				onConflictDoUpdate: vi.fn().mockReturnValue({
					returning: vi.fn().mockResolvedValue([{ id: "i1" }]),
				}),
			}),
		} as unknown as ReturnType<typeof vi.fn>);

		const track = makeTrack({ artistConfidence: "low" });
		const result = await processSyncBatch("user-1", [track], []);

		expect(result.dedupQueued).toBe(1);
	});
});
