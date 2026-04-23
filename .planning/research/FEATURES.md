# Feature Research

**Domain:** First-ever production deploy workflow — Next.js 15 + Supabase Cloud + Vercel + Hostinger (solo dev)
**Researched:** 2026-04-20
**Confidence:** HIGH (official docs for Vercel, Supabase, Stripe, Next.js verified; corroborated across multiple current sources)

> This document maps the features a **deploy workflow** (not a product) needs to have to take DigSwap from dev-only to first production deploy without disasters. All product features (auth, Discogs, trade, gamification, Stripe freemium) are already built and out of scope here — focus is exclusively on the deploy pipeline, environment, verification, and incident response.

---

## Feature Landscape

### Table Stakes (Mandatory — First Deploy Fails Without These)

Features a first-time deploy cannot skip. Missing any of these either blocks the deploy or creates real disaster risk on day one.

#### Category: Pre-Deploy Audit

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Green `typecheck` gate | A red `tsc --noEmit` means `next build` will fail in Vercel — confirmed build blocker already seen in prior audit (gems/queries.ts casts). | LOW | Block: Phase 21 closed this for DigSwap. Must stay green. |
| Green `build` gate (production mode) | `next build` exercises production code path (bundling, tree-shaking, RSC boundaries). Dev mode does not catch client/server leaks. | LOW | Run locally before push: `pnpm --filter @digswap/web build`. |
| Green `test` gate (unit + integration) | 563+ tests exist — regression baseline. Red tests = unknown state of shipping code. | LOW | Already green per recent commit log (35ed595 "fix: resolve all pre-deploy blockers"). |
| Clean `lint` gate | Lint warnings hide real errors (unused imports = dead code, CRLF = git churn, a11y = accessibility bugs). | LOW | Phase 24 closed CRLF. Enforce in CI, not just locally. |
| `pnpm audit --prod --audit-level high` clean | A HIGH/CRITICAL dep vuln on first deploy is an auditable incident. Phase 22 closed this — stays closed only if audited each deploy. | LOW | Run in CI on every PR. |
| Env var audit (dev vs prod inventory diff) | The #1 solo-dev deploy disaster: local `.env.local` has a var prod Vercel doesn't. App boots, first login breaks. | MEDIUM | Maintain `.env.example` as source of truth. Startup-time `env.ts` validation with Zod — fail fast, not at first user (already partially built, needs hardening per prior audit P1). |
| Secret rotation check | Discogs consumer key/secret, Supabase service role, Stripe secret, Resend API key — if any were ever exposed (git leaks, screenshots, Discord), rotate before prod. | LOW | Grep history: `git log --all -p | grep -Ei "sk_|supabase.*service|discogs.*secret"`. |
| Migration reconciliation | Prior audit P0: `drizzle/` journal diverged from `supabase/migrations/`. A fresh prod DB applying these in order will fail or drift silently. | HIGH | Bootstrap a clean empty DB from `main` — if it fails, fix before prod. |
| Build-from-clean-checkout smoke | Local worktree has 185+ dirty files per prior audit. Vercel builds from a clean git checkout — untracked files your dev depends on won't exist in prod. | LOW | Script: `git stash -u && pnpm install && pnpm build && git stash pop`. |

