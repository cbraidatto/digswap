---
phase: 17-desktop-trade-runtime
plan: "04"
subsystem: desktop-renderer
tags: [electron, react, ipc, renderer, ui]
dependency_graph:
  requires: [17-01]
  provides: [desktop-renderer-ui, ipc-bridge-types]
  affects: [17-02, 17-03, 17-06]
tech_stack:
  added: [react@18, react-dom@18, "@types/react@18", "@types/react-dom@18"]
  patterns: [ipc-bridge-pattern, react-18-createroot, tailwind-dark-warm-palette]
key_files:
  created:
    - apps/desktop/src/shared/ipc-types.ts
    - apps/desktop/src/renderer/index.tsx
    - apps/desktop/src/renderer/AppShell.tsx
    - apps/desktop/src/renderer/LoginScreen.tsx
    - apps/desktop/src/renderer/InboxScreen.tsx
    - apps/desktop/src/renderer/SettingsScreen.tsx
  modified:
    - apps/desktop/package.json
    - apps/desktop/tsconfig.json
    - pnpm-lock.yaml
decisions:
  - "DesktopBridge interface is the sole IPC contract — renderer never imports Electron directly"
  - "Stub screens committed first to validate AppShell typecheck, then overwritten with full implementations in same task commit"
  - "InboxScreen polls getPendingTrades every 30s — Supabase Realtime not bridged to renderer"
metrics:
  duration_minutes: 25
  completed_date: "2026-03-31"
  tasks_completed: 3
  tasks_total: 3
  files_created: 6
  files_modified: 3
---

# Phase 17 Plan 04: Desktop Renderer Shell Summary

Desktop IPC bridge type contracts and all three renderer screens (Login, Inbox, Settings) plus AppShell — pure React with zero Electron imports in renderer code.

## What Was Built

### Task 1: IPC Bridge Type Contracts
Created `apps/desktop/src/shared/ipc-types.ts` — a types-only file that is the authoritative contract between the renderer (Claude) and the preload script (Codex). Exports:
- `DesktopBridge` — interface with 8 async methods (getSession, openOAuth, signOut, getPendingTrades, openTradeFromHandoff, getSettings, setSettings, selectDownloadPath, getAppVersion)
- `SupabaseSession` — minimal session shape for the renderer (avoids importing @supabase/supabase-js into renderer bundle)
- `DesktopSettings` — download path + update channel
- `PendingTrade` — trade row with TradeStatus from @digswap/trade-domain

The `declare global { interface Window { desktopBridge: DesktopBridge } }` block means all renderer components access `window.desktopBridge` with full type safety — no `(window as any)` casts.

Also added `react`, `react-dom`, `@types/react`, `@types/react-dom` to desktop package.json and extended tsconfig to include `.tsx` files.

### Task 2: Renderer Entry Point + AppShell
- `index.tsx` — React 18 `createRoot` mount into `#root`
- `AppShell.tsx` — session guard pattern: calls `getSession()` on mount, shows loading spinner, routes to `LoginScreen` if no session, or to the two-tab shell (Trades / Settings) if session present. Tab switching does not remount the active screen.

### Task 3: LoginScreen, InboxScreen, SettingsScreen
- **LoginScreen**: Centered card on `#0d0d0d`, DigSwap wordmark in amber, Google + Email OAuth buttons. `openOAuth(provider)` triggers system browser → re-calls `getSession()` on return. Inline error display on rejection.
- **InboxScreen**: Calls `getPendingTrades()` on mount + 30s `setInterval`. Status badges mapped from `TRADE_STATUS` constants (amber for pending/lobby, blue for previewing/accepted, pulsing green for transferring, muted for terminal states). "Open Trade" CTA per active trade row calls `openTradeFromHandoff(token)`. Empty state with music note icon and guidance text.
- **SettingsScreen**: Download path with OS folder picker (`selectDownloadPath()`), stable/beta update channel toggle (segmented button group), account section with email + app version + sign-out. All writes go through `setSettings()` with optimistic local update.

## Verification Results

1. `pnpm --dir apps/desktop exec tsc --noEmit` — PASSED (no errors)
2. `DesktopBridge` interface has all 8 methods — CONFIRMED
3. All 5 renderer files present — CONFIRMED
4. No `require('electron')`, `require('fs')`, or `require('path')` in renderer — CONFIRMED
5. `TRADE_STATUS` imported from `@digswap/trade-domain` in InboxScreen — CONFIRMED
6. No `(window as any)` casts anywhere in renderer — CONFIRMED

## Deviations from Plan

### Auto-fix: React dependencies missing from desktop package

**Found during:** Task 1 (pre-task environment check)
**Issue:** `apps/desktop/package.json` had no `react`, `react-dom`, or their `@types` entries. The tsconfig also only included `src/**/*.ts`, missing `.tsx`. Without these, TypeScript would fail on all renderer files.
**Fix:** Added react/react-dom to dependencies, @types/react/react-dom to devDependencies, extended tsconfig include to `src/**/*.tsx`. Ran `pnpm install` to link workspace packages.
**Files modified:** `apps/desktop/package.json`, `apps/desktop/tsconfig.json`, `pnpm-lock.yaml`
**Commit:** 65d476d

### Implementation approach: stub-then-implement for task 2

**Found during:** Task 2
**Issue:** AppShell imports LoginScreen, InboxScreen, and SettingsScreen. Committing AppShell with real imports but placeholder stub files was the cleanest way to get a clean typecheck on task 2 before writing the full implementations in task 3.
**Action:** Stub screens (return null) committed with task 2, overwritten with full implementations as part of task 3 commit. No functional difference in the final output — this is a sequencing note only.

## Known Stubs

None. All three screens have full implementations with real IPC calls. The `window.desktopBridge` methods will return meaningful data once Codex implements the preload side in 17-02/17-03.

## Commits

| Hash | Description |
|------|-------------|
| 65d476d | feat(17-04): IPC bridge type contracts — DesktopBridge interface + shared types |
| c319ed8 | feat(17-04): renderer entry point and AppShell session guard with tab navigation |
| 1530494 | feat(17-04): LoginScreen, InboxScreen, and SettingsScreen — full renderer UI |
