import fs from "node:fs/promises";
import os from "node:os";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractSpecs,
  generatePreview,
  computeFileSha256,
  type AudioSpecs,
} from "./ffmpeg-pipeline";
import { uploadPreviewToStorage } from "./preview-uploader";

// ---------- Types ----------

export interface AudioPrepResult {
  sourcePath: string;
  sha256: string;
  specs: AudioSpecs;
  previewStoragePath: string;
  proposalItemId: string;
}

// ---------- Pipeline ----------

/**
 * Full audio preparation pipeline:
 *   1. extractSpecs -- validates audio file, enforces 120s minimum
 *   2. computeFileSha256 -- hash of the *source* file (not preview)
 *   3. Write SHA-256 to DB (immutable: only if file_hash IS NULL)
 *   4. generatePreview -- 2-minute stream-copy clip to temp dir
 *   5. uploadPreviewToStorage -- push to Supabase Storage bucket
 *   6. Cleanup local preview temp file
 *
 * The SHA-256 immutability constraint: step 3 uses `.is('file_hash', null)`
 * so a second call for the same proposal item is a no-op on the DB column
 * (the update matches zero rows).
 */
export async function runAudioUploadPipeline(
  client: SupabaseClient,
  tradeId: string,
  userId: string,
  proposalItemId: string,
  sourcePath: string,
): Promise<AudioPrepResult> {
  // Step 1: Extract specs (throws FILE_TOO_SHORT if < 120s)
  const specs = await extractSpecs(sourcePath);

  // Step 2: Compute SHA-256 hash of the source file
  const sha256 = await computeFileSha256(sourcePath);

  // Step 3: Write SHA-256 to DB -- immutable (only if file_hash IS NULL)
  const { error: dbError } = await client
    .from("trade_proposal_items")
    .update({ file_hash: sha256 })
    .eq("id", proposalItemId)
    .is("file_hash", null);

  if (dbError) {
    throw new Error(
      `Failed to write SHA-256 to trade_proposal_items: ${dbError.message}`,
    );
  }

  // Step 4: Generate 2-minute preview clip to temp directory
  const previewResult = await generatePreview(sourcePath, specs, os.tmpdir());

  // Step 5: Upload preview to Supabase Storage
  let previewStoragePath: string;
  try {
    previewStoragePath = await uploadPreviewToStorage(
      client,
      tradeId,
      userId,
      proposalItemId,
      previewResult.previewPath,
    );
  } finally {
    // Step 6: Best-effort cleanup of local temp preview file
    try {
      await fs.unlink(previewResult.previewPath);
    } catch (err) {
      // Swallow ENOENT -- file may already be gone
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(
          "[upload-pipeline] Failed to clean up preview temp file:",
          err,
        );
      }
    }
  }

  return {
    sourcePath,
    sha256,
    specs,
    previewStoragePath,
    proposalItemId,
  };
}
