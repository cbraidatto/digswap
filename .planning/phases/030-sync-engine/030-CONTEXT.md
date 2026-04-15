# Phase 30: Sync Engine - Context

**Gathered:** 2026-04-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Desktop Electron app uploads local library metadata from its SQLite index to Supabase, creating collection items visible on the user's web profile. Deduplicates against existing Discogs-imported releases, handles file deletions with soft-delete grace period, and syncs incrementally (only changed items).

Surfaces in scope:
- Sync API endpoint on the web app (`POST /api/desktop/library/sync`)
- Electron sync manager (batch loop, retry, syncedAt tracking)
- Release creation for local-only items (shared per album, no Discogs match)
- Dedup logic: exact normalized match + Discogs API fallback
- Deletion sync with soft-delete (7-day grace, `deletedAt` column)
- Drizzle schema migration for `deletedAt` on `collection_items`
- Purge job for expired soft-deleted items

Out of scope:
- File watcher / daemon (Phase 31)
- AI metadata enrichment (Phase 32)
- Library UI changes (Phase 29 delivered this)
- Search/filter within the library
- Cover art fetching for local releases (future enhancement)
- Discogs API enrichment of local releases beyond dedup matching (Phase 32 candidate)

</domain>

<decisions>
## Implementation Decisions

### D-01: Dedup Strategy — Two-Stage (Exact + Discogs Fallback)
- **Stage 1:** Normalize artist+album (lowercase, strip articles "The/A/An", trim punctuation, collapse whitespace) and exact-match against existing `releases` table
- Gate on confidence: tracks with `artistConfidence: 'high'` AND `albumConfidence: 'high'` go through exact match first
- **Stage 2:** Unmatched items (or items with `low` confidence metadata) get queued for Discogs API search
- Discogs search uses `@lionralfs/discogs-client` already in the server-side stack
- Rate limit aware: Discogs queue runs at low priority, separate from collection import queue
- If Discogs finds a match: update local release record with `discogsId`, fill in cover/genre/tracklist
- If Discogs finds no match: release remains local-only (`discogsId = NULL`)
- `discogsId` is already nullable on `releases` table — no schema change needed for this
- **NOTE:** Stage 2 (Discogs dedup queue) is deferred to Phase 32. Phase 30 implements Stage 1 only and increments `dedupQueued` counter for items that would enter Stage 2.

### D-02: Sync Transport — Dedicated API Route
- `POST /api/desktop/library/sync` with Bearer token (Supabase access token)
- Follows existing handoff pattern: `admin.auth.getUser(accessToken)` for auth validation
- Electron batches 50-100 tracks per request to stay under Vercel 10s Hobby timeout
- Request body: `{ tracks: TrackSyncPayload[], deletedReleaseIds: string[] }`
- **DEVIATION from original design:** Originally specified `deletedPaths: string[]` (file paths). Changed to `deletedReleaseIds: string[]` (web-side release UUIDs) because the server cannot map file paths to collection items without storing paths in the database. Instead, the desktop tracks albumKey-to-releaseId mappings locally (in a `release_mappings` SQLite table), detects deleted files via `fs.existsSync`, looks up their release IDs, and sends those UUIDs. This is cleaner and avoids adding a `localPath` column to the web schema.
- Response body includes `releaseMappings: Array<{ albumKey: string; releaseId: string }>` so the desktop can populate its mapping table after each successful batch.
- Electron sync manager: iterates batches, writes `syncedAt = now()` to SQLite on 200 OK per batch
- Resumable: on failure, next sync picks up from `WHERE syncedAt IS NULL OR syncedAt < modifiedAt`
- Idempotent: upsert semantics on server side (conflict on user_id + release_id)

### D-03: Deletion Behavior — Soft-Delete with 7-Day Grace Period
- When a local file is removed and sync runs, server sets `deletedAt = now()` on the corresponding `collection_items` row
- Items with `deletedAt IS NOT NULL` are hidden from public UI (profile, discovery, trade)
- All collection queries add `WHERE deleted_at IS NULL` filter
- `pg_cron` job purges rows where `deletedAt < now() - interval '7 days'`
- Preserves user-curated data (notes, conditionGrade, personalRating, visibility) during grace period
- If file reappears within 7 days (folder reorganization), sync clears `deletedAt` back to NULL
- Schema change: add `deletedAt` column to `collection_items` table (nullable timestamp)

### D-04: Release Creation — Shared Release Per Album
- One `releases` record per unique normalized artist+title combination
- Multiple tracks from the same local album share one release record
- Local-only releases have `discogsId = NULL`, sparse metadata (artist, title, year if available)
- `addedVia: 'local'` on `collection_items` — no migration needed, column accepts any varchar(20)
- Leaderboard/rarity queries exclude local releases with `WHERE discogs_id IS NOT NULL`
- Cover art absence: use "unknown sleeve" placeholder image (consistent with retro aesthetic)
- Release insert uses service role (same RLS pattern as Discogs import pipeline)
- Future enrichment path: `UPDATE releases SET discogs_id = X WHERE id = Y` when Discogs match found later

