import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import { createHash } from "node:crypto";

// Module under test — will fail to import until implementation exists
import {
  extractSpecs,
  generatePreview,
  computeFileSha256,
  AudioPipelineError,
  type AudioSpecs,
  type PreviewResult,
} from "./ffmpeg-pipeline";

// ---------- helpers ----------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "ffpipe-test-"));
});

afterEach(async () => {
  await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

/** Create a small temp file with known content for SHA-256 testing. */
async function createFixtureFile(name: string, content: string): Promise<string> {
  const filePath = path.join(tmpDir, name);
  await fsp.writeFile(filePath, content, "utf-8");
  return filePath;
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
    // We mock child_process.execFile to simulate ffprobe JSON output
    const { execFile } = await import("node:child_process");
    const execFileMock = vi.spyOn(
      await import("node:child_process"),
      "execFile",
    );

    // Simulate ffprobe returning valid JSON for a 3-min FLAC
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

    execFileMock.mockImplementation(
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        // Handle both (cmd, args, cb) and (cmd, args, opts, cb) signatures
        const cb = typeof _opts === "function" ? _opts : callback;
        if (cb) cb(null, fakeProbeOutput, "");
        return {} as any;
      },
    );

    const filePath = await createFixtureFile("test.flac", "fake audio");
    const specs = await extractSpecs(filePath);

    expect(specs.format).toBe("flac");
    expect(specs.bitrate).toBe(1411200);
    expect(specs.sampleRate).toBe(44100);
    expect(specs.duration).toBeCloseTo(180.5, 1);

    execFileMock.mockRestore();
  });

  it("Test 2: falls back to music-metadata when FFmpeg probe fails", async () => {
    const execFileMock = vi.spyOn(
      await import("node:child_process"),
      "execFile",
    );

    // Make ffprobe fail
    execFileMock.mockImplementation(
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        const cb = typeof _opts === "function" ? _opts : callback;
        if (cb) cb(new Error("ffprobe failed"), "", "");
        return {} as any;
      },
    );

    // Mock music-metadata parseFile
    const mmModule = await import("music-metadata");
    const parseFileMock = vi.spyOn(mmModule, "parseFile");
    parseFileMock.mockResolvedValue({
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

    execFileMock.mockRestore();
    parseFileMock.mockRestore();
  });

  it("Test 3: throws AudioPipelineError FILE_TOO_SHORT when duration < 120s", async () => {
    const execFileMock = vi.spyOn(
      await import("node:child_process"),
      "execFile",
    );

    const shortProbeOutput = JSON.stringify({
      streams: [
        { codec_name: "mp3", sample_rate: "44100", bit_rate: "320000" },
      ],
      format: { duration: "60.0", bit_rate: "320000" },
    });

    execFileMock.mockImplementation(
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        const cb = typeof _opts === "function" ? _opts : callback;
        if (cb) cb(null, shortProbeOutput, "");
        return {} as any;
      },
    );

    const filePath = await createFixtureFile("short.mp3", "fake audio");

    await expect(extractSpecs(filePath)).rejects.toThrow(AudioPipelineError);
    await expect(extractSpecs(filePath)).rejects.toMatchObject({
      code: "FILE_TOO_SHORT",
    });

    execFileMock.mockRestore();
  });

  it("Test 4: throws AudioPipelineError PROBE_FAILED when both FFmpeg and music-metadata fail", async () => {
    const execFileMock = vi.spyOn(
      await import("node:child_process"),
      "execFile",
    );

    execFileMock.mockImplementation(
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        const cb = typeof _opts === "function" ? _opts : callback;
        if (cb) cb(new Error("ffprobe failed"), "", "");
        return {} as any;
      },
    );

    const mmModule = await import("music-metadata");
    const parseFileMock = vi.spyOn(mmModule, "parseFile");
    parseFileMock.mockRejectedValue(new Error("music-metadata failed"));

    const filePath = await createFixtureFile("bad.xyz", "not audio");

    await expect(extractSpecs(filePath)).rejects.toThrow(AudioPipelineError);
    await expect(extractSpecs(filePath)).rejects.toMatchObject({
      code: "PROBE_FAILED",
    });

    execFileMock.mockRestore();
    parseFileMock.mockRestore();
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
    const execFileMock = vi.spyOn(
      await import("node:child_process"),
      "execFile",
    );

    let capturedArgs: string[] = [];
    execFileMock.mockImplementation(
      (_cmd: any, args: any, _opts: any, callback: any) => {
        capturedArgs = args as string[];
        const cb = typeof _opts === "function" ? _opts : callback;
        if (cb) cb(null, "", "");
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
    execFileMock.mockRestore();
  });

  it("Test 6: offset is between 10% and 80% of duration", async () => {
    const execFileMock = vi.spyOn(
      await import("node:child_process"),
      "execFile",
    );

    let capturedArgs: string[] = [];
    execFileMock.mockImplementation(
      (_cmd: any, args: any, _opts: any, callback: any) => {
        capturedArgs = args as string[];
        const cb = typeof _opts === "function" ? _opts : callback;
        if (cb) cb(null, "", "");
        return {} as any;
      },
    );

    const inputFile = await createFixtureFile("input2.flac", "fake audio");

    // Test with random = 0 => offset should be 10% of 300 = 30
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const result = await generatePreview(inputFile, baseSpecs, tmpDir);
    const ssIndex = capturedArgs.indexOf("-ss");
    const offset = Number(capturedArgs[ssIndex + 1]);

    // 10% of 300 = 30
    expect(offset).toBeGreaterThanOrEqual(Math.floor(0.1 * baseSpecs.duration));
    expect(offset).toBeLessThanOrEqual(Math.floor(0.8 * baseSpecs.duration));
    expect(result.offsetSeconds).toBe(offset);

    randomSpy.mockRestore();
    execFileMock.mockRestore();
  });

  it("Test 7: output filename is derived from input basename + _preview + original extension", async () => {
    const execFileMock = vi.spyOn(
      await import("node:child_process"),
      "execFile",
    );

    execFileMock.mockImplementation(
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        const cb = typeof _opts === "function" ? _opts : callback;
        if (cb) cb(null, "", "");
        return {} as any;
      },
    );

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const inputFile = await createFixtureFile("my-track.flac", "fake audio");
    const result = await generatePreview(inputFile, baseSpecs, tmpDir);

    expect(path.basename(result.previewPath)).toBe("my-track_preview.flac");
    expect(path.dirname(result.previewPath)).toBe(tmpDir);

    randomSpy.mockRestore();
    execFileMock.mockRestore();
  });

  it("Test 8: throws AudioPipelineError FFMPEG_FAILED when spawn exits non-zero", async () => {
    const execFileMock = vi.spyOn(
      await import("node:child_process"),
      "execFile",
    );

    execFileMock.mockImplementation(
      (_cmd: any, _args: any, _opts: any, callback: any) => {
        const cb = typeof _opts === "function" ? _opts : callback;
        if (cb) cb(new Error("ffmpeg exited with code 1"), "", "Error output");
        return {} as any;
      },
    );

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const inputFile = await createFixtureFile("fail.flac", "fake audio");

    await expect(
      generatePreview(inputFile, baseSpecs, tmpDir),
    ).rejects.toThrow(AudioPipelineError);
    await expect(
      generatePreview(inputFile, baseSpecs, tmpDir),
    ).rejects.toMatchObject({ code: "FFMPEG_FAILED" });

    randomSpy.mockRestore();
    execFileMock.mockRestore();
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
    await expect(
      generatePreview(inputFile, shortSpecs, tmpDir),
    ).rejects.toMatchObject({ code: "FILE_TOO_SHORT" });
  });
});
