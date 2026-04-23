# Architecture Research — Production Deploy Topology

**Domain:** First production deploy of a Next.js 15 + Supabase Cloud webapp on Vercel
**Researched:** 2026-04-20
**Confidence:** HIGH — grounded in the existing repo, current Vercel/Supabase docs, and the 2026-04-06 deploy-readiness audit
**Scope:** Deploy topology only. Application-level architecture (RLS model, P2P trade flow, feature boundaries) is already documented elsewhere and out of scope here.

---

## 1. Executive Answer

- **Exactly two pieces of infrastructure carry load in prod:** the Vercel project (hosts the Next.js app, all API route handlers, all server actions, cron-like via Vercel Cron not used yet) and the Supabase Cloud project (Postgres + Auth + Realtime + Storage + Edge Functions + pg_cron). Everything else (Hostinger, Stripe, Discogs, Resend, Upstash, Sentry) is a managed third party reached over HTTPS from one of those two.
- **The monorepo maps cleanly:** only `apps/web` is deployed to Vercel. `apps/desktop` is not deployed (Electron, v1.5 milestone). `packages/trade-domain` is a workspace package consumed by `apps/web` at build time — it does not deploy anywhere. `supabase/functions/` is deployed to Supabase (not Vercel). `supabase/migrations/` is applied to the Supabase Postgres project via `supabase db push`.
- **Dev → Prod changes are mostly environmental, not architectural:** a new Supabase project, a new Vercel project, a real domain, new OAuth client credentials, a real Stripe webhook endpoint, and a real Upstash DB. The code does not fork between environments — it reads from `process.env`.
- **Two hard sequencing constraints:** (1) Supabase prod project must exist and have the schema applied before Vercel env vars can point at it; (2) DNS must resolve to Vercel and SSL must be live before the Discogs OAuth callback, the Google/GitHub OAuth redirect URIs, and the Stripe webhook endpoint can be finalized, because those all require the production URL as input.
- **One drift risk still open from the audit:** `drizzle/` (Drizzle Kit journal) and `supabase/migrations/` are two separate migration trails for the same database. Prod must be applied through exactly one trail — recommend `supabase/migrations/` (via `supabase db push`) as the source of truth because it already contains all hand-written RLS, pg_cron, pg_net wiring, and Vault reads that Drizzle Kit cannot generate.

---

## 2. Deploy Topology

### 2.1 Where each thing runs

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                  INTERNET                                   │
│                                                                             │
│   digger (browser)           Stripe           Discogs           Google       │
│        │                       │                │                │           │
│        │ HTTPS                 │ webhook        │ OAuth          │ OAuth     │
│        ▼                       ▼                ▼                ▼           │
│  ┌──────────────┐                                                            │
│  │ Hostinger    │  DNS only. A / CNAME → Vercel edge.                        │
│  │   DNS zone   │  No hosting, no mail, no TLS termination here.             │
│  └──────┬───────┘                                                            │
│         │                                                                    │
└─────────┼────────────────────────────────────────────────────────────────────┘
          │ resolves to
          ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                                VERCEL (prod project)                        │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Vercel Edge Network (TLS, CDN, static /_next/static, images)        │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│            │                                                                │
