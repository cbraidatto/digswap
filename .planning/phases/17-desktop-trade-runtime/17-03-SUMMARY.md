# 17-03 Summary: Lease RPC + Heartbeat + Reconciliation + ICE Telemetry

## Outcome
- Added the desktop runtime authority layer for DigSwap Desktop.
- The Electron main process now owns lease acquisition, 15s heartbeat, lease release, handoff token exchange, and local receipt reconciliation retries.
- The renderer inbox is no longer backed by placeholders: `getPendingTrades()` now reads real trade rows through Supabase RPC.

## Delivered
- Added runtime authority tables + RPC migration in `supabase/migrations/20260331_desktop_trade_runtime.sql`.
- Added Drizzle schema entries for `trade_runtime_sessions` and `trade_transfer_receipts` in `apps/web/src/lib/db/schema/trades.ts`.
- Added authenticated handoff-token consumption route in `apps/web/src/app/api/desktop/handoff/consume/route.ts`.
- Added `DesktopTradeRuntime` in `apps/desktop/src/main/trade-runtime.ts`.
- Extended desktop config/session/auth plumbing for:
  - `siteUrl`
  - `desktopVersionCode`
  - persistent `deviceId`
  - local pending transfer receipts
  - reusable auth session listeners and access-token retrieval
- Replaced IPC stubs with runtime-backed implementations for:
  - `getPendingTrades`
  - `openTradeFromHandoff`
  - trade runtime event channels
- Extended preload so the current renderer contract is fully present at runtime.
- Fixed merged renderer import paths so the desktop workspace typecheck is green again.

## Verification
- `pnpm --dir apps/desktop exec tsc --noEmit`
- `pnpm --dir apps/desktop build`

## Notes
- `PendingTrade.handoffToken` remains a compatibility shim that currently carries `tradeId` for inbox-originated desktop opens.
- `getTradeDetail()` now acquires the lease so the integrated renderer path works even though the inbox overlay opens by `tradeId` directly.
- Transfer receipts record ICE candidate type and can be retried idempotently once Supabase is reachable again.

## Deferred To 17-06
- Full lobby detail hydration from real trade proposal data.
- Live presence/both-online state beyond lease ownership.
- Actual transfer orchestration, progress emission, file finalization, and completion review submission.
