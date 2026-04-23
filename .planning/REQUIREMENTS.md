# Requirements: DigSwap v1.4 Production Launch

**Defined:** 2026-04-20
**Core Value:** A digger opens the app and immediately finds who has the record they've been hunting — and sees where they stand in the community.
**Milestone Focus:** First production deploy of the web application to Vercel + Supabase Cloud with the domain registered at Hostinger.

## v1.4 Requirements

Requirements for milestone v1.4 (Production Launch). Each maps to exactly one roadmap phase.

### Pre-Deploy Audit Gate

Independent verification of the baseline before touching any prod infrastructure. Commit `35ed595` claims pre-deploy blockers fixed — this gate verifies that claim.

- [x] **DEP-AUD-01**: All 4 CI gates green against main (typecheck, build, test, lint) <!-- Phase 33.1: lint debt closed in 033.1-02 -->
- [x] **DEP-AUD-02**: Migration trail applies cleanly on empty Supabase (`supabase db reset` succeeds end-to-end)
- [x] **DEP-AUD-03**: Cold-start 500 fix from 35ed595 independently verified via curl on public routes (`/`, `/signin`, `/signup`, `/pricing`) <!-- PASS in Phase 33 (audit drift fix 2026-04-24, Phase 33.1) -->
- [x] **DEP-AUD-04**: Session revocation E2E passes (logged-out token returns 401 on protected routes within 60s) <!-- Phase 33.1: re-verified end-to-end in 033.1-04 -->
- [x] **DEP-AUD-05**: Discogs OAuth tokens encrypted via Supabase Vault (no plaintext fallback in `discogs_tokens`) <!-- Phase 33.1: Vault remediation + silent-fallback fix landed in 033.1-01 -->
- [x] **DEP-AUD-06**: Outstanding CSP issue from 2026-03-28 security audit confirmed resolved or documented as accepted risk <!-- PASS in Phase 33 (audit drift fix 2026-04-24, Phase 33.1) -->
- [x] **DEP-AUD-07**: Git history scanned — no historical secret commits (service_role, Stripe, handoff)
- [x] **DEP-AUD-08**: Environment variable inventory complete — every var in `.env.local.example` has a planned prod value <!-- PASS in Phase 33 (audit drift fix 2026-04-24, Phase 33.1) -->

### Supabase Production Setup

Separate `digswap-prod` Supabase project with all migrations, RLS, Edge Functions, cron jobs, Vault secrets, and backups.

- [ ] **DEP-SB-01**: Separate `digswap-prod` Supabase project created (never shares with dev)
- [ ] **DEP-SB-02**: All migrations applied via `supabase db push` (never `drizzle-kit push` against prod)
- [ ] **DEP-SB-03**: RLS verified — Security Advisor green, zero unprotected tables, zero policies referencing missing columns
- [ ] **DEP-SB-04**: Edge Functions deployed (`cleanup-trade-previews`, `validate-preview`)
- [ ] **DEP-SB-05**: pg_cron jobs active (`SELECT COUNT(*) FROM cron.job WHERE active` returns 3+)
- [ ] **DEP-SB-06**: Supabase Vault populated with secrets required by pg_cron (`trade_preview_project_url`, `trade_preview_publishable_key`)
- [ ] **DEP-SB-07**: `trade-previews` storage bucket created (CORS configured, 48h TTL, Public = off)
- [ ] **DEP-SB-08**: Supabase Pro active (disables the 7-day free-tier auto-pause on live domain)
- [ ] **DEP-SB-09**: PITR (Point-in-Time Recovery) enabled and backup restore rehearsed once on throwaway project
- [ ] **DEP-SB-10**: `DATABASE_URL` uses PgBouncer transaction pooler on port 6543 with `prepare: false`

### Vercel + Environment Wiring

Vercel project with every env var scoped explicitly to Production (never "All Environments"), first build passing on a preview URL before DNS cutover.

