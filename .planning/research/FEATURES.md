# Feature Landscape: Local Library (v1.3 — Soulseek-Inspired Collection Import)

**Domain:** Desktop local music library scanning, AI metadata correction, background daemon, cloud sync
**Researched:** 2026-04-13
**Scope:** NEW features only — existing Discogs import, P2P trading, gamification already built

## Reference Apps Studied

| App | Relevant Pattern | Key Lesson |
|-----|-----------------|------------|
| Soulseek/Nicotine+ | Shared folder scanning, background indexing, file watching | Two-phase scan: filesystem read (background thread) then index incorporation (main thread). Large libraries (50K+ files) need async processing or the UI freezes. |
| Plex Media Server | Automatic library detection, partial scanning, periodic full scan | Three-tier detection: OS filesystem events (instant), partial folder scan (efficient), periodic full scan (fallback). Filesystem events fail on network drives — always have a fallback. |
| MusicBrainz Picard | Acoustic fingerprinting + metadata DB lookup, three-stage tagging | Stage 1: identify album via metadata/fingerprint. Stage 2: match files to tracks. Stage 3: write corrected tags + rename/move. Users expect a preview before writing. |
| beets | CLI auto-tagger, plugin architecture, MusicBrainz integration | Import command scans directory, groups files into albums by folder structure, queries MusicBrainz, presents match candidates with confidence scores. Plugin hooks let you augment metadata post-lookup. |
| Audirvana | Local library manager for audiophiles, cloud sync | Hybrid local-cloud architecture with automatic sync. Metadata matching + updating from external services. |

---

## Table Stakes

Features users expect from any local library scanner. Missing any = product feels broken.

| Feature | Why Expected | Complexity | Dependencies | Notes |
|---------|--------------|------------|--------------|-------|
| **Folder picker + recursive scan** | Every music manager starts here. Soulseek, Plex, beets, Picard all begin with "point me at a folder." | Low | Electron `dialog.showOpenDialog` | Support multiple root folders (users split music across drives). Recursive by default, respect symlinks. |
| **Audio file detection** | Must recognize common formats: FLAC, MP3, WAV, AIFF, OGG, AAC/M4A, ALAC. Ignoring formats = "where are my files?" | Low | `music-metadata` npm (v8+, ESM) | Filter by extension first (fast), then validate header. Reject non-audio gracefully. |
| **ID3/Vorbis tag extraction** | Baseline metadata source. Every app reads embedded tags first. If tags exist, show them immediately — don't make users wait for AI. | Low | `music-metadata` npm handles ID3v1, ID3v2, APE, Vorbis, iTunes/MP4 | Extract: artist, album, title, track number, year, genre, album art. Fall back to filename/folder parsing when tags are empty. |
| **Filename + folder structure parsing** | When tags are missing (common with vinyl rips), folder names like `Artist - Album/01 - Track.flac` are the primary metadata source. Soulseek users organize this way religiously. | Medium | Regex heuristics | Common patterns: `Artist/Album/Track`, `Artist - Album/NN - Track`, `Artist - Album (Year)/Track`. Must handle edge cases: multi-disc, compilations, VA. |
| **Local index/database** | Scanned data must persist between sessions. Plex and Soulseek both maintain a local index that survives restarts. Re-scanning 10K files on every launch is unacceptable. | Medium | SQLite via `better-sqlite3` (Electron main process) | Store: file path, size, mtime, hash, extracted metadata, AI-corrected metadata, sync status. Index on path for fast diff scans. |
| **Diff scan on startup** | When app reopens, compare stored index vs filesystem. Only process added/removed/changed files. Plex calls this "partial scanning." | Medium | Depends on local index | Compare by (path + mtime + size) tuple — fast and avoids hashing every file. Flag changed files for re-extraction. |
| **Progress indicators** | Scanning 5000 files takes time. Users need: current file count, total estimate, files/second, ETA. Soulseek shows scanning progress; Picard shows a queue. | Low | IPC events from main to renderer | Batch progress updates (every 50 files or 500ms) to avoid flooding the renderer. |
| **Scan results preview** | Show what was found before syncing to server. Picard and beets both show candidates and let users review. Users want to verify before committing. | Medium | Renderer UI | Group by album, show extracted metadata, flag items with missing/suspicious data, let user edit before sync. |
| **Sync to web collection** | Items must appear in the web app alongside Discogs imports. The whole point is unifying the library. | High | Existing `collection_items` + `releases` schema, Supabase API | New `addedVia: "local"` source. Create release records from local metadata. Deduplicate against existing Discogs releases (match by artist+title+year). |

---

## Differentiators

Features that set DigSwap apart from generic library managers. Not expected, but valuable for the vinyl digger audience.

