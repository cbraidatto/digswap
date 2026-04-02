---
phase: 16-monetization
plan: 16-03
subsystem: pricing-billing-ui
tags: [pricing, billing, stripe, subscription, settings]

requires: [16-01]
provides:
  - "/pricing public page with Free/Premium plan cards and monthly/annual toggle"
  - "/settings/billing protected page with quota bar, renewal date, and manage/upgrade CTA"
affects: [16-04, 16-05]

tech-stack:
  added: []
  patterns: [server-component-auth-state, client-billing-toggle, stripe-checkout-redirect, stripe-portal-redirect]

key-files:
  created:
    - "apps/web/src/app/pricing/page.tsx"
    - "apps/web/src/app/pricing/_components/PricingCards.tsx"
    - "apps/web/src/app/(protected)/settings/billing/page.tsx"
    - "apps/web/src/app/(protected)/settings/billing/_components/ManageButton.tsx"
    - ".planning/phases/16-monetization/16-03-SUMMARY.md"
  modified: []
  deleted: []

key-decisions:
  - "currentPlan defaults to 'free' (not null) when user is authenticated but has no subscription row — prevents middleware redirect loop"
  - "PricingCards is a client component; page.tsx is a server component that passes price IDs and currentPlan down"
  - "ManageButton is a client component to allow dynamic import of createPortalSession action"
  - "Billing page reads currentPeriodEnd directly from subscriptions table via Drizzle query"

patterns-established:
  - "Server component reads auth + plan state; client component owns billing action triggers"
  - "?success=true query param on billing page shows success banner after Stripe redirect"

requirements-completed: [MON-03]

completed: 2026-03-31
---

# Phase 16 Plan 03 Summary

## Outcome

Pricing page and billing management UI fully implemented and verified end-to-end with real Stripe test keys.

## Delivered

- `apps/web/src/app/pricing/page.tsx` — server component, reads current plan, passes to `PricingCards`
- `apps/web/src/app/pricing/_components/PricingCards.tsx` — client component with monthly/annual toggle; calls `createCheckoutSession` or `createPortalSession` based on current plan
- `apps/web/src/app/(protected)/settings/billing/page.tsx` — shows plan status, trade quota progress bar (free), renewal date (premium), upgrade/manage CTAs, success banner on `?success=true`
- `apps/web/src/app/(protected)/settings/billing/_components/ManageButton.tsx` — client component that dynamically imports and calls `createPortalSession`

## Key Fix

When an authenticated user has no subscription row, `getCurrentPlan()` returns `null`. Original code set `currentPlan = null`, which caused the upgrade CTA to render as `<a href="/signup">` — and Next.js middleware redirected authenticated users from `/signup` back to `/feed`. Fixed with `?? "free"` fallback.

## Verification

Full Stripe test flow verified:
1. Free user clicks "Upgrade to Premium" → Stripe Checkout opens
2. Webhook processes `checkout.session.completed` → `subscriptions` table updated
3. Billing page reloads with PREMIUM badge and renewal date