- [ ] **DEP-VCL-01**: Vercel project created and linked to GitHub repo (Root Directory = `apps/web`)
- [ ] **DEP-VCL-02**: All 21 production env vars set with **Production scope only** (not All Environments)
- [ ] **DEP-VCL-03**: Preview env vars separately scoped to dev Supabase + Stripe test mode (preview deploys never touch prod)
- [ ] **DEP-VCL-04**: Post-build grep of `.next/static/` finds zero hits for `service_role`, `STRIPE_SECRET`, `HANDOFF_HMAC`, `IMPORT_WORKER_SECRET`, `DATABASE_URL`
- [ ] **DEP-VCL-05**: Only 7 env vars carry `NEXT_PUBLIC_` prefix (no service role or Stripe secret leaked into client bundle)
- [ ] **DEP-VCL-06**: `HANDOFF_HMAC_SECRET` and `IMPORT_WORKER_SECRET` regenerated for prod via `openssl rand -hex 32`
- [ ] **DEP-VCL-07**: Vercel Pro active before first paying user (60s function timeout, rollback to any deploy)
- [ ] **DEP-VCL-08**: Node.js runtime pinned to 20 in Vercel project settings (matches CI)
- [ ] **DEP-VCL-09**: HSTS reduced to `max-age=300` during launch window, bump to 2-year only after 1-week soak
- [ ] **DEP-VCL-10**: First build green on `*.vercel.app` preview URL before DNS cutover

### DNS + SSL

Hostinger DNS pointing at Vercel, Let's Encrypt cert issued, CAA records audited. Point of no return — after DNS resolves, every issue is a live incident.

- [ ] **DEP-DNS-01**: Hostinger A record `@` → `76.76.21.21` (Vercel apex IP)
- [ ] **DEP-DNS-02**: Hostinger CNAME `www` → `cname.vercel-dns.com`
- [ ] **DEP-DNS-03**: SSL cert issued by Let's Encrypt, verified via `openssl s_client -connect [domain]:443`
- [ ] **DEP-DNS-04**: DNS propagation confirmed from 2+ independent networks (dig @1.1.1.1 and @8.8.8.8)
- [ ] **DEP-DNS-05**: CAA records audited — if any exist, must include `letsencrypt.org`
- [ ] **DEP-DNS-06**: TTLs set to 300s during cutover week (quick revert possible)
- [ ] **DEP-DNS-07**: MX records preserved (Hostinger remains registrar; email routing unaffected)

### External Integrations

Stripe Live, Discogs prod app, Google/GitHub OAuth, Resend domain — all wired after domain is live.

- [ ] **DEP-INT-01**: Stripe Live mode activated — **initiated on Day 1** of milestone (1-3 business day SLA)
- [ ] **DEP-INT-02**: Live webhook endpoint registered at `https://[domain]/api/stripe/webhook` with dedicated `whsec_live_*` signing secret (distinct from test)
- [ ] **DEP-INT-03**: Live Price IDs in `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` and `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL` (no `price_test_*`)
- [ ] **DEP-INT-04**: Discogs prod app registered with `https://[domain]/api/discogs/callback` as sole callback (separate from dev app)
- [ ] **DEP-INT-05**: Supabase Auth redirect URL allow-list updated with `https://[domain]/**`
- [ ] **DEP-INT-06**: Google OAuth client + GitHub OAuth app configured with prod Supabase callback URI
- [ ] **DEP-INT-07**: Resend sending domain verified at Hostinger (DKIM, SPF, DMARC records propagated)
- [ ] **DEP-INT-08**: Supabase Auth SMTP configured to send transactional email via Resend

### Smoke Tests + Human UAT

Final verification gate before public access. Automated smoke catches what CI cannot; human UAT catches what automation cannot.

- [ ] **DEP-UAT-01**: Playwright smoke suite passing against production URL (not just localhost)
- [ ] **DEP-UAT-02**: `/api/health` endpoint returns 200 — probes DB + Redis + Discogs connectivity
- [ ] **DEP-UAT-03**: Cold-start test — 15 min idle then curl returns 200 in < 3s for all public routes
- [ ] **DEP-UAT-04**: Stripe webhook round-trip verified with real $1 charge, subscription row written, then refunded
- [ ] **DEP-UAT-05**: OAuth round-trip tested per provider (Discogs, Google, GitHub)
- [ ] **DEP-UAT-06**: Email deliverability verified to Gmail, Outlook, iCloud, ProtonMail (inbox, not spam)
- [ ] **DEP-UAT-07**: Human UAT signed off — full flow: signup → email verify → Discogs connect → trade proposal → Stripe checkout
- [ ] **DEP-UAT-08**: CSP zero violations in DevTools Console across all routes including Stripe Checkout and Google OAuth
- [ ] **DEP-UAT-09**: Preview deploys confirmed pointing at dev Supabase, never prod
- [ ] **DEP-UAT-10**: `RUNBOOK.md` committed — top 10 failure modes with symptoms and fix steps
- [ ] **DEP-UAT-11**: Vercel Instant Rollback rehearsed once end-to-end (CLI or dashboard)
- [ ] **DEP-UAT-12**: Sentry verified ingesting events (trigger test error, confirm issue in dashboard)

