---
phase: 033-pre-deploy-audit-gate
plan: 03
subsystem: migration-reset-audit
tags: [dep-aud-02, migration-drift, systemic-0-closed, d-07-pass]
requires: [033-01]
provides:
  - migration-trail-consolidated
  - drift-tables-captured
  - local-db-reset-pass
  - cloud-db-reset-pass
  - d-07-gate-pass
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
    - path: supabase/migrations/20260107_drift_capture_missing_tables.sql
      purpose: 7 drift tables (crates, crate_items, sets, set_tracks, leads, handoff_tokens, discogs_tokens) + RLS policies
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/02a-start.txt
      purpose: Progressive `supabase start` attempts showing iterative fix cycle
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/02a-reset.txt
      purpose: Successful local `supabase db reset` (exit 0, 'Finished supabase db reset on branch main.')
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/02b-create.txt
      purpose: Throwaway cloud project creation (ref dfgcarnjahflocnsdhxs)
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/02b-link.txt
      purpose: Link + paranoia ● marker confirmation on throwaway
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/02b-push.txt
      purpose: db push --linked result (40 migrations applied)
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/02b-reset.txt
      purpose: db reset --linked result — D-07 BLOCKING gate PASS
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/02b-delete.txt
      purpose: Project delete + post-delete list confirmation
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/02b-teardown.txt
      purpose: Human-verify checkpoint signal (user visual confirmation via chat screenshot)
    - path: .planning/phases/033-pre-deploy-audit-gate/deprecated-migrations/20260405_fix_all_rls_null_policies.sql.bak
      purpose: Archived — referenced non-existent columns (invited_by, invitee_id, groups.created_by); superseded by drizzle pgPolicy + 20260107 policies
  modified:
    - path: .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
      purpose: §2 populated with PASS verdict for both 2a + 2b; 7-category resolution narrative
  renamed:
    - from: supabase/migrations/030_purge_soft_deleted.sql
      to: supabase/migrations/20260419_purge_soft_deleted.sql
      reason: lexicographic prefix caused it to run BEFORE base schema
    - from: supabase/migrations/20260401_trade_messages.sql
      to: supabase/migrations/20260401000000_trade_messages.sql
      reason: duplicate-date prefix collision with 20260401_trade_presence_rpc.sql
    - from: supabase/migrations/20260401_trade_presence_rpc.sql
      to: supabase/migrations/20260401000001_trade_presence_rpc.sql
      reason: duplicate-date prefix collision (Supabase CLI requires pure-digit prefix)
    - from: supabase/migrations/20260406_gem_ranking_function.sql
      to: supabase/migrations/20260406000000_gem_ranking_function.sql
      reason: duplicate-date collision with 20260406_missing_tables_and_columns.sql
    - from: supabase/migrations/20260406_missing_tables_and_columns.sql
      to: supabase/migrations/20260406000001_missing_tables_and_columns.sql
      reason: duplicate-date collision
    - from: supabase/migrations/20260409_deploy_readiness_fixes.sql
      to: supabase/migrations/20260409000000_deploy_readiness_fixes.sql
      reason: triple 20260409_* collision
    - from: supabase/migrations/20260409_perf_and_security.sql
      to: supabase/migrations/20260409000001_perf_and_security.sql
      reason: triple 20260409_* collision
    - from: supabase/migrations/20260409_visibility_and_trade_proposals.sql
      to: supabase/migrations/20260409000002_visibility_and_trade_proposals.sql
      reason: triple 20260409_* collision
    - from: supabase/migrations/20260415_open_for_trade_and_rating.sql
      to: supabase/migrations/20260405000000_open_for_trade_and_rating.sql
      reason: the UPDATE in 20260409000002 references open_for_trade column which 20260415 adds — historical ordering bug
    - from: supabase/migrations/20260416_dm_mutual_follow_rls.sql
      to: supabase/migrations/20260416000000_dm_mutual_follow_rls.sql
      reason: duplicate-date collision with 20260416_trade_reviews_rls_upgrade.sql
    - from: supabase/migrations/20260416_trade_reviews_rls_upgrade.sql
      to: supabase/migrations/20260416000001_trade_reviews_rls_upgrade.sql
      reason: duplicate-date collision
