# Deploy Checklist

**Date**: ____-__-__
**Branch**: _______________
**Target Environment**: [ ] Production  [ ] Staging  [ ] Preview
**Deployer**: _______________

## Build

| Check | Status | Evidence / Notes |
|-------|--------|------------------|
| `next build` completes | Pass / Fail / Skip | |
| `tsc --noEmit` zero errors | Pass / Fail / Skip | |
| Bundle size within expected range | Pass / Fail / Skip | |
| Sentry source maps uploaded | Pass / Fail / Skip | |

## Tests

| Check | Status | Evidence / Notes |
|-------|--------|------------------|
| `vitest run` all pass | Pass / Fail / Skip | ___ passed, ___ failed, ___ skipped |
| `playwright test` all pass | Pass / Fail / Skip | ___ passed, ___ failed, ___ skipped |
| No skipped tests on changed paths | Pass / Fail / Skip | |

## Lint and Format

| Check | Status | Evidence / Notes |
|-------|--------|------------------|
| `biome check src/ tests/` clean | Pass / Fail / Skip | |
| No formatting drift | Pass / Fail / Skip | |

## Type Check

| Check | Status | Evidence / Notes |
|-------|--------|------------------|
| `tsc --noEmit` zero errors | Pass / Fail / Skip | |
| No new `@ts-ignore` / `@ts-expect-error` | Pass / Fail / Skip | |

## Environment Variables

| Check | Status | Evidence / Notes |
|-------|--------|------------------|
| New vars in Zod schema (`env.ts`) | Pass / Fail / Skip / N/A | |
| New vars in `.env.local.example` | Pass / Fail / Skip / N/A | |
| Vercel Production scope configured | Pass / Fail / Skip | |
| No server secrets in `NEXT_PUBLIC_*` | Pass / Fail / Skip | |
| Stripe live keys only in Production | Pass / Fail / Skip | |

## Database Migrations

| Check | Status | Evidence / Notes |
|-------|--------|------------------|
| Migration tested in branch DB | Pass / Fail / Skip / N/A | |
| Rollback SQL prepared | Pass / Fail / Skip / N/A | |
| No destructive DDL without plan | Pass / Fail / Skip / N/A | |
| RLS enabled on new tables | Pass / Fail / Skip / N/A | |
| Manual backup taken | Pass / Fail / Skip / N/A | |

## DNS and SSL

| Check | Status | Evidence / Notes |
|-------|--------|------------------|
| Domain resolves correctly | Pass / Fail / Skip | |
| SSL valid and auto-renewing | Pass / Fail / Skip | |
| HSTS header present | Pass / Fail / Skip | |

## Monitoring

| Check | Status | Evidence / Notes |
|-------|--------|------------------|
| Sentry release linked | Pass / Fail / Skip | |
| Vercel Analytics active | Pass / Fail / Skip | |
| Alerting rules configured | Pass / Fail / Skip | |

## Decision

- [ ] **GO** -- All checks pass or have acceptable Skip justification
- [ ] **NO-GO** -- Blocking issues listed below

### Blocking Issues

1. _______________
2. _______________

### Notes

_______________
