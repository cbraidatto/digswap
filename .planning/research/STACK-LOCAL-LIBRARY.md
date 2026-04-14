# Technology Stack: v1.3 Local Library Features

**Project:** DigSwap Desktop - Local Library Milestone
**Researched:** 2026-04-13
**Scope:** Stack ADDITIONS only. Does NOT re-research existing stack (Electron 41, music-metadata, FFmpeg, Supabase, etc.)

## New Dependencies Required

### 1. System Tray Daemon Mode

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Electron `Tray` + `Menu` (built-in) | Electron 41.x (already installed) | System tray icon, context menu, minimize-to-tray | **No new dependency.** Electron's built-in `Tray` class handles everything: icon display, context menu, click events, balloon notifications. Adding an npm package would be pointless overhead. |

**Integration notes:**
- Use `.ico` format for tray icon on Windows (best visual quality in notification area)
- Create tray icon with `nativeImage.createFromPath()` pointing to a bundled `.ico` asset
- Intercept `BrowserWindow.on('close')` to hide instead of quit when tray mode is active
- Modify existing `window-all-closed` handler in `apps/desktop/src/main/index.ts` -- currently calls `app.quit()` on non-darwin; must instead keep app alive when tray daemon is enabled
- Use `tray.setContextMenu()` with Menu template: Show/Hide Window, Scan Now, Pause Watcher, Separator, Quit
- Confidence: **HIGH** -- Electron built-in API, extensively documented, no version concerns

### 2. File System Watcher

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| chokidar | ^4.0.0 | Watch audio folder for file additions/removals/renames in real-time | The de facto standard for Node.js file watching. Used by Vite, Webpack, and virtually every build tool. Node.js built-in `fs.watch` is unreliable across platforms -- misses events, reports wrong filenames on macOS, emits duplicates. Chokidar normalizes all of this. Version 4.x (not 5.x) because 5.x is ESM-only -- while Electron 41 bundles Node 20.x which supports ESM, the electron-vite main process build targets CJS. Chokidar 4.x supports both ESM and CJS, making it safe. Zero native dependencies since v4 (dropped from 13 to 1 dependency). |

**Why NOT alternatives:**
- `fs.watch` / `fs.watchFile` (Node built-in): Unreliable on Windows for recursive watching, emits duplicate events, no glob filtering, no ready event. Would require 200+ lines of normalization code that chokidar already handles.
- `node-watch`: Smaller but less battle-tested, fewer edge case fixes.
- `chokidar 5.x`: ESM-only. The electron-vite main process build may have CJS interop issues. Stick with 4.x for guaranteed compatibility.

**Integration notes:**
- Watch only audio file extensions: `.flac`, `.wav`, `.mp3`, `.aac`, `.ogg`, `.opus`, `.m4a`, `.aiff`, `.wv`, `.ape`
- Use `ignoreInitial: true` for the live watcher (diff scan handles initial state)
- Set `awaitWriteFinish: { stabilityThreshold: 2000 }` -- large FLAC files (300MB+) take time to copy; without this, chokidar fires before the file is fully written
- Events needed: `add`, `unlink`, `change` (for re-ripped files replacing old ones)
- Confidence: **HIGH** -- industry standard, 35K+ GitHub stars, actively maintained

### 3. Gemini Flash API (AI Metadata Organization)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| @google/genai | ^1.48.0 | Call Gemini 2.5 Flash to infer artist/album/track from messy filenames + partial metadata | The official Google Gen AI SDK for JavaScript/TypeScript. Replaces the deprecated `@google/generative-ai` package. Clean API: `ai.models.generateContent()`. Supports structured JSON output via `responseSchema` -- critical for getting typed metadata back, not freeform text. |

