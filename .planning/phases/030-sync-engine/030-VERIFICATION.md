---
phase: 030-sync-engine
verified: 2026-04-15T02:44:20Z
status: human_needed
score: 3/4 success criteria verified automatically
re_verification: false
human_verification:
  - test: "End-to-end: local items appear on web profile after desktop sync"
    expected: "Scanned audio files synced from desktop appear as collection items on the web profile; each item has addedVia='local' and no visual exclusion prevents them from showing"
    why_human: "Requires both apps running simultaneously; cannot verify network round-trip or actual DB row creation without a live environment"
  - test: "Deduplication: local album matching Discogs release links to same release"
    expected: "If the user has a Discogs-imported release for 'Abbey Road' by Beatles and syncs a local scan of the same album, the profile shows ONE entry, not two"
    why_human: "Requires live Discogs-imported data and local scan in the same user account; cannot simulate without running environment"
  - test: "Deletion propagation: deleted file disappears from web collection"
    expected: "Delete an audio file, run scan+sync; the corresponding web collection item is gone from the profile"
    why_human: "Requires real filesystem mutation and live sync; fs.existsSync path logic can only be confirmed end-to-end"
  - test: "Incremental sync: second sync sends only changed items"
    expected: "On second sync with no changes, 0 tracks are sent (verified via desktop console log or network devtools showing empty tracks array)"
    why_human: "syncedAt tracking only verifiable by running two consecutive syncs and observing network payloads"
  - test: "REQUIREMENTS.md checkbox update: mark SYNC-01 and SYNC-04 complete after verification"
    expected: "After human confirms, SYNC-01 and SYNC-04 checkboxes in REQUIREMENTS.md should be ticked"
    why_human: "Human checkpoint gate from Plan 03 Task 2 is still pending"
---

# Phase 030: Sync Engine Verification Report

**Phase Goal:** Local library items appear in the web app as part of the user's collection, deduplicated against Discogs imports
**Verified:** 2026-04-15T02:44:20Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Scanned local items appear on web profile as collection items with source "local" | ? HUMAN NEEDED | `process-sync-batch.ts:143` sets `addedVia: "local"`; collection queries include the field; no filter excludes local items; but end-to-end not testable programmatically |
| 2 | A local release matching an existing Discogs-imported release links to the same release instead of creating a duplicate | ✓ VERIFIED | `process-sync-batch.ts:91-123`: queries existing releases, prefers `discogsId IS NOT NULL` match, increments `linked` counter; unit test "links to existing Discogs release when normalized match found" passes |
| 3 | When a file is deleted and sync runs, the corresponding web collection item is removed | ✓ VERIFIED | `sync-manager.ts:108-116`: `fs.existsSync` checks all indexed paths, collects deleted paths, calls `getReleaseMappingsForPaths` to get web-side UUIDs, sends as `deletedReleaseIds`; `process-sync-batch.ts:163-183`: updates `deletedAt = now()` for those IDs; unit test "sends deletedReleaseIds (not hardcoded empty) when deleted files detected" passes |
| 4 | Sync sends only changed items (incremental) | ✓ VERIFIED | `db.ts:182-187`: `getUnsyncedTracks` queries `WHERE syncedAt IS NULL OR syncedAt < modifiedAt`; `markTracksSynced` updates `syncedAt` after each successful batch; unit test "marks tracks as synced after each successful batch" passes |

