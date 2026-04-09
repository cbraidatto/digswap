# Production Readiness Review (PRR) Report

## Service Information
| Field | Value |
|-------|-------|
| Service | DigSwap Web |
| Date | 2026-04-09 |
| Reviewer | SRE Lead (automated audit) |
| Target Environment | Vercel + Supabase + Upstash |
| Branch | milestone/M008 |
| Commit | bb53575 |

## Executive Summary

DigSwap demonstrates strong security posture and well-architected rate limiting with graceful degradation, but has **critical observability gaps and missing operational infrastructure** that will blind the team during the first production incident. The absence of a health endpoint, Vercel Analytics, structured logging, and Sentry source map upload means the service can deploy but cannot be effectively monitored or debugged. Additionally, 6 env vars bypass centralized validation (STRIPE_SECRET_KEY, NEXT_PUBLIC_SENTRY_DSN, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN, NEXT_PUBLIC_SUPABASE_ANON_KEY in middleware), creating a class of silent misconfiguration failures in production.

**Recommendation: NOT READY for production.** 4 blockers must be resolved. Estimated effort: 1-2 days.

---

## 1. Reliability

| Check | Evidence | Status |
|-------|----------|--------|
| Health endpoint exists | Grep for `api/health` across codebase returned zero matches. No `/api/health` route file exists. | :x: |
| Deep health check (DB + Redis + Auth) | No health endpoint exists at all. Incident runbook references `/api/health/deep` but the route does not exist. | :x: |
| Error boundaries configured | `src/app/global-error.tsx` catches root-level errors with Sentry reporting. `src/app/error.tsx` catches route-level errors with Sentry reporting and user-friendly UI. Both call `Sentry.captureException`. | :white_check_mark: |
| Rollback plan documented | Incident response doc at `.pi/agent/skills/digswap-sre/references/incident-response.md` includes a rollback decision tree: "Rollback immediately via Vercel dashboard" for S1/S2. Runbooks reference the same. | :white_check_mark: |
| Database migrations reversible | Migrations are forward-only SQL files in `supabase/migrations/`. 13 of 20+ migrations contain DROP statements (policy replacements, function replacements), but none include paired down-migration files. Drizzle Kit is installed (`drizzle-kit ^0.31.10`) but no `drizzle.config.*` file exists -- migrations appear to be managed via raw SQL through Supabase CLI, not Drizzle Kit `generate`/`migrate`. No automated rollback mechanism. | :x: |
| Graceful degradation (Redis down) | **Well implemented.** `src/lib/rate-limit.ts` lines 18-46: `safeLimit()` wrapper checks if Redis is available, supports `failClosed` (auth) and fail-open (lower-risk) modes. When Redis is null, auth rate limiters deny requests (preventing brute force bypass), while API limiters allow through. Error catching wraps all Redis calls. | :white_check_mark: |
| Graceful degradation (Discogs down) | **Partially implemented.** Import worker (`src/lib/discogs/import-worker.ts`) has exponential backoff with retry (max 3 retries, 1s/2s/4s delays) specifically for HTTP 429. Jobs have a 30-minute stale timeout and a MAX_PAGES=500 safety limit. However, non-429 Discogs errors (500s, timeouts, DNS failures) throw immediately and mark the job as failed -- no retry for transient network errors. | :warning: |
| Graceful degradation (Stripe down) | **Partially implemented.** Stripe webhook handler (`src/app/api/stripe/webhook/route.ts`) has idempotency guards via `stripe_event_log` table and uses upsert-based handlers safe for re-processing. Returns proper HTTP status codes so Stripe retries automatically. However, the idempotency check itself has a try/catch that swallows failures (line 317) -- if `stripe_event_log` table doesn't exist, events will be processed but duplicates won't be detected. `getStripe()` in `src/lib/stripe.ts` throws immediately if `STRIPE_SECRET_KEY` is missing with no circuit breaker. | :warning: |

### Reliability Assessment

Error boundaries and Sentry integration provide solid crash recovery at the UI layer. Rate limiting graceful degradation is excellent -- the dual fail-closed/fail-open pattern in `safeLimit()` is production-grade. The Discogs import self-invocation pattern (fire-and-forget next page via `fetch()`) is clever but creates a risk: if `NEXT_PUBLIC_SITE_URL` defaults to `localhost:3000` in production (which the current Zod schema allows via `optional().default("http://localhost:3000")` on line 39 of `env.ts`), all self-invocations will silently fail, stalling every import at page 1 with no error logged. This is the highest-risk single reliability issue in the codebase.

