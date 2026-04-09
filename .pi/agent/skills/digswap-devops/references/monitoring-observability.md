# Monitoring and Observability

Observability stack and alerting strategy for DigSwap in production.

## Sentry

DigSwap integrates Sentry via `@sentry/nextjs` (configured in `apps/web/next.config.ts`, `apps/web/src/instrumentation.ts`, and `apps/web/src/instrumentation-client.ts`).

- **Error tracking**: Automatic capture of unhandled exceptions on both server and client.
- **Performance monitoring**: Transaction traces for server actions, API routes, and page loads.
- **Release tracking**: Source maps uploaded during `next build` via `withSentryConfig` (requires `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` at build time).
- **Client DSN**: Set via `NEXT_PUBLIC_SENTRY_DSN`. Only enabled in production (`process.env.NODE_ENV === "production"`).
- **Source maps**: Uploaded to Sentry for stack trace deobfuscation but never served to browsers (`productionBrowserSourceMaps: false`).

## Vercel Analytics

- **Web Vitals**: LCP, FID, CLS, TTFB tracked automatically on Vercel deployments.
- **Function duration**: Monitor serverless function execution times to catch timeout risks before they hit the 10s/60s limits.
- **Bandwidth**: Track against the 100GB Hobby limit or Pro allocation.
- Enable via Vercel dashboard > Analytics. No code changes needed for the basic tier.

## Upstash Dashboard

- **Command count**: Monitor against the 500K/month free tier limit. DigSwap uses Redis for rate limiting (`@upstash/ratelimit`) and desktop handoff token storage.
- **Bandwidth**: 200GB/month on free tier. Each rate limit check is ~1KB.
- **Key browser**: Inspect `handoff:*` keys, rate limit counters, and cached leaderboard data.
- Access via [console.upstash.com](https://console.upstash.com).

## Supabase Dashboard

- **Query performance**: Database > Query Performance shows slow queries. Watch for N+1 patterns in collection/wantlist queries.
- **Auth events**: Authentication > Logs shows sign-in failures, token refreshes, and OAuth errors.
- **Realtime connections**: Realtime > Connections shows current WebSocket count vs limit.
- **Database size**: Settings > Database shows storage usage vs tier limit.

## Alerting Rules

Configure these alerts before launch:

| Metric | Threshold | Channel | Service |
|--------|-----------|---------|---------|
| Error rate | > 1% of requests in 5 min | Email / Slack | Sentry |
| P95 response time | > 2s for any route | Email | Sentry Performance |
| Function timeout | Any function exceeding 80% of limit | Email | Vercel |
| Database size | > 80% of tier limit | Email | Supabase |
| Realtime connections | > 80% of tier limit | Email | Supabase |
| Redis commands | > 80% of monthly quota | Email | Upstash |
| Stripe webhook failures | > 3 consecutive failures | Email | Stripe Dashboard |
| Auth failures | > 10 failed logins from same IP in 1 min | Dashboard review | Supabase Auth Logs |
