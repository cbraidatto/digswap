---
phase: 37
slug: external-integrations
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Phase 37 is config + env-var swaps (zero new code) — validation = env audits + API probes + 1 manual UAT click.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 1.x (unit) + Playwright 1.x (e2e) — already in place from earlier phases |
| **Config file** | `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts` |
| **Quick run command** | `pnpm --filter @digswap/web typecheck && pnpm --filter @digswap/web build` (env-var Zod schema validation) |
| **Full suite command** | `PLAYWRIGHT_BASE_URL=https://digswap.com.br pnpm --filter @digswap/web test:e2e` |
| **Estimated runtime** | ~30s typecheck/build, ~25s Playwright anon suite |

---

## Sampling Rate

- **After Wave 0 (token + Zod schema entry):** `pnpm --filter @digswap/web typecheck` passes — confirms `NEXT_PUBLIC_BILLING_ENABLED` Zod entry doesn't break build
- **After each Wave 1/2/3 (config/swap):** env-audit + targeted API probe per requirement (see map below)
- **After Wave 4 (Stripe atomic swap):** `vercel inspect` for new prod deploy, webhook ping returns 200, full Playwright suite still 16 PASS / 19 SKIP / 5 test-debt (matches Phase 35/36 baseline)
- **Phase gate:** All 8 DEP-INT-* show PASS in `evidence/14-verify-final.txt` aggregator

---

## Per-Requirement Verification Map

| Req ID | Wave | Verification | Automated? | Evidence File |
|--------|------|--------------|------------|---------------|
| DEP-INT-01 | 4 | `vercel env ls production \| grep STRIPE_SECRET_KEY` shows `sk_live_*` (no DEFERRED) | env audit (manual run) | `evidence/04a-stripe-env-audit.txt` |
| DEP-INT-02 | 4 | Stripe dashboard "Send test webhook" button → 200 in Vercel runtime logs (or `stripe trigger` CLI fallback) | manual UAT | `evidence/04b-webhook-ping.txt` |
| DEP-INT-03 | 4 | `vercel env ls production \| grep STRIPE_PRICE` shows `price_*` (no DEFERRED, both monthly + annual) | env audit | `evidence/04a-stripe-env-audit.txt` |
| DEP-INT-04 | 2 | `vercel env ls production \| grep DISCOGS` shows real key/secret (no DEFERRED); deferred OAuth click-through to Phase 38 UAT | env audit | `evidence/02-discogs-env-audit.txt` |
| DEP-INT-05 | 1 | `curl https://api.supabase.com/v1/projects/swyfhpgerzvvmoswkjyt/config/auth -H 'Authorization: Bearer $SUPABASE_TOKEN' \| jq '.uri_allow_list'` includes `https://digswap.com.br/**` | API probe | `evidence/01-allow-list.json` |
| DEP-INT-06 | 1 | Manual: Open `https://digswap.com.br/signin` in Incognito, click "Sign in with Google", complete OAuth flow, expect redirect to `/onboarding` (or `/feed` if already onboarded) | manual checkpoint | `evidence/01b-google-signin-test.md` |
| DEP-INT-07 | 3 | `curl https://api.resend.com/domains/${DOMAIN_ID} -H 'Authorization: Bearer $RESEND_KEY' \| jq '.status'` returns `"verified"` | API probe (poll until verified) | `evidence/03-resend-verified.json` |
| DEP-INT-08 | 3 | Trigger password-reset email via Supabase Auth from `https://digswap.com.br/forgot-password`; check inbox: From=`noreply@digswap.com.br`, DKIM=PASS in Gmail "Show original" headers | manual UAT | `evidence/03b-smtp-deliverability.md` |

---

## Wave 0 Prerequisites Gate

Wave 0 must complete before any Waves 1-4 can start:

- [ ] `evidence/` directory created in `037-external-integrations/`
- [ ] `~/.resend-token` ASCII no-BOM (created by user from resend.com dashboard)
- [ ] `~/.supabase-token` ASCII no-BOM (Supabase personal access token from https://supabase.com/dashboard/account/tokens)
- [ ] `apps/web/src/lib/env.ts` has new `NEXT_PUBLIC_BILLING_ENABLED` Zod entry (boolean, default false) + typecheck passes
- [ ] `NEXT_PUBLIC_BILLING_ENABLED=false` added to Vercel Production scope
- [ ] User submitted Stripe Live activation form (CPF + bank + business activity) — SLA timer starts
- [ ] **NOT** required for Wave 0 close: `~/.stripe-live-token` (Live API keys don't exist until Stripe approval — Wave 4 prerequisite)

---

## Sampling Cadence

- **Per task commit:** No automated test runs (Phase 37 is config, not code). Manual probe per task documented in plan body.
- **Per wave merge:** `pnpm --filter @digswap/web typecheck` + `build` (validates Zod schema integrity).
- **Phase gate:** All 8 DEP-INT-NN PASS via env-audit + API probes. Webhook ping (Wave 4 step 4.5) returns 200. Manual Google OAuth click-through (Wave 1 step 1.3) lands on `/onboarding`.

---

## Nyquist Compliance Note

Phase 37 has reduced automated test coverage by design — most validation is **post-mutation API probes** (env vars, Supabase config, Resend status, webhook ping). This is acceptable because:

1. The integrations themselves are external SaaS — we don't unit-test Stripe/Resend/Supabase backends
2. Existing handler code (Stripe webhook, Discogs callback, OAuth) was Nyquist-compliant in their original phases (3, 16, 30)
3. Phase 37 is config + env swaps, not new logic

Full automated UAT moves to Phase 38 (which has dedicated Playwright + manual UAT gates for the entire user flow).

`nyquist_compliant: false` in frontmatter is intentional and acknowledged.

---

*Phase: 037-external-integrations*
*Validation strategy: 2026-04-27*
