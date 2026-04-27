---
phase: 035-vercel-environment-wiring
plan: 04
subsystem: infra
tags: [vercel, env-vars, preview-scope, pitfall-9]

requires:
  - phase: 035-02-vercel-project-create
    provides: digswap-web project + .vercel/repo.json

provides:
  - 21 env vars in Vercel Preview scope (DEP-VCL-03)
  - Preview deploys point at Supabase dev (mrkgoucqcbqjhrdjcnpw) — Pitfall #9 protection
  - Stripe Preview = sk_test_DEFERRED_PHASE_37_* (Stripe test-mode prefix, distinct from Production sk_live_DEFERRED_PHASE_37_*)

affects: [035-05-deploy-verify, 035-06-playwright-summary, future-PR-previews]

tech-stack:
  added: []
  patterns:
    - "Vercel env add for Preview scope requires 3rd positional arg (branch name OR empty string for all branches)"
    - "set -a + . apps/web/.env.local + set +a pattern: auto-export every var from dotenv file as transient shell vars"

key-files:
  created:
    - .planning/phases/035-vercel-environment-wiring/evidence/02b-env-add-preview.log (per-var add log)
    - .planning/phases/035-vercel-environment-wiring/evidence/03b-env-pull-preview-audit.txt (sanitized audit + Pitfall #9 by construction)
  modified: []

key-decisions:
  - "Preview HMAC + IMPORT_WORKER reuse dev values (Pitfall #29 only applies to PROD freshness; dev value in dev scope is correct)"
  - "Stripe Preview = sk_test_* prefix (vs sk_live_DEFERRED_PHASE_37 in Production) — distinct so future test-mode integration doesn't accidentally reuse the live placeholder"

patterns-established:
  - "Vercel CLI 52.x Preview-scope add syntax: `vercel env add KEY preview \"\"` — empty 3rd arg = all preview branches; without it, CLI prompts for branch (consumes piped value)"

requirements-completed: [DEP-VCL-03]

duration: ~5min (1 retry needed for branch arg fix)
completed: 2026-04-26
---

# Phase 35 Plan 04: Preview Scope Env Vars

**21/21 Preview-scope env vars populated in Vercel — values sourced from dev `.env.local` for Supabase/HMAC/IMPORT_WORKER (Pitfall #9 protection: PR previews touch ONLY dev Supabase `mrkgoucqcbqjhrdjcnpw`, never prod). Stripe + Discogs deferred markers, optional/post-MVP placeholders. DEP-VCL-03 PASS.**

## Performance

- **Duration:** ~5 min (1 syntax retry for Preview branch arg)
- **Tasks:** 2 (1 add loop + 1 audit)
- **Files modified:** 2 evidence files

## Accomplishments

- 21 env vars added to Preview scope (1 SKIP because pre-test added NEXT_PUBLIC_APP_URL, 20 OK, 0 FAIL)
- Sourced dev values from `apps/web/.env.local` via `set -a; . apps/web/.env.local; set +a` pattern (transient shell vars, never committed)
- Pitfall #9 protection verified by construction (dev values flow in, prod ref `swyfhpgerzvvmoswkjyt` never sourced)
- DEP-VCL-03 PASS

## Task Commits

1. **Task 1 (add loop, retried with branch arg fix)** — included in `5c61059`
2. **Task 2 (audit)** — included in `5c61059`

**Combined commit:** `5c61059`

## Files Created/Modified

- `.planning/phases/035-vercel-environment-wiring/evidence/02b-env-add-preview.log` — 21 entries with KEY+SCOPE+sensitive flag
- `.planning/phases/035-vercel-environment-wiring/evidence/03b-env-pull-preview-audit.txt` — sanitized audit + Pitfall #9 cryptographic argument

## Decisions Made

- **Preview HMAC reuses dev value:** Pitfall #29 (regenerate HMAC for production) does not apply to Preview scope because Preview deploys are dev-tier (PR-only, never user-facing). Symmetric dev-value-in-dev-scope is the correct configuration.
- **Stripe sk_test_DEFERRED_PHASE_37 prefix in Preview:** vs sk_live_DEFERRED_PHASE_37 in Production. Distinct prefixes so future Stripe test-mode integration (Phase 38 UAT smoke) can find/replace correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule: Vercel CLI 52.x Preview branch arg required] First add_if_missing call to `vercel env add KEY preview` failed because CLI prompted for branch name (consuming piped value)**
- **Found during:** Task 1 first attempt (all 21 FAIL)
- **Issue:** Vercel CLI 52.x `vercel env add KEY preview` requires 3rd positional arg for branch (or empty string for all preview branches). Without it, CLI emits interactive prompt that consumes stdin. Production scope (Plan 03) didn't have this issue because Production has no branch concept.
- **Fix:** Added `""` 3rd positional arg: `vercel env add KEY preview ""` — interpreted as "all preview branches". Re-ran add loop; 20 OK + 1 SKIP + 0 FAIL.
- **Files modified:** `/tmp/env-add-preview-v2.sh` (working version), `evidence/02b-env-add-preview.log` (regenerated)
- **Verification:** `vercel env ls preview` shows 21 vars
- **Committed in:** `5c61059`

---

**Total deviations:** 1 (CLI syntax discovery, no semantic impact)
**Impact on plan:** None — DEP-VCL-03 fully satisfied.

## Issues Encountered

- Vercel CLI's interactive prompt behavior with stdin pipe input was the root cause; pattern documented for future Preview-scope adds in any phase.

## User Setup Required

None.

## Next Phase Readiness

- **Plan 05 (first deploy) unblocked:** all 42 env vars across both scopes in place (21 prod + 21 preview)
- **Future PR previews:** when a PR is created against `main`, Vercel auto-deploys with Preview scope env vars (dev Supabase) — proven by construction here, will be UAT-verified in Phase 38

---
*Phase: 035-vercel-environment-wiring*
*Completed: 2026-04-26*
