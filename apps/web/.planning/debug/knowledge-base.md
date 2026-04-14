# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## failing-ui-component-tests — jest-dom matchers not registered with vitest 4.x
- **Date:** 2026-04-13
- **Error patterns:** Invalid Chai property, toBeInTheDocument, toHaveAttribute, jest-dom, vitest, matchers
- **Root cause:** @testing-library/jest-dom v6.9.1's /vitest entry point is incompatible with vitest 4.1.2. The CJS require('vitest') call silently fails, leaving matchers like toBeInTheDocument unregistered. Secondary: missing next/cache mock for revalidatePath in test context.
- **Fix:** Changed setup.ts from `import "@testing-library/jest-dom/vitest"` to `import * as matchers from "@testing-library/jest-dom/matchers"` + `expect.extend(matchers)`. Added vi.mock("next/cache") to proposal-actions.test.ts.
- **Files changed:** apps/web/tests/setup.ts, apps/web/src/tests/trades/proposal-actions.test.ts
---

