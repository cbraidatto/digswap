# Project Research Summary

**Project:** DigSwap v1.4 -- Production Launch
**Domain:** First production deploy (Next.js 15 + Supabase Cloud + Vercel + Hostinger)
**Researched:** 2026-04-20
**Confidence:** HIGH

## Executive Summary

DigSwap v1.4 is not a feature milestone -- it is a pure infrastructure and configuration milestone. The application stack is already validated, built, and tested across 12+ development phases. The work here is taking existing code and wiring it to real cloud services for the first time: a production Supabase project, a Vercel project pointed at a real domain, live-mode Stripe and OAuth credentials, and a verified email sending domain. No new code is required for basic deployment; the risk is entirely in configuration correctness, not in software quality.

The recommended approach is six sequential sub-phases: pre-deploy audit gate, Supabase prod setup, Vercel environment wiring, DNS and SSL, external integrations (Stripe live mode, OAuth prod callbacks, Resend domain verification), and smoke tests with human UAT. Monitoring setup (Sentry DSN, UptimeRobot) and rollback preparation can run in parallel with phases 3-4. The hardest sequencing constraint is that Stripe Live account activation takes 1-3 business days -- that process must start on day one of this milestone. Everything else unblocks once the Supabase prod project exists and DNS resolves.

The top risks are not technical: they are operational. Eleven P0 pitfalls exist -- all reachable by a solo developer under pressure -- covering secret exposure via NEXT_PUBLIC_ misprefix, migration drift destroying the prod database, preview deploys writing to production Supabase, session revocation silently not working, and Discogs OAuth tokens stored unencrypted as a fallback. Commit 35ed595 claims these blockers are fixed, but "claimed fixed" is not the same as "verified fixed." Phase 1 of this milestone is a verification gate, not a rubber stamp.

---

## Key Findings

### Recommended Stack

No new dependencies are required. The entire deploy layer is configuration and account setup on services already wired into apps/web/package.json. The relevant additions are: Vercel CLI (v40+), Supabase CLI (v2+), and optionally the Stripe CLI for webhook debugging. Total new tooling: 2 global installs.

The cost floor once launched publicly is approximately $45/month: Vercel Pro ($20/mo, mandatory before any paying user -- Hobby is explicitly non-commercial) and Supabase Pro ($25/mo, mandatory to prevent the free tier 7-day auto-pause from silently taking down the live domain). All other services (Upstash, Sentry, Resend, Stripe) run on free tiers at launch-week traffic.

**Deploy-layer services (all already wired in code):**
- **Vercel Pro**: Next.js 15 hosting, CDN, SSL, instant rollback -- mandatory upgrade from Hobby before first Stripe charge
- **Supabase Cloud Pro**: PostgreSQL + Auth + Realtime + Storage + Edge Functions -- Pro required to disable auto-pause
- **Upstash Redis (prod instance)**: rate limiting fails closed without it -- non-negotiable, not optional
- **Sentry**: already wired via withSentryConfig -- needs DSN, org, project, and auth token for prod project
- **Resend**: sending domain must be DKIM/SPF/DMARC-verified at Hostinger before first email delivers
- **Stripe Live mode**: live keys, live Price IDs, and a new live-mode webhook endpoint with its own signing secret
- **Hostinger DNS**: A record 76.76.21.21 (apex) + CNAME cname.vercel-dns.com (www) -- registrar stays at Hostinger

**Version pins (do not change before launch):**
- next@15.5.15 -- do not upgrade to 16 (ecosystem still catching up on renamed middleware/proxy)
- react@19.1.0 -- already on 19 (not 18 as old CLAUDE.md said); leave as-is
- @supabase/ssr@^0.9 -- correct App Router adapter; deprecated auth-helpers already replaced
- drizzle-orm@^0.45.1 / drizzle-kit@^0.31.10 -- aligned; keep in sync on any upgrade

### Expected Features (Deploy Workflow)

This milestone features are the deploy pipeline capabilities, not product features.

**Must have (table stakes -- first deploy fails without these):**
- All 4 CI gates green: typecheck, build, test, lint -- must pass before any prod action
- Migration trail applies cleanly from empty DB -- supabase db reset must succeed
- Env var inventory: every var in .env.local.example has a prod value in Vercel (Production scope only)
- Separate Supabase prod project -- dev and prod must never share a Supabase project
- RLS verification -- zero tables without active policies, zero policies referencing missing columns
- /api/health endpoint -- probes DB + Redis + Discogs connectivity, returns 200 / 503
- Staged deploy -- first deploy lands as Preview-equivalent, manually promoted after smoke pass
- Automated Playwright smoke against prod URL -- not just local
- Human UAT checklist -- signup, email verify, Discogs OAuth, trade, Stripe checkout

