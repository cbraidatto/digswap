# Pre-Deploy Validation

## Objective

Full validation pipeline before any deploy to production. Every step must pass. One failure blocks the deploy.

## Prerequisites

- All code committed and pushed to the deploy branch
- No unresolved merge conflicts
- `.env.local` and `.env.production` verified (no test values in production)

## Validation Steps

Run sequentially. Stop on first failure.

### Step 1: Type Check

```bash
cd apps/web && pnpm tsc --noEmit
```

**Pass criteria:** 0 type errors.
**Common failures:** Missing types after schema changes, unused imports flagged as errors.

### Step 2: Lint and Format

```bash
cd apps/web && pnpm biome check .
```

**Pass criteria:** 0 lint errors, 0 format violations.
**Quick fix:** `pnpm biome check --write .` to auto-fix.

### Step 3: Unit and Integration Tests

```bash
cd apps/web && pnpm vitest run
```

**Pass criteria:** 0 test failures, 0 test errors. All 646+ tests green.
**If flaky:** Investigate immediately. A flaky test is a bug in the test, not a "retry and hope" situation.

### Step 4: Coverage Check

```bash
cd apps/web && pnpm vitest run --coverage
```

**Pass criteria:** Coverage does not regress below the previous deploy baseline.
- `src/actions/` >= 80% lines and branches
- `src/lib/` >= 80% lines and branches
- Compare `coverage/coverage-summary.json` against previous report

### Step 5: Production Build

```bash
cd apps/web && pnpm next build
```

**Pass criteria:** Build succeeds with 0 errors. No new warnings about deprecated APIs.
**Performance check:** Total build output size should not increase more than 10% from previous deploy. Check the "Route (app)" table in build output.

### Step 6: E2E Tests (conditional)

```bash
cd apps/web && pnpm playwright test
```

**Run when:** E2E specs exist for features changed in this deploy.
**Pass criteria:** 0 test failures across all specs.
**Skip when:** No E2E-relevant changes (pure backend logic, schema-only changes).

## Go / No-Go Checklist

| Check | Required | Status |
|-------|----------|--------|
| `tsc --noEmit` passes | Yes | |
| `biome check` passes | Yes | |
| `vitest run` all green | Yes | |
| Coverage >= baseline | Yes | |
| `next build` succeeds | Yes | |
| Build size < +10% | Yes | |
| E2E green (if applicable) | Conditional | |
| No unresolved P0/P1 bugs | Yes | |
| Env vars verified | Yes | |

**All "Yes" items must pass. Any failure = no deploy.**