| Feature | Value Proposition | Complexity | Dependencies | Notes |
|---------|-------------------|------------|--------------|-------|
| **AI metadata correction (Gemini Flash)** | The killer feature for vinyl rip collections. Vinyl rips are notoriously poorly tagged — misspellings, wrong artists, missing albums. No other social music platform offers AI-powered cleanup. Picard uses acoustic fingerprinting (requires exact audio match in MusicBrainz DB); beets uses text matching against MusicBrainz. AI can infer from partial/garbled data that neither approach handles. | High | Gemini 2.5 Flash API, structured output (JSON schema), rate limiting | Send: extracted tags + filename + folder path. Receive: corrected artist, album, title, year, genre. Use structured output (`response_mime_type: "application/json"`) to guarantee parseable responses. Batch by album (one API call per album, not per track). Cost: ~$0.001-0.003 per album at Flash pricing. |
| **System tray daemon with file watching** | App runs always-on in background like Soulseek/Plex. New files detected automatically, no manual re-scan needed. Critical for the "living library" feel — drop a new rip in your folder and it appears in your web collection. | Medium | Electron Tray API, `chokidar` v5 (ESM, fs.watch-based), `auto-launch` npm | Minimize to tray on close (configurable). Watch registered folders for add/remove/change events. Debounce rapid changes (500ms). Process new files through tag extraction pipeline. |
| **Auto-launch on Windows startup** | Plex and Soulseek both offer this. For a daemon app, auto-start is expected by power users who want their library always current. | Low | `auto-launch` npm or Electron's `app.setLoginItemSettings()` | Toggle in settings. Use `app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })` — launches minimized to tray. |
| **YouTube link resolution per release** | Existing feature for Discogs releases; extending it to local library items. Every identified album gets a YouTube video link automatically. Unique to DigSwap — no other library manager does this. | Medium | YouTube Data API v3 `search.list`, existing `youtube_video_id` on releases table | Search query: `"${artist} ${album} full album"`. Cache results on release record. Rate limit: YouTube API has 10K units/day free quota; search costs 100 units, so 100 searches/day. Batch during scan, not on-demand. Consider fallback to `invidious` API if quota is tight. |
| **Smart album grouping** | Automatically group loose files into albums based on folder structure + metadata similarity. beets does this well — files in the same folder with sequential track numbers = one album. Loose files in a flat folder = singles. | Medium | Heuristic algorithm | Group by: (1) folder path, (2) album tag if present, (3) artist similarity within folder. Handle: multi-disc (CD1/CD2 subfolders), compilations (Various Artists), singles (no album tag). |
| **Confidence scoring for metadata** | Show users how confident the system is about each piece of metadata. Picard shows match percentage; beets shows similarity score. Helps users prioritize what to review. | Low | Scoring algorithm | Score based on: tags present (high), filename parseable (medium), AI-inferred only (lower), nothing found (flag for manual entry). Display as color-coded badges: green/yellow/red. |
| **Discogs cross-reference** | When AI identifies an album, try to match it against the Discogs database. If found, link the local item to the canonical Discogs release — enabling rarity scores, community data, and all existing social features. | High | Discogs API search (`/database/search`), rate limited (60 req/min) | Search by artist + album title. If high-confidence match found, link to existing `releases` record. If no match, create a "local-only" release. This is the bridge between local library and the existing Discogs-powered ecosystem. |

---

## Anti-Features

Features to explicitly NOT build. Tempting but wrong for this product.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Acoustic fingerprinting (Chromaprint/AcoustID)** | Requires computing audio fingerprints (CPU intensive), sending to external service, and matching against MusicBrainz DB. Adds massive complexity (native binary dependency for Chromaprint, ~2s per file processing). MusicBrainz DB coverage of obscure vinyl rips is poor. Picard's strength is mainstream music; vinyl diggers collect obscure pressings that often have no MusicBrainz entry. AI inference from filenames is more practical for this audience. | Use Gemini Flash AI for metadata inference. It handles partial/garbled metadata better than fingerprinting handles obscure releases. |
| **Tag writing back to files** | Modifying user's audio files is a liability. If the AI gets metadata wrong and writes it, users lose their original tags. Picard does this because it IS a tagger; DigSwap is a social network that happens to scan files. | Store corrected metadata in the local database and server-side only. Never modify the user's files. Show "suggested corrections" that users can accept. |
| **Full music player** | Feature creep. Users have foobar2000, VLC, Audirvana. Building a player adds months of work (gapless playback, format support, audio device handling) with zero differentiation. | Provide "Open in default player" button. Focus on library management and social features. |
| **Cloud file storage/backup** | Contradicts the P2P legal posture. Server stores metadata only, never audio files. Adding cloud storage creates liability and massive infrastructure cost. | Files stay local. Only metadata syncs to server. |
| **Automatic file organization/renaming** | Moving/renaming user files without explicit consent is dangerous. beets does this as its core workflow, but beets users expect it — DigSwap users are importing an existing library, not reorganizing it. | Scan in-place. Never move, rename, or modify files. Reference by absolute path. |
| **Real-time streaming from local library** | Turning the desktop app into a streaming server (like Plex for music) is a completely different product. Massive scope, bandwidth concerns, transcoding needs. | Stick to P2P trading for audio sharing. Local library is for cataloging and discovery. |
| **BitTorrent/distributed sync** | WebTorrent or DHT-based sync between devices is overengineered for a single-user local library. The sync target is one server (Supabase), not peer-to-peer replication. | Simple REST API sync: desktop pushes metadata diffs to Supabase via authenticated API calls. |

