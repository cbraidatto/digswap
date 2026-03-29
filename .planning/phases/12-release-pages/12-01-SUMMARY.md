---
phase: 12-release-pages
plan: 01
subsystem: api
tags: [drizzle, youtube-api, csp, server-actions, supabase]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Supabase auth, Drizzle ORM, releases schema with youtubeVideoId column
  - phase: 06-discovery-notifications
    provides: SearchResult/BrowseResult interfaces, discovery queries, rate limiting
  - phase: 10-positioning-radar-workspace
    provides: RadarMatch interface, radar queries, public route layout pattern
  - phase: 11-security-hardening
    provides: Nonce-based CSP header generation
provides:
  - getReleaseByDiscogsId, getOwnersByReleaseId, getOwnerCountByReleaseId query functions
  - searchYouTubeForRelease server action with lazy-cache pattern
  - CSP frame-src for YouTube iframe embeds
  - discogsId field on SearchResult, BrowseResult, SuggestionResult, RadarMatch interfaces
affects: [12-release-pages plan 02 (release page route), 12-release-pages plan 03 (entry point wiring)]

# Tech tracking
tech-stack:
  added: []
  patterns: [YouTube lazy-cache via server action, admin client for YouTube cache writes]

key-files:
  created:
    - src/lib/release/queries.ts
    - src/actions/release.ts
  modified:
    - src/lib/security/csp.ts
    - src/lib/discovery/queries.ts
    - src/lib/wantlist/radar-queries.ts

key-decisions:
  - "YouTube API key read at call time (not module scope) for graceful degradation when not configured"
  - "Admin client (not Drizzle) for YouTube cache write -- consistent with existing mutation pattern"
  - "youtube-nocookie.com (not youtube.com) in CSP frame-src for GDPR-compliant privacy-enhanced embeds"

patterns-established:
  - "YouTube lazy-cache: first visit searches API, caches videoId in releases.youtube_video_id, subsequent visits return cache"
  - "Public release queries via Drizzle db client bypassing RLS (same pattern as perfil/bounty pages)"

requirements-completed: [REL-01, REL-02, REL-03, REL-04, REL-05]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 12 Plan 01: Release Page Data Layer Summary

**Release query functions, YouTube lazy-cache server action, CSP YouTube frame-src, and discogsId interface wiring for entry point links**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T00:59:13Z
- **Completed:** 2026-03-29T01:03:22Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Built complete release data layer: getReleaseByDiscogsId, getOwnersByReleaseId, getOwnerCountByReleaseId
- Implemented YouTube lazy-cache server action with rate limiting, auth gating, graceful degradation on missing API key or quota exhaustion
- Added CSP frame-src directive for youtube-nocookie.com to enable YouTube iframe embeds
- Wired discogsId field through SearchResult, BrowseResult, SuggestionResult, and RadarMatch interfaces and all their query functions

## Task Commits

Each task was committed atomically:

1. **Task 1: Release query functions + YouTube server action** - `3c15dc3` (feat)
2. **Task 2: CSP frame-src update + SearchResult/RadarMatch discogsId fix** - `90eabd7` (feat)

## Files Created/Modified
- `src/lib/release/queries.ts` - Release page query functions (getReleaseByDiscogsId, getOwnersByReleaseId, getOwnerCountByReleaseId, ReleaseOwner interface)
- `src/actions/release.ts` - YouTube lazy-cache server action with auth, rate limiting, and graceful degradation
- `src/lib/security/csp.ts` - Added frame-src directive for YouTube privacy-enhanced embed
- `src/lib/discovery/queries.ts` - Added discogsId to SearchResult, BrowseResult, SuggestionResult interfaces and all query selects
- `src/lib/wantlist/radar-queries.ts` - Added discogsId to RadarMatch interface, query select, and deduplication mapping

## Decisions Made
- YouTube API key is read at call time via `process.env.YOUTUBE_API_KEY` (not module-scope constant) so the server action degrades gracefully when the key is not configured
- Used Supabase admin client (not Drizzle) for the YouTube cache write to stay consistent with the existing mutation pattern across all server actions
- Used youtube-nocookie.com in CSP frame-src (not youtube.com) for GDPR-compliant privacy-enhanced embeds per research recommendation

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None - all functions are fully implemented with real data sources.

## User Setup Required

None - no external service configuration required. The YouTube API key (`YOUTUBE_API_KEY`) is optional; when not configured, the YouTube section silently degrades.

## Next Phase Readiness
- Release data layer complete, ready for Plan 02 (release page route with page.tsx, components, layout)
- Plan 03 (entry point wiring) can now use discogsId from SearchResult and RadarMatch to build /release/[discogsId] links
- CSP is ready for YouTube iframe embeds

## Self-Check: PASSED

- All 5 files verified (2 created, 3 modified)
- Both task commits found (3c15dc3, 90eabd7)

---
*Phase: 12-release-pages*
*Completed: 2026-03-29*
