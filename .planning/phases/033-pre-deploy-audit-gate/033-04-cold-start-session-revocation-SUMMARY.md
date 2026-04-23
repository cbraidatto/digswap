---
phase: 033-pre-deploy-audit-gate
plan: 04
subsystem: cold-start-session-audit
tags: [dep-aud-03, dep-aud-04, cold-start, session-revocation, playwright, partial]
requires:
  - phase: 033-01
    provides: session-revocation-spec-scaffold, evidence-dir-ignored
  - phase: 033-02
    provides: prod-build-green-head
provides:
  - cold-start-local-proof
  - protected-endpoint-api-user-me
  - session-revocation-spec-wired
affects:
  - apps/web/src/app/api/user/me
  - apps/web/tests/e2e/audit/session-revocation.audit.spec.ts
  - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
tech-stack:
  added: []
  patterns:
    - "Protected-endpoint smoke via supabase.auth.getUser() → 401-on-anonymous"
    - "Playwright audit spec hardcodes endpoint (no env fallback) for reproducibility"
key-files:
  created:
    - path: apps/web/src/app/api/user/me/route.ts
      purpose: "Canonical protected API endpoint — returns user {id,email} when session valid, 401 otherwise. Anchors DEP-AUD-04 session revocation spec."
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/03-build.txt
      purpose: "pnpm build output (exit 0, 28.7s)"
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt
      purpose: "4-route curl matrix after 15m03s idle — all HTTP 200, time_total <50ms"
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/03-server-stderr.txt
      purpose: "Next.js server stderr during curl window — zero Error/TypeError/UnhandledRejection matches"
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/04-protected-endpoint.txt
      purpose: "Enumerated candidate routes + CHOSEN marker (/api/user/me)"
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/04-session-revocation.txt
      purpose: "Playwright dry-run output — spec wires correctly, fails with AUDIT_USER_EMAIL env-var-required as expected"
  modified:
    - path: apps/web/tests/e2e/audit/session-revocation.audit.spec.ts
      purpose: "Removed process.env.AUDIT_PROTECTED_ENDPOINT fallback; hardcoded http://localhost:3000/api/user/me"
    - path: .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
      purpose: "§3 populated PASS with 4-route results table; §4 populated PARTIAL with dry-run narrative + Phase 33.1 scope"
key-decisions:
  - "Co-locate DEP-AUD-03 + DEP-AUD-04 in one plan to avoid spinning up/tearing down the prod server twice (D-08 15-min idle is expensive)"
  - "Create /api/user/me as canonical protected endpoint per RESEARCH Open Question 1 — no suitable pre-existing candidate (every createClient caller had domain-specific side effects unsuitable for pure auth probing)"
  - "Hardcode endpoint in Playwright spec (drop env-var fallback) — audit spec is reproducibility anchor, not a configurable harness"
  - "Accept DEP-AUD-04 PARTIAL — full end-to-end run blocked on one-click dev user creation; escalated to Phase 33.1 rather than extending Wave 2 indefinitely"
patterns-established:
  - "Audit evidence files live under .planning/phases/<phase>/evidence/ — committed (not gitignored) so CI and reviewers can replay"
  - "Protected-endpoint canonical pattern: GET route that calls createClient() + getUser(), returns 401 on null user, never touches domain tables"
requirements-completed: [DEP-AUD-03]
requirements-partial: [DEP-AUD-04]
duration: ~1h (build+idle+curl+spec-wiring)
completed: 2026-04-23
status: PARTIAL
---

# Phase 33 Plan 04: Cold-Start + Session Revocation — PASS/PARTIAL Summary

**DEP-AUD-03 cold-start PASS on localhost (4 public routes 200 in <50ms after 15m idle); DEP-AUD-04 session revocation PARTIAL — Playwright spec wired to /api/user/me but full run deferred to 33.1 pending dev audit user creation.**

## Performance

- **Duration:** ~1h (including 15m03s mandatory idle per D-08)
- **Started:** 2026-04-23T01:40Z (idle start)
- **Completed:** 2026-04-23T01:55Z (curl end) → spec dry-run ~01:58Z
- **Tasks:** 4/4 (Task 2 was human-action 15-min idle; Task 3 split into DEP-AUD-03 automated + DEP-AUD-04 dry-run-only)
- **Files modified:** 6 (1 created code file + 1 updated spec + 4 evidence files; AUDIT-REPORT touched)

## Accomplishments

- **DEP-AUD-03 PASS:** prod-built Next.js server returns HTTP 200 on `/`, `/signin`, `/signup`, `/pricing` after 15-minute idle. `time_total` between 0.026s and 0.045s (threshold was <3.0s). Server stderr during curl window: 0 matches for `Error:|TypeError|UnhandledRejection`.
- **Protected endpoint created:** `/api/user/me` returns user `{id,email}` JSON on valid session, 401 on anonymous — canonical anchor for any future session-revocation audit.
- **Playwright spec wired:** `apps/web/tests/e2e/audit/session-revocation.audit.spec.ts` no longer has the `process.env.AUDIT_PROTECTED_ENDPOINT ?? ...` fallback — endpoint is hardcoded. Typecheck + playwright discovery both pass. Spec reaches the env-check guard and fails clearly with "AUDIT_USER_EMAIL env var required" (confirms wiring correct, just awaiting credentials).

