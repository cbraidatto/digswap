# DigSwap Production RUNBOOK

> **Purpose:** Single source of truth for incident response, smoke checks, rollback procedures, and post-deploy validation. Phase 38 deliverable.
>
> **Audience:** Solo dev (you) + sócio. Read this before pushing to main.
> **Last updated:** 2026-05-02

---

## 0. Production stack

| Layer | Provider | Identifier |
|-------|----------|------------|
| Hosting | Vercel | project `digswap-web` (`prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY`), team `team_WuQK7GkPndJ2xH9YKvZTMtB3` |
| Domain | Hostinger DNS | `digswap.com.br` (apex A → 76.76.21.21, www CNAME → cname.vercel-dns.com.) |
| Cert | Let's Encrypt R12 | Auto-renewed by Vercel; 90d validity |
| Database | Supabase | project `swyfhpgerzvvmoswkjyt` (us-east-1, Free tier); pooler `aws-1-us-east-1.pooler.supabase.com:6543` |
| Auth | Supabase Auth (gotrue) | Email + password active; Google/GitHub OAuth deferred to Phase 37 Wave 1 |
| Storage | Supabase Storage | Bucket `trade-previews` (private, 10 audio MIME types) |
| Edge functions | Supabase | `cleanup-trade-previews` (hourly cron), `validate-preview` |
| Email | Resend | DEFERRED (Phase 37 Wave 3 — currently Supabase default sender) |
| Payments | Stripe | DEFERRED (you put on hold; Wave 4) |
| Discogs | OAuth 1.0a | Currently using **dev app credentials** as interim workaround |
| Observability | Sentry + Vercel | DSN missing (Phase 39 user-action); Analytics + Speed Insights live |

---

## 1. Smoke tests (run after every prod deploy)

### 1.1 Health probe (30 seconds)

```bash
curl -fsS https://digswap.com.br/api/health
# Expected: {"status":"healthy","checks":{"database":"ok"},"timestamp":"..."}
```

### 1.2 Cert verify

```bash
openssl s_client -connect digswap.com.br:443 -servername digswap.com.br </dev/null 2>&1 \
  | grep -E "issuer=|verify return code"
# Expected: issuer=Let's Encrypt, verify return code: 0 (ok)
```

### 1.3 DNS propagation (3 resolvers)

```powershell
foreach ($r in @('1.1.1.1','8.8.8.8','9.9.9.9')) {
  Resolve-DnsName -Name digswap.com.br -Type A -Server $r -DnsOnly | Format-List Name,IPAddress,TTL
}
# Expected: all 3 return 76.76.21.21
```

### 1.4 www redirect

```bash
curl -sI https://www.digswap.com.br/ | head -3
# Expected: HTTP/1.1 308 Permanent Redirect, Location: https://digswap.com.br/
```

### 1.5 Playwright anon suite

```bash
PLAYWRIGHT_BASE_URL=https://digswap.com.br pnpm --filter @digswap/web test:e2e
# Expected baseline (post-Phase-36 + locator fixes): 20 PASS + 19 SKIP + 1 FAIL
# The 1 FAIL is session-revocation.audit.spec.ts (needs AUDIT_USER provisioned).
```

---

## 2. Rollback procedures

### 2.1 Bad code deploy (fastest — Vercel rollback)

```bash
# Find a known-good deployment ID (state=READY) older than current
vercel ls digswap-web --token "$(cat ~/.vercel-token)"

# Promote that deployment as the current production alias
vercel alias set <good-deployment-url> digswap.com.br --token "$(cat ~/.vercel-token)"
```

Time to revert: <30 seconds. No DNS impact.

### 2.2 Bad env var change

```bash
# Verify current state
vercel env ls production --token "$(cat ~/.vercel-token)" | grep <VAR_NAME>

# Replace value (sensitive)
vercel env rm <VAR_NAME> production --yes --token "$(cat ~/.vercel-token)"
printf '%s' '<old-value>' | vercel env add <VAR_NAME> production --sensitive --token "$(cat ~/.vercel-token)"

# Trigger redeploy
git commit --allow-empty -m "chore(env): revert <VAR_NAME>" && git push origin main
```

