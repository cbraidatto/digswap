---
phase: 037-external-integrations
plan: 01
type: execute
wave: 1
depends_on: ["037-00"]
files_modified:
  - .planning/phases/037-external-integrations/evidence/01-google-oauth-creds.md
  - .planning/phases/037-external-integrations/evidence/01-supabase-auth-config.json
  - .planning/phases/037-external-integrations/evidence/01-allow-list.json
  - .planning/phases/037-external-integrations/evidence/01b-google-signin-test.md
autonomous: false
requirements: [DEP-INT-05, DEP-INT-06]
gap_closure: false
user_setup:
  - service: google-cloud-console
    why: "Create prod-only OAuth 2.0 Web client (separate from dev) with prod Supabase callback URI"
    dashboard_config:
      - task: "Create OAuth 2.0 Client ID (Web application) named 'DigSwap Production'"
        location: "https://console.cloud.google.com/apis/credentials"
      - task: "Authorized JavaScript origins: https://digswap.com.br (no path, no trailing slash)"
        location: "Same screen, JavaScript origins field"
      - task: "Authorized redirect URIs: https://swyfhpgerzvvmoswkjyt.supabase.co/auth/v1/callback (EXACTLY this; D-06 forbids localhost in this client)"
        location: "Same screen, Redirect URIs field"

must_haves:
  truths:
    - "Supabase Auth project config has external_google_enabled=true with the new prod client_id and client_secret"
    - "Supabase Auth site_url=https://digswap.com.br"
    - "Supabase Auth uri_allow_list contains https://digswap.com.br/** (preserving any pre-existing entries)"
    - "User can complete Google OAuth flow from https://digswap.com.br/signin in Incognito and land on /onboarding (or /feed for returning users)"
    - "GET /v1/projects/swyfhpgerzvvmoswkjyt/config/auth returns the above values when probed via Management API"
  artifacts:
    - path: ".planning/phases/037-external-integrations/evidence/01-google-oauth-creds.md"
      provides: "Sanitized record of Google OAuth client_id (full) + secret presence (length only); Authorized origins/redirects exactly as set"
      min_lines: 20
    - path: ".planning/phases/037-external-integrations/evidence/01-supabase-auth-config.json"
      provides: "Pre/post diff of GET /v1/projects/{ref}/config/auth showing external_google_*, site_url, uri_allow_list changes"
      min_lines: 20
    - path: ".planning/phases/037-external-integrations/evidence/01-allow-list.json"
      provides: "Final GET response with uri_allow_list field showing https://digswap.com.br/** (DEP-INT-05 evidence)"
      min_lines: 5
    - path: ".planning/phases/037-external-integrations/evidence/01b-google-signin-test.md"
      provides: "Manual UAT log: Incognito click test, Google consent screen, post-auth redirect target (DEP-INT-06 evidence)"
      min_lines: 12
  key_links:
    - from: "Google Cloud Console OAuth Client (DigSwap Production)"
      to: "Supabase Auth provider config (external_google_client_id/secret)"
      via: "User pastes client_id/secret, Claude PATCHes via Management API"
      pattern: "external_google_client_id"
    - from: "https://digswap.com.br/signin Google button"
      to: "https://swyfhpgerzvvmoswkjyt.supabase.co/auth/v1/callback"
      via: "OAuth 2.0 redirect — Google verifies redirect_uri against the Authorized redirect URIs field"
      pattern: "auth/v1/callback"
    - from: "Supabase Auth callback"
      to: "https://digswap.com.br/auth/callback (Supabase rewrites + delivers session)"
      via: "uri_allow_list permits redirect to digswap.com.br/**"
      pattern: "digswap\\.com\\.br/\\*\\*"
---

<objective>
Wire Google OAuth (the only social provider in v1.4 per CONTEXT D-05) to production: create a NEW prod-only OAuth client in Google Cloud Console (separate from dev — Pitfall P7 mitigation per D-06), then configure Supabase Auth via Management API to enable Google with that client + set site_url + add `https://digswap.com.br/**` to the redirect allow-list. Closes DEP-INT-05 (Supabase allow-list updated) and DEP-INT-06 (Google OAuth client configured with prod Supabase callback URI). Validates with manual Incognito click-through.

Purpose: New users can sign in with Google from production. Email+password fallback already works.

