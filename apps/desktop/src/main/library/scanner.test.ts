import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";

// ---------- Module-level mocks ----------

const { mockReaddir, mockStat, mockExtractTrackMetadata, mockGetLibraryDb,
  mockInsertTracks, mockRemoveTracksByPaths, mockGetIndexedFileMtimes,
  mockGenerateTrackId, mockSetLibraryRoot } = vi.hoisted(() => ({
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
  mockExtractTrackMetadata: vi.fn(),
  mockGetLibraryDb: vi.fn(),
  mockInsertTracks: vi.fn(),
  mockRemoveTracksByPaths: vi.fn(),
  mockGetIndexedFileMtimes: vi.fn(),
  mockGenerateTrackId: vi.fn(),
  mockSetLibraryRoot: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readdir: mockReaddir,
  stat: mockStat,
}));

vi.mock("./db", () => ({
  getLibraryDb: mockGetLibraryDb,
  insertTracks: mockInsertTracks,
  removeTracksByPaths: mockRemoveTracksByPaths,
  getIndexedFileMtimes: mockGetIndexedFileMtimes,
  generateTrackId: mockGenerateTrackId,
  setLibraryRoot: mockSetLibraryRoot,
}));

vi.mock("./metadata-parser", () => ({
  extractTrackMetadata: mockExtractTrackMetadata,
}));

// Module under test
import { scanFolder } from "./scanner";

// ---------- helpers ----------

const mockDb = {};
let trackIdCounter = 0;

function defaultMeta() {
  return {
    artist: "Test Artist",
    album: "Test Album",
    title: "Test Title",
    year: 2020,
    trackNumber: 1,
    format: "FLAC",
    bitrate: 1411200,
    sampleRate: 44100,
    bitDepth: 16,
    duration: 300,
    artistConfidence: "high" as const,
    albumConfidence: "high" as const,
    titleConfidence: "high" as const,
    yearConfidence: "high" as const,
    trackConfidence: "high" as const,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  trackIdCounter = 0;
  mockGetLibraryDb.mockReturnValue(mockDb);
  mockGenerateTrackId.mockImplementation(() => `track-${++trackIdCounter}`);
  mockStat.mockResolvedValue({
    size: 1024,
    mtime: new Date("2024-01-01T00:00:00Z"),
  });
  mockExtractTrackMetadata.mockResolvedValue(defaultMeta());
});

describe("scanFolder", () => {
  it("filters only .flac, .wav, .aiff files", async () => {
    mockReaddir.mockResolvedValue([
      "track1.flac",
      "track2.wav",
      "track3.aiff",
      "track4.mp3",
      "track5.ogg",
      "readme.txt",
      "cover.jpg",
    ]);

    const progress = vi.fn();
    const result = await scanFolder("/music", progress);

    expect(result.filesFound).toBe(3);
    expect(result.filesProcessed).toBe(3);
    expect(mockExtractTrackMetadata).toHaveBeenCalledTimes(3);
  });

  it("progress callback reports correct filesFound count", async () => {
    mockReaddir.mockResolvedValue([
      "a.flac",
      "b.wav",
    ]);

    const progressCalls: Array<{ filesFound: number; filesProcessed: number }> = [];
    const progress = vi.fn((event) => progressCalls.push(event));

    await scanFolder("/music", progress);

    // Final progress emission should have all files
    const lastCall = progressCalls[progressCalls.length - 1];
    expect(lastCall.filesFound).toBe(2);
    expect(lastCall.filesProcessed).toBe(2);
  });

  it("collects errors without stopping the scan", async () => {
    mockReaddir.mockResolvedValue([
      "good.flac",
      "bad.flac",
      "also-good.wav",
    ]);

    mockExtractTrackMetadata
      .mockResolvedValueOnce(defaultMeta())
      .mockRejectedValueOnce(new Error("corrupt file"))
      .mockResolvedValueOnce(defaultMeta());

    const progress = vi.fn();
    const result = await scanFolder("/music", progress);

    expect(result.filesProcessed).toBe(3);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toBe("corrupt file");
    // insertTracks should still have been called with the 2 good tracks
    expect(mockInsertTracks).toHaveBeenCalled();
  });

  it("incremental scan detects new files and skips unchanged files", async () => {
    mockReaddir.mockResolvedValue([
      "existing.flac",
      "new.flac",
    ]);

    // existing.flac has same mtime
    mockGetIndexedFileMtimes.mockReturnValue(
      new Map([
        [path.join("/music", "existing.flac"), new Date("2024-01-01T00:00:00Z").toISOString()],
      ]),
    );

    // stat returns matching mtime for existing
    mockStat.mockResolvedValue({
      size: 1024,
      mtime: new Date("2024-01-01T00:00:00Z"),
    });

    const progress = vi.fn();
    const result = await scanFolder("/music", progress, { incremental: true });

    // Only the new file should be processed
    expect(result.filesFound).toBe(1);
    expect(mockExtractTrackMetadata).toHaveBeenCalledTimes(1);
  });

  it("incremental scan detects removed files", async () => {
    mockReaddir.mockResolvedValue([
      "remaining.flac",
    ]);

    mockGetIndexedFileMtimes.mockReturnValue(
      new Map([
        [path.join("/music", "remaining.flac"), new Date("2024-01-01T00:00:00Z").toISOString()],
        [path.join("/music", "deleted.flac"), new Date("2024-01-01T00:00:00Z").toISOString()],
      ]),
    );

    mockStat.mockResolvedValue({
      size: 1024,
      mtime: new Date("2024-01-01T00:00:00Z"),
    });

    const progress = vi.fn();
    await scanFolder("/music", progress, { incremental: true });

    expect(mockRemoveTracksByPaths).toHaveBeenCalledWith(mockDb, [path.join("/music", "deleted.flac")]);
  });

  it("calls setLibraryRoot with the root path", async () => {
    mockReaddir.mockResolvedValue([]);

    const progress = vi.fn();
    await scanFolder("/my/music/folder", progress);

    expect(mockSetLibraryRoot).toHaveBeenCalledWith(mockDb, "/my/music/folder");
  });
});
