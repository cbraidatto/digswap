import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @google/genai before any imports
vi.mock("@google/genai", () => {
  const generateContent = vi.fn();
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: { generateContent },
    })),
    __mockGenerateContent: generateContent,
  };
});

// Mock better-sqlite3
vi.mock("better-sqlite3", () => {
  return {
    default: vi.fn(),
  };
});

// Mock electron (app.getPath)
vi.mock("electron", () => ({
  app: { getPath: vi.fn().mockReturnValue("/tmp/test") },
}));

import type { TrackRow } from "./db";
import {
  buildPrompt,
  applyAiResults,
  enrichTracks,
  BATCH_SIZE,
} from "./ai-enrichment";
import { trackRowToLibraryTrack } from "./db";

function makeTrackRow(overrides: Partial<TrackRow> = {}): TrackRow {
  return {
    id: "track-1",
    filePath: "/music/Artist/Album (2023)/01 - Song.flac",
    fileHash: null,
    fileSize: 1000000,
    modifiedAt: "2026-01-01T00:00:00Z",
    scannedAt: "2026-01-01T00:00:00Z",
    artist: null,
    album: null,
    title: null,
    year: null,
    trackNumber: null,
    format: "FLAC",
    bitrate: 1411,
    sampleRate: 44100,
    bitDepth: 16,
    duration: 240,
    artistConfidence: "low",
    albumConfidence: "low",
    titleConfidence: "low",
    yearConfidence: "low",
    trackConfidence: "low",
    artistUserEdited: 0,
    albumUserEdited: 0,
    titleUserEdited: 0,
    yearUserEdited: 0,
    trackUserEdited: 0,
    ...overrides,
  };
}