### Monitoring Setup

Runs in parallel with Vercel/DNS/Integrations phases. Must be complete before UAT.

- [ ] **DEP-MON-01**: Sentry prod DSN + auth token configured in Vercel
- [ ] **DEP-MON-02**: Sentry `beforeSend` filter suppresses CSP noise and strips PII (email, tokens)
- [ ] **DEP-MON-03**: UptimeRobot pinging `/api/health` every 5 minutes with email alert
- [ ] **DEP-MON-04**: Stripe webhook failure email alerts configured in Stripe dashboard
- [ ] **DEP-MON-05**: Vercel Analytics + Speed Insights components added to `app/layout.tsx`
- [ ] **DEP-MON-06**: Sentry spike protection enabled (prevents quota blow-out from error storm)

## Future Requirements (Deferred to v1.5+)

### Desktop App Launch

- **DESKTOP-LAUNCH-01**: Code signing certificates purchased (Windows EV + Apple Developer)
- **DESKTOP-LAUNCH-02**: electron-updater auto-update infrastructure wired
- **DESKTOP-LAUNCH-03**: VPS (Hostinger) provisioned with PeerJS signaling server
- **DESKTOP-LAUNCH-04**: coturn TURN relay on VPS for NAT traversal
- **DESKTOP-LAUNCH-05**: Build pipeline produces `.exe`, `.dmg`, `.AppImage` with signed installers
- **DESKTOP-LAUNCH-06**: Download page + distribution channel

### Post-Launch Infrastructure

- **POST-01**: Supabase persistent staging branch
- **POST-02**: Vercel preview deploys with isolated Supabase branches per PR
- **POST-03**: Public status page (status.[domain])
- **POST-04**: Log drains to Axiom (long-term log retention)
- **POST-05**: Synthetic journey tests running against prod on a cron
- **POST-06**: Rolling releases / canary traffic split

## Out of Scope

Explicitly excluded from v1.4. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Desktop app production launch | Requires code signing certs (cost $400-700/yr), VPS for PeerJS/coturn, auto-update infra — separate v1.5 milestone |
| Self-hosted Supabase | Multiplies operational load for solo dev; Supabase Cloud Pro ($25/mo) is the solo-friendly path |
| Cloudflare in front of Vercel | Vercel already provides CDN, SSL, DDoS protection; double-proxy creates cache and SSL handshake issues |
| Big-bang migration + code deploy | Must use expand-migrate-contract; single-commit schema+code is highest-risk anti-pattern |
| `drizzle-kit push` against production | Only `supabase db push` writes to prod; `supabase/migrations/` is the authoritative trail |
| Preview deploys against prod DB | All preview env vars must point at dev Supabase — writes to prod from preview are unacceptable |
| Public launch before UAT sign-off | Minimum 1-week soak with invite-only users before announcing |
| Log drains / Axiom / Datadog | Vercel + Sentry logs sufficient for first month; add when signal gets noisy |

## Traceability

