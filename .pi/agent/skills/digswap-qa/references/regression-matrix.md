# Regression Matrix

## Feature-to-Test Mapping

Maps every DigSwap feature area to its test files and criticality level. Use this to select the right test subset for a regression run.

### P0 — Critical (auth, payments, security)

Failures here block deploys. Always run on every change.

| Feature | Test Files |
|---------|-----------|
| Auth (signup, signin, session) | `tests/integration/auth/signup.test.ts`, `tests/integration/auth/session.test.ts`, `tests/unit/validations/auth.test.ts`, `tests/e2e/auth-flow.spec.ts` |
| Auth bypass prevention | `tests/security/auth-bypass.test.ts` |
| IDOR prevention | `tests/security/idor.test.ts` |
| Input validation | `tests/security/input-validation.test.ts` |
| RLS coverage | `tests/security/rls-coverage.test.ts` |
| Rate limiting | `tests/security/rate-limiting.test.ts` |
| CSP headers | `tests/security/csp.test.ts`, `tests/integration/security/headers.test.ts` |
| Open redirect prevention | `tests/security/open-redirect.test.ts` |
| Pentest regression | `tests/security/pentest-fixes.test.ts` |
| Stripe webhooks | `tests/unit/api/stripe-webhook.test.ts` |
| Entitlements | `tests/unit/entitlements.test.ts` |
| MFA / backup codes | `tests/unit/lib/backup-codes.test.ts` |

### P1 — High (collection, Discogs, trades)

Core features. Run when any related code changes.

| Feature | Test Files |
|---------|-----------|
| Collection CRUD | `tests/integration/collection/add-record.test.ts`, `tests/integration/collection/condition.test.ts`, `tests/integration/collection/sort.test.ts` |
| Collection display | `tests/unit/components/collection/add-record-dialog.test.tsx`, `tests/unit/components/collection/collection-grid.test.tsx` |
| Collection logic | `tests/unit/lib/collection/filters.test.ts`, `tests/unit/lib/collection/rarity.test.ts` |
| Public profiles | `tests/integration/collection/public-profile.test.ts`, `tests/unit/social/public-profile.test.ts` |
| Discogs OAuth | `tests/unit/lib/discogs/oauth.test.ts`, `tests/integration/discogs/callback.test.ts` |
| Discogs import/sync | `tests/unit/lib/discogs/import-worker.test.ts`, `tests/unit/lib/discogs/sync.test.ts`, `tests/integration/discogs/import.test.ts` |
| Discogs disconnect | `tests/integration/discogs/disconnect.test.ts` |
| Discogs UI | `tests/unit/components/discogs/import-progress.test.tsx` |
| Trade lifecycle | `tests/unit/actions/trade-lifecycle.test.ts` |
| Trade messages | `tests/unit/actions/trade-messages.test.ts`, `tests/unit/trades/messages.test.ts` |
| Trade presence | `tests/unit/trades/presence.test.ts` |
| Desktop handoff | `tests/unit/desktop/handoff-token.test.ts` |

### P2 — Medium (social, community, discovery, gamification)

Engagement features. Run when directly changed or weekly full regression.

| Feature | Test Files |
|---------|-----------|
| Follow/unfollow | `tests/unit/social/follow.test.ts`, `tests/unit/social/unfollow.test.ts` |
| Social feed | `tests/unit/social/feed.test.ts` |
| Collection compare | `tests/unit/social/compare.test.ts` |
| Community groups | `tests/unit/community/create-group.test.ts`, `tests/unit/community/membership.test.ts`, `tests/unit/community/visibility.test.ts` |
| Community posts | `tests/unit/community/group-post.test.ts`, `tests/unit/community/group-feed.test.ts` |
| Community reviews | `tests/unit/community/review.test.ts` |
| Community slugs | `tests/unit/community/slugify.test.ts` |
| Discovery / search | `tests/unit/discovery/record-search.test.ts`, `tests/unit/discovery/genre-browse.test.ts`, `tests/unit/discovery/taste-match.test.ts` |
| Gamification | `tests/unit/gamification/badge-awards.test.ts`, `tests/unit/gamification/leaderboard-queries.test.ts`, `tests/unit/gamification/profile-ranking.test.ts`, `tests/unit/gamification/ranking-computation.test.ts` |
| Gems | `tests/unit/gems/gem-badge.test.tsx`, `tests/unit/gems/gem-distribution.test.ts`, `tests/unit/gems/gem-notifications.test.ts`, `tests/unit/gems/gem-tiers.test.ts` |
| Crates | `tests/unit/crates/add-to-crate-popover.test.tsx`, `tests/unit/crates/crates-actions.test.ts` |

### P3 — Low (UI shell, notifications, releases, player)

Run on full regression or when directly touched.

| Feature | Test Files |
|---------|-----------|
| App shell | `tests/unit/components/shell/app-header.test.tsx`, `tests/unit/components/shell/bottom-bar.test.tsx`, `tests/unit/components/shell/empty-state.test.tsx` |
| Notification bell | `tests/unit/components/shell/notification-bell.test.tsx` |
| Email notifications | `tests/unit/notifications/email.test.ts` |
| Notification preferences | `tests/unit/notifications/preferences.test.ts` |
| Wantlist match alerts | `tests/unit/notifications/wantlist-match.test.ts` |
| Release pages | `tests/unit/release/release-queries.test.ts`, `tests/unit/release/release-reviews.test.ts`, `tests/unit/release/youtube-search.test.ts` |
| Audio player | `tests/unit/player/store.test.ts` |
| Supabase clients | `tests/unit/lib/supabase/clients.test.ts` |
| Rate limit lib | `tests/unit/lib/rate-limit.test.ts` |
| Navigation E2E | `tests/e2e/navigation.spec.ts` |
| Pricing E2E | `tests/e2e/pricing.spec.ts` |

## Criticality Definitions

- **P0:** Failure = security breach, data loss, or revenue loss. Blocks deploy.
- **P1:** Failure = core feature broken, users cannot complete primary tasks. Blocks deploy.
- **P2:** Failure = degraded experience but workarounds exist. Deploy with known issue.
- **P3:** Failure = cosmetic or non-critical. Deploy and fix in next cycle.
