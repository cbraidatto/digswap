# Incident Response

Solo developer incident response adapted for DigSwap. No on-call team, no war room — just one person, clear severity levels, and pre-built decision trees.

## Detection Sources

Incidents are discovered through these channels, roughly in order of speed:

1. **Sentry alerts** — Real-time error notifications via email/Slack. Fastest automated signal.
2. **Vercel deployment status** — Failed builds or function errors visible in dashboard and email alerts.
3. **Supabase dashboard** — Database health, connection pool usage, auth errors, realtime connection count.
4. **Upstash console** — Redis command count, error rate, throttling indicators.
5. **Stripe Dashboard** — Webhook delivery failures, failed payments, subscription anomalies.
6. **Synthetic monitoring** — Uptime robot or equivalent pinging `/api/health` every 5 minutes.
7. **User reports** — Social media, email, or in-app feedback. Slowest but catches what automation misses.

## Severity Levels

| Severity | Definition | Examples | Response Time |
|----------|-----------|----------|---------------|
| S1 — Critical | Core functionality down for all users | Auth broken, payments failing, database unreachable | Immediate (within 1 hour of detection) |
| S2 — Major | Key feature broken for many users | Discogs import failing, collection not loading, search down | Within 4 hours |
| S3 — Degraded | Feature impaired but workaround exists | Slow page loads, intermittent WebRTC failures, email delays | Within 24 hours |
| S4 — Cosmetic | Minor issue, no functionality impact | UI glitch, wrong icon, stale cache showing old data | Next planned work session |

## Rollback vs Hotfix Decision Tree

When an incident is detected after a deploy:

1. **Is the issue in the latest deploy?** Check Sentry for the first occurrence timestamp vs deploy timestamp.
2. **If yes and S1/S2**: Rollback immediately via Vercel dashboard (instant rollback to previous deployment).
3. **If yes and S3/S4**: Evaluate hotfix difficulty. If fix is < 30 minutes, hotfix. Otherwise rollback and fix later.
4. **If no (pre-existing issue surfaced by load/timing)**: Do not rollback. Diagnose root cause. Hotfix if S1/S2.
5. **After any rollback**: Verify the rollback resolved the issue. Then fix forward in a new deploy with proper testing.

## Common DigSwap Incidents

### Supabase Connection Pool Exhaustion
- **Symptoms**: 500 errors on multiple routes, "too many connections" in Sentry, queries timing out.
- **Cause**: Leaked connections from server actions not using pooled client, or Realtime subscription spike.
- **Fix**: Restart via Supabase dashboard. Check Drizzle connection config (`prepare: false` for PgBouncer). Reduce Realtime subscriptions.

### Discogs API Rate Limit Exceeded (429s)
- **Symptoms**: Import progress stalls, Sentry logs 429 errors from Discogs client, users see "import failed."
- **Cause**: Background import jobs exceeding 60 req/min, or multiple users triggering imports simultaneously.
- **Fix**: Check Upstash rate limiter state. Pause import queue temporarily. Verify exponential backoff is working.

### Stripe Webhook Processing Failures
- **Symptoms**: Stripe dashboard shows failed webhook deliveries, user subscriptions out of sync with database.
- **Cause**: Webhook endpoint URL changed after deploy, webhook signing secret rotated, or processing code throws.
- **Fix**: Check Stripe webhook logs for error details. Verify endpoint URL and signing secret. Replay failed events from Stripe dashboard.

### Sentry Error Spike Post-Deploy
- **Symptoms**: Sentry issue count jumps 10x+ within minutes of a deploy.
- **Cause**: Bug in new code path, environment variable missing, or dependency breaking change.
- **Fix**: If S1/S2, rollback immediately. Check Sentry for the specific error. Fix and redeploy.

### PeerJS Signaling Server Down
- **Symptoms**: Users cannot initiate P2P connections, WebRTC handshake fails, "peer unavailable" errors.
- **Cause**: Self-hosted PeerServer crashed, or cloud PeerJS service is down.
- **Fix**: Check PeerServer health endpoint. Restart if self-hosted. If cloud, check PeerJS status page and wait or switch to backup.

## Post-Mortem Template

Write a brief post-mortem for any S1 or S2 incident. Keep it short — this is for one person, not a committee.

```
## Incident: [Title]
**Date**: [Date]  **Severity**: [S1/S2/S3]  **Duration**: [X minutes/hours]

### What happened
[2-3 sentences describing the user-visible impact.]

### Timeline
- [HH:MM] Detection — how was it noticed
- [HH:MM] Response — what was done
- [HH:MM] Resolution — what fixed it

### Root cause
[1-2 sentences. Be specific — "Drizzle connection not using pooler endpoint" not "database issue."]

### What prevented earlier detection
[Was there a missing alert? A gap in monitoring?]

### Prevention
- [ ] Action item 1 (with deadline)
- [ ] Action item 2 (with deadline)
```
