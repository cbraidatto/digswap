import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TrackRow } from "./db";

// ── Hoisted mocks ──────────────────────────────────────────────────────
const {
  mockGetUnsyncedTracks,
  mockMarkTracksSynced,
  mockGetIndexedFilePaths,
  mockSetReleaseMappings,
  mockGetReleaseMappingsForPaths,
  mockMakeLocalAlbumKey,
  mockGetReleaseMapping,
  mockExistsSync,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetUnsyncedTracks: vi.fn<() => TrackRow[]>(() => []),
  mockMarkTracksSynced: vi.fn(),
  mockGetIndexedFilePaths: vi.fn<() => string[]>(() => []),
  mockSetReleaseMappings: vi.fn(),
  mockGetReleaseMappingsForPaths: vi.fn<() => string[]>(() => []),
  mockMakeLocalAlbumKey: vi.fn((artist: string | null, album: string | null) => {
    const a = (artist ?? "").toLowerCase().trim();
    const b = (album ?? "").toLowerCase().trim();
    return `${a}::${b}`;
  }),
  mockGetReleaseMapping: vi.fn<() => string | null>(() => null),
  mockExistsSync: vi.fn(() => true),
  mockFetch: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: mockExistsSync,
}));

vi.mock("./db", () => ({
  getUnsyncedTracks: mockGetUnsyncedTracks,
  markTracksSynced: mockMarkTracksSynced,
  getIndexedFilePaths: mockGetIndexedFilePaths,
  setReleaseMappings: mockSetReleaseMappings,
  getReleaseMappingsForPaths: mockGetReleaseMappingsForPaths,
  makeLocalAlbumKey: mockMakeLocalAlbumKey,
  getReleaseMapping: mockGetReleaseMapping,
}));

vi.stubGlobal("fetch", mockFetch);

// ── Helpers ────────────────────────────────────────────────────────────
function makeTrack(overrides: Partial<TrackRow> & { id: string; filePath: string }): TrackRow {
  return {
    id: overrides.id,
    filePath: overrides.filePath,
    fileHash: overrides.fileHash ?? null,
    fileSize: overrides.fileSize ?? 1000,
    modifiedAt: overrides.modifiedAt ?? "2026-04-14T10:00:00.000Z",
    scannedAt: overrides.scannedAt ?? "2026-04-14T10:00:00.000Z",
    artist: overrides.artist ?? "Test Artist",
    album: overrides.album ?? "Test Album",
    title: overrides.title ?? "Test Track",
    year: overrides.year ?? 2020,
    trackNumber: overrides.trackNumber ?? 1,
    format: overrides.format ?? "flac",
    bitrate: overrides.bitrate ?? 1411,
    sampleRate: overrides.sampleRate ?? 44100,
    bitDepth: overrides.bitDepth ?? 16,
    duration: overrides.duration ?? 180,
    artistConfidence: overrides.artistConfidence ?? "high",
    albumConfidence: overrides.albumConfidence ?? "high",
    titleConfidence: overrides.titleConfidence ?? "high",
    yearConfidence: overrides.yearConfidence ?? "high",
    trackConfidence: overrides.trackConfidence ?? "high",
  };
}

function successResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      synced: 0, created: 0, linked: 0, deleted: 0, dedupQueued: 0,
      errors: [], releaseMappings: [],
      ...overrides,
    }),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────
