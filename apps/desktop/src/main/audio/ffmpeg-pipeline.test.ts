import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fsp from "node:fs/promises";
import os from "node:os";
import { createHash } from "node:crypto";

// ---------- Module-level mocks ----------

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

vi.mock("music-metadata", () => ({
  parseFile: vi.fn(),
}));

// Import mocked modules
import { execFile } from "node:child_process";
import { parseFile } from "music-metadata";

// Module under test
import {
  extractSpecs,
  generatePreview,
  computeFileSha256,
  AudioPipelineError,
  type AudioSpecs,
  type PreviewResult,
} from "./ffmpeg-pipeline";

// ---------- helpers ----------

const mockedExecFile = vi.mocked(execFile);
const mockedParseFile = vi.mocked(parseFile);

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "ffpipe-test-"));
  vi.clearAllMocks();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

/** Create a small temp file with known content for SHA-256 testing. */
async function createFixtureFile(
  name: string,
  content: string,
): Promise<string> {
  const filePath = path.join(tmpDir, name);
  await fsp.writeFile(filePath, content, "utf-8");
  return filePath;
}

/**
 * Helper to make the mocked execFile invoke its callback with the given result.
 * Handles both (cmd, args, cb) and (cmd, args, opts, cb) overloads of execFile.
 */
function mockExecFileSuccess(stdout: string, stderr = "") {
  mockedExecFile.mockImplementation(
    (...args: unknown[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === "function") {
        cb(null, stdout, stderr);
      }
      return {} as any;
    },
  );
}

function mockExecFileFailure(error: Error) {
  mockedExecFile.mockImplementation(
    (...args: unknown[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === "function") {
        cb(error, "", "");
      }
      return {} as any;
    },
  );
}

// ---------- AudioPipelineError ----------

describe("AudioPipelineError", () => {
  it("Test 12: is instanceof Error with code property", () => {
    const err = new AudioPipelineError("FILE_TOO_SHORT");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("FILE_TOO_SHORT");
    expect(err.name).toBe("AudioPipelineError");

    const err2 = new AudioPipelineError("PROBE_FAILED");
    expect(err2.code).toBe("PROBE_FAILED");

    const err3 = new AudioPipelineError("FFMPEG_FAILED");
    expect(err3.code).toBe("FFMPEG_FAILED");
  });
});

// ---------- computeFileSha256 ----------

