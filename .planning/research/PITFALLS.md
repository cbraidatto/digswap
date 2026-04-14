# Domain Pitfalls: v1.3 Local Library

**Domain:** Electron desktop app - local folder scanning, AI metadata, system tray daemon, file watching
**Researched:** 2026-04-13
**Confidence:** HIGH (verified across Electron GitHub issues, npm package docs, Google API docs, community reports)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or broken user experience.

---

### Pitfall 1: Chokidar File Watcher Eats 400MB+ RAM on Large Music Folders

**What goes wrong:**
Chokidar watches directories recursively by default, building an in-memory map of every file and directory. A music collection with 10K+ files across nested artist/album folders causes chokidar to consume 400MB+ RAM and spike CPU during initialization. On Windows specifically, chokidar v3 had a known bug where it read a selected directory as many times as there are files in that directory (issue #1109), multiplying I/O. If the native `fsevents` module fails to load (common in Electron due to code-signing or native module issues), chokidar silently falls back to CPU polling mode -- dramatically worse performance with zero error messages.

**Why it happens:**
Developers test with a folder of 50 files. Works great. Real vinyl collectors have 5,000-50,000 files in deeply nested structures (Artist/Album/Track). The memory usage scales linearly with watched file count, and chokidar buffers all directory entries during initialization.

**Consequences:**
- App becomes unresponsive during initial watch setup (30-60 seconds for large folders)
- Background daemon consumes 500MB+ RAM permanently while "idle" in tray
- Windows users get "app is not responding" prompts during scan
- If polling fallback activates silently, CPU stays at 10-15% permanently

**Prevention:**
1. Use chokidar v4+ (released Sep 2024) -- reduces dependencies from 13 to 1, fixes fsevents bundling issues
2. Set `depth: 3` maximum (Artist/Album/Track is 3 levels -- deeper is pathological)
3. Set `ignoreInitial: true` -- don't fire events for existing files on startup (handle those via explicit scan)
4. Filter with `ignored` patterns: skip non-audio files (`*.jpg`, `*.txt`, `*.nfo`, `*.log`, `*.cue`) at the watcher level, not in event handlers
5. Do NOT watch the folder during initial scan -- scan first, then attach watcher after scan completes
6. Monitor memory with `process.memoryUsage()` and log warnings above 200MB

**Detection:** Memory usage above 200MB in main process while app is "idle" in tray. CPU above 5% when no scan is running.

**Phase:** Address in Phase 1 (Tray + File Watcher foundation). Get this wrong and everything built on top is broken.

**Sources:**
- [Chokidar Windows performance issue #228](https://github.com/paulmillr/chokidar/issues/228)
- [Chokidar Windows directory re-read bug #1109](https://github.com/paulmillr/chokidar/issues/1109)
- [Chokidar high CPU on large folders #447](https://github.com/paulmillr/chokidar/issues/447)
- [Electron + chokidar native module integration issues](https://www.hendrik-erz.de/post/electron-chokidar-and-native-nodejs-modules-a-horror-story-from-integration-hell)

---

### Pitfall 2: YouTube Data API v3 Quota Exhaustion -- 100 Searches/Day Default

**What goes wrong:**
YouTube Data API v3 grants a default quota of 10,000 units per day. A `search.list` call costs **100 units per request**. That means you get exactly **100 searches per day** before hitting the wall. A user with a 500-album collection triggers 500 YouTube search calls on first import -- 5x the daily quota, exhausted in minutes. The API returns HTTP 403 with `quotaExceeded` and won't recover until midnight Pacific Time.

**Why it happens:**
Developers see "10,000 units/day" and assume that's 10,000 requests. It's not -- search costs 100 units each. The quota calculator is buried in Google's docs and most tutorials don't mention per-endpoint costs. Additionally, each page of search results costs another 100 units, so paginating to find the best match doubles or triples the cost.

**Consequences:**
- First user with a moderate collection exhausts the entire app's daily quota
- All other users get zero YouTube functionality for the rest of the day
- Quota is per-project (all users share the same 10K units), not per-user
- Requesting quota increase requires Google review, takes weeks, and may be denied for "content aggregation" use cases

**Prevention:**
1. NEVER call YouTube search on import -- queue it as a background job with aggressive throttling
2. Budget: max 50 searches/day initially, leaving headroom for other API calls
3. Cache YouTube search results in Supabase permanently -- a release's YouTube link rarely changes
4. Implement a shared cache: if User A already found the YouTube link for "Miles Davis - Kind of Blue", User B gets it from cache, zero API calls
5. Use `videos.list` (1 unit) instead of `search.list` (100 units) when you already have a video ID from cache
6. Consider scraping YouTube search page as fallback (legally gray but common practice) or use Invidious API
7. Batch processing: process 50 releases/day, prioritize user's most-played or recently-added

**Detection:** Monitor daily quota usage via Google Cloud Console. Alert at 50% usage. Log every search call with timestamp and quota cost.

**Phase:** Address in Phase 3 (YouTube integration). Design the queue and cache architecture BEFORE writing any YouTube API code.

**Sources:**
- [YouTube Data API Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [YouTube API Quota 10,000 Units/Day Breakdown](https://www.contentstats.io/blog/youtube-api-quota-tracking)
- [YouTube API Quota and Compliance](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)

---

### Pitfall 3: Gemini Flash Confidently Hallucinates Music Metadata

**What goes wrong:**
When audio files have missing or garbled ID3 tags, the AI is asked to infer artist/album/track from filename and folder structure. Gemini Flash (2.5 or 3) has a documented tendency to NEVER say "I don't know" -- it will confidently fabricate metadata. A file named `Track03.wav` in a folder `Unknown Artist` will get a plausible-sounding but completely wrong artist/album attribution. Gemini 3 Flash specifically has a 91% hallucination rate on questions where it should refuse to answer (per Artificial Analysis benchmarks). For music metadata, this means the AI will always return a confident answer, even when the input provides zero useful signal.

**Why it happens:**
LLMs are trained to be helpful, not to refuse. Gemini models in particular "attempt every question" -- they have top accuracy when they know the answer, but catastrophic hallucination when they don't. Music metadata inference from filenames is inherently ambiguous, and the model has no mechanism to express uncertainty in a structured way.

**Consequences:**
- User's collection gets polluted with wrong metadata that looks right
- Wrong metadata syncs to the web app, appears in search results, corrupts wantlist matching
- User loses trust in the entire import feature after seeing familiar albums misidentified
- Fixing hallucinated metadata is more work than manual entry from scratch

**Prevention:**
1. NEVER auto-accept AI metadata -- always present as "suggestion" with confidence indicator
2. Design a confidence scoring system: filename match + folder structure + existing partial tags = confidence score
3. If confidence is below threshold (e.g., only have `Track03.wav` with no folder context), show "Unknown" rather than AI guess
4. Use structured output (JSON mode) with explicit fields including a `confidence` float that the model must populate
5. Cross-validate AI results against Discogs database or MusicBrainz API before accepting
6. Show users a "Review AI Suggestions" queue rather than silently applying metadata
7. Use Gemini 2.0 Flash ($0.10/1M tokens) not 2.5 Flash ($0.30/1M tokens) -- for structured metadata extraction, the cheaper model is sufficient and 2.5's "thinking" adds cost without improving structured output quality

**Detection:** Track accept/reject rate on AI suggestions. If users reject >30% of suggestions, the confidence threshold is too low.

**Phase:** Address in Phase 2 (AI Metadata). Build the confidence system and review UX before any AI code.

**Sources:**
- [Gemini 3 Flash 91% Hallucination Rate](https://ai-engineering-trend.medium.com/91-hallucination-rate-gemini-3-flash-evaluation-results-are-in-e2ceee3e2f9f)
- [Gemini Flash Hallucination Analysis](https://betterstack.com/community/guides/ai/gemini-3-flash-review/)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)

---

### Pitfall 4: Close-to-Tray Creates Zombie Processes and Ghost Icons on Windows

**What goes wrong:**
Implementing close-to-tray (hiding window instead of quitting on X click) has multiple Windows-specific failure modes:

1. **Ghost tray icons:** If the app crashes or `explorer.exe` restarts, the tray icon disappears but the process keeps running. User sees no icon, can't interact with the app, but it's consuming resources. The only fix is Task Manager kill.
2. **`app.quit()` doesn't actually quit:** When multiple BrowserWindows exist (main window + trade window), calling `app.quit()` from tray menu closes windows but the main process keeps running (Electron issue #4994). The `will-quit` and `quit` events never fire.
3. **Registry cleanup on uninstall:** Auto-startup registry entries at `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run` persist after uninstall, leaving ghost entries in Task Manager's Startup tab.
4. **`setSkipTaskbar` confusion:** When hiding to tray, you must call `win.setSkipTaskbar(true)` to remove the taskbar entry. Forgetting this means the app appears in both the taskbar AND the tray, confusing users.

**Why it happens:**
macOS and Linux handle window lifecycle differently. Code that works on macOS (where apps naturally persist after all windows close) creates zombie behavior on Windows. Most Electron tray tutorials are written for macOS and don't cover Windows edge cases.

**Consequences:**
- Users think the app closed but it's still consuming 200MB+ RAM
- After explorer.exe crash/restart, app becomes inaccessible without Task Manager
- Uninstalled app still appears in Windows Startup settings
- Multiple instances can accumulate if user double-clicks the app thinking it's not running

**Prevention:**
1. Listen for `TaskbarCreated` Windows message to recreate tray icon after explorer.exe restart -- use `win.hookWindowMessage` or electron `app.on('session-end')` patterns
2. Implement single-instance lock: `app.requestSingleInstanceLock()` -- if a second instance launches, focus the existing hidden window instead
3. On `app.quit()`, explicitly destroy all windows, destroy tray, then call `app.exit(0)` as a failsafe after 3-second timeout
4. Use `app.setLoginItemSettings()` for auto-startup (not raw registry manipulation) -- Electron handles cleanup better
5. Set `win.setSkipTaskbar(true)` when hiding to tray, `win.setSkipTaskbar(false)` when restoring
6. Add a "Quit DigSwap" context menu item on tray that truly exits (not just hides)
7. On `before-quit` event, set a flag and check it in `close` handler to distinguish "hide to tray" from "actually quit"

**Detection:** Check for multiple `DigSwap.exe` processes in Task Manager. Test explorer.exe restart scenario (kill/restart explorer.exe and verify tray icon returns).

**Phase:** Address in Phase 1 (Tray Mode). This is the foundation -- every subsequent feature assumes the tray daemon works correctly.

**Sources:**
- [Electron app.quit() doesn't exit - issue #4994](https://github.com/electron/electron/issues/4994)
- [Dead tray icons after quit - issue #31134](https://github.com/electron/electron/issues/31134)
- [Tray icon disappears - issue #7095](https://github.com/electron/electron/issues/7095)
- [Tray icon disappears after standby - issue #22443](https://github.com/electron/electron/issues/22443)
- [Registry entry persists after uninstall - electron-builder #2237](https://github.com/electron-userland/electron-builder/issues/2237)

---

## Moderate Pitfalls

---

### Pitfall 5: Initial Folder Scan Blocks Electron Main Process

**What goes wrong:**
Scanning a folder with 10K+ audio files involves: `fs.readdir` (recursive), `stat` each file, read ID3 tags from each file via `music-metadata`. If done synchronously or with unbounded concurrency in the main process, the entire Electron app freezes. Even in the renderer process, unbounded `Promise.all` over 10K files creates 10K simultaneous file handles, hitting the OS limit (Windows default: 16,384 handles per process) and causing `EMFILE` errors.

**Prevention:**
1. Run scan in a worker thread (`worker_threads`) or utility process (`utilityProcess.fork()` in Electron 22+), never in main or renderer
2. Process files in batches of 20-50 with concurrency limiter (use `p-limit` or `p-queue`)
3. Use `fs.opendir` with async iterator instead of `fs.readdir` to avoid buffering entire directory listing
4. Stream results to renderer via IPC as they're processed -- show progressive results, not a loading spinner
5. Read only metadata headers (first ~100KB of each file), not entire file content
6. `music-metadata` supports `parseFile` with `{ duration: false }` option to skip duration calculation, which is the slowest part

**Detection:** App unresponsive during scan. CPU at 100% for one core. Handle count rising above 1,000 in Task Manager.

**Phase:** Address in Phase 1 (Folder Scan). Use `utilityProcess` from the start -- retrofitting worker architecture later is painful.

---

### Pitfall 6: Diff Scan on Startup Becomes Full Rescan

**What goes wrong:**
The "diff scan" on startup (compare saved index vs current folder state) seems simple: walk the directory tree, compare file paths and modification times against the saved index, identify additions/removals/changes. But if the saved index stores absolute paths and the user moves the watched folder (or Windows changes the drive letter), every file appears as "removed + new", triggering a full AI metadata re-inference and re-sync to server.

Additionally, Windows file timestamps are unreliable: `mtime` can change when a file is moved, copied, or even when antivirus scans it. Relying on `mtime` alone produces false positives (files that haven't actually changed).

**Prevention:**
1. Store relative paths from the watched root, not absolute paths
2. Use file content hash (first 64KB + file size) as the stable identity, not path + mtime alone
3. A file with the same hash but different path = "moved", not "deleted + added"
4. Implement a 3-way comparison: path match, hash match, mtime check -- only re-process if hash differs
5. Debounce the diff scan: if the user reopened the app within 60 seconds of closing, skip the diff (watcher was active the whole time)
6. Store the scan index in SQLite locally (via `better-sqlite3` or Electron's `safeStorage` + JSON file for small collections)

**Detection:** Diff scan taking longer than initial scan. AI metadata calls spiking on every app restart.

**Phase:** Address in Phase 1 (Diff Scan design) but implement in Phase 2 alongside metadata. The index schema must support hash-based identity from day one.

---

### Pitfall 7: Gemini API Costs Spiral on Large Collections

**What goes wrong:**
Gemini 2.0 Flash at $0.10/1M input tokens seems cheap. But processing 10K files with an average prompt of 500 tokens (filename, folder path, partial tags, instruction) = 5M input tokens = $0.50 per full collection scan. Output at $0.40/1M tokens adds another $0.40. So ~$1 per large collection import. If the diff scan false-positives (Pitfall 6) cause re-processing, costs multiply. If users rescan frequently (changed AI model, want better results), costs compound. At 1,000 users with average 2K files each: 2M files * 500 tokens = 1B tokens = $100 input + $400 output = $500/month just for metadata inference.

**Prevention:**
1. Only call Gemini for files where metadata is genuinely missing or ambiguous -- if ID3 tags have artist + album + title, skip AI entirely
2. Batch files into single API calls: send 20 files' metadata context in one prompt, get 20 results back. Reduces per-request overhead and total token count.
3. Cache AI results by content hash -- if the same file is seen again (even across users), reuse cached metadata
4. Use the free tier aggressively during development: 1,000 RPD, 250K TPM on Gemini 2.0 Flash free tier is substantial
5. Implement a hard budget cap per user per day (e.g., 200 AI calls max) with clear UI messaging
6. Consider local inference fallback (e.g., regex pattern matching on "Artist - Album - Track.ext" naming conventions) before reaching for AI

**Detection:** Track Gemini API spend per day/week. Alert at $10/day. Log tokens consumed per scan.

**Phase:** Address in Phase 2 (AI Metadata). Budget cap and batch strategy must be designed before implementation.

---

### Pitfall 8: Local-to-Remote Sync Conflicts and Data Loss

**What goes wrong:**
The local scan produces a collection that must sync to Supabase. Multiple conflict scenarios:
1. User edits metadata on the web app, then a local rescan overwrites it with the original (stale) AI inference
2. User deletes a file locally, sync removes it from server, but user wanted to keep the server record (they sold the vinyl but want it in their collection history)
3. App is offline when files are added/removed, then reconnects -- the sync batch may be stale
4. Two devices (desktop at home + desktop at work) scan overlapping folders and create duplicate entries

**Prevention:**
1. Implement "source of truth" per field: local scan owns `file_path`, `file_hash`, `file_format`; user owns `artist`, `album`, `title` (once manually edited, never overwrite from scan)
2. Use `updated_at` timestamps with last-write-wins for automated fields, but NEVER overwrite user-edited fields
3. Mark records as "local_deleted" (soft delete) rather than hard deleting on file removal -- let user decide on web app whether to keep the server record
4. Use Supabase `upsert` with `onConflict` on a composite key (user_id + content_hash), not just file_path
5. Add a `sync_status` enum: `pending`, `synced`, `conflict`, `local_only` -- show conflicts in UI for manual resolution
6. For offline handling: queue sync operations in local SQLite, replay on reconnect with conflict detection

**Detection:** Users reporting "my edits disappeared" or "deleted files came back". Duplicate entries in collection with different sources.

**Phase:** Address in Phase 3 (Server Sync). Design the sync protocol and conflict resolution rules before writing any sync code.

---

## Minor Pitfalls

---

### Pitfall 9: music-metadata ESM-Only in v8+ Breaks Electron CJS Builds

**What goes wrong:**
`music-metadata` v8+ is ESM-only (pure ECMAScript modules). If the Electron main process is bundled as CommonJS (which is the default for many Electron build tools including electron-builder), `require('music-metadata')` fails with `ERR_REQUIRE_ESM`. Dynamic `import()` works but requires async patterns throughout the call chain.

**Prevention:**
1. Pin `music-metadata` to the latest v7.x if your build pipeline is CJS, OR
2. Configure your bundler (esbuild/vite) to handle ESM dependencies via `build.rollupOptions.external` or bundler transpilation
3. Test the metadata parsing import FIRST before writing any scanning logic -- this is a build configuration issue that blocks everything

**Phase:** Address in Phase 1 during project setup. Verify the import works in your exact build configuration before any feature work.

---

### Pitfall 10: Windows Auto-Startup User Disablement is Irreversible Programmatically

**What goes wrong:**
When the user disables the app's startup entry via Task Manager > Startup tab, `app.setLoginItemSettings({ openAtLogin: true })` can no longer re-enable it. The Windows setting is stored in a location that overrides the registry entry. The app's "Start with Windows" toggle in settings will appear to work (no error thrown) but the app won't actually start on login.

**Prevention:**
1. Check `app.getLoginItemSettings().wasOpenedAtLogin` to detect if the app actually launched at startup
2. Check `app.getLoginItemSettings().openAtLogin` on app start -- if it's `false` but the user's preference says "enabled", show a notification explaining they need to re-enable it in Task Manager
3. Don't fight the OS -- if the user disabled startup via Task Manager, respect it and update the app's internal preference to match

**Phase:** Address in Phase 1 (Auto-Startup). Low complexity but confusing UX if not handled.

---

### Pitfall 11: Audio File Format Support Gaps

**What goes wrong:**
Vinyl diggers use diverse audio formats: FLAC, WAV, AIFF, MP3, AAC, OGG, APE, WV (WavPack), DSD (DSF/DFF). `music-metadata` supports most common formats but less common ones (APE, WavPack, DSD) may have incomplete tag support or fail silently. Additionally, some diggers rip to WAV which has minimal tag support (BWF metadata only), meaning most WAV files will have zero useful metadata.

**Prevention:**
1. Support the top 5 formats explicitly: FLAC, MP3, WAV, AIFF, AAC -- these cover 95%+ of vinyl rips
2. For WAV files, always fall back to filename/folder inference (AI or regex) since tags are rarely present
3. Log unsupported formats and show them in a "skipped files" UI rather than silently ignoring
4. Don't crash on corrupt files -- wrap `parseFile` in try/catch per file, never let one bad file abort the entire scan

**Phase:** Address in Phase 1 (Scan implementation). Define supported formats list up front.

---

### Pitfall 12: Symlinks and Junction Points on Windows

**What goes wrong:**
Windows users sometimes organize music libraries with symlinks (mklink) or NTFS junction points to aggregate folders from multiple drives. Chokidar's `followSymlinks: true` (default) can cause infinite loops if symlinks create circular references. Even without loops, following symlinks across drives means the watcher monitors paths the user didn't explicitly select, potentially watching an entire external drive.

**Prevention:**
1. Set `followSymlinks: false` in chokidar options
2. Resolve symlink targets during initial scan with `fs.realpath()` and warn the user if they point outside the selected folder
3. Keep a Set of resolved real paths to detect circular references
4. Document that symlinked folders should be added as separate watch roots if the user wants them included

**Phase:** Address in Phase 1 (File Watcher configuration). One-line config change but critical for edge cases.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Phase 1: Tray + Daemon | Ghost tray icons on Windows after explorer.exe restart | Critical | Listen for `TaskbarCreated` message, recreate tray icon |
| Phase 1: Tray + Daemon | Multiple app instances running simultaneously | Critical | Use `app.requestSingleInstanceLock()` from first line of main process |
| Phase 1: Tray + Daemon | Close button quits instead of hiding (or vice versa) | Moderate | `isQuitting` flag pattern in `before-quit` + `close` handlers |
| Phase 1: File Watcher | Chokidar polling fallback on Windows | Critical | Verify native fs.watch is active (not polling) via chokidar debug events |
| Phase 1: Folder Scan | Main process freeze during scan | Critical | Use `utilityProcess.fork()` for scan worker |
| Phase 1: Folder Scan | ESM/CJS module compatibility | Moderate | Test music-metadata import in build config before writing features |
| Phase 2: AI Metadata | Hallucinated artist/album names accepted silently | Critical | Never auto-accept; always show review queue with confidence scores |
| Phase 2: AI Metadata | API cost spiral on large collections | Moderate | Batch prompts (20 files per call), skip files with existing good tags |
| Phase 2: Diff Scan | Full rescan on every startup due to mtime changes | Moderate | Use content hash (first 64KB + size) as stable file identity |
| Phase 3: YouTube | Quota exhausted after first user import | Critical | Max 50 searches/day, shared cache in Supabase, queue processing |
| Phase 3: Server Sync | User edits overwritten by rescan | Critical | Per-field source-of-truth: user edits are sacred, scan never overwrites |
| Phase 3: Server Sync | Offline changes lost on reconnect | Moderate | Local SQLite queue, replay with conflict detection |
| Phase 4: Auto-Startup | User can't re-enable startup after Task Manager disable | Minor | Detect mismatch, inform user to re-enable via Task Manager |

---

## Pre-Implementation Checklist

Before writing any code for v1.3 Local Library, verify:

- [ ] Chokidar v4+ installs and runs in Electron build without native module errors
- [ ] `music-metadata` imports correctly in your CJS/ESM build configuration
- [ ] YouTube Data API project created with quota visible in Google Cloud Console
- [ ] Gemini API key provisioned with free tier limits understood (1,000 RPD / 250K TPM)
- [ ] `app.requestSingleInstanceLock()` is the FIRST thing in main process entry point
- [ ] `utilityProcess.fork()` works in your Electron version for offloading scan to worker
- [ ] Local SQLite database (or JSON store) chosen for scan index persistence
- [ ] Sync conflict resolution rules documented BEFORE any sync code is written

---

## Sources

### Electron Tray + Window Management
- [Electron Tray Tutorial](https://www.electronjs.org/docs/latest/tutorial/tray)
- [app.quit() not exiting - issue #4994](https://github.com/electron/electron/issues/4994)
- [Dead tray icons - issue #31134](https://github.com/electron/electron/issues/31134)
- [Tray icon disappears - issue #7095](https://github.com/electron/electron/issues/7095)
- [Registry entry persists after uninstall](https://github.com/electron-userland/electron-builder/issues/2237)

### File Watching
- [Chokidar GitHub](https://github.com/paulmillr/chokidar)
- [Chokidar Windows performance - issue #228](https://github.com/paulmillr/chokidar/issues/228)
- [Chokidar directory re-read bug - issue #1109](https://github.com/paulmillr/chokidar/issues/1109)
- [Electron + chokidar native modules](https://www.hendrik-erz.de/post/electron-chokidar-and-native-nodejs-modules-a-horror-story-from-integration-hell)

### AI Metadata
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Gemini 3 Flash Hallucination Rate](https://ai-engineering-trend.medium.com/91-hallucination-rate-gemini-3-flash-evaluation-results-are-in-e2ceee3e2f9f)
- [Gemini Flash Accuracy Analysis](https://betterstack.com/community/guides/ai/gemini-3-flash-review/)

### YouTube API
- [YouTube Data API Quota Calculator](https://developers.google.com/youtube/v3/determine_quota_cost)
- [YouTube API Quota Breakdown](https://www.contentstats.io/blog/youtube-api-quota-tracking)

### Audio Metadata Parsing
- [music-metadata npm](https://www.npmjs.com/package/music-metadata)
- [music-metadata GitHub](https://github.com/Borewit/music-metadata)

### Sync Patterns
- [Supabase Upsert Documentation](https://supabase.com/docs/reference/javascript/upsert)
- [PowerSync Offline-First with Supabase](https://www.powersync.com/blog/offline-first-apps-made-simple-supabase-powersync)

### Electron Performance
- [Electron Performance Best Practices](https://www.electronjs.org/docs/latest/tutorial/performance)
- [Electron app API - setLoginItemSettings](https://www.electronjs.org/docs/latest/api/app)
