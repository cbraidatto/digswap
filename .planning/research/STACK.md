# Stack Research — First Production Deploy

**Domain:** Production deployment of DigSwap webapp (Next.js 15 + Supabase Cloud) to Vercel + Hostinger domain
**Researched:** 2026-04-20
**Confidence:** HIGH (on deployment mechanics), MEDIUM (on cost/timing triggers — depends on traffic)

## Context

This stack research is **additive**, not foundational. The application stack is already validated and shipped in the repo (see `apps/web/package.json`). The question this file answers is:

> **"What do I need to install, configure, or sign up for to take the existing `apps/web` and run it on a real domain, served by Vercel, backed by a production Supabase project, for the first time — as a solo developer?"**

Everything listed below is scoped to getting to **first deploy + smoke-test green + UAT ready**. Post-launch observability/scaling triggers are flagged but not treated as required.

---

## Recommended Stack (Production Deploy Layer Only)

### Hosting & Edge (REQUIRED)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Vercel** (platform) | n/a (SaaS) | Host Next.js app, CDN, edge, SSL, previews | Native Next.js 15 optimization (ISR, Fluid Compute, Edge Functions). Automatic preview deploy per git push. Instant rollback at routing layer (seconds, no rebuild). Automatic SSL via Let's Encrypt. No server to manage — critical for solo dev. |
| **Vercel Pro plan** | $20/mo/seat | Commercial use license + real function budgets | **NOT optional once users pay.** Hobby plan is explicitly non-commercial per Fair Use Guidelines — Stripe revenue triggers a mandatory upgrade regardless of traffic. Pro also unlocks: 300s HTTP function timeout (vs 60s Hobby), 1 TB bandwidth (vs 100 GB), rollback to any prior deploy (Hobby = only the immediate previous), and pay-as-you-go overage. Safe pattern: start on Hobby for smoke/UAT, flip to Pro before the first paying user. |
| **Vercel CLI** | `vercel@latest` (v40+) | `vercel link`, `vercel env`, `vercel rollback`, `vercel logs`, local env pull | Install globally (`pnpm i -g vercel`). Lets you script env-var sync from `.env.local.example` into Vercel without pasting 20 values into the dashboard, and run `vercel rollback` from the terminal if the dashboard is down. |

### Domain & DNS (REQUIRED)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Hostinger DNS panel** | n/a | Authoritative DNS for the registered domain | Already owned (per milestone scope). No need to transfer the domain — just point records at Vercel. |
| **A record → 76.76.21.21** | — | Apex domain (`digswap.com`) pointing at Vercel | Vercel's official apex IP. Set in Hostinger DNS zone editor. Replace any existing A record for `@`. |
| **CNAME record → cname.vercel-dns.com** | — | `www` subdomain redirect target | Standard Vercel CNAME. Set in Hostinger as CNAME on host `www`. Vercel will handle `www → apex` 308 redirect automatically once the domain is added in the project settings. |

**Propagation:** 5 min to 48 hr. Plan to add the domain in Vercel first, then update Hostinger, then wait. Do NOT add production env vars that reference the domain (e.g. `NEXT_PUBLIC_SITE_URL`) before the domain resolves — you will chase ghosts.

### Database & Secret Storage (REQUIRED)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Supabase Cloud — new project (Prod)** | latest hosted | Production PostgreSQL + Auth + Storage + Realtime, fully isolated from dev | A separate project — not a branch, not a schema — is the cheapest/safest isolation. RLS policies, auth users, storage buckets are all per-project. The free tier (500 MB DB, 50K MAU, 1 GB storage) is sufficient to *launch*, but the free tier **pauses projects after 7 days of inactivity** — unacceptable for a live marketing-linked domain. Plan to upgrade to Pro ($25/mo) the day the domain goes live to the public. |
| **Supabase CLI** | `supabase@latest` (2.x, Apr 2026) | `supabase link`, `supabase db push`, `supabase migration list` — applies local migrations to prod | Already implied by the `supabase/migrations/` folder in the repo. Install globally or via `pnpm dlx supabase`. The production workflow is: `supabase link --project-ref <prod-ref>` → `supabase db push --dry-run` (review) → `supabase db push` (apply). Never run this on the dev project. |
| **Supabase Pro plan** | $25/mo (at trigger) | Daily automated backups, point-in-time recovery, no auto-pause, custom SMTP domain | **Required before public launch.** Free tier pausing = your domain goes down silently. Pro also unlocks custom SMTP (so Resend delivers `noreply@digswap.com` instead of via Supabase default domain on password reset emails). |

