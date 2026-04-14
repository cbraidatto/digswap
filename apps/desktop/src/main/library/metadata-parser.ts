import type { MetadataConfidence } from "../../shared/ipc-types";
import { inferFromPath, type InferredMetadata } from "./folder-inference";

export interface TrackMetadata {
  artist: string | null;
  album: string | null;
  title: string | null;
  year: number | null;
  trackNumber: number | null;
  format: string;
  bitrate: number;
  sampleRate: number;
  bitDepth: number | null;
  duration: number;
  artistConfidence: MetadataConfidence;
  albumConfidence: MetadataConfidence;
  titleConfidence: MetadataConfidence;
  yearConfidence: MetadataConfidence;
  trackConfidence: MetadataConfidence;
}

export async function extractTrackMetadata(
  filePath: string,
  rootPath: string,
): Promise<TrackMetadata> {
  // Dynamic import -- music-metadata is pure ESM (same pattern as ffmpeg-pipeline.ts)
  const mm = await import("music-metadata");
  const metadata = await mm.parseFile(filePath);

  // Tag-sourced values
  const tagArtist = metadata.common.artist ?? null;
  const tagAlbum = metadata.common.album ?? null;
  const tagTitle = metadata.common.title ?? null;
  const tagYear = metadata.common.year ?? null;
  const tagTrackNumber = metadata.common.track?.no ?? null;

  // Format: use file extension (WAV, FLAC, AIFF) instead of codec name (PCM)
  const path = await import("node:path");
  const ext = path.extname(filePath).slice(1).toUpperCase();
  const format = ext || (metadata.format.container ?? "unknown");
  const bitrate = metadata.format.bitrate ?? 0;
  const sampleRate = metadata.format.sampleRate ?? 0;
  const bitDepth = metadata.format.bitsPerSample ?? null;
  const duration = metadata.format.duration ?? 0;

  // Folder inference for missing fields
  const relativePath = path.relative(rootPath, filePath);
  const inferred: InferredMetadata | null = inferFromPath(relativePath);

  // Merge: tags have priority, inferred fills gaps
  const artist = tagArtist ?? inferred?.artist ?? null;
  const album = tagAlbum ?? inferred?.album ?? null;
  const title = tagTitle ?? inferred?.title ?? null;
  const year = tagYear ?? inferred?.year ?? null;
  const trackNumber = tagTrackNumber ?? inferred?.trackNumber ?? null;

  // Confidence: high if from tags, low if from inference
  const artistConfidence: MetadataConfidence = tagArtist
    ? "high"
    : inferred?.artist
      ? "low"
      : "high";
  const albumConfidence: MetadataConfidence = tagAlbum
    ? "high"
    : inferred?.album
      ? "low"
      : "high";
  const titleConfidence: MetadataConfidence = tagTitle
    ? "high"
    : inferred?.title
      ? "low"
      : "high";
  const yearConfidence: MetadataConfidence =
    tagYear !== null
      ? "high"
      : inferred?.year !== undefined
        ? "low"
        : "high";
  const trackConfidence: MetadataConfidence =
    tagTrackNumber !== null
      ? "high"
      : inferred?.trackNumber !== undefined
        ? "low"
        : "high";

  return {
    artist,
    album,
    title,
    year,
    trackNumber,
    format,
    bitrate,
    sampleRate,
    bitDepth,
    duration,
    artistConfidence,
    albumConfidence,
    titleConfidence,
    yearConfidence,
    trackConfidence,
  };
}
