# Phase 37: External Integrations - Research

**Researched:** 2026-04-27
**Domain:** External SaaS integrations (Stripe, Google OAuth, Discogs, Resend, Supabase Auth) — wiring all to live `https://digswap.com.br` after Phase 36 cutover
**Confidence:** HIGH (Stripe + Resend + Supabase via Context7-class official docs); MEDIUM (Hostinger DNS API — re-using Phase 36 known-good pattern); LOW only on Stripe Brazil PF SLA precise hours (1-3 business day window confirmed, exact median not published)

## Summary

Phase 37 is **eight sequential UI-or-API operations** wrapped around one async waiting-room (Stripe Live activation). All five integrations have stable, well-documented surfaces. No code changes are required for the swap itself — `apps/web/src/lib/env.ts` already validates the env vars, the webhook handler at `apps/web/src/app/api/stripe/webhook/route.ts` already reads `STRIPE_WEBHOOK_SECRET` indirectly so test/live differs only by env-var value (Pitfall 6 fully mitigated by design), and the Discogs callback at `apps/web/src/app/api/discogs/callback/route.ts` already reads `NEXT_PUBLIC_SITE_URL` which is already `https://digswap.com.br` since Phase 35 D-10. The work is platform configuration plus eight env-var swaps — pure ops, not engineering.

The single non-obvious surface is **Resend's DKIM record is a CNAME pointing to `*.dkim.amazonses.com`, not a TXT record with a long public key string**. Many domain-verification guides confuse this; Phase 36's Hostinger PUT pattern works for both record types so the implementation is identical, but the planner must encode CNAME (not TXT) for the DKIM record. SPF stays a TXT record on `send.digswap.com.br`; an MX record on the same `send` subdomain handles bounce-back; DMARC is a TXT record on `_dmarc.digswap.com.br` and starts at `p=none`.

A new feature flag `NEXT_PUBLIC_BILLING_ENABLED` (default `false`) lets Wave 4 (Stripe finalization) land independently of Phase 38 UAT — if Stripe SLA delays beyond the wave window, the rest of the integrations remain shippable and `/pricing/checkout` is hidden until the flag flips to `true`. The flag must be added to both `apps/web/src/lib/env.ts` and the pricing/upgrade UI gate.

**Primary recommendation:** Execute Wave 0 (Stripe submission as `checkpoint:human-action`) on Day 1 immediately. Run Waves 1-3 (Google OAuth, Discogs prod app, Resend domain verify, Supabase Auth SMTP swap, Supabase redirect allow-list update) in parallel during the SLA wait. Wave 4 (atomic 8-env-var swap + webhook ping) executes only after Stripe approval email lands. All eight env-var swaps in Wave 4 must be a single git commit + single Vercel redeploy — never piecemeal.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Stripe Live Activation (Area 1)
- **D-01:** Existing Stripe account with `sk_test_*` already active in dev. Phase 37 activates Live mode on the **same account** (Test and Live coexist via dashboard toggle). SLA timer starts when business info is submitted.
- **D-02:** Pessoa Física (CPF) — solo dev launch path. Faster than CNPJ; Stripe BR accepts CPF. CNPJ migration is post-MVP if needed.
- **D-03:** Webhook endpoint = same path `/api/stripe/webhook` for both test and live. Test/Live distinction lives in `STRIPE_WEBHOOK_SECRET` env var (`whsec_live_*` vs `whsec_test_*`). Pitfall 6 mitigated by env-var separation, not code branching.
- **D-04:** Phase 37 closes with: (a) `sk_live_*` in Vercel Production scope, (b) Live webhook registered + `whsec_live_*` env var set, (c) Live Price IDs in `NEXT_PUBLIC_STRIPE_PRICE_*`, (d) webhook ping from Stripe dashboard returns 200 against `https://digswap.com.br/api/stripe/webhook`. **Real $1 transaction test = Phase 38 UAT scope** (not Phase 37).

#### OAuth Providers + Discogs Prod App (Area 2)
- **D-05:** OAuth providers in v1.4 = **Google only**. GitHub deferred POST-MVP. Email + senha continues working as fallback.
- **D-06:** Google OAuth client = **new prod-only client** in Google Cloud Console (separate from dev client). Pitfall 7 mitigated: localhost callback NEVER listed in prod client.
- **D-07:** Discogs prod app = **separate from dev**. Sole callback `https://digswap.com.br/api/discogs/callback`. Dev app stays untouched at localhost:3000. Avoids 60 req/min rate limit competition.
- **D-08:** Supabase Auth Site URL = `https://digswap.com.br`. Redirect URLs allow-list = `https://digswap.com.br/**` (wildcard). NO localhost in prod allow-list. Open-redirect protection via Supabase's allow-list enforcement.

#### Resend + Supabase Auth SMTP (Area 3)
- **D-09:** From email = **`noreply@digswap.com.br`**.
- **D-10:** Reply-to = **default to From** (no explicit reply-to header). Caixa de entrada = post-MVP.
- **D-11:** DKIM/SPF/DMARC = **Claude applies via Hostinger DNS API** (token from `~/.hostinger-token`, Phase 36 Wave 0). PUTs records via `PUT /api/dns/v1/zones/digswap.com.br` with `overwrite=true`.
- **D-12:** Resend Free tier (3K emails/mo). Upgrade trigger: 80% quota hit.

#### Execution Order + Parallelism (Area 4)
- **D-13:** Wave-based parallelism with Stripe SLA gate. Wave 0 = Stripe submit (checkpoint:human-action). Waves 1-3 parallel autonomous (no Stripe dep). Wave 4 = gated atomic swap.
- **D-14:** Feature flag `NEXT_PUBLIC_BILLING_ENABLED` (default false). Flips true in Wave 4.
- **D-15:** Phase 38 UAT gate = **TUDO operacional including Stripe Live**.
- **D-16:** Phase 36 carry-overs (CSP inline-style + OAuth silent-fail) → Phase 38 scope, NOT Phase 37.

#### Account Ops (Area 5)
- **D-17:** All external accounts = owner = user's personal account.

### Claude's Discretion
- Stripe webhook event subscription list (which events to listen for) — research determines what existing code needs (answered below: 4 events).
- Exact wording of CPF/business form fields in Stripe — user fills in real-time during Wave 0.
- Resend "From Name" string (e.g., "DigSwap" vs "DigSwap Notifications") — research recommends, planner picks.
- DMARC policy strictness (`p=none` vs `p=quarantine` vs `p=reject`) — research recommends `p=none` for first 30 days then escalate.
- Wave structure exact: provisionally 5 waves (0=Stripe submit, 1=OAuth, 2=Discogs+Supabase, 3=Resend, 4=Stripe finalize+test).

### Deferred Ideas (OUT OF SCOPE)

#### Phase 38 (UAT)
- Real $1 Stripe transaction (D-04 explicit)
- CSP inline-style violation in chunk `1952-*.js`
- OAuth click silent-fail UX (toast on error)
- Provision Phase 38 audit user
- Fix 5 Playwright locator strict-mode bugs
- Public announce gate

#### Phase 39 (Monitoring — parallel track)
- Sentry prod DSN + beforeSend filter
- UptimeRobot probe against `/api/health`
- Stripe failure alerts in Stripe dashboard
- Vercel Analytics + Speed Insights

