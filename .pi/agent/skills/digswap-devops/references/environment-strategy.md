# Environment Strategy

Complete environment variable map and management strategy for DigSwap.

## Env Var Validation

All env vars are validated at startup via Zod schemas in `apps/web/src/lib/env.ts`. Server vars fail hard if missing on the server. Public vars fail hard everywhere. Add every new var to both the schema and `apps/web/.env.local.example`.

## Server-Only Variables

These must NEVER appear in client bundles or be prefixed with `NEXT_PUBLIC_`.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Always | Supabase connection pooler URL (PgBouncer transaction mode) |
| `SUPABASE_SERVICE_ROLE_KEY` | Always | Bypasses RLS for admin operations (import worker, system jobs) |
| `DISCOGS_CONSUMER_KEY` | Always | Discogs OAuth 1.0a consumer key |
| `DISCOGS_CONSUMER_SECRET` | Always | Discogs OAuth 1.0a consumer secret |
| `IMPORT_WORKER_SECRET` | Always | Shared secret for self-invocation auth on import API routes |
| `HANDOFF_HMAC_SECRET` | Production | HMAC key for desktop handoff tokens (min 32 chars in production) |
| `RESEND_API_KEY` | Optional | Resend transactional email API key |
| `RESEND_FROM_EMAIL` | Optional | Sender address (defaults to `noreply@digswap.com`) |
| `STRIPE_SECRET_KEY` | Production | Stripe server-side API key (used in `apps/web/src/lib/stripe.ts`) |
| `STRIPE_WEBHOOK_SECRET` | Production | Stripe webhook signing secret (min 10 chars in production) |
| `YOUTUBE_API_KEY` | Optional | YouTube Data API v3 key for release previews |
| `SYSTEM_USER_ID` | Optional | Supabase user ID for system-generated content |
| `UPSTASH_REDIS_REST_URL` | Optional | Upstash Redis REST endpoint for rate limiting and caching |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Upstash Redis REST auth token |
| `SENTRY_ORG` | Build time | Sentry organization slug (used in `next.config.ts` for source map upload) |
| `SENTRY_PROJECT` | Build time | Sentry project slug |
| `SENTRY_AUTH_TOKEN` | Build time | Sentry auth token for source map upload during build |

## Public Variables

Exposed to the browser. Safe to include in client bundles.

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Always | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Always | Supabase anon/publishable key (safe for client) |
| `NEXT_PUBLIC_SITE_URL` | Always | Canonical site URL (defaults to `http://localhost:3000`) |
| `NEXT_PUBLIC_APP_URL` | Optional | App URL for share links and OG images |
| `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` | Optional | Stripe Price ID for monthly subscription |
| `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL` | Optional | Stripe Price ID for annual subscription |
| `NEXT_PUBLIC_MIN_DESKTOP_VERSION` | Optional | Minimum compatible desktop app version |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional | Sentry DSN for client-side error reporting |

## Environment Differences

| Variable | Local | Preview | Staging | Production |
|----------|-------|---------|---------|------------|
| `DATABASE_URL` | Local Supabase | Branch DB | Staging project | Production project |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Vercel preview URL | Staging domain | `https://digswap.com` |
| `STRIPE_SECRET_KEY` | Test key (`sk_test_`) | Test key | Test key | Live key (`sk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | Stripe CLI local | Preview endpoint | Staging endpoint | Production endpoint |
| `UPSTASH_REDIS_REST_URL` | Local or dev instance | Separate dev DB | Staging DB | Production DB |
| `SENTRY_DSN` | Disabled | Dev project | Staging project | Production project |
| `HANDOFF_HMAC_SECRET` | Dev default | Unique per preview | Staging secret | Production secret (32+ chars) |

## Secret Rotation Strategy

1. **Quarterly rotation**: `SUPABASE_SERVICE_ROLE_KEY`, `IMPORT_WORKER_SECRET`, `HANDOFF_HMAC_SECRET`.
2. **On compromise**: Rotate immediately via Vercel dashboard, then redeploy. Supabase service role key requires regeneration in Supabase dashboard > Settings > API.
3. **Stripe keys**: Rotate via Stripe dashboard. Update both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` simultaneously.
4. **Never share production secrets with preview deployments**. Vercel supports per-environment scoping (Production / Preview / Development). Use it.

## Adding a New Env Var

1. Add to Zod schema in `apps/web/src/lib/env.ts` (server or public).
2. Add to `apps/web/.env.local.example` with placeholder value.
3. Add to Vercel project settings for each environment scope.
4. If build-time only (like Sentry), add to Vercel build settings.
5. Update this reference document.
