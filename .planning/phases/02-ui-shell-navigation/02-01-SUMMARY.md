---
phase: 02-ui-shell-navigation
plan: 01
subsystem: ui
tags: [shadcn, navigation, shell, bottom-bar, header, avatar-dropdown, server-components, base-ui]

# Dependency graph
requires:
  - phase: 01-foundation-authentication
    provides: auth actions, profiles schema, middleware route protection, avatar component, OKLCH theme
provides:
  - AppShell component with conditional header + bottom bar rendering
  - 4-tab bottom navigation (Feed, Perfil, Explorar, Comunidade) with active state detection
  - AppHeader with VinylDig wordmark and user avatar dropdown
  - UserAvatarMenu with Settings navigation and signOut action
  - EmptyState reusable component for placeholder content
  - Protected layout fetching profile data from Drizzle
  - signOut server action
  - Viewport-fit:cover for iOS safe-area support
  - All redirect chains updated from "/" to "/feed"
affects: [02-02, 03, 04, 05, 06, 07]

# Tech tracking
tech-stack:
  added: ["@base-ui/react/menu (via shadcn dropdown-menu)"]
  patterns: ["Client/Server component composition in shell", "Conditional shell rendering via pathname exclusion", "startsWith-based active tab detection"]

key-files:
  created:
    - src/components/shell/app-shell.tsx
    - src/components/shell/app-header.tsx
    - src/components/shell/bottom-bar.tsx
    - src/components/shell/bottom-bar-item.tsx
    - src/components/shell/user-avatar-menu.tsx
    - src/components/shell/empty-state.tsx
    - src/components/ui/dropdown-menu.tsx
    - src/app/(protected)/layout.tsx
  modified:
    - src/actions/auth.ts
    - src/app/layout.tsx
    - src/lib/supabase/middleware.ts
    - src/actions/onboarding.ts
    - src/actions/mfa.ts
    - src/app/(protected)/onboarding/layout.tsx
    - src/components/onboarding/onboarding-complete.tsx

key-decisions:
  - "AppShell is a client component using usePathname() for conditional shell rendering -- excludes /onboarding and /settings"
  - "Protected layout is a server component that fetches profile via Drizzle and passes to AppShell client component"
  - "All redirect chains updated from / to /feed across middleware, onboarding, MFA, and onboarding-complete"

patterns-established:
  - "Shell exclusion pattern: SHELL_EXCLUDED_PREFIXES array with pathname.startsWith matching"
  - "Active tab detection: pathname.startsWith(tab.href) for deep link support"
  - "Server/Client composition: Server layout fetches data, passes to client shell for interactivity"

requirements-completed: [NAV-01, NAV-02, NAV-03]

# Metrics
duration: 5min
completed: 2026-03-25
---

# Phase 02 Plan 01: Navigation Shell Summary

**Complete navigation shell with 4-tab bottom bar (Feed/Perfil/Explorar/Comunidade), fixed header with VinylDig wordmark and avatar dropdown, conditional rendering excluding onboarding/settings, and all redirect chains pointing to /feed**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-25T10:50:53Z
- **Completed:** 2026-03-25T10:55:55Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Created 7 shell components (AppShell, AppHeader, BottomBar, BottomBarItem, UserAvatarMenu, EmptyState) plus installed shadcn dropdown-menu
- Built protected layout that fetches user profile via Drizzle and wraps content with AppShell
- Updated all redirect chains from "/" to "/feed" across 5 files (middleware, onboarding actions, MFA actions, onboarding layout, onboarding-complete component)
- Added viewport-fit:cover to root layout for iOS safe-area support
- Extended middleware protectedPaths with 4 new tab routes (/feed, /perfil, /explorar, /comunidade)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dropdown-menu, create shell components, add signOut action** - `0614bdf` (feat)
2. **Task 2: Create protected layout, update middleware routes, fix all redirects to /feed** - `07e5937` (feat)

## Files Created/Modified
- `src/components/shell/app-shell.tsx` - Client component: conditional shell rendering (header + bottom bar), excludes /onboarding and /settings
- `src/components/shell/app-header.tsx` - Server component: fixed header with VinylDig wordmark and UserAvatarMenu
- `src/components/shell/bottom-bar.tsx` - Client component: 4-tab bottom navigation with usePathname active detection
- `src/components/shell/bottom-bar-item.tsx` - Client component: individual tab item with aria-current and amber active state
- `src/components/shell/user-avatar-menu.tsx` - Client component: avatar dropdown with Settings and destructive Sign Out
- `src/components/shell/empty-state.tsx` - Server component: reusable empty state with LucideIcon, heading, body
- `src/components/ui/dropdown-menu.tsx` - shadcn dropdown-menu (base-nova preset, Base UI Menu primitive)
- `src/app/(protected)/layout.tsx` - Server layout: auth guard, profile fetching, AppShell wrapping
- `src/actions/auth.ts` - Added signOut server action with redirect to /signin
- `src/app/layout.tsx` - Added Viewport export with viewportFit: "cover"
- `src/lib/supabase/middleware.ts` - Extended protectedPaths, changed auth redirect to /feed
- `src/actions/onboarding.ts` - Changed completeOnboarding redirect to /feed
- `src/actions/mfa.ts` - Changed both MFA redirect chains to /feed
- `src/app/(protected)/onboarding/layout.tsx` - Changed already-completed redirect to /feed
- `src/components/onboarding/onboarding-complete.tsx` - Changed fallback redirect to /feed

## Decisions Made
- AppShell uses client-side pathname checking (usePathname) for conditional shell rendering rather than route group nesting -- simpler for a single layout wrapping all protected routes
- Protected layout fetches only displayName and avatarUrl from profiles (minimal data for shell rendering)
- All redirect chains consistently point to /feed as the default authenticated landing page

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all components are fully wired. EmptyState is a reusable component that will receive per-tab content in Plan 02.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Shell infrastructure complete: header, bottom bar, conditional rendering, route protection
- Ready for Plan 02: tab page creation with empty states and Perfil placeholder
- All 4 tab routes are protected but page files don't exist yet (Plan 02 creates them)

## Self-Check: PASSED

- All 8 created files exist on disk
- Commit 0614bdf (Task 1) found in git log
- Commit 07e5937 (Task 2) found in git log
- SUMMARY.md exists at expected path

---
*Phase: 02-ui-shell-navigation*
*Completed: 2026-03-25*
