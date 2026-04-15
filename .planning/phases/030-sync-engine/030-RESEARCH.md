# Phase 30: Sync Engine - Research

**Researched:** 2026-04-14
**Domain:** Desktop-to-web metadata sync, deduplication, incremental transfer
**Confidence:** HIGH

## Summary

Phase 30 bridges the Electron desktop app's local SQLite library index to the web app's Supabase PostgreSQL collection. The desktop app (Phase 29) already has a fully functional scanner with `syncedAt`/`syncHash` columns designed specifically for this phase. The web app has established patterns for collection management via admin client, release upserts, and desktop auth via Bearer tokens.

The core work is: (1) a new API route `POST /api/desktop/library/sync` following the existing handoff auth pattern, (2) an Electron-side sync manager that batches tracks, groups them by album into releases, and sends incrementally, (3) dedup logic (normalized exact match + Discogs API fallback), (4) a `deletedAt` soft-delete column on `collection_items` with a pg_cron purge job, and (5) schema migration. All patterns are well-established in the codebase -- this phase composes existing primitives rather than inventing new ones.

**Primary recommendation:** Follow the existing Discogs import-worker pattern (admin client, batch upserts, import_jobs progress tracking) adapted for desktop-originated sync payloads. Reuse `createAdminClient()` for RLS bypass, `admin.auth.getUser(accessToken)` for desktop auth validation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Two-stage dedup: Stage 1 = normalized exact match (lowercase, strip "The/A/An", trim punctuation, collapse whitespace) on artist+album. Stage 2 = Discogs API search fallback for unmatched/low-confidence items
- D-02: Dedicated API route `POST /api/desktop/library/sync` with Bearer token auth, 50-100 tracks per batch, resumable via `syncedAt` tracking, idempotent upsert semantics
- D-03: Soft-delete with 7-day grace period via `deletedAt` column on `collection_items`, pg_cron purge job, `WHERE deleted_at IS NULL` filter on all collection queries
- D-04: Shared release per album (one `releases` row per normalized artist+title), local-only releases have `discogsId = NULL`, `addedVia: 'local'` on collection_items

### Claude's Discretion
- Exact normalization function implementation (regex vs manual string ops)
- Discogs search queue implementation (in-memory vs pg-backed)
- Batch size tuning within 50-100 range
- pg_cron purge schedule (daily vs hourly)
- "Unknown sleeve" placeholder image design
- Error handling strategy for partial batch failures
- Whether to show sync progress in desktop UI (simple status text vs detailed progress)

### Deferred Ideas (OUT OF SCOPE)
- Cover art fetching for local releases
- Discogs enrichment beyond dedup matching
- Cross-user discovery for local releases
- Sync conflict resolution UI
- Multiple library roots support
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SYNC-01 | App syncs local library metadata to Supabase as collection items with addedVia "local" | API route pattern from handoff/consume, admin client for RLS bypass, release creation pattern from import-worker, `addedVia` column accepts varchar(20) - no migration |
| SYNC-02 | Dedup against existing Discogs-imported releases (same artist + album) | Normalized match against `releases.artist`+`releases.title`, Discogs search via `@lionralfs/discogs-client` already server-side, `discogsId` nullable on releases table |
| SYNC-03 | Deletion sync removes corresponding collection item | Soft-delete via `deletedAt` column (new migration), `WHERE deleted_at IS NULL` filter, pg_cron purge after 7 days, recovery by clearing `deletedAt` |
| SYNC-04 | Incremental sync (only changed items) | SQLite `syncedAt`/`syncHash` columns from Phase 29, desktop queries `WHERE syncedAt IS NULL OR syncedAt < modifiedAt`, marks `syncedAt = now()` per successful batch |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | 0.45.x | Database operations on web side | Already used for all collection/release queries, SQL-like syntax |
| @supabase/supabase-js | Latest | Admin client for RLS bypass | Established pattern via `createAdminClient()` for service-role writes |
| better-sqlite3 | Latest | Desktop SQLite for syncedAt tracking | Already in desktop for library index (Phase 29) |
| @lionralfs/discogs-client | 4.1.x | Discogs API search for dedup fallback | Already server-side, OAuth flow established |
| zod | Latest | Request body validation on API route | Already used in all server actions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Upstash Redis | Serverless | Rate limiting on sync endpoint | Same `apiRateLimit` pattern as other API routes |

