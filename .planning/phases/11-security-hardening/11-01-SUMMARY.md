---
phase: 11-security-hardening
plan: 01
subsystem: security
tags: [csp, nonce, zod, validation, open-redirect, vitest, security-testing]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Auth callback, middleware, next.config.ts security headers, Zod pattern"
provides:
  - "7 security test stub files (65 todos) for Plans 02 and 03"
  - "4 Zod validation schemas (common, community, trade, profile)"
  - "Nonce-based CSP via middleware (replaces static unsafe-inline/unsafe-eval)"
  - "Open redirect prevention in auth callback"
affects: [11-02-PLAN, 11-03-PLAN]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Nonce-based CSP generated per-request in middleware via generateCspHeader()"
    - "validateRedirectPath() pattern for safe redirect validation"
    - "Zod validation schemas with typed exports in src/lib/validations/"

key-files:
  created:
    - tests/security/rate-limiting.test.ts
    - tests/security/input-validation.test.ts
    - tests/security/idor.test.ts
    - tests/security/csp.test.ts
    - tests/security/open-redirect.test.ts
    - tests/security/auth-bypass.test.ts
    - tests/security/rls-coverage.test.ts
    - src/lib/validations/common.ts
    - src/lib/validations/community.ts
    - src/lib/validations/trade.ts
    - src/lib/validations/profile.ts
    - src/lib/security/csp.ts
  modified:
    - src/app/api/auth/callback/route.ts
    - src/middleware.ts
    - next.config.ts
    - src/app/layout.tsx
    - src/components/auth/totp-setup.tsx

key-decisions:
  - "Nonce-based CSP replaces static unsafe-inline/unsafe-eval in next.config.ts"
  - "totp-setup.tsx nonce wiring deferred (Client Component, dangerouslySetInnerHTML on div not script/style)"

patterns-established:
  - "Security test stubs use it.todo() for vitest discovery without failures"
  - "CSP nonce flows: middleware generates -> x-nonce header -> layout.tsx reads via headers()"
  - "Redirect validation: validateRedirectPath rejects absolute, protocol-relative, and protocol-containing URLs"

requirements-completed: [SEC-02, SEC-03]

# Metrics
duration: 4min
completed: 2026-03-28
---

# Phase 11 Plan 01: Security Test Stubs + Validation Schemas + CSP + Open Redirect Summary

**65 security test stubs across 7 categories, 4 Zod validation schemas, nonce-based CSP replacing unsafe-inline, and open redirect fix in auth callback**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-28T20:13:21Z
- **Completed:** 2026-03-28T20:17:26Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Created 7 security test stub files with 65 todo tests covering rate limiting, input validation, IDOR, CSP, open redirect, auth bypass, and RLS coverage
- Created 4 Zod validation schema files (common, community, trade, profile) with typed exports following the existing auth.ts pattern
- Fixed open redirect vulnerability in /api/auth/callback by adding validateRedirectPath that rejects absolute URLs, protocol-relative URLs, and URLs containing ://
- Replaced static CSP (unsafe-inline/unsafe-eval) in next.config.ts with per-request nonce-based CSP generated in middleware
- Wired nonce into layout.tsx theme-flash prevention script element

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Wave 0 test stubs + Zod validation schemas** - `e395584` (feat)
2. **Task 2: Fix open redirect + implement nonce-based CSP** - `7e25a3e` (fix)

## Files Created/Modified
- `tests/security/rate-limiting.test.ts` - 13 todo stubs for server action rate limiting
- `tests/security/input-validation.test.ts` - 6 todo stubs for Zod input validation
- `tests/security/idor.test.ts` - 7 todo stubs for IDOR prevention
- `tests/security/csp.test.ts` - 7 todo stubs for CSP header validation
- `tests/security/open-redirect.test.ts` - 5 todo stubs for redirect validation
- `tests/security/auth-bypass.test.ts` - 13 todo stubs for auth bypass prevention
- `tests/security/rls-coverage.test.ts` - 14 todo stubs for RLS policy coverage
- `src/lib/validations/common.ts` - UUID, pagination, URL schemas and sanitizeWildcards helper
- `src/lib/validations/community.ts` - Post, review, and group creation schemas
- `src/lib/validations/trade.ts` - Trade request and review schemas
- `src/lib/validations/profile.ts` - Profile update and showcase search schemas
- `src/lib/security/csp.ts` - Nonce-based CSP header generator (generateCspHeader)
- `src/app/api/auth/callback/route.ts` - Added validateRedirectPath for open redirect prevention
- `src/middleware.ts` - Per-request nonce generation and CSP header injection
- `next.config.ts` - Removed static CSP entry (now dynamic via middleware)
- `src/app/layout.tsx` - Wired nonce attribute to theme-flash script, made component async
- `src/components/auth/totp-setup.tsx` - Added TODO comment for client-side nonce wiring

## Decisions Made
- **Nonce-based CSP via middleware:** Replaced the static CSP in next.config.ts with per-request nonce generation in middleware. This eliminates unsafe-inline and unsafe-eval (production) while allowing HMR in development via conditional unsafe-eval.
- **totp-setup.tsx nonce deferred:** The TOTP setup component is a Client Component using dangerouslySetInnerHTML on a div (not script/style), so CSP script-src nonce does not apply. Added TODO comment for future consideration. Low priority.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Known Stubs
- `src/components/auth/totp-setup.tsx` line 148 - TODO for client-side nonce wiring on dangerouslySetInnerHTML div (intentional deferral, does not affect CSP script-src enforcement)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Security test infrastructure ready for Plan 02 (implement rate limiting tests, input validation tests)
- Validation schemas ready for Plan 02 to wire into server actions
- CSP nonce pattern established for Plan 03 to verify in E2E tests
- Ready for 11-02-PLAN.md

## Self-Check: PASSED

All 12 created files verified on disk. Both task commits (e395584, 7e25a3e) verified in git log.

---
*Phase: 11-security-hardening*
*Completed: 2026-03-28*
