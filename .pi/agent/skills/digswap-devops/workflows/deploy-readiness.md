# Workflow: Deploy Readiness

## Objective

Comprehensive pre-deployment checklist ensuring DigSwap is safe to ship. Run this before every production deployment or when preparing a release candidate.

## Read First

Load all references before running this workflow:
- [references/environment-strategy.md](../references/environment-strategy.md)
- [references/vercel-deploy-patterns.md](../references/vercel-deploy-patterns.md)
- [references/supabase-production.md](../references/supabase-production.md)
- [references/monitoring-observability.md](../references/monitoring-observability.md)

## Checklist

### 1. Build

- [ ] `cd apps/web && npm run build` completes without errors
- [ ] No TypeScript errors: `npm run typecheck` (runs `tsc --noEmit`)
- [ ] Build output size is reasonable (check `.next/` bundle analysis)
- [ ] Sentry source map upload succeeds (requires `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`)

### 2. Tests

- [ ] Unit and integration tests pass: `npm run test` (runs `vitest run`)
- [ ] E2E tests pass: `npm run test:e2e` (runs `playwright test`)
- [ ] No skipped tests that cover the changed code paths

### 3. Lint and Format

- [ ] Biome check passes: `npm run lint` (runs `biome check src/ tests/`)
- [ ] No formatting drift: `biome format --check src/ tests/`

### 4. Type Check

- [ ] `npm run typecheck` passes with zero errors
- [ ] No `@ts-ignore` or `@ts-expect-error` added in this release

### 5. Environment Variables

- [ ] All new env vars added to Zod schema in `apps/web/src/lib/env.ts`
- [ ] All new env vars added to `apps/web/.env.local.example`
- [ ] All new env vars configured in Vercel for Production scope
- [ ] Production-only vars (`STRIPE_SECRET_KEY`, `HANDOFF_HMAC_SECRET`) use production values
- [ ] No server secrets accidentally prefixed with `NEXT_PUBLIC_`
- [ ] Stripe live keys (`sk_live_`) scoped ONLY to Production in Vercel

### 6. Database Migrations

- [ ] New migrations tested in Supabase branch database
- [ ] Rollback SQL prepared for each migration
- [ ] No destructive DDL (DROP COLUMN/TABLE) without two-phase rollout plan
- [ ] RLS enabled on all new tables
- [ ] Manual backup taken before applying production migration

### 7. DNS and SSL

- [ ] Custom domain resolves correctly
- [ ] SSL certificate is valid and auto-renewing
- [ ] HSTS header active (verified in `next.config.ts`)

### 8. Monitoring

- [ ] Sentry release created and linked to this deploy
- [ ] Vercel Analytics enabled
- [ ] Alerting rules configured per [monitoring-observability.md](../references/monitoring-observability.md)

## Go/No-Go Criteria

**GO** if all of the following are true:
- Build, tests, lint, and typecheck all pass
- All env vars are correctly scoped
- Migrations tested in staging and rollback SQL is ready
- Monitoring is active

**NO-GO** if any of the following are true:
- Any test failure in changed code paths
- Missing env var in Vercel Production scope
- Untested migration
- Sentry DSN not configured for production

## Deliverable

Output a completed deploy checklist using the [deploy-checklist template](../templates/deploy-checklist.md) with Pass/Fail/Skip status for each item and evidence notes.
