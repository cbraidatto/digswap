import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Module-level mocks ----------

const mockPrepare = vi.fn();
const mockExec = vi.fn();
const mockPragma = vi.fn();
const mockTransaction = vi.fn();
const mockRun = vi.fn();
const mockGet = vi.fn();
const mockAll = vi.fn();

const mockDb = {
  prepare: mockPrepare,
  exec: mockExec,
  pragma: mockPragma,
  transaction: mockTransaction,
  close: vi.fn(),
};

const { mockApp, mockRandomUUID } = vi.hoisted(() => ({
  mockApp: { getPath: vi.fn().mockReturnValue("/mock/userData") },
  mockRandomUUID: vi.fn().mockReturnValue("test-uuid-1234"),
}));

vi.mock("electron", () => ({
  app: mockApp,
}));

vi.mock("node:crypto", () => ({
  randomUUID: mockRandomUUID,
}));

vi.mock("better-sqlite3", () => ({
  default: vi.fn().mockImplementation(() => mockDb),
}));

// Module under test
import {
  insertTracks,
  removeTracksByPaths,
  getAllTracks,
  getLibraryRoot,
  setLibraryRoot,
  getIndexedFileMtimes,
  generateTrackId,
  makeLocalAlbumKey,
  getUnsyncedTracks,
  markTracksSynced,
  getIndexedFilePaths,
  getReleaseMapping,
  setReleaseMappings,
  getReleaseMappingsForPaths,
  getQualifyingTracks,
  updateTrackAiMetadata,
  updateTrackField,
  trackRowToLibraryTrack,
  type TrackRow,
} from "./db";

// ---------- Helpers ----------

function makeTrackRow(overrides: Partial<TrackRow> = {}): TrackRow {
  return {
    id: "track-1",
    filePath: "/music/test.flac",
    fileHash: null,
    fileSize: 1000,
    modifiedAt: "2026-04-15T00:00:00Z",
    scannedAt: "2026-04-15T00:00:00Z",
    artist: "Test Artist",
    album: "Test Album",
    title: "Test Track",
    year: 2024,
    trackNumber: 1,
    format: "flac",
    bitrate: 1411,
    sampleRate: 44100,
    bitDepth: 16,
    duration: 180,
    artistConfidence: "high",
    albumConfidence: "high",
    titleConfidence: "high",
    yearConfidence: "high",
    trackConfidence: "high",
    artistUserEdited: 0,
    albumUserEdited: 0,
    titleUserEdited: 0,
    yearUserEdited: 0,
    trackUserEdited: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrepare.mockReturnValue({ run: mockRun, get: mockGet, all: mockAll });
  mockTransaction.mockImplementation((fn: Function) => fn);
});

// ---------- Tests ----------

describe("generateTrackId", () => {
  it("returns a UUID from crypto.randomUUID", () => {
    const id = generateTrackId();
    expect(id).toBe("test-uuid-1234");
    expect(mockRandomUUID).toHaveBeenCalled();
  });
});

describe("insertTracks", () => {
  it("batches inserts in groups of 100", () => {
    const tracks = Array.from({ length: 150 }, (_, i) =>
      makeTrackRow({ id: `track-${i}` }),
    );
    insertTracks(mockDb as any, tracks);
    // transaction is called twice: batch 0-99, batch 100-149
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // run called for each track
    expect(mockRun).toHaveBeenCalledTimes(150);
  });

  it("handles empty array without errors", () => {
    insertTracks(mockDb as any, []);
    expect(mockRun).not.toHaveBeenCalled();
  });
});

describe("removeTracksByPaths", () => {
  it("deletes each path in a transaction", () => {
    removeTracksByPaths(mockDb as any, ["/a.flac", "/b.flac"]);
    expect(mockPrepare).toHaveBeenCalledWith(
      "DELETE FROM tracks WHERE filePath = ?",
    );
    expect(mockRun).toHaveBeenCalledTimes(2);
    expect(mockRun).toHaveBeenCalledWith("/a.flac");
    expect(mockRun).toHaveBeenCalledWith("/b.flac");
  });
});