#### POST-MVP (after v1.4)
- GitHub OAuth provider
- CNPJ Stripe migration
- Stripe Customer Portal (subscription management UI)
- Reply-to email caixa de entrada
- DMARC policy escalation `p=none` → `p=quarantine` → `p=reject`
- Resend Pro tier upgrade
- HSTS bump 300→31536000 + TTL bump 300→3600

#### Out of scope nesta milestone
- SMS/WhatsApp 2FA
- Discogs OAuth 2.0 migration
- Multiple email providers
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEP-INT-01 | Stripe Live mode activated — initiated on Day 1 (1-3 business day SLA) | Stripe Brazil onboarding form fields documented (§"Stripe Live Activation Walkthrough"). SLA confirmed 1-3 business days for verified individuals (Stripe support docs). Day-1 submission strategy locked in D-13. |
| DEP-INT-02 | Live webhook endpoint registered at `/api/stripe/webhook` with `whsec_live_*` signing secret | Existing handler reads `STRIPE_WEBHOOK_SECRET` via `getWebhookSecret()` (line 16-23 of route.ts) — no code change needed, secret swap-only. Webhook creation via `POST /v1/webhook_endpoints` with `enabled_events[]=checkout.session.completed,customer.subscription.updated,customer.subscription.deleted,invoice.payment_failed` (matches existing handler's switch block at lines 324-338). |
| DEP-INT-03 | Live Price IDs in `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`/`_ANNUAL` (no `price_test_*`) | Stripe Price IDs use prefix `price_*` (NOT `prod_*` which are Product IDs). Live and Test IDs share the same `price_*` prefix — distinction is not visible in the ID itself, only in dashboard mode. Validation probe: dashboard URL must read `dashboard.stripe.com/prices/...` not `dashboard.stripe.com/test/prices/...`. |
| DEP-INT-04 | Discogs prod app registered with `https://digswap.com.br/api/discogs/callback` as sole callback | Discogs developer settings UI at `https://www.discogs.com/settings/developers` → Create application. Two fields: app name + callback URL. Returns Consumer Key + Consumer Secret. Existing client at `apps/web/src/app/api/discogs/callback/route.ts` consumes both via `env.DISCOGS_CONSUMER_KEY/SECRET` — swap-only. |
| DEP-INT-05 | Supabase Auth redirect URL allow-list updated with `https://digswap.com.br/**` | Supabase Management API `PATCH /v1/projects/swyfhpgerzvvmoswkjyt/config/auth` accepts `site_url` + `uri_allow_list` (comma-separated string). Wildcard `**` supported per official docs (matches paths across slashes). |
| DEP-INT-06 | Google OAuth client + GitHub OAuth app configured with prod Supabase callback URI | D-05 narrows to Google ONLY. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application). Authorized redirect URI = `https://swyfhpgerzvvmoswkjyt.supabase.co/auth/v1/callback`. Client ID + Client Secret pasted into Supabase Dashboard → Authentication → Providers → Google (or via Management API PATCH `external_google_client_id`/`external_google_secret`). |
| DEP-INT-07 | Resend sending domain verified at Hostinger (DKIM, SPF, DMARC propagated) | `POST https://api.resend.com/domains` with `{"name":"digswap.com.br"}` returns records[]. Resend uses: SPF (TXT on `send.digswap.com.br`), DKIM (CNAME pointing to `<id>.dkim.amazonses.com`), MX (return-path on `send.digswap.com.br`). DMARC is user-applied separately at `_dmarc.digswap.com.br` with `v=DMARC1; p=none; rua=mailto:noreply@digswap.com.br`. Verification via `POST /domains/{id}/verify` then poll `GET /domains/{id}` until `status=verified`. |
| DEP-INT-08 | Supabase Auth SMTP configured to send via Resend | Supabase Auth → Settings → SMTP. Host `smtp.resend.com`, Port `465`, Username `resend`, Password = Resend API key (`re_*`), Sender Email = `noreply@digswap.com.br`, Sender Name = `DigSwap`. Default rate limit after enabling = 30 emails/hour; raise via Auth → Rate Limits page. Or use Management API `PATCH /v1/projects/{ref}/config/auth` with `smtp_*` fields. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Constraint | Source | Phase 37 implication |
|------------|--------|---------------------|
| Solo developer — favor simplicity and solo maintainability | CLAUDE.md "Constraints" | Each integration uses managed-service paths (Stripe Dashboard webhook, Supabase Dashboard provider config) over self-hosted alternatives. No custom OAuth proxy, no self-hosted SMTP. |
| GSD Workflow Enforcement — start work through GSD command | CLAUDE.md "GSD Workflow Enforcement" | Wave 0 Stripe submit must be `checkpoint:human-action` task, not silent dashboard work. |
| OWASP Top 10 coverage mandatory | CLAUDE.md "Constraints" | Open-redirect mitigation (D-08 wildcard scoped to digswap.com.br domain only — no `**` covering other origins); webhook signature verification already in place; no localhost in prod allow-list (Pitfall 7 hardening). |
| TypeScript every file | CLAUDE.md Stack | Feature flag wiring for `NEXT_PUBLIC_BILLING_ENABLED` must extend Zod schema in `apps/web/src/lib/env.ts` (publicSchema). |
| Stripe = "Industry standard for freemium/subscription billing" | CLAUDE.md Stack | Live mode is the default-and-only payment surface; no fallback provider in scope. |
| Resend = "3,000 emails/month free (100/day)" + React Email templates | CLAUDE.md Stack | Free tier confirmed sufficient for MVP. Quota monitoring deferred to Phase 39. |
| Vercel Hobby plan: 10s function timeout | CLAUDE.md Constraints | Webhook handler at `route.ts` declares `maxDuration = 60` — works on Pro but capped to 10s on Hobby. Phase 37 stays on Hobby (per Phase 35 D-03); 10s is sufficient for the four event types this handler processes since each does at most one Stripe API call + 1-2 Supabase writes. Flag for Phase 38 UAT to verify cold-start <10s under live load. |
| `apps/web/src/lib/env.ts` — Zod validation at startup | CLAUDE.md "Adding a New Env Var" rule | Adding `NEXT_PUBLIC_BILLING_ENABLED` requires schema entry + `.env.local.example` entry + Vercel Production scope value. |

## Standard Stack

### Core (already installed, no upgrade needed for Phase 37)
| Library | Installed | Latest | Purpose | Why Standard |
|---------|-----------|--------|---------|--------------|
| `stripe` (Node SDK) | 21.0.1 | 22.1.0 | Server-side Stripe operations + webhook signature verification | `apiVersion: "2024-06-20"` is pinned in `apps/web/src/lib/stripe.ts` line 20 — no upgrade required for Phase 37; SDK v21 supports all Live-mode events listed below. |
| `@supabase/ssr` | 0.9.0 | 0.10.2 | Server-side Supabase client (cookie-based auth) | Used for OAuth code exchange in `/api/auth/callback` and Discogs callback. |
| `@supabase/supabase-js` | 2.100.0 | (current) | Client SDK for `signInWithOAuth({provider:"google"})` | Already wired in `social-login-buttons.tsx`. No code change. |
| `@lionralfs/discogs-client` | 4.1.4 | 4.1.4 | Discogs OAuth 1.0a + API client | Already wired in `discogs/callback/route.ts`. Swap is consumer-key/secret only. |
| `resend` | 6.9.4 | 6.12.2 | Resend SDK for transactional email | `apps/web/src/lib/notifications/email.ts` already uses it; Phase 37 upgrade not required (6.9 → 6.12 is patch-level, no breaking changes). |

