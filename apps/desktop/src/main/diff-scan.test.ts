import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";

// ---------- Module-level mocks ----------

const { mockReaddir, mockStat, mockGetIndexedFileMtimes, mockGetLibraryRoot } =
  vi.hoisted(() => ({
    mockReaddir: vi.fn(),
    mockStat: vi.fn(),
    mockGetIndexedFileMtimes: vi.fn(),
    mockGetLibraryRoot: vi.fn(),
  }));

vi.mock("node:fs/promises", () => ({
  readdir: mockReaddir,
  stat: mockStat,
}));

vi.mock("./library/db", () => ({
  getIndexedFileMtimes: mockGetIndexedFileMtimes,
  getLibraryRoot: mockGetLibraryRoot,
}));

// Module under test
import { runDiffScan } from "./diff-scan";

const mockDb = {} as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runDiffScan", () => {
  it("returns empty result when no library root is set", async () => {
    mockGetLibraryRoot.mockReturnValue(null);
    const result = await runDiffScan(mockDb);
    expect(result).toEqual({
      added: 0,
      removed: 0,
      modified: 0,
      totalIndexed: 0,
      hasChanges: false,
    });
  });

  it("detects newly added audio files", async () => {
    mockGetLibraryRoot.mockReturnValue("/music");
    mockGetIndexedFileMtimes.mockReturnValue(new Map());
    mockReaddir.mockResolvedValue(["new-track.flac"]);
    mockStat.mockResolvedValue({
      mtime: new Date("2026-04-15T00:00:00Z"),
    });

    const result = await runDiffScan(mockDb);
    expect(result.added).toBe(1);
    expect(result.hasChanges).toBe(true);
  });

  it("detects removed files (in index but not on disk)", async () => {
    const root = "/music";
    mockGetLibraryRoot.mockReturnValue(root);
    const indexed = new Map([
      [path.join(root, "deleted.flac"), "2026-01-01T00:00:00Z"],
    ]);
    mockGetIndexedFileMtimes.mockReturnValue(indexed);
    mockReaddir.mockResolvedValue([]); // no files on disk

    const result = await runDiffScan(mockDb);
    expect(result.removed).toBe(1);
    expect(result.totalIndexed).toBe(1);
    expect(result.hasChanges).toBe(true);
  });

  it("detects modified files (mtime changed)", async () => {
    const root = "/music";
    const filePath = path.join(root, "track.flac");
    mockGetLibraryRoot.mockReturnValue(root);
    const indexed = new Map([[filePath, "2026-01-01T00:00:00Z"]]);
    mockGetIndexedFileMtimes.mockReturnValue(indexed);
    mockReaddir.mockResolvedValue(["track.flac"]);
    mockStat.mockResolvedValue({
      mtime: new Date("2026-04-15T00:00:00Z"), // different from indexed
    });

    const result = await runDiffScan(mockDb);
    expect(result.modified).toBe(1);
    expect(result.hasChanges).toBe(true);
  });

  it("reports no changes when disk matches index", async () => {
    const root = "/music";
    const filePath = path.join(root, "track.flac");
    const mtime = "2026-01-01T00:00:00.000Z";
    mockGetLibraryRoot.mockReturnValue(root);
    const indexed = new Map([[filePath, mtime]]);
    mockGetIndexedFileMtimes.mockReturnValue(indexed);
    mockReaddir.mockResolvedValue(["track.flac"]);
    mockStat.mockResolvedValue({
      mtime: new Date(mtime),
    });

    const result = await runDiffScan(mockDb);
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.modified).toBe(0);
    expect(result.hasChanges).toBe(false);
  });

  it("ignores non-audio files", async () => {
    mockGetLibraryRoot.mockReturnValue("/music");
    mockGetIndexedFileMtimes.mockReturnValue(new Map());
    mockReaddir.mockResolvedValue([
      "photo.jpg",
      "readme.txt",
      "track.flac",
      "song.mp3", // not in AUDIO_EXTENSIONS (.flac, .wav, .aiff only)
    ]);
    mockStat.mockResolvedValue({
      mtime: new Date("2026-04-15T00:00:00Z"),
    });

    const result = await runDiffScan(mockDb);
    // Only track.flac should be counted
    expect(result.added).toBe(1);
  });

  it("handles stat errors gracefully", async () => {
    mockGetLibraryRoot.mockReturnValue("/music");
    mockGetIndexedFileMtimes.mockReturnValue(new Map());
    mockReaddir.mockResolvedValue(["track.flac"]);
    mockStat.mockRejectedValue(new Error("ENOENT"));

    const result = await runDiffScan(mockDb);
    // stat failed, so file is not counted as added
    expect(result.added).toBe(0);
    expect(result.hasChanges).toBe(false);
  });

  it("handles mixed add/remove/modify scenario", async () => {
    const root = "/music";
    mockGetLibraryRoot.mockReturnValue(root);
    const indexed = new Map([
      [path.join(root, "existing.flac"), "2026-01-01T00:00:00.000Z"],
      [path.join(root, "modified.wav"), "2026-01-01T00:00:00.000Z"],
      [path.join(root, "deleted.aiff"), "2026-01-01T00:00:00.000Z"],
    ]);
    mockGetIndexedFileMtimes.mockReturnValue(indexed);
    mockReaddir.mockResolvedValue([
      "existing.flac",
      "modified.wav",
      "new-song.flac",
    ]);
    mockStat
      .mockResolvedValueOnce({ mtime: new Date("2026-01-01T00:00:00.000Z") }) // existing — same
      .mockResolvedValueOnce({ mtime: new Date("2026-04-15T00:00:00.000Z") }) // modified — different
      .mockResolvedValueOnce({ mtime: new Date("2026-04-15T00:00:00.000Z") }); // new

    const result = await runDiffScan(mockDb);
    expect(result.added).toBe(1);
    expect(result.modified).toBe(1);
    expect(result.removed).toBe(1);
    expect(result.totalIndexed).toBe(3);
    expect(result.hasChanges).toBe(true);
  });
});