### Caching / Rate Limiting (REQUIRED)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Upstash Redis — new database (Prod)** | serverless, latest | Rate limiting for `/api/*`, Discogs API backoff, session cache | Already wired via `@upstash/ratelimit@^2.0.8` + `@upstash/redis@^1.37.0`. Audit finding P1 notes `rate-limit.ts` **fails closed** when Redis is missing — meaning without a prod Redis, login/signup/webhooks will 5xx. This makes a production Upstash DB **non-negotiable**, not optional. Free tier (500K commands/month) is enough for MVP; pay-per-request scales smoothly. Create as a separate DB from dev. |

### Observability & Error Tracking (REQUIRED for prod — already wired)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Sentry** (SaaS) | `@sentry/nextjs@^10.47.0` (pinned) | Error capture (server + client), source maps, performance traces | Already a dependency and wired in `next.config.ts` via `withSentryConfig`. Free developer tier: 5K errors/mo, 10K perf events, 50 replays — sufficient for soft launch. What's missing to finish the wiring: `sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts`, `app/global-error.tsx`, and `/sentry-example-page` for the post-deploy smoke. In 2026 the Sentry Next.js wizard generates all of these. |
| **SENTRY_AUTH_TOKEN** (env) | — | Source-map upload during build | Must be set in Vercel as a **secret** env var (build-only). Already in `.env.local.example`. Regenerate for prod — do not reuse the dev token. |
| **Vercel Analytics** (optional for v1) | bundled | Pageview + Web Vitals | Free on Hobby, included on Pro. Enable with one click in Vercel project settings. Provides Core Web Vitals without adding a second analytics vendor. Add only if UAT surfaces performance regressions — not a launch blocker. |

### Email (REQUIRED — already wired)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Resend** | `resend@^6.9.4` (pinned) | Transactional email: wantlist matches, password reset fallback, notifications | Already a dependency. Free tier: 3K emails/month / 100/day — enough for launch week. What's needed before first deploy: verify the **sending domain** (`digswap.com`) in Resend dashboard (DKIM + SPF + DMARC records added at Hostinger). Without domain verification, emails go to spam or fail. This takes ~15 min of DNS editing and usually propagates in under an hour. |

### Payments (REQUIRED only when activating billing — already wired)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Stripe** | `stripe@^21.0.1` (pinned) | Subscription billing, webhook intake at `/api/stripe/webhook` | Already a dependency. **Two distinct environments**: Test (dev) and Live (prod). You need to flip to Live keys in Vercel, create a *second* webhook endpoint in Stripe dashboard (`https://digswap.com/api/stripe/webhook` or wherever the route lives), copy that webhook's **signing secret** into `STRIPE_WEBHOOK_SECRET` in Vercel, and recreate the two Price IDs in Live mode (Test Price IDs don't work in Live). After any env var change: **redeploy without build cache** — Next.js bakes `NEXT_PUBLIC_*` at build time. |
| **Stripe CLI** (optional) | `stripe@latest` | Replay webhooks to prod during debugging | Install locally. `stripe listen --forward-to ...` is dev-only; for prod debugging use `stripe events resend <event_id> --live` when a webhook fails delivery. |

