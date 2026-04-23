---
id: ADR-003
title: Drizzle Kit is Dev-Only — Production Migrations via Supabase CLI
date: 2026-04-21
status: accepted
deciders: [user, Claude]
supersedes: []
---

# ADR-003: Drizzle Kit is Dev-Only; Production Migrations via Supabase CLI

## Context

As of 2026-04, the repo has two migration trails:
- `drizzle/` (6 journal entries via `drizzle-kit generate`) — TypeScript-first schema authoring
- `supabase/migrations/` (28 SQL files) — hand-written RLS policies, pg_cron schedules, pg_net outbound calls, Supabase Vault operations

Drizzle cannot express RLS policies, pg_cron schedules, or Vault calls in its generated SQL. The two trails diverged (see `20260405_fix_all_rls_null_policies.sql` referencing columns not modeled in the Drizzle schema; `drizzle/0002_showcase_cards.sql` existed outside the journal). The 2026-04-06 deploy-readiness audit flagged this as SYSTEMIC #0.

## Decision

1. **`supabase/migrations/` is the sole authoritative trail for production.** All prod schema changes MUST go through `supabase db push --linked`.
2. **`drizzle/` is dev-only.** Drizzle Kit generates TypeScript types from `apps/web/src/lib/db/schema/` and produces SQL snapshots for local reference. These snapshots are NOT applied to prod.
3. **A script-level guard (`scripts/drizzle-prod-guard.mjs`) refuses `drizzle-kit push` / `drizzle-kit migrate` when `DATABASE_URL` points at prod** (detected via `DRIZZLE_PROD_REFS` env var substring match).
4. **The orphan file `drizzle/0002_showcase_cards.sql`** (never present in `drizzle/meta/_journal.json`) **is deleted** as part of this ADR's introduction.

## Consequences

- Writing new schema: add the Drizzle schema in `apps/web/src/lib/db/schema/`, run `drizzle-kit generate` for types, then hand-author the matching SQL in `supabase/migrations/YYYYMMDD_<slug>.sql` and apply via `supabase db push`.
- Developers cannot accidentally mutate prod schema via `drizzle-kit` — the guard script exits non-zero.
- CI remains unchanged; `drizzle-kit` is not run in CI.
- Future schema-drift audits compare: `apps/web/src/lib/db/schema/*.ts` ↔ the SQL that `supabase/migrations/*.sql` produces against a reset DB.

## Historical Note (added 2026-04-24, Phase 33.1)

The decision above describes the *intended* architectural state. As of 2026-04-21 (when this ADR was accepted) and 2026-04-22 (when Phase 33 audit began), the claim that `supabase/migrations/` was the "sole authoritative trail for production" was **historically false**. Several tables (notably `leads`, plus 5 others — `crew_members`, `crew_invites`, `feed_post_reactions`, `feed_post_comments`, and `discogs_tokens`) existed only on the dev Supabase project (`mrkgoucqcbqjhrdjcnpw`) via ad-hoc `drizzle-kit push` invocations and had never been reconciled into either the `drizzle/` journal or the `supabase/migrations/` SQL trail.

`supabase/migrations/` became authoritative on **2026-04-23 via commit `090bdcc`**, which landed in Phase 33 Plan 03. That commit:
1. Added `supabase/migrations/20260107_drift_capture_missing_tables.sql` capturing the 6 drift tables (drift-capture migration);
2. Resolved 7 distinct drift categories documented in `.planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md §2 Findings`:
   - Lexical migration ordering (renamed `030_purge_soft_deleted.sql` → `20260419_purge_soft_deleted.sql`; copied `drizzle/0000-0005` into `supabase/migrations/` as `20260101-20260106_drizzle_*.sql`);
   - `CREATE INDEX CONCURRENTLY` in transaction (removed `CONCURRENTLY` keyword from `20260105_drizzle_0004_gin_indexes.sql`);
   - Drift tables created (`20260107_drift_capture_missing_tables.sql`);
   - Duplicate-policy creation in `20260405` (archived the file to `.planning/phases/033-pre-deploy-audit-gate/deprecated-migrations/`);
   - Duplicate version-prefix collisions (renamed `20260401`, `20260406`, `20260409`, `20260416` duplicates to 14-digit `YYYYMMDDHHMMSS` timestamps);
   - References to `invited_by` / `created_by` columns that never existed (archival of `20260405`);
   - Out-of-order column dependency on `open_for_trade` (moved `20260415_open_for_trade_and_rating.sql` earlier to `20260405000000_*.sql`).

Future readers should treat this ADR as accurate from commit `090bdcc` forward. Audits or refactors looking at the repo state before that commit must be aware of the dev-vs-trail divergence.

## Status

Accepted 2026-04-21 as part of Phase 33 (Pre-Deploy Audit Gate).