**Should have (reduce toil -- add within week 1):**
- UptimeRobot pinging /api/health every 5 min (free tier)
- Vercel Analytics + Speed Insights (one component, free on Pro)
- Stripe webhook failure email alerts
- RUNBOOK.md with symptoms and action for top 10 failure modes

**Defer (v1.x -- after prod is stable for 1 week):**
- Supabase persistent staging branch
- Preview deploys with isolated Supabase branches per PR
- Status page
- Log drains to Axiom
- Synthetic journey tests running against prod on a cron
- Rolling releases / canary traffic split

**Anti-features to avoid explicitly:**
- Big-bang single-deploy migration + code change -- must use expand-migrate-contract
- Running drizzle-kit push against prod -- use supabase migration up only
- Announcing public launch before UAT pass + minimum 1 week soak time

### Architecture Approach

The production topology has exactly two load-bearing infrastructure pieces: Vercel (Next.js runtime, all API route handlers, middleware) and Supabase Cloud (Postgres, Auth, Realtime, Storage, Edge Functions). Every other service -- Hostinger, Stripe, Discogs, Resend, Upstash, Sentry -- is a managed third party reached over HTTPS. The monorepo maps cleanly: apps/web deploys to Vercel, supabase/migrations/ and supabase/functions/ deploy to Supabase Cloud via CLI, apps/desktop is explicitly out of scope for v1.4.