### CI/CD (REQUIRED — already partially wired)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **GitHub Actions** | `.github/workflows/ci.yml` (present) | Typecheck, lint, test, build, e2e on every push/PR | Already exists. Gaps for production: (a) no migration-apply job (migrations are applied manually via `supabase db push` from a workstation, which is fine for solo but should be documented); (b) no deploy job because Vercel's Git integration handles that natively — do not duplicate it in Actions. |
| **Vercel Git integration** | n/a | Auto-deploy `main` to production; every PR → preview URL | Set up once when importing the repo. Preview URLs are the UAT substrate — every PR becomes a click-testable deploy with its own Supabase? **No** — previews share the prod Supabase unless you explicitly set different env vars per environment (see §Env-var strategy below). For DigSwap, previews should point at the **dev** Supabase to avoid cross-contaminating prod data during PR review. |

### Version Pinning (Production-Critical)

| Package | Exact version present | Production Status |
|---------|----------------------|-------------------|
| `next` | `15.5.15` | HIGH — current 15.5.x line, stable for prod. Do NOT upgrade to 16 before launch (ecosystem still catching up on renamed middleware/proxy). |
| `react` + `react-dom` | `19.1.0` | Note: `package.json` declares React 19, not 18 as the old CLAUDE.md stack doc said. React 19 is supported by Next.js 15.5. Leave as-is; do not downgrade — that would require re-testing every component. |
| `@sentry/nextjs` | `^10.47.0` | HIGH — caret OK. |
| `@supabase/ssr` | `^0.9.0` | HIGH — this is the correct package for App Router (replaces deprecated `auth-helpers-nextjs`). |
| `drizzle-orm` | `^0.45.1` / `drizzle-kit@^0.31.10` | HIGH — versions are aligned. |
| `stripe` | `^21.0.1` | HIGH — current Stripe Node SDK. |
| `@upstash/ratelimit` | `^2.0.8` | HIGH. |
| `@upstash/redis` | `^1.37.0` | HIGH. |
| `resend` | `^6.9.4` | HIGH. |
| `zod` | `^4.3.6` | MEDIUM — Zod 4 is current but has breaking changes vs 3. Already adopted; keep as-is. |

**Lock file:** `pnpm-lock.yaml` must be committed (it is). CI uses `--frozen-lockfile` — any `package.json` change without a lockfile update will break Vercel's install step.

---

## Env-Var Strategy (REQUIRED)

The application's `.env.local.example` lists **21 env vars** across 8 domains. For Vercel, these split into three audiences: build-time/public, runtime/secret, and preview-vs-prod. Getting this wrong is the #1 cause of "works locally, 500s in production."

### Public vs Server Split

| Prefix | Where it lives | Rule |
|--------|----------------|------|
| `NEXT_PUBLIC_*` | Inlined into the client JS bundle at **build** time | Never put a secret here. Anyone viewing page source sees it. Baked at build, so changing it requires a redeploy (NOT just a restart). |
| (no prefix) | Server only, read at runtime | Safe for secrets. Changes take effect on next function cold start. |

### Variable Set for First Deploy

Organize Vercel env vars by **Environment** (Production / Preview / Development) — do NOT set them all as "All Environments" or previews will write to prod Supabase.

