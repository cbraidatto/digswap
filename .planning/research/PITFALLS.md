# Pitfalls Research — First Production Deploy (Vercel + Supabase Cloud)

**Domain:** First prod deploy of a Next.js 15 App Router + Supabase + Stripe app by a solo dev
**Researched:** 2026-04-20
**Confidence:** HIGH (stack-specific, grounded in current codebase + Apr 2026 official docs)
**Scope:** DigSwap v1.4 — moving from dev-only to first live prod on Vercel + Supabase Cloud + Hostinger DNS

---

## How to Read This Document

Every pitfall has:

- **Severity**: `P0` (data loss / broken auth / security hole) · `P1` (embarrassment / broken UX) · `P2` (cost / toil)
- **Breaks loudly / silently**: whether you'll see a 500 vs. discover it a week later
- **What it looks like**: symptom you'd actually observe
- **Detection before deploy**: concrete check you can run now
- **Fix**: exact steps

Codebase evidence cited as file paths.

---

# P0 — WILL LOSE DATA, LEAK SECRETS, OR BREAK AUTH

## Pitfall 1: Service-role key leaked to the browser via `NEXT_PUBLIC_*` misprefix

**Severity:** P0 · **Breaks:** silently (until someone opens DevTools)

**What goes wrong:**
You paste the Supabase service-role key into Vercel with `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` instead of `SUPABASE_SERVICE_ROLE_KEY`. Vercel happily inlines it into the browser bundle. Anyone with DevTools can now bypass RLS on your whole DB.

**Why it happens:**
- Vercel's UI does not warn about dangerous env names.
- Solo devs copy-paste quickly and muscle-memory types `NEXT_PUBLIC_` for "Supabase" vars.
- Works in dev because the key is present either way; prod discovery comes from a stranger running `JSON.parse(Object.entries(window).find(...))`.

**What it looks like:**
Nothing. App works perfectly. Then: mass RLS-bypassing inserts, account takeovers, or "my DB has rows for users that don't exist."

**Detection before deploy:**
1. Build locally with the same env Vercel will use: `NODE_ENV=production pnpm --filter @digswap/web build`.
2. After build, grep the generated client bundles: `grep -r "service_role\|SUPABASE_SERVICE_ROLE" apps/web/.next/static/ || echo "clean"`.
3. Any hit = abort deploy.
4. Repeat grep for `STRIPE_SECRET_KEY`, `HANDOFF_HMAC_SECRET`, `IMPORT_WORKER_SECRET`, `RESEND_API_KEY`, `DISCOGS_CONSUMER_SECRET`, `UPSTASH_REDIS_REST_TOKEN`, `DATABASE_URL`.
5. In Vercel dashboard, sort env vars alphabetically and confirm: only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_STRIPE_PRICE_*`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_MIN_DESKTOP_VERSION` carry the `NEXT_PUBLIC_` prefix. Nothing else.

**Fix:**
- Rotate the key in Supabase dashboard (Project Settings → API → "Reset service role key") — the leaked one is now public forever.
- Update Vercel env var with correct name.
- Redeploy.
- Review `audit.log` and `profiles` for impossible writes.

**Codebase signal this is a live risk:** `apps/web/src/lib/env.ts:11` requires `SUPABASE_SERVICE_ROLE_KEY` (unprefixed — good). But there is no build-time assertion that dangerous names never appear in `publicEnv`. Add one.

---

## Pitfall 2: `.env.local` accidentally committed in the rush

**Severity:** P0 · **Breaks:** silently (leaks to GitHub)

**What goes wrong:**
Under pressure you do `git add .` instead of adding specific files. `.env.local` (or `.env`, `.env.production`) gets pushed to a public GitHub repo. GitHub secret scanners trigger. Bots scrape the file within minutes. Your DB, Stripe account, and Discogs app are now attacker-controlled.

**Why it happens:**
Solo dev worktree is messy (audit reports 185 dirty entries, 139 untracked — `260406-aud-SUMMARY.md:37`). `.env.local` is easy to lose among that noise.

