---
phase: 033-pre-deploy-audit-gate
plan: 03
subsystem: migration-reset-audit
tags: [dep-aud-02, migration-drift, systemic-0, escalated-to-33.1]
requires: [033-01]
provides:
  - migration-consolidation-partial
  - layer-3-drift-documented
affects:
  - supabase/migrations/
  - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
tech-stack: {}
key-files:
  created:
    - path: supabase/migrations/20260101_drizzle_0000_initial.sql
      purpose: Drizzle 0000 as the first supabase migration (base schema)
    - path: supabase/migrations/20260102_drizzle_0001_groups_slug.sql
      purpose: Drizzle 0001 (group_invites + groups.slug)
    - path: supabase/migrations/20260103_drizzle_0002_profile_showcase.sql
      purpose: Drizzle 0002 (profile cover + showcase slots)
    - path: supabase/migrations/20260104_drizzle_0003_trade_tos.sql
      purpose: Drizzle 0003 (trade ToS + trade_requests extensions)
    - path: supabase/migrations/20260105_drizzle_0004_gin_indexes.sql
      purpose: Drizzle 0004 (GIN indexes + genre_leaderboard_mv); CONCURRENTLY stripped
    - path: supabase/migrations/20260106_drizzle_0005_stripe_event_log.sql
      purpose: Drizzle 0005 (stripe_event_log)
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/02a-start.txt
      purpose: Capture of 3 supabase start attempts showing progressive errors
  modified:
    - path: .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
      purpose: §2 populated with FAIL verdict + 3-layer findings narrative
  renamed:
    - from: supabase/migrations/030_purge_soft_deleted.sql
      to: supabase/migrations/20260419_purge_soft_deleted.sql
      reason: Original lexicographic position caused it to run BEFORE base schema
key-decisions:
  - decision: Plan 03 closes as FAIL; DEP-AUD-02 deferred to Phase 33.1
    rationale: Layer 3 schema drift (leads table missing from SQL trail entirely) confirmed ADR-003 is aspirational, not factual; whack-a-mole each missing table exceeds D-16 2h threshold
  - decision: Migration consolidation attempt committed anyway (partial progress)
    rationale: Layers 1 and 2 are real fixes that will apply in 33.1; reverting would waste debug work
  - decision: ADR-003 flagged as misleading; 33.1 must revise
    rationale: Claims supabase/migrations authoritative but leads + likely others created via drizzle-kit push without regeneration
requirements-completed: []
requirements-failed: [DEP-AUD-02]
duration: ~1h (active debug)
completed: 2026-04-23
status: FAIL-escalated
---

# Phase 33 Plan 03: DEP-AUD-02 Migration Reset — FAIL Summary

Attempted `supabase db reset` on local Docker to prove the 28-file trail replays from empty. It does not. Three layers of migration drift emerged:

1. **Filename ordering bug** (fixed)
2. **Drizzle base schema never merged into supabase/migrations** (consolidation attempted; fixed for Layers 1–2)
3. **Schema drift beyond drizzle — `leads` table defined in TypeScript schema but materialized only on dev Supabase via direct `drizzle-kit push`, never regenerated into SQL trail** (ESCALATED to 33.1)

The BLOCKING gate D-07 (throwaway Supabase Cloud reset) was never attempted — local failed first, and running cloud would have just repeated the same failures against a paid-slot project.

**Start:** 2026-04-23T00:30Z (approx)
**End:** 2026-04-23T01:15Z (paused for 33.1)
**Duration:** ~1h active debug + 30min findings documentation
**Tasks attempted:** 1 (Task 1 local reset) — subsequent tasks (cloud provisioning, teardown, AUDIT-REPORT) never started because Task 1's blocking precondition was unmet.

## Commits

| Hash | Message |
|------|---------|
| `3b6f4a6` | fix(033-03): partial migration trail consolidation — escalate to 33.1 |

## Deviations from Plan

**[Rule 4 - Architectural] DEP-AUD-02 cannot close inline — migration trail reconstruction exceeds 2h** — Found during: Task 1 Step 2 (`supabase start`) | Issue: layered drift; each fix revealed a deeper issue; Layer 3 (drizzle-kit push bypassing regeneration) makes schema divergence open-ended | Fix: partial consolidation committed (Layers 1–2); full reconstruction deferred to Phase 33.1 per user decision | Files modified: supabase/migrations/20260101–20260106 (new), 20260419_purge_soft_deleted.sql (renamed), AUDIT-REPORT.md §2 (FAIL verdict with findings) | Verification: next `supabase start` will still FAIL on `20260328_leads_rls.sql` until 33.1 lands | Commit hash: `3b6f4a6`

## Issues Encountered (all deferred to 33.1)

- **`leads` table missing from SQL trail entirely** — defined in `apps/web/src/lib/db/schema/leads.ts` but never in drizzle/*.sql or supabase/migrations/*.sql. Confirms LeadStatus test bug from Plan 02 was a surface symptom.
- **Likely additional missing tables/columns** — each `db reset` attempt after a fix reveals the next. Estimated 5-15 unknown gaps without systematic reconciliation.
- **ADR-003 is aspirational, not factual** — `supabase/migrations/` is not authoritative; dev Supabase has been modified via direct drizzle-kit push.

## Next Phase Readiness

**Phase 33 remains OPEN — BLOCKED on DEP-AUD-02.** Phase 34 cannot begin per D-07/D-17.

**Proposed Phase 33.1 scope (user to confirm):**
1. `drizzle-kit generate` against current schema to capture `leads` + any other missing schema
2. Merge newly-generated migrations into supabase/migrations with proper ordering
3. Systematic walk of supabase/migrations/*.sql looking for table references not in SQL trail
4. Fix lint debt from Plan 02 (20 residual errors)
5. Revise ADR-003 to reflect actual trail policy
6. Re-run Plan 03 (local + cloud reset) until green
7. Resume Plans 04–08

## Handoff notes

- Plan 01 and Plan 02 SUMMARYs are valid and committed (Plan 01 full PASS, Plan 02 PARTIAL with lint → 33.1)
- Evidence files `00-docker.txt`, `00-head.txt`, `01a–01e-*.txt` are complete; `02a-start.txt` captures this plan's 3 attempts
- All 7 new supabase migrations (20260101–20260106 + renamed 20260419) are committed and useful — they are the foundation 33.1 will build on
- User's `.env.local` NEXT_PUBLIC_APP_URL gap is unrelated to this plan but also needs 33.1 or separate chore
