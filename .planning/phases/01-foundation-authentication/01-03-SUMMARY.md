---
phase: 01-foundation-authentication
plan: 03
subsystem: auth-infrastructure
tags: [supabase, middleware, auth, zod, validation, rate-limiting, upstash, security]

# Dependency graph
requires:
  - "01-01: Next.js 15 project scaffold, Vitest, Supabase packages installed"
provides:
  - "Browser-side Supabase client factory (createClient)"
  - "Server-side Supabase client factory with cookie-based sessions (createClient async)"
  - "Admin Supabase client factory bypassing RLS (createAdminClient)"
  - "Auth middleware helper refreshing JWT via getClaims() with route protection"
  - "Next.js middleware entry point with static file exclusion matcher"
  - "6 Zod validation schemas for all auth forms (signUp, signIn, forgotPassword, resetPassword, totp, backupCode)"
  - "TypeScript types inferred from all validation schemas"
  - "3 Upstash rate limiters: auth (5/60s), reset (3/15m), totp (5/5m)"
  - "Vitest configuration with jsdom, path aliases, and test directory pattern"
affects: [01-04, 01-05, 01-06, 01-07, 01-08]

# Tech tracking
tech-stack:
  added: []
  patterns: [supabase-ssr-cookie-auth, getClaims-not-getSession, middleware-route-protection, zod-v4-validation, upstash-sliding-window-rate-limit, tdd-red-green]

key-files:
  created:
    - "src/lib/supabase/client.ts"
    - "src/lib/supabase/server.ts"
    - "src/lib/supabase/admin.ts"
    - "src/lib/supabase/middleware.ts"
    - "src/middleware.ts"
    - "src/lib/validations/auth.ts"
    - "src/lib/rate-limit.ts"
    - "vitest.config.ts"
    - "tests/unit/lib/supabase/clients.test.ts"
    - "tests/unit/validations/auth.test.ts"
    - "tests/unit/lib/rate-limit.test.ts"
  modified: []

decisions:
  - "Used getClaims() exclusively for JWT validation in middleware (never getSession()) per Supabase security best practice"
  - "Middleware protects /onboarding, /settings, /profile routes and redirects auth pages for authenticated users"
  - "Password complexity rules: min 8 chars, 1 uppercase, 1 number, 1 special character per D-18"
  - "Rate limiter windows: auth=5/60s, reset=3/15m, totp=5/5m per D-16"
  - "Vitest config created early (blocking dependency for TDD workflow)"

metrics:
  duration: "6 minutes"
  completed: "2026-03-25T06:04:19Z"
  tasks: 2
  files: 11
  tests: 29
---

# Phase 01 Plan 03: Auth Infrastructure Layer Summary

Auth infrastructure plumbing with Supabase client factories, JWT-validating middleware, Zod validation schemas for all auth forms, and Upstash rate limiters -- all verified via 29 passing tests.

## Tasks Completed

### Task 1: Create Supabase client factories and auth middleware (TDD)
**Commit:** `e44aa8d`

Created three Supabase client factories following the official @supabase/ssr patterns:

- **Browser client** (`src/lib/supabase/client.ts`): Uses `createBrowserClient` from `@supabase/ssr` with the publishable key. Singleton pattern for client-side usage.
- **Server client** (`src/lib/supabase/server.ts`): Async factory using `createServerClient` with cookie `getAll`/`setAll` handlers. Per-request creation for Server Components and Server Actions.
- **Admin client** (`src/lib/supabase/admin.ts`): Uses `createClient` from `@supabase/supabase-js` with the service role key. Bypasses RLS -- restricted to server-side only with prominent warning comments.

Created auth middleware (`src/lib/supabase/middleware.ts` + `src/middleware.ts`):

- Refreshes JWT tokens via `getClaims()` on every request (NEVER `getSession()` -- critical security rule per Supabase docs)
- Redirects unauthenticated users from protected routes (`/onboarding`, `/settings`, `/profile`) to `/signin`
- Redirects authenticated users from auth routes (`/signin`, `/signup`, `/forgot-password`) to `/`
- Matcher excludes static files (`_next/static`, `_next/image`, favicon, image extensions)

Also created `vitest.config.ts` with jsdom environment, path aliases matching tsconfig, and test directory include pattern -- needed as a blocking dependency for TDD.

### Task 2: Create Zod validation schemas and Upstash rate limiters (TDD)
**Commit:** `eee2f06`

Created 6 Zod v4 validation schemas (`src/lib/validations/auth.ts`):

| Schema | Fields | Key Rules |
|--------|--------|-----------|
| `signUpSchema` | email, password, confirmPassword | Email format, password complexity (8+ chars, uppercase, number, special), passwords must match |
| `signInSchema` | email, password | Email format, password non-empty (no complexity check on login) |
| `forgotPasswordSchema` | email | Email format only |
| `resetPasswordSchema` | password, confirmPassword | Same password rules as signup, passwords must match |
| `totpSchema` | code | Exactly 6 numeric digits |
| `backupCodeSchema` | code | Non-empty string |

All schemas export inferred TypeScript types (e.g., `SignUpInput`, `SignInInput`).

Created 3 Upstash rate limiters (`src/lib/rate-limit.ts`):

| Limiter | Window | Limit | Key By | Purpose |
|---------|--------|-------|--------|---------|
| `authRateLimit` | 60 seconds sliding | 5 attempts | IP | Login, signup brute force prevention |
| `resetRateLimit` | 15 minutes sliding | 3 attempts | Email | Password reset abuse prevention |
| `totpRateLimit` | 5 minutes sliding | 5 attempts | User ID | 2FA code brute force prevention |

## Test Results

**29 tests, 3 test suites, all passing:**

- `tests/unit/lib/supabase/clients.test.ts`: 4 tests (3 client factories + middleware helper)
- `tests/unit/validations/auth.test.ts`: 21 tests (comprehensive accept/reject cases for all schemas)
- `tests/unit/lib/rate-limit.test.ts`: 4 tests (exports + instanceof verification)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created vitest.config.ts in Task 1 instead of Task 2**
- **Found during:** Task 1 RED phase
- **Issue:** Tests could not run without Vitest configuration. Plan specified vitest.config.ts creation in Task 2, but Task 1 tests needed it.
- **Fix:** Created vitest.config.ts during Task 1 to unblock TDD workflow.
- **Files modified:** `vitest.config.ts`
- **Commit:** `e44aa8d`

**2. [Rule 1 - Bug] Fixed getClaims() destructuring for nullable data**
- **Found during:** Task 1 GREEN phase (TypeScript type check)
- **Issue:** `getClaims()` returns `{ data: { claims, header, signature } | null, error: AuthError | null }`. Initial code used nested destructuring `data: { claims }` which fails when data is null (error case).
- **Fix:** Changed to `const { data, error } = await supabase.auth.getClaims()` with safe access `data?.claims?.sub`.
- **Files modified:** `src/lib/supabase/middleware.ts`
- **Commit:** `e44aa8d`

## Known Stubs

None -- all implementations are complete and wired to real dependencies (Supabase SDK, Upstash SDK, Zod). No placeholder data or mock data in production code.

## Self-Check: PASSED

- All 11 created files verified on disk
- Both task commits (e44aa8d, eee2f06) verified in git log
- 29/29 tests passing across 3 test suites
