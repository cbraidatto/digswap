---
phase: 17-desktop-trade-runtime
plan: 17-02
subsystem: desktop-shell
tags: [electron, electron-vite, preload, protocol-handler, supabase-auth, safeStorage]

# Dependency graph
requires: [ADR-002, 17-01, 17-05]
provides:
  - "Electron desktop shell with main/preload/renderer separation"
  - "digswap:// protocol registration and parsing for trade handoff + auth callback"
  - "External-browser Supabase OAuth with PKCE callback handling in the main process"
  - "safeStorage-backed encrypted local auth vault using electron-store"
  - "Typed preload bridge for renderer shell/auth/settings/protocol events"
affects: [17-03, 17-04, 17-06]

# Tech tracking
tech-stack:
  added: [electron-41.1.0, electron-vite-5.0.0, vite-7.3.1, electron-store-11.0.2, supabase-js-2.101.0]
  patterns: [locked-down-browserwindow, external-browser-oauth, safeStorage-vault, typed-preload-bridge]

key-files:
  created:
    - "apps/desktop/electron.vite.config.ts"
    - "apps/desktop/src/main/config.ts"
    - "apps/desktop/src/main/index.ts"
    - "apps/desktop/src/main/ipc.ts"
    - "apps/desktop/src/main/protocol.ts"
    - "apps/desktop/src/main/session-store.ts"
    - "apps/desktop/src/main/supabase-auth.ts"
    - "apps/desktop/src/main/window.ts"
    - "apps/desktop/src/preload/index.ts"
    - "apps/desktop/src/renderer/index.html"
    - "apps/desktop/src/renderer/src/app.tsx"
    - "apps/desktop/src/renderer/src/main.tsx"
    - "apps/desktop/src/renderer/src/styles.css"
    - ".planning/phases/17-desktop-trade-runtime/17-02-PLAN.md"
  modified:
    - ".gitignore"
    - "apps/desktop/package.json"
    - "apps/desktop/src/shared/ipc-types.ts"
    - "apps/desktop/tsconfig.json"
    - "pnpm-lock.yaml"
  deleted:
    - "apps/desktop/src/index.ts"

key-decisions:
  - "Kept the renderer API on window.desktopBridge and extended the existing ipc-types contract instead of introducing a competing bridge shape"
  - "Ran Supabase auth in the Electron main process so PKCE verifier storage, callback exchange, and token persistence stay out of the renderer"
  - "Used electron-store only as a container; auth payloads themselves are encrypted/decrypted through safeStorage before hitting disk"
  - "Allowed development fallback to apps/web/.env.local or root .env.local so desktop and web can share Supabase config during local development"

patterns-established:
  - "Protocol URLs are queued before app ready and replayed once the main process is initialized"
  - "Renderer receives live protocol/auth updates through preload subscriptions rather than direct Electron access"
  - "Desktop settings remain plaintext in electron-store, while auth vault data is always encrypted before persistence"
  - "Renderer shell stays intentionally thin: bootstrap state + auth/status surfaces only"

requirements-completed: [DESK-02]

# Metrics
duration: 2h
completed: 2026-03-31
---

# Phase 17 Plan 02: Electron Shell + Auth Callback + Secure Token Storage + Protocol Handler Summary

**apps/desktop is now a real Electron workspace with a locked-down BrowserWindow, digswap:// protocol handling, main-process Supabase OAuth, safeStorage-backed session persistence, and a typed preload bridge ready for Claude's renderer work.**

## Accomplishments

- Replaced the desktop placeholder package with an Electron + React toolchain using `electron-vite`.
- Added a secure main-process shell that registers `digswap://`, enforces single-instance behavior, and queues protocol payloads until the app is ready.
- Implemented protocol parsing for both `digswap://trade/<tradeId>?handoff=<token>` and `digswap://auth/callback?code=...`.
- Added a safeStorage-backed encrypted auth vault persisted through `electron-store`, keeping tokens off disk in plaintext.
- Wired Supabase desktop auth in the main process with external-browser OAuth and callback exchange via PKCE.
- Exposed a typed preload API on `window.desktopBridge` for bootstrap state, auth actions, settings, and live protocol/session events.
- Added a minimal renderer shell that proves the bridge and runtime are wired without stepping on the renderer plan owned by Claude.

## Verification

- `pnpm --dir apps/desktop exec tsc --noEmit` passes.
- `pnpm --dir apps/desktop build` passes and produces main/preload/renderer bundles under `apps/desktop/out`.
- `pnpm --dir apps/desktop exec electron --version` returns `v41.1.0` after explicitly running Electron's install script.
- `pnpm --dir apps/desktop dev` stayed alive until the command timeout with no startup crash emitted during shell boot.

## Deviations from Plan

### Runtime placeholders intentionally deferred to later plans

- `getPendingTrades()` currently returns an empty array.
- `openTradeFromHandoff()` currently throws a directed "lands in 17-06" error.
- `openOAuth("email")` is rejected with a not-implemented message; Google is the only wired provider in this shell phase.

These are deliberate scope cuts to keep 17-02 focused on shell/security/runtime boundaries while 17-04 and 17-06 fill in product behavior.

### Environment bootstrap needed a local Electron install fix

- `pnpm install` completed, but pnpm's ignored build scripts prevented Electron from downloading its binary.
- Resolved locally by running `node node_modules/.pnpm/electron@41.1.0/node_modules/electron/install.js`.
- This does not change application code, but it matters for local verification until the team's pnpm build-script policy is standardized.

## Files Created/Modified

- `apps/desktop/package.json` - desktop toolchain, Electron/Vite scripts, runtime dependencies
- `apps/desktop/electron.vite.config.ts` - split build targets for main/preload/renderer
- `apps/desktop/src/main/*.ts` - protocol handling, auth runtime, secure vault, IPC, window lifecycle
- `apps/desktop/src/preload/index.ts` - contextBridge API exposing the desktop shell contract
- `apps/desktop/src/shared/ipc-types.ts` - expanded bridge contracts for bootstrap state and event subscriptions
- `apps/desktop/src/renderer/*` - minimal React shell validating preload/main wiring
- `.gitignore` - ignores `apps/*/out` build artifacts

## Next Phase Readiness

- 17-04 can build real screens on top of `window.desktopBridge` without redesigning the Electron boundary.
- 17-03 can layer lease/reconciliation work into the existing main-process runtime cleanly.
- 17-06 can replace the temporary `getPendingTrades` and `openTradeFromHandoff` placeholders with real trade runtime behavior.

## Self-Check: PASSED WITH INTENTIONAL RUNTIME PLACEHOLDERS

The Electron shell, secure auth vault, protocol handler, preload bridge, and desktop build pipeline all compile and boot. The remaining gaps are explicit scope deferrals to 17-04/17-06, not hidden failures.

---
*Phase: 17-desktop-trade-runtime*
*Completed: 2026-03-31*
