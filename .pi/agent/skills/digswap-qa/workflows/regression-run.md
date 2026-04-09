# Regression Run

## Objective

Smart test selection based on changed files. Run the minimum set of tests that covers the blast radius of a change, plus mandatory security and auth tests that always run.

## Always Run (regardless of changes)

These tests guard invariants that must never regress:

```bash
# Security suite — 8 test files, ~2 minutes
pnpm vitest run tests/security/

# Auth integration — 2 test files
pnpm vitest run tests/integration/auth/

# Auth validation — 1 test file
pnpm vitest run tests/unit/validations/auth.test.ts
```

## Change Detection

Identify impacted features from the git diff:

```bash
git diff --name-only HEAD~1
# or for a branch:
git diff --name-only main...HEAD
```

## File-to-Test Mapping

| Changed Path Pattern | Run Tests |
|---------------------|-----------|
| `src/actions/auth.*` | `tests/integration/auth/`, `tests/security/auth-bypass.test.ts` |
| `src/actions/collection.*` | `tests/integration/collection/` |
| `src/actions/discogs.*` | `tests/integration/discogs/`, `tests/unit/lib/discogs/` |
| `src/actions/trade*` | `tests/unit/actions/trade-*.test.ts`, `tests/unit/trades/` |
| `src/actions/community.*` | `tests/unit/community/` |
| `src/actions/social.*` | `tests/unit/social/` |
| `src/actions/stripe.*` | `tests/unit/api/stripe-webhook.test.ts`, `tests/unit/entitlements.test.ts` |
| `src/actions/gamification.*` | `tests/unit/gamification/` |
| `src/actions/notifications.*` | `tests/unit/notifications/` |
| `src/actions/desktop.*` | `tests/unit/desktop/` |
| `src/actions/crates.*` | `tests/unit/crates/` |
| `src/actions/search.*` or `src/actions/discovery.*` | `tests/unit/discovery/` |
| `src/actions/release.*` | `tests/unit/release/` |
| `src/lib/collection/` | `tests/unit/lib/collection/`, `tests/integration/collection/` |
| `src/lib/discogs/` | `tests/unit/lib/discogs/`, `tests/integration/discogs/` |
| `src/lib/rate-limit*` | `tests/unit/lib/rate-limit.test.ts`, `tests/security/rate-limiting.test.ts` |
| `src/lib/supabase/` | `tests/unit/lib/supabase/clients.test.ts` |
| `src/components/collection/` | `tests/unit/components/collection/` |
| `src/components/shell/` | `tests/unit/components/shell/` |
| `src/components/discogs/` | `tests/unit/components/discogs/` |
| `src/app/(auth)/` | `tests/integration/auth/`, `tests/e2e/auth-flow.spec.ts` |
| `src/app/(protected)/` | `tests/e2e/navigation.spec.ts` |
| `middleware.ts` | `tests/security/`, `tests/integration/auth/`, `tests/e2e/auth-flow.spec.ts` |
| `src/lib/db/schema/` | Run full suite (schema changes affect everything) |

## Execution

```bash
# 1. Always-run tests
pnpm vitest run tests/security/ tests/integration/auth/ tests/unit/validations/auth.test.ts

# 2. Impacted feature tests (example: collection change)
pnpm vitest run tests/integration/collection/ tests/unit/lib/collection/

# 3. If any E2E spec is in the impacted set
pnpm playwright test tests/e2e/auth-flow.spec.ts
```

## When to Run Full Suite Instead

- Schema changes (`src/lib/db/schema/`)
- Middleware changes (`middleware.ts`)
- Vitest config changes (`vitest.config.ts`)
- Package updates (`package.json`, `pnpm-lock.yaml`)
- More than 10 files changed
- Pre-deploy (use [pre-deploy-validation.md](./pre-deploy-validation.md) instead)
