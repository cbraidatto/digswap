# Vercel Deploy Patterns

Next.js 15 deployment patterns and configuration for DigSwap on Vercel.

## Next.js 15 on Vercel

DigSwap uses Next.js 15 with the App Router, Server Actions, and Sentry integration (`withSentryConfig` in `apps/web/next.config.ts`). Key Vercel-optimized features in use:

- **ISR (Incremental Static Regeneration)**: Use for release pages and public profiles that change infrequently. Set `revalidate` in page-level `generateStaticParams` or fetch options.
- **Edge Functions**: Middleware runs on the Edge Runtime for CSP nonce injection and auth refresh (`apps/web/src/middleware.ts`).
- **Fluid Compute**: Vercel automatically optimizes function cold starts. No config needed.
- **Server Actions**: Body size limit set to 6MB in `next.config.ts` for import operations.

## Function Timeout Limits

| Tier | Timeout | DigSwap Impact |
|------|---------|----------------|
| Hobby | 10s | Discogs import worker batches must complete in <10s per invocation |
| Pro | 60s | Sufficient for most operations including Stripe webhook processing |
| Enterprise | 300s | Not needed for DigSwap |

Design server actions and API routes to complete within 10s. The Discogs import worker (`IMPORT_WORKER_SECRET` authenticated) breaks large imports into small batches with self-invocation chaining.

## Build Configuration for Monorepo

DigSwap is structured as a monorepo with `apps/web/` as the primary app. Vercel project settings:

- **Root Directory**: `apps/web`
- **Build Command**: `next build` (default, uses `apps/web/package.json` scripts)
- **Output Directory**: `.next` (default)
- **Install Command**: Use workspace-aware install from repo root
- **Node.js Version**: 20.x (LTS)

The build produces source maps for Sentry upload but `productionBrowserSourceMaps: false` in `next.config.ts` ensures they are never served to browsers.

## Preview Deployments

Every push to a non-production branch creates a preview deployment:

- Preview URL format: `digswap-<hash>-<team>.vercel.app`
- Use Vercel's branch protection to require status checks before merge
- Preview deployments should use separate env var values (test Stripe keys, branch Supabase DB)
- Set `NEXT_PUBLIC_SITE_URL` to the preview URL dynamically using `VERCEL_URL`

## Custom Domain Setup

1. Add domain in Vercel project settings > Domains
2. Configure DNS: CNAME to `cname.vercel-dns.com` or A record to Vercel IP
3. SSL is automatic (Let's Encrypt) and includes auto-renewal
4. Redirect www to apex (or vice versa) in Vercel settings

## Recommended vercel.json

DigSwap does not currently use a `vercel.json`. Most config lives in `next.config.ts`. If needed:

```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "installCommand": "npm install",
  "functions": {
    "app/api/discogs/import/worker/route.ts": {
      "maxDuration": 60
    },
    "app/api/stripe/webhook/route.ts": {
      "maxDuration": 60
    }
  },
  "headers": []
}
```

Note: Security headers are already configured in `next.config.ts` (HSTS, X-Frame-Options, X-Content-Type-Options, Permissions-Policy). CSP is handled dynamically by middleware.

## Environment Variable Scoping

Vercel supports three scopes per env var:

- **Production**: Only applied to production deployments (main branch)
- **Preview**: Applied to all preview deployments (feature branches)
- **Development**: Available via `vercel env pull` for local development

Critical rule: `STRIPE_SECRET_KEY` with `sk_live_` prefix must ONLY be scoped to Production. Preview and Development must use `sk_test_` keys. Same principle applies to `DATABASE_URL` (never point preview at production database).