**Version verification (npm registry, 2026-04-27):**
- `npm view stripe version` → 22.1.0 (project on 21.0.1 — minor lag, no Phase 37 blocker, upgrade is post-MVP)
- `npm view resend version` → 6.12.2 (project on 6.9.4 — patch lag, no Phase 37 blocker)
- `npm view @supabase/ssr version` → 0.10.2 (project on 0.9.0 — minor lag, no Phase 37 blocker)
- `npm view @lionralfs/discogs-client version` → 4.1.4 (project current)

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vercel CLI | 52.0.0 | `vercel env rm` + `vercel env add KEY production --sensitive` for Wave 4 atomic swap | Token at `~/.vercel-token`. Pattern from Phase 35 evidence/02. |
| `curl` (system) | system | Hostinger DNS API PUT/GET, Stripe webhook creation API, Resend domain API, Supabase Management API | Phase 36 evidence shows this pattern: `Authorization: Bearer $(cat ~/.hostinger-token)`. |
| Supabase MCP `update_auth_settings` | (if available in fresh session) | Site URL + redirect allow-list update | Fallback to Dashboard or Management API curl if MCP not loaded. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff | Phase 37 verdict |
|------------|-----------|----------|------------------|
| Stripe Dashboard webhook creation | `POST /v1/webhook_endpoints` API | API gives the secret in response without "reveal" click; Dashboard creates audit-log entry visible to user | Use **Dashboard** for human-visible trail; user is the operator and benefits from seeing what they created. API-only is acceptable for autonomous Wave 4 if dashboard step blocks. |
| Resend SMTP for Supabase Auth | Resend Send Email Auth Hook (Edge Function) | SMTP = simpler, slightly higher latency, no React Email templates. Hook = lower latency, custom templates, extra moving part | Use **SMTP** per CLAUDE.md "favor managed services" + solo-dev simplicity. Custom templates deferred to post-MVP. |
| `_dmarc` TXT with `p=quarantine` | Start with `p=none` | Strict policy = better security but risks first-week deliverability if DKIM/SPF have config issues | Start `p=none` for 30-day monitoring window, escalate post-MVP per D-04 deferred list. |
| Manual Resend dashboard add | `POST /domains` API + `POST /domains/{id}/verify` API | API is automatable + Wave 3 can run autonomously without dashboard checkpoint | Use **API**. User already has API key from Wave 3. |

**Installation:** No new packages installed in Phase 37. All operations are configuration changes via existing SDKs and CLIs.

## Architecture Patterns

### Recommended Wave Structure

```
Wave 0 (Day 1, ~30min, checkpoint:human-action)
  ├── 0.1 User submits Stripe Live activation form (CPF + bank + business)
  └── 0.2 Confirmation: SLA timer started, expected approval 1-3 business days

Wave 1 (parallel, ~20min, autonomous)
  ├── 1.1 Create Google OAuth client in Google Cloud Console
  ├── 1.2 Paste Client ID + Secret into Supabase Auth (or Management API PATCH)
  └── 1.3 Verify: open https://digswap.com.br/signin → click Google (manual probe)

Wave 2 (parallel, ~15min, autonomous)
  ├── 2.1 Create Discogs prod app at /settings/developers
  ├── 2.2 Update Vercel env: DISCOGS_CONSUMER_KEY + _SECRET (production scope)
  ├── 2.3 Supabase Management API PATCH site_url + uri_allow_list
  └── 2.4 Redeploy webhook test (no full redeploy yet)

Wave 3 (parallel, ~30min + 1h propagation, autonomous)
  ├── 3.1 POST /domains to Resend → returns records[]
  ├── 3.2 PUT 4 records via Hostinger DNS API (SPF, DKIM, MX, DMARC) using Phase 36 pattern
  ├── 3.3 POST /domains/{id}/verify (triggers async Resend check)
  ├── 3.4 Poll GET /domains/{id} every 60s for up to 60min until status=verified
  ├── 3.5 Configure Supabase Auth SMTP via Management API (host/port/user/pass/from)
  └── 3.6 Update Vercel env: RESEND_API_KEY (production scope)

Wave 4 (gated on Stripe approval, ~15min, autonomous)
  ├── 4.1 Pull Live Price IDs from Stripe dashboard (price_xxx, NOT prod_xxx)
  ├── 4.2 POST /v1/webhook_endpoints with enabled_events list — captures whsec_live_*
  ├── 4.3 Atomic swap: 8 Vercel env vars in single batch
  │       (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PRICE_MONTHLY,
  │        NEXT_PUBLIC_STRIPE_PRICE_ANNUAL, NEXT_PUBLIC_BILLING_ENABLED=true)
  ├── 4.4 Single git commit + push to main → triggers single redeploy
  ├── 4.5 "Send test webhook" from Stripe dashboard → assert 200 in Vercel runtime logs
  └── 4.6 Final verify: env audit + dashboard "live mode" badge confirmation
```

### Pattern 1: Atomic Multi-Env-Var Swap (Pitfall 21)
**What:** All five Stripe env vars + the billing flag must flip together in a single deploy. Partial swap = broken state (e.g., `sk_live_*` paired with `whsec_test_*` = signature verification fails on every webhook).
**When to use:** Wave 4 of Phase 37 (and any future Stripe-key rotation).
**Example:**
```bash
# Source: Phase 35 evidence/02-env-add-loop.log + Vercel CLI docs
# Sequence: rm-then-add per var (CLI doesn't support update with new value in 52.x; rm+add is the canonical idiom)

# Step 1: Pull current values for audit baseline (sanitized; Phase 35 D-05 disclosure pattern)
vercel env ls production --token "$(cat ~/.vercel-token)" > /tmp/env-pre-swap.txt

# Step 2: Atomic batch (single shell session, halt-on-fail)
set -e
for KEY in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET NEXT_PUBLIC_STRIPE_PRICE_MONTHLY NEXT_PUBLIC_STRIPE_PRICE_ANNUAL NEXT_PUBLIC_BILLING_ENABLED; do
  vercel env rm "$KEY" production --yes --token "$(cat ~/.vercel-token)" 2>/dev/null || true
done

# Step 3: Add fresh values (sensitive flag for secrets; non-sensitive for price IDs and flag)
echo -n "$STRIPE_LIVE_SECRET_KEY"      | vercel env add STRIPE_SECRET_KEY production --sensitive --token "$(cat ~/.vercel-token)"
echo -n "$STRIPE_LIVE_WEBHOOK_SECRET"  | vercel env add STRIPE_WEBHOOK_SECRET production --sensitive --token "$(cat ~/.vercel-token)"
echo -n "$STRIPE_PRICE_MONTHLY_LIVE"   | vercel env add NEXT_PUBLIC_STRIPE_PRICE_MONTHLY production --token "$(cat ~/.vercel-token)"
echo -n "$STRIPE_PRICE_ANNUAL_LIVE"    | vercel env add NEXT_PUBLIC_STRIPE_PRICE_ANNUAL production --token "$(cat ~/.vercel-token)"
echo -n "true"                         | vercel env add NEXT_PUBLIC_BILLING_ENABLED production --token "$(cat ~/.vercel-token)"

# Step 4: Trigger redeploy via git push (Phase 35 evidence: CLI deploy unreliable from worktree, GitHub auto-deploy is canonical)
git commit --allow-empty -m "feat(037-04): activate Stripe Live + billing flag"
git push origin claude/...:main
```

