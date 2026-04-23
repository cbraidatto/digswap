---
phase: 033-pre-deploy-audit-gate
plan: 05
subsystem: vault-discogs-tokens-audit
tags: [dep-aud-05, pitfall-11, vault, discogs-oauth, fail, phase-33-1-blocker]
requires:
  - phase: 033-01
    provides: evidence-dir-ignored
provides:
  - vault-posture-characterized
  - pitfall-11-confirmed-live
  - phase-33-1-gate-scope-defined
affects:
  - apps/web/src/lib/discogs/oauth.ts
  - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
tech-stack:
  added: []
  patterns:
    - "SQL posture probe via node postgres client (psql not on PATH — Windows workaround)"
key-files:
  created:
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/05a-plaintext-count.txt
      purpose: "COUNT(*) FROM public.discogs_tokens → 2 (expected 0) — FAIL marker"
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/05b-vault-count.txt
      purpose: "COUNT(*) FROM vault.decrypted_secrets WHERE name LIKE 'discogs_token:%' → 0"
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/05c-plaintext-sample.txt
      purpose: "Sample plaintext rows — GITIGNORED (token prefixes stay local)"
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/05d-vault-sample.txt
      purpose: "Sample Vault rows (empty) — GITIGNORED"
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/05-combined.txt
      purpose: "Combined stdout of both count probes (audit session transcript)"
  modified:
    - path: .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
      purpose: "§5 populated FAIL narrative with plaintext_count=2, vault_count=0, root-cause hypotheses, Phase 33.1 scope"
key-decisions:
  - "Use node + postgres client inline (not psql) — Windows dev machine lacks psql on PATH; installing it for a one-off probe is worse than a 10-line inline script"
  - "Query dev Supabase (mrkgoucqcbqjhrdjcnpw) per D-06 scope — prod Vault verification lives in Phase 34 DEP-SB-06"
  - "Escalate FAIL to Phase 33.1 rather than attempt inline fix — Vault installation + RPC grants + row migration + fallback hardening is a 4-8h scope beyond D-16"
  - "Keep sample files (05c/05d) gitignored per D-11 — even with token prefix truncation (LEFT(token,8)), prefixes are identifying fragments of real OAuth tokens"
patterns-established:
  - "SQL audit probes target DEV project, never prod — Phase 33 scope per D-06"
  - "Sample files gitignored via evidence/.gitignore (scaffolded in Plan 01)"
requirements-completed: []
requirements-failed: [DEP-AUD-05]
duration: ~30min
completed: 2026-04-23
status: FAIL
---

# Phase 33 Plan 05: Discogs Vault Audit — FAIL Summary

**DEP-AUD-05 FAIL: `public.discogs_tokens` contains 2 plaintext rows; `vault.decrypted_secrets` has 0 discogs_token:* entries. Pitfall #11 is LIVE on dev Supabase. Phase 34 is BLOCKED on this axis until fixed in Phase 33.1.**

## Performance

- **Duration:** ~30 min (node postgres client setup + 4 queries + AUDIT-REPORT §5 rewrite)
- **Started:** 2026-04-23T01:55Z (after Plan 04 torn down the server)
- **Completed:** 2026-04-23T02:00Z
- **Tasks:** 3/3 — Task 1 (human-verify DEV target) resolved; Task 2 (SQL probes) ran FAIL; Task 3 (§5 populate FAIL narrative) done inline
- **Files modified:** 6 (4 evidence + 1 combined stdout + AUDIT-REPORT)

## Accomplishments

- **Storage posture characterized on dev:** `plaintext_count = 2`, `vault_count = 0`. Not the expected `plaintext_count = 0` but unambiguous evidence of where the Discogs OAuth code path lands in practice.
- **Real user data identified** (not test seeds): user_id `5c2f62d1...` created 2026-03-25, user_id `04520b1a...` created 2026-04-07. Token prefixes match Discogs OAuth 1.0a access-token shape.
- **Root-cause hypotheses enumerated** for 33.1 investigation: (a) Vault extension not installed, (b) service-role JWT lacks `vault.*` schema grant, (c) `vault_create_secret` RPC API drift.
- **Fix scope scoped:** 4 concrete actions (install Vault, grant schema access, migrate/re-auth 2 rows, harden `oauth.ts` fallback). Estimated 4–8h for Phase 33.1.

## Task Commits

1. **Tasks 1-3: SQL probe + AUDIT-REPORT §5 FAIL narrative** — `9d89dc2` (audit)

Single commit because the probe + the narrative are one atomic audit finding (nothing to split).

## Files Created/Modified

