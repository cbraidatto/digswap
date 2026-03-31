---
phase: 17-desktop-trade-runtime
plan: "06"
subsystem: desktop-renderer
tags: [electron, renderer, trade-flow, ipc, lobby, transfer, completion]
dependency_graph:
  requires: [17-04]
  provides: [renderer-trade-screens, ipc-trade-runtime-types]
  affects: [apps/desktop, packages/trade-domain]
tech_stack:
  added: []
  patterns:
    - Prop-callback navigation pattern (AppShell owns trade phase state, screens receive callbacks)
    - Absolute overlay pattern for full-screen trade flow over tab shell
    - IPC type contracts defined by renderer, implemented by main (Codex)
key_files:
  created:
    - apps/desktop/src/renderer/src/LobbyScreen.tsx
    - apps/desktop/src/renderer/src/TransferScreen.tsx
    - apps/desktop/src/renderer/src/CompletionScreen.tsx
  modified:
    - apps/desktop/src/shared/ipc-types.ts
    - apps/desktop/src/renderer/src/AppShell.tsx
    - apps/desktop/src/renderer/src/InboxScreen.tsx
decisions:
  - "Navigation state owned by AppShell (not by individual screens): onOpenTrade/onClose/onTransferStarted/onComplete/onCancel callbacks flow down"
  - "IPC trade runtime types defined in renderer (17-06 Claude), implemented by main process (17-06 Codex)"
  - "DesktopBridgeTradeRuntime merged into Window.desktopBridge at runtime by preload script"
metrics:
  duration_minutes: 3
  completed_date: "2026-03-31"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 3
---

# Phase 17 Plan 06: Desktop Trade Runtime — Renderer Side Summary

**One-liner:** Three trade execution screens (Lobby, Transfer, Completion) wired into AppShell as an absolute full-screen overlay, with IPC type contracts for the Codex main-process side to implement.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | IPC trade runtime type extensions + InboxScreen prop refactor | `042600d` | ipc-types.ts, InboxScreen.tsx |
| 2 | LobbyScreen, TransferScreen, CompletionScreen | `24600cd` | 3 new screen files |
| 3 | AppShell trade overlay wiring | `b106b13` | AppShell.tsx |

## What Was Built

### ipc-types.ts — TRADE RUNTIME section

Added a clearly marked section with six new exports:
- `TradeLeg` — metadata for one side of a proposal (title, artist, format, quality, notes, fileNameHint, fileSizeBytes)
- `TradeDetail` — full proposal context for LobbyScreen (both legs, counterparty info, expiry)
- `TransferProgressEvent` — fired per-chunk during transfer (bytesReceived, totalBytes, peerConnected)
- `TransferCompleteEvent` — fired once on completion (filePath, sha256, tradeId)
- `LobbyStateEvent` — fired on lease/presence changes (status, bothOnline, leaseHolder)
- `DesktopBridgeTradeRuntime` — interface with 7 methods Codex must implement (getTradeDetail, startTransfer, cancelTransfer, confirmCompletion, openFileInExplorer, onTransferProgress, onTransferComplete, onLobbyStateChanged)

`Window.desktopBridge` type updated to `DesktopBridge & DesktopBridgeTradeRuntime`.

### InboxScreen refactor

Removed `openingTradeId` state and `openTradeFromHandoff` IPC call. Now accepts `onOpenTrade(tradeId)` prop — navigation owned by AppShell. "Open Trade" button calls prop directly (synchronous, no loading state needed).

### LobbyScreen

Props: `{ tradeId, onClose, onTransferStarted }`. Loads `TradeDetail` on mount. Subscribes `onLobbyStateChanged` for presence/lease state. Two-column proposal view (You offer / They offer) with `LegCard` sub-component. Presence dot (`animate-pulse` green when both online). Start Transfer button enabled only when `bothOnline && leaseHolder === "me"`. Calls `startTransfer(tradeId)` then `onTransferStarted()`. Error and loading states included.

### TransferScreen

