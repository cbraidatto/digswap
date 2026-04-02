# 16-05 Summary

## Outcome

Added unit coverage for the monetization entitlement layer and the Stripe webhook route.

## Delivered

- `apps/web/tests/unit/entitlements.test.ts`
  - Covers:
    - free user under limit
    - free user at limit
    - premium user unlimited access
    - null subscription row
    - lazy 30-day reset
    - free-tier increment
    - premium no-op increment
- `apps/web/tests/unit/api/stripe-webhook.test.ts`
  - Covers:
    - invalid signature
    - `checkout.session.completed`
    - `customer.subscription.deleted`
    - `invoice.payment_failed`
    - unknown event passthrough

## Notes

- `createTradeRequest` integration is still absent from tracked web code, so the `TRADE_LIMIT_REACHED` action-level test remains blocked until that write path exists in the repo.
- Playwright `/pricing` coverage is intentionally left to the parallel UI track.

## Verification

- `pnpm --dir apps/web exec vitest run tests/unit/entitlements.test.ts tests/unit/api/stripe-webhook.test.ts`