- `.planning/phases/033-pre-deploy-audit-gate/evidence/05a-plaintext-count.txt` — `plaintext_count = 2` (parseable)
- `.planning/phases/033-pre-deploy-audit-gate/evidence/05b-vault-count.txt` — `vault_count = 0`
- `.planning/phases/033-pre-deploy-audit-gate/evidence/05c-plaintext-sample.txt` — Sample rows (3 rows, LEFT(access_token,8) + user_id + created_at); GITIGNORED
- `.planning/phases/033-pre-deploy-audit-gate/evidence/05d-vault-sample.txt` — Empty result; GITIGNORED
- `.planning/phases/033-pre-deploy-audit-gate/evidence/05-combined.txt` — Combined session transcript
- `.planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md` — §5 FAIL narrative with counts, findings, root-cause hypotheses, required fix scope

## Decisions Made

- **Node + postgres client instead of psql:** On Windows Git Bash, psql is rarely on PATH; installing PostgreSQL client tools for a one-off probe is worse than a 10-line inline Node script reading DATABASE_URL from `apps/web/.env.local`. Same queries, different runner.
- **Scope to DEV only (not prod):** Per D-06, Phase 33 does not touch prod — prod Vault verification is DEP-SB-06 in Phase 34. The question for this audit is "what is the current code path's behavior?", which is fully answered on dev.
- **Escalate to 33.1 rather than fix inline:** The fix requires (a) Vault extension installation (DBA task on Supabase dashboard), (b) service-role grants (`GRANT USAGE ON SCHEMA vault`, `GRANT EXECUTE ON FUNCTION vault.create_secret`), (c) data migration for 2 live user tokens (either one-off re-encrypt or force re-auth with user comms), (d) removing the silent `try/catch` fallback in `apps/web/src/lib/discogs/oauth.ts:84-130`. Total scope 4–8h — exceeds D-16's inline-fix threshold, and mixes ops + code + data + user-comms concerns that deserve their own plan.

## Deviations from Plan

**[Rule 4 — Architectural] Deferred fix to Phase 33.1 instead of fixing inline.**
- **Found during:** Task 2 (SQL probe) — plaintext_count=2 immediately reveals the fallback path has been used
- **Issue:** Plan 05 offered an inline fix path (Step 5 under "If plaintext_count > 0") estimating 1-2h. On inspection, that estimate only covers the migration step — not the Vault-installation prerequisite or the code hardening step. Real scope is 4-8h.
- **Fix:** Populated §5 with FAIL verdict + detailed 33.1 fix scope instead of attempting the inline path.
- **Verification:** AUDIT-REPORT.md §5 + top-of-file verdict (AMBER) both reflect the FAIL cleanly; nothing pretends it's PASS.
- **Committed in:** `9d89dc2`

**Total deviations:** 1 architectural (user-validated via the AMBER-is-acceptable decision in Plan 06). **Impact:** HIGH positive — Phase 33 is the exact point in the process where "claimed fixed" should be independently tested. This audit catches that `oauth.ts` Vault-first-with-plaintext-fallback has been masking a dev-wide failure for ~1 month.

## Issues Encountered

None during execution. The queries returned fast, the node client worked, no connection issues. The failure is in the code path being audited, not the audit itself.

## Next Phase Readiness

**Phase 34 BLOCKED on this axis.** Cannot promote the same codebase to prod with Vault misconfigured — prod Discogs users would hit the same silent-fallback path and prod would accumulate plaintext OAuth tokens.

**Phase 33.1 DEP-AUD-05 closure checklist (4-8h):**
1. `CREATE EXTENSION IF NOT EXISTS supabase_vault;` on dev + prod
2. Grant service-role `USAGE` on `vault` schema + `EXECUTE` on `vault.create_secret`
3. Migration: for each row in `public.discogs_tokens`, call `vault_create_secret(access_token, 'discogs_token:' || user_id)` then `DELETE` the plaintext — OR force re-auth (invalidate the 2 rows, notify the 2 users)
4. Harden `apps/web/src/lib/discogs/oauth.ts:84-130` — remove the silent fallback; if Vault fails, `throw` (abort the OAuth exchange with 500) instead of writing plaintext
5. Re-run both count queries on dev AND prod — both must show `plaintext_count=0` AND `vault_count >= <real-user-count>` before 33.1 closes

## Handoff notes

- **Dev Supabase credentials live in `apps/web/.env.local`** (DATABASE_URL with password). Not committed. Do not expose in any evidence file.
- **Sample files (05c/05d) contain real token prefixes.** They are gitignored (per Plan 01 `evidence/.gitignore`) — `git check-ignore` confirms. Do NOT `git add -f` them.
- **The 2 real plaintext tokens are OAuth 1.0a access tokens**, not service-role keys. They grant read access to the respective users' Discogs collections. Revoking them just forces re-auth — low-harm compared to the service-role case.
