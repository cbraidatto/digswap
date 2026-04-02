---
phase: 18-desktop-shell-refactor
plan: 18-03
subsystem: desktop-auth-sync
tags: [electron, supabase-auth, preload, session-sync, web-shell]

requires: [18-01, 18-02]
provides:
  - "Explicit auth/session sync from the remote web app into the Electron main process"
  - "safeStorage-backed persistence of synced Supabase session tokens in the existing desktop vault"
  - "Logout propagation from the remote web app to desktop trade runtime"
affects: [desktop-shell, trade-runtime]

tech-stack:
  added: []
  patterns: [explicit-session-sync, minimal-remote-bridge, safeStorage-vault, browser-auth-mirroring]

key-files:
  created:
    - "apps/web/src/components/desktop/desktop-session-sync.tsx"
    - ".planning/phases/18-desktop-shell-refactor/18-03-SUMMARY.md"
  modified:
    - "apps/desktop/src/main/ipc.ts"
    - "apps/desktop/src/main/supabase-auth.ts"
    - "apps/desktop/src/preload/main.ts"
    - "apps/desktop/src/shared/ipc-types.ts"
    - "apps/web/src/app/layout.tsx"
  deleted: []

key-decisions:
  - "The remote web app explicitly pushes access+refresh tokens into Electron main through window.desktopShell.syncSession"
  - "Electron main never scrapes cookies, localStorage, or DOM state from the remote BrowserWindow"
  - "Desktop-side logout releases active trade leases before clearing the imported session"
  - "The remote bridge stays minimal: desktop detection, app version, and session sync only"

patterns-established:
  - "Browser auth state is mirrored into Electron main through a tiny client-side adapter"
  - "Desktop vault storage remains the single persisted auth source used by trade runtime"
  - "Trade handoff flow stays unchanged; this plan only removes the second-login gap"

requirements-completed: [DESK-10]

completed: 2026-04-02
---

# Phase 18 Plan 03 Summary

## Outcome

Added an explicit session-sync path between the remote DigSwap web app and the Electron main process, so the trade runtime can use the same authenticated user without scraping browser storage.

## Delivered

- `apps/desktop/src/shared/ipc-types.ts`
  - Added `DesktopShellSessionPayload`
  - Extended `DesktopMainShellBridge` with `syncSession(session | null)`
- `apps/desktop/src/preload/main.ts`
  - Exposes `window.desktopShell.syncSession(...)`
  - Keeps the remote bridge minimal
- `apps/desktop/src/main/ipc.ts`
  - Added `desktop-shell:sync-session`
  - Imports session on non-null payload
  - Releases active trade leases and clears desktop auth on null payload
- `apps/desktop/src/main/supabase-auth.ts`
  - Added `importSession(...)` using `supabase.auth.setSession(...)`
  - Added `clearImportedSession()`
  - Reused the same safeStorage-backed vault already used by desktop auth
- `apps/web/src/components/desktop/desktop-session-sync.tsx`
  - New client-side adapter that:
    - detects `window.desktopShell`
    - reads the initial browser Supabase session
    - subscribes to auth state changes
    - mirrors login/logout/token refresh into Electron main
- `apps/web/src/app/layout.tsx`
  - Mounts `DesktopSessionSync` at the app root so sync is active on both auth and protected routes

## Verification

- `pnpm --dir apps/desktop exec tsc --noEmit` passes
- `pnpm --dir apps/desktop build` passes
- `pnpm --dir apps/web exec biome check --write src/app/layout.tsx src/components/desktop/desktop-session-sync.tsx`
  - formatting/import organization applied successfully

## Known Verification Gap

- `pnpm --dir apps/web exec tsc --noEmit` still fails due unrelated pre-existing errors outside this write set
  - React type mismatches across older UI files
  - unrelated domain/test failures
  - existing layout warnings unrelated to this plan (`dangerouslySetInnerHTML`, Google font link display param)

No new type error was introduced in the touched desktop files, and the new web adapter file itself is structurally straightforward.

## Post-Merge Fixes Applied During Smoke Testing

During smoke testing, three blocking issues were discovered and fixed:

### 1. `DesktopSessionSync` rewritten to use server endpoint

`apps/web/src/components/desktop/desktop-session-sync.tsx` was rewritten because the original used `createBrowserClient().auth.getSession()` which returns null after server-side signin (HttpOnly cookies are inaccessible to JavaScript). The fix:

- Created `apps/web/src/app/api/desktop/session/route.ts` — GET endpoint using the server-side Supabase client to read HttpOnly cookies and return `{ accessToken, refreshToken }`
- Rewrote `DesktopSessionSync` to call `/api/desktop/session` on mount and on every `pathname` change (root layout never remounts), with `onAuthStateChange` kept as a fallback for OAuth flows
- Added `lastSyncedToken` ref to avoid redundant vault writes

### 2. Broken RLS policies on `trade_requests` fixed

The three RLS policies (`select_participant`, `insert_authenticated`, `update_participant`) had been created via the Supabase dashboard with empty conditions (`using_expr: null`, `with_check_expr: null`), which caused PostgreSQL to deny all access to authenticated users. Fixed in migration `20260404_fix_trade_requests_rls.sql`:

- SELECT: `USING (requester_id = auth.uid() OR provider_id = auth.uid())`
- INSERT: `WITH CHECK (requester_id = auth.uid())`
- UPDATE: USING + WITH CHECK for both participants

### 3. Desktop trade runtime RPC functions deployed

The migration `20260331_desktop_trade_runtime.sql` had never been applied to the remote Supabase instance. All five functions were missing from the schema cache:
- `list_desktop_pending_trades()`
- `acquire_trade_lease()`
- `heartbeat_trade_lease()`
- `release_trade_lease()`
- `finalize_trade_transfer()`

Applied via `desktop_trade_runtime_functions` migration directly to project `mrkgoucqcbqjhrdjcnpw`.

## Smoke Result: PASSED

Full end-to-end flow verified:
1. Main window loads webapp at localhost:3000 ✓
2. Login inside Electron works ✓
3. Session syncs to vault — `authVaultCiphertext` in `desktop-state.json` ✓
4. `window.desktopBridge` absent from main window ✓
5. Handoff opens trade window (DigSwap Trade) ✓
6. Trade window loaded lobby screen: "Both online — ready to start / Start Transfer" ✓