describe("computeFileSha256", () => {
  it("Test 10: returns lowercase hex SHA-256 for a known fixture", async () => {
    const content = "hello world from ffmpeg-pipeline test";
    const filePath = await createFixtureFile("known.bin", content);

    const expected = createHash("sha256").update(content).digest("hex");
    const result = await computeFileSha256(filePath);

    expect(result).toBe(expected);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it("Test 11: rejects with ENOENT when file does not exist", async () => {
    const badPath = path.join(tmpDir, "nonexistent.flac");
    await expect(computeFileSha256(badPath)).rejects.toThrow(/ENOENT/);
  });
});

// ---------- extractSpecs ----------

describe("extractSpecs", () => {
  it("Test 1: returns correct format/bitrate/sampleRate/duration for a valid audio file", async () => {
    const fakeProbeOutput = JSON.stringify({
      streams: [
        {
          codec_name: "flac",
          sample_rate: "44100",
          bit_rate: "1411200",
        },
      ],
      format: {
        duration: "180.5",
        bit_rate: "1411200",
      },
    });

    mockExecFileSuccess(fakeProbeOutput);

    const filePath = await createFixtureFile("test.flac", "fake audio");
    const specs = await extractSpecs(filePath);

    expect(specs.format).toBe("flac");
    expect(specs.bitrate).toBe(1411200);
    expect(specs.sampleRate).toBe(44100);
    expect(specs.duration).toBeCloseTo(180.5, 1);
  });

  it("Test 2: falls back to music-metadata when FFmpeg probe fails", async () => {
    // Make ffprobe fail
    mockExecFileFailure(new Error("ffprobe failed"));

    // Mock music-metadata parseFile success
    mockedParseFile.mockResolvedValue({
      format: {
        container: "FLAC",
        codec: "FLAC",
        sampleRate: 48000,
        bitrate: 1536000,
        duration: 200.0,
        numberOfChannels: 2,
        bitsPerSample: 16,
        lossless: true,
      },
      common: {} as any,
      native: {} as any,
      quality: {} as any,
    } as any);

    const filePath = await createFixtureFile("fallback.flac", "fake audio");
    const specs = await extractSpecs(filePath);

    expect(specs.format).toBe("FLAC");
    expect(specs.sampleRate).toBe(48000);
    expect(specs.bitrate).toBe(1536000);
    expect(specs.duration).toBeCloseTo(200.0, 1);
  });

  it("Test 3: throws AudioPipelineError FILE_TOO_SHORT when duration < 120s", async () => {
    const shortProbeOutput = JSON.stringify({
      streams: [
        { codec_name: "mp3", sample_rate: "44100", bit_rate: "320000" },
      ],
      format: { duration: "60.0", bit_rate: "320000" },
    });

    mockExecFileSuccess(shortProbeOutput);

    const filePath = await createFixtureFile("short.mp3", "fake audio");

    await expect(extractSpecs(filePath)).rejects.toThrow(AudioPipelineError);
    try {
      await extractSpecs(filePath);
    } catch (e) {
      expect(e).toBeInstanceOf(AudioPipelineError);
      expect((e as AudioPipelineError).code).toBe("FILE_TOO_SHORT");
    }
  });

  it("Test 4: throws AudioPipelineError PROBE_FAILED when both FFmpeg and music-metadata fail", async () => {
    // Make ffprobe fail
    mockExecFileFailure(new Error("ffprobe failed"));

    // Make music-metadata also fail
    mockedParseFile.mockRejectedValue(new Error("music-metadata failed"));

    const filePath = await createFixtureFile("bad.xyz", "not audio");

    await expect(extractSpecs(filePath)).rejects.toThrow(AudioPipelineError);
    try {
      await extractSpecs(filePath);
    } catch (e) {
      expect(e).toBeInstanceOf(AudioPipelineError);
      expect((e as AudioPipelineError).code).toBe("PROBE_FAILED");
    }
  });
});

// ---------- generatePreview ----------

describe("generatePreview", () => {
  const baseSpecs: AudioSpecs = {
    format: "flac",
    bitrate: 1411200,
    sampleRate: 44100,
    duration: 300,
  };

  it("Test 5: calls FFmpeg with -ss <offset> -t 120 -c copy (no transcoding)", async () => {
    let capturedArgs: string[] = [];
    mockedExecFile.mockImplementation(
      (...args: unknown[]) => {
        // args[1] is the arguments array
        capturedArgs = args[1] as string[];
        const cb = args[args.length - 1];
        if (typeof cb === "function") {
          cb(null, "", "");
        }
        return {} as any;
      },
    );

    const inputFile = await createFixtureFile("input.flac", "fake audio");

    // Seed Math.random to get predictable offset
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    await generatePreview(inputFile, baseSpecs, tmpDir);

    expect(capturedArgs).toContain("-t");
    expect(capturedArgs).toContain("120");
    expect(capturedArgs).toContain("-c");
    expect(capturedArgs).toContain("copy");
    expect(capturedArgs).toContain("-ss");

    // Verify -ss value is present (offset)
    const ssIndex = capturedArgs.indexOf("-ss");
    expect(ssIndex).toBeGreaterThanOrEqual(0);
    const offsetStr = capturedArgs[ssIndex + 1];
    expect(Number(offsetStr)).toBeGreaterThan(0);

    randomSpy.mockRestore();
  });

  it("Test 6: offset is between 10% and 80% of duration", async () => {
    let capturedArgs: string[] = [];
    mockedExecFile.mockImplementation(
      (...args: unknown[]) => {
        capturedArgs = args[1] as string[];
        const cb = args[args.length - 1];
        if (typeof cb === "function") {
          cb(null, "", "");
        }
        return {} as any;
      },
    );

    const inputFile = await createFixtureFile("input2.flac", "fake audio");

    // Test with random = 0 => offset = floor((0 * 0.7 + 0.1) * 300) = floor(30) = 30
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const result = await generatePreview(inputFile, baseSpecs, tmpDir);
    const ssIndex = capturedArgs.indexOf("-ss");
    const offset = Number(capturedArgs[ssIndex + 1]);

    // offset should be floor(0.1 * 300) = 30
    expect(offset).toBe(30);
    expect(offset).toBeGreaterThanOrEqual(Math.floor(0.1 * baseSpecs.duration));
    expect(offset).toBeLessThanOrEqual(Math.floor(0.8 * baseSpecs.duration));
    expect(result.offsetSeconds).toBe(offset);

    randomSpy.mockRestore();
  });

  it("Test 7: output filename is derived from input basename + _preview + original extension", async () => {
    mockExecFileSuccess("", "");

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const inputFile = await createFixtureFile("my-track.flac", "fake audio");
    const result = await generatePreview(inputFile, baseSpecs, tmpDir);

    expect(path.basename(result.previewPath)).toBe("my-track_preview.flac");
    expect(path.dirname(result.previewPath)).toBe(tmpDir);

    randomSpy.mockRestore();
  });

  it("Test 8: throws AudioPipelineError FFMPEG_FAILED when spawn exits non-zero", async () => {
    mockExecFileFailure(new Error("ffmpeg exited with code 1"));

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const inputFile = await createFixtureFile("fail.flac", "fake audio");

    await expect(
      generatePreview(inputFile, baseSpecs, tmpDir),
    ).rejects.toThrow(AudioPipelineError);

    try {
      await generatePreview(inputFile, baseSpecs, tmpDir);
    } catch (e) {
      expect(e).toBeInstanceOf(AudioPipelineError);
      expect((e as AudioPipelineError).code).toBe("FFMPEG_FAILED");
    }

    randomSpy.mockRestore();
  });

  it("Test 9: rejects when specs.duration < 120", async () => {
    const shortSpecs: AudioSpecs = {
      format: "mp3",
      bitrate: 320000,
      sampleRate: 44100,
      duration: 90,
    };

    const inputFile = await createFixtureFile("tooshort.mp3", "fake audio");

    await expect(
      generatePreview(inputFile, shortSpecs, tmpDir),
    ).rejects.toThrow(AudioPipelineError);

    try {
      await generatePreview(inputFile, shortSpecs, tmpDir);
    } catch (e) {
      expect(e).toBeInstanceOf(AudioPipelineError);
      expect((e as AudioPipelineError).code).toBe("FILE_TOO_SHORT");
    }
  });
});