Empty initially. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DEP-AUD-01 | Phase 33 | Complete |
| DEP-AUD-02 | Phase 33 | Complete |
| DEP-AUD-03 | Phase 33 | Complete |
| DEP-AUD-04 | Phase 33 | Complete |
| DEP-AUD-05 | Phase 33 | Complete |
| DEP-AUD-06 | Phase 33 | Complete |
| DEP-AUD-07 | Phase 33 | Complete |
| DEP-AUD-08 | Phase 33 | Complete |
| DEP-SB-01 | Phase 34 | Pending |
| DEP-SB-02 | Phase 34 | Pending |
| DEP-SB-03 | Phase 34 | Pending |
| DEP-SB-04 | Phase 34 | Pending |
| DEP-SB-05 | Phase 34 | Pending |
| DEP-SB-06 | Phase 34 | Pending |
| DEP-SB-07 | Phase 34 | Pending |
| DEP-SB-08 | Phase 34 | Pending |
| DEP-SB-09 | Phase 34 | Pending |
| DEP-SB-10 | Phase 34 | Pending |
| DEP-VCL-01 | Phase 35 | Pending |
| DEP-VCL-02 | Phase 35 | Pending |
| DEP-VCL-03 | Phase 35 | Pending |
| DEP-VCL-04 | Phase 35 | Pending |
| DEP-VCL-05 | Phase 35 | Pending |
| DEP-VCL-06 | Phase 35 | Pending |
| DEP-VCL-07 | Phase 35 | Pending |
| DEP-VCL-08 | Phase 35 | Pending |
| DEP-VCL-09 | Phase 35 | Pending |
| DEP-VCL-10 | Phase 35 | Pending |
| DEP-DNS-01 | Phase 36 | Pending |
| DEP-DNS-02 | Phase 36 | Pending |
| DEP-DNS-03 | Phase 36 | Pending |
| DEP-DNS-04 | Phase 36 | Pending |
| DEP-DNS-05 | Phase 36 | Pending |
| DEP-DNS-06 | Phase 36 | Pending |
| DEP-DNS-07 | Phase 36 | Pending |
| DEP-INT-01 | Phase 37 | Pending |
| DEP-INT-02 | Phase 37 | Pending |
| DEP-INT-03 | Phase 37 | Pending |
| DEP-INT-04 | Phase 37 | Pending |
| DEP-INT-05 | Phase 37 | Pending |
| DEP-INT-06 | Phase 37 | Pending |
| DEP-INT-07 | Phase 37 | Pending |
| DEP-INT-08 | Phase 37 | Pending |
| DEP-UAT-01 | Phase 38 | Pending |
| DEP-UAT-02 | Phase 38 | Pending |
| DEP-UAT-03 | Phase 38 | Pending |
| DEP-UAT-04 | Phase 38 | Pending |
| DEP-UAT-05 | Phase 38 | Pending |
| DEP-UAT-06 | Phase 38 | Pending |
| DEP-UAT-07 | Phase 38 | Pending |
| DEP-UAT-08 | Phase 38 | Pending |
| DEP-UAT-09 | Phase 38 | Pending |
| DEP-UAT-10 | Phase 38 | Pending |
| DEP-UAT-11 | Phase 38 | Pending |
| DEP-UAT-12 | Phase 38 | Pending |
| DEP-MON-01 | Phase 39 | Pending |
| DEP-MON-02 | Phase 39 | Pending |
| DEP-MON-03 | Phase 39 | Pending |
| DEP-MON-04 | Phase 39 | Pending |
| DEP-MON-05 | Phase 39 | Pending |
| DEP-MON-06 | Phase 39 | Pending |

**Coverage:**
- v1.4 requirements: 61 total
- Mapped to phases: 61 (Phase 33-39)
- Unmapped: 0 — 100% coverage verified 2026-04-20

**Phase distribution:**
- Phase 33 (Pre-Deploy Audit Gate): 8 requirements (DEP-AUD-01 → DEP-AUD-08)
- Phase 34 (Supabase Production Setup): 10 requirements (DEP-SB-01 → DEP-SB-10)
- Phase 35 (Vercel + Environment Wiring): 10 requirements (DEP-VCL-01 → DEP-VCL-10)
- Phase 36 (DNS + SSL Cutover): 7 requirements (DEP-DNS-01 → DEP-DNS-07)
- Phase 37 (External Integrations): 8 requirements (DEP-INT-01 → DEP-INT-08)
- Phase 38 (Smoke Tests + Human UAT): 12 requirements (DEP-UAT-01 → DEP-UAT-12)
- Phase 39 (Monitoring + Observability Setup): 6 requirements (DEP-MON-01 → DEP-MON-06)

---
*Requirements defined: 2026-04-20*
*Last updated: 2026-04-20 after gsd-roadmapper mapped all 61 requirements to phases 33-39*
