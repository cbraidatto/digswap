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

## Status

Accepted 2026-04-21 as part of Phase 33 (Pre-Deploy Audit Gate).