Output: Two requirements closed (DEP-INT-05, DEP-INT-06), 4 evidence files documenting the Google client creation, Supabase config diff, and manual UAT result.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
<files_to_read>
- `.planning/phases/037-external-integrations/037-CONTEXT.md` (D-05 Google only / GitHub deferred; D-06 separate prod client; D-08 site_url + allow-list)
- `.planning/phases/037-external-integrations/037-RESEARCH.md` §"Pitfall P7" (the FULL recipe — including the precise "Authorized JavaScript origins = exactly https://digswap.com.br no trailing slash"); §"Code Examples > Supabase Management API auth config update"
- `.planning/phases/037-external-integrations/037-VALIDATION.md` rows DEP-INT-05 + DEP-INT-06
- `apps/web/src/components/auth/social-login-buttons.tsx` lines 30-50 (existing `signInWithOAuth({provider:"google"})` — no code change needed; OAuth client_id is read from Supabase Auth config, not env)
- `.planning/phases/037-external-integrations/evidence/00-tokens-handling.md` (proves `~/.supabase-token` reaches Management API)
</files_to_read>

<interfaces>
Supabase Management API auth config endpoint (HIGH confidence — RESEARCH §"Code Examples"):

```bash
# READ current config (capture pre-state for diff):
curl -sS \
  -H "Authorization: Bearer $(cat ~/.supabase-token)" \
  https://api.supabase.com/v1/projects/swyfhpgerzvvmoswkjyt/config/auth

# Response shape (excerpt; many other fields):
{
  "site_url": "<current>",
  "uri_allow_list": "<current — comma-separated string>",
  "external_google_enabled": <bool>,
  "external_google_client_id": "<current>",
  "smtp_*": ...
}

# WRITE (PATCH — partial update; unspecified fields untouched):
curl -X PATCH \
  -H "Authorization: Bearer $(cat ~/.supabase-token)" \
  -H "Content-Type: application/json" \
  https://api.supabase.com/v1/projects/swyfhpgerzvvmoswkjyt/config/auth \
  -d '{
    "site_url": "https://digswap.com.br",
    "uri_allow_list": "<preserved existing entries>,https://digswap.com.br/**",
    "external_google_enabled": true,
    "external_google_client_id": "<from Google Cloud Console>",
    "external_google_secret": "<from Google Cloud Console>"
  }'
```

CRITICAL — the `uri_allow_list` field is a **comma-separated string**, NOT an array. Preserve existing entries by reading first, splitting on comma, appending new entry, joining back. (See Pitfall: clobbering an existing dev-tunnel URL by overwriting blindly.)

Google OAuth callback URI (LOCKED per Phase 34 project ref): `https://swyfhpgerzvvmoswkjyt.supabase.co/auth/v1/callback`
</interfaces>

<!-- Pitfall reminder (P7 — RESEARCH §"Pitfall P7"): If the Google client lists localhost as a redirect URI, dev OAuth flows will leak prod tokens. D-06 mandates a NEW client. Authorized JavaScript origins = `https://digswap.com.br` EXACTLY (no path, no trailing slash — Google rejects either). -->
<!-- Pitfall reminder (uri_allow_list clobber): The Supabase API field is a comma-separated string. PATCHing with just `https://digswap.com.br/**` would WIPE any pre-existing entries. Always READ first, APPEND, WRITE. -->

