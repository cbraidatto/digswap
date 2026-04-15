import { stat } from "node:fs/promises";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type Database from "better-sqlite3";
import { getIndexedFileMtimes, getLibraryRoot } from "./library/db";
import type { DiffScanResult } from "../shared/ipc-types";

// Must match scanner.ts SCANNABLE_EXTENSIONS exactly
// NOTE: scanner.ts only supports .flac, .wav, .aiff (not mp3/ogg/m4a/etc).
// D-03 lists 9 extensions but the Phase 29 scanner only handles lossless formats.
// This is a known Phase 29 gap — watcher and diff-scan MUST match scanner.ts
// to avoid detecting files the scanner cannot process.
const AUDIO_EXTENSIONS = new Set([".flac", ".wav", ".aiff"]);
const BATCH_SIZE = 50;

export async function runDiffScan(db: Database.Database): Promise<DiffScanResult> {
  const rootPath = getLibraryRoot(db);
  if (!rootPath) {
    return { added: 0, removed: 0, modified: 0, totalIndexed: 0, hasChanges: false };
  }

  const indexed = getIndexedFileMtimes(db);

  // Discover current audio files on disk
  const entries = await readdir(rootPath, { recursive: true }) as string[];
  const currentPaths = new Set<string>();
  for (const entry of entries) {
    const ext = path.extname(entry).toLowerCase();
    if (AUDIO_EXTENSIONS.has(ext)) {
      currentPaths.add(path.join(rootPath, entry));
    }
  }

  let added = 0;
  let modified = 0;
  let removed = 0;

  // Check for new and modified files in parallel batches of 50
  const paths = [...currentPaths];
  for (let i = 0; i < paths.length; i += BATCH_SIZE) {
    const batch = paths.slice(i, i + BATCH_SIZE);
    const stats = await Promise.all(
      batch.map(async (p) => {
        try {
          return { path: p, stat: await stat(p) };
        } catch {
          return null;
        }
      }),
    );
    for (const entry of stats) {
      if (!entry) continue;
      const existingMtime = indexed.get(entry.path);
      if (!existingMtime) {
        added++;
      } else if (entry.stat.mtime.toISOString() !== existingMtime) {
        modified++;
      }
    }
  }

  // Check for removed files (in index but not on disk)
  for (const [indexedPath] of indexed) {
    if (!currentPaths.has(indexedPath)) {
      removed++;
    }
  }

  return {
    added,
    removed,
    modified,
    totalIndexed: indexed.size,
    hasChanges: added > 0 || removed > 0 || modified > 0,
  };
}