## Task Commits

Wave 2 was committed as a single atomic unit rather than per-task (the 15-min idle + curl + spec wiring + §3/§4 rewrite are tightly coupled through the running server):

1. **Tasks 1-4: Cold-start + session-revocation wiring + AUDIT-REPORT §3/§4** — `14f6bd7` (fix)

## Files Created/Modified

- `apps/web/src/app/api/user/me/route.ts` — Protected GET endpoint; `createClient()` + `getUser()` + 401-on-null pattern
- `apps/web/tests/e2e/audit/session-revocation.audit.spec.ts` — Hardcoded endpoint constant; removed env-var fallback
- `.planning/phases/033-pre-deploy-audit-gate/evidence/03-build.txt` — `pnpm build` exit 0, 28.7s
- `.planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt` — 4-route curl matrix (all 200 in <50ms)
- `.planning/phases/033-pre-deploy-audit-gate/evidence/03-server-stderr.txt` — Zero exception markers during curl window
- `.planning/phases/033-pre-deploy-audit-gate/evidence/04-protected-endpoint.txt` — Route enumeration + `CHOSEN: /api/user/me`
- `.planning/phases/033-pre-deploy-audit-gate/evidence/04-session-revocation.txt` — Dry-run output showing spec wires correctly
- `.planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md` — §3 full PASS narrative, §4 PARTIAL narrative with scope for 33.1

## Decisions Made

- **Hardcode endpoint in spec:** env-var fallback makes the audit configurable, which undermines its role as a reproducibility anchor. If an engineer wants to point the spec elsewhere, they edit the file (and the git diff documents the change).
- **Create `/api/user/me` rather than reuse:** surveyed every existing `createClient()`-calling route; each had domain-specific side effects (read user trades, validate ownership, etc.) that conflated auth posture with business logic. A pure-auth probe is the honest artifact.
- **Accept PARTIAL rather than block Wave 2:** creating the dev audit user is a one-click dashboard operation that happens out-of-band from this plan; extending the plan to wait for it would have blocked Waves 3/4. Escalated cleanly per D-10 + D-16.

## Deviations from Plan

**None structural.** Task 1 added `/api/user/me` (planned as optional step if no candidate existed); Task 3 Step 2-3 (full Playwright run against seeded user) was deferred as DEP-AUD-04 PARTIAL per the plan's own D-10/D-16 guidance. This is the plan working as designed.

## Issues Encountered

- **No suitable pre-existing protected endpoint for revocation probe.** Every `createClient()` caller inspected (e.g., trade routes, collection routes) had side effects unsuitable for a pure 401 check. Created `/api/user/me` instead (per RESEARCH Open Question 1 canonical recommendation) — 2 min of work, solved cleanly.
- **Dev audit user not pre-seeded on dev Supabase.** Playwright spec's env-var guard caught this on dry-run. Creating the user (`audit+33@digswap.test`) + exporting `AUDIT_USER_EMAIL` / `AUDIT_USER_PASSWORD` is a 15-min one-click operator task — scoped to Phase 33.1.

## Next Phase Readiness

- **Cold-start local proof is banked.** Real Vercel cold-start validation is Phase 38's DEP-UAT-03 (per D-09 — local proof does not substitute for prod cloud proof).
- **Session-revocation spec is a permanent regression guard.** Once the audit user exists, `pnpm --filter @digswap/web exec playwright test audit/` runs the spec for every future change.
- **Server was killed at end of Wave 2** (`lsof -ti:3000 | xargs -r kill`) — Plan 06 (CSP) rebuilds and restarts explicitly (Step 0 of its Task 1).

## Handoff notes

- **For Phase 33.1 DEP-AUD-04 closure (15-30 min):**
  1. Create `audit+33@digswap.test` on dev Supabase (`mrkgoucqcbqjhrdjcnpw`) → Auth → Users → Add user → Auto-Confirm
  2. `export AUDIT_USER_EMAIL="audit+33@digswap.test" AUDIT_USER_PASSWORD=<chosen-value>`
  3. `pnpm --filter @digswap/web build && pnpm --filter @digswap/web start &`
  4. `pnpm --filter @digswap/web exec playwright test audit/session-revocation.audit.spec.ts --reporter=list 2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/04-session-revocation.txt`
  5. Expect: `pre-logout status: 200` + `post-logout status: 401 after <N>ms` where `N < 60000`
- **Nothing in Waves 3/4 depends on the session-revocation spec running** — they all target different endpoints (Vault queries, CSP headers, gitleaks, env inventory).
