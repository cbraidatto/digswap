# Production Readiness Review Report

## Service Information

| Field | Value |
|-------|-------|
| Service / Feature | [name] |
| Date | [YYYY-MM-DD] |
| Reviewer | [name or "self-review"] |
| Target Environment | Vercel + Supabase + Upstash |

## Category Results

| Category | Status | Notes |
|----------|--------|-------|
| Reliability | Pass / Partial / Fail | |
| Scalability | Pass / Partial / Fail | |
| Observability | Pass / Partial / Fail | |
| Incident Preparedness | Pass / Partial / Fail | |
| Security | Pass / Partial / Fail | (defer details to appsec) |

## Blockers

Items that must be resolved before production. Each blocker prevents a "Ready" recommendation.

- [ ] [Blocker description — what is missing, what risk it creates, estimated effort to fix]
- [ ] ...

## Non-Blocking Concerns

Issues that should be addressed post-launch but do not prevent shipping.

- [ ] [Concern — what it is, what impact if left unaddressed, suggested timeline]
- [ ] ...

## Capacity Headroom

| Service | Current Usage | Tier Limit | Headroom | Upgrade Trigger |
|---------|--------------|------------|----------|-----------------|
| Vercel (bandwidth) | X GB | 100 GB | X% | 80 GB |
| Supabase (DB size) | X MB | 500 MB | X% | 400 MB |
| Supabase (realtime) | X conn | 200 conn | X% | 150 conn |
| Upstash (commands) | X/day | 10K/day | X% | 8K/day |
| Resend (emails) | X/day | 100/day | X% | 80/day |
| Sentry (errors) | X/month | 5K/month | X% | 4K/month |

## Overall Recommendation

**[ Ready / Ready with caveats / Not ready ]**

[1-3 sentences summarizing the decision. If "Ready with caveats," list the caveats and the timeline for addressing them. If "Not ready," list the blockers that must be resolved first.]