The absence of a health endpoint is a blocker. The incident runbooks reference `/api/health/deep` which does not exist, meaning the documented incident response procedures will fail on step 1 of diagnosis for 4 out of 6 runbooks. Synthetic monitoring (mentioned in incident-response.md as "Uptime robot pinging `/api/health` every 5 minutes") cannot function without this endpoint.

---

## 2. Scalability

| Check | Evidence | Status |
|-------|----------|--------|
| Vercel function timeouts profiled | Import worker sets `maxDuration = 60` (line 14 of `route.ts`), requiring Vercel Pro. Stripe webhook sets `runtime = "nodejs"`. OG image route uses `runtime = "edge"`. Desktop handoff uses `runtime = "nodejs"`. Only 1 of 8 API routes explicitly sets timeout. The other 7 routes inherit the default (10s Hobby / 60s Pro). | :warning: |
| DB connection pooling configured | `src/lib/db/index.ts`: `prepare: false` set correctly for PgBouncer transaction mode. Pool config: `max: 10, idle_timeout: 20, connect_timeout: 10`. This is appropriate for serverless -- each Vercel function instance gets its own pool of up to 10 connections, and `prepare: false` prevents the PgBouncer prepared statement incompatibility. | :white_check_mark: |
| Redis within tier limits | Upstash free tier: 10K commands/day. Rate limiters defined: auth (5/60s), reset (3/15m), TOTP (5/5m), API (30/60s), trade (10/60s), discogs (5/60s). Analytics enabled on all limiters (`analytics: true` in `makeRatelimit`). With analytics, each `limit()` call generates ~3 Redis commands. At 100 DAU with 30 API actions each = 3000 * 3 = 9000 commands/day from rate limiting alone, plus gem-snapshot get/set/del during imports. Close to the 10K/day free tier limit. | :warning: |
| Discogs rate limiting implemented | Two layers: (1) Client-side rate limiter in `src/lib/rate-limit.ts` at 5 req/60s per user via Upstash. (2) Server-side retry with exponential backoff for 429s in `import-worker.ts` (max 3 retries, up to 10s delay). Self-invocation pattern processes one page per function invocation, naturally throttling to Vercel's function execution cadence. | :white_check_mark: |
| Image optimization | `next.config.ts` configures `images.remotePatterns` for discogs.com, supabase.co, and ytimg.com. `next/image` is used across 20 files (verified via grep). This routes external images through Vercel's image optimization CDN. No custom loader or quality settings -- defaults to Vercel's optimized delivery. | :white_check_mark: |
| Large collection import is async | Import follows a self-invocation pattern: API route processes one page, then fires a `fetch()` to itself for the next page. MAX_PAGES=500 (25,000 items). Stale job timeout at 30 minutes. Progress broadcast via Supabase Realtime. This is a well-designed async queue that works within Vercel's serverless constraints. | :white_check_mark: |

### Scalability Assessment

Database connection pooling is correctly configured for PgBouncer. The import self-invocation pattern is an elegant solution for long-running work in a serverless environment. The primary scalability concern is Upstash Redis command volume: with analytics enabled on all 6 rate limiters, command count will approach the 10K/day free tier limit at modest usage (~100 DAU). Either disable analytics or budget for the paid tier ($0.2/100K commands) before launch.

The `maxDuration = 60` on the import worker route is a Vercel Pro feature. On the Hobby tier (which has a 10s limit), large collection page processing that involves multiple Discogs API calls with retry delays could timeout. This must be tested or documented as a Pro tier requirement.

---

## 3. Observability

