# Incident Runbooks

Pre-built diagnosis and resolution procedures for the most likely DigSwap production incidents. Each runbook follows the same structure: symptoms, diagnosis, fix options, verification.

## 1. Auth Service Down

**Symptoms**: Users cannot sign in/up, 401/403 errors on all protected routes, Sentry flooded with auth errors.

**Diagnosis**:
1. Check [Supabase Status](https://status.supabase.com) for active incidents.
2. Check Supabase dashboard > Authentication > Users tab — does the dashboard itself load?
3. Check Next.js middleware logs in Vercel — is `@supabase/ssr` client initialization failing?
4. Verify environment variables: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in Vercel.
5. Check if RLS policies were recently modified — overly restrictive policies can mimic auth failures.

**Fix Options**:
- If Supabase outage: Wait for Supabase to resolve. Update status page. No action possible.
- If env vars missing after deploy: Re-add variables in Vercel dashboard, redeploy.
- If middleware bug: Rollback to previous Vercel deployment immediately.
- If RLS issue: Revert migration via Supabase SQL editor or apply corrective policy.

**Verification**: Sign in with a test account. Confirm protected pages load. Check Sentry error rate returns to baseline.

---

## 2. Database Unreachable

**Symptoms**: 500 errors on all routes with database queries, Sentry shows "connection refused" or "too many connections," pages that only use static data still work.

**Diagnosis**:
1. Check Supabase dashboard > Database > Health — is PostgreSQL running?
2. Check connection pool stats: active connections vs pool size.
3. Check if Drizzle is using the pooler endpoint (`db.pooler.supabase.com:6543`) not the direct endpoint.
4. Check if a recent migration locked tables or created a long-running query.
5. Run `SELECT count(*) FROM pg_stat_activity;` in Supabase SQL editor to see active connections.

**Fix Options**:
- If pool exhaustion: Restart the project from Supabase dashboard (resets connections). Review server action code for leaked connections.
- If direct connection used instead of pooler: Update `DATABASE_URL` to pooler endpoint with `?pgbouncer=true`. Redeploy.
- If locked tables: Identify and kill the blocking query via `SELECT pg_terminate_backend(pid)`.
- If Supabase outage: Wait. Check Supabase status page.

**Verification**: Hit `/api/health/deep` endpoint. Confirm database connectivity returns OK. Monitor Sentry for recurring connection errors.

---

## 3. Discogs API 429 (Rate Limit Exceeded)

**Symptoms**: Collection imports stall or fail, Sentry logs HTTP 429 from Discogs API, users see "import failed" or stuck progress bars.

**Diagnosis**:
1. Check Upstash Redis for the Discogs rate limiter key — is the counter exceeding 60/min?
2. Check if multiple users triggered imports simultaneously.
3. Check if the exponential backoff logic in the Discogs client is functioning.
4. Verify the import queue is not retrying failed requests immediately (amplifying the problem).

**Fix Options**:
- Immediate: Pause the import queue (set a flag in Redis or database). Wait 60 seconds for the rate limit window to reset.
- If backoff broken: Fix the `@lionralfs/discogs-client` retry configuration. Deploy hotfix.
- If concurrent imports: Implement a global import semaphore in Redis — only N imports can run simultaneously.
- Long-term: Reduce API calls by caching release metadata aggressively in PostgreSQL.

**Verification**: Resume one import and confirm it progresses without 429s. Check Upstash rate limiter counter stays below 60/min.

---

## 4. Stripe Webhooks Failing

**Symptoms**: Stripe dashboard shows webhook delivery failures (4xx or 5xx), user subscriptions not updating in database, users paying but not getting premium features.

**Diagnosis**:
1. Check Stripe Dashboard > Developers > Webhooks > Recent deliveries — what HTTP status is returned?
2. If 401/403: Webhook signing secret mismatch. Check `STRIPE_WEBHOOK_SECRET` in Vercel env vars.
3. If 404: Webhook endpoint URL changed. Verify the path matches your API route (e.g., `/api/webhooks/stripe`).
4. If 500: Check Sentry for the specific error in the webhook handler code.
5. Check if Vercel function timeout (10s) is exceeded during webhook processing.

**Fix Options**:
- If secret mismatch: Get the correct signing secret from Stripe Dashboard > Webhooks > Signing secret. Update in Vercel. Redeploy.
- If endpoint URL wrong: Update webhook endpoint URL in Stripe Dashboard.
- If handler bug: Fix the code, deploy, then replay failed events from Stripe Dashboard (Events > select event > Resend).
- If timeout: Optimize the handler to do minimal work synchronously. Queue heavy processing for later.

**Verification**: Trigger a test webhook from Stripe Dashboard > Webhooks > Send test webhook. Confirm 200 response. Replay recently failed events and verify database state matches Stripe.

---

## 5. High Error Rate Post-Deploy

**Symptoms**: Sentry error count jumps 5-10x within minutes of a Vercel deployment, multiple new issues created.

**Diagnosis**:
1. Check Sentry > Issues, filter by "First Seen" in last hour — identify new errors.
2. Check if errors are from one route/component or widespread.
3. Check if environment variables are present in the new deployment (`vercel env ls`).
4. Check build logs for warnings that became runtime errors.
5. Compare the deploy diff (`git diff HEAD~1`) for obvious issues.

**Fix Options**:
- If S1/S2 (auth/payments/core broken): Rollback immediately via Vercel Dashboard > Deployments > select previous > Promote to Production.
- If S3 (one feature broken): Evaluate fix time. If < 30 min, hotfix. Otherwise rollback and fix in a branch.
- If env var missing: Add the variable in Vercel Dashboard > Settings > Environment Variables. Redeploy.
- If dependency issue: Pin the problematic dependency version in `package.json`. Redeploy.

**Verification**: After rollback — confirm error rate returns to pre-deploy baseline in Sentry. After hotfix — confirm the specific error stops recurring.

---

## 6. Vercel Function Timeout / Memory Exceeded

**Symptoms**: Specific routes return 504 Gateway Timeout or "FUNCTION_INVOCATION_TIMEOUT," Sentry shows timeout errors, typically on Discogs import or heavy aggregation routes.

**Diagnosis**:
1. Check Vercel Dashboard > Functions > identify which function is timing out.
2. Check function duration metrics — is it consistently near the limit (10s Hobby / 60s Pro)?
3. Profile the route: is it making too many sequential database queries? Calling Discogs API inline?
4. Check if the function is loading excessive data into memory (large collection fetches without pagination).

**Fix Options**:
- If Discogs import route: Move to background processing via Supabase Edge Function. Do not process inline.
- If heavy aggregation: Pre-compute with materialized views or Redis cached results. Serve from cache.
- If N+1 queries: Batch database queries with joins or use Drizzle's relational query API.
- If memory: Implement pagination/streaming. Do not load entire collections into memory.
- If on Hobby tier and optimization is insufficient: Upgrade to Vercel Pro ($20/mo) for 60s timeout and 3x memory.

**Verification**: Hit the problematic route. Confirm it responds within the timeout limit. Check Vercel function metrics to verify duration decreased.
