---
phase: 08-gamification-rankings
plan: 02
subsystem: gamification
tags: [badges, rankings, pg_cron, server-actions, import]
dependency_graph:
  requires: [08-01]
  provides: [badge-triggers-wired, ranking-recalculation-scheduled]
  affects: [collection-actions, community-actions, import-worker]
tech_stack:
  added: []
  patterns: [non-blocking-try-catch, security-definer-function, pg-cron-schedule, gin-index]
key_files:
  created:
    - supabase/migrations/20260327_ranking_function.sql
  modified:
    - apps/web/src/actions/collection.ts
    - apps/web/src/actions/community.ts
    - apps/web/src/app/api/discogs/import/route.ts
decisions:
  - "social.ts intentionally NOT modified — follows captured by pg_cron batch computation (D-12), not event-driven triggers"
  - "Trade points excluded from contribution CTE — trades table incomplete until Phase 9"
  - "Badge checks in import route run once after completion broadcast, not per-record (performance)"
metrics:
  duration: ~12min
  completed: 2026-03-31
  tasks_completed: 2
  files_modified: 4
---

# Phase 8 Plan 02: Wire Badge Triggers + pg_cron Ranking Function Summary

Badge award triggers wired into all three server-side operation sites (addRecordToCollection, createReviewAction, joinGroupAction, import completion) plus a SECURITY DEFINER PostgreSQL function scheduled via pg_cron every 15 minutes to batch-recalculate all user rankings using the D-01/D-02/D-03/D-04 formula.

## What Was Built

### Task 1: Badge Triggers in Server Actions

**apps/web/src/actions/collection.ts**
- Added `import { awardBadge } from "@/lib/gamification/badge-awards"`
- Added non-blocking try/catch block after `checkWantlistMatches` in `addRecordToCollection`
- Badge checks: `first_dig` (when collection count reaches 1), `century_club` (when count >= 100), `rare_find` (when added release has `rarity_score >= 2.0`)
- Uses already-in-scope `admin` client and `releaseId` variable — no new client instantiation

**apps/web/src/actions/community.ts**
- Added `import { awardBadge } from "@/lib/gamification/badge-awards"`
- In `joinGroupAction`: non-blocking `crew_member` badge check after `logActivity` call, before `return { success: true }`
- In `createReviewAction`: non-blocking `critic` badge check after `logActivity` call for `wrote_review`
- `awardBadge` is idempotent by design (08-01), so no pre-check count is needed

**apps/web/src/app/api/discogs/import/route.ts**
- Added `import { awardBadge } from "@/lib/gamification/badge-awards"`
- Inserted badge check block after `broadcastProgress("completed")`, before the existing batch wantlist match section
- Guards with `if (job.type === "collection" || job.type === "sync")` to avoid triggering on wantlist jobs
- Checks: `first_dig` (count >= 1), `century_club` (count >= 100), `rare_find` (inner join on releases.rarity_score >= 2.0, limit 1)
- All wrapped in try/catch with `console.error` for observability — non-blocking

**social.ts: intentionally NOT modified** per architecture decision D-12 — follow contribution scores are computed exclusively by the pg_cron batch function which reads the `follows` table directly at recalculation time.

### Task 2: pg_cron Ranking SQL Migration

**supabase/migrations/20260327_ranking_function.sql**

Complete PostgreSQL migration containing:

1. `CREATE EXTENSION IF NOT EXISTS pg_cron` — idempotent extension enable
2. `GRANT USAGE ON SCHEMA cron TO postgres`
3. `CREATE OR REPLACE FUNCTION recalculate_rankings()` with `SECURITY DEFINER` — bypasses RLS to read all users' data
4. Three CTEs inside the function:
   - `rarity`: `SUM(ln(1 + COALESCE(r.rarity_score, 0)))` per user from `collection_items JOIN releases`
   - `contribution`: per-user score = reviews*10 + group_posts*3 + following_count*1 + follower_count*2 (D-03 weights)
   - `scores`: `FULL OUTER JOIN` to combine both, computes `global_score = rarity*0.7 + contribution*0.3` (D-01)
5. `ranked` CTE assigns `ROW_NUMBER() OVER (ORDER BY global_score DESC)` and `CASE` title assignment (D-04):
   - > 500: Record Archaeologist
   - > 200: Wax Prophet
   - > 50: Crate Digger
   - else: Vinyl Rookie
6. `INSERT INTO user_rankings ... ON CONFLICT (user_id) DO UPDATE SET` — upsert pattern
7. `CREATE INDEX IF NOT EXISTS idx_releases_genre_gin ON releases USING gin(genre)` — for genre leaderboard `@>` queries
8. `SELECT cron.schedule('recalculate-rankings', '*/15 * * * *', 'SELECT recalculate_rankings()')` — 15-minute schedule (D-12)

## Deviations from Plan

None — plan executed exactly as written. social.ts exclusion was documented in the plan and intentionally maintained.

## Known Stubs

None. Badge triggers are fully wired. The SQL migration is complete and ready for `supabase db push`. Trade points (trade_completed = +15 per D-03) are intentionally excluded from the contribution CTE because the trades completed-state table is not available until Phase 9 — this is documented in the plan and is not a stub but a planned incremental addition.

## Self-Check: PASSED

- `apps/web/src/actions/collection.ts` — exists, contains `awardBadge` import and all three badge checks
- `apps/web/src/actions/community.ts` — exists, contains `awardBadge` import, `critic` and `crew_member` checks
- `apps/web/src/app/api/discogs/import/route.ts` — exists, contains `awardBadge` import and post-import badge block
- `supabase/migrations/20260327_ranking_function.sql` — exists, all SQL content checks passed
- Commit `d847667` — verified via `git rev-parse --short HEAD`
- TypeScript compilation: zero errors (`npx tsc --noEmit` clean exit)
