# 16-01 Summary

## Outcome

Wired the Stripe server-side foundation for monetization: checkout/portal actions, webhook sync, subscriptions schema migration, and a signup trigger that seeds free-plan rows.

## Delivered

- `apps/web/src/lib/stripe.ts`
  - Lazy Stripe client creation.
  - Shared helpers for site URL, Stripe price IDs, plan derivation, and timestamp conversion.
- `apps/web/src/actions/stripe.ts`
  - `createCheckoutSession(priceId)`
  - `createPortalSession()`
  - Authenticated, returns redirect URLs, creates Stripe customer on demand.
- `apps/web/src/app/api/stripe/webhook/route.ts`
  - Verifies Stripe signatures from raw request text.
  - Handles:
    - `checkout.session.completed`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
    - `invoice.payment_failed`
  - Syncs `subscriptions` and denormalized `profiles.subscription_tier` via service-role Supabase client.
- `supabase/migrations/20260402_subscriptions_schema.sql`
  - Creates `public.subscriptions` with RLS and service-role write policies.
- `supabase/migrations/20260403_subscription_init_trigger.sql`
  - Seeds a free subscription row on new `auth.users` inserts.
- `.env.example`
  - Documents required Stripe env vars alongside existing app envs.

## Notes

- The repo had Drizzle schema for `subscriptions` but no matching SQL migration, so that drift was corrected as part of this plan.
- App Router route handlers already allow raw-body verification via `request.text()`, so there is no extra body-parser config to disable.

## Verification

- Pending local verification after Stripe envs are filled:
  - checkout session URL creation
  - portal session URL creation
  - signed webhook replay against `/api/stripe/webhook`
