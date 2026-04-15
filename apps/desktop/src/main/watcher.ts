import { watch, type FSWatcher } from "chokidar";
import path from "node:path";

// Must match scanner.ts SCANNABLE_EXTENSIONS exactly
// NOTE: D-03 specifies 9 extensions (mp3, flac, wav, ogg, m4a, aac, wma, opus, aiff)
// but scanner.ts (Phase 29) only supports 3 lossless formats. Watching for mp3 etc
// would detect changes the scanner cannot process, causing silent failures.
// This is a known Phase 29 gap — when scanner.ts adds more formats, update this set.
const AUDIO_EXTENSIONS = new Set([".flac", ".wav", ".aiff"]);
const IGNORED_NAMES = new Set(["thumbs.db", ".ds_store"]);
const IGNORED_EXTENSIONS = new Set([".tmp", ".part", ".crdownload"]);
const DEBOUNCE_MS = 2 * 60 * 1000; // 2 minutes per D-03

let watcher: FSWatcher | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let settledCallback: (() => void) | null = null;

export function startWatching(
  rootPath: string,
  onSettled: () => void,
): void {
  stopWatching();
  settledCallback = onSettled;

  watcher = watch(rootPath, {
    ignoreInitial: true,
    persistent: true,
    depth: Infinity,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100,
    },
    ignored: (filePath: string, stats) => {
      // Allow directories to pass through for recursive watching
      if (stats?.isDirectory()) return false;
      const ext = path.extname(filePath).toLowerCase();
      const basename = path.basename(filePath).toLowerCase();
      // Ignore known temp files
      if (IGNORED_EXTENSIONS.has(ext) || IGNORED_NAMES.has(basename)) return true;
      // Only watch audio extensions
      return !AUDIO_EXTENSIONS.has(ext);
    },
  });

  watcher.on("add", () => resetDebounce(onSettled));
  watcher.on("change", () => resetDebounce(onSettled));
  watcher.on("unlink", () => resetDebounce(onSettled));
  watcher.on("error", (err) => console.error("[watcher] error:", err));
}

function resetDebounce(callback: () => void): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(callback, DEBOUNCE_MS);
}

export function stopWatching(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (watcher) {
    void watcher.close();
    watcher = null;
  }
  settledCallback = null;
}

/**
 * Restarts the watcher on a new root path, preserving the existing settled callback.
 * Used when user changes library folder via library-ipc.ts.
 */
export function restartWatching(newRootPath: string): void {
  const cb = settledCallback;
  if (!cb) return; // No active watcher to restart
  startWatching(newRootPath, cb);
}
