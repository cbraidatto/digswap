---
phase: 17-desktop-trade-runtime
plan: "05"
subsystem: desktop-handoff
tags: [desktop, handoff, token, protocol-handler, webrtc, security]
dependency_graph:
  requires: [17-01]
  provides: [DESK-05, web-to-desktop-handoff]
  affects: [trade-detail-page, desktop-app-token-exchange]
tech_stack:
  added: []
  patterns:
    - HMAC-SHA256 short-TTL tokens with atomic single-use consumption (compare-and-swap via usedAt IS NULL)
    - digswap:// protocol handler open via window.location.href with visibilitychange fallback detection
    - OS detection (navigator.userAgent) for platform-specific download links
key_files:
  created:
    - src/lib/desktop/handoff-token.ts
    - src/actions/desktop.ts
    - src/app/desktop/open/page.tsx
    - src/app/desktop/open/_components/open-in-desktop.tsx
    - src/components/trade/open-in-desktop-button.tsx
    - tests/unit/desktop/handoff-token.test.ts
  modified:
    - src/lib/db/schema/trades.ts
decisions:
  - handoffTokens RLS blocks all direct authenticated access (sql`false`) — server actions use Drizzle db client directly which bypasses RLS
  - Button asChild not available (Base UI button, not shadcn) — download CTAs use styled anchor tags instead
  - desktopVersion version gate applied before firing protocol handler (not after) to avoid spurious 1.5s wait
metrics:
  duration: 6min
  completed: "2026-03-31"
  tasks_completed: 2
  files_changed: 7
---

# Phase 17 Plan 05: Web Handoff Page + Download Gate Summary

HMAC-SHA256 signed single-use tokens with web intermediary page that fires digswap:// protocol handler and detects install status within 1.5s.

## What Was Built

### Task 1: Handoff token infrastructure

**Schema addition** (`src/lib/db/schema/trades.ts`):
Added `handoffTokens` table with columns: `id`, `tradeId` (FK → trade_requests, cascade delete), `userId`, `tokenHmac` (64-char hex HMAC-SHA256), `expiresAt` (5-min TTL), `usedAt` (null until consumed), `createdAt`. RLS policy blocks all direct authenticated access — server actions use the Drizzle db client to bypass RLS.

**Crypto library** (`src/lib/desktop/handoff-token.ts`):
- `createHandoffToken(tradeId, userId)`: generates 32 random bytes, computes HMAC-SHA256(plaintext, HANDOFF_HMAC_SECRET), stores hash+metadata in DB, returns plaintext
- `verifyAndConsumeHandoffToken(plaintext, tradeId, userId)`: recomputes HMAC, fetches matching row (usedAt IS NULL), checks expiry, atomically marks usedAt=now() via compare-and-swap (WHERE id=? AND usedAt IS NULL)

**Server actions** (`src/actions/desktop.ts`):
- `generateHandoffToken(tradeId)`: authenticates caller, verifies participant membership (IDOR protection), calls createHandoffToken
- `checkDesktopVersion()`: reads NEXT_PUBLIC_MIN_DESKTOP_VERSION, returns { minVersion }

**Unit tests** (`tests/unit/desktop/handoff-token.test.ts`):
5 tests passing: valid token consumed once returns true, second consumption returns false (replay blocked), expired token returns false, wrong tradeId returns false, token format is 64-char hex.

### Task 2: /desktop/open page + CTA button

**Server page** (`src/app/desktop/open/page.tsx`): Public route outside (protected) group. Reads trade/token/dv searchParams, calls checkDesktopVersion, renders card with OpenInDesktop client component. Shows "Invalid handoff link" message when required params are missing.

**Client component** (`src/app/desktop/open/_components/open-in-desktop.tsx`): Four states — opening (default, fires protocol), success (visibilitychange detected), not-installed (1.5s timeout), version-blocked (dv param < minVersion). OS detection for Windows/macOS/Linux download links. Retry link in success state.

**CTA button** (`src/components/trade/open-in-desktop-button.tsx`): Calls generateHandoffToken server action, loading state during flight, sonner toast on error, router.push to /desktop/open on success.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Button asChild not available in project's Button component**
- **Found during:** Task 2 TypeScript check
- **Issue:** The plan specified using `<Button asChild>` for download links, but the project uses `@base-ui/react/button` (not shadcn/ui) which doesn't have `asChild` prop
- **Fix:** Replaced `<Button asChild>` with styled anchor tags using Tailwind classes matching the button design system
- **Files modified:** `src/app/desktop/open/_components/open-in-desktop.tsx`
- **Commit:** 223064b

## Known Stubs

- `/downloads/digswap-setup.exe` — placeholder download URL, real artifact URL provided in Phase 17-02 (Electron build pipeline)
- `/downloads/digswap.dmg` — placeholder download URL
- `/downloads/digswap.AppImage` — placeholder download URL

These stubs are intentional: the actual build artifacts do not exist yet. Phase 17-02 will wire the real download URLs. The handoff page UI is fully functional; only the download destination is a placeholder.

## Self-Check: PASSED

Files created:
- src/lib/desktop/handoff-token.ts: FOUND
- src/actions/desktop.ts: FOUND
- src/app/desktop/open/page.tsx: FOUND
- src/app/desktop/open/_components/open-in-desktop.tsx: FOUND
- src/components/trade/open-in-desktop-button.tsx: FOUND
- tests/unit/desktop/handoff-token.test.ts: FOUND

Commits:
- ff61ce2: Task 1 — handoff token infrastructure
- 223064b: Task 2 — /desktop/open page + CTA button

Tests: 5/5 passing (npx vitest run tests/unit/desktop/handoff-token.test.ts)
TypeScript: zero errors in new files (npx tsc --noEmit | grep desktop)
