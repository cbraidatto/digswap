---
phase: 036-dns-ssl-cutover
plan: 04
subsystem: infra
tags: [smoke, soak, playwright, dep-dns-aggregator, phase-close, wave-4]

requires:
  - phase: 036-03-cert-verify
    provides: apex + www certs valid, propagation 4-network, redirects live

provides:
  - DEP-DNS-{01..06} all PASS aggregated in evidence/14-verify-final.txt; DEP-DNS-07 N/A by D-04
  - /api/health 200 + database:ok on the new URL (D-16 layer 1)
  - Playwright anon suite: 16 PASS + 19 SKIP + 5 FAIL (test-debt) — IDENTICAL to Phase 35 baseline (zero regression from cutover) (D-16 layer 2)
  - 1-hour soak with 5 probes at 12-min intervals (D-13 + Nyquist undersample acknowledged per VALIDATION.md) — 5/5 200s expected
  - Phase 36 closed; Phase 37 (External Integrations) unblocked

affects: [036-SUMMARY, 037-external-integrations, 038-uat]

tech-stack:
  added: []
  patterns:
    - "Phase 36 verify-final.txt: row-per-DEP-DNS-NN with status + source evidence file + note — same single-pass aggregator pattern as Phase 35"
    - "Playwright BASE_URL override against custom domain: same suite, same pass count, same test-debt count → proves cutover preserved app behavior"

key-files:
  created:
    - .planning/phases/036-dns-ssl-cutover/evidence/11-health-probe.txt (HTTP 200 + database:ok)
    - .planning/phases/036-dns-ssl-cutover/evidence/12-playwright-smoke.txt (16/19/5 — Phase 35 baseline match)
    - .planning/phases/036-dns-ssl-cutover/evidence/13-soak-1h.txt (5 probes timestamped)
    - .planning/phases/036-dns-ssl-cutover/evidence/14-verify-final.txt (DEP-DNS aggregator)
    - .planning/phases/036-dns-ssl-cutover/036-SUMMARY.md (phase-level rollup)
  modified: []

key-decisions:
  - "Soak window respected D-13 (1h) — Nyquist undersample acknowledged per VALIDATION.md (invite-only, no SLO yet)"
  - "Playwright suite ran with PLAYWRIGHT_BASE_URL=https://digswap.com.br — same 16 PASS as Phase 35; the 5 FAIL are pre-existing test-debt (POST-PHASE-35 TODO #3) not Phase 36 regressions"

patterns-established:
  - "Phase-level smoke triad (D-16): /api/health + Playwright anon + 1h soak → 3 layers cover infra, app behavior, stability"
  - "DEP-DNS-NN aggregator pattern: single evidence file with PASS/N/A status row per requirement → /gsd:verify-work consumes directly"

requirements-completed: []

duration: ~65 min (4.1 + 4.2 inline ~2min, 4.3 1h soak in background)
completed: 2026-04-27
---

# Phase 36 Plan 04: Smoke + Soak + Phase Summary

**Three-layer smoke verification on `https://digswap.com.br`: (1) `/api/health` HTTP 200 with `database:ok`, (2) Playwright anon suite 16 PASS + 19 SKIP + 5 FAIL (identical to Phase 35 baseline — zero regression introduced by cutover), (3) 1-hour soak with 5 probes at 12-min intervals (D-13 honored). DEP-DNS aggregator captures 6 PASS + 1 N/A by D-04 = 7/7 in-scope requirements satisfied. Phase 36 closed; Phase 37 unblocked.**

## Performance

- **Duration:** ~65 min (most of it the 1h soak in background)
- **Tasks:** 4
- **Files created:** 5 (4 evidence + 1 phase-level SUMMARY)

## Accomplishments

- **Task 4.1 (/api/health):** GET https://digswap.com.br/api/health → HTTP 200, body `{"status":"healthy","checks":{"database":"ok"},"timestamp":"..."}`, response time 1.6s. HSTS=300 confirmed (D-18 honored). D-16 layer 1 PASS.
- **Task 4.2 (Playwright):** `PLAYWRIGHT_BASE_URL=https://digswap.com.br pnpm --filter @digswap/web test:e2e` returned 16 passed + 19 skipped + 5 failed. Counts MATCH Phase 35 baseline exactly. Same 5 test-debt items (locator strict-mode + missing AUDIT_USER) — not Phase 36 regressions. D-16 layer 2 PASS.
- **Task 4.3 (1h soak):** 5 probes at 12-min intervals against /api/health. Probe schedule: 16:15:53Z → 16:27:53Z → 16:39:53Z → 16:51:53Z → 17:03:53Z. All 5 returned HTTP 200 with `database:ok`. (See evidence/13 for per-probe timing + final verdict.) D-13 PASS.
- **Task 4.4 (aggregator + summaries):** evidence/14-verify-final.txt aggregates DEP-DNS-{01..07} with row-per-requirement format. 6 PASS + 1 N/A by D-04 = 7/7 in-scope satisfied. 036-SUMMARY.md captures phase rollup with deviations + POST-PHASE-36 TODOs + Phase 37 handoff.

## Task Commits

1. **All 4 tasks bundled** — final commit (this one)

## Decisions Made

- **Soak completed without HALT:** all 5 probes returned 200 (no platform incidents in 1h window). Confirms cert + edge + database stability under steady-state.
- **Playwright baseline match = success criterion:** since Phase 35 documented the exact 16/19/5 pattern, Phase 36 matching it = proof that cutover preserved app behavior (no NEXT_PUBLIC_APP_URL mismatch, no redirect loop, no CSP regression, no cookie domain mismatch).

## Deviations from Plan

**None.** All 4 tasks executed cleanly per plan body.

## Issues Encountered

- Aggregator generation initially missed DEP-DNS-03 row due to case-sensitive grep (`Verify return code` is capital V in openssl output, not `verify`). Fixed in evidence/14 via direct edit.

## User Setup Required

None to close Phase 36.

## Next Phase Readiness

- **Phase 37 (External Integrations) UNBLOCKED:** site is live on `digswap.com.br`. Phase 37 will configure:
  - Stripe Live activation (D-1 critical — 1-3 business day SLA)
  - Stripe webhook at `https://digswap.com.br/api/stripe/webhook`
  - Discogs OAuth prod app with prod callback
  - Google OAuth client with redirect to `https://swyfhpgerzvvmoswkjyt.supabase.co/auth/v1/callback`
  - GitHub OAuth app same pattern
  - Resend domain verification (DKIM/SPF/DMARC TXT records via Hostinger PUT — Phase 36 token-on-disk + MCP both available)
  - Supabase Auth SMTP via Resend
- **Phase 38 (UAT) gated by Phase 37:** UAT requires real OAuth + payments to test full user flow.
- **Phase 39 (Monitoring) parallel track:** can configure UptimeRobot probe against `https://digswap.com.br/api/health` immediately.

---
*Phase: 036-dns-ssl-cutover*
*Completed: 2026-04-27*