#### Category: Production Environment Setup

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Separate Supabase prod project | Shared dev/prod is a permanent foot-gun — test seeds leak to real users, schema experiments break paying customers. Supabase best practice: single prod project + branching for dev. | MEDIUM | Create new Supabase project named `digswap-prod`. Different URL, different anon key, different service role. |
| Prod DB migrations applied | Apply the reconciled `supabase/migrations/` trail to the new prod project via `supabase db push` or GitHub Action. Not via `drizzle-kit push` — Drizzle push is for dev, can destructively alter prod. | MEDIUM | Use `supabase migration up` in CI with `SUPABASE_ACCESS_TOKEN`. |
| RLS verification on prod data | Prior audit touched this: `20260405_fix_all_rls_null_policies.sql` exists because RLS was broken. On prod, a missing RLS policy = any authenticated user can read any other user's data. | HIGH | Run `supabase db lint` + manual SQL: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN (SELECT tablename FROM pg_policies);` — any row returned = unprotected table. |
| Prod Storage bucket created | `trade-previews` bucket (Phase 28 pending) needs to exist on prod with correct lifecycle + CORS before Phase 27 audio pipeline ships. | LOW | Create in Supabase dashboard; set 48h object TTL; restrict CORS to production origin. |
| Prod backups enabled + tested | Supabase free tier: daily backups only; Pro: PITR. If free tier, accept 24h data loss window and document it. A backup you've never restored = not a backup. | MEDIUM | Test restore to a throwaway branch before deploy. |
| Vercel project created + linked to repo | Trivial but load-bearing: Vercel project settings own production domain, prod env vars, and deployment branch (must be `main`). | LOW | Connect via Vercel dashboard or `vercel link`. |
| Prod env vars populated in Vercel | Set each var for **Production** scope only (not Preview). Separate values from dev: different Supabase URL, different Stripe keys, different Discogs app. | MEDIUM | Vercel dashboard → Settings → Environment Variables. Use Production checkbox only. |
| Domain + DNS configured (Hostinger → Vercel) | Apex A record → `76.76.21.21`; `www` CNAME → Vercel-assigned value. SSL auto-provisions in 5min–few hours after DNS propagates. | LOW | Keep Hostinger as DNS registrar (not nameserver swap) to preserve MX/other records. |
| OAuth redirect URIs updated in all providers | Discogs, Google, GitHub OAuth apps all have localhost:3000 callbacks from dev. Prod needs `https://digswap.xyz/auth/callback/*` added **before** first prod login attempt. | LOW | Do NOT remove dev callbacks — OAuth apps allow multiple; keep both. |
| Stripe live mode keys + live webhook endpoint | Test keys return test card data; first real charge requires `sk_live_*`. Live webhook has a **different signing secret** — using the test one in prod silently drops all subscription events. | MEDIUM | Create new Stripe webhook endpoint in live mode pointing at `https://digswap.xyz/api/stripe/webhook`. Update `STRIPE_WEBHOOK_SECRET` in Vercel. |
| Resend domain verified | Transactional email (wantlist matches, trade requests) sends from `noreply@digswap.xyz`. Until DKIM/SPF verified at Resend, mail lands in spam or bounces. | LOW | Add TXT records to Hostinger DNS per Resend instructions; verify in dashboard. |
| Upstash prod Redis instance | Prior audit P1: rate limit is `failClosed=true` in critical paths. No Redis = logins start failing on first traffic spike. | LOW | Create separate prod instance; separate URL + token in Vercel env. |

#### Category: Deploy Execution

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Staged deploy (preview → manual promote) | Push to `main` with auto-promote OFF. First deploy lands as a Preview-equivalent build with full prod env, tested, then manually promoted. Vercel supports disabling domain auto-assign. | MEDIUM | Vercel: Settings → Deployment Protection → disable auto-promote. Use Preview Deployments for prod-parity smoke. |
| Deploy observability (log tail) | Watching `vercel logs --follow` during deploy catches cold-start 500s, missing env vars, connection pool exhaustion in the first 60s. | LOW | Keep CLI open during promote. |
| CI as deploy gate (GitHub Actions) | Prior audit noted `.github/workflows/ci.yml` was untracked. A deploy that bypasses CI has no objective "green" state. | MEDIUM | Commit CI workflow. Gate deploy on `typecheck + build + test + lint + audit` all green. |
| Maintenance mode / feature flag kill switch | If deploy surfaces a critical bug, instant rollback may still take 60s of bad requests. A preview maintenance banner or a feature flag to disable the broken flow buys recovery time. | MEDIUM | Vercel middleware + env var (`MAINTENANCE_MODE=true`). |
| Database migration ordered **before** code deploy | Code referencing a new column deployed before the migration = runtime 500s. Migrations must land first or be backward-compatible. | HIGH | Two-phase deploys: (1) additive migration, (2) code using new column. Never drop columns in same deploy as code removal. |

#### Category: Post-Deploy Verification

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Automated smoke tests against prod URL | After promote, hit `/`, `/signin`, `/signup`, `/pricing`, `/api/health` — any non-200 means revert. Prior audit P0: these returned 500/timeout. | MEDIUM | Playwright script: `playwright test --project=prod-smoke --grep=smoke`. Run post-promote in CI. |
| `/api/health` endpoint | A dedicated route that probes DB, Redis, Discogs connectivity and returns 200 only if all are healthy. Uptime monitors ping this. | LOW | Response body includes `{ db: ok, redis: ok, discogs: ok }`. `Cache-Control: no-store`. Return 503 if any dependency fails. |
| Cold-start route test | Prior audit P0: pages 500'd on cold start because public pages called `supabase.auth.getUser()`. Fresh Vercel function instance needs to not hit this pitfall. | MEDIUM | Script: pause function, hit public route, verify 200 in <3s. |
| Human UAT checklist (real user flows) | Signup → email verify → Discogs OAuth → import → profile → trade proposal → Stripe checkout. One-pass manual run by a real human on the prod URL. | MEDIUM | Write as Markdown checklist with screenshots per step. Block public launch until signed off. |
| Stripe webhook round-trip test | Make a real $1 test charge (or use Stripe CLI in live mode). Verify webhook fires, subscription row appears in prod DB. | LOW | Stripe → Events → click through to confirm 200 response from webhook. |
| OAuth round-trip test | For each provider (Google, GitHub, Discogs): real login from prod URL, verify session persists, verify data imports. Dev OAuth apps won't show these as errors — prod OAuth app misconfig will. | LOW | One-pass manual. |
| Email delivery verification | Send real wantlist match + account verification + trade notification. Check inbox (not spam), verify links resolve to prod URL. | LOW | Test with personal Gmail + secondary address. |

