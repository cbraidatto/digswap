# Production Readiness Review (PRR)

Google-style PRR adapted for a solo developer shipping DigSwap on managed infrastructure.

## Objective

Systematically verify that a service or feature is ready for production traffic. The review produces a go/no-go decision with documented evidence for each category.

## When to Run

- Before initial launch to real users.
- Before enabling a major new feature (P2P trading, Stripe billing, Discogs import).
- Before upgrading a critical dependency (Supabase, Next.js major version, Drizzle).
- After a significant architecture change.

## Categories

### 1. Reliability

| Check | Evidence Required | Status |
|-------|-------------------|--------|
| SLOs defined in `sla-budget.md` | SLO document exists with concrete targets | |
| Error budget tracking in place | Weekly review process documented | |
| Health endpoint exists at `/api/health` | Endpoint returns 200 with service status | |
| Deep health check at `/api/health/deep` | Checks DB, Redis, Auth connectivity | |
| Rollback plan documented | Can revert via Vercel dashboard in < 2 minutes | |
| Database migrations are reversible | Down migrations exist for schema changes | |
| No single point of failure in application code | Graceful degradation when Redis/Discogs/PeerJS unavailable | |

### 2. Scalability

| Check | Evidence Required | Status |
|-------|-------------------|--------|
| Vercel function timeouts profiled | No route exceeds 8s on Hobby / 50s on Pro | |
| Database query performance tested | No query > 500ms under expected load | |
| Supabase connection pooling configured | Drizzle using pooler endpoint with `prepare: false` | |
| Redis usage within tier limits | Daily command count < 80% of tier limit | |
| Discogs rate limiting implemented | Upstash rate limiter with 60 req/min cap | |
| Large collection import is async | Background job with progress tracking and resume | |
| Image/asset optimization | Next.js Image component, appropriate caching headers | |

### 3. Observability

| Check | Evidence Required | Status |
|-------|-------------------|--------|
| Sentry configured with source maps | Errors have readable stack traces | |
| Sentry alert rules defined | Alerts for error spikes, new issues, and regressions | |
| Vercel analytics enabled | Speed Insights and Web Vitals tracking | |
| Stripe webhook monitoring | Failed delivery alerts configured in Stripe dashboard | |
| Structured logging in server actions | Consistent log format with request context | |
| Key business metrics tracked | Collection imports, trade initiations, signup rate | |

### 4. Incident Preparedness

| Check | Evidence Required | Status |
|-------|-------------------|--------|
| Incident runbooks exist | Runbooks for top 6 failure scenarios | |
| Severity levels defined | S1-S4 with response time expectations | |
| Rollback tested | Verified Vercel instant rollback works | |
| Communication plan exists | Status page or social media update process | |
| Post-mortem template ready | Template in `incident-response.md` | |
| Backup/restore tested | Supabase point-in-time restore verified | |

### 5. Security

| Check | Evidence Required | Status |
|-------|-------------------|--------|
| Defer to `digswap-appsec` skill | Full security review completed | |
| Secrets not in code | All secrets in environment variables, `.env` in `.gitignore` | |
| RLS policies active | Every table has appropriate Row Level Security | |
| Auth middleware on protected routes | Supabase auth verified in middleware and server actions | |
| HTTPS enforced | Vercel provides this by default | |

## Blockers vs Non-Blocking Concerns

**Blockers** (must fix before launch):
- Any check that would cause data loss if it fails.
- Any check that would cause extended downtime (> 1 hour) with no recovery path.
- Missing auth/authorization on mutation endpoints.
- No rollback capability.

**Non-blocking concerns** (track and fix post-launch):
- Observability gaps that reduce visibility but do not affect users.
- Performance issues that degrade experience but do not cause failures.
- Missing automation that increases toil but has manual workarounds.

## Deliverable

Use [templates/prr-report.md](../templates/prr-report.md) to produce the final report.

Overall recommendation is one of:
- **Ready**: All categories pass. No blockers. Ship it.
- **Ready with caveats**: Minor gaps documented. Ship with explicit follow-up timeline.
- **Not ready**: Blockers exist. Fix before launch. List specific blockers and estimated effort.