---

## Feature Dependencies

```
Folder picker + recursive scan
  --> Audio file detection
    --> ID3/Vorbis tag extraction
      --> Filename/folder parsing (fallback)
        --> Smart album grouping
          --> Local index/database (store results)
            --> Diff scan on startup (compare index vs filesystem)
            --> Scan results preview (show to user)
              --> AI metadata correction (enhance incomplete data)
                --> Confidence scoring (rate each result)
                  --> Discogs cross-reference (link to existing releases)
                    --> Sync to web collection (push to Supabase)
                      --> YouTube link resolution (enrich synced releases)

System tray daemon
  --> File watching (chokidar)
    --> Incremental scan pipeline (reuse extraction + AI + sync)
  --> Auto-launch on startup

Progress indicators (parallel concern — attach to any scan operation)
```

### Critical Path

The dependency chain that blocks everything else:

1. **Local index/database** — without persistent storage, nothing works
2. **Folder scan + tag extraction** — the raw data pipeline
3. **Sync to web collection** — the integration point with existing DigSwap
4. **AI metadata correction** — the differentiator that justifies the feature

Everything else (tray, file watching, YouTube, Discogs cross-ref) is valuable but not blocking.

---

## MVP Recommendation

### Phase 1: Core Scan Pipeline (must-have)
1. Folder picker with recursive scan
2. Audio file detection + tag extraction (`music-metadata`)
3. Filename/folder structure parsing as fallback
4. Smart album grouping
5. Local SQLite index (persist between sessions)
6. Scan results preview in renderer
7. Progress indicators

### Phase 2: AI + Sync (the value delivery)
1. AI metadata correction via Gemini Flash (batch by album)
2. Confidence scoring on metadata
3. Sync to web collection (`addedVia: "local"`)
4. Deduplication against existing Discogs releases

### Phase 3: Daemon + Live Updates
1. System tray minimize
2. File watching with chokidar
3. Diff scan on startup
4. Auto-launch on Windows startup
5. Incremental sync (new/changed files only)

### Phase 4: Enrichment
1. Discogs cross-reference for identified albums
2. YouTube link resolution for synced releases

### Defer
- **Acoustic fingerprinting**: LOW ROI for obscure vinyl. Revisit only if AI metadata correction proves insufficient.
- **Tag writing**: Never. Store corrections server-side only.
- **Any file modification**: Hard no. Scan in-place, reference by path.

---

## Existing Schema Integration Notes

The current `collection_items` table has `addedVia: varchar("added_via", { length: 20 })` with values `"discogs"` and `"manual"`. Adding `"local"` as a third source integrates cleanly.

The `releases` table has `discogsId: integer("discogs_id").unique()` which allows local-only releases (where `discogsId` is NULL) alongside Discogs-sourced releases. The `youtubeVideoId` field is already present for YouTube link resolution.

Key schema additions needed:
- **New table: `local_library_items`** (desktop-side SQLite) — file path, size, mtime, hash, raw tags, AI-corrected tags, sync status, linked `collection_item_id`
- **New column on `collection_items`**: none needed, `addedVia: "local"` is sufficient
- **New column on `releases`**: possibly `source: "discogs" | "local" | "manual"` to distinguish release origin, though `discogsId` being NULL already signals this

---

## User Behavior Patterns (from reference apps)

### Scanning Behavior
- **Soulseek users** configure shared folders once and rarely change them. They expect the app to notice new files automatically.
- **Plex users** add a library folder and forget about it. Automatic detection is the norm; manual rescans are a frustration signal.
- **beets users** run import commands per-album or per-folder. They expect an interactive review step before metadata is committed.
- **DigSwap pattern should be:** Configure folders once (like Soulseek), scan automatically (like Plex), show preview before sync (like beets). The review step is critical because AI metadata can be wrong.