Time to revert: ~2 min (build + deploy).

### 2.3 Bad DB migration

```bash
# Supabase MCP path (if available)
# Use mcp__supabase__execute_sql to run the inverse DDL

# Direct path (no MCP)
# Connect via DATABASE_URL pooler with read-write user, run inverse DDL.
# Always idempotent — use ALTER TABLE ... DROP COLUMN IF EXISTS, etc.
```

### 2.4 DNS catastrophe (only if cutover broke)

```bash
# Pre-cutover snapshot (from 2026-04-27 cutover):
#   apex A: 2.57.91.91 (Hostinger parking)
#   www CNAME: digswap.com.br.
# TTL during cutover week: 300s = ~5min revert window.

# Hostinger snapshot restore via MCP:
# mcp__hostinger__DNS_restoreDNSSnapshotV1 with the snapshot ID captured pre-flip.

# Or manually via Hostinger API:
HOSTINGER_TOKEN=$(cat ~/.hostinger-token)
curl -X POST "https://developers.hostinger.com/api/dns/v1/snapshots/digswap.com.br/<snapshot-id>/restore" \
  -H "Authorization: Bearer $HOSTINGER_TOKEN"
```

---

## 3. Post-deploy validation checklist

After every push to main, before announcing changes:

- [ ] Vercel deployment shows state=READY
- [ ] `curl /api/health` returns 200 + `database:ok`
- [ ] Browser console clean on /signin, /feed, /perfil (no new errors)
- [ ] Playwright suite still 20 PASS (no new failures vs baseline)
- [ ] Vercel runtime logs show no new errors in last 5 min
- [ ] Supabase Postgres logs show no new ERROR severity (via MCP `get_logs --service postgres`)

---

## 4. Phase 38 UAT prep — AUDIT_USER provisioning

The session-revocation Playwright test (`session-revocation.audit.spec.ts`) requires
a dedicated audit user account. Provisioning steps:

### 4.1 Create the user (via Supabase MCP)

```sql
DO $$
DECLARE
  audit_id UUID := gen_random_uuid();
  audit_email TEXT := 'audit@digswap.com.br';  -- use real address you can read
  audit_password TEXT := '<strong-password>';  -- min 12 chars, mix
BEGIN
  -- Same pattern as sócio creation (2026-04-28):
  -- - bcrypt cost 10 password
  -- - empty-string token columns (avoid gotrue NULL Scan)
  -- - identity row with provider=email
  -- - profile row created via trigger fallback
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    phone_change, phone_change_token, email_change_token_current, reauthentication_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    audit_id,
    'authenticated', 'authenticated',
    audit_email,
    crypt(audit_password, gen_salt('bf', 10)),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"role":"audit"}'::jsonb,
    NOW(), NOW(),
    false, false,
    '', '', '', '', '', '', '', ''
  );

  INSERT INTO auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), audit_id::text, audit_id,
    jsonb_build_object('sub', audit_id::text, 'email', audit_email, 'email_verified', true),
    'email', NOW(), NOW(), NOW()
  );

  INSERT INTO public.profiles (id, username, display_name, onboarding_completed)
  VALUES (audit_id, 'audit', 'Audit', true)
  ON CONFLICT (id) DO NOTHING;
END $$;
```

### 4.2 Add env vars

```bash
printf '%s' 'audit@digswap.com.br' | vercel env add AUDIT_USER_EMAIL preview --token "$(cat ~/.vercel-token)"
printf '%s' '<strong-password>' | vercel env add AUDIT_USER_PASSWORD preview --sensitive --token "$(cat ~/.vercel-token)"
```

### 4.3 Run the audit suite

