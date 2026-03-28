---
phase: 11-security-hardening
plan: 02
subsystem: security
tags: [rate-limiting, upstash, zod, input-validation, idor, csp, open-redirect, xss]

requires:
  - phase: 11-01
    provides: "Rate limit module skeleton, Zod validation schemas, CSP generator, test stubs"
provides:
  - "Rate limiting on all 15 server action files (auth + mfa + 13 new)"
  - "Zod input validation on community and profile actions"
  - "ilike wildcard injection fix in profile search"
  - "HTML injection fix in trade and wantlist email templates"
  - "5 security test suites (81 passing tests)"
affects: [11-security-hardening]

tech-stack:
  added: []
  patterns:
    - "Rate limit after auth check, before business logic"
    - "escapeHtml() for user data in email HTML templates"
    - "sanitizeWildcards() for ilike query parameters"

key-files:
  created: []
  modified:
    - "src/lib/rate-limit.ts"
    - "src/actions/trades.ts"
    - "src/actions/community.ts"
    - "src/actions/social.ts"
    - "src/actions/discovery.ts"
    - "src/actions/profile.ts"
    - "src/actions/collection.ts"
    - "src/actions/discogs.ts"
    - "src/actions/leads.ts"
    - "src/actions/wantlist.ts"
    - "src/actions/notifications.ts"
    - "src/actions/gamification.ts"
    - "src/actions/onboarding.ts"
    - "src/actions/sessions.ts"
    - "src/lib/notifications/email.ts"
    - "tests/security/rate-limiting.test.ts"
    - "tests/security/input-validation.test.ts"
    - "tests/security/idor.test.ts"
    - "tests/security/open-redirect.test.ts"
    - "tests/security/csp.test.ts"

key-decisions:
  - "Three rate limit tiers: api (30/60s), trade (10/60s), discogs (5/60s) matching action sensitivity"
  - "Rate limit read-only server actions too (gamification, discovery) to prevent abuse"
  - "escapeHtml inline helper in each email file rather than shared utility (minimal duplication, no extra import chain)"

patterns-established:
  - "Rate limit pattern: const { success: rlSuccess } = await xRateLimit.limit(user.id); if (!rlSuccess) return { error: 'Too many requests...' }"
  - "Zod validation pattern: const parsed = schema.safeParse(data); if (!parsed.success) throw new Error(parsed.error.issues[0]?.message)"

requirements-completed: [SEC-02, SEC-03]

duration: 16min
completed: 2026-03-28
---

# Phase 11 Plan 02: Security Hardening - Rate Limiting, Validation & Tests Summary

**Rate limiting on all 13 unprotected server action files with 3 Upstash tiers, Zod input validation on community/profile, ilike wildcard injection fix, email HTML injection fix, and 81 passing security tests across 5 suites**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-28T20:19:44Z
- **Completed:** 2026-03-28T20:36:08Z
- **Tasks:** 2
- **Files modified:** 20

## Accomplishments

- Added apiRateLimit (30/60s), tradeRateLimit (10/60s), discogsRateLimit (5/60s) and applied them to all 13 previously unprotected server action files
- Fixed ilike wildcard injection in profile.ts searchCollectionForShowcase with sanitizeWildcards
- Added Zod schema validation to createPostAction, createReviewAction, and updateProfile
- Fixed HTML injection in trade request email (trades.ts) and wantlist match email (email.ts) with escapeHtml
- Implemented 81 passing security tests across 5 suites: rate-limiting (10), input-validation (45), idor (7), open-redirect (7), csp (12)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add rate limiting to all 13 server action files + fix input validation gaps** - `43bc8a4` (feat)
2. **Task 2: Implement 5 security test suites** - `90cf6f3` (test)

## Files Created/Modified

- `src/lib/rate-limit.ts` - Added 3 new rate limiter exports (apiRateLimit, tradeRateLimit, discogsRateLimit)
- `src/actions/trades.ts` - Rate limiting on all 10 trade actions + escapeHtml for email template
- `src/actions/community.ts` - Rate limiting on 8 group/post/review actions + Zod validation on createPost/createReview
- `src/actions/social.ts` - Rate limiting on followUser, unfollowUser, searchUsers
- `src/actions/discovery.ts` - Rate limiting on searchRecords, browseRecords, getSuggestions
- `src/actions/profile.ts` - Rate limiting on 7 profile actions + sanitizeWildcards + Zod URL validation
- `src/actions/collection.ts` - Rate limiting on searchDiscogs, addRecord, updateConditionGrade
- `src/actions/discogs.ts` - Rate limiting on connectDiscogs, triggerSync, disconnectDiscogs, triggerReimport
- `src/actions/leads.ts` - Rate limiting on saveLead, getLead, getLeads
- `src/actions/wantlist.ts` - Rate limiting on addToWantlist, removeFromWantlist, markAsFound, addFromYouTube
- `src/actions/notifications.ts` - Rate limiting on markNotificationRead, markAllRead, updatePreferences
- `src/actions/gamification.ts` - Rate limiting on all 4 leaderboard actions
- `src/actions/onboarding.ts` - Rate limiting on updateProfile, completeOnboarding
- `src/actions/sessions.ts` - Rate limiting on getSessions, terminateSession
- `src/lib/notifications/email.ts` - escapeHtml for wantlist match email template
- `tests/security/rate-limiting.test.ts` - 10 tests verifying rate limit enforcement on 5 representative modules
- `tests/security/input-validation.test.ts` - 45 tests covering all Zod schemas
- `tests/security/idor.test.ts` - 7 tests verifying ownership checks on IDOR-sensitive actions
- `tests/security/open-redirect.test.ts` - 7 tests for redirect path validation
- `tests/security/csp.test.ts` - 12 tests for CSP header generation

## Decisions Made

- **Three rate limit tiers:** api (30/60s general), trade (10/60s high-cost), discogs (5/60s external API) -- matching action sensitivity levels
- **Rate limit read-only server actions too:** Even gamification and discovery read-only queries get rate-limited to prevent scraping/abuse, returning empty results on limit rather than errors
- **escapeHtml as inline helper:** Added in each email file rather than creating a shared utility -- the duplication is minimal (6 lines) and avoids an additional import chain for a simple function
- **Zod validation uses .issues[0]?.message:** Not .errors (which doesn't exist on ZodError), properly accessing the Zod error structure

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ZodError .errors -> .issues property**
- **Found during:** Task 1 (TypeScript compilation check)
- **Issue:** Plan examples used `parsed.error.errors[0]?.message` but ZodError uses `.issues` not `.errors`
- **Fix:** Changed to `parsed.error.issues[0]?.message` in community.ts and profile.ts
- **Files modified:** src/actions/community.ts, src/actions/profile.ts
- **Verification:** TypeScript compilation passes
- **Committed in:** 43bc8a4

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Trivial API name correction. No scope creep.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - all implementations are fully wired.

## Next Phase Readiness

- All 15 server action files now rate-limited (auth, mfa, + 13 new)
- 5 security test suites fully implemented and passing (81 tests)
- Ready for 11-03 (final security hardening tasks)

## Self-Check: PASSED

- All 20 files verified on disk
- Both task commits (43bc8a4, 90cf6f3) verified in git log

---
*Phase: 11-security-hardening*
*Completed: 2026-03-28*