### Pattern 2: Resend Domain Verification Polling
**What:** Resend's verification is async — DNS records must propagate, then Resend's checker confirms. Implementations need to poll, not assume sync.
**When to use:** Wave 3 step 3.4.
**Example:**
```bash
# Source: https://resend.com/docs/api-reference/domains/verify-domain (HIGH confidence)
DOMAIN_ID="<from POST /domains response>"
RESEND_KEY="$(cat ~/.resend-token)"

# Trigger verification check
curl -X POST "https://api.resend.com/domains/${DOMAIN_ID}/verify" \
  -H "Authorization: Bearer ${RESEND_KEY}"

# Poll up to 60min, 60s interval
for i in $(seq 1 60); do
  STATUS=$(curl -s "https://api.resend.com/domains/${DOMAIN_ID}" \
    -H "Authorization: Bearer ${RESEND_KEY}" | jq -r '.status')
  echo "[poll $i/60] status=$STATUS"
  if [ "$STATUS" = "verified" ]; then break; fi
  if [ "$STATUS" = "failure" ]; then echo "FAIL"; exit 1; fi
  sleep 60
done
```

### Pattern 3: Hostinger DNS PUT for Multi-Record Set (Phase 36 lineage)
**What:** Phase 36 established the Hostinger PUT pattern with `overwrite=true`. Phase 37 reuses for SPF/DKIM/MX/DMARC. Each record is a different (name, type) pair so no overwrite conflict with apex/www.
**When to use:** Wave 3 step 3.2.
**Example:**
```bash
# Source: Phase 36 evidence/06-flip-a-payload.json (HIGH confidence — proven path)
# Resend's records[] response provides exact name/type/value for each.

curl -X PUT "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br" \
  -H "Authorization: Bearer $(cat ~/.hostinger-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "overwrite": true,
    "zone": [
      { "name": "send", "type": "TXT", "ttl": 300,
        "records": [{"content": "v=spf1 include:amazonses.com ~all"}] },
      { "name": "<resend-dkim-id>._domainkey", "type": "CNAME", "ttl": 300,
        "records": [{"content": "<resend-dkim-id>.dkim.amazonses.com."}] },
      { "name": "send", "type": "MX", "ttl": 300,
        "records": [{"content": "feedback-smtp.us-east-1.amazonses.com", "priority": 10}] },
      { "name": "_dmarc", "type": "TXT", "ttl": 300,
        "records": [{"content": "v=DMARC1; p=none; rua=mailto:noreply@digswap.com.br"}] }
    ]
  }'
```
**Note:** The exact DKIM CNAME value comes from `POST /domains` response (Resend generates a per-domain hash). The MX hostname `feedback-smtp.us-east-1.amazonses.com` is Resend's standard return-path target for the us-east-1 region.

### Anti-Patterns to Avoid
- **Code-branching test/live in webhook handler:** Existing handler at `route.ts:16-23` correctly reads ONE secret from env — no `if (mode === 'live')` branching. Don't add it. Phase 37 maintains this design.
- **Reuse of dev OAuth client for prod:** A single OAuth client with both `localhost:3000` and `digswap.com.br/**` callbacks creates a credential-leak blast radius. D-06 mandates separate client.
- **Pasting Live secret into Preview env scope:** Vercel CLI 52.x defaults `production` scope per `--prod` flag absence — verify scope on EACH `vercel env add` invocation. Pitfall 9 (Phase 35) protection.
- **Single env-var swap then verifying:** Production state during a 5-var swap is broken if tested mid-batch. Always: rm-all → add-all → redeploy → verify. Never verify between vars.
- **DKIM as TXT record:** Common error from older guides. Resend uses CNAME for DKIM. The `name` field for DKIM in Resend's response is `<random-id>._domainkey` and the `type` is `CNAME`, not `TXT`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stripe webhook signature verification | Custom HMAC-SHA256 verifier | `stripe.webhooks.constructEvent()` (already in route.ts:304) | Stripe rotates the verification algorithm; SDK keeps pace. Custom code drifts. |
| OAuth state/CSRF token | Custom signed state cookie | Supabase's built-in `exchangeCodeForSession` (already in `/api/auth/callback`) | PKCE flow handled by SDK; mismatched implementations leak codes. |
| DNS propagation timer | Custom dig-loop with hard timeout | Resend's `POST /domains/{id}/verify` + `GET /domains/{id}` status field | Resend already runs the check; mirror their truth. |
| SMTP delivery retry | Custom queue + backoff | Supabase Auth handles retry internally; Resend has built-in retry | Two retry layers create amplification storms. |
| Discogs OAuth 1.0a HMAC signing | Custom oauth-1.0a TypeScript impl | `@lionralfs/discogs-client` (already integrated) | OAuth 1.0a signing has nine sharp edges (param sorting, RFC3986 encoding, body-hash). The library handles them. |

**Key insight:** Phase 37 is **zero new code surface** if planning is disciplined. Every operation is configuration of an existing, tested code path. The temptation to "improve" the webhook handler or "centralize" Stripe key handling during this phase must be rejected — D-04's gate is the secret swap landing cleanly, not a refactor.

## Runtime State Inventory

> Phase 37 is configuration changes, not a rename/refactor — but credential rotation has runtime-state implications. Documented for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 37 doesn't touch user data, profile rows, subscription rows, or Discogs OAuth tokens. Existing `subscriptions` table contains zero `stripe_customer_id` rows in production today (no live customer has paid yet). | None. |
| Live service config | (1) Stripe Live mode — once activated, the customer-facing dashboard mode toggle persists. (2) Google OAuth client client_id — registered with Google, only invalidated on explicit deletion. (3) Discogs prod app — registered with Discogs, persists. (4) Resend domain — persists once verified. (5) Supabase Auth Site URL/redirect allow-list — DB-backed config in Supabase project. | Document each registration in `037-SUMMARY.md` with the IDs/refs (Stripe webhook ID, Google OAuth client ID, Discogs app ID, Resend domain ID) for future rotation/revocation needs. |
| OS-registered state | None — Phase 37 doesn't register OS services. | None. |
| Secrets/env vars | 8 env vars to swap in Vercel Production scope: `STRIPE_SECRET_KEY` (DEFERRED → `sk_live_*`), `STRIPE_WEBHOOK_SECRET` (DEFERRED → `whsec_live_*`), `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` (DEFERRED → `price_*`), `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL` (DEFERRED → `price_*`), `DISCOGS_CONSUMER_KEY` (DEFERRED → real), `DISCOGS_CONSUMER_SECRET` (DEFERRED → real), `RESEND_API_KEY` (DEFERRED → `re_*`), plus 1 NEW: `NEXT_PUBLIC_BILLING_ENABLED` (`false` → `true` in Wave 4). Preview scope keeps DEFERRED (per Phase 35 D-13 — Preview never uses Stripe Live). | Add `NEXT_PUBLIC_BILLING_ENABLED` to `apps/web/src/lib/env.ts` publicSchema with `z.string().optional().default("false")`; add to `.env.local.example`; add to Vercel Preview scope (value="false") and Production scope (value="false" Wave 0, "true" Wave 4). |
| Build artifacts / installed packages | None — no version upgrades in Phase 37. | None. |

