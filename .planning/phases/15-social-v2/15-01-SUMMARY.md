# 15-01 Summary: Trade Messaging Data Layer

## Outcome
- Added the data-layer foundation for trade-scoped messaging on the web side.
- Read state now lives directly on `trade_requests`, not in a separate receipts/read table.
- Server-side helpers and actions are in place for thread listing, thread detail, unread counts, sending, and marking read.

## Delivered
- Added [20260401_trade_messages.sql](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/supabase/migrations/20260401_trade_messages.sql) with:
  - `trade_messages`
  - `requester_last_read_at` / `provider_last_read_at` on `trade_requests`
  - participant-only RLS for select/insert
  - `kind in ('user', 'system')`
  - `body` length check `1..2000`
- Extended [trades.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/apps/web/src/lib/db/schema/trades.ts) so the Drizzle schema matches the new trade messaging tables/columns.
- Added [messages.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/apps/web/src/lib/trades/messages.ts) with:
  - `getTradeParticipantContext`
  - `listTradeThreads`
  - `getTradeThread`
  - `getTradeUnreadCount`
- Added [trade-messages.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/apps/web/src/actions/trade-messages.ts) with:
  - `sendTradeMessage`
  - `markTradeThreadRead`
  - auth guard
  - body validation
  - per-user-per-trade message rate limit check over the last 60 seconds
  - cache revalidation for `/trades` and `/trades/[id]`

## Notes
- Unread counts exclude the caller's own messages, so sending a message does not create false unread state for the sender.
- `sendTradeMessage` updates the sender's own last-read column and `updated_at` to keep thread ordering aligned with the latest message activity.
- The query helpers intentionally include counterparty metadata and last-message summaries so `15-02` can build the inbox/detail UI without reshaping the data layer again.

## Verification
- `pnpm --dir apps/web exec tsc -p %TEMP%\\digswap-15-01-tsconfig.json --noEmit` via a temporary isolated tsconfig scoped to the new 15-01 files

## Known Repo State
- `pnpm --dir apps/web exec tsc --noEmit` still fails because of unrelated pre-existing web type errors outside the 15-01 write set. The new messaging files were verified in isolation to avoid mixing this plan with older debt.
