# E2E Patterns for DigSwap

## Playwright Configuration

- **Config:** `apps/web/playwright.config.ts`
- **Test dir:** `tests/e2e/`
- **Browser:** Chromium only (solo developer — speed over cross-browser coverage)
- **Base URL:** `http://localhost:3000`
- **Dev server:** Started automatically via `pnpm dev` with 120s timeout
- **Retries:** 2 in CI, 0 locally
- **Trace:** Captured on first retry for debugging failures
- **Reporter:** HTML report in `playwright-report/`

## Auth Flow Testing

DigSwap uses Supabase Auth. E2E auth strategies:

1. **Test credentials approach:** Create a test user in Supabase dashboard, use fixed email/password in E2E specs. Store in `.env.test` (never committed).
2. **Mock auth approach:** Intercept Supabase auth endpoints with `page.route()` to return canned session tokens. Faster but less realistic.
3. **Current spec:** `auth-flow.spec.ts` tests the signin/signup pages and redirects.

Pattern for authenticated tests:
```typescript
// Login helper — reuse across specs
async function loginAsTestUser(page: Page) {
  await page.goto("/signin");
  await page.fill('[name="email"]', process.env.TEST_USER_EMAIL!);
  await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL("/colecao");
}
```

## Discogs Import Testing

- Mock the Discogs OAuth redirect with `page.route("**/discogs.com/oauth/**", ...)` to simulate callback
- Seed a test collection response that returns a small set (5-10 records) to keep E2E fast
- Assert: import progress bar appears, records populate collection grid, count updates

## Stripe Checkout Testing

- Use Stripe test mode (`pk_test_*` / `sk_test_*`) — never production keys in E2E
- Test card numbers: `4242424242424242` (success), `4000000000000002` (decline)
- Mock Stripe Checkout redirect with `page.route()` or use Stripe's test clock for subscription flows
- Current spec: `pricing.spec.ts` tests plan display and checkout redirect

## WebRTC / PeerJS Testing

WebRTC cannot be fully tested in E2E without real browser-to-browser connections. Strategy:

- **Unit/integration layer:** Mock PeerJS entirely — test handoff token generation, chunk logic, connection state machine
- **E2E layer:** Test the UI around peer connections — "Waiting for peer" state, error display, retry button
- **Manual QA:** Real peer-to-peer transfer tested manually between two browser tabs before deploy

## Database Seeding for E2E

- Use Supabase admin client (`service_role_key`) in a setup script to insert test data
- Seed: test user, small collection (5 records), wantlist entries, one pending trade
- Teardown: delete seeded data after E2E run to keep the test database clean
- Keep seed data minimal — E2E tests should be fast

## Screenshot Comparison

- Use `expect(page).toHaveScreenshot()` for visual regression on key pages
- Store baseline screenshots in `tests/e2e/screenshots/` (committed to git)
- Pages worth snapshotting: homepage, collection grid, profile page, pricing page
- Tolerance: allow 0.5% pixel diff to handle anti-aliasing differences across OS

## Cross-Browser Considerations

Current config runs Chromium only for speed. When ready to expand:

```typescript
projects: [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "webkit", use: { ...devices["Desktop Safari"] } },
],
```

Add cross-browser runs in CI only (not local dev) to avoid slowing the solo workflow.
