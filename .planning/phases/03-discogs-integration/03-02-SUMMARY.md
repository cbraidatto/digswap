---
phase: 03-discogs-integration
plan: 02
subsystem: auth
tags: [oauth, discogs, oauth-1.0a, webrtc-prep, server-actions, cookies]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "Supabase auth, admin client, server actions pattern, profiles schema, onboarding flow"
  - phase: 03-discogs-integration plan 01
    provides: "Discogs types, client, import-jobs schema (parallel execution)"
provides:
  - "OAuth 1.0a flow: getRequestToken, getAccessToken, storeTokens, deleteTokens"
  - "connectDiscogs server action for initiating Discogs authorization"
  - "GET /api/discogs/callback route handling full OAuth callback with import job creation"
  - "Activated onboarding Discogs connect button with loading state"
  - "/import-progress route protected in middleware"
affects: [03-discogs-integration plan 03, 03-discogs-integration plan 04, 03-discogs-integration plan 05]

# Tech tracking
tech-stack:
  added: ["@lionralfs/discogs-client (DiscogsOAuth, DiscogsClient)"]
  patterns: ["OAuth 1.0a cookie-based request token storage", "Vault-first with table fallback token storage", "fire-and-forget worker invocation"]

key-files:
  created:
    - src/lib/discogs/oauth.ts
    - src/actions/discogs.ts
    - src/app/api/discogs/callback/route.ts
  modified:
    - src/components/onboarding/discogs-connect.tsx
    - src/lib/supabase/middleware.ts

key-decisions:
  - "Vault-first token storage with discogs_tokens table fallback for environments without Vault extension"
  - "httpOnly cookie with sameSite: lax for OAuth request token survival across Discogs redirect"
  - "Admin client (not Drizzle) for profile update and import job creation in callback for RLS bypass consistency"
  - "NEXT_REDIRECT error filtering in component catch block to avoid false toast errors"

patterns-established:
  - "OAuth 1.0a flow: request token in httpOnly cookie -> redirect to provider -> callback exchanges verifier"
  - "Discogs token storage: try Vault RPC, fallback to discogs_tokens table upsert"
  - "Import trigger: callback creates import_jobs row then fire-and-forget POST to /api/discogs/import"

requirements-completed: [DISC-01, DISC-02]

# Metrics
duration: 6min
completed: 2026-03-25
---

# Phase 3 Plan 2: Discogs OAuth Flow Summary

**OAuth 1.0a connection flow with Vault token storage, callback-triggered import job creation, and activated onboarding button**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-25T17:26:03Z
- **Completed:** 2026-03-25T17:32:14Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Complete OAuth 1.0a flow: request token generation, Discogs redirect, callback with token exchange
- Secure token storage with Supabase Vault primary and discogs_tokens table fallback
- Callback creates import job and fires import worker automatically (per D-03: zero extra taps)
- Onboarding Connect Discogs button activated with useTransition loading state and toast error handling
- /import-progress route added to middleware protected paths

## Task Commits

Each task was committed atomically:

1. **Task 1: OAuth helpers and server action for Discogs connection** - `a6f5869` (feat)
2. **Task 2: OAuth callback route and onboarding button activation** - `3fccf8f` (feat)

## Files Created/Modified
- `src/lib/discogs/oauth.ts` - OAuth 1.0a helpers: getRequestToken, getAccessToken, storeTokens, deleteTokens
- `src/actions/discogs.ts` - connectDiscogs server action: auth check, request token, cookie, redirect
- `src/app/api/discogs/callback/route.ts` - OAuth callback: token exchange, identity fetch, profile update, import job creation
- `src/components/onboarding/discogs-connect.tsx` - Activated button with useTransition loading + toast errors
- `src/lib/supabase/middleware.ts` - Added /import-progress to protected paths

## Decisions Made
- **Vault-first token storage:** Attempts Supabase Vault RPC for encrypted-at-rest storage, falls back to discogs_tokens table. This ensures the flow works in local dev without Vault while using the best security option in production.
- **httpOnly cookie for request token:** sameSite: "lax" allows the cookie to survive the cross-origin redirect from Discogs back to VinylDig. maxAge: 600 (10 minutes) prevents stale tokens.
- **Admin client in callback:** Used admin client (not Drizzle) for profile update and import job creation because the callback needs RLS bypass, consistent with how the import worker pattern operates.
- **NEXT_REDIRECT filtering:** The connectDiscogs server action calls redirect() which throws a special NEXT_REDIRECT error. The component catch block filters this to avoid showing a false toast error to the user.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed @lionralfs/discogs-client dependency**
- **Found during:** Task 1 (OAuth helpers)
- **Issue:** Package not in dependencies; required for DiscogsOAuth and DiscogsClient imports
- **Fix:** Ran `npm install @lionralfs/discogs-client`
- **Files modified:** package.json, package-lock.json
- **Verification:** Import resolves correctly
- **Committed in:** a6f5869 (Task 1 commit)

**2. [Rule 1 - Bug] Added NEXT_REDIRECT error filtering in discogs-connect component**
- **Found during:** Task 2 (onboarding button activation)
- **Issue:** Next.js redirect() throws a NEXT_REDIRECT error that would be caught by the try/catch, showing a false error toast to the user
- **Fix:** Added check for NEXT_REDIRECT in error message before showing toast
- **Files modified:** src/components/onboarding/discogs-connect.tsx
- **Verification:** Only real errors trigger toast; redirect errors are silently passed through
- **Committed in:** 3fccf8f (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- Plan 03-01 runs in parallel and creates types/schema files this plan references. The callback route uses Supabase admin client for import_jobs table operations (not Drizzle ORM) which avoids a hard dependency on the Drizzle schema file from Plan 01.

## Known Stubs
None. All functions are fully implemented with real logic.

## User Setup Required
The following environment variables must be configured for the Discogs OAuth flow:
- `DISCOGS_CONSUMER_KEY` - Discogs developer application consumer key
- `DISCOGS_CONSUMER_SECRET` - Discogs developer application consumer secret
- `IMPORT_WORKER_SECRET` - Bearer token for authenticating import worker self-invocations
- `NEXT_PUBLIC_SITE_URL` - Base URL for OAuth callback redirect (defaults to http://localhost:3000)

## Next Phase Readiness
- OAuth flow complete: ready for Plan 03 (import worker) to process jobs created by this callback
- Token storage ready: import worker can retrieve tokens via Vault or fallback table
- Onboarding button wired: user can initiate Discogs connection from onboarding flow
- Settings entry point (Plan 05) will reuse connectDiscogs action for re-connection

## Self-Check: PASSED

All 6 files verified present. Both commit hashes (a6f5869, 3fccf8f) confirmed in git history.

---
*Phase: 03-discogs-integration*
*Completed: 2026-03-25*