describe("getAllTracks", () => {
  it("returns all tracks ordered by artist, album, trackNumber", () => {
    const mockTracks = [makeTrackRow()];
    mockAll.mockReturnValue(mockTracks);
    const result = getAllTracks(mockDb as any);
    expect(mockPrepare).toHaveBeenCalledWith(
      "SELECT * FROM tracks ORDER BY artist, album, trackNumber",
    );
    expect(result).toEqual(mockTracks);
  });
});

describe("getLibraryRoot / setLibraryRoot", () => {
  it("getLibraryRoot returns value when row exists", () => {
    mockGet.mockReturnValue({ value: "/my/music" });
    const result = getLibraryRoot(mockDb as any);
    expect(result).toBe("/my/music");
  });

  it("getLibraryRoot returns null when no row exists", () => {
    mockGet.mockReturnValue(undefined);
    const result = getLibraryRoot(mockDb as any);
    expect(result).toBeNull();
  });

  it("setLibraryRoot inserts or replaces root path", () => {
    setLibraryRoot(mockDb as any, "/new/music");
    expect(mockRun).toHaveBeenCalledWith("/new/music");
  });
});

describe("getIndexedFileMtimes", () => {
  it("returns a Map of filePath to modifiedAt", () => {
    mockAll.mockReturnValue([
      { filePath: "/a.flac", modifiedAt: "2026-01-01" },
      { filePath: "/b.flac", modifiedAt: "2026-02-02" },
    ]);
    const result = getIndexedFileMtimes(mockDb as any);
    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(2);
    expect(result.get("/a.flac")).toBe("2026-01-01");
    expect(result.get("/b.flac")).toBe("2026-02-02");
  });
});

describe("makeLocalAlbumKey", () => {
  it("normalizes artist::album to lowercase trimmed", () => {
    expect(makeLocalAlbumKey("  Pink Floyd  ", " The Wall ")).toBe(
      "pink floyd::the wall",
    );
  });

  it("handles null values", () => {
    expect(makeLocalAlbumKey(null, null)).toBe("::");
    expect(makeLocalAlbumKey("Artist", null)).toBe("artist::");
    expect(makeLocalAlbumKey(null, "Album")).toBe("::album");
  });
});

describe("getUnsyncedTracks", () => {
  it("queries tracks where syncedAt is null or stale", () => {
    mockAll.mockReturnValue([]);
    getUnsyncedTracks(mockDb as any);
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain("syncedAt IS NULL");
    expect(sql).toContain("syncedAt < modifiedAt");
  });
});

describe("markTracksSynced", () => {
  it("updates syncedAt for each track id", () => {
    markTracksSynced(mockDb as any, ["id-1", "id-2"]);
    expect(mockRun).toHaveBeenCalledTimes(2);
  });
});

describe("getIndexedFilePaths", () => {
  it("returns array of file paths", () => {
    mockAll.mockReturnValue([
      { filePath: "/a.flac" },
      { filePath: "/b.flac" },
    ]);
    const result = getIndexedFilePaths(mockDb as any);
    expect(result).toEqual(["/a.flac", "/b.flac"]);
  });
});

describe("getReleaseMapping / setReleaseMappings", () => {
  it("getReleaseMapping returns releaseId when found", () => {
    mockGet.mockReturnValue({ releaseId: "rel-123" });
    expect(getReleaseMapping(mockDb as any, "artist::album")).toBe("rel-123");
  });

  it("getReleaseMapping returns null when not found", () => {
    mockGet.mockReturnValue(undefined);
    expect(getReleaseMapping(mockDb as any, "missing")).toBeNull();
  });

  it("setReleaseMappings inserts each mapping", () => {
    setReleaseMappings(mockDb as any, [
      { albumKey: "a::b", releaseId: "r1" },
      { albumKey: "c::d", releaseId: "r2" },
    ]);
    expect(mockRun).toHaveBeenCalledTimes(2);
  });
});

