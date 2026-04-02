---
phase: 16-monetization
plan: 16-04
subsystem: premium-gates
tags: [quota, banner, modal, badge, premium, entitlements]

requires: [16-02, 16-03]
provides:
  - "TradeQuotaBanner on /trades showing usage counter and at-limit warning"
  - "TradeLimitModal shown when createTradeRequest returns TRADE_LIMIT_REACHED"
  - "PremiumBadge on profile headers and sidebar for premium subscribers"
affects: [16-05]

tech-stack:
  added: []
  patterns: [server-component-quota-fetch, client-modal-on-error, premium-badge-chip]

key-files:
  created:
    - "apps/web/src/components/trades/TradeQuotaBanner.tsx"
    - "apps/web/src/components/trades/TradeLimitModal.tsx"
    - "apps/web/src/components/ui/PremiumBadge.tsx"
    - ".planning/phases/16-monetization/16-04-SUMMARY.md"
  modified:
    - "apps/web/src/app/(protected)/settings/billing/page.tsx"
    - "apps/web/src/components/shell/sidebar.tsx"
    - "apps/web/src/app/perfil/[username]/page.tsx"
    - "apps/web/src/app/perfil/[username]/_components/profile-header.tsx"
    - "apps/web/src/components/shell/app-shell.tsx"
    - "apps/web/src/app/(protected)/layout.tsx"
  deleted: []

key-decisions:
  - "TradeQuotaBanner is null for premium users — zero rendering cost"
  - "TradeLimitModal triggers on TRADE_LIMIT_REACHED error from createTradeRequest"
  - "PremiumBadge added to both sidebar (below rank label) and profile header (next to displayName)"
  - "subscriptionTier fetched in protected layout and passed through AppShell → Sidebar"

patterns-established:
  - "Premium surfaces gated at server component level; client gets final rendered state"
  - "Badge chip uses amber/10 background with amber/30 border — subtle, not dominant"

requirements-completed: [MON-04]

completed: 2026-03-31
---

# Phase 16 Plan 04 Summary

## Outcome

Premium surface gates fully wired: quota counter visible for free users, hard block modal on limit, PREMIUM badge on profiles and sidebar.

## Delivered

- `TradeQuotaBanner` — null for premium, info strip under limit, amber warning at limit with upgrade CTA
- `TradeLimitModal` — modal overlay triggered when trade initiation hits `TRADE_LIMIT_REACHED`; links to `/pricing`
- `PremiumBadge` — small amber chip `PREMIUM` with hover tooltip; added to profile header and sidebar rank label
- `subscriptionTier` wired from DB query in protected layout → AppShell → Sidebar → ProfileHeader