**Installation:** No new packages needed. All dependencies are already in the monorepo.

## Architecture Patterns

### Recommended Project Structure
```
apps/desktop/src/main/library/
  sync-manager.ts         # NEW: Orchestrates batch sync loop
  normalize.ts            # NEW: Artist+album normalization for dedup

apps/web/src/app/api/desktop/library/
  sync/route.ts           # NEW: POST handler for sync batches

apps/web/src/lib/sync/
  process-sync-batch.ts   # NEW: Server-side batch processor (dedup, release creation, upsert)
  normalize.ts            # NEW: Same normalization function (shared logic, separate file)
  discogs-dedup-queue.ts  # NEW: Discogs API dedup queue (low-priority)
```

### Pattern 1: Desktop Auth for API Routes
**What:** Bearer token validation using admin client
**When to use:** All desktop-originated API calls
**Example:**
```typescript
// Source: apps/web/src/app/api/desktop/handoff/consume/route.ts (existing)
const authHeader = request.headers.get("authorization");
const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
if (!accessToken) return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });

const admin = createAdminClient();
const { data: { user }, error } = await admin.auth.getUser(accessToken);
if (error || !user) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
```

### Pattern 2: Release Upsert with Admin Client
**What:** Service-role insert/update on releases table (RLS bypassed)
**When to use:** Creating local-only releases and linking to existing ones
**Example:**
```typescript
// Source: apps/web/src/lib/discogs/import-worker.ts (adapted)
// For local releases: insert with discogsId = NULL
const { data: inserted, error } = await admin
  .from("releases")
  .upsert({
    title: normalizedTitle,
    artist: normalizedArtist,
    year: year || null,
    discogs_id: null,        // local-only
    cover_image_url: null,    // "unknown sleeve" placeholder handled in UI
    updated_at: new Date().toISOString(),
  }, { onConflict: "id" })   // NOTE: cannot use discogs_id conflict for null values
  .select("id")
  .single();
```

### Pattern 3: Incremental Sync via SQLite Tracking
**What:** Desktop queries unsynced tracks, marks synced on success
**When to use:** Every sync cycle
**Example:**
```typescript
// Desktop side: get tracks needing sync
const unsynced = db.prepare(`
  SELECT * FROM tracks
  WHERE syncedAt IS NULL OR syncedAt < modifiedAt
  ORDER BY album, trackNumber
`).all();

// After successful batch response:
const markSynced = db.prepare(`
  UPDATE tracks SET syncedAt = ?, syncHash = ? WHERE id = ?
`);
const now = new Date().toISOString();
const tx = db.transaction((ids: string[]) => {
  for (const id of ids) markSynced.run(now, computeHash(track), id);
});
```

### Pattern 4: Album Grouping on Desktop Before Send
**What:** Group tracks by normalized artist+album into album-level payloads
**When to use:** Before batching tracks for the sync API
**Why:** The server creates one `releases` row per album, not per track. Desktop must group tracks to avoid redundant release-creation attempts.
```typescript
// Group tracks by album key
const albumMap = new Map<string, TrackRow[]>();
for (const track of unsynced) {
  const key = normalizeKey(track.artist, track.album);
  if (!albumMap.has(key)) albumMap.set(key, []);
  albumMap.get(key)!.push(track);
}
// Each album group becomes one release + N collection_items
```