**Production-only (all secrets):**
- `DATABASE_URL` → prod Supabase pooler URL (`postgres://...pooler.supabase.com:6543/postgres?pgbouncer=true`)
- `NEXT_PUBLIC_SUPABASE_URL` → prod project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → prod anon key (public-safe)
- `SUPABASE_SERVICE_ROLE_KEY` → prod service role key (secret — bypasses RLS)
- `STRIPE_SECRET_KEY` → Live mode key (`sk_live_...`)
- `STRIPE_WEBHOOK_SECRET` → from the prod webhook endpoint in Stripe dashboard
- `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` + `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL` → Live mode Price IDs
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` → prod Upstash DB
- `DISCOGS_CONSUMER_KEY` + `DISCOGS_CONSUMER_SECRET` → same Discogs app as dev is acceptable if the callback list includes both dev + prod URLs; otherwise create a second Discogs app for prod
- `RESEND_API_KEY` → prod Resend API key (restricted-scope recommended)
- `RESEND_FROM_EMAIL` → `noreply@digswap.com` (domain must be verified in Resend)
- `NEXT_PUBLIC_SENTRY_DSN` → prod Sentry project DSN
- `SENTRY_ORG` + `SENTRY_PROJECT` → Sentry org/project slugs
- `SENTRY_AUTH_TOKEN` → **mark as "Sensitive" in Vercel** (build-only)
- `IMPORT_WORKER_SECRET` → **new** random 32-char string (do NOT reuse dev)
- `HANDOFF_HMAC_SECRET` → **new** random 32-char string, minimum 32 chars
- `NEXT_PUBLIC_SITE_URL` → `https://digswap.com`
- `NEXT_PUBLIC_APP_URL` → `https://digswap.com`
- `NEXT_PUBLIC_MIN_DESKTOP_VERSION` → `1` (already default)

**Preview-only (point at dev Supabase, test-mode Stripe):**
- Same set, but `NEXT_PUBLIC_SITE_URL` = `https://$VERCEL_URL` (Vercel auto-injects `VERCEL_URL`; wire it in a small helper: `process.env.NEXT_PUBLIC_SITE_URL ?? \`https://${process.env.VERCEL_URL}\``)
- Supabase = dev project keys
- Stripe = test-mode keys
- Redis = dev Upstash DB

**Secret generation** (use on any Unix host or Git Bash):
```bash
openssl rand -hex 32    # for IMPORT_WORKER_SECRET
openssl rand -hex 32    # for HANDOFF_HMAC_SECRET
```
Store in a password manager *before* pasting into Vercel.

---

## Installation (What to Install Beyond the Repo)

```bash
# Required globally (one-time)
pnpm add -g vercel            # Vercel CLI (v40+ as of Apr 2026)
pnpm add -g supabase          # Supabase CLI (v2+)

# Optional but recommended for debugging prod
pnpm add -g stripe            # Stripe CLI — for webhook replay/event inspection

# One-time account setup (each has a CLI login flow)
vercel login                  # → opens browser, auths GitHub
supabase login                # → opens browser for access token
stripe login                  # → optional, for CLI-based webhook work
```

