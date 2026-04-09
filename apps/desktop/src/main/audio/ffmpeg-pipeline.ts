import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ---------- Types ----------

export interface AudioSpecs {
  format: string;
  bitrate: number;
  sampleRate: number;
  duration: number;
}

export interface PreviewResult {
  previewPath: string;
  offsetSeconds: number;
  durationSeconds: number;
}

export type AudioPipelineErrorCode =
  | "FILE_TOO_SHORT"
  | "PROBE_FAILED"
  | "FFMPEG_FAILED";

// ---------- Error class ----------

export class AudioPipelineError extends Error {
  public readonly code: AudioPipelineErrorCode;

  constructor(code: AudioPipelineErrorCode, message?: string) {
    super(message ?? `AudioPipelineError: ${code}`);
    this.code = code;
    this.name = "AudioPipelineError";
  }
}

// ---------- FFmpeg binary path ----------

function getFfmpegPath(): string {
  // ffmpeg-static exports the absolute path to the bundled ffmpeg binary
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpegPath = require("ffmpeg-static") as string;
  if (!ffmpegPath) {
    throw new AudioPipelineError(
      "FFMPEG_FAILED",
      "ffmpeg-static binary path is not available",
    );
  }
  return ffmpegPath;
}

// ---------- Promisified execFile ----------

/**
 * Wraps execFile in a promise. We call the imported `execFile` each time
 * rather than promisifying once at module load, so that vi.mock replacements
 * take effect in tests.
 */
function execFileAsync(
  cmd: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout: stdout as string, stderr: stderr as string });
    });
  });
}

// ---------- extractSpecs ----------

interface FfprobeStream {
  codec_name?: string;
  sample_rate?: string;
  bit_rate?: string;
}

interface FfprobeFormat {
  duration?: string;
  bit_rate?: string;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
  format?: FfprobeFormat;
}

/**
 * Extract audio specifications from a file using FFmpeg probe (ffprobe).
 * Falls back to music-metadata if ffprobe fails.
 * Throws FILE_TOO_SHORT if duration < 120 seconds.
 * Throws PROBE_FAILED if both methods fail.
 */
export async function extractSpecs(filePath: string): Promise<AudioSpecs> {
  let specs: AudioSpecs | null = null;

  // Attempt 1: FFmpeg probe via ffprobe
  try {
    specs = await probeWithFfmpeg(filePath);
  } catch {
    // ffprobe failed, try fallback
  }

  // Attempt 2: music-metadata fallback
  if (!specs) {
    try {
      specs = await probeWithMusicMetadata(filePath);
    } catch {
      // both failed
    }
  }

  if (!specs) {
    throw new AudioPipelineError(
      "PROBE_FAILED",
      `Failed to extract audio specs from: ${filePath}`,
    );
  }

  if (specs.duration < 120) {
    throw new AudioPipelineError(
      "FILE_TOO_SHORT",
      `Audio file is ${specs.duration}s, minimum is 120s`,
    );
  }

  return specs;
}

async function probeWithFfmpeg(filePath: string): Promise<AudioSpecs> {
  const ffmpegPath = getFfmpegPath();

  // ffmpeg-static ships ffmpeg only; construct ffprobe path from it
  const ffprobePath = ffmpegPath.replace(/ffmpeg(\.exe)?$/, "ffprobe$1");

  const { stdout } = await execFileAsync(ffprobePath, [
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_streams",
    "-show_format",
    filePath,
  ]);

  const data: FfprobeOutput = JSON.parse(stdout);
  const audioStream = data.streams?.find(
    (s) => s.codec_name !== undefined,
  );
  const format = data.format;

  if (!audioStream || !format) {
    throw new Error("No audio stream or format data found");
  }

  return {
    format: audioStream.codec_name ?? "unknown",
    bitrate: Number(audioStream.bit_rate || format.bit_rate || 0),
    sampleRate: Number(audioStream.sample_rate || 0),
    duration: Number(format.duration || 0),
  };
}

async function probeWithMusicMetadata(filePath: string): Promise<AudioSpecs> {
  // music-metadata exports parseFile from its Node entry point (lib/index.js)
  // but the default export condition (lib/core.d.ts) omits it from types.
  // At runtime under Node the correct entry resolves, so we cast here.
  const mm = (await import("music-metadata")) as typeof import("music-metadata") & {
    parseFile: (path: string) => Promise<{ format: Record<string, unknown> }>;
  };
  const metadata = await mm.parseFile(filePath);

  const fmt = metadata.format as {
    codec?: string;
    container?: string;
    sampleRate?: number;
    bitrate?: number;
    duration?: number;
  };

  if (!fmt.duration) {
    throw new Error("music-metadata could not determine duration");
  }

  return {
    format: fmt.codec || fmt.container || "unknown",
    bitrate: fmt.bitrate || 0,
    sampleRate: fmt.sampleRate || 0,
    duration: fmt.duration,
  };
}

// ---------- generatePreview ----------

const PREVIEW_DURATION_SECONDS = 120;

/**
 * Generate a 2-minute preview clip using FFmpeg stream copy (no transcoding).
 * The offset is randomly placed between 10% and 80% of the source duration.
 * Throws FILE_TOO_SHORT if specs.duration < 120.
 * Throws FFMPEG_FAILED if the ffmpeg process exits with non-zero code.
 */
export async function generatePreview(
  filePath: string,
  specs: AudioSpecs,
  outputDir: string,
): Promise<PreviewResult> {
  if (specs.duration < PREVIEW_DURATION_SECONDS) {
    throw new AudioPipelineError(
      "FILE_TOO_SHORT",
      `Cannot generate preview: duration ${specs.duration}s is less than ${PREVIEW_DURATION_SECONDS}s`,
    );
  }

  const ffmpegPath = getFfmpegPath();

  // Compute offset: random between 10% and 80% of duration
  const offsetSeconds = Math.floor(
    (Math.random() * 0.7 + 0.1) * specs.duration,
  );

  // Build output path: basename_preview.ext
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const previewPath = path.join(outputDir, `${base}_preview${ext}`);

  try {
    await execFileAsync(ffmpegPath, [
      "-ss",
      String(offsetSeconds),
      "-i",
      filePath,
      "-t",
      String(PREVIEW_DURATION_SECONDS),
      "-c",
      "copy",
      "-y",
      previewPath,
    ]);
  } catch (error) {
    throw new AudioPipelineError(
      "FFMPEG_FAILED",
      `FFmpeg preview generation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return {
    previewPath,
    offsetSeconds,
    durationSeconds: PREVIEW_DURATION_SECONDS,
  };
}

// ---------- computeFileSha256 ----------

/**
 * Compute SHA-256 hash of a file using streaming Node.js crypto.
 * Returns lowercase hex string.
 * Pattern matches apps/desktop/src/main/webrtc/chunked-transfer.ts.
 */
export async function computeFileSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = fs.createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}