| Check | Evidence | Status |
|-------|----------|--------|
| Sentry configured with source maps | Sentry plugin in `next.config.ts` (line 70-76): `withSentryConfig` with `org`, `project`, `widenClientFileUpload: true`. However: `productionBrowserSourceMaps: false` (line 33) correctly prevents public exposure. Source map upload requires `SENTRY_AUTH_TOKEN` env var, which is NOT in the Zod schema, NOT in `.env.local.example`, and no `.sentryclirc` file exists. **Source maps will NOT upload unless SENTRY_AUTH_TOKEN is manually set in Vercel.** Without source maps, production Sentry errors will show minified stack traces. | :x: |
| Sentry alert rules defined | No evidence of Sentry alert configuration in the codebase. Alert rules are configured in the Sentry dashboard (not in code), so this cannot be verified from the repo alone. The `tracesSampleRate: 0.1` (10%) is appropriate for MVP traffic. `replaysOnErrorSampleRate: 1.0` captures session replays on every error -- good for debugging but will consume Sentry replay quota quickly. | Unverified |
| Vercel Analytics enabled | `@vercel/analytics` is NOT in `package.json` dependencies. No `Analytics` component found in the codebase. Core Web Vitals, page view tracking, and performance metrics are completely absent. | :x: |
| Stripe webhook monitoring | Stripe webhook handler logs errors via `console.error` (lines 305, 351 of webhook route). Idempotency tracking via `stripe_event_log` table provides a queryable record of processed events. However, there is no proactive alerting when webhooks fail -- Sentry would capture 500s, but silent failures (e.g., wrong user mapping) would go undetected. | :warning: |
| Structured logging in server actions | No structured logging library (pino, winston, etc.) is installed. All 28 server action files use raw `console.log/error/warn/info` (128 total occurrences). Logs are unstructured strings like `"[import-worker] Pre-import snapshot failed:"`. In Vercel's log viewer, these are searchable but not filterable by severity, action, user, or request ID. No correlation IDs exist. | :x: |
| Key business metrics tracked | No custom metrics are tracked. No Vercel Analytics means no page view data. Sentry captures errors but not business events (signups, imports started, trades completed, subscription conversions). The only business data queryable is directly from the database. | :x: |

### Observability Assessment

Observability is the weakest pillar. The service will launch essentially blind to performance, user behavior, and non-crashing issues. Sentry captures unhandled errors and provides session replay on errors, but without source maps (due to missing `SENTRY_AUTH_TOKEN`), debugging production errors will require correlating minified code with local builds -- extremely painful for a solo developer.