│            ▼                                                                │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Next.js 15 App Router runtime  (apps/web, built from packages/*)     │  │
│  │    • Server Components + Server Actions  (Node.js serverless)         │  │
│  │    • Route Handlers under src/app/api/*                               │  │
│  │    • middleware.ts  (runs on Edge runtime by default)                  │  │
│  │    • Sentry wrapper (withSentryConfig) → Sentry SaaS                   │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└──┬─────────────────────────────────────────────────────────────────────────┘
   │ outbound HTTPS / Postgres wire
   │
   ├────────────────────────┬────────────────────┬──────────────────┬────────┐
   ▼                        ▼                    ▼                  ▼        ▼
┌─────────────────┐   ┌────────────────┐   ┌────────────────┐   ┌──────┐  ┌──────┐
│ SUPABASE CLOUD  │   │ UPSTASH REDIS  │   │ RESEND         │   │STRIPE│  │DISCOGS│
│ (prod project)  │   │ (serverless)   │   │ (transactional │   │ API  │  │ API   │
│                 │   │                │   │  email)        │   │      │  │       │
│ • Postgres 15   │   │ • rate limits  │   └────────────────┘   └──────┘  └──────┘
│   + pg_cron     │   │ • session/cache│
│   + pg_net      │   │ • leaderboards │   (All four are pure outbound calls
│   + vault       │   └────────────────┘    from Vercel serverless functions.)
│ • Auth (GoTrue) │
│ • Realtime WS   │
│ • Storage       │
│ • Edge Functions│ ← cleanup-trade-previews, validate-preview (Deno)
└─────────────────┘
```

### 2.2 Monorepo → Deploy target mapping

| Repo path | Where it runs in prod | Deploy mechanism | Notes |
|---|---|---|---|
| `apps/web/` | Vercel | `vercel --prod` (auto on push to `main` once Git integration is wired) | Root Directory in Vercel project = `apps/web`. Build command = `pnpm --filter @digswap/web build`. Install command must be pnpm-aware. |
| `apps/desktop/` | **Not deployed** | — | Electron. Out of scope for v1.4. CI still typechecks + builds it. |
| `packages/trade-domain/` | Bundled into `apps/web` build | Nothing separate | Workspace dep. Vercel must `pnpm install --frozen-lockfile` so the workspace resolution works. |
| `supabase/migrations/*.sql` | Supabase Cloud Postgres | `supabase db push --linked` (CLI from dev machine or CI) | 28 migrations as of 2026-04-18. Applied in filename order. |
| `supabase/functions/cleanup-trade-previews/` | Supabase Edge Runtime (Deno) | `supabase functions deploy cleanup-trade-previews` | Invoked hourly by pg_cron via pg_net (not by Vercel). |
| `supabase/functions/validate-preview/` | Supabase Edge Runtime (Deno) | `supabase functions deploy validate-preview` | Invoked by the Next.js server when validating trade previews. |
| `supabase/functions/_shared/` | Bundled into the two functions above | Automatic via supabase CLI | Not a deployable unit by itself. |
| `drizzle/` + `drizzle.config.ts` | Dev laptop only | `pnpm drizzle-kit push` in dev | **Do not use in prod.** See §7 migration pipeline. |
| `.github/workflows/ci.yml` | GitHub Actions | — | Runs on PR and push to main. Does not deploy today — Vercel handles deploy via Git integration. |

### 2.3 Component responsibilities in prod

| Component | Owns | Implementation |
|---|---|---|
| Vercel Edge | TLS, HTTP/2, CDN, static assets, middleware execution | Managed. Region auto-selected unless pinned. |
| Next.js serverless functions (Vercel) | Server Components rendering, Server Actions, all `src/app/api/*` route handlers (Stripe webhook, Discogs callback, OAuth callback, `/api/health`, `/api/desktop/handoff/*`, `/api/og`, `/api/trade-preview`) | Node.js runtime. 10s timeout on Hobby, 60s on Pro. Must be Pro for any production commerce. |
| Middleware (`apps/web/src/middleware.ts`) | CSP nonce generation, session validation via `supabase.auth.getClaims()`, per-request Referrer-Policy override | Edge runtime. Touches Supabase on every request — audit flagged this as a cold-start risk on public routes. |
| Supabase Postgres | All relational data, RLS enforcement, materialized views (rankings), pg_cron schedule, pg_net outbound HTTP calls, Vault secret storage | Managed. Connection pooler (PgBouncer, transaction mode) on port 6543 is what `DATABASE_URL` must point to in prod serverless. |
| Supabase Auth (GoTrue) | Sessions, OAuth flows for Google + GitHub, email verification, TOTP 2FA | Managed. Configured via the Supabase dashboard per project. Redirect URLs list is per-project — dev and prod must each carry the correct allow-list. |
| Supabase Realtime | `notifications` subscription, trade presence, direct messages | Managed. WebSocket. 200 concurrent connections on free tier, 500 on Pro. |
| Supabase Storage | Avatars, trade preview audio clips (short, ephemeral). **Never** full rip files — those go P2P. | Managed. RLS policies on buckets. |
| Supabase Edge Functions | `cleanup-trade-previews` (hourly), `validate-preview` (on demand from Next.js) | Deno, deployed per function. Receive `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from the runtime — never from Vercel. |
| Upstash Redis | Rate limit counters (`rate-limit.ts` uses `failClosed=true` on critical auth flows), session cache, leaderboard sorted sets | Serverless REST API. No VPC needed. |
| Stripe | Subscription billing. `/api/stripe/webhook` on Vercel receives events. | External. Webhook signing secret is per endpoint — dev and prod have different secrets. |
| Discogs | OAuth 1.0a authentication + collection data. Callback at `/api/discogs/callback`. | External. Consumer key/secret issued once per app — same credentials for dev and prod is possible but not recommended; register two apps in the Discogs developer portal. |
| Resend | Transactional email (wantlist match, invites, auth notifications) | External. API key. Domain (`digswap.com`) must be verified via DNS (SPF/DKIM records on Hostinger). |
| Sentry | Error tracking for both client and server bundles | External. Configured via `withSentryConfig` in `next.config.ts`. Source maps uploaded at build time using `SENTRY_AUTH_TOKEN`. |
| Hostinger | **Domain registrar + DNS zone only.** Not a host. | External. NS records stay at Hostinger; A/CNAME point to Vercel. Plus TXT/CNAME records for Resend domain verification. |

---

## 3. Request Flow in Production

### 3.1 Anonymous hit on the landing page

```
digger types digswap.com in browser
    │
    ▼
Hostinger DNS   (A record → 76.76.21.x, Vercel anycast)
    │
    ▼
Vercel Edge     (TLS terminates, routes to closest POP)
    │
    ▼
middleware.ts   (runs on Edge runtime)
    ├─ generate CSP nonce
    ├─ supabase.auth.getClaims()   ← HTTP to Supabase Auth (hot path issue, see §8)
    └─ attach security headers
    │
    ▼
Next.js RSC     ("/" route, Server Component)
    ├─ if anonymous → render public landing
    └─ if authed    → redirect to /feed
    │
    ▼
Response        (HTML + streamed payload, cached at edge where possible)
```

### 3.2 Authenticated action (e.g. "follow user")

```
Button click (Client Component)
    │ invokes server action
    ▼
Vercel serverless (Node.js fn, apps/web bundle)
    ├─ middleware already ran, claims are on the request
    ├─ server action validates input (zod)
    ├─ rate-limit check   → Upstash Redis (REST)
    ├─ DB write           → Supabase Postgres (via Drizzle, DATABASE_URL pooler)
    └─ revalidatePath / revalidateTag
    │
    ▼
Client receives result; Realtime push fires to the followed user
    │
    ▼
followed user's browser (WebSocket open to Supabase Realtime)
    └─ notification bell updates live
```

### 3.3 Stripe webhook

```
Stripe event fires
    │
    ▼
HTTPS POST https://digswap.com/api/stripe/webhook
    │
    ▼
Vercel serverless (raw body, not parsed)
    ├─ verify signature using STRIPE_WEBHOOK_SECRET (prod-specific!)
    ├─ upsert into stripe_event_log  (idempotency table, migration 0005)
    ├─ apply subscription state change → subscriptions table
    └─ return 200
```

### 3.4 OAuth callback (Google / GitHub)

```
digger clicks "Continue with Google"
    │
    ▼
Supabase Auth sends 302 → accounts.google.com with redirect_uri = https://<supabase-project>.supabase.co/auth/v1/callback
    │
    ▼
Google validates, redirects to Supabase
    │
    ▼
Supabase handles the exchange, then redirects to the app at NEXT_PUBLIC_SITE_URL + "/api/auth/callback"
    │
    ▼
Vercel serverless (/api/auth/callback)
    ├─ exchange code for session with supabase.auth.exchangeCodeForSession()
    ├─ set cookies
    └─ redirect to /feed or intended destination
```

**The production-unique piece:** the Supabase dashboard `Auth → URL Configuration → Redirect URLs` allow-list must contain the prod domain. And Google / GitHub developer consoles must include the Supabase prod project's `<project>.supabase.co/auth/v1/callback` as an authorized redirect URI.

### 3.5 Discogs OAuth callback

```
digger clicks "Connect Discogs"
    │
    ▼
Server action mints request token via /api/discogs/callback (OAuth 1.0a)
    │
    ▼
Redirect to discogs.com/oauth/authorize?oauth_token=…
    │
    ▼
Discogs redirects back to callback_url (set when registering the Discogs app)
    │   → must be https://digswap.com/api/discogs/callback in prod
    ▼
Vercel serverless exchanges request token for access token; stores encrypted
```

**Production-unique piece:** the callback URL is set in the Discogs developer portal. A single Discogs app cannot serve both dev (localhost) and prod (digswap.com) at the same time because Discogs only accepts one callback URL. Register a second Discogs app for prod.

### 3.6 pg_cron → Edge Function (preview cleanup)

```
Postgres scheduler fires every hour
    │
    ▼
public.invoke_trade_preview_cleanup()  (SECURITY DEFINER)
    ├─ read vault.decrypted_secrets for trade_preview_project_url + publishable_key
    ├─ net.http_post → <project>.supabase.co/functions/v1/cleanup-trade-previews
    ▼
Supabase Edge Runtime (Deno) runs the function
    ├─ query expired preview rows
    ├─ delete from Storage bucket `trade-previews`
    └─ null out the paths in trade_proposal_items
```

**This flow does not touch Vercel at all.** Everything happens inside the Supabase project. The only prod setup step is: after running the migration that creates the cron job, insert the prod Vault secrets (`trade_preview_project_url`, `trade_preview_publishable_key`). Until those secrets exist, the cron job logs "Skipping" and does nothing — safe fail.

---

## 4. Dev vs Prod: What Actually Changes

Nothing in the codebase is forked. Everything branches on environment variables or on dashboard configuration.

| Concern | Dev | Prod | Where to change |
|---|---|---|---|
| Supabase project | `your-dev-project.supabase.co` | `digswap-prod.supabase.co` (new project) | Supabase dashboard; then `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` in Vercel env |
| Database migrations | `pnpm drizzle-kit push` against local or dev Supabase | `supabase db push --linked` against prod | CLI, linked via `supabase link --project-ref <prod-ref>` |
| Edge Functions | `supabase functions serve` locally (optional) | `supabase functions deploy <name>` per function | CLI, same link |
| pg_cron jobs | present but can point at dev URL via Vault | must point at prod URL via Vault | Insert Vault secrets post-migration in prod only |
| Site URL | `http://localhost:3000` | `https://digswap.com` | `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL` in Vercel env |
| Supabase redirect URLs allow-list | `http://localhost:3000/**` | `https://digswap.com/**` | Supabase dashboard → Auth → URL Configuration |
| Google OAuth client | "DigSwap dev" with localhost redirect | "DigSwap prod" with digswap.com redirect (or same client with both URIs whitelisted) | Google Cloud Console |
| GitHub OAuth app | separate app | separate app | GitHub Developer settings |
| Discogs OAuth app | app with `http://localhost:3000/api/discogs/callback` | **separate** app with `https://digswap.com/api/discogs/callback` | Discogs developer portal. Single callback URL per app. |
| Stripe mode | Test mode keys + Stripe CLI webhook forwarding | Live mode keys + real webhook endpoint at `https://digswap.com/api/stripe/webhook` | Stripe dashboard + Vercel env |
| Stripe price IDs | test price IDs | live price IDs | Vercel env (`NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`, `_ANNUAL`) |
| Upstash Redis | one DB, maybe shared | dedicated prod DB | Upstash console → Vercel env |
| Resend | API key, sandbox mode, emails only to verified addresses | API key + verified domain | Resend dashboard + DNS records on Hostinger |
| Sentry | one project | separate prod project (or same project with `environment=production`) | Sentry dashboard + Vercel env (`SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`) |
| Source maps | not uploaded | uploaded at build time for stack trace symbolication | `withSentryConfig` already handles this; needs `SENTRY_AUTH_TOKEN` in Vercel build env |
| CSP | nonce-based, strict | nonce-based, strict (same) | No change — middleware already emits this |
| `HANDOFF_HMAC_SECRET` | optional (dev default allowed) | **required, ≥32 chars** — enforced by `env.ts` when `VERCEL=1` | Vercel env |

---

## 5. Secrets: Where Each One Originates and Where It Is Consumed

Key question: "which keys are `NEXT_PUBLIC_`, which are server-only, which go in Vercel vs Supabase?" Answer table:

| Secret | Tier | Originates at | Consumed by | Set in |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public (bundled in JS) | Supabase dashboard (prod project) | Browser + server | Vercel env (all envs) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public (anon/RLS key) | Supabase dashboard | Browser + server | Vercel env |
| `SUPABASE_SERVICE_ROLE_KEY` | SECRET — full-DB bypass | Supabase dashboard | **Server only** (server actions, API routes, never middleware, never sent to client) | Vercel env (server, prod) **and** separately in Supabase Edge Function env |
| `DATABASE_URL` | SECRET (contains password) | Supabase dashboard → Connection Pooler (port 6543, transaction mode) | Drizzle client on server | Vercel env |
| `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` | public | You choose (`https://digswap.com`) | Anywhere that builds absolute URLs (OAuth callbacks, emails, meta tags) | Vercel env |
| `STRIPE_SECRET_KEY` | SECRET | Stripe dashboard (live mode) | Server actions + webhook | Vercel env (prod) |
| `STRIPE_WEBHOOK_SECRET` | SECRET | **Created when you register the webhook endpoint** at `https://digswap.com/api/stripe/webhook` — so this exists only after Vercel is live and DNS resolves | `/api/stripe/webhook` signature verification | Vercel env (prod) |
| `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` / `_ANNUAL` | public | Stripe dashboard | Client-side upgrade flow | Vercel env |
| `DISCOGS_CONSUMER_KEY` / `DISCOGS_CONSUMER_SECRET` | SECRET | Discogs developer portal (prod app) | Server — OAuth dance + API calls | Vercel env |
| `IMPORT_WORKER_SECRET` | SECRET | Generated (`openssl rand -hex 32`) | Self-invocation auth between Next.js pages and background workers | Vercel env |
| `HANDOFF_HMAC_SECRET` | SECRET, ≥32 chars in prod (enforced) | Generated | HMAC signing on desktop handoff tokens | Vercel env |
| `UPSTASH_REDIS_REST_URL` | public-ish (not strictly secret but keep private) | Upstash console | Server rate limit / leaderboards | Vercel env |
| `UPSTASH_REDIS_REST_TOKEN` | SECRET | Upstash console | Server only | Vercel env |
| `RESEND_API_KEY` | SECRET | Resend dashboard | Server actions that send mail | Vercel env |
| `RESEND_FROM_EMAIL` | public (`noreply@digswap.com`) | You choose; domain must be verified in Resend | Email sender | Vercel env |
| `NEXT_PUBLIC_SENTRY_DSN` | public (DSN is safe to expose) | Sentry dashboard | Client + server | Vercel env |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | SECRET (auth token only) | Sentry | Build time (source map upload) | Vercel env (build scope) |
| `YOUTUBE_API_KEY` | SECRET (optional) | Google Cloud Console | Server | Vercel env |
| **Edge Function envs:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | | Supabase provides automatically at runtime | `cleanup-trade-previews`, `validate-preview` | **Supabase**, not Vercel |
| **Vault secrets:** `trade_preview_project_url`, `trade_preview_publishable_key` | | Inserted by you post-migration | `public.invoke_trade_preview_cleanup()` pg_cron job | **Supabase vault**, not Vercel |

### 5.1 Three secret boundaries (critical mental model)

1. **Vercel env (Next.js serverless + build):** everything the Next.js app reads at runtime or build time. This is the biggest bag. Use Vercel's Environment Variables UI with `Production` / `Preview` / `Development` scopes set correctly.
2. **Supabase Edge Function env:** `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — do not re-add them manually unless overriding. Set these via `supabase secrets set --env-file` if the function needs extra vars (e.g. a third-party API key used only from the edge function).
3. **Supabase Vault:** only secrets consumed by Postgres itself (SECURITY DEFINER functions, pg_cron callbacks). Today: `trade_preview_project_url` and `trade_preview_publishable_key`. Insert via the Supabase dashboard → Vault UI or SQL.

---

## 6. Build / CI / Deploy Pipeline

### 6.1 Current CI (`.github/workflows/ci.yml`)

Does **not** deploy. It runs on every PR and push to main:

```
push to main  or  pull_request → main
    │
    ▼
┌──────────┬───────────┬─────────┬────────────┬────────────────┐
│  lint    │ typecheck │  test   │ build-web  │ build-desktop  │
│  (web)   │ (all 3)   │ (all 3) │            │                │
└──────────┴───────────┴─────────┴────────────┴────────────────┘
                                      │
                                      ▼ needs: build-web
                                  ┌────────┐
                                  │  e2e   │  (Playwright, chromium only)
                                  └────────┘
```

All jobs run against **dummy env vars** hard-coded in the workflow env block. This is fine for build-time validation (Zod schema accepts them in the `VERCEL !== "1"` branch), but means CI cannot smoke-test against real services.

### 6.2 Vercel Git integration (recommended path — add this)

Vercel's GitHub integration is the simplest deploy mechanism for a solo dev:

```
git push origin main
    │
    ├─→ GitHub Actions (CI) runs in parallel — gates PRs but not deploys
    │
    └─→ Vercel webhook receives push event
            │
            ▼
        Vercel build runner
            ├─ pnpm install --frozen-lockfile  (root, uses pnpm-workspace.yaml)
            ├─ pnpm --filter @digswap/web build
            │     ├─ Sentry uploads source maps (needs SENTRY_AUTH_TOKEN)
            │     ├─ Next.js compiles RSC + client bundles
            │     └─ env.ts Zod validates — fails build if any required env is missing
            ├─ output captured to .vercel/output
            └─ atomic deploy to Production
```

For **preview** deployments (every PR gets a unique URL), Vercel uses the "Preview" env scope — set a separate `NEXT_PUBLIC_SITE_URL=https://<branch>-digswap.vercel.app` or better, rely on the auto-populated `VERCEL_URL`. Preview deploys should **never** point at the prod Supabase project — create a "staging" Supabase project or point previews at dev.

### 6.3 Supabase deploys (manual in v1.4, script in v1.5)

Supabase has no Git integration. Deploys happen via the Supabase CLI. For a solo dev doing first production deploy, run them manually from your laptop:

```
supabase link --project-ref <prod-ref>     # one-time
supabase db push                            # apply supabase/migrations/*.sql
supabase functions deploy cleanup-trade-previews
supabase functions deploy validate-preview
```

Post-deploy, insert Vault secrets via the dashboard (one-time):

```sql
select vault.create_secret('https://<prod-ref>.supabase.co', 'trade_preview_project_url');
select vault.create_secret('<publishable-key>',              'trade_preview_publishable_key');
```

Later (v1.5 or whenever), move this into a GitHub Action that runs on push to main after CI passes. For v1.4, manual is correct — a solo dev doing a first deploy should see every step.

### 6.4 Build order constraints (do not reorder)

1. **Supabase prod project exists** — just click "New project" in the dashboard. Until this exists, you cannot generate any URL/keys to put in Vercel.
2. **Run `supabase db push` against prod** — applies all 28 migrations. Required before Vercel can boot because `/api/health` and most server actions query tables.
3. **Deploy Edge Functions** — `cleanup-trade-previews` and `validate-preview`. Next.js validate-preview route (`/api/trade-preview/...`) calls these. Safe to deploy pre-DNS since they're addressed by Supabase URL, not your domain.
4. **Populate Vault secrets** — required by the hourly cron job. Job is idempotent and safe-fails without them.
5. **Set Vercel env vars** — all of them. Run `vercel env pull` locally to sanity check.
6. **Trigger first Vercel build** — either push to main or `vercel --prod` manually. Sentry source map upload needs `SENTRY_AUTH_TOKEN`; if missing, build succeeds but stack traces are minified.
7. **Verify `https://<project>.vercel.app` works** on the Vercel-assigned URL before touching DNS. Run smoke tests there.
8. **DNS cutover on Hostinger** — A record (or ALIAS/ANAME if Hostinger supports it) for `digswap.com` → `76.76.21.21`; CNAME for `www` → `cname.vercel-dns.com`. Wait for propagation (minutes to hours).
9. **Vercel verifies domain, issues SSL** — automatic once DNS resolves.
10. **Update OAuth redirects in Supabase dashboard** — add `https://digswap.com/**` to allow-list. Add to Google + GitHub OAuth clients too.
11. **Register Discogs prod app** with callback `https://digswap.com/api/discogs/callback`. Put its key/secret in Vercel env. Redeploy Vercel to pick up the new env.
12. **Register Stripe webhook** at `https://digswap.com/api/stripe/webhook`. Get `STRIPE_WEBHOOK_SECRET`. Put in Vercel env. Redeploy.
13. **Verify Resend domain** — add DKIM/SPF records on Hostinger DNS. Resend will verify automatically once they propagate.

Steps 11–12 require Vercel to be live on the real domain, so they cannot happen earlier. This is the tightest sequencing constraint and must be documented as a checklist in the runbook.

---

## 7. Migration Pipeline: Resolving The Drift

The deploy-readiness audit (P0 item 2) called out drift between `drizzle/` and `supabase/migrations/`. For the first production deploy, pick exactly one trail and stop writing to the other.

### 7.1 Why `supabase/migrations/` must be the source of truth

- **Contains RLS, pg_cron, pg_net, Vault reads, SECURITY DEFINER functions, materialized views, GIN indexes.** Drizzle Kit generates none of these — they are hand-written SQL.
- **Is the only trail Supabase CLI can apply** to a Supabase Cloud project. `supabase db push` reads `supabase/migrations/` exclusively.
- **Has more recent content.** `drizzle/` stops at `0005_stripe_event_log.sql`; `supabase/migrations/` has 23 migrations after that date.

### 7.2 Recommended pattern going forward

```
Dev (solo dev laptop)                     Prod (Supabase Cloud)
┌───────────────────────┐                ┌────────────────────────┐
│ Author Drizzle schema │                │                        │
│ in apps/web/src/lib/  │                │                        │
│      db/schema/       │                │                        │
└──────────┬────────────┘                │                        │
           │ drizzle-kit generate         │                        │
           ▼                              │                        │
┌───────────────────────┐                │                        │
│ Emit SQL to drizzle/  │   Review,       │                        │
│ for type-check diffs  │   then hand-   │                        │
│ (but do NOT apply)    │   copy/merge   │                        │
└──────────┬────────────┘   into a new   │                        │
           │                 hand-       │                        │
           ▼                 written     │                        │
┌───────────────────────┐   file in      │                        │
│ Hand-author matching  │   supabase/    │                        │
│ file with RLS/cron/   │   migrations/  │                        │
│ etc. in supabase/     │   (timestamp   │                        │
│   migrations/         │   naming)      │                        │
└──────────┬────────────┘                │                        │
           │ supabase db push --local     │                        │
           ▼                              │                        │
┌───────────────────────┐                │                        │
│ Verify on local       │   then on      │ supabase db push        │
│ Supabase (Docker)     │   main:        │ --linked                │
└──────────┬────────────┘                │     ↓                   │
                                         │  Applies migrations     │
                                         │  to prod in order       │
                                         └────────────────────────┘
```

**Concrete action items for v1.4:**

1. Delete or archive `drizzle/0002_showcase_cards.sql` — it's orphaned per the audit (not in `_journal.json`) and duplicates columns already created downstream.
2. Add a top-of-repo note (or a linter rule) saying "`drizzle/` is informational; `supabase/migrations/` is authoritative."
3. Add a `supabase/config.toml` (audit P2 flagged its absence). Without it, `supabase link` has to guess project settings.

### 7.3 Bootstrap-from-empty sanity check (required before first prod deploy)

Before pointing Vercel at the prod Supabase project, verify the migration trail applies cleanly to an empty database:

```
# against a fresh local Supabase
supabase db reset
# or against a throwaway cloud project
supabase db push --linked
```

If this fails, the same failure will hit prod. The audit (P0 item 2) did not confirm this passes today — treat it as unvalidated.

---

## 8. Cold Start and Public-Route Architecture (audit P0 item 3)

The deploy-readiness audit flagged that `/`, `/signup`, `/signin`, `/pricing` returned 500 on cold start because middleware and some pages call `supabase.auth.getUser()` / `getClaims()` on every request, which requires a roundtrip to Supabase.

This is a deploy-topology concern because in production:
- Every cold serverless invocation adds 100–400ms to reach Supabase for auth validation.
- `/pricing` is a public marketing page; if Supabase is slow, the landing experience degrades.
- Sentry will fire alerts on every 500, blurring real issues.

**Architectural fix (recommended for v1.4):**
- Middleware should run on as narrow a route matcher as possible. Exclude `/`, `/pricing`, `/api/health`, `/api/og`, and any other truly-anonymous path.
- Public route handlers should not call `getUser()` unless they actually need the user. The pricing page uses it to render a "Current plan" badge — gate that behind an `is-authed` cookie check or move the badge to a client component that fetches after hydration.
- Keep `/api/health` completely decoupled: no auth, no middleware — already the case, confirmed in `route.ts`.

This is a Next.js architecture decision, not a Vercel config. The middleware matcher is a one-line change but catches a real prod risk.

---

## 9. Anti-Patterns for This Deploy Topology

### 9.1 "Apply Drizzle Kit to prod"
**What people do:** `drizzle-kit push` pointed at the prod `DATABASE_URL`.
**Why it's wrong:** Drizzle Kit diffs the schema and applies DDL directly. It has no concept of RLS policies, SECURITY DEFINER functions, pg_cron, or Vault. It will happily drop policies it doesn't know about. It also fights with the `supabase/migrations/` trail — running both causes prod drift within days.
**Do this instead:** `supabase db push` exclusively in prod. Keep Drizzle Kit in dev for schema authoring and type generation.

### 9.2 "One Supabase project for dev and prod"
**What people do:** save money by pointing Vercel preview + prod + local dev at the same Supabase project.
**Why it's wrong:** Supabase migrations are global to the project. A bad migration kills prod users. Preview deployments writing into prod tables contaminate data. RLS testing becomes guesswork. Row count bills scale weirdly.
**Do this instead:** two projects minimum — dev and prod. Preview deploys point at dev. When you have revenue, add a staging project.

### 9.3 "Long-running work inside a Next.js API route"
**What people do:** implement Discogs bulk-import as a single `/api/discogs/import` route that fetches 5000 records.
**Why it's wrong:** Vercel serverless timeout is 10s (Hobby) or 60s (Pro). 5000 records at Discogs' 60 req/min = 83 minutes. The request will be killed every time.
**Do this instead:** move background work to Supabase Edge Functions (`supabase/functions/discogs-import-worker/`) which have a 150s timeout on the hosted runtime, or chunk the work and self-invoke via `IMPORT_WORKER_SECRET` so each invocation stays under 60s. This is already partially modeled in the repo (`IMPORT_WORKER_SECRET` exists) — extend the pattern instead of moving to a different paradigm.

### 9.4 "Single-region everything"
**What people do:** leave Vercel + Supabase in their default US regions while targeting a global vinyl community.
**Why it's wrong:** for an EU digger, every request is 150ms more than it needs to be. Supabase Realtime over a transatlantic link is particularly painful.
**Do this instead (in v1.4, safe minimum):** pick a Supabase region matching your largest user cohort (EU or US East) and **match the Vercel serverless function region** to it (`vercel.json` → `regions: ["iad1"]` or `["fra1"]`). Do not set Vercel to multi-region until you have a read-replica strategy, because every fn would take a transatlantic DB hit on cold start.

### 9.5 "Put Supabase service role key in `NEXT_PUBLIC_`"
**What people do:** accidental typo, or copy-paste from docs that use a different key naming convention.
**Why it's wrong:** the service role key bypasses all RLS. Bundling it to the browser is a full database compromise.
**Do this instead:** the `env.ts` Zod schema already segregates server vars from `NEXT_PUBLIC_`. Keep it that way. Add a CI check (`grep -r "NEXT_PUBLIC_.*SERVICE_ROLE" apps/web/src`) as a belt-and-braces safeguard.

### 9.6 "Deploy Edge Functions via the Vercel pipeline"
**What people do:** try to deploy `supabase/functions/` from Vercel because it's the only CI they've wired up.
**Why it's wrong:** Vercel has no Supabase integration. Edge Functions run on Deno inside Supabase — Vercel cannot deploy them.
**Do this instead:** add a GitHub Actions job that runs `supabase functions deploy` on push to main (needs `SUPABASE_ACCESS_TOKEN` in repo secrets). For v1.4 first deploy, manual CLI is fine.

---

## 10. Scaling Considerations (Relevant to First Deploy)

| Scale | Topology implications |
|---|---|
| 0–1k users (v1.4 target) | Current topology holds as-is. Free tiers everywhere except Vercel Pro (needed for commerce + 60s function timeout). Supabase free plan's 500MB DB is enough for the first 1000 diggers if we don't store record art — `i.discogs.com` URLs instead. |
| 1k–10k users | First bottleneck: Supabase Realtime (200 concurrent → 500 on Pro). Upgrade Supabase to Pro. Monitor Upstash command budget (500k/mo free). |
| 10k–100k users | Second bottleneck: Postgres connections in serverless. Must use PgBouncer **transaction mode** (the pooler URL on port 6543) — any `prepare: false` gotcha in Drizzle config surfaces here. Consider read replicas for the feed query. |
| 100k+ users | Split compute: move Discogs import + ranking recompute + trade preview validation out of Next.js entirely into dedicated workers (Supabase Edge Functions scaled up, or a Railway/Fly side service). Out of scope for v1.4. |

**What does not need to change to reach 10k:** the request-flow topology. No microservices, no separate backend, no message broker. The monorepo + Vercel + Supabase stack carries the product to at least tens of thousands of users before any structural rework.

---

## 11. Integration Points (Summary Table)

### External Services

| Service | Integration pattern | Prod gotchas |
|---|---|---|
| Supabase Postgres | Drizzle ORM over `postgres` driver, connection pooler URL | Must use `prepare: false` in Drizzle config because PgBouncer transaction mode does not support prepared statements across connections. |
| Supabase Auth | `@supabase/ssr` server client + middleware | Redirect URL allow-list is per-project dashboard setting — not in code. Easy to miss. |
| Supabase Realtime | `createClient(...).channel(...)` | WebSocket; survives serverless cold starts because it's opened from the client. |
| Supabase Storage | service role client on server (`trade_preview_storage_path`), RLS client from browser for user-owned assets | Storage bucket policies are separate from table RLS. |
| Supabase Edge Functions | Next.js `fetch(<project>.supabase.co/functions/v1/<name>)` with service role header | Edge Functions need CORS for browser calls; for server-to-server (Next.js → Edge Function) no CORS concern. |
| Stripe | Stripe SDK for mutations; webhook receives events at `/api/stripe/webhook` | Webhook needs raw body (Next.js `export const runtime = "nodejs"` + `export const dynamic = "force-dynamic"`). Idempotency via `stripe_event_log` table. |
| Discogs | `@lionralfs/discogs-client` on server; OAuth 1.0a at `/api/discogs/callback` | 60 req/min rate limit. Respect it — Discogs bans violators. One callback URL per Discogs app; separate dev and prod apps. |
| Resend | REST from server actions | Domain verification on Hostinger DNS is a prerequisite, ~20 min propagation. |
| Upstash Redis | REST (`@upstash/redis`) | `failClosed=true` in `rate-limit.ts` means missing Upstash = auth fails. Set envs before first user. |
| Sentry | `withSentryConfig` wraps Next.js build | Source maps require `SENTRY_AUTH_TOKEN` in the Vercel build env (not runtime). |
| Hostinger | DNS zone only | Keep TTLs low (300s) during cutover week, raise to 3600s once stable. |

### Internal boundaries

| Boundary | Communication | Notes |
|---|---|---|
| apps/web ↔ packages/trade-domain | Direct TS imports (workspace) | Bundled into the Vercel build. No runtime boundary. |
| Next.js server ↔ Supabase Postgres | Drizzle (SQL) | Everything goes through the pooler URL in prod. |
| Next.js server ↔ Supabase Edge Functions | HTTPS + service role header | Prefer this over embedding Deno-only logic in Next.js routes when wall-clock > 60s or when scheduling via pg_cron. |
| Supabase Postgres ↔ Supabase Edge Functions | pg_net (outbound from DB) | Only for cron-triggered flows. `public.invoke_trade_preview_cleanup()` is the only one today. |
| Vercel build ↔ Sentry | HTTPS at build time | Uploads source maps. Runtime does not talk to Sentry unless errors fire. |
| Vercel ↔ Upstash | HTTPS REST from every serverless invocation | Low latency — Upstash picks a region close to Vercel. |

---

## 12. Open Risks / Unresolved Items for Deploy

Flag these in the roadmap phase that covers them:

1. **Migration trail sanity check not yet run against empty Supabase.** Audit P0 item 2. Must pass before pointing Vercel at prod DB.
2. **Public-route cold start regression.** Audit P0 item 3. Middleware narrowing required before external traffic, or monitoring pages will 500 during warm-up.
3. **`supabase/config.toml` missing.** Audit P2 item 2. Without it, `supabase link` relies on dashboard state instead of repo state. Harmless for a solo dev but breaks when onboarding a collaborator or a CI runner.
4. **No smoke-test suite runs against the deployed URL.** CI runs Playwright against a local `pnpm start`. A minimal "curl the health endpoint, login flow, and pricing page" smoke test should run against the Vercel-assigned URL **before** DNS cutover.
5. **Edge Function deploy is manual.** Acceptable for v1.4; add to CI in v1.5.
6. **Vault secrets must be inserted post-migration.** Not wired into the migration file itself (migration safe-fails without them). Add to deploy runbook.
7. **No rollback plan documented.** Vercel has one-click rollback per deployment. Supabase migrations do not — you need a `DOWN` migration, a dashboard-level point-in-time restore (Pro only), or a tested `pg_dump` restore. For v1.4, the safe posture is: take a `pg_dump` snapshot immediately after first successful schema push; document the restore command in the runbook.

---

## 13. Sources

- Supabase Cloud docs — [Deploying Edge Functions](https://supabase.com/docs/guides/functions/deploy) — HIGH confidence
- Supabase Cloud docs — [Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations) — HIGH confidence
- Supabase Cloud docs — [Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pool) — HIGH confidence, confirms PgBouncer transaction-mode URL on port 6543
- Supabase Cloud docs — [Vault](https://supabase.com/docs/guides/database/vault) — HIGH confidence
- Supabase Cloud docs — [pg_cron](https://supabase.com/docs/guides/cron) and [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net) — HIGH confidence
- Vercel docs — [Environments & Environment Variables](https://vercel.com/docs/environment-variables) — HIGH confidence
- Vercel docs — [Git Integration](https://vercel.com/docs/git) and [Monorepo / Root Directory](https://vercel.com/docs/monorepos) — HIGH confidence
- Vercel docs — [Serverless Function Limits](https://vercel.com/docs/functions/runtimes#serverless-functions) — HIGH confidence, confirms 10s Hobby / 60s Pro / 900s Max
- Next.js 15 docs — [Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware) — HIGH confidence
- Next.js 15 docs — [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) and Webhook patterns — HIGH confidence
- Stripe docs — [Webhook Signing](https://stripe.com/docs/webhooks#verify-official-libraries) — HIGH confidence
- Discogs developer docs — [OAuth 1.0a authentication](https://www.discogs.com/developers#page:authentication) — HIGH confidence, single callback URL per app confirmed
- Sentry docs — [Next.js integration](https://docs.sentry.io/platforms/javascript/guides/nextjs/) — HIGH confidence
- Resend docs — [Domain verification via DNS](https://resend.com/docs/dashboard/domains/introduction) — HIGH confidence
- Internal repo:
    - `.planning/quick/260406-aud-deploy-readiness-audit/260406-aud-SUMMARY.md` (2026-04-06 audit)
    - `apps/web/next.config.ts`, `.env.local.example`, `src/lib/env.ts`
    - `supabase/migrations/20260417_trade_preview_infrastructure.sql` (pg_cron → Edge Function pattern)
    - `supabase/functions/cleanup-trade-previews/index.ts`
    - `.github/workflows/ci.yml`
    - `drizzle.config.ts`
    - `CLAUDE.md` (stack + constraints, HIGH confidence)

---

*Architecture research for: first production deploy of DigSwap v1.4*
*Researched: 2026-04-20*
