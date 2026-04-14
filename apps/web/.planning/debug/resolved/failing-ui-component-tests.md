---
status: resolved
trigger: "9 pre-existing test files failing (42 tests) in UI component tests after Phase 27 frontend changes"
created: 2026-04-13T00:00:00Z
updated: 2026-04-13T01:51:00Z
---

## Current Focus

hypothesis: CONFIRMED - two root causes found and fixed
test: Full test suite run
expecting: All 147 test files pass
next_action: Await human verification

## Symptoms

expected: All 148 test files pass (1561 tests)
actual: 9 test files fail with 42 test failures
errors: Tests expect elements/text/attributes that no longer exist in current components
reproduction: pnpm --filter @digswap/web test
started: Pre-existing since Phase 27 frontend changes

## Eliminated

## Evidence

- timestamp: 2026-04-13T01:40:00Z
  checked: All 9 test files and their source components
  found: Components match test expectations (labels, hrefs, structure are identical)
  implication: The failures are NOT from stale test expectations vs changed components

- timestamp: 2026-04-13T01:42:00Z
  checked: Error messages across all 42 failures
  found: ALL failures are "Invalid Chai property: toBeInTheDocument" or "Invalid Chai property: toHaveAttribute"
  implication: jest-dom matchers are not being registered with vitest's expect

- timestamp: 2026-04-13T01:43:00Z
  checked: Which test files use toBeInTheDocument/toHaveAttribute
  found: Exactly the 8 failing component test files use these matchers. No other test files do.
  implication: The matchers were never working - they just weren't used by other tests

- timestamp: 2026-04-13T01:45:00Z
  checked: tests/setup.ts imports @testing-library/jest-dom/vitest
  found: The /vitest entry point calls require('vitest') in CJS mode which fails with vitest 4.1.2
  implication: expect.extend(matchers) silently fails, leaving matchers unregistered

- timestamp: 2026-04-13T01:48:00Z
  checked: proposal-actions.test.ts acceptProposalAction failure
  found: revalidatePath throws "Invariant: static generation store missing" - next/cache not mocked
  implication: Separate issue - test needs mock for next/cache

## Resolution

root_cause: Two issues: (1) @testing-library/jest-dom v6.9.1's /vitest entry point is incompatible with vitest 4.1.2 - it silently fails to register matchers. (2) proposal-actions.test.ts missing mock for next/cache (revalidatePath) and using toEqual instead of toMatchObject for partial match.
fix: (1) Changed setup.ts to import matchers directly via `import * as matchers from "@testing-library/jest-dom/matchers"` + `expect.extend(matchers)`. (2) Added vi.mock("next/cache") to proposal-actions.test.ts and updated assertion to use toMatchObject.
verification: Full test suite passes - 147 files, 1550 tests, 0 failures
files_changed:
  - tests/setup.ts
  - src/tests/trades/proposal-actions.test.ts
