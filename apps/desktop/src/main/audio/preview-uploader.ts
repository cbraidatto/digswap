import fs from "node:fs/promises";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET_NAME = "trade-previews";

/**
 * Upload a preview audio file to Supabase Storage.
 *
 * Storage path convention: {tradeId}/{userId}/{proposalItemId}.{ext}
 * Bucket: trade-previews
 *
 * Uses upsert:false -- first-write wins. A duplicate upload attempt is
 * a caller bug and will throw.
 *
 * @returns The storage path string on success.
 */
export async function uploadPreviewToStorage(
  client: SupabaseClient,
  tradeId: string,
  userId: string,
  proposalItemId: string,
  localPath: string,
): Promise<string> {
  const fileBuffer = await fs.readFile(localPath);

  const ext = path.extname(localPath);
  const storagePath = `${tradeId}/${userId}/${proposalItemId}${ext}`;

  const { error } = await client.storage
    .from(BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      upsert: false,
      contentType: "application/octet-stream",
    });

  if (error) {
    throw new Error(
      `Failed to upload preview to storage: ${error.message}`,
    );
  }

  return storagePath;
}
