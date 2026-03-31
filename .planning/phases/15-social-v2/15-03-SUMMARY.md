# 15-03 Summary

## Outcome

Added the backend presence read path for Social V2 without letting the web app mutate desktop runtime state.

## Delivered

- `supabase/migrations/20260401_trade_presence_rpc.sql`
  - Adds `public.get_trade_presence(p_trade_id uuid)` as a security-definer RPC.
  - Returns both trade participants with `is_active` and `last_heartbeat_at`.
  - Keeps `trade_runtime_sessions` itself read-blocked behind RLS.
- `apps/web/src/lib/trades/presence.ts`
  - Adds `deriveTradePresence(tradeId, userId)` and typed presence snapshot/state helpers.
  - Resolves `both_online`, `me_only`, `counterparty_only`, or `neither`.
- `apps/web/src/actions/trade-presence.ts`
  - Adds an authenticated server action `getTradePresence(tradeId)` for client polling or refresh flows.

## Notes

- Presence is read-only and derived from `trade_runtime_sessions`; the web app still never acquires/releases leases.
- The RPC returns both participants even when neither has an active desktop session, which keeps the helper deterministic for UI consumers.
- `last_heartbeat_at` is preserved in the helper output so the renderer can show “last seen” copy if needed.

## Verification

- Global `apps/web` typecheck still has unrelated pre-existing failures outside this write set.
- The new presence files were typechecked in isolation with a temporary `tsconfig`.
