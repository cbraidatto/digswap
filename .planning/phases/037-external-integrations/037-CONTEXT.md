# Phase 37: External Integrations - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire all external services to the live `https://digswap.com.br` URL: activate Stripe Live mode (CPF/Pessoa Física, same account as test mode), configure Google OAuth client (separate from dev) + Discogs prod app + Supabase Auth redirect allow-list, verify Resend sending domain via DKIM/SPF/DMARC PUTs to Hostinger DNS API, swap Supabase Auth SMTP from default to Resend. Stripe activation is async (1-3 business day SLA) — kicked off Day 1 while OAuth/Resend/Discogs run in parallel. Feature flag `NEXT_PUBLIC_BILLING_ENABLED` hides /pricing/checkout if Stripe SLA delays beyond expected window.

**Não inclui:**
- GitHub OAuth (deferred POST-MVP per D-05 — only Google enabled in v1.4 launch)
- Real $1 Stripe transaction test (deferred to Phase 38 UAT per D-04)
- Phase 36 carry-overs (CSP inline-style violation + OAuth silent-fail UX) — Phase 38 owns per D-16
- Sentry / monitoring env vars (Phase 39 owns, parallel track)
- HSTS bump 300→31536000 + TTL bump 300→3600 (Phase 38 + 1-week soak per Phase 35 D-18 + Phase 36 D-10)

</domain>

<decisions>
## Implementation Decisions

### Stripe Live Activation (Area 1)
- **D-01:** Existing Stripe account with `sk_test_*` already active in dev. Phase 37 activates Live mode on the **same account** (Test and Live coexist via dashboard toggle). SLA timer starts when business info is submitted.
- **D-02:** Pessoa Física (CPF) — solo dev launch path. Faster than CNPJ; Stripe BR accepts CPF. CNPJ migration is post-MVP if needed.
- **D-03:** Webhook endpoint = same path `/api/stripe/webhook` for both test and live. Test/Live distinction lives in `STRIPE_WEBHOOK_SECRET` env var (`whsec_live_*` vs `whsec_test_*`). Pitfall 6 mitigated by env-var separation, not code branching.
- **D-04:** Phase 37 closes with: (a) `sk_live_*` in Vercel Production scope, (b) Live webhook registered + `whsec_live_*` env var set, (c) Live Price IDs in `NEXT_PUBLIC_STRIPE_PRICE_*`, (d) webhook ping from Stripe dashboard returns 200 against `https://digswap.com.br/api/stripe/webhook`. **Real $1 transaction test = Phase 38 UAT scope** (not Phase 37).

### OAuth Providers + Discogs Prod App (Area 2)
- **D-05:** OAuth providers in v1.4 = **Google only**. GitHub deferred POST-MVP. Email + senha continues working as fallback.
- **D-06:** Google OAuth client = **new prod-only client** in Google Cloud Console (separate from dev client). Pitfall 7 mitigated: localhost callback NEVER listed in prod client.
- **D-07:** Discogs prod app = **separate from dev**. Sole callback `https://digswap.com.br/api/discogs/callback`. Dev app stays untouched at localhost:3000. Avoids 60 req/min rate limit competition.
- **D-08:** Supabase Auth Site URL = `https://digswap.com.br`. Redirect URLs allow-list = `https://digswap.com.br/**` (wildcard). NO localhost in prod allow-list. Open-redirect protection via Supabase's allow-list enforcement.

### Resend + Supabase Auth SMTP (Area 3)
- **D-09:** From email = **`noreply@digswap.com.br`** (transactional standard; Phase 35 D-21 already set this placeholder).
- **D-10:** Reply-to = **default to From** (no explicit reply-to header). Responses bounce into void. Caixa de entrada = post-MVP.
- **D-11:** DKIM/SPF/DMARC = **Claude applies via Hostinger DNS API** (token from `~/.hostinger-token`, Phase 36 Wave 0). PUTs three TXT records, ttl=300. Resend dashboard validates within ~1h.
- **D-12:** Resend Free tier (3K emails/mo = ~100/day). Sufficient for MVP signup + password-reset + wantlist-match notifications. Upgrade trigger: 80% quota hit.