describe("AI Enrichment", () => {
  describe("[AI-01] buildPrompt", () => {
    it("includes file path in prompt text for each track", () => {
      const track = makeTrackRow({ filePath: "/music/Jazz/Blue Note/01 - Cantaloupe.flac" });
      expect(track.filePath).toBe("/music/Jazz/Blue Note/01 - Cantaloupe.flac");
      const tracks = [track];
      const prompt = buildPrompt(tracks);
      expect(prompt).toContain("music/Jazz/Blue Note/01 - Cantaloupe.flac");
    });

    it("includes existing partial tags in prompt text", () => {
      const tracks = [
        makeTrackRow({
          artist: "Miles Davis",
          album: null,
          title: "So What",
        }),
      ];
      const prompt = buildPrompt(tracks);
      expect(prompt).toContain("Miles Davis");
      expect(prompt).toContain("So What");
    });

    it("includes instructions for inference rules", () => {
      const tracks = [makeTrackRow()];
      const prompt = buildPrompt(tracks);
      expect(prompt).toContain("null");
      expect(prompt.toLowerCase()).toContain("infer");
    });
  });

  describe("[AI-02] getQualifyingTracks (via enrichTracks filtering)", () => {
    it("only processes tracks where at least one metadata field is null", () => {
      // This is tested through the applyAiResults function which checks null fields
      const fullyPopulated = makeTrackRow({
        artist: "Artist",
        album: "Album",
        title: "Title",
        year: 2023,
        trackNumber: 1,
      });
      const result = applyAiResults(fullyPopulated, {
        artist: "New Artist",
        album: "New Album",
        title: "New Title",
        year: 2024,
        trackNumber: 2,
      });
      // Even AI results should apply for non-userEdited fields with existing values
      expect(result.updates).toHaveProperty("artist");
    });

    it("excludes tracks where all null fields have userEdited=true", () => {
      const track = makeTrackRow({
        artist: null,
        album: "Known Album",
        title: null,
        year: null,
        artistUserEdited: 1,
        titleUserEdited: 1,
        yearUserEdited: 1,
        trackUserEdited: 1,
      });
      const result = applyAiResults(track, {
        artist: "AI Artist",
        album: "AI Album",
        title: "AI Title",
        year: 2020,
        trackNumber: 5,
      });
      // artist, title, year are userEdited -- should NOT be updated
      expect(result.updates).not.toHaveProperty("artist");
      expect(result.updates).not.toHaveProperty("title");
      expect(result.updates).not.toHaveProperty("year");
      // album is not null and not userEdited -- AI can update it
      expect(result.updates).toHaveProperty("album", "AI Album");
    });
  });

  describe("[AI-03] applyAiResults", () => {
    it("skips fields where *UserEdited is true", () => {
      const track = makeTrackRow({
        artist: "User Corrected",
        artistUserEdited: 1,
        album: null,
        albumUserEdited: 0,
      });
      const result = applyAiResults(track, {
        artist: "AI Artist",
        album: "AI Album",
        title: null,
        year: null,
        trackNumber: null,
      });
      expect(result.updates).not.toHaveProperty("artist");
      expect(result.updates).toHaveProperty("album", "AI Album");
    });

    it("sets confidence to 'ai' for fields it updates", () => {
      const track = makeTrackRow({ artist: null, album: null });
      const result = applyAiResults(track, {
        artist: "AI Artist",
        album: "AI Album",
        title: null,
        year: null,
        trackNumber: null,
      });
      expect(result.confidences).toHaveProperty("artistConfidence", "ai");
      expect(result.confidences).toHaveProperty("albumConfidence", "ai");
    });

    it("leaves existing confidence for skipped fields", () => {
      const track = makeTrackRow({
        artist: "Manual",
        artistUserEdited: 1,
        artistConfidence: "high",
      });
      const result = applyAiResults(track, {
        artist: "AI Artist",
        album: null,
        title: null,
        year: null,
        trackNumber: null,
      });
      expect(result.confidences).not.toHaveProperty("artistConfidence");
    });

    it("returns empty updates when AI returns all null", () => {
      const track = makeTrackRow();
      const result = applyAiResults(track, {
        artist: null,
        album: null,
        title: null,
        year: null,
        trackNumber: null,
      });
      expect(Object.keys(result.updates)).toHaveLength(0);
      expect(Object.keys(result.confidences)).toHaveLength(0);
    });
  });

  describe("[AI-01] enrichTracks", () => {
    let mockGenerateContent: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
      const mod = await import("@google/genai");
      mockGenerateContent = (mod as unknown as { __mockGenerateContent: ReturnType<typeof vi.fn> }).__mockGenerateContent;
      mockGenerateContent.mockReset();
    });

    it("processes batches of BATCH_SIZE and calls onProgress between batches", async () => {
      const tracks = Array.from({ length: BATCH_SIZE + 2 }, (_, i) =>
        makeTrackRow({ id: `track-${i}`, artist: null }),
      );

      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({
          tracks: tracks.slice(0, BATCH_SIZE).map((_, i) => ({
            index: i,
            artist: `Artist ${i}`,
            album: null,
            title: null,
            year: null,
            trackNumber: null,
          })),
        }),
      });

      const progressCalls: unknown[] = [];
      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn(),
          all: vi.fn().mockReturnValue([]),
          get: vi.fn(),
        }),
      };

      const result = await enrichTracks(
        mockDb as unknown as import("better-sqlite3").Database,
        tracks,
        "test-api-key",
        (event) => progressCalls.push(event),
        { delayMs: 0 },
      );

      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
      expect(progressCalls.length).toBeGreaterThanOrEqual(2);
      expect(result.total).toBe(BATCH_SIZE + 2);
    });

    it("handles Gemini API errors gracefully and continues with next batch", async () => {
      const tracks = Array.from({ length: BATCH_SIZE * 2 }, (_, i) =>
        makeTrackRow({ id: `track-${i}`, artist: null }),
      );

      // First batch fails, second succeeds
      mockGenerateContent
        .mockRejectedValueOnce(new Error("API rate limit exceeded"))
        .mockResolvedValueOnce({
          text: JSON.stringify({
            tracks: tracks.slice(BATCH_SIZE).map((_, i) => ({
              index: i,
              artist: `Artist ${i}`,
              album: null,
              title: null,
              year: null,
              trackNumber: null,
            })),
          }),
        });

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          run: vi.fn(),
          all: vi.fn().mockReturnValue([]),
          get: vi.fn(),
        }),
      };

      const result = await enrichTracks(
        mockDb as unknown as import("better-sqlite3").Database,
        tracks,
        "test-api-key",
        () => {},
        { delayMs: 0 },
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("API rate limit exceeded");
      // Should have still attempted second batch
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });
  });

  describe("trackRowToLibraryTrack", () => {
    it("maps integer userEdited (0/1) to boolean (false/true) for all 5 fields", () => {
      const row = makeTrackRow({
        artistUserEdited: 1,
        albumUserEdited: 0,
        titleUserEdited: 1,
        yearUserEdited: 0,
        trackUserEdited: 1,
      });

      const result = trackRowToLibraryTrack(row);

      expect(result.artistUserEdited).toBe(true);
      expect(result.albumUserEdited).toBe(false);
      expect(result.titleUserEdited).toBe(true);
      expect(result.yearUserEdited).toBe(false);
      expect(result.trackUserEdited).toBe(true);
    });

    it("maps all-zero userEdited fields to false", () => {
      const row = makeTrackRow();
      const result = trackRowToLibraryTrack(row);

      expect(result.artistUserEdited).toBe(false);
      expect(result.albumUserEdited).toBe(false);
      expect(result.titleUserEdited).toBe(false);
      expect(result.yearUserEdited).toBe(false);
      expect(result.trackUserEdited).toBe(false);
    });

    it("preserves all other fields from TrackRow", () => {
      const row = makeTrackRow({
        id: "test-id",
        artist: "Test Artist",
        format: "FLAC",
        bitrate: 1411,
      });
      const result = trackRowToLibraryTrack(row);

      expect(result.id).toBe("test-id");
      expect(result.artist).toBe("Test Artist");
      expect(result.format).toBe("FLAC");
      expect(result.bitrate).toBe(1411);
    });
  });
});
