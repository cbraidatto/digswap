# 16-02 Summary

## Outcome

Added a single server-side entitlement module for subscription and trade quota decisions.

## Delivered

- `apps/web/src/lib/entitlements.ts`
  - Re-exports `SubscriptionPlan` from `@/lib/stripe`.
  - Exposes:
    - `FREE_TRADE_LIMIT`
    - `isPremium(plan)`
    - `getUserSubscription(userId)`
    - `canInitiateTrade(userId)`
    - `incrementTradeCount(userId)`
    - `getQuotaStatus(userId)`
  - Uses `subscriptions.plan` as the source of truth.
  - Applies lazy 30-day reset for `tradesThisMonth`.
  - Treats missing subscription rows as free-tier fallback.

## Notes

- `incrementTradeCount` is atomic on `trades_this_month` via SQL increment.
- The repo currently does not have a tracked `createTradeRequest` server action or `apps/web/src/actions/trades.ts` path to wire the entitlement gate into. That integration needs either:
  - the actual trade-creation path to be merged into the repo, or
  - a follow-up decision on where trade creation lives now post-desktop.

## Verification

- `apps/web/src/lib/entitlements.ts` passed isolated typecheck with its subscription/db dependencies.