</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1.1: User creates new Google OAuth 2.0 Web Client (prod-only) and shares credentials — checkpoint</name>
  <files>
    .planning/phases/037-external-integrations/evidence/01-google-oauth-creds.md
  </files>
  <read_first>
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Pitfall P7" (URI exactness — origin no trailing slash; redirect URI exactly Supabase's)
    - .planning/phases/037-external-integrations/037-CONTEXT.md D-06 (NEW prod client, NOT reuse of dev)
  </read_first>
  <action>
    INSTRUCTIONS TO USER (paste into chat as a checkpoint):

    1. Open https://console.cloud.google.com (use the same Google account that owns the dev OAuth client — sócio access can be added later via D-17 single-owner pattern).

    2. Top-bar dropdown → select project. If a "DigSwap Prod" project exists, use it; otherwise click "New Project":
       - Project name: `DigSwap Production`
       - Click Create, wait ~30s, switch to it

    3. Left nav: APIs & Services → OAuth consent screen.
       - If prompted "User Type": choose `External` → Create
       - App name: `DigSwap`
       - User support email: thiagobraidatto@gmail.com
       - App domain: `https://digswap.com.br`
       - Authorized domains: add `digswap.com.br`
       - Developer contact: thiagobraidatto@gmail.com
       - Save and continue. Skip scope additions (default OAuth scopes are fine for Supabase). Save.

    4. Left nav: APIs & Services → Credentials → "+ Create Credentials" → "OAuth client ID":
       - **Application type**: `Web application`
       - **Name**: `DigSwap Production`
       - **Authorized JavaScript origins** — add EXACTLY:
         ```
         https://digswap.com.br
         ```
         (NO path, NO trailing slash — Google rejects either; per Pitfall P7)
       - **Authorized redirect URIs** — add EXACTLY (and ONLY this):
         ```
         https://swyfhpgerzvvmoswkjyt.supabase.co/auth/v1/callback
         ```
         **DO NOT** add localhost. **DO NOT** add `https://digswap.com.br/api/auth/callback`. Per D-06, this client is prod-only and the only valid redirect target is the Supabase Auth callback.
       - Click Create.

    5. A modal shows `Client ID` (long string ending `.apps.googleusercontent.com`) and `Client secret` (alphanumeric ~24 chars). **Copy both NOW** — Client secret is shown only once after generation.

    6. Reply in chat with EXACTLY this format (Claude reads from chat — Client ID is not a secret per OAuth 2.0 design; secret IS — paste both, Claude will sanitize the secret in evidence):
       ```
       client_id: <PASTE_CLIENT_ID>.apps.googleusercontent.com
       client_secret: <PASTE_CLIENT_SECRET>
       ```

    Resume signal: chat reply containing `client_id:` and `client_secret:` lines.

    Then Claude:
    - Stores client_id + client_secret in shell vars (NOT in any file): `export GOOGLE_CID="..."; export GOOGLE_CSEC="..."`
    - Writes `evidence/01-google-oauth-creds.md` with:
      - Timestamp
      - Project name: `DigSwap Production`
      - Client ID (FULL VALUE — public per OAuth design, log it)
      - Client secret presence: `length=<len> chars; first 4 chars=<first4>***` (sanitized — DO NOT log full secret)
      - Authorized JS origins: `https://digswap.com.br`
      - Authorized redirect URIs: `https://swyfhpgerzvvmoswkjyt.supabase.co/auth/v1/callback`
      - Confirmation: dev OAuth client UNTOUCHED (D-06 pitfall mitigation)
  </action>
  <acceptance_criteria>
    - User has replied in chat with `client_id:` line and `client_secret:` line
    - `evidence/01-google-oauth-creds.md` exists, ≥20 lines
    - File contains literal strings: `digswap.com.br`, `swyfhpgerzvvmoswkjyt.supabase.co/auth/v1/callback`, `DigSwap Production`, `Client ID`
    - File contains the FULL client_id value (the `.apps.googleusercontent.com` suffix is grep-verifiable)
    - File DOES NOT contain the full client secret value (only `length=` + `first 4` markers)
    - Evidence explicitly states: dev OAuth client untouched
  </acceptance_criteria>
  <done>Prod Google OAuth client exists, credentials in shell session memory, evidence sanitized.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 1.2: PATCH Supabase Auth config — enable Google + set site_url + append to allow-list (preserve existing)</name>
  <files>
    .planning/phases/037-external-integrations/evidence/01-supabase-auth-config.json
    .planning/phases/037-external-integrations/evidence/01-allow-list.json
  </files>
  <read_first>
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Code Examples > Supabase Management API auth config update"
    - .planning/phases/037-external-integrations/037-CONTEXT.md D-08 (site_url + wildcard allow-list)
    - evidence/01-google-oauth-creds.md (just-created — to confirm client_id used in PATCH matches what was created)
  </read_first>
  <action>
    1. Read pre-state (this is the diff baseline):
       ```bash
       curl -sS \
         -H "Authorization: Bearer $(cat ~/.supabase-token)" \
         https://api.supabase.com/v1/projects/swyfhpgerzvvmoswkjyt/config/auth \
         > /tmp/auth-pre.json
       ```
       Confirm `jq -r '.site_url, .uri_allow_list, .external_google_enabled' /tmp/auth-pre.json` runs cleanly.

    2. Compute the new uri_allow_list — preserve any existing entries, append `https://digswap.com.br/**`:
       ```bash
       PRE_LIST=$(jq -r '.uri_allow_list // ""' /tmp/auth-pre.json)
       NEW_ENTRY="https://digswap.com.br/**"
       if echo "$PRE_LIST" | grep -q "$NEW_ENTRY"; then
         NEW_LIST="$PRE_LIST"
         echo "Allow-list already contains entry, no append needed"
       elif [ -z "$PRE_LIST" ]; then
         NEW_LIST="$NEW_ENTRY"
       else
         NEW_LIST="${PRE_LIST},${NEW_ENTRY}"
       fi
       echo "Pre  : $PRE_LIST"
       echo "Post : $NEW_LIST"
       ```

    3. PATCH Supabase Auth config (use $GOOGLE_CID and $GOOGLE_CSEC from shell session set in Task 1.1):
       ```bash
       curl -sS -X PATCH \
         -H "Authorization: Bearer $(cat ~/.supabase-token)" \
         -H "Content-Type: application/json" \
         https://api.supabase.com/v1/projects/swyfhpgerzvvmoswkjyt/config/auth \
         -d "$(jq -n \
           --arg site_url "https://digswap.com.br" \
           --arg allow_list "$NEW_LIST" \
           --arg cid "$GOOGLE_CID" \
           --arg csec "$GOOGLE_CSEC" \
           '{site_url: $site_url, uri_allow_list: $allow_list, external_google_enabled: true, external_google_client_id: $cid, external_google_secret: $csec}')" \
         > /tmp/auth-patch-resp.json
       echo "PATCH HTTP code:" $?
       cat /tmp/auth-patch-resp.json | jq '.'
       ```
       Expect: response body shows updated config with no `error` field (HTTP 200).

    4. Read post-state for diff:
       ```bash
       curl -sS \
         -H "Authorization: Bearer $(cat ~/.supabase-token)" \
         https://api.supabase.com/v1/projects/swyfhpgerzvvmoswkjyt/config/auth \
         > /tmp/auth-post.json
       ```

    5. Write `evidence/01-supabase-auth-config.json` containing pre/post diff (sanitize secret):
       ```bash
       jq -n \
         --slurpfile pre /tmp/auth-pre.json \
         --slurpfile post /tmp/auth-post.json \
         '{
           pre: ($pre[0] | {site_url, uri_allow_list, external_google_enabled, external_google_client_id, external_google_secret: (.external_google_secret // "" | if length > 0 then "<set; length=" + (length|tostring) + ">" else "<unset>" end)}),
           post: ($post[0] | {site_url, uri_allow_list, external_google_enabled, external_google_client_id, external_google_secret: (.external_google_secret // "" | if length > 0 then "<set; length=" + (length|tostring) + ">" else "<unset>" end)})
         }' \
         > .planning/phases/037-external-integrations/evidence/01-supabase-auth-config.json
       ```

    6. Write `evidence/01-allow-list.json` (DEP-INT-05 evidence):
       ```bash
       jq '{uri_allow_list: .uri_allow_list, contains_digswap_wildcard: (.uri_allow_list | contains("https://digswap.com.br/**"))}' \
         /tmp/auth-post.json \
         > .planning/phases/037-external-integrations/evidence/01-allow-list.json
       ```
  </action>
  <acceptance_criteria>
    - PATCH curl returned exit code 0 and `/tmp/auth-patch-resp.json` does NOT contain top-level `"error"` key (verify: `jq -e 'has("error") | not' /tmp/auth-patch-resp.json` returns true / exit 0)
    - `evidence/01-supabase-auth-config.json` exists, contains both `"pre"` and `"post"` top-level keys
    - `jq -r '.post.site_url' evidence/01-supabase-auth-config.json` returns `https://digswap.com.br`
    - `jq -r '.post.external_google_enabled' evidence/01-supabase-auth-config.json` returns `true`
    - `jq -r '.post.external_google_client_id' evidence/01-supabase-auth-config.json` ends with `.apps.googleusercontent.com`
    - `jq -r '.post.uri_allow_list' evidence/01-supabase-auth-config.json` contains `https://digswap.com.br/**`
    - `jq -r '.post.external_google_secret' evidence/01-supabase-auth-config.json` matches pattern `<set; length=N>` (NO RAW SECRET)
    - `evidence/01-allow-list.json` exists, contains key `contains_digswap_wildcard` with value `true`
    - **Allow-list preservation check:** if `jq -r '.pre.uri_allow_list' evidence/01-supabase-auth-config.json` was non-empty, then `jq -r '.post.uri_allow_list' evidence/01-supabase-auth-config.json` must contain ALL pre entries (verify by manual diff in evidence)
  </acceptance_criteria>
  <done>Supabase Auth config patched: Google enabled, site_url set to prod, allow-list extended with prod wildcard. Pre/post diff captured. DEP-INT-05 satisfied.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1.3: Manual UAT — Incognito Google sign-in click-through (DEP-INT-06 evidence)</name>
  <files>
    .planning/phases/037-external-integrations/evidence/01b-google-signin-test.md
  </files>
  <read_first>
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Pitfall P7" "Verification probe" sub-section
    - .planning/phases/037-external-integrations/037-CONTEXT.md (deferred items: OAuth click silent-fail UX is Phase 38, not 37 — this UAT is just "does flow complete?")
  </read_first>
  <action>
    INSTRUCTIONS TO USER (paste into chat as checkpoint):

    What was built (autonomously by Claude in Task 1.2): Supabase Auth now has Google enabled with the new prod OAuth client. site_url = `https://digswap.com.br`, allow-list contains `https://digswap.com.br/**`.

    How to verify (please do this — Phase 37 closes DEP-INT-06 only on successful click-through):

    1. Open a **fresh Incognito / Private** browser window (no cached Supabase session).
    2. Navigate to: https://digswap.com.br/signin
    3. Click "Continue with Google" (or whichever Google sign-in button shows in the social-login-buttons component).
    4. Observe:
       - **Expected (PASS)**: Google consent screen → click "Continue" with your Google account → redirect lands on `/onboarding` (first-time user) OR `/feed` (returning user). Page shows logged-in state (your avatar, navigation, etc.).
       - **FAIL: redirect_uri_mismatch** in browser console = Google client URI is wrong → re-check Task 1.1 step 4 (Authorized redirect URIs must be EXACTLY `https://swyfhpgerzvvmoswkjyt.supabase.co/auth/v1/callback`)
       - **FAIL: lands on `/signin?error=auth_callback_failed`** = exchange failed → check Supabase Auth provider config (Task 1.2 client_id/secret may have been pasted with whitespace — re-PATCH).
       - **Soft-fail (deferred to Phase 38)**: button doesn't visibly do anything (silent fail) — this is the D-16 carry-over (`OAuth click silent-fail UX`). Document but do NOT block; Phase 38 owns it.

    5. Reply with one of:
       - `approved — landed on /onboarding` (or `/feed`)
       - `approved — lands but UX is the silent-fail carry-over (D-16); flow completes server-side`
       - `failed: <browser console error>` → blocking, must fix before Wave 1 closes

    Resume signal: `approved — ...`

    Then Claude writes `evidence/01b-google-signin-test.md`:
    - Timestamp
    - Browser used (and that it was Incognito/Private)
    - Account email used (sanitized: `t****@gmail.com`)
    - Final URL after Google consent
    - Result: PASS or PASS-with-D-16-carryover or FAIL
    - If FAIL: full browser console error + remediation steps taken
    - Confirmation: this satisfies DEP-INT-06 (per VALIDATION.md row)
  </action>
  <acceptance_criteria>
    - User has replied `approved — landed on ...` (in any of the 2 acceptable forms)
    - `evidence/01b-google-signin-test.md` exists, ≥12 lines
    - File contains literal strings: `Incognito` (or `Private`), `digswap.com.br/signin`, a final URL containing `digswap.com.br`, `PASS` (or `PASS-with-D-16-carryover`)
    - File explicitly references DEP-INT-06
    - User account email sanitized (no full address — just first letter + masked)
  </acceptance_criteria>
  <done>Google OAuth flow verified end-to-end from prod URL. DEP-INT-06 satisfied. (D-16 silent-fail UX explicitly deferred to Phase 38 if observed.)</done>
