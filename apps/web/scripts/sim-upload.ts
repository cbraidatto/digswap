/**
 * Dev script: simula o upload de audio do testdigger em um trade lobby.
 * Usage: npx tsx scripts/sim-upload.ts <tradeId> <wavFilePath>
 *
 * Busca os itens do lado oposto ao usuário que já fez upload, e roda
 * o pipeline (specs + sha256 + preview + storage) para esses itens.
 */
import "dotenv/config";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, and, or, inArray } from "drizzle-orm";

// ---- inline env ----
const DATABASE_URL = process.env.DATABASE_URL!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing env vars. Make sure .env.local is loaded.");
  process.exit(1);
}

const pg = postgres(DATABASE_URL, { prepare: false });
const db = drizzle({ client: pg });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ---- ffmpeg helpers ----
function execFileAsync(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, (error, stdout, stderr) => {
      if (error) reject(error);
      else resolve({ stdout: stdout as string, stderr: stderr as string });
    });
  });
}

async function getFfmpegPath(): Promise<string> {
  const mod = await import("ffmpeg-static");
  const p = (mod.default ?? mod) as string | null;
  if (!p) throw new Error("ffmpeg-static not found");
  return p;
}

async function extractSpecs(filePath: string) {
  const ffmpegPath = await getFfmpegPath();
  const ffprobePath = ffmpegPath.replace(/ffmpeg(\.exe)?$/, "ffprobe$1");
  const { stdout } = await execFileAsync(ffprobePath, [
    "-v", "quiet", "-print_format", "json", "-show_streams", "-show_format", filePath,
  ]);
  const data = JSON.parse(stdout) as { streams?: Array<{ codec_name?: string; sample_rate?: string; bit_rate?: string }>; format?: { duration?: string; bit_rate?: string } };
  const stream = data.streams?.find((s) => s.codec_name);
  const fmt = data.format;
  if (!stream || !fmt) throw new Error("No audio stream found");
  return {
    format: stream.codec_name ?? "unknown",
    bitrate: Number(stream.bit_rate || fmt.bit_rate || 0),
    sampleRate: Number(stream.sample_rate || 0),
    duration: Number(fmt.duration || 0),
  };
}

async function computeSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = (await import("node:fs")).createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function generatePreview(filePath: string, duration: number, outputDir: string): Promise<string> {
  const ffmpegPath = await getFfmpegPath();
  const offset = Math.floor((Math.random() * 0.7 + 0.1) * duration);
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const previewPath = path.join(outputDir, `${base}_preview${ext}`);
  await execFileAsync(ffmpegPath, [
    "-ss", String(offset), "-i", filePath, "-t", "120", "-c", "copy", "-y", previewPath,
  ]);
  return previewPath;
}

function getContentType(ext: string): string {
  const e = ext.replace(/^\./, "").toLowerCase();
  const map: Record<string, string> = { flac: "audio/flac", mp3: "audio/mpeg", wav: "audio/wav", aiff: "audio/aiff", ogg: "audio/ogg" };
  return map[e] ?? "audio/wav";
}

// ---- main ----
async function main() {
  const [,, tradeId, wavFile] = process.argv;
  if (!tradeId || !wavFile) {
    console.error("Usage: npx tsx scripts/sim-upload.ts <tradeId> <wavFilePath>");
    process.exit(1);
  }

  console.log(`Trade: ${tradeId}`);
  console.log(`File:  ${wavFile}`);

  // 1. Find the accepted proposal for this trade
  const proposals = await pg`
    SELECT tp.id, tp.proposer_id
    FROM trade_proposals tp
    WHERE tp.trade_id = ${tradeId}
      AND tp.status = 'accepted'
    ORDER BY tp.sequence_number DESC
    LIMIT 1
  `;

  if (!proposals.length) {
    console.error("No accepted proposal found for this trade.");
    process.exit(1);
  }

  const proposal = proposals[0];
  console.log(`Proposal: ${proposal.id} (proposer: ${proposal.proposer_id})`);

  // 2. Find the trade requester/provider to figure out testdigger's side
  const trades = await pg`
    SELECT requester_id, provider_id FROM trade_requests WHERE id = ${tradeId} LIMIT 1
  `;
  if (!trades.length) { console.error("Trade not found"); process.exit(1); }

  const trade = trades[0];
  console.log(`Requester: ${trade.requester_id}`);
  console.log(`Provider:  ${trade.provider_id}`);

  // 3. Find items that don't have preview_storage_path yet (the other user's items)
  const items = await pg`
    SELECT tpi.id, tpi.side, tpi.collection_item_id, ci.user_id
    FROM trade_proposal_items tpi
    JOIN collection_items ci ON ci.id = tpi.collection_item_id
    WHERE tpi.proposal_id = ${proposal.id}
      AND tpi.preview_storage_path IS NULL
  `;

  if (!items.length) {
    console.log("All items already have previews uploaded.");
    process.exit(0);
  }

  console.log(`\nItems without preview: ${items.length}`);
  for (const item of items) {
    console.log(`  - ${item.id} (side: ${item.side}, user: ${item.user_id})`);
  }

  // 4. Run pipeline for each item
  console.log("\nExtracting specs...");
  const specs = await extractSpecs(wavFile);
  console.log(`  Format: ${specs.format}, ${specs.bitrate} bps, ${specs.sampleRate} Hz, ${specs.duration}s`);

  if (specs.duration < 120) {
    console.error(`File too short: ${specs.duration}s (min 120s)`);
    process.exit(1);
  }

  console.log("Computing SHA-256...");
  const sha256 = await computeSha256(wavFile);
  console.log(`  ${sha256}`);

  console.log("Generating preview...");
  const previewPath = await generatePreview(wavFile, specs.duration, os.tmpdir());
  console.log(`  Preview: ${previewPath}`);

  const previewBuffer = await fs.readFile(previewPath);
  const ext = path.extname(wavFile);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  for (const item of items) {
    console.log(`\nProcessing item ${item.id}...`);

    // Write SHA-256 if null
    await pg`
      UPDATE trade_proposal_items
      SET file_hash = ${sha256}
      WHERE id = ${item.id} AND file_hash IS NULL
    `;

    // Upload preview to storage
    const storagePath = `${tradeId}/${item.user_id}/${item.id}${ext}`;
    console.log(`  Uploading to storage: ${storagePath}`);

    const { error: uploadError } = await supabase.storage
      .from("trade-previews")
      .upload(storagePath, previewBuffer, {
        upsert: true,
        contentType: getContentType(ext),
      });

    if (uploadError) {
      console.error(`  Upload error: ${uploadError.message}`);
      // Continue anyway — set the path in DB even if storage fails
    } else {
      console.log("  Storage upload OK");
    }

    // Set preview metadata in DB
    await pg`
      UPDATE trade_proposal_items
      SET preview_storage_path = ${storagePath},
          preview_expires_at   = ${expiresAt}
      WHERE id = ${item.id}
    `;

    console.log(`  DB updated`);
  }

  // Cleanup
  await fs.unlink(previewPath).catch(() => undefined);

  console.log("\nDone! All items simulated. You can now force the trade to 'previewing'.");
  await pg.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