### Execution Order + Parallelism (Area 4)
- **D-13:** Wave-based parallelism with Stripe SLA gate:
  - **Wave 0 (Day 1, ~30min):** Plan-phase produces user-facing instructions for Stripe Live submission. User submits CPF + bank account + business info. SLA timer starts.
  - **Waves 1-3 (parallel, no Stripe dependency):** OAuth Google config + Discogs prod app + Resend domain verification + Supabase Auth SMTP swap.
  - **Wave 4 (gated on Stripe approval — typically 1-3 days):** swap `DEFERRED_PHASE_37_*` placeholders for real `sk_live_*` / `whsec_live_*` / `price_live_*`; webhook ping verification; redeploy.
- **D-14:** Feature flag `NEXT_PUBLIC_BILLING_ENABLED` (default false in env) hides /pricing/upgrade buttons + blocks `/api/stripe/*` routes when Stripe Live not yet active. Flips to true in Wave 4. Allows Phase 38 UAT to start without Stripe approval (UAT can test signup + Discogs + community without billing flow). HOWEVER per D-15 the FULL Phase 38 UAT does require Stripe operational.
- **D-15:** Phase 38 UAT gate = **TUDO operacional including Stripe Live**. UAT covers full flow (signup → Discogs import → upgrade Pro → cancel). If Stripe SLA delays > 3 business days, milestone slips proportionally.
- **D-16:** Phase 36 carry-overs (CSP inline-style violation in `1952-*.js` + OAuth click silent-fail UX) → **Phase 38 UAT scope, NOT Phase 37**. Phase 37 is integrations, not app debugging.

### Account Ops (Area 5 — bonus)
- **D-17:** All external accounts (Stripe, Google Cloud, GitHub OAuth Apps if added later, Resend, Discogs prod) = **owner = user's personal account**. Single source of truth. Sócio gets credentials shared via 1Password / similar; rotation if sócio departs is straightforward (single owner ⇒ single rotation cycle).

### Pitfalls aplicáveis (LOCKED de fases anteriores + ROADMAP)
- **P6** (Stripe webhook signing secret test/live confusion): mitigated by D-03 (env-var separation, single endpoint path)
- **P7** (OAuth redirect URIs not registered for prod = login 100% broken): mitigated by D-06 + D-08 (separate prod client + correct Site URL + allow-list)
- **P15** (Resend deliverability — DKIM/SPF/DMARC mandatory before first email): D-11 applies all 3 records via Hostinger API; first email send waits for Resend "Verified" status
- **P21** (Stripe test/live keys + 4 price IDs must flip together): mitigated by D-13 Wave 4 atomic swap (single commit replacing all 5 env vars + redeploy)

### Claude's Discretion
- Stripe webhook event subscription list (which events to listen for: `checkout.session.completed`, `customer.subscription.updated`, etc) — research determines what existing code needs
- Exact wording of CPF/business form fields in Stripe (Brazil-specific) — user fills in real-time during Wave 0
- Resend "From Name" string (e.g., "DigSwap" vs "DigSwap Notifications") — research recommends, planner picks
- DMARC policy strictness (`p=none` vs `p=quarantine` vs `p=reject`) — research recommends `p=none` for first 30 days then escalate
- Wave structure exact: provisionally 5 waves (0=Stripe submit, 1=OAuth, 2=Discogs+Supabase, 3=Resend, 4=Stripe finalize+test)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ROADMAP + REQUIREMENTS
- `.planning/ROADMAP.md` §"Phase 37: External Integrations" (line 654) — goal, success criteria, P0 pitfalls
- `.planning/REQUIREMENTS.md` lines 70-77 — DEP-INT-01 to DEP-INT-08 acceptance bullets