**Detection before deploy:**
1. `git check-ignore apps/web/.env.local` must return the path (= it's ignored). If it prints nothing, `.env.local` is NOT ignored.
2. `git log --all --full-history --source -- "**/.env*" | head -30` — any hit beyond `.env.example` / `.env.local.example` = you've committed one at some point in history. Rewrite history or rotate all keys.
3. GitHub: enable **Secret Scanning** + **Push Protection** in repo settings.
4. Install `gitleaks` as a pre-commit hook: `gitleaks protect --staged`.

**Fix if already leaked:**
- Rotate: Supabase service role + anon (dashboard), Stripe secret/publishable + webhook secret (Stripe dashboard), Discogs consumer key/secret (Discogs dashboard), Resend API key, Upstash token, Sentry auth token, `IMPORT_WORKER_SECRET`, `HANDOFF_HMAC_SECRET`.
- `git rm --cached` + force-push with BFG if you must scrub history (but assume it's already scraped).

---

## Pitfall 3: Migration drift — `drizzle/` vs `supabase/migrations/` diverge silently

**Severity:** P0 · **Breaks:** loudly on first prod migration, silently after

**What goes wrong:**
This codebase has TWO migration tracks:
- `drizzle/` (6 migrations, journal at `drizzle/meta/_journal.json`)
- `supabase/migrations/` (29 SQL files, `20260327_*` through `20260418_*`)

The Apr 6 audit flagged this explicitly (`260406-aud-SUMMARY.md:79`): `drizzle/0002_showcase_cards.sql` exists outside the journal; `supabase/migrations/20260405_fix_all_rls_null_policies.sql` references columns (`invited_by`, `invitee_id`) that the Drizzle schema doesn't model. When you point `drizzle-kit migrate` at prod, it applies the journal but ignores the `supabase/migrations/` track. When Supabase applies its own track, column-name mismatches explode.

**What it looks like:**
- Loud: `drizzle-kit migrate` fails mid-way, leaving prod DB in a half-migrated state (transaction broken — Drizzle does NOT wrap the whole migration in a single txn by default).
- Silent: table `group_invites` has `created_by` in schema but RLS policies reference `invited_by` — inserts succeed, but RLS denies all SELECTs → users see empty lists.

**Detection before deploy:**
1. Spin up a clean local Supabase: `supabase db reset` (wipes + replays).
2. Run `drizzle-kit push` against it. Any error = the two tracks contradict.
3. Run `drizzle-kit check` — validates only the Drizzle journal; does NOT catch the SQL-only migrations.
4. Diff: `pg_dump --schema-only` from local vs. `supabase db dump --schema-only` — they must be byte-identical.
5. Manual: open every `supabase/migrations/*.sql` that touches a table also defined in `apps/web/src/lib/db/schema/` and verify column names match.

**Fix:**
Pick ONE track as source of truth for prod. Recommend: treat `supabase/migrations/` as authoritative (because RLS policies, triggers, `pg_cron`, and Edge Function calls live there; Drizzle can't express those). Delete Drizzle migrations from the journal; use Drizzle only for schema typing (`drizzle-kit generate --dry-run` to check schema sync, never push). Document this clearly.

**Prior claim to verify:** commit `35ed595` says "resolve all pre-deploy blockers from 6-skill audit." Run `drizzle-kit check` + `supabase db reset --linked` against the actual prod-intended snapshot before trusting that claim.

---

## Pitfall 4: Running migrations against the wrong database

**Severity:** P0 · **Breaks:** catastrophically (data loss in prod)

**What goes wrong:**
You have `.env.local` pointing at dev Supabase. You export prod `DATABASE_URL` to run migrations. Terminal session keeps both. Next `drizzle-kit migrate` runs against the wrong one. Or worse: `supabase db reset` when `supabase link` still points at prod.

**Why it happens:**
- `DATABASE_URL` is a single env var, trivially overridden.
- `supabase link` is sticky across terminal sessions; `supabase db reset` uses the linked project, NOT the `.env` URL.
- Solo dev tired at midnight is the prime victim.

**Detection/prevention:**
1. Use two separate Supabase PROJECTS (not branches). Free tier allows 2 projects: `digswap-dev` + `digswap-prod`.
2. Put prod credentials in a password manager. Never in `.env.local`. Only paste them into `.env.production` *which is in `.gitignore` AND actively excluded from your editor workspace* — or better, use Supabase CLI with explicit `--project-ref`.
3. Before any prod DB command: `supabase projects list` and confirm the linked ref matches what you intend.
4. Add a safety script in `package.json`:
   ```json
   "migrate:prod": "test \"$CONFIRM\" = 'YES_PROD' && drizzle-kit migrate || echo 'Refusing: set CONFIRM=YES_PROD'"
   ```
5. Enable Supabase **Point-in-Time Recovery** (Pro plan, $25/mo) before first prod migration. PITR saved more solo devs than any other line item.

**Fix after fuck-up:** Restore from PITR (if enabled) or daily backup (free tier, up to 7 days). Without PITR, you're restoring from a daily snapshot and losing up to 24h of data.

---

## Pitfall 5: RLS policies pass in dev because you use service role; fail in prod under `authenticated` role

**Severity:** P0 · **Breaks:** silently (features return empty results for real users)

**What goes wrong:**
During dev, you hit the DB via `createAdminClient()` (`apps/web/src/lib/supabase/admin.ts`) which uses `SUPABASE_SERVICE_ROLE_KEY` and bypasses RLS entirely. Queries return data fine. In prod, the same query runs through `createClient()` as the end user. RLS policies that were never exercised now run for real — and deny legitimate reads.

**Specific hot spots in this codebase:**
- `group_invites` — audit flags schema mismatch (`invited_by` vs `created_by`); RLS may reference a column that doesn't exist.
- Any policy referencing `auth.jwt() ->> 'sub'` vs `auth.uid()` — subtle differences surface only under real JWTs.
- DM policies (`20260416_dm_mutual_follow_rls.sql`) — complex mutual-follow checks; one typo = empty inbox.
- Notifications (cross-user reads needed for wantlist matches) — easy to write policy that only allows your own.

**Detection before deploy:**
1. Never use service-role in dev for manual testing. Use a real test user.
2. Write RLS tests that run as `authenticated` role with a specific JWT:
   ```sql
   SET ROLE authenticated;
   SET request.jwt.claims TO '{"sub":"<test-user-uuid>","role":"authenticated"}';
   SELECT * FROM group_invites WHERE id = '...'; -- must return expected row
   RESET ROLE;
   ```
3. Supabase advisor: dashboard → Security Advisor. Run it on prod project before enabling auth. It flags "table has RLS enabled but no policies" and "policies reference missing columns."
4. Playwright: write one E2E per feature that logs in as user A and verifies user B's data is invisible.

**Fix:**
For each feature, run the exact query the server action runs, but as `authenticated` with the test user's JWT. If it returns empty in SQL but the E2E test "passes" because the UI shows "no results" gracefully, your test is useless — assert on an expected non-empty result.

---

## Pitfall 6: Stripe webhook signature verification fails because dev and prod use different signing secrets

**Severity:** P0 · **Breaks:** loudly for webhook (400), silently for user state (subscription never activates)

**What goes wrong:**
Each Stripe webhook endpoint has its own signing secret. You set up `/api/stripe/webhook` in test mode → got `whsec_test_xyz`. You deploy to prod, Stripe asks you to create a NEW endpoint for live mode → `whsec_live_abc`. If you leave `STRIPE_WEBHOOK_SECRET=whsec_test_xyz` in Vercel, every live webhook returns 400 at `apps/web/src/app/api/stripe/webhook/route.ts:304` (`stripe.webhooks.constructEvent`). Paid users never get `subscription_tier: premium`.

**Why it happens:**
- The secrets look the same (`whsec_*`) so it's easy to copy the wrong one.
- Stripe retries webhooks for 3 days with exponential backoff; customers call support before you notice the log.

**Detection before deploy:**
1. Stripe Dashboard → Webhooks → confirm you have TWO endpoints: one in test mode (pointing at `localhost` via `stripe listen --forward-to`), one in live mode (pointing at `https://digswap.com/api/stripe/webhook`). They have different signing secrets.
2. Copy the **live** endpoint's signing secret into Vercel's `STRIPE_WEBHOOK_SECRET` (prod env only).
3. For preview deploys, either use a Stripe "test mode" endpoint pointing at a preview URL, or (simpler) disable Stripe on previews entirely.
4. After deploy: Stripe Dashboard → Webhooks → click your live endpoint → "Send test webhook" → `checkout.session.completed`. Expect 200 back within 10s.
5. Check Vercel function logs for that request — confirm `[stripe.webhook]` has NO "signature verification failed".

**Fix:**
Rotate the secret in Stripe if you've leaked it, update Vercel, redeploy. For already-missed events, Stripe Dashboard → Events → resend manually, or trigger a `subscription_schedule.update` on the customer to force a fresh `customer.subscription.updated` event.

**Bonus gotcha:** test-mode and live-mode have SEPARATE customer IDs, subscription IDs, product IDs. Your `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` in prod MUST reference a live-mode price ID, not the `price_test_*` one.

---

## Pitfall 7: OAuth redirect URIs not registered for prod domain — Discogs / Google / GitHub break on first login

**Severity:** P0 · **Breaks:** loudly (users can't sign in at all)

**What goes wrong:**
Discogs OAuth app has callback URL `http://localhost:3000/api/discogs/callback`. User clicks "Connect Discogs" on `https://digswap.com` → Discogs redirects to `localhost:3000` → browser shows connection refused.

**Affects (this codebase):**
- Discogs OAuth 1.0a — Discogs app settings page.
- Supabase Auth social providers (Google, GitHub) — Google Cloud Console + GitHub OAuth Apps + Supabase Auth Providers panel. Google in particular has an "Authorized redirect URIs" list that has to include `https://<project-ref>.supabase.co/auth/v1/callback` AND your site's callback.
- Supabase Auth Email confirmations — "Site URL" and "Redirect URLs" in Supabase Auth settings. If wrong, magic links land on localhost.

**Detection before deploy:**
Make a spreadsheet. For each provider, list: dev URL registered, prod URL needed, current values. Before first prod login, confirm each one has the prod URL added.

Specifically:
- Discogs → https://www.discogs.com/settings/developers → your app → add `https://digswap.com/api/discogs/callback`.
- Supabase Auth → Authentication → URL Configuration → Site URL: `https://digswap.com`; Redirect URLs: `https://digswap.com/**`.
- Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs: include `https://<ref>.supabase.co/auth/v1/callback`.
- GitHub OAuth App → Authorization callback URL: same Supabase callback.

**Fix:**
Add the URLs in each provider. Propagation is instant. Users see "redirect_uri_mismatch" errors until fixed.

---

## Pitfall 8: Cold-start 500s on public routes because middleware calls `supabase.auth.getUser()`

**Severity:** P0 · **Breaks:** loudly (home page returns 500 for anon users)

**What goes wrong:**
Vercel cold-starts a fresh Lambda. Middleware runs on EVERY request (matcher covers `/` → `apps/web/src/middleware.ts:34`). It calls `updateSession()` which does `supabase.auth.getUser()` (`apps/web/src/lib/supabase/middleware.ts:47`). Under cold start, the first Supabase request has to resolve DNS, establish TLS, auth with anon key — easily >1s. If Supabase is slow, middleware throws → 500 on `/`.

**The Apr 6 audit observed exactly this** (`260406-aud-SUMMARY.md:110`): `/`, `/signup`, `/signin`, `/pricing` returned 500 in cold start. Commit `35ed595` claims a fix but this needs independent smoke verification post-deploy.

**Why it happens:**
- `getUser()` is not wrapped in try/catch inside `updateSession()`. Any throw propagates to Next's middleware runtime.
- Middleware timeout is 10s on Vercel Hobby. A slow Supabase region + a slow DNS lookup can exceed it.
- The middleware ALSO calls a second query on protected paths (`user_sessions` lookup, line 96). That's two serial DB hits before the page renders.

**Detection before deploy:**
1. Cold-start test: deploy, wait 15 min (guaranteed cold), `curl -o /dev/null -w "%{http_code} %{time_total}s\n" https://digswap.com/`. Expect 200 in <3s.
2. Run the same against `/signin`, `/signup`, `/pricing`, `/`, `/perfil/<known-public-username>`.
3. Use k6 or artillery with 1-req-per-30s for 10 min to keep poking cold paths.
4. Wrap the critical call: in `middleware.ts`, wrap `updateSession()` in try/catch; on failure log to Sentry and return `NextResponse.next()` so anon users still see the page.

**Fix:**
- Wrap `supabase.auth.getUser()` call in try/catch; on error, treat as anonymous and continue.
- Skip middleware entirely on truly public paths by tightening the matcher. Add `public/*` or a `/(marketing)/` route group with its own layout and exclude it from the matcher.
- Consider `export const runtime = 'edge'` for the middleware — already the default, but confirm.
- For `/pricing` specifically: do NOT call `getUser()` in the page. Render the public variant unconditionally, hydrate user-specific CTA on the client.

---

## Pitfall 9: Preview deploys write to production database

**Severity:** P0 · **Breaks:** silently (preview PR pollutes prod rows)

**What goes wrong:**
Vercel creates a preview URL for every PR/branch. By default, preview deploys inherit ALL env vars from Production. Your PR branch now has a webapp that reads/writes prod Supabase. A teammate (or you, testing) signs up on the preview, inserts rows, triggers Stripe checkout — all in prod. Worse: an experimental branch runs a bad migration or creates real Stripe customers.

**Why it happens:**
- Vercel's env scope toggle is easy to miss: each env var must be set for Production, Preview, Development independently.
- The default is "All environments" which means the same value applies everywhere.

**Detection before deploy:**
1. Vercel Dashboard → Settings → Environment Variables. For every DB/secret/API env var:
   - Scope `Production` → prod value.
   - Scope `Preview` → separate preview value (pointing at `digswap-dev` Supabase, `whsec_test_*` Stripe, etc).
   - Scope `Development` → local-only values (rarely needed).
2. Sanity check: open `https://<preview-url>/api/debug/env-check` (create a tiny endpoint that returns `SUPABASE_URL.slice(0,20)`) — must NOT match prod project ref.
3. Second line: a `middleware.ts` check — if `process.env.VERCEL_ENV === 'preview'` and `DATABASE_URL` matches prod project ref, throw at boot.

**Fix:**
Create a separate Supabase project for previews (or share dev). Set env vars with Preview scope pointing at it. Redeploy.

---

## Pitfall 10: Session revocation doesn't actually revoke

**Severity:** P0 · **Breaks:** silently (logged-out tokens keep working)

**What goes wrong:**
The Apr 6 audit flagged this (`260406-aud-SUMMARY.md:205`): `apps/web/src/actions/sessions.ts` passes `session.sessionId` to `admin.auth.admin.signOut(...)` but the Supabase SDK method expects a JWT, not a session ID. "Log out" may not actually invalidate the token.

Simultaneously, the middleware path (`apps/web/src/lib/supabase/middleware.ts:96-112`) maintains a `user_sessions` allowlist — but this check is SKIPPED on routes like `/api/stripe/`, `/api/og/`, `/api/desktop/`, `/api/discogs/import`. A revoked session can still hit those endpoints with a valid-looking JWT until expiration (1 hour by default).

**Detection before deploy:**
1. E2E test: sign in → capture access token → sign out via UI → hit a protected API with the old token via `curl -H "Authorization: Bearer <token>"` → must return 401 within 60s.
2. Same test but hit `/api/desktop/handoff/consume` with the old bearer. If it succeeds, you have a session-fixation vulnerability.
3. Supabase Dashboard → Authentication → Sessions (new panel, April 2026) — confirm "Revoke" button actually removes the row.

**Fix:**
Replace `admin.auth.admin.signOut(session.sessionId)` with the correct pattern: fetch the user's JWT from `user_sessions`, call `admin.auth.admin.signOut(jwt)`, OR use the new `POST /auth/v1/admin/users/{user_id}/logout` endpoint which revokes all sessions for a user.

**The audit says `35ed595` fixed this.** Verify by running the E2E described above on the deployed prod URL.

---

## Pitfall 11: Discogs tokens stored plaintext in DB fallback path

**Severity:** P0 · **Breaks:** silently (breach → Discogs account takeover for every user)

**What goes wrong:**
`apps/web/src/lib/discogs/oauth.ts` has a fallback path (when Supabase Vault is not enabled) that stores `access_token` + `access_token_secret` as plaintext in `discogs_tokens` (audit P1 item, `260406-aud-SUMMARY.md:280`). If a SQL injection, backup leak, or admin compromise occurs, attacker hijacks every linked Discogs account AND can delete users' Discogs collections/wantlists.

**Detection:**
`SELECT access_token FROM discogs_tokens LIMIT 1;` — if it starts with letters/numbers that look like a Discogs token (no `$` prefix indicating Vault encryption), it's plaintext.

**Fix:**
Enable Supabase Vault on prod project BEFORE any Discogs connection: `CREATE EXTENSION IF NOT EXISTS supabase_vault;`. Re-run the OAuth flow for existing users OR app-layer encrypt with AES-256-GCM using a KEK stored in env.

---

# P1 — WILL EMBARRASS YOU (broken UX, broken emails, SSL red padlock)

## Pitfall 12: DNS set but SSL cert not ready — first visitors see security warning

**Severity:** P1 · **Breaks:** loudly (browser blocks the page)

**What goes wrong:**
You point `digswap.com` at Vercel via Hostinger. DNS propagates in 5 min but Let's Encrypt cert issuance takes 10-60 min (sometimes longer if Vercel's ACME can't validate). First visitors see `NET::ERR_CERT_AUTHORITY_INVALID`. Some share screenshots to Twitter.

**Why it happens:**
- Hostinger defaults may include a CNAME flattening or CAA record that blocks Let's Encrypt.
- Vercel needs both `A 76.76.21.21` (apex) AND `CNAME cname.vercel-dns.com` (www) — or use Vercel's apex workaround.

**Detection before deploy:**
1. Set DNS the night before your "launch." Do NOT announce until:
2. `curl -sI https://digswap.com/ | grep -i "server:"` returns `Vercel`.
3. `openssl s_client -connect digswap.com:443 -servername digswap.com </dev/null 2>/dev/null | openssl x509 -noout -issuer` shows Let's Encrypt.
4. Test from a fresh browser profile / incognito / mobile network (avoid stale DNS cache).
5. Check CAA records: `dig CAA digswap.com`. If any CAA exists, it MUST include `letsencrypt.org` or Vercel can't issue.

**Fix:**
Remove blocking CAA records. In Vercel Domains tab → click the domain → if cert status is "pending", trigger refresh. If still failing, check Vercel's DNS instructions page for the exact records.

---

## Pitfall 13: HSTS header locks users into a broken HTTPS if cert fails later

**Severity:** P1 · **Breaks:** loudly on any future SSL hiccup

**What goes wrong:**
`apps/web/next.config.ts:12` sets `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` from day 1. Once a browser caches this, it REFUSES HTTP fallback for 2 years. If your cert ever lapses (Let's Encrypt auto-renewal failure, DNS change), users are hard-blocked with no workaround until fix.

**Why it's especially risky on first deploy:**
HSTS on day 1 means if you need to move domains, stop using HTTPS temporarily, or a cert issue arises, visitors see an unrecoverable error (no "proceed anyway" button).

**Detection/mitigation:**
1. For the FIRST 24-48 hours, reduce to `max-age=300` (5 min) so mistakes can be rolled back.
2. After verifying everything works, bump to `max-age=63072000`.
3. Do NOT submit to the HSTS preload list until you've run stable for 3+ months.

**Fix:**
Change `next.config.ts:12` to `max-age=300` for the first launch window; gate the full value behind `process.env.VERCEL_ENV === 'production' && process.env.HSTS_FULL === 'true'` so you can flip it on after confidence.

---

## Pitfall 14: CSP too strict — app renders blank because nonce never reaches client scripts

**Severity:** P1 · **Breaks:** loudly (blank page, console full of CSP violations)

**What goes wrong:**
Middleware generates a per-request CSP nonce (`apps/web/src/middleware.ts:10-24`). If ANY inline script or third-party script (Sentry, Stripe.js, Google OAuth, analytics) doesn't use the nonce, CSP blocks it in prod (when `isDev=false`). Dev mode has relaxed CSP so you never see this locally.

**Specific risk:** Stripe Checkout injection, Sentry's session replay, and any `<script>` tag in shadcn components that doesn't pass `nonce={nonce}`.

**Detection before deploy:**
1. `NODE_ENV=production pnpm --filter @digswap/web build && pnpm --filter @digswap/web start` on localhost.
2. Open in a fresh Chrome profile, open DevTools Console. Navigate every page: `/`, `/signup`, `/signin`, `/pricing`, `/feed`, `/perfil/<user>`, settings, Stripe checkout, Discogs connect flow.
3. Any `Refused to execute inline script because it violates the following Content Security Policy directive` = deploy blocker.
4. Fix each by adding `nonce` to the script or adding the source to CSP allowlist in `lib/security/csp.ts`.

**Fix:**
Start with `Content-Security-Policy-Report-Only` (not enforced, just logs) for first 48h. Collect violations via `report-uri`. Once clean, flip to enforcing.

---

## Pitfall 15: Resend emails land in spam because domain isn't verified

**Severity:** P1 · **Breaks:** silently (users "never received confirmation email")

**What goes wrong:**
`RESEND_FROM_EMAIL=noreply@digswap.com` in `.env.local.example`. In Resend, sending from an unverified domain falls back to `onboarding@resend.dev` or gets rejected. Even with a verified domain, without proper SPF/DKIM/DMARC records, Gmail/Outlook dump emails to spam.

**Impact here:**
- Supabase email confirmation on signup (AUTH-01) — user never confirms → stuck account.
- Wantlist match notifications (NOTF-02) — silent drop.
- Password reset — user thinks they're blocked out.

**Detection before deploy:**
1. Resend Dashboard → Domains → `digswap.com` status = "Verified" (green).
2. DNS must have: `TXT _resend._domainkey.digswap.com` (DKIM), `TXT digswap.com v=spf1 include:amazonses.com ~all` (SPF via Resend), `TXT _dmarc.digswap.com v=DMARC1; p=none; rua=mailto:...` (DMARC).
3. Send a test email to Gmail, Outlook, iCloud, ProtonMail. Check spam folder. Aim for inbox on all 4.
4. [Mail-tester.com](https://www.mail-tester.com) gives a 0-10 score. Shoot for 9+.

**Fix:**
Add the 3 DNS records in Hostinger. Wait 15 min for propagation. Click "verify" in Resend. Re-test.

**Bonus:** Supabase Auth's SMTP settings default to Supabase's shared sender (rate-limited, lands in spam). Switch to Resend via Authentication → Email Templates → SMTP Settings. Put your Resend credentials there. Otherwise the signup flow never delivers.

---

## Pitfall 16: Next.js Server Actions fail with "Body exceeded 1 MB" on uploads

**Severity:** P1 · **Breaks:** loudly (form submission fails)

**What goes wrong:**
Next.js 15 Server Actions have a default body limit of 1MB. The codebase has `bodySizeLimit: "6mb"` (`apps/web/next.config.ts:37`) — good. But Vercel also enforces its OWN body limit on serverless functions: 4.5MB for Hobby, 4.5MB for Pro (payload limit, not request body — but effectively the same on serverless). Anything larger (profile image uploads, audio previews, Discogs import JSON response) hits a separate ceiling.

**Also: serverActions bodySizeLimit doesn't apply to API route handlers.** `/api/discogs/import` and `/api/stripe/webhook` are Route Handlers, not Server Actions. They use whatever Vercel's default is.

**Detection:**
Upload a 5MB file via each upload path. If it fails with 413 Payload Too Large, you've hit the limit.

**Fix:**
- For large uploads, use Supabase Storage direct upload with signed URLs — client → Supabase directly, bypassing Vercel function entirely.
- For Discogs imports of large collections: chunk the API response, don't shove 5000 records into one serverless call.

---

## Pitfall 17: Supabase connection pooling misconfig — "prepared statements not allowed"

**Severity:** P1 · **Breaks:** loudly (queries fail under load)

**What goes wrong:**
`apps/web/src/lib/db/index.ts:8` correctly sets `prepare: false` — required when using Supabase's pooler in transaction mode (port 6543). BUT: if `DATABASE_URL` accidentally points at the direct connection (port 5432) instead of the pooler (port 6543), and you're on a serverless runtime, you'll exhaust Supabase's max connections (25 on free, 60 on Pro) within minutes of modest traffic.

**Conversely:** if you use port 6543 but forget `prepare: false`, you get `ERROR: prepared statement "..." does not exist` intermittently.

**Detection before deploy:**
1. `echo $DATABASE_URL | grep -oE ':\d+'` — must show `:6543` (transaction pooler) NOT `:5432` (direct).
2. Confirm URL starts with `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`.
3. Supabase Dashboard → Database → Connection Pooling → "Transaction" mode URL is what goes in `DATABASE_URL`. Keep the "Session" mode URL handy ONLY for migrations.
4. For migrations (`drizzle-kit migrate`), use the DIRECT connection (port 5432) in a separate env var — transactions can't run against the pooler in transaction mode.

**Fix:**
Two URLs in env:
- `DATABASE_URL` = pooler:6543 (for app runtime) with `prepare: false`.
- `DIRECT_URL` = direct:5432 (for migrations only).

Drizzle supports this via `drizzle.config.ts` `{ dbCredentials: { url: process.env.DIRECT_URL } }`.

---

## Pitfall 18: `pg_cron` jobs scheduled against `postgres` superuser won't work on Supabase Cloud

**Severity:** P1 · **Breaks:** silently (scheduled jobs never run)

**What goes wrong:**
Codebase has multiple `pg_cron` schedules (`supabase/migrations/20260327_ranking_function.sql`, `030_purge_soft_deleted.sql`, `20260417_trade_preview_infrastructure.sql`). On self-hosted Postgres you'd use `postgres` user; on Supabase Cloud, cron jobs must be owned by `postgres` and scheduled in the `postgres` database — and the role running the migration needs `pg_cron` grants.

If migrations are run by the Supabase migration runner under a role without cron privileges, the `cron.schedule(...)` calls silently no-op.

**What it looks like:**
- Rankings never refresh → users see stale ranks.
- Soft-deleted collection items never purge → DB bloats over months.
- Trade preview cleanup never runs → Storage bloats.

**Detection:**
`SELECT jobid, schedule, command, active FROM cron.job;` — expect 3+ rows on prod.
`SELECT jobid, status, start_time, end_time FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;` — expect recent successful runs.

**Fix:**
- Run cron-creating migrations manually via Supabase SQL Editor (runs as `postgres`).
- OR: wrap in `SET ROLE postgres; SELECT cron.schedule(...); RESET ROLE;` — but this requires the migration role to have `postgres` as a group.
- Supabase now supports `supabase functions deploy --cron` for Edge Function schedules — cleaner for long-running work than `pg_cron`.

---

## Pitfall 19: Rate limiter fails closed when Upstash env is missing — blocks all logins

**Severity:** P1 · **Breaks:** loudly (every login returns 429)

**What goes wrong:**
`apps/web/src/lib/rate-limit.ts` defaults to `failClosed=true` for auth flows. If `UPSTASH_REDIS_REST_URL` is empty string (`.env.local.example` line 24 allows empty), `safeLimit` returns `success: false` for every call. Result: every signin/signup request 429s.

The env schema (`apps/web/src/lib/env.ts:33`) treats Upstash as `.optional().default("")` — deploy succeeds with no Redis, then app behaves erratically.

**Detection before deploy:**
1. `grep -r 'UPSTASH_REDIS' apps/web/src/lib/` — confirm how it's used.
2. In Vercel env, verify both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set for Production scope (not "optional default" — real values).
3. E2E: attempt signin 10 times in a row from the deployed preview. Expect success on first attempt. If 429, Redis is misconfigured.

**Fix:**
Make Upstash REQUIRED in prod — strengthen env schema:
```ts
UPSTASH_REDIS_REST_URL: process.env.NODE_ENV === 'production' || process.env.VERCEL
  ? z.string().url('UPSTASH_REDIS_REST_URL required in prod')
  : z.string().optional().default(""),
```
Same for `UPSTASH_REDIS_REST_TOKEN`. Boot fails if missing — far better than silent auth breakage.

---

## Pitfall 20: Supabase Storage buckets default to "public" — user uploads world-readable

**Severity:** P1 · **Breaks:** silently (private data exposed via guessable URLs)

**What goes wrong:**
When you create a bucket via dashboard or SQL, the "Public" toggle defaults to off in newer versions but historically defaulted on. Public bucket = any object's URL is world-readable if guessable. Combine with predictable paths (`profile-<uuid>.jpg`) and you leak.

For this codebase: avatar uploads, trade previews, badge icons — all likely in Supabase Storage.

**Detection before deploy:**
1. Supabase Dashboard → Storage → list all buckets → column "Public" must be ❌ for anything user-specific.
2. For each bucket, check RLS policies on `storage.objects`: each bucket needs an INSERT policy (user can upload their own path) and SELECT policy (user can read their own OR public-scoped paths).
3. Test: upload a file as user A. As anonymous: `curl https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>` — must return 404 or 403, not 200.

**Fix:**
Flip Public to off. Use `createSignedUrl(path, ttlSeconds)` for time-limited access. For avatars (truly public), use a separate `avatars` bucket with Public on, and never put user-private data there.

---

## Pitfall 21: Stripe live mode vs test mode confusion — first "paying" customer is in test mode

**Severity:** P1 · **Breaks:** silently (no real money, user thinks they paid)

**What goes wrong:**
You ship with `STRIPE_SECRET_KEY=sk_test_*` in prod by mistake. User pays with real card — Stripe silently accepts it as a test transaction (no money moves). User sees "success!" and then has no access because the webhook payload comes from test mode with a different signing secret. Or user's subscription activates but you never get paid.

**Even worse:** `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY=price_test_*` combined with `sk_live_*` → Checkout redirect fails with "price not found."

**Detection before deploy:**
1. Prod env: `STRIPE_SECRET_KEY` starts with `sk_live_` (NOT `sk_test_`).
2. Prod env: `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` and `_ANNUAL` reference live-mode prices (Stripe Dashboard with "Test mode" toggle OFF in upper-right).
3. Prod env: `STRIPE_WEBHOOK_SECRET` starts with `whsec_` (both modes use this prefix — can't distinguish visually. Match it to the LIVE endpoint in Stripe Dashboard).
4. After deploy, make one real $1 test transaction (use your own card, refund after). Verify Stripe Dashboard shows it in "Live" mode, and user's `subscription_tier` updated.

**Fix:**
All Stripe env vars scoped to Vercel `Production` should be `_live_` variants. `Preview` scope gets `_test_` variants.

---

## Pitfall 22: Vercel Hobby plan forbids commercial use

**Severity:** P1 · **Breaks:** silently (legal/contractual, until Vercel emails you)

**What goes wrong:**
Vercel Hobby ToS: "Not for commercial use." The moment you accept a single paid subscription via Stripe, you're in violation. Vercel doesn't auto-enforce but may suspend at any time — often right when you go viral.

**Detection:**
Your stack includes Stripe. If you charge ANY user, upgrade to Pro ($20/mo) BEFORE the first charge.

**Fix:**
Upgrade before first real user. Pro also unlocks 60s function timeout (vs 10s Hobby) which matters for Discogs import and Stripe webhook handler (`maxDuration = 60` at `route.ts:14` — this is simply ignored on Hobby).

---

## Pitfall 23: Next.js 15 `dynamic = 'force-dynamic'` missing on auth-dependent pages

**Severity:** P1 · **Breaks:** loudly (cached stale user data served to other users)

**What goes wrong:**
Next.js 15 aggressively caches Server Components. A page that reads `cookies()` or `headers()` auto-opts out of static rendering — UNLESS it's wrapped in a way that hides that signal (e.g., reading cookies inside a dynamic import or late in render). Edge case: a profile page reads the user's JWT but the framework caches it, serving user A's data to user B.

**Symptoms:**
- Feed shows another user's notifications.
- Settings page shows wrong email.
- Pricing page shows wrong subscription tier.

**Detection before deploy:**
1. Open `curl -I https://digswap.com/feed`. Look for `x-nextjs-cache: HIT` on a route that should NEVER be cached.
2. Sign in as user A, open `/perfil`, note data. In private window, sign in as user B, open `/perfil`. If you see A's data, the route is wrongly cached.
3. Run `next build` output — look at the routes table. Auth-dependent pages should show `ƒ (Dynamic)` not `○ (Static)` or `● (SSG)`.

**Fix:**
For any page that depends on user identity, add at top:
```ts
export const dynamic = 'force-dynamic';
```
Better: add to the `(protected)` layout so every child inherits.

Only `export const runtime` seen in codebase is on OG image + stripe webhook + desktop routes (`grep` results above). Protected pages do NOT declare `dynamic` — audit and add.

---

## Pitfall 24: Protected route layout makes middleware + server-component hit `getUser()` TWICE per request

**Severity:** P1 · **Breaks:** silently (cost + cold start)

**What goes wrong:**
Middleware calls `supabase.auth.getUser()` (network). Then the protected page's layout ALSO calls it (network again). Each `getUser()` is a round-trip to Supabase. Two per page load = 2x latency = visible UI jank on cold start, 2x quota burn.

**Detection:**
Count `supabase.auth.getUser()` call sites per request in Vercel function trace (Sentry tracing or Vercel Speed Insights).

**Fix:**
Middleware sets user ID in a request header (e.g., `x-user-id`), layout reads from header instead of calling Supabase again. Supabase docs show this pattern as "Edge-friendly authentication."

---

# P2 — WILL COST YOU MONEY OR BURN YOUR TIME

## Pitfall 25: Vercel bandwidth/function-invocation overages blow past free tier

**Severity:** P2 · **Breaks:** silently (credit card surprise)

**What goes wrong:**
Free tier: 100GB bandwidth, 100GB-hours function compute, 1M invocations/month. If a single page has 30 images + 10 API calls and you hit 5k users/day, you exhaust the 1M invocations in ~6 days. Pro plan's overages are: $40/100GB bandwidth, $60/million extra invocations.

**Middleware runs on EVERY matched request** including `/api/*` that hit the DB anyway — that's double-invocation.

**Detection:**
1. Vercel Dashboard → Usage → set billing alert at 80% of each limit.
2. For high-traffic public routes: use `revalidate: 300` (5 min ISR) to drop middleware + render invocations.

**Fix:**
- Cache public pages aggressively.
- Tighten middleware matcher: exclude `/api/og/`, `/_next/data/` (already done), and any truly static pages.
- Image optimization: use `next/image` with `priority` only on above-fold. Otherwise Next generates multiple variants on-demand → more invocations.

---

## Pitfall 26: Supabase free tier DB hits 500MB quietly, read replica stops

**Severity:** P2 · **Breaks:** silently initially, loudly when it stops

**What goes wrong:**
500MB fills FAST on Discogs import (Discogs collections average 200 records → 80KB/user → 6250 users to fill). Materialized views for rankings store denormalized copies → 2x the bloat. Add `pg_cron` logs → more.

When you hit 500MB: Supabase does NOT block writes, but DB goes into "paused" state eventually.

**Detection:**
Supabase Dashboard → Database → Usage. Set alert at 80%.

**Fix:**
- Upgrade to Pro ($25/mo, 8GB included) before you hit 400MB.
- Aggressive pruning: don't persist Discogs responses raw, store only the normalized fields you query.
- Truncate old `pg_cron` logs: `DELETE FROM cron.job_run_details WHERE end_time < NOW() - INTERVAL '7 days';`

---

## Pitfall 27: Supabase 50K MAU free tier — defining "active" surprise

**Severity:** P2 · **Breaks:** silently (Supabase emails you)

**What goes wrong:**
"Active" = any user whose JWT was validated in the month. If a user leaves a tab open and `getUser()` auto-refreshes the token every hour → they're active even if they don't interact. Rollups reset at billing boundary.

At 50K MAU you'd be delighted anyway, but don't be surprised when the upgrade email arrives earlier than expected.

**Fix:**
Monitor Supabase Dashboard → Authentication → Users → MAU chart. Budget Pro plan by month 2-3 if growth is real.

---

## Pitfall 28: Sentry quota explodes from noisy CSP violations / health-check traffic

**Severity:** P2 · **Breaks:** silently (you stop seeing real errors because quota is full)

**What goes wrong:**
Sentry free tier: 5k errors/month. Misconfigured CSP in prod creates a violation per-blocked-script per-page-load → 100s of errors per user per session. Quota exhausted in a day; real bugs invisible.

**Detection:**
Sentry Dashboard → Issues → top issue by count. If a CSP violation dominates, you have a CSP config bug (see Pitfall 14).

**Fix:**
- Filter `TypeError: Failed to fetch` and CSP noise in `instrumentation.ts` / `sentry.client.config.ts` via `beforeSend`.
- Use `sampleRate: 0.1` for transactions (not errors).
- Set spike protection to prevent runaway cost.

---

## Pitfall 29: `IMPORT_WORKER_SECRET` and `HANDOFF_HMAC_SECRET` are dev defaults in prod

**Severity:** P2 (P0 if secrets leak, so call it P1-leaning) · **Breaks:** silently

**What goes wrong:**
`apps/web/src/lib/env.ts:20` defaults `HANDOFF_HMAC_SECRET` to `"dev-hmac-secret-not-for-production"` when NOT on Vercel. If somehow Vercel's `VERCEL` env var is not set (e.g., custom deploy target), the default is used. Attacker can forge handoff tokens.

**Detection:**
After deploy, `echo "$HANDOFF_HMAC_SECRET" | wc -c` on a prod shell (if you have one) — must be >=32. OR add a boot-time assert:
```ts
if (process.env.VERCEL && env.HANDOFF_HMAC_SECRET === "dev-hmac-secret-not-for-production") {
  throw new Error("Dev HMAC secret in prod!");
}
```

**Fix:**
Generate real secrets: `openssl rand -hex 32`. Paste into Vercel env for both `HANDOFF_HMAC_SECRET` and `IMPORT_WORKER_SECRET`. Never commit.

---

## Pitfall 30: `getUser()` inside OpenGraph image route (edge runtime) silently fails

**Severity:** P2 · **Breaks:** loudly (OG image is broken link in Twitter/WhatsApp previews)

**What goes wrong:**
`apps/web/src/app/api/og/rarity/[username]/route.tsx:5` declares `runtime = "edge"`. Edge runtime has different cookie/request semantics than Node. If the OG generator tries to read user-specific data via Supabase auth cookies, it fails at the edge. User shares their profile link → Twitter shows a broken image preview.

Middleware already excludes `/api/og/` from matcher (`middleware.ts:44`) — good. Still: the OG route itself may try to query the DB via Drizzle, which uses `postgres-js` which doesn't work on Edge runtime. You'd get a build error OR silent failure.

**Detection:**
`curl https://digswap.com/api/og/rarity/someuser -o /tmp/og.png && file /tmp/og.png` — must be a real PNG, not an HTML error page.

**Fix:**
Either use `runtime = "nodejs"` for OG routes that touch DB, or query via `fetch` to a separate API route + use Supabase REST (works on edge).

---

# Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Vercel + Supabase | Same env vars for prod/preview/dev all scoped "All Environments" | Scope each env var to Production / Preview / Development explicitly |
| Vercel + Stripe | `whsec_test_*` copied to prod `STRIPE_WEBHOOK_SECRET` | Two Stripe webhook endpoints (test, live); prod env var = live signing secret |
| Supabase Auth + OAuth providers | Prod callback URL never added to Google/GitHub/Discogs apps | Maintain a redirect-URL checklist; add prod URLs BEFORE first prod OAuth attempt |
| Supabase + Drizzle | `DATABASE_URL` pointing at `:5432` (direct) from serverless → connection exhaustion | Use `:6543` (transaction pooler) with `prepare: false` for runtime; direct URL only for migrations |
| Next.js 15 + Supabase SSR | `@supabase/auth-helpers-nextjs` (deprecated) | `@supabase/ssr` — already in use, good |
| Supabase Storage | Bucket defaults public; no bucket-level RLS | All buckets private; signed URLs for access; RLS policies on `storage.objects` per-bucket |
| Supabase Realtime | Every client subscribes to everything → 200 connection limit hit | Subscribe narrowly (`filter=user_id=eq.<id>`); disconnect on unmount |
| Resend + Hostinger DNS | Default Hostinger CAA blocks Let's Encrypt / Resend lookups | Audit CAA; remove or add `letsencrypt.org` and `amazon.com` |
| Stripe + Vercel preview deploys | Live Stripe keys inherited to preview → real charges on test PRs | Preview scope = test keys; kill switch envelope if someone loads live Checkout |
| pg_cron + Supabase Cloud | Job-creating migrations run as non-`postgres` role → no-op | Run cron-creating migrations manually via SQL Editor, or grant role to `postgres` |
| Sentry + Source Maps | Source maps uploaded publicly (world-readable `.map` files) | `productionBrowserSourceMaps: false` (already set at `next.config.ts:33`); confirm |

---

# Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Middleware runs `getUser()` on every request, including static-ish pages | Cold-start 500s, slow TTFB | Wrap in try/catch; bypass on truly public routes via matcher | Day 1 on Vercel Hobby |
| Two `getUser()` calls per protected page (middleware + layout) | Slow navigation, doubled Supabase quota | Pass user ID from middleware to layout via header | >5K users |
| Discogs import loops inline in API route | `maxDuration=60` hits, import dies mid-way, user sees partial data | Queue to Supabase Edge Function or `pg_cron`-triggered batch worker | Collections >1000 records |
| Ranking materialized view refresh every 15 min on big table | `REFRESH MATERIALIZED VIEW` locks reads | `REFRESH MATERIALIZED VIEW CONCURRENTLY` (requires unique index) | >10K users |
| N+1 queries on feed page (one query per post to fetch user) | Feed load >3s | Drizzle `.with()` relations or manual JOIN | >100 concurrent users |
| Realtime subscription to entire `notifications` table | Every client receives everyone's notifications; RLS fires N times | Filter subscription `user_id=eq.<id>` — RLS is not a filter, it's a gate | >50 concurrent online users |
| Unbounded `storage.objects` growth (trade previews never deleted) | Storage bills climb | `pg_cron` cleanup job; audit ran monthly | Ongoing, quietly |

---

# Security Mistakes (beyond OWASP basics)

| Mistake | Risk | Prevention |
|---------|------|------------|
| Using `supabase.auth.getSession()` instead of `getUser()` in server code | Trusts cookie without JWT validation — forged JWTs accepted | Already enforced in codebase (`middleware.ts:47`); lint rule to ban getSession in /src/app/**/*.ts server files |
| Session revocation via wrong SDK method (see Pitfall 10) | Revoked tokens keep working | E2E test: logged-out token on protected endpoint = 401 within 60s |
| `createAdminClient()` imported into a client component | RLS bypass in browser | `import "server-only"` already guards (`admin.ts:1`) — confirm ESLint `server-only` rule configured |
| CSP nonce leaks into client bundle (becomes deterministic) | Nonce-based CSP defeated | Nonce is per-request via `crypto.randomUUID()` (`middleware.ts:10`) — good; verify no build-time caching |
| Host header injection | Email links / OAuth redirects hijacked to attacker domain | Validate `request.headers.get('host')` against allowlist; Vercel does this but custom domains need explicit config |
| Discogs tokens in plaintext fallback | Breach = mass Discogs account hijack | Enable Supabase Vault before first prod connection |
| Stripe webhook without idempotency | Double-charging / double-provisioning on retry | Already implemented via `stripe_event_log` (`webhook/route.ts:31-53`) — good |
| CSRF on Server Actions | Next.js 15 has built-in protection, but... | Verify the `origin` header is checked against allowed hosts for Server Actions |
| Open redirect in `?next=` or `?redirect=` params | Phishing attack vector via your domain | Allowlist check: any redirect target must start with `/` or match `NEXT_PUBLIC_SITE_URL` |

---

# "Looks Done But Isn't" — Pre-Deploy Checklist

- [ ] **Build works:** `NODE_ENV=production pnpm --filter @digswap/web build` — runs clean, zero warnings (audit said this was broken on Apr 6; verify post-35ed595).
- [ ] **Typecheck works:** `pnpm --filter @digswap/web typecheck` — zero errors.
- [ ] **Tests green:** `pnpm --filter @digswap/web test` — zero failures (audit flagged `gem-badge.test.tsx`).
- [ ] **E2E runs:** `pnpm --filter @digswap/web test:e2e` — no port conflict, critical paths covered.
- [ ] **Env vars complete:** every key from `.env.local.example` set in Vercel with correct scope — no `NEXT_PUBLIC_*` holding secrets.
- [ ] **Secrets fresh:** `HANDOFF_HMAC_SECRET` and `IMPORT_WORKER_SECRET` generated with `openssl rand -hex 32`, not dev defaults.
- [ ] **Supabase project separate:** prod Supabase is NOT the dev project.
- [ ] **Migrations idempotent:** `supabase db reset --linked` (against a throwaway project) replays all migrations cleanly.
- [ ] **RLS live:** Supabase Security Advisor reports zero "tables without RLS" and zero "policy references missing column."
- [ ] **Service role never in browser:** grep `.next/static/` post-build for secrets — empty.
- [ ] **OAuth URLs:** Discogs, Google, GitHub all have prod callback registered.
- [ ] **Stripe live mode:** all Stripe env in prod start `_live_` or reference live webhook endpoint.
- [ ] **Email domain verified:** Resend domain = Verified; SPF/DKIM/DMARC in DNS.
- [ ] **DNS + SSL:** `openssl s_client` returns valid Let's Encrypt cert; no CAA blocking.
- [ ] **HSTS short:** `max-age=300` for first 48h, not 2 years.
- [ ] **CSP clean:** production build + all flows → DevTools Console has ZERO CSP violations.
- [ ] **Cold start OK:** `/`, `/signin`, `/signup`, `/pricing`, `/perfil/<public-user>` all return 200 under 3s after 15-min idle.
- [ ] **Preview ≠ Prod:** Vercel preview env vars point at dev/test services, not prod.
- [ ] **Rate limiter real:** Upstash Redis configured; 10 rapid signins don't 429.
- [ ] **Session revocation:** logged-out JWT hits 401 on protected routes within 60s.
- [ ] **Storage buckets private:** Supabase Dashboard → Storage → all user buckets ❌ Public.
- [ ] **pg_cron jobs registered:** `SELECT COUNT(*) FROM cron.job WHERE active;` returns expected count (likely 3+).
- [ ] **Sentry filters tuned:** spike protection on; CSP noise filtered; `beforeSend` strips PII.
- [ ] **Vercel plan:** Pro plan active (Hobby = no commercial use once Stripe enabled).
- [ ] **Backups:** Supabase PITR enabled (Pro) OR daily backup verified to restore in a test project.
- [ ] **Smoke test scripted:** `curl` + exit-code script that checks the 10 most critical routes return 200. Run post-every-deploy.

---

# Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Service-role key leaked (Pitfall 1) | HIGH | Rotate key in Supabase → update Vercel env → redeploy → audit `audit.log` + `profiles` for impossible writes → consider forced password reset for all users if any write is suspicious |
| `.env` committed (Pitfall 2) | HIGH | Rotate every single secret in the file → force-push with BFG → assume leaked forever → tighten `.gitignore` + add `gitleaks` pre-commit |
| Migration broke prod (Pitfall 3/4) | MEDIUM-HIGH | Restore from PITR (if Pro) or daily backup; accept N-hour data loss; replay application-level recovery via Stripe event log + Discogs re-sync |
| Wrong DB migrated (Pitfall 4) | HIGH | PITR restore; if not enabled, drop-and-reseed (acceptable ONLY pre-launch) |
| OAuth redirect mismatch (Pitfall 7) | LOW | Add redirect URL in provider → users retry login → done |
| DNS/SSL broken (Pitfall 12) | LOW-MEDIUM | Fix CAA/records → wait for cert → brand reputation hit if launch-day |
| HSTS misfire (Pitfall 13) | HIGH (for affected users) | Impossible to force-expire; users wait out `max-age`. Hence the "start short" recommendation |
| Stripe test/live confusion (Pitfall 6/21) | MEDIUM | Refund test-mode transactions in Stripe → communicate with users → re-invoice via live mode |
| Preview writing prod (Pitfall 9) | MEDIUM | Audit writes since PR creation; delete test rows; reset Stripe customers if real charges occurred |
| Session revocation broken (Pitfall 10) | MEDIUM | Global token rotation: update Supabase JWT secret → all tokens invalid → users re-login |
| Email deliverability (Pitfall 15) | LOW | Fix DNS → resend confirmations for stuck users |
| Rate limiter blocking all users (Pitfall 19) | LOW | Add Upstash env → redeploy → clear Upstash keys if needed |

---

# Pitfall-to-Phase Mapping

This is a single-phase milestone (v1.4 = first prod deploy). All pitfalls map to this milestone's sub-phases:

| Sub-phase | Pitfalls Prevented | Verification |
|-----------|-------------------|--------------|
| Pre-deploy audit | 1, 2, 3, 10, 17, 19, 25, 29 | Build + typecheck + tests + lint + env grep pass |
| Supabase prod setup | 3, 4, 5, 11, 17, 18, 20, 26, 27 | `supabase db reset` clean; Security Advisor green; PITR on; pg_cron jobs registered |
| Vercel + domain | 12, 13, 15, 22, 25 | SSL valid; DNS CAA clean; Vercel Pro active |
| Deploy + smoke tests | 6, 7, 8, 9, 14, 21, 23, 24, 28, 30 | Smoke script passes; webhook test 200; all 5 OAuth flows work; CSP zero violations; preview ≠ prod |
| Human UAT | 10, 15, 16, 20 | Real signup → email → confirm → Discogs → upload → trade → pay → receipt; full loop with real inbox |

---

# Sources

- Next.js 15 App Router caching & dynamic rendering — https://nextjs.org/docs/app/building-your-application/caching — HIGH
- Supabase RLS + SSR guide — https://supabase.com/docs/guides/auth/server-side/nextjs — HIGH
- Supabase Connection Pooling (pgBouncer transaction mode) — https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler — HIGH
- Supabase pg_cron docs — https://supabase.com/docs/guides/database/extensions/pg_cron — HIGH
- Supabase Storage RLS — https://supabase.com/docs/guides/storage/security/access-control — HIGH
- Stripe webhook signing & retries — https://docs.stripe.com/webhooks/signatures — HIGH
- Stripe test-mode vs live-mode — https://docs.stripe.com/test-mode — HIGH
- Vercel Hobby vs Pro comparison — https://vercel.com/pricing — HIGH
- Vercel environment variables scoping — https://vercel.com/docs/environment-variables/managing-environment-variables — HIGH
- Let's Encrypt CAA requirements — https://letsencrypt.org/docs/caa/ — HIGH
- Resend SPF/DKIM/DMARC setup — https://resend.com/docs/dashboard/domains/introduction — HIGH
- MDN Strict-Transport-Security — https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security — HIGH
- OWASP Top 10 (2021, current as of 2026) — https://owasp.org/Top10/ — HIGH
- Prior codebase audit — `.planning/quick/260406-aud-deploy-readiness-audit/260406-aud-SUMMARY.md` — HIGH (internal)
- Codebase — `apps/web/src/lib/env.ts`, `apps/web/src/lib/supabase/middleware.ts`, `apps/web/src/app/api/stripe/webhook/route.ts`, `supabase/migrations/`, `drizzle/meta/_journal.json` — HIGH (direct inspection)

---

*Pitfalls research for: first production deploy of Next.js 15 + Supabase Cloud + Vercel + Stripe webapp by solo dev*
*Researched: 2026-04-20 — v1.4 Production Launch milestone*