**Automated score:** 3/4 verified (truth 1 needs human confirmation)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/lib/sync/normalize.ts` | normalizeForDedup and makeAlbumKey | ✓ VERIFIED | 25 lines, both functions implemented, 12 unit tests pass |
| `apps/web/src/lib/sync/process-sync-batch.ts` | processSyncBatch with dedup, upsert, soft-delete | ✓ VERIFIED | 192 lines, full implementation, 6 unit tests pass |
| `apps/web/src/app/api/desktop/library/sync/route.ts` | POST handler with Bearer auth, zod validation | ✓ VERIFIED | 79 lines, Bearer auth, zod schema (max 100 tracks, max 200 deletedReleaseIds), delegates to processSyncBatch |
| `apps/web/src/lib/db/schema/collections.ts` | deletedAt column | ✓ VERIFIED | Line 34: `deletedAt: timestamp("deleted_at", { withTimezone: true })` + partial index at line 67 |
| `supabase/migrations/030_purge_soft_deleted.sql` | pg_cron schedule | ✓ VERIFIED | Contains `cron.schedule('purge-soft-deleted-collection-items', '0 3 * * *', ...)` |
| `apps/desktop/src/main/library/sync-manager.ts` | startSync with batch loop, deletion detection | ✓ VERIFIED | 229 lines, full implementation with fs.existsSync deletion detection, release mapping storage |
| `apps/desktop/src/main/library/db.ts` | getUnsyncedTracks, markTracksSynced, setReleaseMappings, getReleaseMappingsForPaths | ✓ VERIFIED | All 4 functions exported, release_mappings table in initSchema |
| `apps/desktop/src/main/library/library-ipc.ts` | desktop:start-sync handler | ✓ VERIFIED | Line 60: `ipcMain.handle("desktop:start-sync", ...)` registered, threads auth and siteUrl |
| `apps/desktop/src/shared/ipc-types.ts` | SyncResult, SyncProgress, startSync in bridge | ✓ VERIFIED | Lines 249-277: both interfaces exported, `startSync(): Promise<SyncResult>` and `onSyncProgress` on DesktopBridgeLibrary |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `route.ts` | `process-sync-batch.ts` | `import processSyncBatch` | ✓ WIRED | Line 5 of route.ts |
| `process-sync-batch.ts` | `normalize.ts` | `import makeAlbumKey` | ✓ WIRED | Line 7 of process-sync-batch.ts |
| `process-sync-batch.ts` | `admin.ts` | `createAdminClient` | ✓ WIRED | Line 6 of route.ts (admin used for auth); db (Drizzle) used directly for data ops |
| `sync-manager.ts` | `db.ts` | `getUnsyncedTracks\|markTracksSynced\|setReleaseMappings\|getReleaseMappingsForPaths` | ✓ WIRED | Lines 4-11 of sync-manager.ts |
| `sync-manager.ts` | `supabase-auth.ts` | `getAccessToken` | ✓ WIRED | `getAccessToken` passed as callback to `startSync`, called at line 103 |
| `library-ipc.ts` | `sync-manager.ts` | `desktop:start-sync` handler | ✓ WIRED | Line 60 of library-ipc.ts |
| `collection/queries.ts` | `collections.ts` schema | `isNull(collectionItems.deletedAt)` | ✓ WIRED | Line 48: second condition in buildWhereConditions choke point |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `process-sync-batch.ts` | `existingReleases` | `db.select().from(releases).where(...)` | Yes — real DB query | ✓ FLOWING |
| `process-sync-batch.ts` | `collectionItems` upsert | `db.insert(collectionItems).values({addedVia:"local",...})` | Yes — real DB write | ✓ FLOWING |
| `process-sync-batch.ts` | soft-delete update | `db.update(collectionItems).set({deletedAt: sql\`now()\`})` | Yes — real DB update | ✓ FLOWING |
| `collection/queries.ts` | collection items | Drizzle join query with `isNull(collectionItems.deletedAt)` | Yes — real query, local items not excluded | ✓ FLOWING |
| `sync-manager.ts` | `deletedReleaseIds` | `getReleaseMappingsForPaths(db, deletedPaths)` from SQLite | Yes — real SQLite lookup | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All normalize unit tests pass | `cd apps/web && npx vitest run src/lib/sync/normalize.test.ts` | 12/12 pass | ✓ PASS |
| All batch processor unit tests pass | `cd apps/web && npx vitest run src/lib/sync/process-sync-batch.test.ts` | 6/6 pass | ✓ PASS |
| All desktop sync manager tests pass | `cd apps/desktop && npx vitest run src/main/library/sync-manager.test.ts` | 10/10 pass | ✓ PASS |
| Full web test suite (no regressions) | `cd apps/web && npx vitest run` | SUMMARY claims 1568 pass | ? SKIP (not re-run here, trusts 030-03 SUMMARY) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SYNC-01 | 030-01, 030-02 | App syncs local library metadata to Supabase as collection items with addedVia "local", visible in web app | ? HUMAN NEEDED | Code present and correct; REQUIREMENTS.md still shows `[ ]` pending human checkpoint approval |
| SYNC-02 | 030-01, 030-03 | Local release matching existing Discogs release links to existing release (no duplicate) | ✓ SATISFIED | Dedup logic in process-sync-batch.ts; unit test passes; REQUIREMENTS.md shows `[x]` |
| SYNC-03 | 030-01, 030-02, 030-03 | Deleted file removes corresponding web collection item | ✓ SATISFIED | Full deletion pipeline: fs.existsSync -> release_mappings lookup -> deletedReleaseIds -> soft-delete -> isNull filter hides item; REQUIREMENTS.md shows `[x]` |
| SYNC-04 | 030-02 | Sync is incremental — only changed items synced | ? HUMAN NEEDED | syncedAt logic implemented and unit-tested; REQUIREMENTS.md shows `[ ]` pending human checkpoint |

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| None found | — | — | All sync functions are fully implemented with real logic |

**Additional check:** No `TODO`, `FIXME`, `placeholder`, `return null`, or hardcoded empty returns found in any of the 9 phase artifacts.

### Human Verification Required

#### 1. End-to-End Sync Flow

**Test:** Start the web dev server (`cd apps/web && pnpm dev`) and desktop app (`cd apps/desktop && pnpm dev`). Select a library folder in the desktop app, run a full scan, then trigger a sync via `window.desktopBridge.startSync()` from devtools.

**Expected:** Web profile at `/perfil` shows the scanned items in the collection grid. Items have source "local" in the database (verifiable via Supabase dashboard or `added_via = 'local'` in collection_items).

**Why human:** Requires both processes running, real filesystem, and actual Supabase connection.

#### 2. Deduplication Against Discogs Imports

**Test:** Ensure a Discogs-imported release exists in the user's collection (e.g., "Abbey Road" by The Beatles). Scan a local folder containing an audio file tagged with the same artist and album. Trigger a sync.

**Expected:** The profile shows ONE collection entry for that release, not two. The sync response should show `linked: 1` in the console.

**Why human:** Requires a real user account with Discogs-imported data and matching local files.

#### 3. Deletion Propagation

**Test:** After an initial sync, delete one audio file from the library folder. Re-run the scan (`startIncrementalScan()`), then re-run sync (`startSync()`). Refresh the web profile.

**Expected:** The collection item for the deleted file is no longer visible on the profile page.

**Why human:** Requires filesystem mutation and two sync cycles.

#### 4. Incremental Sync Verification

**Test:** After a successful initial sync, immediately run sync again without changing any files. Observe the network request payload in browser devtools or desktop console.

**Expected:** The `tracks` array in the POST body is empty (or only contains tracks modified after the last sync). The server should respond with `synced: 0`.

**Why human:** syncedAt behavior only observable through network inspection during a live session.

#### 5. REQUIREMENTS.md Update

**Test:** After human confirms the above, update REQUIREMENTS.md to mark SYNC-01 and SYNC-04 as complete (`[x]`).

**Expected:** All four SYNC requirements shown as complete.

**Why human:** Gated by human approval of the Plan 03 Task 2 checkpoint.

### Gaps Summary

No code gaps found. All 9 artifacts exist, are substantive, and are wired. 18 web unit tests and 10 desktop unit tests pass. The soft-delete filter (`isNull(collectionItems.deletedAt)`) is present in all 19+ identified query sites across discovery, comparison, gems, exports, stats, radar, wantlist, and trades.

The only outstanding item is the Plan 03 Task 2 human verification checkpoint, which was explicitly designed as a blocking gate requiring user approval before SYNC-01 and SYNC-04 requirements can be marked complete. The implementation is correct — the checkpoint exists to confirm end-to-end behavior in a live environment.

---

_Verified: 2026-04-15T02:44:20Z_
_Verifier: Claude (gsd-verifier)_