**Deploy topology components:**
1. **Vercel Edge Network** -- TLS termination, CDN, static asset serving, middleware execution (Edge runtime)
2. **Next.js serverless functions** -- Server Components, Server Actions, all src/app/api/* route handlers; Vercel Pro required for 60s timeout (Hobby = 10s, breaks Discogs import and Stripe webhook)
3. **Supabase Postgres (prod project)** -- all relational data, RLS, pg_cron, pg_net, Vault; connection via PgBouncer pooler on port 6543 with prepare: false
4. **Supabase Edge Functions** -- cleanup-trade-previews and validate-preview; deployed via Supabase CLI, not Vercel
5. **Upstash Redis** -- rate limiting with failClosed=true; missing = all logins 429
6. **Three secret boundaries** -- Vercel env (Next.js runtime + build), Supabase Edge Function env (auto-injected), Supabase Vault (Postgres-consumed secrets for pg_cron)

**Critical sequencing constraints (hard, cannot reorder):**
- Supabase prod project must exist before Vercel env vars can reference it
- DNS must resolve and SSL must be live before OAuth redirect URIs and Stripe webhook endpoint can use the prod domain
- Stripe webhook endpoint URL requires the domain to exist before it can be registered in the Stripe dashboard

**Migration pipeline -- two-track drift is the single biggest structural risk:**
supabase/migrations/ is the authoritative trail. It contains RLS policies, pg_cron jobs, pg_net calls, Vault reads, SECURITY DEFINER functions, and materialized views that Drizzle Kit cannot generate. drizzle/ stops at migration 0005; supabase/migrations/ has 23 migrations beyond that. In prod, only supabase db push is used. Drizzle Kit remains dev-only for schema authoring and type generation.

### Critical Pitfalls

Research identified 11 P0 pitfalls (data loss / broken auth / secret leak) and 13 P1 pitfalls (broken UX / embarrassment). Top five for a solo developer on first deploy:

1. **NEXT_PUBLIC_ misprefix on Supabase service role key** -- silently inlines the key into the browser bundle, bypassing all RLS. Prevention: after every prod build, grep .next/static/ for service_role and all other secrets. Any hit = abort deploy and rotate the key.

2. **Migration drift between drizzle/ and supabase/migrations/** -- applying the wrong trail to prod can leave partial schema, broken RLS policies, or columns referenced by policies that do not exist. Prevention: supabase db reset on a clean local DB must succeed before any prod push. drizzle-kit push must never run against prod.

3. **Cold-start 500s on public routes** -- middleware calls supabase.auth.getClaims() on every request including anonymous public pages. Under cold start with slow Supabase DNS resolution, this throws and returns 500 on /, /signin, /signup, /pricing. Commit 35ed595 claims a fix; must be independently verified with a cold-start curl test after deploy.

4. **Preview deploys writing to production Supabase** -- Vercel default env scope is All Environments, meaning preview branches share prod credentials. Prevention: every env var must be scoped to Production vs Preview explicitly in the Vercel dashboard.

5. **Stripe test/live mode confusion** -- shipping sk_test_* or whsec_test_* in prod means real user payments either disappear silently or fail at webhook verification. Live mode and test mode have separate customer IDs, product IDs, price IDs, and signing secrets. All five must be swapped simultaneously.

**Additional blockers:**
- Rate limiter fails closed without Upstash -- UPSTASH_REDIS_REST_URL is .optional().default("") in env.ts, so the build succeeds but every login returns 429
- Supabase free tier auto-pause -- live domain backed by free-tier Supabase goes down silently after 7 days of inactivity
- HSTS max-age=63072000 on day one -- reduce to max-age=300 for first 48 hours in case cert or DNS needs correction
- Discogs tokens in plaintext fallback -- enable Supabase Vault before any Discogs connection on prod
- Session revocation not actually revoking -- logged-out token must return 401 on protected routes within 60s (E2E required)

---

## Implications for Roadmap

Six sequential sub-phases emerge from the dependency graph. Monitoring and rollback prep can run in parallel with phases 3-4.

### Phase 1: Pre-Deploy Audit Gate

**Rationale:** Commit 35ed595 claims all pre-deploy blockers are fixed but has not been independently verified. Every subsequent phase depends on a clean baseline. This phase is verification, not new work.

**Delivers:** Confirmed green baseline -- build, typecheck, tests, lint, pnpm audit, migration trail (supabase db reset clean), env inventory complete, secret grep of git history clean, all 35ed595 fixes independently verified.

**Must verify:**
- Cold-start fix from 35ed595 actually holds (Pitfall 8)
- Session revocation E2E passes (Pitfall 10)
- Discogs token encryption uses Vault, not plaintext fallback (Pitfall 11)
- supabase db reset from clean DB succeeds (Pitfall 3)
- Outstanding CSP issue from 2026-03-28 security audit confirmed resolved

**Avoids:** Discovering mid-deploy that a claimed fix was incomplete, with no revert path.
**Research flag:** Standard verification patterns. No deeper research needed.

---

### Phase 2: Supabase Prod Setup

**Rationale:** Every other phase depends on the prod Supabase project URL and keys. This is the root dependency.

**Delivers:** Separate digswap-prod Supabase project with all 28+ migrations applied, RLS verified (Security Advisor green, zero unprotected tables), Edge Functions deployed, Vault secrets inserted for pg_cron, trade-previews storage bucket with CORS and 48h TTL, Supabase Pro active (no auto-pause), PITR enabled, backup restore rehearsed once.

**Critical actions:**
- Use supabase db push exclusively -- never drizzle-kit push (Pitfall 3)
- Run supabase db push --dry-run before live push (Pitfall 4)
- Confirm pg_cron jobs: SELECT COUNT(*) FROM cron.job WHERE active returns 3+ (Pitfall 18)
- Verify all storage buckets have Public = off (Pitfall 20)
- Enable Supabase Vault before any Discogs connection (Pitfall 11)
- DATABASE_URL must use port 6543 (transaction pooler) with prepare: false (Pitfall 17)

**Research flag:** Standard Supabase patterns. No additional research needed.

---

### Phase 3: Vercel + Environment Wiring

**Rationale:** Depends on Phase 2. Vercel project import, env var population, and first build must succeed before DNS cutover is attempted.

**Delivers:** Vercel project linked to GitHub repo, all 21 env vars set with correct Production scope (not All Environments), preview env vars separately scoped to dev Supabase and test-mode Stripe, first build successful on *.vercel.app URL, Vercel Pro active, Node.js runtime pinned to 20 (matching CI), HSTS reduced to max-age=300 for launch window.

**Critical actions:**
- Grep .next/static/ post-build for all secrets (Pitfall 1)
- Verify only 7 vars carry NEXT_PUBLIC_ prefix (Pitfall 1)
- Generate fresh HANDOFF_HMAC_SECRET and IMPORT_WORKER_SECRET with openssl rand -hex 32 (Pitfall 29)
- Pin Vercel Node.js runtime to 20 to match CI
- Upgrade to Vercel Pro before enabling Stripe (Pitfall 22)

**Research flag:** Standard patterns. No additional research needed.

---

### Phase 4: DNS + SSL

**Rationale:** Depends on Phase 3 (Vercel project must exist to add the domain). DNS cutover is the point of no return -- once digswap.com resolves to Vercel, users can reach the app.

**Delivers:** Hostinger A record @ pointing at 76.76.21.21, CNAME www pointing at cname.vercel-dns.com, SSL cert issued by Lets Encrypt (verified via openssl s_client), DNS propagated from 2+ independent networks, Hostinger TTLs at 300s during cutover week, CAA records audited.

**Critical actions:**
- Set DNS the night before intended launch -- do not announce until openssl s_client confirms valid cert
- Keep Hostinger as registrar (do not transfer nameservers) to preserve existing MX records
- Verify CAA: dig CAA digswap.com -- if any CAA records exist, must include letsencrypt.org (Pitfall 12)
- Do NOT set NEXT_PUBLIC_SITE_URL in Vercel before DNS resolves

**Research flag:** Standard DNS patterns. No additional research needed.

---

### Phase 5: External Integrations (Stripe Live / OAuth / Resend)

**Rationale:** All three integrations depend on the domain being live (Phase 4). OAuth callback URLs reference the prod domain. Stripe webhook endpoint must be https://digswap.com/api/stripe/webhook.

**CRITICAL -- Stripe Live account activation takes 1-3 business days** (requires tax info, bank account, business details). This process must be started on day one of the milestone even though it is not needed until Phase 5. It is the only external dependency with a business-day SLA.

**Delivers:**
- Stripe Live mode activated, sk_live_* key in Vercel, live webhook endpoint with its own whsec_live_* signing secret, live Price IDs in env
- Discogs prod app registered with https://digswap.com/api/discogs/callback as sole callback (separate from dev app -- Discogs supports only one callback per app)
- Supabase Auth redirect URL allow-list updated with https://digswap.com/**
- Google OAuth client and GitHub OAuth app with prod Supabase callback URI added
- Resend sending domain verified (DKIM, SPF, DMARC), Supabase Auth SMTP pointing at Resend
- Vercel redeployed without cache after each env var change

**Critical actions:**
- Two Stripe webhook endpoints must exist: test-mode (dev), live-mode (prod) with different signing secrets (Pitfall 6)
- NEXT_PUBLIC_STRIPE_PRICE_MONTHLY and _ANNUAL must reference live-mode price IDs, not price_test_* variants (Pitfall 21)
- Test email deliverability to Gmail, Outlook, iCloud, ProtonMail before UAT (Pitfall 15)

**Research flag:** Standard integration patterns. No additional research needed.

---

### Phase 6: Smoke Tests + Human UAT

**Rationale:** Final verification gate before public access. Automated smoke tests catch what CI cannot. Human UAT catches what automation cannot.

**Delivers:** Playwright smoke suite passing against prod URL, /api/health returning 200, cold-start test (15-min idle then curl returning 200 in under 3s for all public routes), Stripe webhook round-trip (real $1 charge, subscription row in prod DB, refund), OAuth round-trip per provider, email delivery test to real inboxes, human UAT checklist signed off (full flow: signup through Stripe checkout), RUNBOOK.md committed, Vercel Instant Rollback rehearsed once, Sentry firing on a test error.

**Critical actions:**
- Cold-start test is non-optional -- this is where the 35ed595 fix claim gets verified independently (Pitfall 8)
- CSP verification: DevTools Console zero violations on all routes including Stripe Checkout and Google OAuth (Pitfall 14)
- Preview must NOT show prod data: confirm preview SUPABASE_URL prefix matches dev project (Pitfall 9)
- Vercel rollback rehearsal: deploy no-op change, rollback via CLI, re-enable auto-promote, document steps in RUNBOOK.md

**Research flag:** Standard smoke and UAT patterns. No additional research needed.

---

### Parallel Track: Monitoring Setup

Can run in parallel with phases 3-5. Should be complete before Phase 6 UAT.

**Delivers:** Sentry prod DSN and auth token in Vercel, Sentry beforeSend filters (suppress CSP noise, strip PII), UptimeRobot pinging /api/health every 5 min, Stripe webhook failure email alerts, Vercel Analytics + Speed Insights in app/layout.tsx, Sentry spike protection enabled.

---

### Phase Ordering Rationale

- Phases 1-6 are strictly sequential: each phase creates artifacts the next phase requires
- Monitoring runs in parallel because it depends only on the domain existing and a Sentry project (can create pre-deploy)
- Stripe Live activation must start day one due to the 1-3 business day SLA -- the only item not unblockable by the developer alone
- DNS cutover (Phase 4) is the commit point: after this, every issue is a live incident rather than a pre-deploy catch
- Human UAT (Phase 6) is the public launch gate -- no announcement before UAT sign-off and minimum soak time

### Research Flags

No phase in v1.4 requires a /gsd:research-phase call. The research files are comprehensive. The risk is in execution discipline, not in unknown patterns. All six phases follow standard, well-documented patterns with authoritative official documentation available.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | No new dependencies; all services already in package.json. Version pins validated against official docs. Cost floor ($45/mo) confirmed from official pricing pages. |
| Features | HIGH | Deploy workflow features fully defined. MVP checklist cross-referenced against all 4 research files. Anti-features grounded in official Vercel/Supabase guidance. |
| Architecture | HIGH | Topology grounded in actual repo file structure, not hypothetical. All 28 migrations, Edge Functions, and deploy target mapping confirmed by direct inspection. |
| Pitfalls | HIGH | All 11 P0 pitfalls cite specific apps/web/src/ file paths. Source quality is HIGH -- mostly official docs and direct codebase evidence. |

**Overall confidence: HIGH**

### Gaps to Address

- **35ed595 claims vs reality:** Commit claims all pre-deploy blockers resolved. Unverified until Phase 1 runs independent verification. Treat as unverified until proven. Phase 1 is the gate.

- **supabase db reset from clean DB:** Architecture research section 12 item 1 explicitly notes: "Migration trail sanity check not yet run against empty Supabase." This is a P0 unknown. If the migration trail fails from clean, the entire milestone is blocked until repaired.

- **supabase/config.toml missing:** Architecture research section 12 item 3 flags its absence. Without it, supabase link relies on dashboard state rather than repo state. Low severity for solo dev but must be created before any CI automation of Supabase deploys.

- **Outstanding CSP issue from March security audit:** User memory records "one outstanding CSP issue" from the 2026-03-28 security audit. Must be confirmed resolved (or documented as accepted risk) in Phase 1 before CSP enforcement goes live in prod.

- **Region selection:** ARCHITECTURE.md section 9.4 flags that Vercel and Supabase should be in matching regions. Recommendation: iad1 (US East) + Supabase us-east-1 as the global-neutral default unless analytics show a LATAM-heavy user base. This configuration decision must be made before Phase 3.

---

## Sources

### Primary (HIGH confidence)

- https://vercel.com/docs/plans/hobby -- plan limits, upgrade triggers
- https://vercel.com/docs/environment-variables -- Production/Preview/Development scoping
- https://vercel.com/docs/domains/working-with-domains/add-a-domain -- apex IP 76.76.21.21, CNAME value
- https://vercel.com/docs/instant-rollback -- Hobby = previous deploy only
- https://supabase.com/pricing -- free tier auto-pause (7 days), Pro plan ($25/mo)
- https://supabase.com/docs/reference/cli/supabase-db-push -- migration apply workflow
- https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pool -- port 6543, prepare: false
- https://supabase.com/docs/guides/database/vault -- secret storage for pg_cron
- https://docs.stripe.com/get-started/checklist/go-live -- 1-3 day activation SLA
- https://docs.sentry.io/platforms/javascript/guides/nextjs/ -- wizard setup, source map upload
- https://resend.com/docs/dashboard/domains/introduction -- DKIM/SPF/DMARC requirements
- Repo apps/web/package.json -- authoritative dependency and version list
- Repo apps/web/.env.local.example -- 21 required env vars
- Repo apps/web/next.config.ts -- Sentry wiring, HSTS header, productionBrowserSourceMaps: false
- Repo apps/web/src/lib/env.ts -- Zod env schema, Upstash optional default behavior
- Repo supabase/migrations/ -- 28+ migration files, authoritative schema trail
- Repo .github/workflows/ci.yml -- CI gates: lint, typecheck, test, build-web, build-desktop, e2e

### Secondary (MEDIUM confidence)

- https://medium.com/@rajanraj8979/learn-how-to-connect-your-hostinger-domain-to-your-vercel-deployed-project-with-this-easy-966f082919f3 -- cross-verified with Vercel official docs
- Repo .planning/quick/260406-aud-deploy-readiness-audit/260406-aud-SUMMARY.md -- prior audit P0/P1/P2 breakdown, baseline for Phase 1 verification
- User memory project_security_posture.md -- outstanding CSP issue flag from 2026-03-28 security audit

---

*Research completed: 2026-04-20*
*Ready for roadmap: yes*
*Milestone: v1.4 Production Launch*
