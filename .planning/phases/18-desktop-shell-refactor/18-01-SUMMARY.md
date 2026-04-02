---
phase: 18-desktop-shell-refactor
plan: 18-01
subsystem: desktop-shell
tags: [electron, shell-refactor, browserwindow, preload, security-boundary]

requires: [ADR-002, 17-08]
provides:
  - "Remote main window that loads the real DigSwap web app"
  - "Dedicated local trade window with privileged preload kept separate from remote content"
  - "Split preload surfaces: window.desktopShell for remote web, window.desktopBridge for local trade runtime"
  - "Window-scoped IPC delivery so trade runtime events no longer broadcast into the remote main window"
affects: [18-02, 18-03]

tech-stack:
  added: []
  patterns: [remote-main-window, local-trade-window, split-preload-bridge, origin-allowlist, window-scoped-ipc]

key-files:
  created:
    - "apps/desktop/src/preload/main.ts"
    - "apps/desktop/src/preload/trade.ts"
    - ".planning/phases/18-desktop-shell-refactor/18-01-SUMMARY.md"
  modified:
    - "apps/desktop/electron.vite.config.ts"
    - "apps/desktop/src/main/index.ts"
    - "apps/desktop/src/main/ipc.ts"
    - "apps/desktop/src/main/window.ts"
    - "apps/desktop/src/shared/ipc-types.ts"
  deleted: []

key-decisions:
  - "Main BrowserWindow now loads config.siteUrl directly instead of the local mini-app renderer"
  - "Trade/file APIs remain isolated behind a dedicated trade preload; remote content only gets window.desktopShell"
  - "Trade runtime events (lobby/progress/complete/session) are delivered only to the trade window"
  - "Main-window navigation is locked to DigSwap + explicit auth/Discogs origins so embedded web auth flows do not break"

patterns-established:
  - "Trust boundaries are enforced by separate BrowserWindows and separate preloads, not by convention"
  - "Protocol handoffs open or focus the trade window while auth callbacks stay in main-process auth handling"
  - "Remote content receives a desktop presence hint via window.desktopShell, not privileged native capabilities"

requirements-completed: [DESK-08]

completed: 2026-03-31
---

# Phase 18 Plan 01 Summary

## Outcome

Refactored the Electron shell into two explicit trust zones:

- a remote main window that loads the real DigSwap web app
- a local trade window that keeps the privileged runtime bridge

This is the shell/security cut that unblocks Claude's dedicated `renderer-trade` work and the later session-sync work.

## Delivered

- `apps/desktop/src/main/window.ts`
  - Adds `createMainWindow`, `createTradeWindow`, `getMainWindow`, `getTradeWindow`, `focusMainWindow`, and `focusTradeWindow`
  - Main window now loads `config.siteUrl`
  - Trade window stays local and loads the current bundled renderer
  - Main-window navigation is explicitly locked down
- `apps/desktop/src/preload/main.ts`
  - Exposes `window.desktopShell`
  - Keeps the remote web surface minimal: `isDesktop()` and `getAppVersion()`
- `apps/desktop/src/preload/trade.ts`
  - Moves the privileged desktop bridge to the local trade window
  - Preserves the existing trade runtime/auth/settings contract for the local renderer
- `apps/desktop/src/main/ipc.ts`
  - Routes lobby/progress/complete/session events only to the trade window
  - Stops broadcasting privileged trade runtime events into every BrowserWindow
- `apps/desktop/src/main/index.ts`
  - `digswap://trade/...` now opens/focuses the trade window path
  - `digswap://auth/callback` remains handled in the main process auth runtime
- `apps/desktop/electron.vite.config.ts`
  - Builds two preload entry points: `main` and `trade`
- `apps/desktop/src/shared/ipc-types.ts`
  - Adds `DesktopMainShellBridge`
  - Adds global typing for `window.desktopShell`

## Verification

- `pnpm --dir apps/desktop exec tsc --noEmit` passes
- `pnpm --dir apps/desktop build` passes
- Build output now includes:
  - `apps/desktop/out/preload/main.js`
  - `apps/desktop/out/preload/trade.js`

## Important Notes For 18-02 / 18-03

- The trade window still loads the current local renderer bundle for now. Claude can replace that content with `renderer-trade` in 18-02 without redoing the shell split.
- The main-window allowlist includes:
  - DigSwap site origin
  - Supabase origin
  - Google / GitHub / Discogs auth origins

This is intentional so the embedded web app can keep existing auth and Discogs OAuth flows working while still denying arbitrary remote navigation.

## Deviations From Plan

- `apps/desktop/src/preload/index.ts` was left in place but is no longer used by the built shell. This keeps the refactor narrow and avoids unnecessary churn during the preload split.
- The remote main-shell bridge was kept intentionally tiny. Session sync is deferred to 18-03 rather than being smuggled into 18-01.

## Self-Check

PASSED

The shell split, preload split, remote-origin hardening, and window-scoped IPC all compile and build cleanly. The remaining work is correctly pushed into:

- 18-02 for the dedicated local `renderer-trade`
- 18-03 for explicit web-to-desktop session sync