#### Category: Monitoring + Alerting

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Error tracking (Sentry or equivalent) | Solo dev cannot manually tail logs 24/7. Unhandled server errors must page you. `@sentry/nextjs` auto-captures Server Component, Server Action, Route Handler errors. | MEDIUM | `npx @sentry/wizard -i nextjs`. Add Supabase integration for DB query errors. Configure alert to email for new issue types. |
| Uptime monitoring | External ping to `/api/health` every 1–5min. If prod goes down and you're asleep, you know before users email you. | LOW | Free tier: UptimeRobot, Hyperping, BetterStack. |
| Vercel Analytics + Speed Insights | Tracks Core Web Vitals + traffic. LCP regression = user-visible bug; catch before support tickets. | LOW | One-line add: `<Analytics />` and `<SpeedInsights />` in `app/layout.tsx`. Free on Vercel. |
| Supabase logs + query performance | Slow query log catches N+1 and missing indexes. First week of prod traffic is the only time real query patterns appear. | LOW | Supabase dashboard → Logs + Reports. Review daily week 1. |
| Stripe webhook failure alert | Failed webhooks = lost revenue events. Stripe dashboard → Webhooks → enable email on 5xx. | LOW | Configure at the Stripe webhook endpoint level. |
| Rate-limit trigger alert | Prior audit P1: Redis down = login fails closed. If Upstash goes down at 3am, alert to pager, not to users. | MEDIUM | Upstash alert on command error rate; Sentry alert on rate-limit fail-closed path. |

#### Category: Rollback + Incident Response

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Vercel Instant Rollback tested | Vercel supports routing-layer rollback (~seconds). But on Hobby plan, rollback is only to the **previous** deployment — not arbitrary. Verify plan + test rollback before needing it. | LOW | `vercel rollback` CLI or dashboard. Test with a no-op deploy. |
| Documented rollback decision tree | In an incident, 3am, half-awake: "is this Vercel, Supabase, DNS, OAuth, or Stripe?" A pre-written decision tree ~= survival. | LOW | One-page `RUNBOOK.md`: symptoms → component → action. |
| Database migration rollback plan | Supabase has no built-in down migrations. Every migration that alters prod data needs a hand-written inverse SQL sitting in `supabase/migrations/rollbacks/`. | HIGH | For destructive migrations only. Additive migrations (new columns, new tables) are safe to leave; drops/alters need inverse. |
| Point-in-time recovery (PITR) access | If bad migration corrupts data, rollback code doesn't fix the data. PITR (Supabase Pro only) lets you restore DB to T-5min. | MEDIUM | $25/mo Supabase Pro — judgement call at launch. Pre-launch: at minimum, daily backup restore rehearsed once. |
| Incident communication channel | One bug = one tweet / email to users. "We know, working on it" is mandatory. Silence = lost trust. | LOW | Status page (free: status.hyperping.com, betterstack.com/status) OR pinned tweet OR in-app banner. |

---

### Differentiators (Nice-to-Have — Reduce Toil Over Time)