### Phase 35 outputs (LOCKED dependencies)
- `.planning/phases/035-vercel-environment-wiring/035-SUMMARY.md` — Vercel env var inventory + DEFERRED_PHASE_37 placeholders
- `.planning/phases/035-vercel-environment-wiring/035-CONTEXT.md` D-21 — DEFERRED marker convention (`DEFERRED_PHASE_37_*` and `DEFERRED_POST_MVP`)

### Phase 36 outputs (LOCKED dependencies)
- `.planning/phases/036-dns-ssl-cutover/036-SUMMARY.md` — production URL, Hostinger token availability, MCP installed
- `.planning/phases/036-dns-ssl-cutover/evidence/00-token-handling.md` — Hostinger DNS API token handling pattern (Phase 37 reuses for Resend DNS records)

### Project memory (Brazilian launch + freemium model)
- `C:\Users\INTEL\.claude\projects\C--Users-INTEL-Desktop-Get-Shit-DOne\memory\project_mvp_launch_strategy.md` — MVP v1.4 free-tier launch strategy
- `C:\Users\INTEL\.claude\projects\C--Users-INTEL-Desktop-Get-Shit-DOne\memory\project_product_decisions.md` — freemium model, monetization gates

### CLAUDE.md project guidelines
- `CLAUDE.md` (root) — solo developer constraints, simplicity-first, GSD workflow enforcement

### App code referenced
- `apps/web/src/lib/env.ts` — Zod validation schema for env vars (STRIPE_*, DISCOGS_*, RESEND_*, etc.)
- `apps/web/src/app/api/stripe/webhook/route.ts` (presumed — research confirms) — webhook handler
- `apps/web/src/app/api/discogs/callback/route.ts` (presumed) — Discogs OAuth callback
- `apps/web/src/lib/supabase/` — Supabase client config

### External docs (research-time)
- Stripe Brazil onboarding: https://stripe.com/br/connect/onboarding-options
- Stripe webhook signing: https://docs.stripe.com/webhooks/signatures
- Google OAuth 2.0 setup: https://developers.google.com/identity/protocols/oauth2
- Supabase Auth SSR + OAuth: https://supabase.com/docs/guides/auth/server-side
- Resend domain verification: https://resend.com/docs/dashboard/domains/introduction
- Discogs OAuth 1.0a: https://www.discogs.com/developers/#page:authentication

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`apps/web/src/lib/env.ts`** Zod schema: env validation already enforces `STRIPE_SECRET_KEY` min(10) when production, `DISCOGS_CONSUMER_KEY/SECRET` hard min(1), `RESEND_API_KEY` optional. Phase 37 swaps DEFERRED placeholders for real values; Zod re-validates on next deploy.
- **`apps/web/src/app/api/stripe/webhook/route.ts`** (Phase 30 deliverable, presumed): handler reads `STRIPE_WEBHOOK_SECRET` from env, calls `stripe.webhooks.constructEvent` for signature verification. Same code path serves test and live; only the secret value differs. Pitfall 6 mitigated by design.
- **`apps/web/src/app/api/discogs/callback/route.ts`** (Phase 3 deliverable): OAuth 1.0a callback handler. Already configured for `NEXT_PUBLIC_APP_URL=https://digswap.com.br` (Phase 35 D-10). Phase 37 swap is just the consumer key/secret in env.
- **Hostinger DNS API token + MCP** (Phase 36 Wave 0): `~/.hostinger-token` ASCII no-BOM. Phase 37 reuses for Resend DKIM/SPF/DMARC PUTs.
- **Vercel CLI 52.0.0 + `~/.vercel-token`** (Phase 35): swap secrets via `vercel env rm KEY production && vercel env add KEY production --sensitive`.

### Established Patterns
- **DEFERRED_PHASE_37 marker convention** (Phase 35 D-21): grep + replace pattern for atomic swap. Wave 4 reads all DEFERRED_PHASE_37_* values, swaps in single commit, redeploys.
- **Hostinger PUT idempotency** (Phase 36 Wave 2): `overwrite=true` in body replaces matching (name,type) records. Phase 37 Resend DNS records add NEW (name,type) pairs (no conflict with existing apex/www).
- **Wave-based parallel execution + checkpoint:human-action** (Phase 35/36 pattern): Stripe submission is checkpoint:human-action; OAuth/Resend/Discogs run autonomous in parallel waves.