```bash
PLAYWRIGHT_BASE_URL=https://digswap.com.br \
AUDIT_USER_EMAIL=audit@digswap.com.br \
AUDIT_USER_PASSWORD='<strong-password>' \
  pnpm --filter @digswap/web exec playwright test session-revocation.audit
# Expected: PASS — JWT rejected within 60s of session deletion.
```

---

## 5. Known issues / interim workarounds

| Issue | Workaround | Long-term fix |
|-------|-----------|---------------|
| Upstash Redis not provisioned | Rate limiter detects DEFERRED placeholder + fail-open (`apps/web/src/lib/rate-limit.ts`) | Provision Upstash, replace env vars (Phase 39 nice-to-have) |
| Discogs prod app not created | Reusing dev app's consumer_key/secret in Production scope | Phase 37 Plan 037-02 (create dedicated prod app) |
| Google + GitHub OAuth disabled | Email + password works; UI shows toast on click | Phase 37 Wave 1 (configure providers in Supabase Auth + Google Cloud) |
| Stripe Live not activated | Feature flag `NEXT_PUBLIC_BILLING_ENABLED=false` hides /pricing CTAs | Phase 37 Wave 4 (Stripe Live submission has 1-3 BD SLA) |
| Resend domain not verified | Supabase Auth uses default sender (may go to spam) | Phase 37 Wave 3 (DKIM/SPF/DMARC via Hostinger DNS API) |
| Sentry DSN missing | Sentry init disabled in dev; production calls no-op without DSN | Phase 39 (you create Sentry project, paste DSN) |
| AUDIT_USER not provisioned | session-revocation Playwright test fails (1 of 21 tests) | §4 above |

---

## 6. Credential rotation calendar

| Credential | Status | Rotate by |
|-----------|--------|-----------|
| Vercel API token | ⚠ Leaked via screenshot 2026-04-26 | Before public announce |
| Hostinger API token | ⚠ Leaked in chat 2026-04-28 | Before public announce |
| Supabase DB password (`minhamaemandouSDK`) | ⚠ Weak (dictionary-like) | Before public announce |
| sócio password (`matheusviado`) | ⚠ Leaked in chat | After sócio first login (he changes himself in /settings) |
| dahaw password (`a1b2c3d4`) | ⚠ Leaked in chat | After first login |

After each rotation:
- Update Vercel env (if stored there)
- Update `~/.<service>-token` files locally
- Test smoke checks in §1

---

## 7. Public announce gate

**DO NOT announce DigSwap publicly until:**

- [ ] Phase 37 Wave 4 closes — Stripe Live active + webhook ping 200
- [ ] Phase 37 Wave 1 closes — Google OAuth signin working
- [ ] Phase 37 Wave 3 closes — Resend domain verified, password-reset emails arrive with DKIM=PASS
- [ ] Phase 38 UAT clean — full user flow signup → Discogs → trade preview works
- [ ] 1-week production soak with no incidents
- [ ] HSTS bumped from 300 → 31536000 (matches Phase 35 D-18 trigger)
- [ ] TTL bumped from 300 → 3600 (matches Phase 36 D-10 trigger)
- [ ] All §6 credentials rotated

Until all above are true, site is **invite-only** (you + sócio + audit user only).

---

## 8. Quick links

- Vercel dashboard: https://vercel.com/thiagobraidatto-3732s-projects/digswap-web
- Supabase dashboard: https://supabase.com/dashboard/project/swyfhpgerzvvmoswkjyt
- Production URL: https://digswap.com.br
- Health endpoint: https://digswap.com.br/api/health
- Vercel CLI auth: `~/.vercel-token`
- Hostinger DNS API: `~/.hostinger-token` + `https://developers.hostinger.com/api/dns/v1/`
- This RUNBOOK: `/RUNBOOK.md` in repo root

---

*Last incident: 2026-04-28 — sócio account login broken due to (a) rate-limiter fail-closed against placeholder Upstash + (b) gotrue Scan error on NULL token columns + (c) schema drift `holy_grail_ids` missing. All resolved same-session via hotfix commits 0d9dcad, e8cc8a5.*
