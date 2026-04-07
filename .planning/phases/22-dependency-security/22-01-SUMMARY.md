---
phase: 22-dependency-security
plan: 01
subsystem: infra
tags: [vite, vitest, security, dependency-update, pnpm]

requires:
  - phase: none
    provides: existing package.json dependency declarations
provides:
  - Zero HIGH/CRITICAL vulnerabilities in pnpm audit (SEC-08)
  - Patched vite across all three workspaces (desktop, web, trade-domain)
affects: [deploy-readiness, ci-cd]

tech-stack:
  added: [vite@8.0.5 (web), vite@7.3.2 (desktop)]
  patterns: [direct devDependency to pin transitive resolution]

key-files:
  created: []
  modified:
    - apps/desktop/package.json
    - apps/web/package.json
    - packages/trade-domain/package.json
    - package.json
    - pnpm-lock.yaml

key-decisions:
  - "Added vite ^8.0.5 as direct devDependency in apps/web to force patched transitive resolution from @vitejs/plugin-react"

patterns-established:
  - "Direct devDep pinning: when a transitive dependency resolves to a vulnerable version, add as direct devDep to force resolution"

requirements-completed: [SEC-08]

duration: 3min
completed: 2026-04-07
---

# Phase 22 Plan 01: Dependency Security Summary

**Patched 9 vite vulnerabilities (6 high, 3 moderate) across desktop, web, and trade-domain workspaces to achieve zero audit findings**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-07T01:19:17Z
- **Completed:** 2026-04-07T01:22:49Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments
- Resolved all 9 known vite vulnerabilities (GHSA-v2wj-q39q-566r, GHSA-p9ff-h696-f583, GHSA-4w7w-66w2-5vf9)
- Updated vite to 7.3.2 in apps/desktop and 8.0.5 in apps/web
- Updated vitest to 4.1.2 in web and 3.2.4 in trade-domain
- pnpm audit now reports zero vulnerabilities at all severity levels

## Task Commits

Each task was committed atomically:

1. **Task 1: Update vite ecosystem dependencies across all workspaces** - `24f2485` (fix)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `apps/desktop/package.json` - vite bumped to ^7.3.2, @vitejs/plugin-react to ^5.2.0
- `apps/web/package.json` - Added vite ^8.0.5 direct devDep, vitest bumped to ^4.1.2
- `packages/trade-domain/package.json` - vitest bumped to ^3.2.4
- `package.json` - Root workspace (overrides unchanged)
- `pnpm-lock.yaml` - Regenerated with patched vite resolutions

## Decisions Made
- Added `vite` as a direct devDependency in `apps/web/package.json` at `^8.0.5` to force the transitive vite resolution from `@vitejs/plugin-react@6.0.1`. The plugin declares vite 8.x as a peer dep but was resolving to 8.0.3 (vulnerable). Making vite direct forces 8.0.5.
- Avoided pnpm overrides for vite version pinning since the desktop workspace uses vite 7.x while web uses 8.x -- a global override would create cross-workspace conflicts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added vite as direct devDependency in apps/web**
- **Found during:** Task 1 (dependency updates)
- **Issue:** `pnpm update @vitejs/plugin-react` did not bump the transitive vite from 8.0.3 to 8.0.5 because @vitejs/plugin-react@6.0.1 is the latest version and its peer dep range allows 8.0.3
- **Fix:** Added `"vite": "^8.0.5"` as a direct devDependency in apps/web/package.json to override the transitive resolution
- **Files modified:** apps/web/package.json
- **Verification:** `pnpm ls vite --filter @digswap/web --depth 1` shows 8.0.5, `pnpm audit` shows zero vulnerabilities
- **Committed in:** 24f2485

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Auto-fix was necessary because pnpm update alone couldn't resolve the transitive vite version. No scope creep.

## Issues Encountered
- Initial attempt to use pnpm overrides (`vitest>vite: >=7.3.2`) caused cross-workspace conflicts because trade-domain's vitest@3.2.4 only supports vite 5-7, not 8.x. The override forced vite 8.0.5 into trade-domain breaking peer compatibility. Removed the override and used direct devDep approach instead.

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - this plan only updates dependency versions.

## Next Phase Readiness
- SEC-08 satisfied: zero HIGH/CRITICAL vulnerabilities in pnpm audit
- All workspaces have patched vite versions
- trade-domain tests pass (42/42)
- Ready for remaining deploy readiness phases

## Self-Check: PASSED

- All 5 modified files exist on disk
- Commit 24f2485 exists in git log
- pnpm audit returns zero vulnerabilities

---
*Phase: 22-dependency-security*
*Completed: 2026-04-07*