### Integration Points
- **Vercel env vars (Production scope)**: 5 Stripe + 2 Discogs + 1 Resend = 8 env vars to update from DEFERRED to real. NEXT_PUBLIC_* count stays at 7 (Sentry deferred to Phase 39 still).
- **Hostinger DNS zone**: 3 new TXT records for Resend (DKIM, SPF, DMARC). No conflict with apex A or www CNAME (different name/type pairs).
- **Supabase Auth dashboard** (no code change): Site URL + Redirect URLs configured via Supabase MCP `update_auth_settings` if available, or Dashboard checkpoint:human-action.
- **Google Cloud Console** (no API for OAuth client creation): always checkpoint:human-action.

</code_context>

<specifics>
## Specific Ideas

- **Wave 0 deliverable**: Plan-phase produces a "Stripe activation form filling guide" — exact fields user must fill in Stripe BR onboarding (CPF, full name as on RG, bank account: bank name + agency + account + type, declared business activity = "Software / Tecnologia"). User submits → SLA timer starts.
- **Resend domain verification reflow**: after Hostinger PUT for DKIM/SPF/DMARC, plan polls Resend API every 60s for 5min to confirm "Verified" status. If still pending after 1h, escalate to checkpoint:human-action.
- **Webhook ping verification**: Stripe dashboard has "Send test webhook" button; Phase 37 Wave 4 invokes it from Stripe + watches Vercel runtime logs via MCP for 200 response.
- **OAuth click test (post-Wave 1)**: user manually opens `https://digswap.com.br/signin`, clicks Google, completes OAuth flow → lands on /onboarding (or /feed). Confirmation = Phase 37 Wave 1 PASS.
- **Feature flag implementation**: `NEXT_PUBLIC_BILLING_ENABLED` env var, default `false`. App code reads it; if false, /pricing buttons hidden + /api/stripe/* routes return 503. Wave 4 sets to `true` in Vercel Production scope after Stripe Live confirmed.
- **Snapshot pre-Wave-4**: capture pre-swap Vercel env state (sanitized — keys only) as evidence baseline. Diff before/after shows exactly which vars flipped.

</specifics>

<deferred>
## Deferred Ideas

### Para Phase 38 (UAT)
- Real $1 Stripe transaction (D-04 explicit)
- Investigate CSP inline-style violation in chunk `1952-*.js` (D-16 carry-over)
- OAuth click silent-fail UX (toast on error) (D-16 carry-over)
- Provision audit user for `session-revocation.audit.spec.ts` (Phase 35 carry-over)
- Fix 5 Playwright locator strict-mode bugs (Phase 35 carry-over)
- Public announce gate (D-15: Phase 38 UAT clean = trigger)

### Para Phase 39 (Monitoring — parallel track)
- Sentry prod DSN + beforeSend filter
- UptimeRobot probe against `https://digswap.com.br/api/health`
- Stripe failure alerts in Stripe dashboard
- Vercel Analytics + Speed Insights

### Para POST-MVP (after v1.4 launch)
- GitHub OAuth provider (D-05 deferred)
- CNPJ Stripe migration (D-02 path)
- Stripe Customer Portal integration (subscription management UI)
- Reply-to email caixa de entrada (D-10 deferred)
- DMARC policy escalation `p=none` → `p=quarantine` → `p=reject` (after 30+ days clean)
- Resend Pro tier upgrade (when 80% of 3K/mo quota hit)
- HSTS bump 300→31536000 + TTL bump 300→3600 (Phase 38 + 1w soak trigger)

### Out of scope nesta milestone
- SMS/WhatsApp 2FA
- Discogs OAuth 2.0 migration (when/if Discogs stops supporting OAuth 1.0a)
- Multiple email providers / fallback delivery

</deferred>

---

*Phase: 037-external-integrations*
*Context gathered: 2026-04-27*