**Why Gemini 2.5 Flash specifically:**
- **Free tier:** 10 RPM, 250 RPD, 250K TPM -- sufficient for scanning collections of 500-1000 files per day
- **Paid tier:** $0.30/M input tokens, $2.50/M output tokens -- extremely cheap for short metadata prompts (~100 tokens input, ~50 tokens output per file = ~$0.0002 per file)
- **Latency:** Sub-second for short prompts -- will not bottleneck the scan pipeline
- **Structured output:** Supports `responseSchema` parameter to force JSON output matching a TypeScript interface
- **NOT Gemini 2.0 Flash:** Deprecated, shutting down June 1, 2026
- **NOT Gemini 3 Flash Preview:** Still in preview, more expensive ($0.50/M input), unnecessary for simple metadata inference

**Why NOT alternatives:**
- OpenAI GPT-4o-mini: More expensive, no free tier this generous, requires separate API key management
- Local LLM (Ollama/llama.cpp): Requires users to download 2-8GB models. Kills the "just works" UX. Solo developer cannot support local model debugging across user hardware.
- Claude Haiku: More expensive per token for this use case, no free tier

**Integration notes:**
- API key stored in `electron-store` (already in dependencies), encrypted at rest
- Run in main process only (API key never exposed to renderer)
- Batch metadata inference: group 5-10 files per prompt to reduce RPM usage ("Here are 10 filenames and their partial ID3 tags, infer artist/album/track for each")
- Implement retry with exponential backoff on 429 (rate limit) responses
- Cache AI results in electron-store to avoid re-inferring on subsequent scans
- Confidence: **HIGH** for SDK choice, **MEDIUM** for free tier stability (Google has reduced quotas before -- December 2025 cuts were 50-80%)

### 4. Diff Scan on Startup (Index Persistence)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| electron-store | 8.2.x (already installed) | Persist file index (path, size, mtime, hash) between sessions | **No new dependency.** Already in `package.json`. Store the scan index as a JSON blob keyed by watched folder path. On startup, read the index, compare against current filesystem state (`fs.stat` each file), identify additions/removals/modifications. |

**Escalation path if collections grow large:**

| Technology | Version | Purpose | When to Add |
|------------|---------|---------|-------------|
| better-sqlite3 | ^11.x | Local SQLite database for file index | Only if electron-store proves too slow for collections exceeding ~2000 files. A 5000-file index (~1MB JSON) gets slow to serialize/deserialize on every change. better-sqlite3 is synchronous, zero-dependency native SQLite binding that queries individual records without loading everything into memory. **Do not add preemptively.** |

**Why NOT alternatives for persistence:**
- `electron-json-storage`: Callback-based API, less maintained, no schema validation. electron-store is already installed.
- SQLite from the start: Premature optimization. Most vinyl collections scan to 200-2000 files. electron-store handles this fine. Add SQLite only if profiling shows >500ms index load times.
- IndexedDB in renderer: Wrong process. File scanning runs in main process; storing results in renderer's IndexedDB creates unnecessary IPC overhead.

**Diff algorithm (no library needed):**
- On startup: `fs.stat()` each path in the stored index, compare `mtime` and `size`
- Files with changed mtime/size: re-extract metadata
- Files missing from disk: mark as removed
- New files (found by directory listing but not in index): queue for metadata extraction + AI inference
- This is purely filesystem stat calls -- Node.js `fs.stat` / `fs.readdir` are sufficient
- Confidence: **HIGH** -- straightforward comparison logic, no exotic dependencies

### 5. Auto-Start with Windows

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Electron `app.setLoginItemSettings()` (built-in) | Electron 41.x (already installed) | Register/unregister app to start at Windows login | **No new dependency.** Electron's built-in API writes to `HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run` registry key. Accepts `openAtLogin: boolean`, `path` (defaults to `process.execPath`), and `args` (string array). Works on Windows and macOS natively. |

**Why NOT `auto-launch` npm package:**
- Adds a dependency to do exactly what Electron already does natively
- `auto-launch` exists for non-Electron apps (NW.js, plain Node scripts) that lack a built-in API
- Electron's API is more reliable because it uses the same OS integration code paths