Features that aren't required for a successful first deploy but significantly lower the cost of every subsequent deploy.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Supabase Persistent Staging Branch | Long-lived staging env that mirrors prod schema. Test migrations against real-shape data before prod. | MEDIUM | Supabase Branching (free on Pro). Merge PR → auto-deploy to preview branch. |
| Preview deploys per PR with isolated DB branch | Every PR gets a throwaway Supabase branch + Vercel preview. UAT happens on preview, not locally. | HIGH | GitHub Action: Vercel preview deploy + Supabase ephemeral branch. Costs compute but catches drift. |
| Synthetic user journey tests (prod-facing) | Playwright tests running **against prod** every 15min, exercising signup → import → trade flow. Catches breakage before users do. | HIGH | Run from GitHub Actions on cron. Use a dedicated `synthetic@digswap.xyz` account. |
| Log Drains to long-term storage | Vercel logs retention is limited (24h Hobby, 3-30d Pro). Drain to Logtail/Datadog/Axiom for post-incident forensics beyond Vercel's window. | MEDIUM | Vercel Log Drains (Pro feature) → Axiom free tier. |
| Deployment announcements to Discord/Slack | Every prod deploy posts commit SHA, author, changelog diff to a channel. Audit trail + "who deployed what" without opening Vercel. | LOW | Vercel → Deploy Hooks + webhook → Discord channel. |
| Feature flags (LaunchDarkly / Flagsmith / env-based) | Deploy a feature dark, enable for yourself first, then 10%, then all. Decouples deploy risk from feature-launch risk. | MEDIUM | For a solo dev: env-var-based flags are fine. Full platform is overkill until 10+ features shipping/week. |
| Rolling releases / canary traffic split | Vercel Rolling Releases: 10% of prod traffic to new build for 10min, auto-promote if error rate <X. | HIGH | Vercel Pro/Enterprise feature. Overkill for first deploy — add when daily traffic >10k. |
| Deploy protection / password-gated preview | Preview deploys publicly accessible by default. For a pre-launch app, gate behind Vercel Password or IP allowlist. | LOW | Vercel → Settings → Deployment Protection → Standard Protection. |
| WAF (Web Application Firewall) rules | Block known-bad IPs, bot user agents, scraping. Not load-bearing for a pre-launch digger app but useful once indexed. | MEDIUM | Vercel WAF (Pro feature) — free managed ruleset available. |
| Scheduled deploy windows | Deploy only during hours you're awake to fix breakage. Sunday midnight = bad deploy window. | LOW | Convention, not tooling. Commit to: no deploys after 8pm local, no Friday afternoon deploys. |
| Pre-deploy Lighthouse check | Block deploy if Lighthouse performance score <X. Prevents shipping regressions in LCP/CLS. | MEDIUM | GitHub Action: `treosh/lighthouse-ci-action`. Enforce on PRs, not hard deploy block. |
| Status page | Public `status.digswap.xyz` showing uptime + current incidents. Builds user trust; reduces "is it down?" support tickets. | LOW | Free tier: BetterStack, Hyperping. |
| Automated changelog / release notes | Conventional Commits + `release-please` or `changesets` → auto-generate changelog on main merge. Forces discipline on commit messages; users see what changed. | MEDIUM | Optional. For DigSwap's solo-dev cadence, a manually-maintained `CHANGELOG.md` is fine v1. |

---

### Anti-Features (Commonly Requested, Often Problematic — Avoid on First Deploy)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| "Big bang" single-deploy migration + code change | Feels clean — one commit, one deploy, done. | If migration succeeds but code fails, DB is ahead of code and every user sees 500s. If code succeeds but migration fails, code queries columns that don't exist. No atomic rollback across two systems. | **Expand-migrate-contract pattern**: (1) additive migration, (2) code that tolerates old+new schema, (3) backfill, (4) code that uses only new schema, (5) drop old columns. Each step deployable independently. |
| Skipping staging — "trust the tests, ship to prod" | 563 tests green, why bother with staging? | Tests don't catch env misconfig, DNS mistakes, OAuth callback typos, Stripe webhook mismatch, Redis connection string wrong. All four of these are *only* visible on a prod-shaped environment. | **One prod-shaped preview deploy per release**, with full prod env vars (against a staging Supabase branch), smoke-tested, then promoted. |
| Custom-built deploy orchestration script | "I want full control, I'll write a bash script." | Vercel already handles: clean checkout, install, build, SSL, caching, rollback. A custom script means reinventing all of that + owning its bugs + having no rollback UI. Solo-dev time sink. | **Use Vercel's defaults**. Configure via `vercel.json` + env vars only. Touch orchestration only when defaults actually break. |
| Production database accessible from localhost | Convenient for debugging, one-off queries. | Prod credentials in .env.local = they leak (screenshots, Discord pastes, git slips). Any destructive query from local hits real data. | **Read-only prod replica** for debugging OR scoped short-lived creds via `supabase db remote` commands. Never commit prod service role to .env.local. |
| Full email blast to users on first deploy | "We're live! Tell everyone!" | Deploys surface edge cases that passed UAT. Day-1 traffic spike + day-1 bugs = user frustration you can't reach 500 inboxes to explain. | **Soft launch**: invite-list only (10–50 diggers who opted in). Announce publicly only after 1 week of stable uptime. |
| Automated down-migrations on rollback | "If rollback fails, auto-run the down migration." | Automated data rollback on production is one of the most dangerous patterns in deploys. An incorrect down migration = unrecoverable data loss. | **Manual rollback only**. Keep down migrations as `.sql` files next to each up migration, but execute by hand after verifying current state. Rollback code first; rollback DB only if absolutely necessary. |
| Shared dev/prod Supabase project | Saves $25/mo on Pro tier or "keeps things simple." | Dev seeds (fake users, test trades) visible to real users. Schema experiments break paying customers. Prior audit's RLS drift happened partially because of this pattern. | **Separate prod project** from day one. Free tier is fine for MVP — upgrade to Pro only when you need PITR or >500MB DB. |
| Deploy gated solely on manual approval ("I'll review before pushing") | "I'm solo, I'll just be careful." | Humans at 11pm miss typos. Green CI is cheap; human attention is the scarce resource. | **Automated gates + manual promote**. Let CI enforce `typecheck/build/test/lint/audit`. Human only decides *when* to promote, not whether the code is ready. |
| Monitoring "someday, when we're bigger" | Pre-launch optimization feels premature. | First 72 hours of production are when most bugs surface. Without Sentry, you discover them from angry users days later. Without uptime monitoring, you don't know it's down. | **Day-1 Sentry + UptimeRobot**. Both have free tiers sufficient for MVP. Zero-effort setup (~30min total). |
| Running `drizzle-kit push` against prod | Quick way to sync schema. | `drizzle-kit push` executes DDL without migration history — breaks the `supabase/migrations/` trail, diverges envs, cannot be replayed to reproduce prod state. Prior audit's drift partially came from this pattern. | **`supabase migration up` only in prod**. Drizzle for dev-loop schema authoring → `supabase db diff` generates migration → commit → CI applies via supabase CLI. |
| Skipping DNS propagation wait ("it resolves on my laptop") | Faster to promote immediately. | DNS propagation is 5min–48h globally. Promoting to prod before propagation means users in different regions hit different builds or get SSL errors for hours. | **Wait for dig to confirm**. `dig +short digswap.xyz @8.8.8.8` returns Vercel IP. Verify from 2+ networks before promoting. |
| Not testing the rollback path before needing it | "Rollback is a one-click button, it'll just work." | Vercel Hobby tier only rolls back to previous deployment — not arbitrary. After rollback, auto-promote disables, so next push doesn't ship unless you re-enable. Both surprises happen during active incidents. | **Pre-launch rehearsal**: deploy a no-op change, rollback via CLI + dashboard, re-enable auto-promote, deploy again. Document steps in RUNBOOK.md. |
| Committing to a public launch date before UAT pass | Marketing pressure. | Forces shipping a broken deploy to meet date. One bad first impression = permanent churn for diggers who otherwise would have become power users. | **Soft-launch the domain first** (invite list, pre-launch landing). Commit to public launch date only after UAT + 1 week of soak time. |