## Common Pitfalls

### Pitfall P6: Stripe webhook signing secret test/live confusion
**What goes wrong:** Webhook arrives with `whsec_live_*` signature; handler verifies against `whsec_test_*` from old env value (or vice versa). All webhooks 400. Subscription rows never created. Premium users stay on free tier.
**Why it happens:** Operator copies test secret into prod env mistaking it for live, or forgets to swap during cutover.
**How to avoid:**
- Phase 37 keeps the existing handler at `route.ts:16-23` UNCHANGED — it reads ONE secret. Test/live distinction lives in env-var value only (D-03).
- Wave 4 swap is atomic: `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` flip in the same batch. Never partial.
- Verification probe: Stripe dashboard "Send test webhook" button → expect 200 in Vercel runtime logs (Wave 4 step 4.5).
**Warning signs:** Vercel runtime logs show `[stripe.webhook] signature verification failed` repeatedly. If seen post-swap → secret mismatch, immediate revert via `vercel env rm STRIPE_WEBHOOK_SECRET production && vercel env add ... <correct value>`.

### Pitfall P7: OAuth redirect URIs not registered for prod = login 100% broken
**What goes wrong:** Google OAuth client only has `http://localhost:3000` callbacks. User clicks Google on prod signin → Google rejects with `redirect_uri_mismatch`. All Google sign-ins fail. Email+password works as fallback but new-user social signup is dead.
**Why it happens:** Operator reuses dev OAuth client thinking "more URIs = more flexibility." Or forgets to add the Supabase callback URL.
**How to avoid:**
- D-06 mandates a NEW prod-only Google OAuth client. Dev client untouched.
- Prod client's "Authorized redirect URIs" field MUST contain EXACTLY: `https://swyfhpgerzvvmoswkjyt.supabase.co/auth/v1/callback` (Supabase project ref is locked from Phase 34).
- Prod client's "Authorized JavaScript origins" MUST contain EXACTLY: `https://digswap.com.br` (no trailing slash, no path — Google rejects either).
- Verification probe: Wave 1 step 1.3 — open `https://digswap.com.br/signin` in Incognito, click "Continue with Google", complete consent, expect redirect to `/onboarding` or `/feed` (or whatever post-auth target). If lands on signin?error=auth_callback_failed → exchange failed → check supabase Auth → Provider settings.
**Warning signs:** Browser-console error `redirect_uri_mismatch` from Google = wrong URI in Google Cloud Console. Supabase logs `unable_to_exchange_external_code` = correct URI but secret mismatch in Supabase Provider settings.

### Pitfall P15: Resend deliverability — DKIM/SPF/DMARC mandatory before first email
**What goes wrong:** First Supabase Auth email goes out before DNS records propagate. Gmail/Outlook flag it as spam (DMARC fail; no DKIM signature). Sender reputation craters in the first hour. Subsequent valid emails inherit the spam reputation.
**Why it happens:** Operator turns on SMTP swap (Wave 3 step 3.5) before Resend status reaches `verified`. Or the DMARC record is missed because Resend doesn't list it as "required" — Resend only requires SPF + DKIM but production deliverability requires DMARC for Gmail/Yahoo (per their Feb 2024 enforcement).
**How to avoid:**
- Sequence: Wave 3 PUTs all 4 records (SPF + DKIM + MX + DMARC) FIRST. Then `POST /domains/{id}/verify`. Then poll until `status=verified`. Only THEN does step 3.5 enable Supabase Auth SMTP.
- Hostinger DNS TTL stays at 300 from Phase 36 — propagation should complete in ~5min for new records.
- Verification probe (Wave 3 step 3.4 success criterion): `GET /domains/{id}` returns `status=verified` for the parent + all four records show `status=verified` in the records[] array.
- Independent probe: `dig +short TXT send.digswap.com.br @1.1.1.1` returns the SPF string. `dig +short CNAME <dkim-id>._domainkey.digswap.com.br @1.1.1.1` returns the amazonses CNAME. `dig +short MX send.digswap.com.br` returns the SMTP feedback host. `dig +short TXT _dmarc.digswap.com.br` returns the DMARC string.
**Warning signs:** Resend dashboard shows `failed` status after >60min poll = a record didn't propagate or has wrong content. Inspect each record-status field in the GET response — Resend tells you which one failed.

### Pitfall P21: Stripe test/live keys + price IDs must flip together (5+1 atomic)
**What goes wrong:** `STRIPE_SECRET_KEY` flipped to live but `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` still references test Price ID → API error `No such price: price_test_xxx` on the first checkout attempt. Customer sees a generic error, abandons.
**Why it happens:** Operator updates one env var at a time, ships between, doesn't realize prices are mode-scoped (test prices invisible from live API).
**How to avoid:**
- Wave 4 step 4.3 enforces all 5 vars in a single batch (the Pattern 1 example above).
- Step 4.4 commits + pushes ONCE → single redeploy. No mid-state.
- Pre-condition gate: Wave 4 only runs after Stripe Live approval email. If user starts the wave early, the dashboard won't show Live Price IDs (they need to be created in live mode after activation), the wave halts at step 4.1 with a clear error.
- Verification: Vercel env audit (Phase 35 evidence/03 methodology — key-presence + sensitive flag count). Open `/pricing` page in browser, inspect network response for the Stripe checkout request — its `priceId` should match the `price_*` shown in Live Stripe Dashboard.
**Warning signs:** Stripe dashboard "Logs" view shows `400 Bad Request: No such price` on `POST /v1/checkout/sessions` = mode mismatch. Live key + test price = always this error.

### Pitfall P-NEW-1: Stripe SLA delay blocks Phase 38 milestone
**What goes wrong:** Stripe Brazil approval takes longer than 3 business days (e.g., requests document re-upload). Phase 37 Wave 4 cannot complete. Phase 38 UAT cannot start (D-15 gates UAT on Stripe Live operational).
**Why it happens:** Brazil's CPF verification can require additional documents (RG photo, proof of address). Stripe support response has variable SLA.
**How to avoid:**
- D-13 puts Stripe submission as Wave 0 Day 1 — maximum SLA buffer.
- Document Wave 0 sub-task: user attaches all expected documents proactively (CPF, RG front, proof of residence ≤90 days old, bank account proof) to avoid back-and-forth.
- D-14 feature flag `NEXT_PUBLIC_BILLING_ENABLED` decouples Wave 4 from Waves 1-3 — if Stripe delays, Waves 1-3 still ship, billing UI is hidden, the rest of UAT can begin (D-15 partial allowance).
**Warning signs:** Stripe dashboard activation page stuck at "Information needed" >24h after Day-1 submission = check email for Stripe support request.

### Pitfall P-NEW-2: Vercel Preview env vars accidentally hold prod Stripe Live values
**What goes wrong:** Operator types `vercel env add` without `--scope production` flag → CLI prompts for environment, defaults to ALL or selects Preview. Live secret leaks into preview deploys, which run against dev Supabase. Test data may get charged real money.
**Why it happens:** Vercel CLI 52.x prompts for environment scope; user can fat-finger.
**How to avoid:**
- Always pass `production` as the second positional argument, NEVER omit. The exact command shape is `vercel env add KEY production --sensitive --token "$(cat ~/.vercel-token)"`.
- After Wave 4 swap, run `vercel env ls preview --token ...` and grep for any value starting with `sk_live_` — must return zero hits.
- Phase 35 D-13 already locked Preview to dev Supabase + test/dummy Stripe values. Wave 4 must NOT touch Preview scope.
**Warning signs:** Stripe Dashboard "Logs" shows API calls from preview-deploy URLs = preview leaked Live key. Immediately rotate `STRIPE_SECRET_KEY` (Stripe Dashboard → API keys → Roll), update Production scope, leave Preview as test/dummy.