</task>

<task type="auto" tdd="false">
  <name>Task 1.4: API probe — confirm allow-list contains digswap.com.br/** (DEP-INT-05 final probe)</name>
  <files>
    .planning/phases/037-external-integrations/evidence/01-allow-list.json
  </files>
  <read_first>
    - evidence/01-allow-list.json (already written by Task 1.2 — re-confirm post-flow it still holds)
    - .planning/phases/037-external-integrations/037-VALIDATION.md row DEP-INT-05
  </read_first>
  <action>
    Final post-everything probe (idempotent — re-reads Supabase config to confirm Task 1.2 PATCH is sticky and not been undone):
    ```bash
    curl -sS \
      -H "Authorization: Bearer $(cat ~/.supabase-token)" \
      https://api.supabase.com/v1/projects/swyfhpgerzvvmoswkjyt/config/auth \
      | jq '{uri_allow_list, contains_digswap_wildcard: (.uri_allow_list | contains("https://digswap.com.br/**")), site_url, external_google_enabled}' \
      > .planning/phases/037-external-integrations/evidence/01-allow-list.json
    ```

    Output must contain `"contains_digswap_wildcard": true`. If false, the PATCH was reverted (e.g., dashboard auto-reset) — re-run Task 1.2.
  </action>
  <acceptance_criteria>
    - `jq -r '.contains_digswap_wildcard' .planning/phases/037-external-integrations/evidence/01-allow-list.json` returns `true`
    - `jq -r '.site_url' .planning/phases/037-external-integrations/evidence/01-allow-list.json` returns `https://digswap.com.br`
    - `jq -r '.external_google_enabled' .planning/phases/037-external-integrations/evidence/01-allow-list.json` returns `true`
    - `jq -r '.uri_allow_list' .planning/phases/037-external-integrations/evidence/01-allow-list.json` contains `https://digswap.com.br/**`
  </acceptance_criteria>
  <done>Final probe confirms allow-list + site_url + Google-enabled state are all live. DEP-INT-05 satisfied.</done>
</task>

</tasks>

<verification>
After all 4 tasks:

1. **Evidence files exist:**
   ```bash
   ls .planning/phases/037-external-integrations/evidence/01-*
   # Expect: 01-google-oauth-creds.md, 01-supabase-auth-config.json, 01-allow-list.json, 01b-google-signin-test.md
   ```

2. **DEP-INT-05 probe:**
   ```bash
   jq -r '.contains_digswap_wildcard' .planning/phases/037-external-integrations/evidence/01-allow-list.json
   # true
   ```

3. **DEP-INT-06 evidence:**
   ```bash
   grep -c 'PASS' .planning/phases/037-external-integrations/evidence/01b-google-signin-test.md
   # ≥1
   ```

4. **No leaked secret:** `evidence/01-google-oauth-creds.md` does NOT contain a 24-char alphanumeric string matching `GOCSPX-[A-Za-z0-9_-]{20,}` (Google's client_secret prefix). Use:
   ```bash
   grep -E 'GOCSPX-[A-Za-z0-9_-]{20,}' .planning/phases/037-external-integrations/evidence/01-*  # exit 1 (no matches)
   ```

5. **Integration smoke:** `vercel env ls production --token "$(cat ~/.vercel-token)" | grep NEXT_PUBLIC_BILLING_ENABLED` (still `false` — Wave 1 doesn't touch this).
</verification>

<success_criteria>
- 4 evidence files exist with correct content
- DEP-INT-05 closed: Supabase allow-list contains `https://digswap.com.br/**` (verified via Management API GET)
- DEP-INT-06 closed: Google OAuth flow completes end-to-end from `https://digswap.com.br/signin` to `/onboarding` or `/feed` in Incognito (verified manually by user)
- New Google OAuth client created with EXACTLY one redirect URI (Supabase callback), EXACTLY one JS origin (apex no-trailing-slash) — Pitfall P7 mitigated
- Dev Google OAuth client UNTOUCHED (D-06 invariant)
- No client secret value leaked into any evidence file
- Existing uri_allow_list entries (if any) preserved by Task 1.2 (no clobber)
</success_criteria>

<output>
After completion, create `.planning/phases/037-external-integrations/037-01-SUMMARY.md` with sections:

1. **Frontmatter** (status: complete, wave: 1, requirements_addressed: [DEP-INT-05, DEP-INT-06])
2. **What this plan delivered** — 1-paragraph summary
3. **Tasks completed** — 4 tasks with status + commit refs
4. **Path deviations** (if any — e.g., uri_allow_list pre-existing entries that needed careful preservation)
5. **Google OAuth client artifacts** — Project name, client_id (full), JS origin, redirect URI, secret presence (sanitized)
6. **Supabase Auth config diff** — pre/post snapshot of site_url, uri_allow_list, external_google_*
7. **Manual UAT result** — pass/fail, browser, account masked
8. **Final verify** — DEP-INT-05 PASS + DEP-INT-06 PASS table
9. **Carry-overs flagged** — if D-16 silent-fail UX was observed during UAT, note for Phase 38
10. **Evidence inventory** — list of 4 files

Commit message: `docs(037-01): wire Google OAuth + Supabase allow-list (DEP-INT-05, DEP-INT-06)`
</output>