### Metadata Correction Behavior
- **Picard users** drag files in, wait for fingerprinting, review suggested matches, accept or reject per-album. Turnaround: 2-5 seconds per file for fingerprinting.
- **beets users** run `beet import`, see candidate matches with similarity scores, pick the right one or enter manually. Turnaround: 1-2 seconds per album for text matching.
- **DigSwap pattern should be:** Scan extracts tags instantly, AI correction runs as a background batch job, results appear with confidence scores. Users review a dashboard of albums with flagged corrections. Accept all / accept per-album / edit manually. No per-file interaction unless user wants it.

### Daemon Behavior
- **Soulseek** runs in the foreground as a windowed app. Closing = quitting. No tray mode in original client (Nicotine+ added tray support).
- **Plex** runs as a background service/daemon. No UI needed for ongoing operation. Tray icon for status.
- **DigSwap pattern should be:** Closing the window minimizes to tray (configurable — some users hate tray apps). Tray icon shows sync status (idle, scanning, syncing). Right-click menu: Open, Rescan Now, Settings, Quit. Double-click tray icon = open window.

### Sync Behavior
- **Plex** syncs metadata to its own server continuously. No user intervention needed.
- **Audirvana** syncs library to cloud for cross-device access.
- **DigSwap pattern should be:** Sync happens automatically after scan completes and user approves metadata. Show sync progress. Handle offline gracefully (queue syncs, retry on reconnect). Conflict resolution: server wins for Discogs data, local wins for local-only items.

---

## Complexity Assessment

| Feature Area | Estimated Complexity | Risk Level | Notes |
|-------------|---------------------|------------|-------|
| Folder scan + tag extraction | Low | Low | Well-solved problem, `music-metadata` is mature |
| Local SQLite database | Medium | Low | `better-sqlite3` is battle-tested in Electron |
| Filename parsing heuristics | Medium | Medium | Edge cases are infinite. 80/20 rule: handle common patterns, flag the rest |
| AI metadata correction | High | Medium | Gemini Flash structured output works, but response quality for obscure vinyl is unproven. Need fallback for API failures. Cost at scale needs monitoring. |
| System tray + file watching | Medium | Low | Standard Electron patterns, well-documented |
| Sync to Supabase | High | Medium | Deduplication logic is complex. Must handle: same album from Discogs and local, partial matches, user edits on both sides |
| YouTube resolution | Medium | Medium | API quota limits (100 searches/day on free tier) are the main risk. May need to batch aggressively or use unofficial APIs. |
| Discogs cross-reference | High | High | Rate limited (60 req/min), coverage of obscure releases is spotty, matching heuristics need tuning |

---

## Sources

- [Soulseek Background Scanning](https://www.slsknet.org/news/node/855) — How SoulseekQt handles share scanning in background threads
- [Soulseek FAQ](https://www.slsknet.org/news/faq-page) — General scanning and sharing behavior
- [Plex Scanning vs Refreshing](https://support.plex.tv/articles/200289306-scanning-vs-refreshing-a-library/) — Three-tier detection architecture
- [Plex Library Auto-Scan](https://blog.thefix.it.com/how-to-get-plex-to-automatically-scan-library-files-instantly/) — Filesystem event monitoring
- [MusicBrainz Picard Quick Start](https://picard.musicbrainz.org/quick-start/) — Three-stage tagging workflow
- [MusicBrainz Picard Usage Docs](https://picard-docs.musicbrainz.org/en/usage/using.html) — Detailed metadata correction flow
- [beets Auto-Tagger Guide](https://beets.readthedocs.io/en/stable/guides/tagger.html) — Import workflow and confidence scoring
- [beets GitHub](https://github.com/beetbox/beets) — Plugin architecture and hook system
- [music-metadata npm](https://www.npmjs.com/package/music-metadata) — v8 ESM, ID3/Vorbis/APE/iTunes support
- [music-metadata GitHub](https://github.com/Borewit/music-metadata) — API reference, supported formats
- [chokidar GitHub](https://github.com/paulmillr/chokidar) — v5 ESM, fs.watch-based file watching
- [Gemini API Structured Output](https://ai.google.dev/gemini-api/docs/structured-output) — JSON schema response format
- [YouTube Data API Search](https://developers.google.com/youtube/v3/docs/search) — Quota costs and search parameters
- [Electron System Tray Tutorial](https://www.tutorialspoint.com/electron/electron_system_tray.htm) — Tray API basics
- [Electron Auto-Launch Issue #6893](https://github.com/electron/electron/issues/6893) — Launch minimized to tray on startup
- [Nicotine+ Soulseek Protocol](https://nicotine-plus.org/doc/SLSKPROTOCOL.html) — File sharing protocol internals
- [Local-First Software Architecture Guide](https://techbuzzonline.com/local-first-software-architecture-guide/) — Sync patterns and conflict resolution

---
*Feature research for: DigSwap v1.3 — Local Library milestone*
*Researched: 2026-04-13*