**No new runtime dependencies need to be added to `package.json`** for first deploy — the app already has everything it needs. The work is configuration, not code.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Vercel** | Netlify / Cloudflare Pages / Railway | Netlify: if you hit a Next-15-specific Vercel bug. Cloudflare: if bandwidth cost explodes (Cloudflare has generous free bandwidth, but Next.js 15 on Workers requires `@opennextjs/cloudflare` adapter and not every Next feature works). Railway: if you eventually need long-lived processes (background workers for Discogs imports, PeerJS signaling). For first deploy, Vercel's Next-native integration beats all three. |
| **Hostinger DNS (current)** | Cloudflare DNS | Cloudflare as DNS-only (not proxied) gives faster propagation, better DNSSEC support, free. Move later if Hostinger's TTL or interface becomes painful — but not a launch blocker. |
| **Supabase Cloud Pro ($25/mo)** | Self-hosted Supabase on a VPS | Only if you're already comfortable running Postgres + PgBouncer + GoTrue + Realtime on your own infra. For a solo dev on first deploy: do not self-host. The $25/mo is cheaper than 4 hours of your debugging time. |
| **Sentry** | Vercel Log Drains → Datadog/BetterStack, or Logtail, or Axiom | If Sentry's error-capture model is overkill and you just want log streams. But Sentry is already wired — don't add a second vendor unless you have a reason. Datadog has a $31/mo minimum — not solo-dev friendly. |
| **Resend (current)** | Postmark / SendGrid / AWS SES | Postmark has better deliverability reputation but starts at $15/mo. SES is pennies-cheap but requires AWS account + sandbox-removal ticket. Resend's free tier + React Email integration is the solo-dev winner. |
| **Vercel Git integration auto-deploy** | GitHub Actions → `vercel deploy --prebuilt` | If you need a pre-deploy gate (e.g. require passing E2E before promoting to prod), move deploy into GHA and have it promote manually. For v1: Vercel's auto-deploy-on-push-to-main is simpler and still gives you instant rollback. |
| **Vercel Pro instant-rollback** | Feature flags (LaunchDarkly, Unleash) | Flags let you disable a broken feature without reverting code. Add in a later milestone; rollback is enough for v1.4. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Multiple environment.env files committed to git** | Even with `.gitignore` correct, one slip = secrets on GitHub forever. | `.env.local` (gitignored) + Vercel dashboard + local secret manager (1Password, Bitwarden) for backups. |
| **Supabase dev project reused for prod** | Dev data bleeds into prod user list, RLS bugs can expose internal test accounts to real users, and any seed/truncate destroys real users. | Separate Supabase project (new org slot on free tier, then Pro). |
| **Vercel Hobby with real users paying via Stripe** | Violates Vercel Fair Use Guidelines. They can suspend the project — and your domain stops resolving. | Flip to Pro before the first paid signup. Monthly cost is less than one Premium subscription. |
| **`getSession()` in new code** | Already a project convention (per CLAUDE.md key decision) — doesn't validate JWT signature. | `getClaims()` — enforced in middleware and server actions. |
| **Running `supabase db push` against prod from a feature branch** | There's no dry-run gate, and a half-merged branch can push a partial migration. | Only push from `main` after merge. Always `--dry-run` first. |
| **Setting env vars as "All Environments" in Vercel** | Previews will write to prod Supabase / trigger real Stripe charges. | Set prod vars as "Production", set preview vars as "Preview" — duplicated with dev values. |
| **`productionBrowserSourceMaps: true`** | Leaks original source code in browser devtools. Already `false` in `next.config.ts` — keep it. | Upload source maps to Sentry only (via `SENTRY_AUTH_TOKEN`), not to the public bundle. |
| **Same `HANDOFF_HMAC_SECRET` / `IMPORT_WORKER_SECRET` in dev and prod** | Dev log exposure compromises prod. | Generate fresh 32-byte secrets per environment. |
| **Setting Vercel Rolling Releases on v1** | Adds gradual rollout complexity. | Instant rollback is enough for a solo dev on first deploy. Add Rolling Releases when you have real traffic. |
| **Next.js 16** | Renames middleware→proxy, removes sync request APIs, shadcn/Auth ecosystem still catching up as of Apr 2026. | Stay on 15.5.x until Q3 2026 at earliest. |

---

## Stack Patterns by Variant

**If launching with a closed private UAT first (recommended):**
- Deploy to a Vercel preview URL (`digswap-<hash>.vercel.app`) — no domain yet
- Use dev Supabase temporarily so UAT data isn't locked into prod
- Point 3–5 trusted testers at the preview URL
- Fix issues, then flip to prod Supabase + custom domain

**If launching directly to public `digswap.com`:**
- Must have prod Supabase Pro (no auto-pause), domain DNS live, Stripe Live webhook registered, Sentry prod DSN wired, and a `/api/health` endpoint returning 200 from a post-deploy smoke script — all before first tweet.

**If Stripe billing is deferred (launch without payments):**
- Stripe env vars still need to be set with Test-mode values (env.ts Zod validation requires them present, per CI config)
- `STRIPE_WEBHOOK_SECRET` can be any valid-looking placeholder as long as the webhook route is not publicly linked
- Saves $0 but defers ~1 hr of configuration