### Anti-Patterns to Avoid
- **Sending tracks individually:** Batch 50-100 per request to stay within Vercel 10s timeout
- **Using Drizzle db client in API routes for auth:** Use `admin.auth.getUser()` with Supabase admin client (desktop has no cookie session)
- **Creating releases with upsert on discogs_id for local items:** `discogs_id = NULL` means upsert on that column won't work (NULL != NULL in SQL). Must check existence by normalized artist+title first
- **Skipping normalization on server side:** Even though desktop normalizes, server MUST re-normalize for dedup security (never trust client input)
- **Hard-deleting on sync:** Soft-delete with grace period prevents data loss from folder reorganization

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Desktop auth validation | Custom JWT parsing | `admin.auth.getUser(accessToken)` | Handles refresh, expiry, revocation checks |
| Rate limiting | Custom counter | `apiRateLimit` from Upstash Redis | Already configured, sliding window |
| Release upsert | Raw SQL | Supabase admin client `.upsert()` / `.insert()` | Handles conflicts, returns IDs |
| Discogs API calls | Raw fetch | `@lionralfs/discogs-client` | OAuth, rate limit headers, retry |
| Background job tracking | Custom state | `import_jobs` table with type='sync' | Progress tracking, status, Realtime broadcast |

## Common Pitfalls

### Pitfall 1: NULL upsert conflict on discogs_id
**What goes wrong:** Using `.upsert({ discogs_id: null }, { onConflict: "discogs_id" })` never conflicts because NULL != NULL in SQL.
**Why it happens:** Discogs import uses `onConflict: "discogs_id"` but local releases have no discogs_id.
**How to avoid:** For local-only releases, first query `releases` by normalized artist+title. If found, use that ID. If not, INSERT (no upsert).
**Warning signs:** Duplicate releases appearing for the same local album.

### Pitfall 2: Normalization inconsistency between desktop and server
**What goes wrong:** Desktop normalizes differently than server, causing dedup misses.
**Why it happens:** Two separate normalize functions diverge over time.
**How to avoid:** Implement normalization as a pure function. Desktop sends raw metadata; server normalizes. Desktop normalization is only for local album grouping, not for server dedup decisions.
**Warning signs:** Same album appearing as both a local release and a Discogs release.

### Pitfall 3: Vercel 10s timeout on large batches
**What goes wrong:** Sync batch with Discogs API fallback calls times out.
**Why it happens:** Discogs API calls add latency; if 50 items each need a Discogs search, that's 50 API calls in one request.
**How to avoid:** Separate the two dedup stages. Stage 1 (exact match) happens synchronously in the API route. Stage 2 (Discogs search) is queued as a background job for later processing. The sync response returns immediately after Stage 1.
**Warning signs:** 504 Gateway Timeout errors from Vercel.

### Pitfall 4: deletedAt filter missing from existing queries
**What goes wrong:** Soft-deleted items still appear in collections, discovery, trades, leaderboards.
**Why it happens:** 29+ files query `collection_items` -- easy to miss one.
**How to avoid:** Add `deleted_at IS NULL` to `buildWhereConditions()` in `queries.ts` AND to every raw Supabase admin client query. Audit all 29 files that reference `collection_items`.
**Warning signs:** Deleted items visible on profile or in discovery results.

### Pitfall 5: Discogs rate limit shared with import pipeline
**What goes wrong:** Dedup Discogs searches consume the 60 req/min budget, blocking collection imports.
**Why it happens:** Same API credentials, same rate limit pool.
**How to avoid:** Dedup queue runs at low priority (e.g., 10 req/min reserved) and yields to active imports. Use a simple semaphore or check for active import_jobs before processing dedup queue.
**Warning signs:** Import jobs slowing down or 429 errors during active sync.

### Pitfall 6: collection_items duplicate on re-sync
**What goes wrong:** Running sync twice creates duplicate collection items for the same user+release.
**Why it happens:** No unique constraint on (user_id, release_id) for local items.
**How to avoid:** Use upsert on `collection_items` with conflict on (user_id, release_id), or check existence before insert. The existing code already does select-then-insert for Discogs items.
**Warning signs:** User sees same album multiple times in their web collection.

