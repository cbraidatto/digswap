# SLA Budget & SLOs

Realistic Service Level Objectives for a solo-developer product running on managed infrastructure.

## Service Level Objectives

| Metric | Target | Rationale |
|--------|--------|-----------|
| Availability | 99.5% | Allows ~3.6 hours downtime/month. Realistic for one person with no on-call rotation. Managed services (Vercel, Supabase) provide the baseline. |
| Page Load Latency | p95 < 1s | Server-rendered pages via Next.js SSR/ISR should respond within 1s at the 95th percentile. Vercel edge network helps. |
| API Route Latency | p99 < 3s | Includes database queries, Redis lookups, and external API calls. Discogs-dependent routes may be slower. |
| Error Rate | < 0.5% of requests | Measured via Sentry and Vercel function error rates. Excludes expected 4xx (auth failures, validation). |
| Webhook Processing | 99.9% success | Stripe webhooks must be processed reliably. Failures cause subscription state drift. |

## Service Level Indicators (SLIs)

Where each SLO is actually measured:

- **Availability**: Vercel analytics (function success rate) + synthetic uptime monitor on `/api/health`.
- **Page Load Latency**: Vercel Speed Insights + Web Vitals (LCP, TTFB) reported by real user monitoring.
- **API Route Latency**: Vercel function duration metrics + Sentry transaction traces.
- **Error Rate**: Sentry issue count / Vercel total invocations over a rolling 7-day window.
- **Webhook Processing**: Stripe Dashboard webhook delivery rate + Sentry errors tagged `stripe-webhook`.

## Error Budget

The error budget is the inverse of the SLO — the amount of unreliability you can tolerate.

- **99.5% availability = 0.5% error budget = ~3.6 hours/month of allowed downtime.**
- Track budget consumption weekly. If more than 50% of the monthly budget is consumed in one week, enter stability mode.

### Spending the Error Budget

- **Budget available (> 25% remaining)**: Ship features, deploy risky changes, run migrations, experiment.
- **Budget tight (10-25% remaining)**: Ship only well-tested changes. No experiments. Monitor closely after each deploy.
- **Budget exhausted (< 10% remaining)**: Stop feature work. Focus exclusively on reliability improvements, monitoring gaps, and incident prevention.

## Free/Hobby Tier Limits

Hard limits that determine capacity ceiling before paying:

| Service | Limit | Impact When Exceeded |
|---------|-------|---------------------|
| Vercel Hobby | 100GB bandwidth/month, 10s function timeout, 1M invocations/month | Functions killed at 10s (Discogs imports fail), bandwidth overage blocks deploys |
| Supabase Free | 500MB database, 2GB bandwidth/month, 200 realtime connections, 50K MAU auth | Database full = writes fail, realtime cap = users disconnected |
| Upstash Free | 10K commands/day, 256MB storage, 200 concurrent connections | Leaderboard updates and rate limiting stop working, cache misses cascade to DB |
| Resend Free | 100 emails/day, 3,000 emails/month | Wantlist match notifications, trade requests, and verification emails stop sending |
| Sentry Free | 5K errors/month, 10K transactions/month | Monitoring goes blind — errors still happen but are not tracked |
| Discogs API | 60 authenticated requests/minute | Rate limit exceeded = 429 errors, imports stall, collection sync breaks |

## Budget Review Cadence

- **Daily**: Glance at Sentry for new error spikes (< 2 minutes).
- **Weekly**: Check Vercel analytics, Supabase dashboard, Upstash usage, Stripe webhook success rate (10 minutes).
- **Monthly**: Review error budget consumption, cost trends, capacity headroom. Decide if tier upgrades are needed (30 minutes).
