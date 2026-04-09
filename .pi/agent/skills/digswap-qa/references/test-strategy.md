# Test Strategy

## Test Pyramid for DigSwap

The suite follows a strict pyramid: fast unit tests at the base, integration tests in the middle, Playwright E2E at the top. Current state: 73 test files, 646+ passing tests, primarily unit and integration.

### Unit Tests (Vitest, `tests/unit/`)

**Environment:** jsdom for components, node-compatible for server logic.
**Speed target:** Full unit suite < 30 seconds.

What to test at this layer:
- Pure functions: validation schemas (`validations/auth.test.ts`), utility functions, rate-limit logic
- Zustand stores: state transitions, selector behavior (`player/store.test.ts`)
- Component rendering: correct props, conditional display, user interactions (`components/shell/`, `components/collection/`)
- Business logic: ranking computation, gem distribution, rarity scoring, filter logic
- Action logic: trade lifecycle, message formatting, notification triggers (with mocked DB)

### Integration Tests (Vitest + mocks, `tests/integration/`)

**Environment:** jsdom with vi.mock for Supabase, Drizzle, external APIs.
**Speed target:** Full integration suite < 60 seconds.

What to test at this layer:
- Server actions: auth signup/session, collection add/sort/condition, Discogs callback/import/disconnect
- API routes: Stripe webhook processing, security header enforcement
- Multi-step flows: Discogs OAuth complete flow, collection import pipeline, trade state machine
- Database interaction patterns: ensure correct queries are built (mock Drizzle, assert calls)
- Auth guard behavior: verify actions reject unauthenticated or unauthorized callers

### E2E Tests (Playwright, `tests/e2e/`)

**Environment:** Chromium browser against `localhost:3000` dev server.
**Speed target:** E2E suite < 5 minutes.

What to test at this layer:
- Full user journeys: signup -> verify email -> connect Discogs -> browse collection
- Auth flow: signin, signout, 2FA prompt, session persistence across navigation
- Navigation: all main routes accessible, bottom bar works, deep links resolve
- Pricing page: plan display, Stripe checkout redirect
- Visual regressions: screenshot comparison for key pages (when configured)

### Currently: 3 E2E specs — `auth-flow.spec.ts`, `navigation.spec.ts`, `pricing.spec.ts`

## Coverage Targets

**Measured by:** V8 provider via `vitest --coverage`
**Scope:** `src/actions/**` and `src/lib/**` (excluding `src/lib/db/schema/**`, `src/lib/supabase/**`)

| Area | Target | Rationale |
|------|--------|-----------|
| `src/actions/` | 80% lines, 80% branches | Every action is a user-facing mutation — high defect cost |
| `src/lib/` | 80% lines, 80% branches | Shared logic powering actions and components |
| Auth flows | 100% branches | Broken auth = broken app |
| Stripe webhooks | 100% branches | Broken billing = lost revenue |
| Discogs import | 100% branches | Primary data pipeline, rate-limit sensitive |

## Mocking Strategy

All external services are mocked. No test hits the network.

- **Supabase:** `vi.mock("@/lib/supabase/server")` — return mock client with chainable query builder
- **Drizzle:** `vi.mock("@/lib/db")` — mock `db.select()`, `db.insert()`, `db.update()`, `db.delete()` chains
- **Discogs API:** `vi.mock("@/lib/discogs/client")` — return canned responses for OAuth and collection endpoints
- **Stripe:** `vi.mock("stripe")` — mock webhook signature verification and API calls
- **Resend:** `vi.mock("resend")` — mock email send, assert templates and recipients
- **`server-only`:** Stubbed via `tests/stubs/server-only.ts` (empty module) to avoid import errors in jsdom

## Test Environment

- **Config:** `vitest.config.ts` at `apps/web/` root
- **Setup file:** `tests/setup.ts` — global mocks and environment variables
- **Env vars:** All test env vars set in `vitest.config.ts` `test.env` block (Supabase, Discogs, import worker)
- **Aliases:** `@` resolves to `./src`, `server-only` resolves to stub
- **Globals:** `true` — `describe`, `it`, `expect`, `vi` available without import