### Pitfall P-NEW-3: Supabase Auth SMTP rate limit choke (30/hr default)
**What goes wrong:** After enabling custom SMTP, Supabase Auth defaults to **30 emails/hour** rate limit. First-day signup spike (e.g., 50 users in an hour during invite blast) hits the cap; latecomers don't get verification emails. They retry-resend, hit the cap harder. Cascade.
**Why it happens:** Default Supabase rate limit is conservative for shared-IP reputation protection. Has to be raised manually.
**How to avoid:**
- Wave 3 step 3.5 includes raising the rate limit at Supabase Dashboard → Authentication → Rate Limits → "Auth emails per hour" to at least 100 (Resend's 100/day free quota is the binding upper limit).
- Or via Management API PATCH with `rate_limit_email_sent: 100`.
- Verification probe: Trigger 5 signup events in quick succession via Playwright; all 5 should receive verification emails within 60s. (Manual UAT in Phase 38 covers full deliverability.)
**Warning signs:** Supabase Auth logs show `email rate limit exceeded` errors = raise the cap.

## Code Examples

### Example: Stripe webhook endpoint creation (Wave 4 step 4.2)
```bash
# Source: https://docs.stripe.com/api/webhook_endpoints/create (HIGH confidence)
# Reads existing handler events from apps/web/src/app/api/stripe/webhook/route.ts:324-338

curl https://api.stripe.com/v1/webhook_endpoints \
  -u "${STRIPE_LIVE_SECRET_KEY}:" \
  -d "url=https://digswap.com.br/api/stripe/webhook" \
  -d "description=DigSwap production webhook (Phase 37)" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=invoice.payment_failed" \
  -d "api_version=2024-06-20"

# Response captures the signing secret in `secret` field — `whsec_*`
# Pipe directly to Vercel env: 
#   curl ... | jq -r '.secret' | vercel env add STRIPE_WEBHOOK_SECRET production --sensitive --token ...
```

### Example: Resend domain creation (Wave 3 step 3.1)
```bash
# Source: https://resend.com/docs/api-reference/domains/create-domain (HIGH confidence)

curl -X POST 'https://api.resend.com/domains' \
  -H "Authorization: Bearer ${RESEND_API_KEY}" \
  -H 'Content-Type: application/json' \
  -d '{ "name": "digswap.com.br", "region": "us-east-1" }'

# Response shape:
# {
#   "id": "<uuid>",
#   "name": "digswap.com.br",
#   "status": "not_started",
#   "records": [
#     { "record": "SPF",  "name": "send", "type": "TXT", "value": "\"v=spf1 include:amazonses.com ~all\"" },
#     { "record": "DKIM", "name": "<id>._domainkey", "type": "CNAME", "value": "<id>.dkim.amazonses.com." },
#     { "record": "MX",   "name": "send", "type": "MX", "priority": 10, "value": "feedback-smtp.us-east-1.amazonses.com" }
#   ]
# }
# Note: Resend does NOT include DMARC in the records[] array — operator adds it independently.
```

### Example: Supabase Management API auth config update (Wave 2 step 2.3 + Wave 3 step 3.5)
```bash
# Source: https://supabase.com/docs/reference/api/v1-update-a-projects-auth-config (HIGH confidence)

curl -X PATCH "https://api.supabase.com/v1/projects/swyfhpgerzvvmoswkjyt/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "site_url": "https://digswap.com.br",
    "uri_allow_list": "https://digswap.com.br/**",
    "external_google_enabled": true,
    "external_google_client_id": "<from Google Cloud>",
    "external_google_secret": "<from Google Cloud>",
    "smtp_host": "smtp.resend.com",
    "smtp_port": "465",
    "smtp_user": "resend",
    "smtp_pass": "${RESEND_API_KEY}",
    "smtp_admin_email": "noreply@digswap.com.br",
    "smtp_sender_name": "DigSwap",
    "smtp_max_frequency": 60,
    "rate_limit_email_sent": 100
  }'
```

### Example: Webhook ping verification (Wave 4 step 4.5)
```bash
# Source: Stripe Dashboard → Workbench → Webhooks → Endpoint detail → "Send test webhook"
# UI-driven; no API equivalent for the dashboard "test" button per official docs.
# Operator clicks button, selects event type (e.g., checkout.session.completed),
# Stripe fires a synthetic payload at the production URL.

# Concurrent: tail Vercel runtime logs via MCP
# expected: HTTP 200 response, no signature verification error in logs.
# Phase 37 closes when this passes.
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vercel CLI | All env-var swaps (Waves 1, 2, 3, 4) | ✓ | 52.0.0 (Phase 35) | — |
| Vercel API token | CLI auth | ✓ | `~/.vercel-token` (Phase 35) | — |
| Hostinger DNS API token | Wave 3 DNS PUTs | ✓ | `~/.hostinger-token` (48 bytes ASCII, Phase 36) | — |
| Hostinger MCP | Optional API wrapper | maybe | requires fresh Claude Code session reload (Phase 36 §"Out-of-band notes") | curl pattern from Phase 36 evidence/06 |
| Stripe SDK Node | Webhook handler | ✓ | 21.0.1 (already installed) | — |
| Stripe API access | Webhook creation API + Live mode | gated | requires Stripe Live activation (Wave 0) | — until Stripe approves |
| Resend account | Wave 3 domain verify + SMTP | ✓ | user has account (per CLAUDE.md stack) | — |
| Resend API key | Wave 3 step 3.1 + 3.6 | needs creation | created via Resend dashboard, NOT yet provisioned | step 3.0: create key in Resend dashboard with `domains.send` + `domains.full_access` permissions, scoped to digswap.com.br domain |
| Google Cloud project | Wave 1 OAuth client | needs creation/access | user has Google account; project may not exist | step 1.0: create new project "DigSwap Prod" if not exists; enable "Google+ API" (deprecated but harmless) — only OAuth2 needed |
| Discogs developer account | Wave 2 prod app | ✓ | user has dev app per Phase 3 deliverable | — |
| Supabase access token | Management API (Waves 2, 3 SMTP, Wave 1 OAuth provider) | needs creation | not in Phase 35/36 evidence | step 0: create personal access token at Supabase Dashboard → Account → Access Tokens; store at `~/.supabase-token` (mirroring Phase 35 token-on-disk pattern) |
| `dig` (CLI) | DNS verification probes | ✗ on Windows git-bash | — | Phase 36 used `nslookup` (Windows native) + Google HTTP DNS resolver `https://dns.google/resolve?name=...&type=...` |
| `jq` (CLI) | JSON parsing | ✓ | (assumed; Phase 36 used) | grep/sed fallback |

**Missing dependencies with no fallback:**
- None blocking — all paths have a fallback or known-good pattern from Phase 35/36.

**Missing dependencies with fallback:**
- **Resend API key:** Must be created at start of Wave 3 before any API call. Plan Wave 3 step 3.0 = "Create Resend API key in dashboard, scope to digswap.com.br with sending+management perms, save to `~/.resend-token`."
- **Supabase personal access token:** Must be created at start of Wave 1 (or Wave 2 — earliest Management API need). Plan a Wave 0 step 0.5 (parallel to Stripe submission) = "Create Supabase access token, save to `~/.supabase-token`." Allows MCP fallback if MCP doesn't load.
- **`dig` on Windows:** Use `nslookup` for A/CNAME/MX/TXT and Google HTTP DNS for SOA/CAA — proven in Phase 36.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 1.x (unit) + Playwright 1.x (e2e); package.json scripts: `test:unit`, `test:e2e:smoke` |
| Config file | `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| Quick run command | `pnpm --filter web test:unit -- tests/unit/api/stripe-webhook.test.ts` |
| Full suite command | `pnpm --filter web test:unit && pnpm --filter web test:e2e:smoke` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DEP-INT-01 | Stripe Live activated (env contains `sk_live_`) | env-audit | `vercel env ls production --token ... \| grep STRIPE_SECRET_KEY \| grep -v DEFERRED` | manual probe (no test file — env state) |
| DEP-INT-02 | Webhook endpoint reachable + signature verification works | smoke | `curl -X POST https://digswap.com.br/api/stripe/webhook` (expect 400 — no sig) + Stripe dashboard "Send test webhook" → 200 in Vercel logs | partial — `tests/unit/api/stripe-webhook.test.ts` exists but only covers the signature-OK path |
| DEP-INT-03 | Live Price IDs in env (no DEFERRED markers) | env-audit | `vercel env ls production --token ... \| grep STRIPE_PRICE \| grep -v DEFERRED` | manual probe |
| DEP-INT-04 | Discogs prod app reachable; OAuth flow succeeds | manual UAT (deferred to Phase 38) — Phase 37 only verifies env-var swap | `vercel env ls production --token ... \| grep DISCOGS \| grep -v DEFERRED` for env audit; manual click-through deferred | env-audit only in Phase 37 |
| DEP-INT-05 | Supabase Auth allow-list accepts digswap.com.br/** | API probe | `curl https://api.supabase.com/v1/projects/swyfhpgerzvvmoswkjyt/config/auth -H 'Authorization: Bearer ...' \| jq '.uri_allow_list'` | new evidence file `evidence/05-allow-list.txt` |
| DEP-INT-06 | Google OAuth signin completes from prod | manual UAT (Phase 38 owns) | (Wave 1 manual probe: open /signin in Incognito, click Google, expect /onboarding) | manual checkpoint |
| DEP-INT-07 | Resend domain status=verified | API probe | `curl https://api.resend.com/domains/${ID} -H 'Authorization: Bearer ...' \| jq '.status'` | new evidence file `evidence/07-resend-verified.json` |
| DEP-INT-08 | Supabase Auth SMTP routes via Resend | manual probe | trigger password-reset email; check email arrives FROM noreply@digswap.com.br with DKIM passing in Gmail "Show original" header | manual probe (Phase 38 has full deliverability matrix) |

### Sampling Rate
- **Per task commit (Waves 1-3):** No automated test runs — Phase 37 is config, not code. Manual probes per task as documented.
- **Per wave merge:** `pnpm --filter web typecheck` + `pnpm --filter web build` — verifies env-var changes don't break build (e.g., new `NEXT_PUBLIC_BILLING_ENABLED` Zod schema entry valid).
- **Phase gate:** All 8 DEP-INT-* checks pass via env-audit + API probes documented in `evidence/`. Webhook ping (Wave 4 step 4.5) returns 200. Manual Google OAuth click-through (Wave 1 step 1.3) lands on /onboarding.

### Wave 0 Gaps
- [ ] `evidence/` directory creation in `037/` for plan outputs
- [ ] `~/.resend-token` ASCII no-BOM (mirroring Phase 36 D-19 pattern)
- [ ] `~/.supabase-token` ASCII no-BOM (Supabase personal access token)
- [ ] `~/.stripe-live-token` ASCII no-BOM (created Wave 4 from Stripe dashboard, NOT before — Live keys don't exist until activation)
- [ ] No new test framework setup needed — Vitest + Playwright already in place

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Stripe webhook with custom signature verification | `stripe.webhooks.constructEvent()` SDK helper | Stripe Node SDK 8+ (long-stable) | Already in use — don't regress. |
| OAuth client per-environment with shared client_id | Separate prod-only OAuth clients per app | Industry standard since 2020 | D-06 enforces this. |
| Resend DKIM as TXT record | Resend DKIM as CNAME → amazonses | Resend's AWS SES backing always required CNAME | Many guides still show TXT — operator must use Resend's dashboard/API output, not stale guides. |
| DMARC `p=quarantine` on day 1 | DMARC `p=none` first 30 days, escalate later | Industry consensus post-Gmail/Yahoo Feb 2024 enforcement | Lower risk during launch, monitor reports, escalate when confident. |
| Stripe Dashboard manual webhook config | `POST /v1/webhook_endpoints` API | Always supported; Wave 4 uses API for automatable + capturing the secret in response | Saves a manual "reveal secret" click. |
| Custom OAuth state cookie | Supabase's PKCE-handled state | Always handled by Supabase Auth | No custom code in Phase 37. |

**Deprecated/outdated:**
- "Google+ API" — sometimes referenced in older OAuth setup guides. Not needed. OAuth2 is its own surface; "Google+" was deprecated 2019.
- `@supabase/auth-helpers-nextjs` — superseded by `@supabase/ssr` (already in project per CLAUDE.md stack).
- DKIM as standalone TXT key — Resend's flow uses CNAME exclusively for ease of key rotation by AWS SES.

## Open Questions

1. **Exact Stripe Brazil PF SLA distribution**
   - What we know: 1-3 business days per Stripe support docs.
   - What's unclear: Whether the median is 1, 2, or 3 days for first-time CPF activations in 2026 (post-Feb 2024 verification updates).
   - Recommendation: Plan for 3 business days; have D-14 feature flag ready so Phase 38 can begin partial UAT if Stripe slips.

2. **Resend Domain `region` parameter**
   - What we know: `POST /domains` accepts a `region` field (us-east-1 in default response).
   - What's unclear: Whether choosing `sa-east-1` (São Paulo region) reduces email latency for Brazilian recipients enough to matter for transactional flow (signup verify is ~1s end-to-end either way).
   - Recommendation: Use default `us-east-1`. Latency rounding error vs. SES BR region is sub-second. If Phase 39 monitoring shows slow delivery, revisit. Brazil-region path stays in deferred list.

3. **Supabase Management API access token availability**
   - What we know: Phase 35/36 didn't use it — those phases used Vercel CLI + Hostinger curl. Phase 37 introduces the Supabase Management API (auth config + SMTP).
   - What's unclear: Does the user already have a Supabase personal access token, or is this a Wave 0 prerequisite?
   - Recommendation: Plan Wave 0 sub-task `0.5` = "Create Supabase access token at https://supabase.com/dashboard/account/tokens, save to `~/.supabase-token` per Phase 36 D-19 pattern (printf %s, no newline)." Check before Waves 1/2/3 start. If MCP path becomes available in fresh session, that's a bonus — token still needed as fallback.

4. **Stripe webhook "test webhook" button — does Live mode have it?**
   - What we know: Stripe Dashboard Workbench → Webhooks → endpoint detail has a "Send test webhook" button that fires a synthetic event.
   - What's unclear: Whether the button is available in Live mode for endpoints created via API (D-04 reference). Some Stripe docs hint test events only fire in Test mode.
   - Recommendation: Use the dashboard button if available in Live; fallback = `stripe trigger` CLI command, OR an event from any test customer Stripe creates internally during activation (sometimes Stripe sends a test event on activation). If Wave 4 step 4.5 button doesn't exist, document plan to use `stripe trigger checkout.session.completed --api-key sk_live_*` (Stripe CLI; user has it from Phase 16 work).

5. **`NEXT_PUBLIC_BILLING_ENABLED` UI gate location**
   - What we know: D-14 says the flag hides /pricing/upgrade buttons + blocks /api/stripe/* routes.
   - What's unclear: Whether the flag is read once (at module load) or per-request. If per-module-load, Wave 4 redeploy is sufficient. If per-request, no redeploy needed but more code surface to gate.
   - Recommendation: Read once at module load (matches existing `publicEnv` pattern in `apps/web/src/lib/env.ts`). Wave 4 redeploy is the cutover. Plan tasks: (a) add Zod entry, (b) gate `/pricing` page render, (c) gate `/api/stripe/checkout` route to return 503 when false.

## Sources

### Primary (HIGH confidence)
- Stripe Webhook Endpoints API: https://docs.stripe.com/api/webhook_endpoints/create — POST /v1/webhook_endpoints, returns `secret` in response
- Stripe Webhook Quickstart: https://docs.stripe.com/webhooks/quickstart — endpoint registration flow
- Stripe Webhook Signature Verification: https://docs.stripe.com/webhooks/signatures — `stripe.webhooks.constructEvent()` semantics (already in route.ts:304)
- Stripe Brazil Account Setup: https://support.stripe.com/questions/brazil-specific-information-to-open-a-stripe-account — CPF + bank account requirements
- Stripe Brazil Bank Accounts: https://support.stripe.com/questions/supported-bank-accounts-in-brazil — agency + account format
- Stripe 2025 Brazil Verification Updates: https://support.stripe.com/questions/2025-updates-to-brazil-verification-requirements — current activation requirements
- Resend Create Domain API: https://resend.com/docs/api-reference/domains/create-domain — POST /domains response shape with records[]
- Resend Verify Domain API: https://resend.com/docs/api-reference/domains/verify-domain — POST /domains/{id}/verify
- Resend Domain Get API: https://resend.com/docs/api-reference/domains/get-domain — GET /domains/{id} status field
- Resend Supabase SMTP integration: https://resend.com/docs/send-with-supabase-smtp — exact SMTP credentials (host=smtp.resend.com port=465 user=resend pass=API_KEY)
- Resend Domains Introduction: https://resend.com/docs/dashboard/domains/introduction — DNS records overview
- Supabase Auth SMTP: https://supabase.com/docs/guides/auth/auth-smtp — required fields + 30/hr default rate limit
- Supabase Redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls — wildcard `**` matches across slashes
- Supabase Login with Google: https://supabase.com/docs/guides/auth/social-login/auth-google — Google Cloud Console flow + Management API PATCH `external_google_*`
- Supabase Management API: https://supabase.com/docs/reference/api/introduction — bearer-token auth model
- Discogs Developer Settings: https://www.discogs.com/settings/developers — app creation flow
- Discogs API Auth: https://www.discogs.com/developers/#page:authentication — OAuth 1.0a callback contract
- Vercel CLI env: https://vercel.com/docs/cli/env — `vercel env add KEY scope --sensitive` (--sensitive defaults true for secrets)
- Vercel Manage Env Vars: https://vercel.com/docs/environment-variables/manage-across-environments — scope semantics

### Secondary (MEDIUM confidence — verified against official source)
- Resend SPF/DKIM/DMARC guide: https://dmarc.wiki/resend — confirmed DNS record patterns match Resend's official records[] response shape
- Stripe Webhook Subscription Events guide: https://docs.stripe.com/billing/subscriptions/webhooks — confirms `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed` are canonical for subscription lifecycle (matches existing webhook handler switch)
- Stripe Webhook 2026 Step-by-Step: https://www.priceos.com/blog/find-verify-stripe-webhook-secret-2025 — confirms `whsec_*` prefix + dashboard reveal flow

### Tertiary (LOW confidence — flagged for runtime validation)
- Stripe Brazil PF activation median time: no official median published; community reports 1-3 business days variance — Phase 38 will measure actual.
- Resend custom return-path subdomain: docs reference `send` as default, customizable — defaulted to `send` in plan; not blocked.

### Internal references (HIGH confidence — known-good Phase 35/36 patterns)
- Phase 35 evidence/02-env-add-loop.log — Vercel CLI env-add command shape with `--sensitive` flag
- Phase 35 D-13 — Preview-scope isolation (Pitfall 9 protection)
- Phase 36 evidence/00-token-handling.md — Hostinger token-on-disk pattern (D-19 printf %s no-BOM)
- Phase 36 evidence/06-flip-a-payload.json — Hostinger PUT payload shape with `overwrite=true`
- Phase 36 §"Out-of-band notes" — Hostinger MCP requires session reload; curl is canonical
- `apps/web/src/lib/env.ts` — Zod schema with min(10) on STRIPE_SECRET_KEY/WEBHOOK_SECRET in production (forces Wave 4 to swap, can't deploy with empty)
- `apps/web/src/app/api/stripe/webhook/route.ts:16-23,304` — `getWebhookSecret()` reads ONE env var; `stripe.webhooks.constructEvent` does signature verify; ZERO code changes needed for test→live flip
- `apps/web/src/app/api/discogs/callback/route.ts:97-106` — Discogs client reads `env.DISCOGS_CONSUMER_KEY/SECRET`; ZERO code changes needed for dev→prod app flip
- `apps/web/src/lib/notifications/email.ts:26-28` — Resend client reads `env.RESEND_API_KEY` and `env.RESEND_FROM_EMAIL`; ZERO code changes
- `apps/web/src/components/auth/social-login-buttons.tsx:38-40` — `supabase.auth.signInWithOAuth({provider:"google"})`; client-side only, no env-var coupling

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all five SDKs already installed and in use (Stripe, Resend, Supabase, Discogs); zero new packages; version verified against npm registry.
- Architecture (5-wave + atomic swap): HIGH — Phase 35/36 patterns proven in production cutover; Wave 4 atomic-swap rationale explicit (Pitfall 21).
- Pitfalls (P6, P7, P15, P21 + 3 new): HIGH — P6/P21 mitigated by existing code design (single-secret read, no branching); P7 mitigated by D-06 prod-only client + manual probe; P15 mitigated by Resend's verify-then-poll API + DMARC pre-applied.
- Per-integration walkthroughs: HIGH for Stripe, Resend, Supabase, Vercel CLI; MEDIUM for Discogs (UI-driven, no API for app creation; verified by existing Phase 3 code path consuming the credentials).
- Validation Architecture: HIGH — phase requirements map directly to env-audit + API probes already used in Phase 35/36 evidence pattern.

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days for stable APIs); Stripe Brazil verification rules can change with regulatory updates — re-verify if execution slips beyond.

---
*Phase: 037-external-integrations*
*Research: 2026-04-27*
*Mode: hybrid (Context7-class doc fetches via WebSearch+WebFetch + internal Phase 35/36 evidence + code-grep for existing handlers)*
