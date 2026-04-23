# Phase 33 Audit Report

**Executed:** (fill during Wave 4)
**main HEAD at audit start:** 8762c232c65c5a66589d7902fe4fb3584e4a0bba (pre-Phase-33 tip plus 033-01 scaffolding)
**Verdict:** PENDING — execution in progress

## Checklist

- [~] DEP-AUD-01: CI gates — typecheck/test/build/audit PASS, lint DEBT (20 residual errors, deferred to 33.1)  — evidence/01*-*.txt
- [ ] DEP-AUD-02: `supabase db reset` clean on local Docker + throwaway cloud      — evidence/02a-*.txt, evidence/02b-*.txt
- [ ] DEP-AUD-03: Cold-start curl — all 4 public routes 200 in <3s after idle      — evidence/03-*.txt
- [ ] DEP-AUD-04: Session revocation — logged-out JWT returns 401 within 60s       — evidence/04-*.txt
- [ ] DEP-AUD-05: Discogs tokens Vault-wrapped — zero plaintext rows               — evidence/05a-*.txt, evidence/05b-*.txt
- [ ] DEP-AUD-06: CSP re-confirmed — nonce-based header, zero violations on 5 routes — evidence/06*-*
- [ ] DEP-AUD-07: gitleaks scan — zero findings across full git history            — evidence/07-gitleaks.json
- [ ] DEP-AUD-08: Env inventory — all 21 vars have actionable prod-value source, zero `| TBD |` rows — §8 table below

## §1 DEP-AUD-01 CI Gates + Prod Audit

**Status:** PARTIAL (4/5 sub-gates PASS; lint deferred to 33.1)
**main HEAD:** 8762c232c65c5a66589d7902fe4fb3584e4a0bba
**Timestamp:** 2026-04-22T23:55:00Z (typecheck), ~00:15Z 2026-04-23 (lint/test/build/audit)

**Commands:**
```
pnpm --filter @digswap/web typecheck    # exit 0 (after fix — see Notes) — evidence/01a-typecheck.txt
pnpm --filter @digswap/web lint         # exit 1 (20 residual errors)    — evidence/01b-lint.txt
pnpm --filter @digswap/web test         # exit 0 (1568 pass, 4 skip)     — evidence/01c-test.txt
pnpm --filter @digswap/web build        # exit 0 (after env fix — Notes) — evidence/01d-build.txt
pnpm audit --prod --audit-level high    # exit 0 (8 moderate, 0 high)    — evidence/01e-audit.txt
```

**Tail excerpts:**
```
typecheck:
> tsc --noEmit

typecheck exit=0

lint:
Found 20 errors. Found 105 warnings. Found 2 infos.
lint exit=1

test:
Test Files  149 passed | 1 skipped (150)
Tests  1568 passed | 4 skipped | 7 todo (1579)
Duration  55.62s
test exit=0

build:
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
build exit=0

audit:
8 vulnerabilities found
Severity: 8 moderate
audit exit=0
```

### Findings (independent verification caught what CI claimed was green)

1. **Typecheck FAIL on main HEAD (BEFORE fix):** 40+ TypeScript errors in test files added 2026-04-14 (commit 524c872 "+880 tests"). Core issues: `tests/e2e/fixtures/auth.ts` had a broken `{ authedPage: typeof base }` type (cascaded to 24 errors across 8 e2e specs); `LeadStatus` never included `"interested"` used in 5 places; spread-to-`vi.fn` type errors, sort union narrowing, drizzle mock casting. Fixed in commit `e506d35` (7 files, 6 fixes) — typecheck now exits 0.

2. **Lint FAIL on main HEAD (135 errors, 123 warnings):** `biome check --write` autofixed 98 files + `--write --unsafe` on 3 targeted files. **20 residual errors** remained across source components (not autofixable):
   - 8 × noUnusedFunctionParameters
   - 6 × noExplicitAny (profile-hero, profile-sidebar)
   - 2 × noNonNullAssertion (wrapped.ts, trades components)
   - 1 × useParseIntRadix
   - 1 × useExhaustiveDependencies
   - 1 × noImgElement
   - 1 × useAriaPropsSupportedByRole
   
   **Plus** autofix reshuffles exposed additional errors after initial pass (formatter revealed noUnusedVariables, noSvgWithoutTitle, more noNonNullAssertion, etc.). Total lint debt exceeds D-16's 2h threshold — **deferred to decimal phase 33.1** per user decision.

3. **Build FAIL (BEFORE env fix):** `next build` requires `.env.local` populated with `HANDOFF_HMAC_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_APP_URL` (Zod env schema). User's `.env.local` was missing `NEXT_PUBLIC_APP_URL`. **Added to env file locally** (not committed); also flagged as DEP-AUD-08 input.

4. **Audit PASS:** 8 moderate vulnerabilities reported, zero high/critical. Passes `--audit-level high` threshold.

**Verdict:** PARTIAL — typecheck/test/build/audit PASS after inline fixes; lint has 20 residual errors deferred to Phase 33.1. This audit did what DEP-AUD-01 was designed to do — caught that commit `35ed595` "fix: resolve all pre-deploy blockers" left typecheck + lint broken.

## §2 DEP-AUD-02 Supabase Migration Reset

**Status:** pending
**Local reset command:** (populated in Plan 03)
**Cloud reset command:** (populated in Plan 03)
**Teardown proof:** evidence/02b-teardown.png
**Verdict:** —

## §3 DEP-AUD-03 Cold-Start Public Routes (LOCAL ONLY per D-08)

**Status:** pending
**Command:** (populated in Plan 04)
**Routes tested:** /, /signin, /signup, /pricing
**Results:** —
**Verdict:** —

## §4 DEP-AUD-04 Session Revocation E2E

**Status:** pending
**Command:** (populated in Plan 04)
**Pre-logout status:** —
**Post-logout status:** —
**Elapsed ms:** —
**Verdict:** —

## §5 DEP-AUD-05 Discogs Tokens via Supabase Vault

**Status:** pending
**Project queried:** dev Supabase (not prod — see D-06 scope)
**plaintext_count:** —
**vault_count:** —
**Verdict:** —

## §6 DEP-AUD-06 CSP Re-Confirmation

**Status:** pending
**Header sample:** (populated in Plan 06)
**Routes with zero violations:** —
**Verdict:** —

## §7 DEP-AUD-07 Git History Secret Scan

**Status:** pending
**Command:** (populated in Plan 07)
**Findings count:** —
**Verdict:** —

## §8 DEP-AUD-08 Environment Variable Inventory

**Status:** pending
**Source:** apps/web/.env.local.example (21 required + 4 optional variables)

| # | Variable | Domain | Scope | Source of prod value | Secret? | Assigned (Y/N) |
|---|----------|--------|-------|----------------------|---------|----------------|
| — | (populated in Plan 08 from RESEARCH.md §Audit 8 table) | — | — | TBD | — | N |

**Verdict:** —

---

## Sign-Off

All 8 checks must show a verdict of PASS (or explicit documented acceptance) and `grep -c '| TBD |' AUDIT-REPORT.md` must return 0 before Phase 34 can begin.

**Signed-off:** (Wave 4)
