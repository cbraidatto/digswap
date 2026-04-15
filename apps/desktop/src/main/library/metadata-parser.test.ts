import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Module-level mocks ----------

const { mockParseFile, mockInferFromPath } = vi.hoisted(() => ({
  mockParseFile: vi.fn(),
  mockInferFromPath: vi.fn(),
}));

vi.mock("music-metadata", () => ({
  parseFile: mockParseFile,
}));

vi.mock("./folder-inference", () => ({
  inferFromPath: mockInferFromPath,
}));

// Module under test
import { extractTrackMetadata } from "./metadata-parser";

// ---------- helpers ----------

function makeMusicMetadata(overrides: {
  artist?: string;
  album?: string;
  title?: string;
  year?: number;
  trackNo?: number | null;
  codec?: string;
  bitrate?: number;
  sampleRate?: number;
  bitsPerSample?: number | null;
  duration?: number;
} = {}) {
  return {
    common: {
      artist: overrides.artist,
      album: overrides.album,
      title: overrides.title,
      year: overrides.year,
      track: { no: overrides.trackNo ?? null },
    },
    format: {
      codec: overrides.codec ?? "FLAC",
      container: "FLAC",
      bitrate: overrides.bitrate ?? 1411200,
      sampleRate: overrides.sampleRate ?? 44100,
      bitsPerSample: overrides.bitsPerSample ?? 16,
      duration: overrides.duration ?? 300,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInferFromPath.mockReturnValue(null);
});

describe("extractTrackMetadata", () => {
  it("tag-present fields get confidence 'high'", async () => {
    mockParseFile.mockResolvedValue(
      makeMusicMetadata({
        artist: "Tagged Artist",
        album: "Tagged Album",
        title: "Tagged Title",
        year: 2020,
        trackNo: 3,
      }),
    );
    mockInferFromPath.mockReturnValue({
      artist: "Inferred Artist",
      album: "Inferred Album",
      title: "Inferred Title",
      year: 1999,
      trackNumber: 5,
    });

    const result = await extractTrackMetadata("/root/music/file.flac", "/root/music");
    expect(result.artist).toBe("Tagged Artist");
    expect(result.artistConfidence).toBe("high");
    expect(result.album).toBe("Tagged Album");
    expect(result.albumConfidence).toBe("high");
    expect(result.title).toBe("Tagged Title");
    expect(result.titleConfidence).toBe("high");
    expect(result.year).toBe(2020);
    expect(result.yearConfidence).toBe("high");
    expect(result.trackNumber).toBe(3);
    expect(result.trackConfidence).toBe("high");
  });

  it("tag-missing but inferred fields get confidence 'low'", async () => {
    mockParseFile.mockResolvedValue(
      makeMusicMetadata({
        artist: undefined,
        album: undefined,
        title: undefined,
        year: undefined,
        trackNo: null,
      }),
    );
    mockInferFromPath.mockReturnValue({
      artist: "Inferred Artist",
      album: "Inferred Album",
      title: "Inferred Title",
      year: 1999,
      trackNumber: 5,
    });

    const result = await extractTrackMetadata("/root/music/file.flac", "/root/music");
    expect(result.artist).toBe("Inferred Artist");
    expect(result.artistConfidence).toBe("low");
    expect(result.album).toBe("Inferred Album");
    expect(result.albumConfidence).toBe("low");
    expect(result.title).toBe("Inferred Title");
    expect(result.titleConfidence).toBe("low");
    expect(result.year).toBe(1999);
    expect(result.yearConfidence).toBe("low");
    expect(result.trackNumber).toBe(5);
    expect(result.trackConfidence).toBe("low");
  });

  it("both tags and inference null: field is null, confidence is 'high'", async () => {
    mockParseFile.mockResolvedValue(
      makeMusicMetadata({
        artist: undefined,
        album: undefined,
        title: undefined,
        year: undefined,
        trackNo: null,
      }),
    );
    mockInferFromPath.mockReturnValue(null);

    const result = await extractTrackMetadata("/root/music/file.flac", "/root/music");
    expect(result.artist).toBeNull();
    expect(result.artistConfidence).toBe("high");
    expect(result.album).toBeNull();
    expect(result.albumConfidence).toBe("high");
    expect(result.title).toBeNull();
    expect(result.titleConfidence).toBe("high");
    expect(result.year).toBeNull();
    expect(result.yearConfidence).toBe("high");
    expect(result.trackNumber).toBeNull();
    expect(result.trackConfidence).toBe("high");
  });

  it("returns all required fields", async () => {
    mockParseFile.mockResolvedValue(
      makeMusicMetadata({ artist: "A", codec: "FLAC", bitrate: 1000, sampleRate: 48000, bitsPerSample: 24, duration: 200 }),
    );

    const result = await extractTrackMetadata("/root/music/file.flac", "/root/music");
    expect(result).toHaveProperty("artist");
    expect(result).toHaveProperty("album");
    expect(result).toHaveProperty("title");
    expect(result).toHaveProperty("year");
    expect(result).toHaveProperty("trackNumber");
    expect(result).toHaveProperty("format");
    expect(result).toHaveProperty("bitrate");
    expect(result).toHaveProperty("sampleRate");
    expect(result).toHaveProperty("bitDepth");
    expect(result).toHaveProperty("duration");
    expect(result).toHaveProperty("artistConfidence");
    expect(result).toHaveProperty("albumConfidence");
    expect(result).toHaveProperty("titleConfidence");
    expect(result).toHaveProperty("yearConfidence");
    expect(result).toHaveProperty("trackConfidence");
  });

  it("format/bitrate/sampleRate/bitDepth/duration come from music-metadata format", async () => {
    mockParseFile.mockResolvedValue(
      makeMusicMetadata({ codec: "WAV", bitrate: 1536000, sampleRate: 96000, bitsPerSample: 24, duration: 450 }),
    );

    const result = await extractTrackMetadata("/root/music/file.wav", "/root/music");
    expect(result.format).toBe("WAV");
    expect(result.bitrate).toBe(1536000);
    expect(result.sampleRate).toBe(96000);
    expect(result.bitDepth).toBe(24);
    expect(result.duration).toBe(450);
  });
});