**If launching from Brazil / LATAM:**
- Set Vercel project region to `gru1` (São Paulo) or `iad1` (US-East)
- Set Supabase project region to closest — database latency dominates cold-start perf. If users are global-first (digger audience is worldwide), `iad1` + Supabase `us-east-1` is the neutral default.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `next@15.5.15` | `react@19.1.0` + `react-dom@19.1.0` | Next 15.5 supports React 19. Already pinned. |
| `@sentry/nextjs@^10.47` | `next@15.5.x` | Supports App Router + Turbopack dev. Requires source maps enabled for release (`widenClientFileUpload: true` already set). |
| `@supabase/ssr@^0.9` | `@supabase/supabase-js@^2.100` | Correct SSR adapter for Next App Router. |
| `drizzle-orm@^0.45.1` | `postgres@^3.4.8` + Supabase PgBouncer | Connection string MUST include `?pgbouncer=true&connection_limit=1` against pooler; direct connection (port 5432) if running migrations. |
| `stripe@^21.0.1` | Node 20+ | CI uses Node 20 — good. |
| `@upstash/ratelimit@^2.0.8` | `@upstash/redis@^1.37` | Major versions of both aligned. |
| `resend@^6.9.4` | React Email 3+ (if used for templates) | Not in the current dep list; templates are plain HTML/string — fine. |
| Vercel Node runtime | Node 22 default as of 2026 | Next.js 15.5 supports Node 20 + 22; CI uses 20. **Pin Vercel runtime to 20** under Project Settings → General → Node.js Version for parity with CI. |

---

## Pre-Deploy Audit Already Passed (per commit `35ed595`)

These are flagged here so the research file stays accurate — no action needed, but the milestone inherits the work:

- [x] Build blocker in `gems/queries.ts` (P0)
- [x] Drizzle vs `supabase/migrations/` drift (P0)
- [x] Cold-start 500s on public routes (P0)
- [x] Playwright E2E config stability (P0)
- [x] Private invite flow with correct token URL (P1)
- [x] Session revocation correctness (P1)
- [x] Env validation + rate-limit fail-closed behavior (P1)
- [x] Trade/follow FK integrity (P1)
- [x] Discogs token encryption at rest (P1)

**Outstanding from audit before deploy:** per memory/project_security_posture.md, one CSP item still open — verify before shipping.

---

## Required vs Optional (Solo-Dev Triage)

### REQUIRED before touching prod domain
1. Vercel account + Vercel CLI installed + project imported from GitHub
2. Supabase prod project created + linked via CLI
3. Production migrations applied (`supabase db push`) + RLS spot-checked (run the 59-policy smoke from `digswap-dba` skill)
4. Upstash prod Redis DB created
5. Sentry prod project created + DSN + auth token generated
6. Resend prod API key + sending domain verified (DKIM/SPF/DMARC in Hostinger)
7. Stripe Live mode enabled (account fully activated — requires tax info, bank account, business details — can take 1–3 business days; do this **first**)
8. Stripe Live webhook endpoint registered + signing secret copied
9. Discogs app callback URL list includes prod URL
10. All 21 env vars set in Vercel (Production scope)
11. Hostinger A + CNAME records updated
12. `/api/health` endpoint exists and returns 200 with dependency checks (DB + Redis + Supabase ping)
13. Instant rollback tested once (deploy → rollback → redeploy) before touching the domain

### OPTIONAL for first deploy — add after traction
- Vercel Analytics (free on Hobby)
- Vercel Log Drains → external log store
- Vercel Rolling Releases (gradual rollout)
- Cloudflare in front of Vercel (DDoS + cache layer)
- UptimeRobot / BetterStack external ping on `/api/health` (free tiers exist — 50-ping checks). Strongly recommended within week 1, just not a launch gate.
- Supabase database branching (not needed until multiple devs)
- Status page (only useful once you have >10 concurrent users)

### Cost Summary (month 1)