## Code Examples

### Sync API Route Request/Response Shape
```typescript
// POST /api/desktop/library/sync
// Headers: Authorization: Bearer <supabase_access_token>
interface SyncRequestBody {
  tracks: TrackSyncPayload[];
  deletedPaths: string[];  // file paths removed since last sync
}

interface TrackSyncPayload {
  localTrackId: string;     // SQLite track.id
  filePath: string;
  artist: string | null;
  album: string | null;
  title: string | null;
  year: number | null;
  trackNumber: number | null;
  format: string;           // "FLAC", "WAV", "AIFF"
  bitrate: number;
  sampleRate: number;
  duration: number;
  artistConfidence: "high" | "low";
  albumConfidence: "high" | "low";
}

interface SyncResponse {
  ok: boolean;
  synced: number;           // items successfully processed
  created: number;          // new collection items created
  linked: number;           // items linked to existing Discogs releases
  deleted: number;          // items soft-deleted
  dedupQueued: number;      // items queued for Discogs search
  errors: string[];         // per-item error messages
}
```

### Normalization Function
```typescript
// Shared normalization logic
function normalizeForDedup(value: string | null): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, "")  // strip leading articles
    .replace(/[^\w\s]/g, "")          // remove punctuation
    .replace(/\s+/g, " ")             // collapse whitespace
    .trim();
}

function makeAlbumKey(artist: string | null, album: string | null): string {
  return `${normalizeForDedup(artist)}::${normalizeForDedup(album)}`;
}
```

### Soft-Delete Migration
```sql
-- Migration: add deletedAt to collection_items
ALTER TABLE collection_items
ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for purge job efficiency
CREATE INDEX CONCURRENTLY idx_collection_items_deleted_at
ON collection_items (deleted_at)
WHERE deleted_at IS NOT NULL;

-- pg_cron purge job (run daily at 3:00 AM UTC)
SELECT cron.schedule(
  'purge-soft-deleted-collection-items',
  '0 3 * * *',
  $$DELETE FROM collection_items WHERE deleted_at < now() - interval '7 days'$$
);
```