Props: `{ tradeId, onComplete, onCancel }`. Subscribes both `onTransferProgress` and `onTransferComplete` on mount, unsubscribes on unmount. Progress bar with `#2a2218` track and `#c8914a` fill, width computed from `bytesReceived / totalBytes`. `formatBytes()` helper (B/KB/MB/GB, 1 decimal). Peer-connected indicator. Cancel calls `cancelTransfer(tradeId)` then `onCancel()`. SHA-256 verification note at bottom.

### CompletionScreen

Props: `{ event: TransferCompleteEvent, onDone }`. Large amber checkmark (✓, 48px). File path truncated from left (shows `…/parent/filename`). SHA-256 hash first 12 chars. Five amber star buttons (★/☆). Confirm & Close enabled only when rating selected — calls `confirmCompletion(event.tradeId, rating)` then `onDone()`. Skip rating link calls `onDone()` directly.

### AppShell overlay

Outer container gains `relative` class. Trade state: `activeTradeId`, `tradePhase` (`"lobby" | "transfer" | "completion"`), `completionEvent`. When `activeTradeId` non-null, renders `<div className="absolute inset-0 z-10 bg-[#0d0d0d] flex flex-col">` with the correct screen. Tab shell preserved beneath. Flow: inbox -> lobby -> transfer -> completion -> inbox.

## Deviations from Plan

None — plan executed exactly as written. All IPC type names, screen props, and overlay structure match the plan spec precisely.

## Known Stubs

None. All bridge calls (`getTradeDetail`, `startTransfer`, `cancelTransfer`, `confirmCompletion`, `openFileInExplorer`, `onTransferProgress`, `onTransferComplete`, `onLobbyStateChanged`) are real IPC calls that Codex must implement in the main-process half of 17-06. The UI is wired; the main-process side is intentionally pending Codex implementation.

## Self-Check: PASSED

Files created/exist:
- apps/desktop/src/renderer/src/LobbyScreen.tsx — FOUND
- apps/desktop/src/renderer/src/TransferScreen.tsx — FOUND
- apps/desktop/src/renderer/src/CompletionScreen.tsx — FOUND

Commits:
- 042600d — FOUND (ipc-types + InboxScreen)
- 24600cd — FOUND (three screens)
- b106b13 — FOUND (AppShell overlay)

TypeScript: all errors are pre-existing (../shared/ipc-types module resolution, pre-dates this plan); zero new errors introduced.

No Electron/WebRTC/Node imports in any renderer file: CONFIRMED (grep returned no matches).

## Codex Runtime Follow-Up

The main-process half of 17-06 is now wired in:
- `apps/desktop/src/main/trade-runtime.ts`
- `apps/desktop/src/main/protocol.ts`
- `apps/desktop/src/shared/ipc-types.ts`
- `apps/desktop/src/renderer/src/AppShell.tsx` (small protocol payload typing fix)

### What now works end-to-end

- `TradeHandoffPayload` now accepts `token` and remains backward-compatible with `handoffToken`.
- Protocol payloads raised through `onProtocolPayload(...)` can open the overlay and still be consumed securely when `getTradeDetail()` prepares trade access.
- `getTradeDetail(tradeId)` now hydrates real trade data from Supabase (`trade_requests`, `profiles`, `releases`) instead of returning placeholders.
- `onLobbyStateChanged(...)` now emits lease-backed lobby state from the main process.
- `startTransfer(tradeId)` starts a real desktop runtime flow from the renderer perspective:
  - peer-connected event
  - incremental progress events
  - file materialization under the configured download directory
  - SHA-256 generation
  - completion event
  - receipt queue + reconciliation attempt
- `confirmCompletion(tradeId, rating)` now attempts to persist a desktop review and releases the active lease.

### Validation

- `pnpm --dir apps/desktop exec tsc --noEmit`
- `pnpm --dir apps/desktop build`

### Important limitation

This runtime is currently a **desktop-local transfer implementation**, not the final WebRTC/DataChannel transport yet. It exercises the renderer contract, filesystem flow, receipt reconciliation, rating flow, and protocol handoff without claiming that P2P transport is finished. The next transport-hardening cut should replace the local transfer loop inside `trade-runtime.ts` with the actual WebRTC/DataChannel session layer.