key-decisions:
  - decision: Keep drizzle/*.sql AND supabase/migrations/*.sql in sync via copy-forward
    rationale: Drizzle 0000–0005 copied into supabase/migrations/ with pre-date prefixes; drizzle/* is now a TypeScript type source + sanity-check tool, supabase/migrations/ is authoritative per ADR-003 (now actually true)
  - decision: discogs_tokens schema inferred from application code (apps/web/src/lib/discogs/oauth.ts)
    rationale: Ghost table — never in drizzle/* or supabase/migrations/*; schema derived from `.upsert({user_id, access_token, access_token_secret, updated_at})`
  - decision: 20260405_fix_all_rls_null_policies.sql archived (not just DROP-IF-EXISTS patched)
    rationale: Root cause was column-reference drift (invited_by, groups.created_by), not just duplicate policy names; patching each CREATE POLICY to drop first just pushed the problem downstream. Cleaner to archive the out-of-sync fix and let drizzle pgPolicy + 20260107 policies cover the intended security posture.
  - decision: leads status "interested" → "watching" in tests (landed in Plan 02 e506d35)
    rationale: LeadStatus enum never had "interested"; test used wrong literal
  - decision: Teardown PNG skipped (user pasted screenshot inline in chat, not to file)
    rationale: automatic CLI `DELETE CONFIRMED` check + user visual confirm via chat is sufficient evidence; evidence/02b-teardown.txt captures the inline signal
requirements-completed: [DEP-AUD-02]
requirements-failed: []
duration: ~3h
completed: 2026-04-23
status: PASS
---

# Phase 33 Plan 03: DEP-AUD-02 Migration Reset — PASS Summary

Independent verification of the 28-migration `supabase/migrations/` trail against an empty database revealed SYSTEMIC #0 drift in three distinct layers. All three closed inline; both local Docker and throwaway Supabase Cloud (D-07 BLOCKING gate) now reset cleanly.

**Start:** 2026-04-23T00:30Z
**End:** 2026-04-23T00:25Z (next-day in UTC; wall-clock ~3h including iterative debug + user login checkpoint)
**Duration:** ~3h active
**Tasks:** 5/5 complete
  - Task 1 (local reset) — PASS after Layer-1/2/3 fixes
  - Task 2 (login + org-id capture) — human checkpoint resolved
  - Task 3 (cloud provision → link → push → reset → delete) — PASS, including D-07 gate
  - Task 4 (dashboard visual teardown) — human-verify checkpoint resolved (user screenshot)
  - Task 5 (AUDIT-REPORT §2 populated) — done inline

## Commits

| Hash | Message |
|------|---------|
| `3b6f4a6` | fix(033-03): partial migration trail consolidation — escalate to 33.1 |
| `fe91f5e` | docs(033-03): Plan 03 SUMMARY — FAIL escalated to 33.1 (superseded by this SUMMARY) |
| `090bdcc` | fix(033-03): migration trail end-to-end clean — DEP-AUD-02 Audit 2a PASS |
| `9210405` | docs(033-03): AUDIT-REPORT §2 — Audit 2a (local) PASS; detailed 7-category resolution narrative |

## Gate Results

| Gate | Command | Result |
|------|---------|--------|
| Audit 2a (local Docker) | `pnpm dlx supabase start` + `db reset` | **PASS** — `Finished supabase db reset on branch main.` (exit 0) |
| Audit 2b Step 1 (cloud provision) | `projects create --org-id ... --region us-east-1` | PASS (ref `dfgcarnjahflocnsdhxs`) |
| Audit 2b Step 2 (link + paranoia) | `link --project-ref ... --password ...` + `●` marker check | PASS (marker on throwaway, NOT on `vinyldig`) |
| Audit 2b Step 3 (cloud push) | `db push --linked --yes` | **PASS** — `Finished supabase db push.` (40 migrations applied) |
| Audit 2b Step 4 (D-07 BLOCKING) | `db reset --linked --yes` | **PASS** — `Finished supabase db reset` (exit 0) |
| Audit 2b Step 5 (teardown) | `projects delete` + verify | PASS — `Deleted project: digswap-audit-20260422-2215` + post-delete list shows only `vinyldig` |
| Task 4 (dashboard visual) | User screenshot via chat | CONFIRMED — only `vinyldig` visible in dashboard |

## Authentication Gates

1. Docker Desktop startup (Plan 01 human-action, reused here)
2. `supabase login` OAuth browser flow (Task 2 human-action) — completed by user in PowerShell terminal; verification code `c8f52cd7`
3. SUPABASE_ORG_ID capture (Task 2) — `waevgaqloxyszeutagko` captured via `supabase orgs list --output json`

## Deviations from Plan

**[Rule 4 — Architectural] Migration trail reconstruction exceeded initial 2h D-16 threshold but landed in-plan after user direction** — Found during: Task 1 Step 2 | Issue: 7 distinct drift categories surfaced (see AUDIT-REPORT §2 Findings table). Original call was to defer to 33.1; user chose "do drizzle-kit generate" (option B manual diff because drizzle-kit needs TTY), which became the mechanism to capture the full drift set. | Fix: 7 iterations of `supabase start` + targeted fix until green; archived 20260405_fix_all_rls_null_policies.sql; landed 20260107_drift_capture_missing_tables.sql + 10 renames + 1 earlier-moved migration. Total: ~110 files changed, 2 commits inline (090bdcc + this SUMMARY). | Verification: both local (02a-reset.txt) and cloud (02b-reset.txt) reset with exit 0, zero ERROR/FATAL. | Commit hashes: 3b6f4a6, 090bdcc.

**[Rule 3 — Blocking] `supabase projects create --size nano` rejected — CLI vocabulary changed** — Issue: plan specified `--size nano` but current Supabase CLI rejects that enum; micro/small/medium/large/etc. Also free-tier orgs reject `--size` entirely ("Instance size cannot be specified for free plan organizations"). | Fix: removed `--size` flag. | Commit hash: 090bdcc.

**[Rule 3 — Blocking] `yes Y |` pattern for prompted Supabase commands unreliable on Windows Git Bash** — Fix: used `--yes` global flag instead (supported by modern supabase CLI). | Commit hash: 090bdcc.

**Total deviations:** 3 (1 architectural with user sign-off, 2 blocking auto-fixed). **Impact:** HIGH positive — this plan is now the single biggest audit finding of Phase 33. Commit `35ed595` "fix: resolve all pre-deploy blockers" was substantially false on the migration axis; Phase 34 was blocked silently until this plan ran.

## Issues Encountered

None at close — all 7 drift categories resolved; both local and cloud reset green; teardown confirmed.

**Carry-over for Phase 33.1:**
- ADR-003 text still says supabase/migrations is authoritative "as of 2026-04" — the *claim* is now *true* (thanks to 20260107 + the renames) but the ADR should add a note about WHEN it became true and the mechanics (drift-capture migration, policy archival).
- Lint debt (20 residual errors from Plan 02) still outstanding.

## Next Phase Readiness

**DEP-AUD-02 CLOSED.** Phase 34 (Supabase prod setup) is unblocked on the migration axis — the same sequence (`projects create` → `link` → `db push --linked`) will work for prod exactly as it worked for the throwaway audit project.

**Plans 04–08 can now proceed** in order. The `.env.local` in the worktree already has everything needed for the Plan 04 prod build path.

## Handoff notes

- Cloud project `dfgcarnjahflocnsdhxs` deleted — no lingering billing exposure
- Local Supabase stack still RUNNING (left up for Plans 05/06 to query via SQL if needed; can `supabase stop` if low on resources)
- Dev Supabase `vinyldig` (ref `mrkgoucqcbqjhrdjcnpw`) is UNLINKED in this worktree — if you need to reconnect, `pnpm dlx supabase link --project-ref mrkgoucqcbqjhrdjcnpw --password <dev-pwd>`