---

## Feature Dependencies

```
Pre-Deploy Audit (all gates green)
    └── requires ─> CI as deploy gate
    └── requires ─> Migration reconciliation
    └── requires ─> Env var audit

Production Environment Setup
    └── requires ─> Separate Supabase prod project
    └── requires ─> Prod env vars in Vercel
    └── requires ─> Domain + DNS + SSL
           └── enables ─> OAuth redirect URIs updated
                              └── enables ─> OAuth round-trip test

Deploy Execution
    └── requires ─> Pre-Deploy Audit complete
    └── requires ─> Production Environment Setup complete
    └── requires ─> Staged deploy (preview → promote)
           └── enables ─> Post-Deploy Verification

Post-Deploy Verification
    └── requires ─> /api/health endpoint
    └── requires ─> Automated smoke tests
           └── enables ─> Human UAT checklist
                              └── enables ─> Public launch decision

Monitoring + Alerting
    └── requires ─> /api/health endpoint (for uptime probe)
    └── enhances ─> Post-Deploy Verification (catches what smoke missed)

Rollback + Incident Response
    └── requires ─> Monitoring (can't fix what you can't see)
    └── requires ─> Vercel Instant Rollback tested
    └── requires ─> Documented rollback decision tree (RUNBOOK.md)
           └── enables ─> Real incident survival

Stripe live-mode setup ──conflicts──> Stripe test-mode setup in same env
Big-bang migration ──conflicts──> Zero-downtime deploy
drizzle-kit push in prod ──conflicts──> Reproducible migration trail
```

### Dependency Notes

- **CI gate before deploy:** Without green CI, every deploy is a lottery. Must commit `.github/workflows/ci.yml` (prior audit: was untracked).
- **Migration reconciliation before prod DB exists:** A fresh Supabase prod project must be able to apply the migration trail from zero. If `supabase db reset` on a local empty DB fails, prod will fail identically.
- **Domain/DNS before OAuth updates:** OAuth redirect URIs reference your domain. Cannot add `digswap.xyz/auth/callback/google` until `digswap.xyz` resolves.
- **/api/health before uptime monitoring:** An uptime probe pinging `/` measures whether the landing page renders, not whether the app is healthy. Need a semantic health endpoint.
- **Rollback rehearsal before incident:** The one time you can't debug is mid-incident. Rehearse cold.
- **Sentry before first real user:** The first 72 hours produce the highest density of surfaced bugs. Without error tracking in place, they are invisible until the user emails you.

---

## MVP Definition (First-Deploy Workflow Minimum)

### Launch With (v1 — must complete before first real user)

**Pre-Deploy Audit**
- [ ] All 4 gates green locally: `typecheck`, `build`, `test`, `lint`
- [ ] `pnpm audit --prod --audit-level high` clean
- [ ] `.env.example` complete and matches prod var inventory
- [ ] Secrets grep on git history (no leaked keys)
- [ ] Migration trail boots cleanly from empty DB
- [ ] CI workflow committed and enforced on `main`