describe("sync-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("groupTracksByAlbum", () => {
    it("groups tracks with same normalized artist+album into one group", async () => {
      const { groupTracksByAlbum } = await import("./sync-manager");
      const tracks = [
        makeTrack({ id: "t1", filePath: "/a.flac", artist: "Miles Davis", album: "Kind of Blue", title: "So What", trackNumber: 1 }),
        makeTrack({ id: "t2", filePath: "/b.flac", artist: "Miles Davis", album: "Kind of Blue", title: "Freddie Freeloader", trackNumber: 2 }),
      ];

      const groups = groupTracksByAlbum(tracks);
      expect(Object.keys(groups)).toHaveLength(1);
      expect(Object.values(groups)[0]).toHaveLength(2);
    });

    it("creates separate groups for different albums", async () => {
      const { groupTracksByAlbum } = await import("./sync-manager");
      const tracks = [
        makeTrack({ id: "t1", filePath: "/a.flac", artist: "Miles Davis", album: "Kind of Blue" }),
        makeTrack({ id: "t2", filePath: "/b.flac", artist: "John Coltrane", album: "A Love Supreme" }),
      ];

      const groups = groupTracksByAlbum(tracks);
      expect(Object.keys(groups)).toHaveLength(2);
    });
  });

  describe("buildTrackPayload", () => {
    it("produces correct field mapping from TrackRow", async () => {
      const { buildTrackPayload } = await import("./sync-manager");
      const track = makeTrack({
        id: "t1", filePath: "/music/track1.flac", fileHash: "abc123",
        artist: "Test Artist", album: "Test Album", title: "Test Track",
        year: 2020, trackNumber: 3, format: "flac", bitrate: 1411,
        sampleRate: 44100, bitDepth: 16, duration: 240,
      });

      const payload = buildTrackPayload(track);
      expect(payload.localTrackId).toBe("t1");
      expect(payload.artist).toBe("Test Artist");
      expect(payload.album).toBe("Test Album");
      expect(payload.title).toBe("Test Track");
      expect(payload.format).toBe("flac");
      expect(payload.duration).toBe(240);
      expect(payload.bitrate).toBe(1411);
      expect(payload.sampleRate).toBe(44100);
    });
  });

  describe("startSync", () => {
    const fakeDb = {} as never; // sync-manager passes db to db.ts helpers (all mocked)

    it("returns error when not authenticated", async () => {
      const { startSync } = await import("./sync-manager");

      const result = await startSync(fakeDb, "http://localhost:3000", async () => null);

      expect(result.errors).toContain("Not authenticated — cannot sync");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("sends deletedReleaseIds (not hardcoded empty) when deleted files detected", async () => {
      const { startSync } = await import("./sync-manager");

      // No unsynced tracks
      mockGetUnsyncedTracks.mockReturnValue([]);
      // One indexed path that no longer exists
      mockGetIndexedFilePaths.mockReturnValue(["/music/deleted.flac"]);
      mockExistsSync.mockReturnValue(false);
      // Release mapping lookup returns a release ID
      mockGetReleaseMappingsForPaths.mockReturnValue(["rel-001"]);

      mockFetch.mockResolvedValueOnce(successResponse({ deleted: 1 }));

      const result = await startSync(fakeDb, "http://localhost:3000", async () => "test-token");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.deletedReleaseIds).toContain("rel-001");
      expect(callBody.deletedReleaseIds.length).toBeGreaterThan(0);
      expect(result.deleted).toBe(1);
    });

    it("calls setReleaseMappings after each successful batch with server-returned mappings", async () => {
      const { startSync } = await import("./sync-manager");

      const tracks = [makeTrack({ id: "t1", filePath: "/music/track1.flac", artist: "Miles Davis", album: "Kind of Blue" })];
      mockGetUnsyncedTracks.mockReturnValue(tracks);
      mockGetIndexedFilePaths.mockReturnValue(["/music/track1.flac"]);
      mockExistsSync.mockReturnValue(true);
      mockGetReleaseMappingsForPaths.mockReturnValue([]);

      const mappings = [{ albumKey: "miles davis::kind of blue", releaseId: "new-rel-uuid" }];
      mockFetch.mockResolvedValueOnce(successResponse({ synced: 1, created: 1, releaseMappings: mappings }));

      await startSync(fakeDb, "http://localhost:3000", async () => "test-token");

      expect(mockSetReleaseMappings).toHaveBeenCalledWith(fakeDb, mappings);
    });

    it("sends chunks of max 75 tracks per request", async () => {
      const { startSync } = await import("./sync-manager");

      // Create 100 tracks
      const tracks: TrackRow[] = [];
      for (let i = 0; i < 100; i++) {
        tracks.push(makeTrack({ id: `t${i}`, filePath: `/music/track${i}.flac`, artist: "Artist", album: "Album" }));
      }
      mockGetUnsyncedTracks.mockReturnValue(tracks);
      mockGetIndexedFilePaths.mockReturnValue(tracks.map(t => t.filePath));
      mockExistsSync.mockReturnValue(true);
      mockGetReleaseMappingsForPaths.mockReturnValue([]);

      mockFetch.mockResolvedValue(successResponse({ synced: 75 }));

      await startSync(fakeDb, "http://localhost:3000", async () => "test-token");

      // 100 tracks / 75 per batch = 2 batches
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const batch1Body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const batch2Body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(batch1Body.tracks).toHaveLength(75);
      expect(batch2Body.tracks).toHaveLength(25);
    });

    it("marks tracks as synced after each successful batch", async () => {
      const { startSync } = await import("./sync-manager");

      const tracks = [
        makeTrack({ id: "t1", filePath: "/music/a.flac" }),
        makeTrack({ id: "t2", filePath: "/music/b.flac" }),
      ];
      mockGetUnsyncedTracks.mockReturnValue(tracks);
      mockGetIndexedFilePaths.mockReturnValue(tracks.map(t => t.filePath));
      mockExistsSync.mockReturnValue(true);
      mockGetReleaseMappingsForPaths.mockReturnValue([]);

      mockFetch.mockResolvedValueOnce(successResponse({ synced: 2 }));

      await startSync(fakeDb, "http://localhost:3000", async () => "test-token");

      expect(mockMarkTracksSynced).toHaveBeenCalledWith(fakeDb, ["t1", "t2"]);
    });

    it("handles deletion-only sync when no unsynced tracks exist", async () => {
      const { startSync } = await import("./sync-manager");

      mockGetUnsyncedTracks.mockReturnValue([]);
      mockGetIndexedFilePaths.mockReturnValue(["/music/gone.flac"]);
      mockExistsSync.mockReturnValue(false);
      mockGetReleaseMappingsForPaths.mockReturnValue(["rel-999"]);

      mockFetch.mockResolvedValueOnce(successResponse({ deleted: 1 }));

      const result = await startSync(fakeDb, "http://localhost:3000", async () => "test-token");

      expect(result.deleted).toBe(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.tracks).toHaveLength(0);
      expect(body.deletedReleaseIds).toEqual(["rel-999"]);
    });

    it("sends deletedReleaseIds only with the first batch", async () => {
      const { startSync } = await import("./sync-manager");

      const tracks: TrackRow[] = [];
      for (let i = 0; i < 100; i++) {
        tracks.push(makeTrack({ id: `t${i}`, filePath: `/music/track${i}.flac` }));
      }
      mockGetUnsyncedTracks.mockReturnValue(tracks);
      mockGetIndexedFilePaths.mockReturnValue([...tracks.map(t => t.filePath), "/music/gone.flac"]);
      mockExistsSync.mockImplementation(((p: unknown) => String(p) !== "/music/gone.flac") as () => boolean);
      mockGetReleaseMappingsForPaths.mockReturnValue(["rel-del"]);

      mockFetch.mockResolvedValue(successResponse());

      await startSync(fakeDb, "http://localhost:3000", async () => "test-token");

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const batch1Body = JSON.parse(mockFetch.mock.calls[0][1].body);
      const batch2Body = JSON.parse(mockFetch.mock.calls[1][1].body);
      expect(batch1Body.deletedReleaseIds).toEqual(["rel-del"]);
      expect(batch2Body.deletedReleaseIds).toEqual([]);
    });
  });
});