**Integration notes:**
- Wire to a settings toggle in the UI: "Start DigSwap when Windows starts"
- Pass `args: ['--minimized']` so the app starts in tray mode (no visible window)
- In `apps/desktop/src/main/index.ts`, check `process.argv` for `--minimized` flag and skip `createMainWindow()`, only create the tray
- Use `app.getLoginItemSettings()` to read current state for the settings toggle
- Known issue: registry entry persists after uninstall. Clean up in the uninstaller (electron-builder NSIS script).
- Confidence: **HIGH** -- built-in Electron API, well-documented, Windows-specific parameters available

## Summary: What To Install

```bash
# From apps/desktop/
npm install chokidar@^4 @google/genai@^1.48
```

**That is it. Two packages.**

Everything else is already available:
- System tray: `Electron.Tray` (built-in)
- Auto-start: `Electron.app.setLoginItemSettings()` (built-in)
- Metadata extraction: `music-metadata` ^10.0.0 (already installed)
- Audio processing: `ffmpeg-static` ^5.2.0 (already installed)
- Index persistence: `electron-store` ^8.2.0 (already installed)
- Diff scan: `fs.stat` + `fs.readdir` (Node.js built-in)
- Server sync: `@supabase/supabase-js` ^2.101.0 (already installed)

## What NOT To Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `auto-launch` / `electron-auto-launch` | Electron has `app.setLoginItemSettings()` built-in | Built-in Electron API |
| `chokidar` v5.x | ESM-only, potential CJS interop issues with electron-vite main process | chokidar 4.x (ESM + CJS) |
| `@google/generative-ai` | Deprecated legacy package, last published over a year ago, Google recommends migrating away | `@google/genai` (current official SDK, v1.48+) |
| `better-sqlite3` (initially) | Premature optimization for <2000 file indices | `electron-store` (already installed); add SQLite only if perf testing demands it |
| Local LLM (Ollama, llama.cpp) | Requires multi-GB model downloads, hardware-dependent, support nightmare for solo dev | Gemini 2.5 Flash API (free tier, cloud-hosted) |
| `node-watch` / `gaze` / `watchpack` | Less reliable, fewer edge case fixes than chokidar | chokidar 4.x |
| Socket-based file watcher IPC | Overengineered for single-app architecture | Direct chokidar events in main process, IPC to renderer via `ipcMain.handle` |
| `electron-tray-window` / tray helper libs | Thin wrappers around Electron's built-in Tray API with questionable maintenance | Direct use of `Electron.Tray` + `Electron.Menu` |

## Version Compatibility Matrix

| New Package | Compatible With | Notes |
|-------------|-----------------|-------|
| chokidar 4.x | Electron 41 (Node 20.x) | CJS + ESM dual support. Node 14+ required (far exceeded). |
| chokidar 4.x | electron-vite 5.x | Works in main process bundle. electron-vite handles CJS resolution. |
| @google/genai ^1.48 | Node 18+ | Pure JS, no native dependencies. Works in Electron main process without rebuild. |
| @google/genai ^1.48 | TypeScript 5.x | Full type definitions included in package. |

## Architecture Integration Points

### New modules to create in `apps/desktop/src/main/`:

| Module | Purpose |
|--------|---------|
| `tray.ts` | Tray icon lifecycle, context menu, minimize-to-tray behavior, balloon notifications |
| `library/scanner.ts` | Recursive folder scan, metadata extraction pipeline (music-metadata), diff logic |
| `library/file-watcher.ts` | Chokidar watcher lifecycle, event handling, debouncing, audio extension filtering |
| `library/gemini-metadata.ts` | Gemini API client, batch inference (5-10 files per prompt), caching, retry with backoff |
| `library/library-store.ts` | File index persistence via electron-store, CRUD for library items |
| `library/sync.ts` | Upload local library items to Supabase (source: "local"), diff with server state |

### Existing files to modify:

| File | Change |
|------|--------|
| `index.ts` | Add tray creation on `app.whenReady()`, `--minimized` flag handling, change `window-all-closed` to keep alive |
| `ipc.ts` | Add IPC handlers for library scan, progress streaming, watcher control, auto-start toggle, Gemini key management |
| `config.ts` | Add Gemini API key resolution from electron-store |
| `window.ts` | Intercept close event to hide-to-tray instead of closing |

### New IPC channels:

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `library:select-folder` | renderer -> main | Open native folder picker dialog |
| `library:scan-folder` | renderer -> main | Trigger full scan of selected folder |
| `library:scan-progress` | main -> renderer | Stream scan progress (file count, current file, errors) |
| `library:get-items` | renderer -> main | Query scanned library items (with filtering) |
| `library:watcher-status` | bidirectional | Get/set file watcher active state |
| `settings:auto-start` | bidirectional | Get/set Windows login item settings |
| `settings:gemini-key` | renderer -> main | Store/retrieve Gemini API key |
| `settings:tray-mode` | bidirectional | Get/set tray daemon preference |

## Gemini API Usage Pattern

```typescript
// Batch prompt structure for metadata inference
const prompt = `You are a vinyl record metadata expert. Given these audio files 
with partial metadata, infer the correct artist, album, and track name.

Files:
${files.map((f, i) => `${i+1}. Path: "${f.relativePath}" | ID3 Artist: "${f.artist || 'unknown'}" | ID3 Album: "${f.album || 'unknown'}" | ID3 Title: "${f.title || 'unknown'}"`).join('\n')}

Return JSON array matching the input order.`;

// Use responseSchema for typed output
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: prompt,
  config: {
    responseMimeType: 'application/json',
    responseSchema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          artist: { type: 'string' },
          album: { type: 'string' },
          track: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['artist', 'album', 'track', 'confidence'],
      },
    },
  },
});
```

**Rate limit strategy:**
- Batch 5-10 files per request (stays well under 250K TPM)
- Sequential requests with 6-second spacing (10 RPM = 1 request per 6 seconds)
- For a 1000-file collection: 100-200 requests = 10-20 minutes at free tier rate
- If user has API key with paid tier: parallel requests, no spacing needed

## Sources

- [Electron Tray API Documentation](https://www.electronjs.org/docs/latest/api/tray) -- HIGH confidence, official docs
- [Electron Tray Tutorial](https://www.electronjs.org/docs/latest/tutorial/tray) -- HIGH confidence, official tutorial
- [Electron app.setLoginItemSettings](https://www.electronjs.org/docs/latest/api/app) -- HIGH confidence, official docs
- [Electron nativeImage](https://www.electronjs.org/docs/latest/api/native-image) -- HIGH confidence, official docs
- [chokidar GitHub](https://github.com/paulmillr/chokidar) -- HIGH confidence, 35K+ stars, actively maintained
- [chokidar npm](https://www.npmjs.com/package/chokidar) -- HIGH confidence, v4.x confirmed CJS+ESM
- [Vite issue on chokidar v4 upgrade](https://github.com/vitejs/vite/issues/18129) -- MEDIUM confidence, confirms v4 stability
- [@google/genai npm](https://www.npmjs.com/package/@google/genai) -- HIGH confidence, official Google SDK, v1.48.0
- [@google/generative-ai npm (deprecated)](https://www.npmjs.com/package/@google/generative-ai) -- HIGH confidence, confirms legacy status
- [Gemini API Quickstart](https://ai.google.dev/gemini-api/docs/quickstart) -- HIGH confidence, official docs
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing) -- HIGH confidence, official pricing page
- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits) -- HIGH confidence, official rate limit docs
- [electron-store GitHub](https://github.com/sindresorhus/electron-store) -- HIGH confidence, already in project dependencies

---
*Stack additions research for: DigSwap v1.3 Local Library milestone*
*Researched: 2026-04-13*