### Drizzle Schema Update for deletedAt
```typescript
// In collections.ts - add to collectionItems table definition
deletedAt: timestamp("deleted_at", { withTimezone: true }),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard-delete on file removal | Soft-delete with grace period | This phase (D-03) | Preserves user-curated data during folder reorg |
| Discogs-only collection | Discogs + local library | This phase (SYNC-01) | Local files become collection items with source "local" |
| Single addedVia values (discogs/manual) | Three values (discogs/manual/local) | This phase (D-04) | Leaderboard/rarity queries exclude local-only |

## Open Questions

1. **Unique constraint for local collection items**
   - What we know: Discogs items use `discogs_instance_id` for dedup. Local items have no such identifier.
   - What's unclear: Whether to add a unique constraint on `(user_id, release_id, added_via)` or handle dedup purely in application code.
   - Recommendation: Use `(user_id, release_id)` -- a user should never have two collection items pointing to the same release regardless of source. This matches the existing duplicate check in `addRecordToCollection`.

2. **Discogs dedup queue persistence**
   - What we know: Items needing Discogs search could be tracked in-memory or in the database.
   - What's unclear: Whether a simple pg-backed queue (using `import_jobs` table) is sufficient or if a dedicated table is needed.
   - Recommendation: Use `import_jobs` with `type = 'sync'` for the batch job, and add a `dedup_pending` boolean column to `collection_items` (or use a separate lightweight table) for individual items awaiting Discogs search. The simplest approach: just flag local releases with `discogsId = NULL` as pending dedup -- a scheduled job can query all such releases.

3. **Collection item count for leaderboards after adding deletedAt**
   - What we know: Gem/rarity scoring queries count collection items. Soft-deleted items must be excluded.
   - What's unclear: Exact set of queries that need updating.
   - Recommendation: Audit all 29 files referencing `collection_items`. The `buildWhereConditions` function in `queries.ts` is the choke point for collection page queries, but gamification, discovery, radar, and comparison queries also need the filter.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (desktop: apps/desktop/vitest.config.ts, web: apps/web via workspace) |
| Config file | `apps/desktop/vitest.config.ts` |
| Quick run command | `cd apps/desktop && npx vitest run --reporter=verbose` |
| Full suite command | `cd apps/desktop && npx vitest run && cd ../../apps/web && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-01 | Tracks sync to Supabase as collection items with addedVia "local" | unit | `cd apps/web && npx vitest run src/lib/sync/process-sync-batch.test.ts -x` | Wave 0 |
| SYNC-01 | Desktop sync manager batches and sends | unit | `cd apps/desktop && npx vitest run src/main/library/sync-manager.test.ts -x` | Wave 0 |
| SYNC-02 | Dedup matches existing Discogs release by normalized artist+album | unit | `cd apps/web && npx vitest run src/lib/sync/normalize.test.ts -x` | Wave 0 |
| SYNC-02 | Dedup links to existing release instead of creating duplicate | unit | `cd apps/web && npx vitest run src/lib/sync/process-sync-batch.test.ts -x` | Wave 0 |
| SYNC-03 | Deleted paths trigger soft-delete on collection items | unit | `cd apps/web && npx vitest run src/lib/sync/process-sync-batch.test.ts -x` | Wave 0 |
| SYNC-04 | Only unsynced tracks sent (syncedAt/modifiedAt comparison) | unit | `cd apps/desktop && npx vitest run src/main/library/sync-manager.test.ts -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <specific-test-file> -x`
- **Per wave merge:** `cd apps/desktop && npx vitest run && cd ../../apps/web && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/src/lib/sync/normalize.test.ts` -- covers SYNC-02 normalization
- [ ] `apps/web/src/lib/sync/process-sync-batch.test.ts` -- covers SYNC-01, SYNC-02, SYNC-03
- [ ] `apps/desktop/src/main/library/sync-manager.test.ts` -- covers SYNC-01, SYNC-04

## Sources

### Primary (HIGH confidence)
- `apps/web/src/app/api/desktop/handoff/consume/route.ts` -- Desktop auth pattern (Bearer + admin.auth.getUser)
- `apps/web/src/lib/discogs/import-worker.ts` -- Batch upsert pattern, progress tracking, retry logic
- `apps/web/src/lib/db/schema/collections.ts` -- collectionItems schema, addedVia varchar(20), RLS policies
- `apps/web/src/lib/db/schema/releases.ts` -- releases schema, discogsId nullable unique, service-role RLS
- `apps/web/src/lib/collection/queries.ts` -- Collection query patterns, buildWhereConditions, joins
- `apps/desktop/src/main/library/db.ts` -- SQLite schema with syncedAt/syncHash columns
- `apps/desktop/src/main/supabase-auth.ts` -- getAccessToken() for Bearer auth

### Secondary (MEDIUM confidence)
- `apps/web/src/lib/db/schema/import-jobs.ts` -- import_jobs table supports type='sync'
- `apps/web/src/lib/discogs/client.ts` -- createDiscogsClient for dedup fallback
- `apps/web/src/actions/collection.ts` -- Existing patterns for admin client collection operations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, no new dependencies
- Architecture: HIGH - Composing existing patterns (auth, upsert, batch processing)
- Pitfalls: HIGH - Derived from direct code inspection of 29+ files touching collection_items
- Dedup strategy: MEDIUM - Normalization effectiveness depends on real-world metadata quality; Discogs fallback is well-understood but rate-limit interaction needs careful implementation

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable -- no external dependency changes expected)