The absence of Vercel Analytics (`@vercel/analytics`) means no visibility into Core Web Vitals, page load performance, or traffic patterns. For an MVP this is tolerable but should be added in the first week post-launch (it's a 5-minute install).

The `console.error`/`console.warn` logging pattern works in Vercel's log viewer but will not scale. The 128 log statements across 28 server actions are inconsistently formatted and lack correlation IDs. When a user reports "my import failed," there is no way to trace their specific request path through the logs.

**Sentry is the only production error detection mechanism. If NEXT_PUBLIC_SENTRY_DSN is not set (it's not in Zod validation), Sentry will silently not initialize (due to `enabled: process.env.NODE_ENV === "production"` + undefined DSN = no errors reported). This is a critical gap.**

---

## 4. Incident Preparedness

| Check | Evidence | Status |
|-------|----------|--------|
| Incident runbooks exist | 6 detailed runbooks in `.pi/agent/skills/digswap-sre/workflows/incident-runbook.md`: Auth Down, DB Unreachable, Discogs 429, Stripe Webhooks Failing, High Error Rate Post-Deploy, Function Timeout. Each has Symptoms, Diagnosis, Fix Options, and Verification sections. | :white_check_mark: |
| Severity levels defined | 4 severity levels (S1-S4) defined in `.pi/agent/skills/digswap-sre/references/incident-response.md` with clear definitions, examples, and response time targets (S1: 1 hour, S2: 4 hours, S3: 24 hours, S4: next work session). Adapted for solo developer context. | :white_check_mark: |
| Rollback tested | Rollback plan documented but no evidence of a test rollback having been performed. Vercel's instant rollback (promote previous deployment to production) is the primary mechanism. This is a well-known, reliable Vercel feature, but it has never been exercised for this project. | :warning: |
| Communication plan | No user-facing status page exists. No mention of status.digswap.com or equivalent. Incident response doc mentions "Update status page" but no status page is configured. For an MVP with expected low initial traffic, this is acceptable but should be planned. | :warning: |
| Post-mortem template | Template defined in `.pi/agent/skills/digswap-sre/references/incident-response.md` with sections: What Happened, Timeline, Root Cause, Prevention, and action items. Appropriate for a solo developer (concise, no committee overhead). | :white_check_mark: |
| Backup/restore tested | Supabase manages automatic PostgreSQL backups on the free tier (7-day retention). No manual backup/restore test has been performed. Database can be restored via Supabase dashboard. Point-in-time recovery requires the Pro tier ($25/mo). | :warning: |

### Incident Preparedness Assessment

Incident preparedness documentation is above average for a pre-launch MVP. The runbooks are specific to DigSwap's architecture and cover the most likely failure modes. Severity levels and response times are realistic for a solo developer.

The gap is that runbooks reference infrastructure that doesn't exist yet: the health endpoint (referenced in runbooks 1, 2, 3), synthetic monitoring (referenced in incident response), and a status page (referenced in the communication section). These need to be built before the runbooks are useful in practice.

---

## 5. Security (defer to appsec audit)

Brief observations relevant to SRE:

- **CSP**: Nonce-based Content-Security-Policy generated per-request in middleware via `src/lib/security/csp.ts`. Supabase hostname is extracted from env (not wildcarded). `strict-dynamic` used for scripts. No `unsafe-inline` or `unsafe-eval` in production. Well implemented.
- **HSTS**: `max-age=63072000; includeSubDomains; preload` set in `next.config.ts` headers. Correct.
- **X-Frame-Options**: DENY. Also `frame-ancestors 'none'` in CSP. Double protection.
- **Source maps**: `productionBrowserSourceMaps: false`. Correct -- no source map exposure.
- **Powered-by header**: `poweredByHeader: false`. Removes Next.js fingerprinting.
- **Stripe webhook bypass**: Middleware correctly skips CSP/auth for `/api/stripe/webhook` (line 6 of `middleware.ts`). Webhook route validates Stripe signature independently.
- **Import worker auth**: Uses constant-time comparison (`timingSafeEqual`) for the shared secret. Guards against `Bearer undefined` when env var is unset (line 69-71).
- **Session management**: Middleware validates JWT via `getUser()` (not `getSession()`), and implements a session allowlist check against `user_sessions` table with fail-closed behavior on errors (lines 113-122 of `supabase/middleware.ts`).
- **Env var concern**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` is used in middleware line 21 via `process.env` directly, bypassing Zod validation. The variable is named differently than the Zod-validated `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. If only the publishable key is set but not the anon key, middleware auth will silently fail.

---

## Capacity Headroom

| Service | Estimated Usage (100 DAU) | Tier Limit | Headroom | Upgrade Trigger |
|---------|---------------------------|------------|----------|-----------------|
| Vercel (bandwidth) | ~5-10 GB/mo (SSR + images) | 100 GB/mo (Hobby) | ~90 GB | 80 GB/mo |
| Vercel (function invocations) | ~50K/mo (page loads + API) | 1M/mo (Hobby) | ~950K | 800K/mo |
| Vercel (function timeout) | Import worker needs 60s (`maxDuration=60`) | 10s (Hobby) / 60s (Pro) | **0 on Hobby** | **Requires Pro at launch if imports are used** |
| Supabase (DB size) | ~50-100 MB (collections + metadata) | 500 MB (Free) | ~400 MB | 400 MB |
| Supabase (auth MAU) | ~100-500 MAU | 50K MAU (Free) | ~49.5K | 40K MAU |
| Supabase (realtime) | ~10-30 concurrent | 200 connections (Free) | ~170 | 150 connections |
| Supabase (edge functions) | Not used (import via Vercel) | 500K invocations (Free) | Full | N/A |
| Upstash (commands) | ~9K/day (rate limiters + analytics + gem snapshots) | 10K/day (Free) | **~1K/day** | **Immediately at 100+ DAU** |
| Resend (emails) | ~10-50/day (verifications + matches) | 100/day (Free) | ~50-90/day | 80/day |
| Sentry (errors) | ~100-500/mo (typical for new app) | 5K/mo (Free) | ~4.5K | 4K/mo |
| Sentry (replays) | 1.0 replay rate on errors = every error gets replay | 50/mo (Free) | **Low** | **20 replays consumed** |
| Discogs API | 60 req/min max, gated by backoff | 60 req/min (authenticated) | N/A (per-minute) | 48 req/min sustained |

### Capacity Concerns

1. **CRITICAL: Vercel Hobby timeout.** The import worker declares `maxDuration = 60` but Vercel Hobby only allows 10 seconds. This means **imports will timeout on every page after the first for collections with any network latency to Discogs.** Either upgrade to Vercel Pro ($20/mo) or reduce import processing to fit within 10 seconds per invocation.

2. **HIGH: Upstash Redis commands.** With analytics enabled on 6 rate limiters, 100 DAU will consume ~9K of the 10K daily command limit. Spikes (e.g., 200 concurrent users during a viral moment) will hit the limit and cause rate limiters to throw errors. The `safeLimit` wrapper handles this gracefully (fail-open for non-auth), but auth rate limiting will fail-closed, potentially locking out legitimate users.

3. **MEDIUM: Sentry replay quota.** `replaysOnErrorSampleRate: 1.0` means every error captures a session replay. Free tier provides 50 replays/month. A single bad deploy could exhaust this in minutes. Consider reducing to 0.5 or 0.1 for launch.

---

## Blockers (MUST fix before launch)

### B-1: No health endpoint [Reliability]
**Impact:** Synthetic monitoring impossible. Incident runbooks reference non-existent `/api/health/deep`. Automated uptime detection is blind.
**File:** N/A (does not exist)
**Fix:** Create `/api/health/route.ts` with shallow check (200 OK) and deep check endpoint that verifies DB connectivity, Redis reachability, and Supabase Auth status. Estimated: 1 hour.

### B-2: NEXT_PUBLIC_SITE_URL defaults to localhost in production [Reliability]
**Impact:** The Discogs import self-invocation pattern (`fetch(\`${siteUrl}/api/discogs/import\`)` on lines 417 and 445 of the import route) uses `NEXT_PUBLIC_SITE_URL`, which defaults to `http://localhost:3000` via the Zod schema (line 39 of `env.ts`). In production, if this env var is not explicitly set in Vercel, **every collection import will silently fail after page 1** because the self-invocation fetch will hit localhost (which doesn't exist in Vercel's runtime). The `catch(() => {})` on the fire-and-forget fetch will swallow the error silently.
**File:** `src/lib/env.ts` line 39, `src/app/api/discogs/import/route.ts` lines 417, 445
**Fix:** Make `NEXT_PUBLIC_SITE_URL` required in production (remove `optional().default()` when `NODE_ENV === 'production'`), or use `VERCEL_URL` as fallback (as `getSiteUrl()` in `stripe.ts` already does on line 36-38). Estimated: 30 minutes.

### B-3: STRIPE_SECRET_KEY bypasses Zod validation [Reliability]
**Impact:** `STRIPE_SECRET_KEY` is loaded via `requireEnv()` in `src/lib/stripe.ts` (line 21), not through the centralized Zod schema in `env.ts`. If missing, it throws a generic `Error` at runtime when the first Stripe operation is attempted (checkout, webhook processing), rather than at startup. This means the app boots successfully but Stripe is silently broken.
**File:** `src/lib/stripe.ts` line 7-14, `src/lib/env.ts` (missing from schema)
**Fix:** Add `STRIPE_SECRET_KEY` to the Zod server schema with production-required validation. Estimated: 15 minutes.

### B-4: NEXT_PUBLIC_SENTRY_DSN not validated [Observability]
**Impact:** Sentry initializes with `dsn: process.env.NEXT_PUBLIC_SENTRY_DSN` directly (not from Zod). If unset, Sentry silently doesn't initialize -- no errors are captured, no alerts fire. Combined with `enabled: process.env.NODE_ENV === "production"`, an unset DSN means **zero error visibility in production.** The entire observability stack depends on this single env var being correctly set.
**File:** `src/instrumentation.ts` lines 6, 14; `src/instrumentation-client.ts` line 4; `src/lib/env.ts` (missing)
**Fix:** Add `NEXT_PUBLIC_SENTRY_DSN` to the public Zod schema as required in production. Estimated: 15 minutes.

---

## Non-Blocking Concerns (fix post-launch)

### N-1: Install Vercel Analytics and Speed Insights [Observability]
No `@vercel/analytics` or `@vercel/speed-insights` in dependencies. Missing Core Web Vitals, page views, and performance data. 5-minute install: `npm install @vercel/analytics @vercel/speed-insights`, add `<Analytics />` and `<SpeedInsights />` to root layout.

### N-2: Add SENTRY_AUTH_TOKEN for source map upload [Observability]
Without this env var in Vercel, Sentry `withSentryConfig` plugin cannot upload source maps during build. Production errors will show minified stack traces. Set `SENTRY_AUTH_TOKEN` in Vercel environment variables and add `SENTRY_ORG`/`SENTRY_PROJECT` as well.

### N-3: Reduce Sentry replay sample rate [Cost]
`replaysOnErrorSampleRate: 1.0` will exhaust the 50 replays/month free tier quota rapidly. Reduce to `0.1` for launch.

### N-4: Disable analytics on non-critical rate limiters [Cost]
`analytics: true` on all 6 Upstash rate limiters triples Redis command usage. Disable analytics on `apiRateLimit`, `tradeRateLimit`, and `discogsRateLimit` to reduce daily command count by ~60%. Keep analytics only on auth-critical limiters.

### N-5: .env.local.example is incomplete [DX]
The example file has 10 env vars. The Zod schema validates 20+ vars. Missing from the example: `NEXT_PUBLIC_APP_URL`, `HANDOFF_HMAC_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_SECRET_KEY`, `YOUTUBE_API_KEY`, `SYSTEM_USER_ID`, `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`, `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL`, `NEXT_PUBLIC_MIN_DESKTOP_VERSION`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`.

### N-6: Adopt structured logging [Observability]
Replace 128 `console.*` calls across 28 server action files with a lightweight structured logger (e.g., a thin wrapper that adds timestamp, level, action name, and user ID). This enables log filtering in Vercel's log viewer and future log aggregation.

### N-7: Add middleware env var consistency [Reliability]
`src/lib/supabase/middleware.ts` line 21 uses `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY` directly, which is a different variable name than the Zod-validated `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. If only the publishable key is set, middleware auth will silently use `undefined` as the anon key, breaking auth for all requests.

### N-8: Test Vercel rollback procedure [Incident Prep]
Perform one practice rollback to verify the documented procedure works. Deploy a known-good state, deploy a change, rollback, verify.

### N-9: Verify Vercel tier for import worker [Scalability]
`maxDuration = 60` on the import route requires Vercel Pro. Either confirm Pro tier or reduce page processing to fit within the 10-second Hobby limit.

### N-10: Add database migration rollback strategy [Reliability]
20+ SQL migrations with no paired down-migrations. No Drizzle Kit config file exists. If a migration breaks production data, rollback requires manually writing compensating SQL. Document a manual rollback procedure for the most recent 3 migrations at minimum.

---

## Overall Recommendation

**NOT READY**

The service has strong fundamentals: well-implemented rate limiting with graceful degradation, proper security headers, nonce-based CSP, Sentry error boundaries, and a cleverly designed async import pipeline. These indicate mature engineering practices.

However, 4 blockers prevent safe production deployment:

1. **No health endpoint** -- the foundation of all monitoring and incident response is missing. Without it, the documented runbooks, synthetic monitoring, and automated alerting cannot function.

2. **NEXT_PUBLIC_SITE_URL defaulting to localhost** -- this will silently break the core Discogs import feature for every user in production. The import self-invocation pattern depends on this URL being correct, and the default value guarantees failure.

3. **STRIPE_SECRET_KEY outside Zod validation** -- payments will appear to work during deployment but fail at the first checkout, with no startup-time signal.

4. **NEXT_PUBLIC_SENTRY_DSN not validated** -- if unset, the entire error tracking stack silently disables. Combined with no Vercel Analytics, the service would have zero observability in production.

**Estimated time to resolve all 4 blockers: 2-3 hours.** After these fixes, the service can launch as an MVP with the non-blocking concerns tracked for the first post-launch iteration.

The capacity analysis shows the service can handle ~100 DAU on free tiers, with Upstash Redis being the first service to hit its limit. Budget for Vercel Pro ($20/mo) if Discogs imports are a launch feature, as the 10-second Hobby timeout is insufficient for the import worker.
