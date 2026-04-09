# Capacity Planning

Concrete service tier limits, growth triggers, and cost forecasting for DigSwap infrastructure.

## Service Tier Limits

### Vercel

| | Hobby (Free) | Pro ($20/mo) |
|---|---|---|
| Function timeout | 10 seconds | 60 seconds |
| Function memory | 1024 MB | 3008 MB |
| Bandwidth | 100 GB/month | 1 TB/month |
| Function invocations | 1M/month | Unlimited |
| Deployments | Unlimited | Unlimited |
| Preview deployments | Unlimited | Unlimited |
| Image optimization | 1000/month | 5000/month |
| Cron jobs | None | Up to 60s interval |

### Supabase

| | Free | Pro ($25/mo) |
|---|---|---|
| Database size | 500 MB | 8 GB |
| Bandwidth | 2 GB/month | 250 GB/month |
| Realtime connections | 200 concurrent | 500 concurrent |
| Auth MAU | 50,000 | 100,000 |
| Edge Function invocations | 500K/month | 2M/month |
| Storage | 1 GB | 100 GB |
| Daily backups | 7 days | 14 days |
| Connection pooling (PgBouncer) | Yes | Yes |

### Upstash Redis

| | Free | Pay-as-you-go ($10/mo base) |
|---|---|---|
| Commands/day | 10,000 | 10K free, then $0.2/100K |
| Storage | 256 MB | 1 GB+ |
| Concurrent connections | 200 | 1,000 |
| Regions | 1 | Multi-region available |

### Resend

| | Free | Pro ($20/mo) |
|---|---|---|
| Emails/day | 100 | 50,000 |
| Emails/month | 3,000 | 50,000 |
| Custom domains | 1 | Unlimited |
| Webhooks | Yes | Yes |

### Sentry

| | Free (Developer) | Team ($26/mo) |
|---|---|---|
| Errors/month | 5,000 | 50,000 |
| Transactions/month | 10,000 | 100,000 |
| Attachments | 1 GB | 1 GB |
| Data retention | 30 days | 90 days |

### Discogs API

| Tier | Rate Limit |
|---|---|
| Authenticated | 60 requests/minute |
| Unauthenticated | 25 requests/minute |
| Large collection import (5000 records) | ~84 minutes at full rate (60 req/min) |

## Growth Triggers — When to Upgrade

| Signal | Threshold | Action | Cost Impact |
|--------|-----------|--------|-------------|
| Discogs imports timing out | > 10s on Hobby | Upgrade Vercel to Pro | +$20/mo |
| Database approaching 400 MB | 80% of 500 MB limit | Upgrade Supabase to Pro | +$25/mo |
| Realtime connections > 150 | 75% of 200 limit | Upgrade Supabase to Pro | +$25/mo |
| Redis commands > 8K/day | 80% of 10K daily limit | Upgrade Upstash to paid | +$10/mo |
| Emails > 80/day consistently | 80% of 100/day limit | Upgrade Resend to Pro | +$20/mo |
| Sentry errors > 4K/month | 80% of 5K limit | Upgrade Sentry to Team | +$26/mo |
| Vercel bandwidth > 80 GB | 80% of 100 GB limit | Upgrade Vercel to Pro | +$20/mo |

## Cost Estimation

### Pre-Launch / MVP (0-100 users)
All free tiers: **$0/month**

### Early Growth (100-1,000 users)
- Vercel Pro: $20/mo (function timeouts will be the first pain point)
- Everything else on free tiers
- **$20/month**

### Growth (1,000-5,000 users)
- Vercel Pro: $20/mo
- Supabase Pro: $25/mo (database size and realtime connections)
- Upstash paid: $10/mo (leaderboard operations at scale)
- **$55/month baseline**

### Scale (5,000-20,000 users)
- Vercel Pro: $20/mo
- Supabase Pro: $25/mo + storage addons
- Upstash Pro: $10-30/mo
- Resend Pro: $20/mo (notification volume)
- Sentry Team: $26/mo
- TURN relay: $5-20/mo (for WebRTC NAT traversal)
- **$106-151/month**

## Discogs Import Strategy

The 60 req/min rate limit is the hardest constraint to work around:

- **Small collections (< 500 records)**: Import inline, takes < 9 minutes. Show progress bar.
- **Medium collections (500-2000 records)**: Background job via Supabase Edge Function. Notify when done.
- **Large collections (2000-5000 records)**: Chunked background import across multiple Edge Function invocations. Resume on failure.
- **Incremental sync**: After initial import, only fetch changes since `last_sync_at`. Discogs API supports `sort=added&sort_order=desc`.
- **Cache aggressively**: Store release metadata in PostgreSQL. Discogs data rarely changes. Only re-fetch on user request.