| Service | Plan | Monthly | Triggers upgrade |
|---------|------|---------|------------------|
| Vercel | Hobby → Pro | $0 → $20 | First paying user or public launch |
| Supabase | Free → Pro | $0 → $25 | Public launch (auto-pause risk) |
| Upstash Redis | Free | $0 | >500K commands/month |
| Sentry | Developer (free) | $0 | >5K errors/mo |
| Resend | Free | $0 | >3K emails/mo or >100/day |
| Stripe | Pay-per-transaction | $0 | Per-charge 2.9% + 30¢ |
| Hostinger domain | existing | — | N/A |
| **Total floor (launched publicly)** | | **~$45/mo** | Plus usage overages if they happen |

Compared to $10–30K for an enterprise stack. $45/mo is the correct order of magnitude for a solo-dev MVP serving real users.

---

## Sources

- [Vercel Pricing & Hobby Plan limits](https://vercel.com/pricing) — HIGH confidence, official
- [Vercel Hobby Plan non-commercial clause](https://vercel.com/docs/plans/hobby) — HIGH confidence, official
- [Vercel Instant Rollback docs](https://vercel.com/docs/instant-rollback) — HIGH confidence, official
- [Vercel Environment Variables docs](https://vercel.com/docs/environment-variables) — HIGH confidence, official
- [Vercel Domains — Adding a domain](https://vercel.com/docs/domains/working-with-domains/add-a-domain) — HIGH confidence, official
- [Vercel DNS records reference](https://vercel.com/docs/domains/managing-dns-records) — HIGH confidence, official (apex IP `76.76.21.21`, CNAME `cname.vercel-dns.com`)
- [Supabase Pricing](https://supabase.com/pricing) — HIGH confidence, official (Pro $25/mo, free tier 7-day pause)
- [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations) — HIGH confidence, official
- [Supabase CLI `db push` reference](https://supabase.com/docs/reference/cli/supabase-db-push) — HIGH confidence, official
- [Supabase Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments) — HIGH confidence, official
- [Sentry Next.js manual setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/) — HIGH confidence, official
- [Sentry Next.js build options](https://docs.sentry.dev/platforms/javascript/guides/nextjs/configuration/build/) — HIGH confidence, official (source map handling for Turbopack vs Webpack)
- [Stripe Subscription Starter (Vercel official template)](https://vercel.com/templates/next.js/subscription-starter) — HIGH confidence, official
- [Stripe webhook signature verification in Next.js](https://maxkarlsson.dev/blog/verify-stripe-webhook-signature-in-next-js-api-routes) — MEDIUM confidence, practitioner, verified against Stripe docs
- [Next.js health check endpoint pattern](https://nurbak.com/en/blog/health-check-endpoint/) — MEDIUM confidence, practitioner
- [Upstash Redis pricing](https://upstash.com/pricing/redis) — HIGH confidence, official
- [Resend Next.js integration + domain verification](https://resend.com/nextjs) — HIGH confidence, official
- [Hostinger → Vercel setup walkthrough](https://medium.com/@rajanraj8979/learn-how-to-connect-your-hostinger-domain-to-your-vercel-deployed-project-with-this-easy-966f082919f3) — MEDIUM confidence, practitioner, cross-verified with Vercel docs
- Repo file `apps/web/package.json` — current dependency set (HIGH, source of truth)
- Repo file `apps/web/.env.local.example` — 21 env vars required (HIGH, source of truth)
- Repo file `apps/web/next.config.ts` — Sentry + security headers already wired (HIGH)
- Repo file `.github/workflows/ci.yml` — CI gates: lint/typecheck/test/build/e2e (HIGH)
- Repo file `.planning/quick/260406-aud-deploy-readiness-audit/260406-aud-SUMMARY.md` — pre-deploy blocker list, most fixed per commit `35ed595` (HIGH)

---

*Stack research for: first production deploy of DigSwap webapp*
*Researched: 2026-04-20*
*Scope: deploy-layer only — application stack was validated in prior milestones*