**Production Environment**
- [ ] Separate Supabase prod project (`digswap-prod`) with migrations applied
- [ ] RLS verified: no table without policy
- [ ] Prod Storage bucket + CORS
- [ ] Prod Upstash Redis provisioned
- [ ] Vercel project created, linked, production env vars populated
- [ ] Domain DNS live, SSL provisioned, propagation verified from 2 networks
- [ ] OAuth apps: prod callback URIs added for Discogs, Google, GitHub
- [ ] Stripe live-mode webhook endpoint + signing secret in Vercel
- [ ] Resend domain verified (DKIM/SPF in DNS)

**Deploy Execution**
- [ ] First deploy lands as Preview-equivalent (auto-promote disabled)
- [ ] `vercel logs --follow` tailed during promote
- [ ] Maintenance mode env var wired (unused but ready)

**Post-Deploy Verification**
- [ ] `/api/health` endpoint returning 200 with DB + Redis checks
- [ ] Automated Playwright smoke test passes against prod URL
- [ ] Manual cold-start test: pause function, hit `/`, verify <3s response
- [ ] Human UAT checklist: 1-pass run through full flow (signup → Discogs → trade → Stripe)
- [ ] Stripe webhook round-trip: real $1 charge, subscription row in prod DB
- [ ] OAuth round-trip test per provider
- [ ] Email delivery test: wantlist match + account verify + trade notification

**Monitoring**
- [ ] Sentry wired with `@sentry/nextjs` + Supabase integration
- [ ] UptimeRobot (or equivalent) pinging `/api/health` every 5min
- [ ] Vercel Analytics + Speed Insights enabled
- [ ] Stripe webhook failure alerts enabled

**Rollback + Incident**
- [ ] `RUNBOOK.md` committed: symptoms → component → action for top 10 failures
- [ ] Vercel Instant Rollback tested at least once before launch
- [ ] Supabase backup exists, restore rehearsed once

### Add After Validation (v1.x — once prod is stable for 1 week)

- [ ] Supabase Persistent Staging Branch — trigger: second deploy starts to feel risky
- [ ] Preview deploy per PR with isolated Supabase branch — trigger: >1 PR in flight simultaneously
- [ ] Status page — trigger: first incident or first user asking "is it down?"
- [ ] Log Drains to Axiom — trigger: first forensic investigation hits Vercel's log retention limit
- [ ] Deploy announcements to Discord — trigger: first "what changed?" question
- [ ] Pre-deploy Lighthouse check — trigger: first regression in Core Web Vitals

### Future Consideration (v2+ — defer until traffic or team warrants)

