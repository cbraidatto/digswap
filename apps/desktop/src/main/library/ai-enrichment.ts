import type Database from "better-sqlite3";
import type { EnrichProgressEvent, EnrichResult } from "../../shared/ipc-types";
import type { TrackRow } from "./db";
import { updateTrackAiMetadata } from "./db";

export const MODEL = "gemini-2.5-flash";
export const BATCH_SIZE = 8;
export const INTER_BATCH_DELAY_MS = 6500;

interface AiTrackInference {
  index: number;
  artist: string | null;
  album: string | null;
  title: string | null;
  year: number | null;
  trackNumber: number | null;
}

interface AiResponse {
  tracks: AiTrackInference[];
}

const responseJsonSchema = {
  type: "object" as const,
  properties: {
    tracks: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          index: { type: "number" as const },
          artist: { type: ["string", "null"] as const },
          album: { type: ["string", "null"] as const },
          title: { type: ["string", "null"] as const },
          year: { type: ["number", "null"] as const },
          trackNumber: { type: ["number", "null"] as const },
        },
        required: ["index", "artist", "album", "title", "year", "trackNumber"],
      },
    },
  },
  required: ["tracks"],
};

/**
 * Builds the inference prompt for a batch of tracks.
 * Includes file paths, existing partial tags, and inference rules.
 */
export function buildPrompt(tracks: TrackRow[]): string {
  const trackList = tracks
    .map((t, i) => {
      const parts: string[] = [`Track ${i}:`];
      // Include the relative file path (strip leading slash for readability)
      const displayPath = t.filePath.replace(/^\//, "");
      parts.push(`  File path: ${displayPath}`);
      if (t.artist) parts.push(`  Known artist: ${t.artist}`);
      if (t.album) parts.push(`  Known album: ${t.album}`);
      if (t.title) parts.push(`  Known title: ${t.title}`);
      if (t.year) parts.push(`  Known year: ${t.year}`);
      if (t.trackNumber) parts.push(`  Known track number: ${t.trackNumber}`);
      return parts.join("\n");
    })
    .join("\n\n");

  return `You are a music metadata expert. For each track below, infer the missing metadata fields (artist, album, title, year, track number) from the available clues: file path, folder structure, and any existing partial tags.

Rules:
- Return null for any field you cannot confidently infer
- Do NOT guess randomly -- only infer when the clues strongly suggest the answer
- File paths follow common patterns like "Artist/Album (Year)/NN - Title.ext"
- Prefer well-known artist/album matches over obscure guesses
- Use the folder structure as strong context for artist and album names
- Track numbers can often be inferred from filename prefixes (01, 02, etc.)

${trackList}`;
}

/**
 * Checks each userEdited flag and returns only the fields AI should update.
 * Fields where userEdited=1 (true) are skipped entirely.
 * Fields where AI returns null are also skipped.
 * Returns updates and confidence overrides for updateTrackAiMetadata.
 */
export function applyAiResults(
  existing: TrackRow,
  aiTrack: {
    artist: string | null;
    album: string | null;
    title: string | null;
    year: number | null;
    trackNumber: number | null;
  },
): { updates: Record<string, string | number>; confidences: Record<string, string> } {
  const updates: Record<string, string | number> = {};
  const confidences: Record<string, string> = {};

  if (!existing.artistUserEdited && aiTrack.artist !== null) {
    updates.artist = aiTrack.artist;
    confidences.artistConfidence = "ai";
  }
  if (!existing.albumUserEdited && aiTrack.album !== null) {
    updates.album = aiTrack.album;
    confidences.albumConfidence = "ai";
  }
  if (!existing.titleUserEdited && aiTrack.title !== null) {
    updates.title = aiTrack.title;
    confidences.titleConfidence = "ai";
  }
  if (!existing.yearUserEdited && aiTrack.year !== null) {
    updates.year = aiTrack.year;
    confidences.yearConfidence = "ai";
  }
  if (!existing.trackUserEdited && aiTrack.trackNumber !== null) {
    updates.trackNumber = aiTrack.trackNumber;
    confidences.trackConfidence = "ai";
  }

  return { updates, confidences };
}

/**
 * Main entry point for AI enrichment.
 * Batches qualifying tracks, calls Gemini API with structured output,
 * applies results respecting userEdited flags, and reports progress.
 */
export async function enrichTracks(
  db: Database.Database,
  tracks: TrackRow[],
  apiKey: string,
  onProgress: (event: EnrichProgressEvent) => void,
  options?: { delayMs?: number },
): Promise<EnrichResult> {
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey });

  const total = tracks.length;
  let enriched = 0;
  const errors: string[] = [];

  for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
    const batch = tracks.slice(batchStart, batchStart + BATCH_SIZE);

    try {
      const prompt = buildPrompt(batch);
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema,
          temperature: 0.1,
        },
      });

      const parsed: AiResponse = JSON.parse(
        response.text ?? "{}",
      );

      if (parsed.tracks) {
        for (const aiTrack of parsed.tracks) {
          const trackIndex = aiTrack.index;
          if (trackIndex < 0 || trackIndex >= batch.length) continue;

          const existing = batch[trackIndex];
          const { updates, confidences } = applyAiResults(existing, aiTrack);

          if (Object.keys(updates).length > 0) {
            updateTrackAiMetadata(db, existing.id, updates, confidences);
            enriched++;
          }
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      errors.push(`Batch ${batchStart}-${batchStart + batch.length}: ${message}`);
    }

    onProgress({
      total,
      processed: Math.min(batchStart + batch.length, total),
      enriched,
      errorCount: errors.length,
    });

    // Delay between batches to respect rate limits (skip after last batch)
    const delay = options?.delayMs ?? INTER_BATCH_DELAY_MS;
    if (batchStart + BATCH_SIZE < total && delay > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, delay),
      );
    }
  }

  return { total, enriched, errors };
}
