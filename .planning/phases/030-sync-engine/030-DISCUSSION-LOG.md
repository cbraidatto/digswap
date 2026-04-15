# Phase 30: Sync Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-14
**Phase:** 030-sync-engine
**Areas discussed:** Dedup strategy, Sync transport, Deletion behavior, Release creation

---

## Dedup Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Exact normalized match only | lowercase + strip articles + trim. Simple, no false positives, but misses typos and variations | |
| Two-stage: exact + Discogs fallback | Exact match first for high-confidence tags, Discogs API search for unresolved. Best accuracy, moderate complexity | ✓ |
| Exact match only (no API) | Conservative exact match, unmatched items create local-only releases, defer Discogs enrichment to Phase 32 | |

**User's choice:** Two-stage: exact + Discogs fallback
**Notes:** Confidence flags from Phase 29 (artistConfidence/albumConfidence) gate the strategy: high-confidence uses exact normalized match, low-confidence goes to Discogs API fallback queue.

---

## Sync Transport

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated API route (Recommended) | POST /api/desktop/library/sync with Bearer token. Mirrors existing handoff pattern, batch 50-100 tracks/request | ✓ |
| Direct Supabase SDK | Desktop upserts directly via existing auth client. Minimal code but no server-side validation | |
| You decide | Claude picks best approach | |

**User's choice:** Dedicated API route (Recommended)
**Notes:** Mirrors existing handoff consume pattern. Server-side validation enables future post-sync hooks (badge awards, wantlist matching).

---

## Deletion Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Soft-delete with 7-day grace (Recommended) | Mark deletedAt, hide from UI, auto-purge after 7 days. Covers accidental deletes and folder reorganization | ✓ |
| Hard-delete immediate | Remove collection item instantly. Simplest but destroys user-edited notes/ratings/condition | |
| You decide | Claude picks pragmatic option | |

**User's choice:** Soft-delete with 7-day grace (Recommended)
**Notes:** Preserves user-curated metadata (notes, conditionGrade, personalRating) during grace period. If file reappears within 7 days, deletedAt is cleared back to NULL.

---

## Release Creation

| Option | Description | Selected |
|--------|-------------|----------|
| Shared release per album (Recommended) | One release record per unique artist+title, shared across users. Enables future Discogs enrichment. Leaderboard queries filter with WHERE discogs_id IS NOT NULL | ✓ |
| Release per user+album | Each user gets own release record. No collision but no cross-user discovery, table grows faster | |
| You decide | Claude picks best fit | |

**User's choice:** Shared release per album (Recommended)
**Notes:** Multiple tracks from same album share one release. Cover art uses "unknown sleeve" placeholder. Future enrichment via UPDATE SET discogs_id when match found.

## Claude's Discretion

- Exact normalization function implementation
- Discogs search queue implementation details
- Batch size tuning (50-100 range)
- pg_cron purge schedule
- "Unknown sleeve" placeholder design
- Error handling for partial batch failures
- Desktop sync progress UI detail level

## Deferred Ideas

- Cover art fetching for local releases (Phase 32 or backlog)
- Discogs enrichment beyond dedup (Phase 32)
- Cross-user discovery for local releases
- Sync conflict resolution UI
- Multiple library roots
