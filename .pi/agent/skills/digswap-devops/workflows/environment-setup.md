# Workflow: Environment Setup

## Objective

Provision a new DigSwap environment from zero. Use when creating a staging environment, onboarding a new deployment target, or recovering from a lost environment configuration.

## Read First

- [references/environment-strategy.md](../references/environment-strategy.md)
- [references/vercel-deploy-patterns.md](../references/vercel-deploy-patterns.md)
- [references/supabase-production.md](../references/supabase-production.md)

## Steps

### 1. Vercel Project

1. Create project in Vercel dashboard linked to the Git repository.
2. Set **Root Directory** to `apps/web`.
3. Set **Framework Preset** to Next.js.
4. Set **Node.js Version** to 20.x.
5. Configure build command: `next build` (default).
6. **Verify**: Trigger a deploy and confirm the build succeeds with placeholder env vars.

### 2. Supabase Project

1. Create a new Supabase project (or branch for preview environments).
2. Note the **Project URL**, **Anon Key**, **Service Role Key**, and **Connection Pooler URL** (port 6543).
3. Run database migrations: `npx drizzle-kit migrate` using the direct connection URL (port 5432).
4. Enable RLS on all tables: run `supabase db lint` to verify.
5. Configure Auth providers (email/password, Discogs OAuth callback URL).
6. **Verify**: Connect with `psql` or Supabase SQL Editor and confirm tables exist with RLS enabled.

### 3. Environment Variables in Vercel

1. Add all server-only vars from [environment-strategy.md](../references/environment-strategy.md) scoped to the correct environment.
2. Add all public vars.
3. For preview environments: use test/dev values for Stripe, separate Upstash DB, branch Supabase URL.
4. **Verify**: Run `vercel env pull .env.local` locally and confirm the Zod validation passes when starting the dev server.

### 4. Upstash Redis

1. Create a new Redis database at [console.upstash.com](https://console.upstash.com).
2. Copy the REST URL and REST Token.
3. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to Vercel env vars.
4. **Verify**: Confirm rate limiting works by hitting a protected route and checking the Upstash dashboard for command count.

### 5. Stripe Webhook Endpoint

1. In Stripe Dashboard > Developers > Webhooks, add an endpoint.
2. URL: `https://<domain>/api/stripe/webhook`
3. Events to listen for: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET` in Vercel.
5. For local development: use `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
6. **Verify**: Trigger a test event from Stripe dashboard and confirm it reaches the webhook route (check Vercel function logs or Sentry).

### 6. Sentry Project

1. Create a project in Sentry (Next.js platform).
2. Note the DSN, org slug, and project slug.
3. Create an auth token with `project:releases` and `org:read` scopes.
4. Add `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` to Vercel env vars.
5. **Verify**: Deploy and trigger an intentional error. Confirm it appears in Sentry with deobfuscated stack traces.

### 7. DNS Configuration

1. Add the custom domain in Vercel project settings.
2. Set DNS records per Vercel instructions (CNAME or A record).
3. Wait for DNS propagation (typically 5-30 minutes).
4. **Verify**: `dig <domain>` resolves to Vercel. HTTPS works without warnings. HSTS header present.

## Post-Setup Validation

Run the full [deploy-readiness workflow](./deploy-readiness.md) against the new environment to confirm everything is wired up correctly.