### Claude's Discretion
- Exact normalization function implementation (regex vs manual string ops)
- Discogs search queue implementation (in-memory vs pg-backed)
- Batch size tuning within the 50-100 range
- pg_cron purge schedule (daily vs hourly)
- "Unknown sleeve" placeholder image design
- Error handling strategy for partial batch failures
- Whether to show sync progress in the desktop UI (simple status text vs detailed progress)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Desktop Library (Phase 29 — direct dependency)
- `apps/desktop/src/main/library/db.ts` — SQLite schema, TrackRow interface, syncedAt/syncHash columns, CRUD operations
- `apps/desktop/src/main/library/scanner.ts` — Scanner implementation, metadata extraction flow
- `apps/desktop/src/main/library/library-ipc.ts` — IPC handlers for library operations
- `apps/desktop/src/main/library/metadata-parser.ts` — Tag extraction, music-metadata usage

### Desktop Auth & Transport
- `apps/desktop/src/main/supabase-auth.ts` — DesktopSupabaseAuth, getAccessToken() for Bearer auth
- `apps/desktop/src/main/ipc.ts` — IPC handler registration pattern, existing desktop→web communication
- `apps/desktop/src/shared/ipc-types.ts` — Bridge interfaces, event type definitions

### Web Schema (sync target)
- `apps/web/src/lib/db/schema/collections.ts` — collectionItems table, addedVia column, RLS policies, indexes
- `apps/web/src/lib/db/schema/releases.ts` — releases table, discogsId (nullable), service-role RLS for inserts/updates
- `apps/web/src/lib/db/schema/import-jobs.ts` — Import job pattern (type: 'collection' | 'wantlist' | 'sync')

### Web Auth Pattern for Desktop
- `apps/web/src/app/api/desktop/handoff/consume/route.ts` — Existing desktop→web auth pattern (Bearer + admin.auth.getUser)
- `apps/web/src/actions/desktop.ts` — Desktop-related server actions

### Discogs Integration (for dedup fallback)
- `apps/web/src/lib/discogs/` — Discogs client, OAuth, rate limit handling

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DesktopSupabaseAuth.getAccessToken()` — Live Supabase token for Bearer auth from desktop
- `admin.auth.getUser(accessToken)` — Auth validation pattern in handoff consume route
- `@lionralfs/discogs-client` — Already in server-side for Discogs API calls
- `computeFileSha256` — Streaming hash in `ffmpeg-pipeline.ts` (for syncHash computation)
- `import_jobs` table — Existing pattern for background job tracking (type: 'sync' ready)

### Established Patterns
- **Desktop→Web auth:** Bearer token in Authorization header, validated with `admin.auth.getUser()`
- **Service-role writes:** Releases use `supabaseAuthAdminRole` for insert/update (local releases follow same pattern)
- **Batch processing:** Discogs import processes in batches with progress tracking
- **IPC bridge:** `ipcMain.handle("desktop:channel-name", handler)` pattern for new sync triggers

### Integration Points
- `collection_items.addedVia` — Add `"local"` value (varchar, no migration needed)
- `collection_items` — Add `deletedAt` timestamp column (migration required)
- `releases` — Insert local-only releases with `discogsId = NULL`
- `/api/desktop/` — New sync route alongside existing handoff routes
- Desktop library IPC — Add sync trigger handler
- `pg_cron` — Add purge job for soft-deleted items (pattern exists for other scheduled tasks)

</code_context>

<specifics>
## Specific Ideas

- Confidence flags from Phase 29 (`high`/`low` per field) directly gate dedup strategy: high-confidence → exact match, low-confidence → Discogs API search
- `syncedAt`/`syncHash` columns in SQLite were designed specifically for this phase's incremental sync
- The existing Discogs rate limit (60 req/min) is shared between collection import and dedup — dedup queue must be low-priority
- Batch size of 50-100 tracks per API call keeps well within Vercel 10s timeout for metadata-only upserts
- Soft-delete recovery (clearing `deletedAt`) handles the common case of folder reorganization without data loss

</specifics>

<deferred>
## Deferred Ideas

- **Cover art fetching for local releases** — Could query MusicBrainz or Discogs for cover images. Belongs in Phase 32 or backlog
- **Discogs enrichment beyond dedup** — Filling in genre, style, tracklist for matched releases. Phase 32 candidate
- **Cross-user discovery for local releases** — "Who else has this local album?" Currently local releases with `discogsId = NULL` won't appear in discovery. Future feature
- **Sync conflict resolution UI** — What if user edits a collection item on web while desktop syncs a change? Currently last-write-wins. More sophisticated merge could be a future enhancement
- **Multiple library roots support** — Phase 29 deferred this; sync engine would need to handle multiple sources per user
- **Stage 2 Discogs dedup queue** — D-01 describes a Discogs API fallback for unmatched/low-confidence items. Phase 30 implements Stage 1 (normalized exact match) only and increments `dedupQueued` counter. The actual Discogs search queue (background job, rate limiting, result merging) is deferred to Phase 32. The `dedupQueued` counter in SyncResponse tracks how many items would benefit from this.

</deferred>

---

*Phase: 030-sync-engine*
*Context gathered: 2026-04-14*