- [ ] Synthetic user journey tests against prod — deferred until daily users >100 (before that, catch rate isn't worth maintenance)
- [ ] Rolling releases / canary — Vercel Pro feature, defer until daily traffic >10k
- [ ] WAF + bot rules — defer until first abuse incident or indexed in search
- [ ] Feature flag platform (LaunchDarkly/Flagsmith) — defer until >10 features/week or team >1 dev
- [ ] Automated semantic release / changelog — defer until manual changelog feels burdensome

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Green CI gate on `main` | HIGH (blocks all bad deploys) | LOW (1 workflow file) | **P1** |
| Separate Supabase prod project | HIGH (prevents data contamination) | LOW (new project + env vars) | **P1** |
| Migration trail boots from empty | HIGH (first deploy will fail without it) | MEDIUM (reconciliation work) | **P1** |
| Prod env var audit | HIGH (#1 deploy failure cause) | LOW (checklist vs `.env.example`) | **P1** |
| OAuth prod callback URIs | HIGH (login breaks otherwise) | LOW (dashboard work per provider) | **P1** |
| Stripe live-mode webhook | HIGH (subscriptions silently drop) | LOW (1 endpoint + secret) | **P1** |
| `/api/health` endpoint | HIGH (enables all monitoring) | LOW (~50 lines) | **P1** |
| Staged deploy (manual promote) | HIGH (prevents bad promote) | LOW (Vercel setting) | **P1** |
| Automated smoke tests | HIGH (catches cold-start 500s) | MEDIUM (Playwright script) | **P1** |
| Human UAT checklist | HIGH (catches what tests don't) | LOW (Markdown checklist) | **P1** |
| Sentry error tracking | HIGH (invisible bugs → visible) | LOW (wizard command) | **P1** |
| Uptime monitoring | HIGH (discover outages before users) | LOW (UptimeRobot signup) | **P1** |
| Vercel Instant Rollback tested | HIGH (survival in incidents) | LOW (rehearsal) | **P1** |
| RUNBOOK.md | HIGH (3am clarity) | LOW (1 page markdown) | **P1** |
| Supabase PITR (Pro tier) | MEDIUM (data recovery) | MEDIUM ($25/mo) | **P2** |
| Supabase staging branch | MEDIUM (safer migrations) | MEDIUM (Pro feature + workflow) | **P2** |
| Vercel Analytics + Speed Insights | MEDIUM (perf regression detection) | LOW (1 component) | **P2** |
| Status page | MEDIUM (user trust) | LOW (BetterStack signup) | **P2** |
| Log Drains to Axiom | MEDIUM (forensics beyond 24h) | MEDIUM (integration) | **P2** |
| Deploy announcements | LOW (audit trail) | LOW (Vercel hook) | **P3** |
| Synthetic journey tests | LOW initially, HIGH at scale | HIGH (Playwright maintenance) | **P3** |
| Rolling releases | LOW at launch, MEDIUM at scale | HIGH (Vercel Pro) | **P3** |
| WAF rules | LOW pre-indexed | MEDIUM | **P3** |
| Feature flag platform | LOW for solo dev | MEDIUM | **P3** |

---

## Competitor Feature Analysis

"Competitors" here = reference deploy workflows from mature Next.js + Supabase projects, plus Vercel/Supabase official guidance.

| Feature | Vercel's Own Next.js Subscription Starter | Typical Indie Hacker Solo-Dev | DigSwap's Approach |
|---------|-------------------------------------------|-------------------------------|--------------------|
| Pre-deploy gates | CI-enforced: typecheck, build, test | Often "I ran it locally" | **All 4 + audit enforced in CI before promote** |
| Staging environment | Preview deploys + Supabase branching | Often skipped — "prod is my staging" | **Preview with prod-shaped env vars, manual promote to prod** |
| Migration strategy | `supabase migration up` in CI on merge | Mix of `drizzle-kit push` and manual SQL | **`supabase migration up` only; Drizzle for dev authoring, `supabase db diff` to generate committed migration** |
| Health endpoint | Built-in `/api/health` pattern | Often missing, `/` used as proxy | **Dedicated `/api/health` probing DB + Redis + Discogs** |
| Rollback | Vercel Instant Rollback documented | Untested until first incident | **Rehearsed pre-launch, documented in RUNBOOK.md** |
| Monitoring | Sentry + Vercel Analytics | Often deferred post-launch | **Sentry + UptimeRobot + Analytics on day 1** |
| Secrets management | Vercel env vars, per-environment | Often single `.env` reused | **Prod scope only for prod vars; rotated secrets audited pre-launch** |
| OAuth redirects | Documented per-provider update | Often debugged reactively post-deploy | **Pre-deploy checklist item; round-trip test required in UAT** |
| Stripe live transition | Documented in go-live checklist | Often silently continues using test webhook | **Live webhook created + tested with real $1 charge before promote** |
| Launch pattern | Not addressed | Full public launch + hope | **Soft-launch invite list → 1 week soak → public** |

---

## DigSwap-Specific Considerations

Based on codebase state and prior audit:

1. **Existing audit already closed critical blockers** — Phases 21 (typecheck), 22 (deps), 23 (tests), 24 (lint) are green. The prior audit also recorded a fresh fix commit: `35ed595 fix: resolve all pre-deploy blockers from 6-skill audit`. Confidence is higher than typical first deploys because gates already work.

2. **Migration drift needs final verification** — Prior audit P0 flagged `drizzle/` vs `supabase/migrations/` divergence. Before first prod deploy, confirm a `supabase db reset` against a fresh DB applies the trail cleanly.

3. **Desktop app is explicitly out of scope for v1.4** — Electron P2P runtime (Phases 17–19) is deferred to v1.5. Web-only deploy reduces surface area dramatically: no code signing, no VPS for PeerJS/coturn, no auto-update channel. Focus v1.4 entirely on Vercel + Supabase + Hostinger.

4. **Freemium already live in code** — Stripe integration (Phase 16) is complete. First prod deploy includes live Stripe keys + live webhook from day one. Test mode → live mode transition is a first-class checklist item, not an afterthought.

5. **OWASP posture is strong, one CSP issue open** — Per user memory: "Security audit (2026-03-28): posture strong, one outstanding CSP issue, fixes applied". Worth re-verifying CSP before prod headers go live; a broken CSP silently breaks inline scripts/images in prod while dev still works.

6. **Realtime + Realtime + Edge Functions limits** — Supabase free tier: 200 concurrent Realtime connections. DigSwap's Radar + wantlist match notifications use Realtime. Monitor connection count week 1; upgrade to Pro (500 concurrent) before launching wider than invite list.

7. **Solo dev, one-chance deploy posture** — User is a solo developer doing their first-ever production deploy per orchestrator context. Default toward over-documentation (RUNBOOK, UAT checklist as Markdown) over optimistic assumptions ("I'll remember").

---

## Sources

### Vercel (HIGH confidence — official docs)
- [Vercel Production Checklist](https://vercel.com/docs/production-checklist) — comprehensive pre-launch list
- [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback) — rollback feature docs
- [Vercel CLI rollback](https://vercel.com/docs/cli/rollback) — CLI reference
- [Vercel Managing Deployments](https://vercel.com/docs/deployments/managing-deployments) — deployment lifecycle
- [Vercel Promoting Deployments](https://vercel.com/docs/deployments/promoting-a-deployment) — manual promote workflow
- [Vercel Staging Environment Guide](https://vercel.com/kb/guide/set-up-a-staging-environment-on-vercel) — solo-dev staging patterns
- [Vercel Custom Domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain) — DNS configuration
- [Vercel Environments](https://vercel.com/docs/deployments/environments) — env var scoping

### Next.js (HIGH confidence — official docs)
- [Next.js Production Checklist](https://nextjs.org/docs/pages/guides/production-checklist) — framework-specific production concerns
- [Next.js Environment Variables](https://nextjs.org/docs/pages/guides/environment-variables) — NEXT_PUBLIC_ semantics
- [Next.js Testing Guide](https://nextjs.org/docs/app/guides/testing) — post-deploy testing patterns
- [Next.js Health Check Endpoint Pattern](https://hyperping.com/blog/nextjs-health-check-endpoint) — `/api/health` implementation (MEDIUM confidence — third-party but widely followed pattern)

### Supabase (HIGH confidence — official docs)
- [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations) — CI migration workflow
- [Supabase Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments) — dev/staging/prod separation
- [Supabase Branching](https://supabase.com/docs/guides/deployment/branching) — persistent and preview branches
- [Supabase Deployment Maturity Model](https://supabase.com/docs/guides/deployment/maturity-model) — progressive deploy sophistication
- [Supabase Rollback Migrations Discussion](https://github.com/orgs/supabase/discussions/11263) — confirms no native down-migrations (MEDIUM confidence — official discussion)

### Stripe (HIGH confidence — official docs)
- [Stripe Go-Live Checklist](https://docs.stripe.com/get-started/checklist/go-live) — test-to-live transition
- [Stripe Webhooks](https://docs.stripe.com/webhooks) — webhook semantics including live-mode signing secret

### Monitoring + Error Tracking (HIGH confidence — official docs)
- [Sentry Next.js Integration](https://sentry.io/for/nextjs/) — official SDK docs
- [Sentry Supabase Integration](https://supabase.com/docs/guides/telemetry/sentry-monitoring) — DB query monitoring
- [Supabase + Sentry Workshop](https://sentry.io/resources/supabase-sentry-workshop/) — slow query + error patterns

### UAT + Smoke Testing (MEDIUM confidence — practitioner references)
- [User Acceptance Testing Checklist — BrowserStack](https://www.browserstack.com/guide/user-acceptance-testing-checklist) — structured UAT pattern
- [Smoke Testing In Production Guide](https://www.globalapptesting.com/blog/smoke-testing-in-production) — post-deploy automation
- [UAT Checklist — Marker.io 2026](https://marker.io/blog/user-acceptance-testing-checklist) — current-year practitioner guide

### Deploy Patterns (MEDIUM confidence — practitioner articles, corroborated)
- [Complete Next.js Deploy Guide 2026](https://dev.to/zahg_81752b307f5df5d56035/the-complete-guide-to-deploying-nextjs-apps-in-2026-vercel-self-hosted-and-everything-in-between-48ia)
- [Hostinger → Vercel DNS Guide](https://medium.com/@rajanraj8979/learn-how-to-connect-your-hostinger-domain-to-your-vercel-deployed-project-with-this-easy-966f082919f3)
- [Vercel Preview vs Production Stale Deploy Fix](https://blog.devtarun.com/deployment/vercel-preview-production-deployment-stale-site-fix)

### Internal Research Inputs (HIGH confidence — project-local)
- `.planning/PROJECT.md` — DigSwap product architecture + v1.4 milestone scope
- `.planning/quick/260406-aud-deploy-readiness-audit/260406-aud-SUMMARY.md` — prior audit findings (P0/P1/P2 breakdown)
- `.planning/ROADMAP.md` — v1.1 Deploy Readiness phases 21–24 completed; no deploy-execution phase yet exists
- `CLAUDE.md` — stack decisions, skills registry
- Git log commit `35ed595 fix: resolve all pre-deploy blockers from 6-skill audit` — recent baseline

---

*Feature research for: first production deploy workflow (Next.js 15 + Supabase Cloud + Vercel + Hostinger, solo dev, v1.4 DigSwap Production Launch)*
*Researched: 2026-04-20*
