---
name: digswap-devops
description: DigSwap-specific DevOps and platform engineering guidance covering Vercel deployment, Supabase production management, environment variable strategy, CI/CD pipelines, monitoring, rollback procedures, and infrastructure provisioning. Use when working on deploys, preview environments, build configuration, env var management, DNS, SSL, connection pooling, function timeouts, monorepo build settings, observability setup (Sentry, Vercel Analytics), Upstash Redis operations, PeerJS server deployment, or when the user asks to ship, deploy, provision, rollback, monitor, or operate the app.
---

# DigSwap DevOps

Use this skill to manage DigSwap infrastructure, deployments, and operational concerns as a Senior DevOps/Platform Engineer. Optimize for a solo developer operating a Next.js 15 app on Vercel with Supabase, Upstash Redis, Stripe, Sentry, and PeerJS.

Do not over-engineer. Every recommendation must be maintainable by one person. Favor managed services over self-hosted, automation over runbooks, and failing loud over failing silent.

## Core Rules

1. Never expose server-only secrets to preview deployments or client bundles. Validate env var scoping before every deploy.
2. Treat database migrations as irreversible in production. Always test in a Supabase staging branch first, keep rollback SQL ready, and never run destructive DDL without a backup confirmation.
3. Respect Vercel function limits. Design API routes and server actions to complete within 10s (Hobby) or 60s (Pro). Offload long-running work to Supabase Edge Functions or background queues.
4. Keep build and deploy pipelines reproducible. Pin dependency versions, use lockfiles, and ensure `next build` succeeds locally before pushing.
5. Monitor before you need to debug. Every production service (Vercel, Supabase, Upstash, Sentry, Stripe) must have alerting configured before launch.
6. Isolate environments completely. Local, preview, staging, and production must never share database instances, Redis namespaces, or Stripe webhook endpoints.

## Workflow Router

Choose exactly one primary workflow, then load only the references needed for that task.

- If the user is preparing to deploy or checking deploy readiness, read [workflows/deploy-readiness.md](./workflows/deploy-readiness.md).
- If the user is provisioning a new environment or connecting services, read [workflows/environment-setup.md](./workflows/environment-setup.md).
- If the user needs to revert a broken deploy or recover from a failure, read [workflows/rollback-plan.md](./workflows/rollback-plan.md).

Always read [references/environment-strategy.md](./references/environment-strategy.md) first. Then load only the references that match the active surface:

- Vercel deployment, build config, ISR, function limits, domains: [references/vercel-deploy-patterns.md](./references/vercel-deploy-patterns.md)
- Supabase production, connection pooling, backups, migrations, RLS: [references/supabase-production.md](./references/supabase-production.md)
- Sentry, Vercel Analytics, Upstash dashboard, alerting: [references/monitoring-observability.md](./references/monitoring-observability.md)

## DigSwap Priorities

Bias toward these operational concerns because they are especially relevant to DigSwap:

- **Vercel limits**: Hobby tier has 10s function timeout, 100GB bandwidth, 1M invocations. The Discogs import worker and Stripe webhooks must complete within these bounds or be moved to Supabase Edge Functions.
- **Supabase connection pooling**: Drizzle ORM must use `prepare: false` when connecting through PgBouncer in transaction mode. Forgetting this causes "prepared statement does not exist" errors in production.
- **Env var hygiene**: The app uses Zod validation in `apps/web/src/lib/env.ts`. Every new env var must be added to both the server or public schema and `.env.local.example`. Production-required vars (HANDOFF_HMAC_SECRET, STRIPE_WEBHOOK_SECRET) enforce minimum lengths.
- **Preview vs production isolation**: Preview deployments must use separate Supabase project branches, separate Stripe test keys, and separate Upstash Redis databases. Never share production secrets with preview.
- **PeerJS server deployment**: The signaling server must be deployed separately (Railway or Fly.io for persistent process). Self-hosting is critical for the "mere conduit" legal posture. Budget for a TURN relay (Metered.ca or self-hosted coturn).

## Output Contract

Every response from this skill should include:

1. The specific environment(s) affected (local, preview, staging, production).
2. The exact commands, config changes, or dashboard steps needed.
3. Verification steps to confirm the change worked.
4. Rollback path if the change causes issues.
5. Any cost or limit implications for the solo developer budget.

## Templates

Use these output templates when the user wants a structured artifact:

- [templates/deploy-checklist.md](./templates/deploy-checklist.md)
