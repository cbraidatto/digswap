import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { ScanProgressEvent, ScanResult } from "../../shared/ipc-types";
import {
  getLibraryDb,
  insertTracks,
  removeTracksByPaths,
  getIndexedFileMtimes,
  generateTrackId,
  setLibraryRoot,
  type TrackRow,
} from "./db";
import { extractTrackMetadata } from "./metadata-parser";

const SCANNABLE_EXTENSIONS = new Set([".flac", ".wav", ".aiff"]);
const IPC_THROTTLE_MS = 50;
const BATCH_SIZE = 50;

export async function scanFolder(
  rootPath: string,
  onProgress: (event: ScanProgressEvent) => void,
  options: { incremental: boolean } = { incremental: false },
): Promise<ScanResult> {
  const db = getLibraryDb();
  setLibraryRoot(db, rootPath);

  // Phase 1: Discover all audio files
  const entries = await readdir(rootPath, { recursive: true });
  const audioFiles = entries
    .filter((entry) => {
      const ext = path.extname(
        typeof entry === "string" ? entry : entry.toString(),
      );
      return SCANNABLE_EXTENSIONS.has(ext.toLowerCase());
    })
    .map((entry) =>
      path.join(rootPath, typeof entry === "string" ? entry : entry.toString()),
    );

  // Determine which files to process
  let filesToProcess: string[];
  const removedFiles: string[] = [];

  if (options.incremental) {
    const indexed = getIndexedFileMtimes(db);
    const currentPaths = new Set(audioFiles);
    filesToProcess = [];

    for (const filePath of audioFiles) {
      const existingMtime = indexed.get(filePath);
      if (!existingMtime) {
        // New file
        filesToProcess.push(filePath);
        continue;
      }
      const fileStat = await stat(filePath);
      const mtime = fileStat.mtime.toISOString();
      if (mtime !== existingMtime) {
        // Modified file
        filesToProcess.push(filePath);
      }
    }

    // Detect removed files
    for (const [indexedPath] of indexed) {
      if (!currentPaths.has(indexedPath)) {
        removedFiles.push(indexedPath);
      }
    }

    // Remove deleted files from index
    if (removedFiles.length > 0) {
      removeTracksByPaths(db, removedFiles);
    }
  } else {
    filesToProcess = audioFiles;
  }

  const filesFound = filesToProcess.length;
  let filesProcessed = 0;
  let lastEmit = 0;
  const errors: Array<{ filePath: string; reason: string }> = [];
  const batch: TrackRow[] = [];

  // Phase 2: Process each file
  for (const filePath of filesToProcess) {
    try {
      const fileStat = await stat(filePath);
      const meta = await extractTrackMetadata(filePath, rootPath);

      batch.push({
        id: generateTrackId(),
        filePath,
        fileHash: null,
        fileSize: fileStat.size,
        modifiedAt: fileStat.mtime.toISOString(),
        scannedAt: new Date().toISOString(),
        artist: meta.artist,
        album: meta.album,
        title: meta.title,
        year: meta.year,
        trackNumber: meta.trackNumber,
        format: meta.format,
        bitrate: meta.bitrate,
        sampleRate: meta.sampleRate,
        bitDepth: meta.bitDepth,
        duration: meta.duration,
        artistConfidence: meta.artistConfidence,
        albumConfidence: meta.albumConfidence,
        titleConfidence: meta.titleConfidence,
        yearConfidence: meta.yearConfidence,
        trackConfidence: meta.trackConfidence,
      });

      // Flush batch periodically
      if (batch.length >= BATCH_SIZE) {
        insertTracks(db, batch);
        batch.length = 0;
      }
    } catch (err) {
      errors.push({
        filePath,
        reason: err instanceof Error ? err.message : String(err),
      });
    }

    filesProcessed++;

    // Throttled IPC emission + event loop yield
    const now = Date.now();
    if (now - lastEmit >= IPC_THROTTLE_MS) {
      onProgress({
        filesFound,
        filesProcessed,
        currentPath: filePath,
        errorCount: errors.length,
      });
      lastEmit = now;
      await new Promise((resolve) => setImmediate(resolve));
    }
  }

  // Flush remaining batch
  if (batch.length > 0) {
    insertTracks(db, batch);
  }

  // Final progress emission
  onProgress({
    filesFound,
    filesProcessed,
    currentPath: "",
    errorCount: errors.length,
  });

  return { filesFound, filesProcessed, errors };
}
