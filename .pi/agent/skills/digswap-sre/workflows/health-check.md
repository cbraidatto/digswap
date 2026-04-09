# Health Check

Define, implement, and verify system health for DigSwap.

## Objective

Establish automated health monitoring so production issues are detected before users report them. A solo developer cannot watch dashboards — health checks must be self-reporting.

## Health Endpoints

### `/api/health` — Basic Health

Returns HTTP 200 if the Next.js application is running on Vercel. Lightweight, no external calls.

```json
{
  "status": "ok",
  "timestamp": "2026-04-09T12:00:00Z",
  "version": "git-sha-or-build-id"
}
```

- Response time target: < 50ms.
- Use for: uptime monitors, load balancer health checks.
- Should never fail unless the entire Vercel deployment is down.

### `/api/health/deep` — Deep Health

Checks connectivity to all critical dependencies. Returns HTTP 200 if all checks pass, HTTP 503 if any critical check fails.

```json
{
  "status": "healthy | degraded | unhealthy",
  "timestamp": "2026-04-09T12:00:00Z",
  "checks": {
    "database": { "status": "ok", "latency_ms": 45 },
    "redis": { "status": "ok", "latency_ms": 12 },
    "auth": { "status": "ok" },
    "stripe": { "status": "ok" }
  }
}
```

Checks to perform:
1. **Database**: Execute `SELECT 1` via Drizzle. Fail if > 2000ms or error.
2. **Redis**: Execute `PING` via Upstash client. Fail if > 1000ms or error.
3. **Auth**: Verify Supabase auth client initializes without error.
4. **Stripe**: Verify Stripe SDK can reach the API (lightweight call like `stripe.balance.retrieve()`). Optional — skip if adds too much latency.

Response time target: < 3s total.
- Use for: deployment verification, post-deploy smoke test.
- Do NOT expose detailed error messages — return generic status. Log details to Sentry.

## Synthetic Monitoring

Set up an external uptime monitor (UptimeRobot free tier: 50 monitors, 5-min checks):

| Monitor | URL | Interval | Alert |
|---------|-----|----------|-------|
| Homepage | `https://digswap.com` | 5 min | Email |
| Basic health | `https://digswap.com/api/health` | 5 min | Email |
| Deep health | `https://digswap.com/api/health/deep` | 15 min | Email |

Alert conditions:
- Basic health: alert if 2 consecutive failures (avoids transient Vercel cold starts).
- Deep health: alert if 1 failure (any dependency down is significant).

## Daily Dashboard Checklist (< 2 minutes)

Glance at these every morning:

1. **Sentry**: Any new S1/S2 issues? Error count trending up?
2. **Vercel**: Any failed deployments? Function error rate normal?
3. **UptimeRobot** (or equivalent): Any downtime incidents overnight?

If all three are green, move on to feature work.

## Weekly Review Checklist (10 minutes)

Every Monday morning:

1. **Error trends**: Sentry weekly report — new issues, regression, volume change.
2. **Performance trends**: Vercel Speed Insights — LCP, TTFB changes over the week.
3. **Cost/usage trends**: Check Supabase dashboard (DB size, connections), Upstash (command count), Resend (email count).
4. **Stripe health**: Webhook delivery rate, failed payments count.
5. **Error budget check**: Calculate approximate availability from Vercel uptime and Sentry error rate. Are we within the 99.5% SLO?
6. **Capacity headroom**: Are any services above 70% of their tier limit? If yes, plan upgrade.

## Monthly Review (30 minutes)

First Monday of each month:

1. **Error budget report**: Total downtime minutes, error budget consumed vs allowed.
2. **Cost review**: Actual spend across all services vs budget.
3. **Capacity forecast**: At current growth rate, when will each service tier be exhausted?
4. **Incident retrospective**: Any incidents this month? Were post-mortems written? Were action items completed?
5. **SLO review**: Are current SLO targets still appropriate? Too tight (causing unnecessary stress) or too loose (hiding real problems)?