describe("getReleaseMappingsForPaths", () => {
  it("looks up track, builds albumKey, returns unique releaseIds", () => {
    // First call: get track for path
    mockGet
      .mockReturnValueOnce({ artist: "Artist", album: "Album" })
      .mockReturnValueOnce({ releaseId: "rel-1" });
    const result = getReleaseMappingsForPaths(mockDb as any, ["/a.flac"]);
    expect(result).toEqual(["rel-1"]);
  });

  it("skips paths with no matching track", () => {
    mockGet.mockReturnValue(undefined);
    const result = getReleaseMappingsForPaths(mockDb as any, ["/missing.flac"]);
    expect(result).toEqual([]);
  });
});

describe("getQualifyingTracks", () => {
  it("queries tracks with null fields and userEdited=0", () => {
    mockAll.mockReturnValue([]);
    getQualifyingTracks(mockDb as any);
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain("artist IS NULL AND artistUserEdited = 0");
    expect(sql).toContain("album IS NULL AND albumUserEdited = 0");
    expect(sql).toContain("title IS NULL AND titleUserEdited = 0");
    expect(sql).toContain("year IS NULL AND yearUserEdited = 0");
  });
});

describe("updateTrackAiMetadata", () => {
  it("builds SET clause from updates and confidence overrides", () => {
    updateTrackAiMetadata(
      mockDb as any,
      "track-1",
      { artist: "AI Artist" },
      { artistConfidence: "ai" },
    );
    expect(mockRun).toHaveBeenCalledWith("AI Artist", "ai", "track-1");
  });

  it("does nothing when no updates or overrides", () => {
    updateTrackAiMetadata(mockDb as any, "track-1", {}, {});
    expect(mockRun).not.toHaveBeenCalled();
  });
});

describe("updateTrackField", () => {
  it("sets field, userEdited=1, and confidence=high for artist", () => {
    updateTrackField(mockDb as any, "track-1", "artist", "New Artist");
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain("artist = ?");
    expect(sql).toContain("artistUserEdited = 1");
    expect(sql).toContain("artistConfidence = 'high'");
    expect(mockRun).toHaveBeenCalledWith("New Artist", "track-1");
  });

  it("maps trackNumber to trackUserEdited and trackConfidence", () => {
    updateTrackField(mockDb as any, "track-1", "trackNumber", 5);
    const sql = mockPrepare.mock.calls[0][0] as string;
    expect(sql).toContain("trackNumber = ?");
    expect(sql).toContain("trackUserEdited = 1");
    expect(sql).toContain("trackConfidence = 'high'");
  });
});

describe("trackRowToLibraryTrack", () => {
  it("converts integer userEdited fields (0) to boolean false", () => {
    const row = makeTrackRow({
      artistUserEdited: 0,
      albumUserEdited: 0,
      titleUserEdited: 0,
      yearUserEdited: 0,
      trackUserEdited: 0,
    });
    const result = trackRowToLibraryTrack(row);
    expect(result.artistUserEdited).toBe(false);
    expect(result.albumUserEdited).toBe(false);
    expect(result.titleUserEdited).toBe(false);
    expect(result.yearUserEdited).toBe(false);
    expect(result.trackUserEdited).toBe(false);
  });

  it("converts integer userEdited fields (1) to boolean true", () => {
    const row = makeTrackRow({
      artistUserEdited: 1,
      albumUserEdited: 1,
      titleUserEdited: 1,
      yearUserEdited: 1,
      trackUserEdited: 1,
    });
    const result = trackRowToLibraryTrack(row);
    expect(result.artistUserEdited).toBe(true);
    expect(result.albumUserEdited).toBe(true);
    expect(result.titleUserEdited).toBe(true);
    expect(result.yearUserEdited).toBe(true);
    expect(result.trackUserEdited).toBe(true);
  });

  it("preserves all metadata fields correctly", () => {
    const row = makeTrackRow({
      artist: "Miles Davis",
      album: "Kind of Blue",
      artistConfidence: "ai",
    });
    const result = trackRowToLibraryTrack(row);
    expect(result.artist).toBe("Miles Davis");
    expect(result.album).toBe("Kind of Blue");
    expect(result.artistConfidence).toBe("ai");
    expect(result.id).toBe(row.id);
    expect(result.format).toBe(row.format);
  });
});
