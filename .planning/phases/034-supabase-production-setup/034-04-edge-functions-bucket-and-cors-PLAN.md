---
phase: 034-supabase-production-setup
plan: 04
type: execute
wave: 2
depends_on: ["034-02"]
files_modified:
  - .planning/phases/034-supabase-production-setup/evidence/07a-cleanup-deploy.log
  - .planning/phases/034-supabase-production-setup/evidence/07b-validate-deploy.log
  - .planning/phases/034-supabase-production-setup/evidence/07c-cleanup-curl.txt
  - .planning/phases/034-supabase-production-setup/evidence/07d-validate-curl.txt
  - .planning/phases/034-supabase-production-setup/evidence/09-bucket-state.txt
  - .planning/phases/034-supabase-production-setup/evidence/10-cors-dashboard.png
autonomous: false
requirements: [DEP-SB-04, DEP-SB-07]
requirements_addressed: [DEP-SB-04, DEP-SB-07]
gap_closure: false
must_haves:
  truths:
    - "Edge Function 'cleanup-trade-previews' is deployed to digswap-prod and returns HTTP 200 with body {\"deleted\":0,\"bucket\":\"trade-previews\",\"updated\":0} when invoked with a valid Bearer anon key"
    - "Edge Function 'validate-preview' is deployed to digswap-prod and returns HTTP 401 when invoked without a JWT (proves auth is enforced — security regression check)"
    - "Storage bucket 'trade-previews' exists with public=false (already enforced by migration 20260417, verified post-push)"
    - "Bucket CORS is hard-coded to ALLOW exactly two origins: https://digswap.com.br and https://www.digswap.com.br (NOT digswap.com)"
    - "48h TTL is satisfied by the existing 3-piece mechanism (preview_expires_at column + hourly cron + cleanup edge function) — no separate Storage lifecycle rule exists or is needed (Supabase Storage has no native lifecycle API)"
  artifacts:
    - path: ".planning/phases/034-supabase-production-setup/evidence/07a-cleanup-deploy.log"
      provides: "stdout of supabase functions deploy cleanup-trade-previews --project-ref $PROD_REF"
      contains: "cleanup-trade-previews"
    - path: ".planning/phases/034-supabase-production-setup/evidence/07b-validate-deploy.log"
      provides: "stdout of supabase functions deploy validate-preview --project-ref $PROD_REF"
      contains: "validate-preview"
    - path: ".planning/phases/034-supabase-production-setup/evidence/07c-cleanup-curl.txt"
      provides: "curl response (with HTTP status line) from POST /functions/v1/cleanup-trade-previews — proves deploy succeeded and Vault is wired"
      contains: "200"
    - path: ".planning/phases/034-supabase-production-setup/evidence/07d-validate-curl.txt"
      provides: "curl response from anon POST /functions/v1/validate-preview — proves auth is enforced (must be 401)"
      contains: "401"
    - path: ".planning/phases/034-supabase-production-setup/evidence/09-bucket-state.txt"
      provides: "psql output proving trade-previews bucket has public=false on prod"
      contains: "trade-previews"
    - path: ".planning/phases/034-supabase-production-setup/evidence/10-cors-dashboard.png"
      provides: "Dashboard screenshot of bucket CORS settings showing both digswap.com.br + www.digswap.com.br origins"
  key_links:
    - from: "supabase/functions/cleanup-trade-previews/index.ts"
      to: "POST https://<PROD_REF>.supabase.co/functions/v1/cleanup-trade-previews"
      via: "supabase functions deploy"
      pattern: "functions/v1/cleanup-trade-previews"
    - from: "supabase/functions/validate-preview/index.ts"
      to: "POST https://<PROD_REF>.supabase.co/functions/v1/validate-preview"
      via: "supabase functions deploy"
      pattern: "functions/v1/validate-preview"
    - from: "Browser at https://digswap.com.br"
      to: "Storage bucket trade-previews"
      via: "CORS Allowed-Origin header"
      pattern: "digswap\\.com\\.br"
---

<objective>
Deploy both Edge Functions (`cleanup-trade-previews`, `validate-preview`) to digswap-prod, smoke-test their invocability via curl, verify the `trade-previews` Storage bucket exists with `public=false` (already enforced by migration 20260417), and configure bucket CORS to hard-code the two production origins (`https://digswap.com.br` + `https://www.digswap.com.br`) — NOT `digswap.com` and NOT any `*.vercel.app` URL.

Purpose: DEP-SB-04 (functions) and DEP-SB-07 (bucket+CORS) are independent of the Vault+cron path covered by Plan 03 — they operate on the Supabase project surface (functions runtime + Storage configuration), not the database. They can run in parallel with Plan 03 to compress the Wave 2 wallclock.

Critical constraint: CORS origin is HARD-CODED to `digswap.com.br` per CONTEXT D-07 (NOT `digswap.com` — that domain is doc-debt and not real). Any `*.vercel.app` testing will intentionally fail CORS — that's the security posture forcing all real upload flows through the official domain.

Output: 6 evidence artifacts (2 deploy logs + 2 curl captures + 1 bucket-state text + 1 CORS dashboard screenshot). No app code changes. No new migrations. No `supabase secrets set` calls (the 2 functions only reference auto-injected env vars).
</objective>

<execution_context>
@C:\Users\INTEL\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\INTEL\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/phases/034-supabase-production-setup/034-CONTEXT.md
@.planning/phases/034-supabase-production-setup/034-RESEARCH.md
@.planning/phases/034-supabase-production-setup/034-VALIDATION.md
@.planning/phases/034-supabase-production-setup/034-02-SUMMARY.md
@supabase/functions/cleanup-trade-previews/index.ts
@supabase/functions/validate-preview/index.ts
@supabase/migrations/20260417_trade_preview_infrastructure.sql
</context>

<interfaces>
Edge Function contracts (extracted from `supabase/functions/*/index.ts`):

**cleanup-trade-previews** — `supabase/functions/cleanup-trade-previews/index.ts`:
- Method: POST
- Auth: Bearer with anon publishable key (the function itself uses `SUPABASE_SERVICE_ROLE_KEY` auto-injected by the Edge runtime to perform privileged Storage deletes).
- Request body shape: `{ source: string, bucket: string }` — Phase 34 smoke uses `{"source":"phase-34-smoke","bucket":"trade-previews"}`.
- Success response: HTTP 200, body `{"deleted":0,"bucket":"trade-previews","updated":0}` when there are no expired preview rows yet (fresh prod).

**validate-preview** — `supabase/functions/validate-preview/index.ts`:
- Method: POST
- Auth: real user JWT required. Anon requests are rejected.
- Anon response (Phase 34 smoke): HTTP 401, body `{"valid":false,"errors":["Missing bearer token."]}`.

**Storage bucket** — created by `supabase/migrations/20260417_trade_preview_infrastructure.sql:39-68`:
- ID + name: `trade-previews`
- `public = false` (enforced via `ON CONFLICT DO UPDATE SET public = EXCLUDED.public`)
- `file_size_limit = 536870912` (512 MB)
- `allowed_mime_types`: array set in the migration

**CORS configuration shape (from RESEARCH.md §8 L466-L477):**
- `allowedOrigins`: `["https://digswap.com.br", "https://www.digswap.com.br"]`  ← exactly 2, hard-coded
- `allowedMethods`: `["GET", "POST", "PUT", "DELETE", "OPTIONS"]`
- `allowedHeaders`: `["Authorization", "Content-Type", "x-upsert", "x-supabase-api-version"]`
- `maxAgeSeconds`: 3600
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Deploy both Edge Functions and capture deploy logs</name>
  <files>
    .planning/phases/034-supabase-production-setup/evidence/07a-cleanup-deploy.log,
    .planning/phases/034-supabase-production-setup/evidence/07b-validate-deploy.log
  </files>
  <read_first>
    - 034-RESEARCH.md §5 (L307-L347) — Edge Function deploy syntax + env var auto-injection rationale
    - 034-RESEARCH.md §10 row "Edge Function deploy fails" (L540) — halt-on-fail: re-run is safe, deploys are independent of DB state
    - supabase/functions/cleanup-trade-previews/index.ts (lines 5-6) — confirms only SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are needed (both auto-injected)
    - supabase/functions/validate-preview/index.ts (lines 9-10) — same env contract
  </read_first>
  <action>
    Deploy each function in turn, capturing stdout+stderr to a dedicated log file.

    **Pre-flight (Pitfall #4 protection):**
    - `[ "$(cat supabase/.temp/project-ref)" = "$PROD_REF" ]` — abort if linked ref drifted from PROD_REF since Plan 02.
    - `[ "$(cat supabase/.temp/project-ref)" != "mrkgoucqcbqjhrdjcnpw" ]` — abort if linked to dev.

    **Deploy commands (run from repo root):**

    1. `supabase functions deploy cleanup-trade-previews --project-ref "$PROD_REF" 2>&1 | tee .planning/phases/034-supabase-production-setup/evidence/07a-cleanup-deploy.log`

    2. `supabase functions deploy validate-preview --project-ref "$PROD_REF" 2>&1 | tee .planning/phases/034-supabase-production-setup/evidence/07b-validate-deploy.log`

    **Hard assertions:**
    - Both files exist and are non-empty (`test -s ...`).
    - Both files contain the function name (`grep -q cleanup-trade-previews 07a...` and `grep -q validate-preview 07b...`).
    - Neither file contains the word `error` at the end (allow it inside informational lines, but not in the final summary). A simple safety check: `! tail -3 07a-cleanup-deploy.log | grep -qi 'error\|failed'`.

    **DO NOT:**
    - Use `supabase secrets set` for SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — those are auto-injected by the Edge runtime (RESEARCH.md §5 L318). `supabase secrets set` is for custom env vars, which neither function uses.
    - Edit the function source code (`supabase/functions/*/index.ts`) — those files are already implemented and shipped from Phase 17 / 25 lineage. Phase 34 only deploys what exists.
    - Pre-create the function via Dashboard — `supabase functions deploy` creates and updates via API.

    **Halt-on-fail (per RESEARCH.md §10 row MEDIUM):**
    - Build error: read the log, fix the function source if it's a syntax error, redeploy.
    - Runtime error 5xx (likely SUPABASE_SERVICE_ROLE_KEY not yet propagated): wait 60s, re-run deploy. Function deploys are independent of DB state — safe to retry without touching migrations.
  </action>
  <verify>
    <automated>test -s .planning/phases/034-supabase-production-setup/evidence/07a-cleanup-deploy.log &amp;&amp; test -s .planning/phases/034-supabase-production-setup/evidence/07b-validate-deploy.log &amp;&amp; grep -q 'cleanup-trade-previews' .planning/phases/034-supabase-production-setup/evidence/07a-cleanup-deploy.log &amp;&amp; grep -q 'validate-preview' .planning/phases/034-supabase-production-setup/evidence/07b-validate-deploy.log</automated>
  </verify>
  <acceptance_criteria>
    - File `evidence/07a-cleanup-deploy.log` exists, size > 0, contains the literal string `cleanup-trade-previews`.
    - File `evidence/07b-validate-deploy.log` exists, size > 0, contains the literal string `validate-preview`.
    - Neither file's last 3 lines contain `error` or `failed` (case-insensitive) — `tail -3 ... | grep -qi 'error\|failed'` returns false.
    - `cat supabase/.temp/project-ref` still equals PROD_REF (link did not drift).
    - No `supabase secrets set` invocation appears in shell history for this task (deploy log alone — env vars are auto-injected).
  </acceptance_criteria>
  <done>
    Both Edge Functions deployed to digswap-prod and ready to be smoke-tested in Task 2.
  </done>
</task>

<task type="auto">
  <name>Task 2: Smoke-test both Edge Functions via curl + capture HTTP responses</name>
  <files>
    .planning/phases/034-supabase-production-setup/evidence/07c-cleanup-curl.txt,
    .planning/phases/034-supabase-production-setup/evidence/07d-validate-curl.txt
  </files>
  <read_first>
    - 034-RESEARCH.md §5 (L320-L344) — exact curl invocations + expected status/body
    - supabase/functions/cleanup-trade-previews/index.ts — the function reads `bucket` from request body and queries trade_proposal_items WHERE preview_expires_at <= NOW()
    - supabase/functions/validate-preview/index.ts — auth-required entry point, returns 401 + JSON error when bearer token is missing
  </read_first>
  <action>
    Invoke each function via curl and capture status line + body to dedicated text files. Both PROD_REF and PROD_ANON_KEY must be in env (re-prompt if a fresh shell).

    **Smoke 1 — `cleanup-trade-previews` (expect HTTP 200):**

    ```
    curl -i -X POST "https://${PROD_REF}.supabase.co/functions/v1/cleanup-trade-previews" \
      -H "Authorization: Bearer ${PROD_ANON_KEY}" \
      -H "Content-Type: application/json" \
      -d '{"source":"phase-34-smoke","bucket":"trade-previews"}' \
      2>&1 | tee .planning/phases/034-supabase-production-setup/evidence/07c-cleanup-curl.txt
    ```

    Expected first line of response: `HTTP/2 200` (or `HTTP/1.1 200 OK`). Expected JSON body: `{"deleted":0,"bucket":"trade-previews","updated":0}` — zero deletes on a fresh prod with no preview rows yet.

    **Smoke 2 — `validate-preview` (expect HTTP 401, security regression check):**

    ```
    curl -i -X POST "https://${PROD_REF}.supabase.co/functions/v1/validate-preview" \
      -H "Content-Type: application/json" \
      -d '{}' \
      2>&1 | tee .planning/phases/034-supabase-production-setup/evidence/07d-validate-curl.txt
    ```

    Expected first line: `HTTP/2 401` (or `HTTP/1.1 401 Unauthorized`). Expected body: `{"valid":false,"errors":["Missing bearer token."]}`.

    **Why this 401 matters:** A 200 here means auth is bypassed → security regression → ABORT and halt per RESEARCH.md §10 row HIGH. A 404 means the function is not actually deployed → re-run Task 1.

    **Hard assertions (parsing the captured files):**
    - `grep -qE '^HTTP/[12](\.[01])? 200' .planning/phases/034-supabase-production-setup/evidence/07c-cleanup-curl.txt` (or grep `200 OK`).
    - `grep -q '"deleted":0' .planning/phases/034-supabase-production-setup/evidence/07c-cleanup-curl.txt` AND `grep -q '"bucket":"trade-previews"' .planning/phases/034-supabase-production-setup/evidence/07c-cleanup-curl.txt`.
    - `grep -qE '^HTTP/[12](\.[01])? 401' .planning/phases/034-supabase-production-setup/evidence/07d-validate-curl.txt`.
    - `grep -q '"valid":false' .planning/phases/034-supabase-production-setup/evidence/07d-validate-curl.txt` (proves the function ran and returned its expected anon-rejection JSON, not a generic 401).

    **DO NOT:**
    - Pass `PROD_ANON_KEY` to the validate-preview smoke — the test specifically asserts that anon (no auth) is rejected. Adding a key would make the smoke pass for the wrong reason.
    - Use service_role for any of these smokes — the production curl must use the same anon key the browser would send (Pitfall #5 spirit).
  </action>
  <verify>
    <automated>test -s .planning/phases/034-supabase-production-setup/evidence/07c-cleanup-curl.txt &amp;&amp; test -s .planning/phases/034-supabase-production-setup/evidence/07d-validate-curl.txt &amp;&amp; grep -qE '(HTTP/[12](\.[01])? 200|^200)' .planning/phases/034-supabase-production-setup/evidence/07c-cleanup-curl.txt &amp;&amp; grep -q '"deleted":0' .planning/phases/034-supabase-production-setup/evidence/07c-cleanup-curl.txt &amp;&amp; grep -qE '(HTTP/[12](\.[01])? 401|^401)' .planning/phases/034-supabase-production-setup/evidence/07d-validate-curl.txt</automated>
  </verify>
  <acceptance_criteria>
    - File `evidence/07c-cleanup-curl.txt` exists, size > 0, contains an HTTP 200 status line AND the literal string `"deleted":0` AND `"bucket":"trade-previews"`.
    - File `evidence/07d-validate-curl.txt` exists, size > 0, contains an HTTP 401 status line AND the literal string `"valid":false`.
    - Neither file contains `HTTP/2 5` (5xx) on the status line of the primary response.
    - The cleanup-trade-previews curl was called WITH a Bearer header (proves we tested the auth-required path), and the validate-preview curl was called WITHOUT a Bearer header (proves we tested the anon-rejection path).
  </acceptance_criteria>
  <done>
    DEP-SB-04 satisfied: both Edge Functions are deployed AND invocable AND auth-correct (cleanup admits anon-with-key for cron-callback parity; validate rejects anon).
  </done>
</task>

<task type="auto">
  <name>Task 3: Verify trade-previews bucket exists with public=false</name>
  <files>
    .planning/phases/034-supabase-production-setup/evidence/09-bucket-state.txt
  </files>
  <read_first>
    - 034-RESEARCH.md §8 (L450-L460) — bucket creation already in migration 20260417, confirms public=false enforced via ON CONFLICT DO UPDATE
    - 034-RESEARCH.md §"Common Pitfalls" Pitfall 6 (L711-L714) — Pitfall #20: bucket Public default flipped at creation
    - supabase/migrations/20260417_trade_preview_infrastructure.sql lines 39-68 — exact INSERT INTO storage.buckets statement
  </read_first>
  <action>
    Run a single psql query against `storage.buckets` to capture the trade-previews row and prove `public=false`. The bucket itself already exists post-Plan-02 because migration 20260417 creates it.

    **Run (PROD_DIRECT_URL still in env from prior plans, port 5432):**

    ```
    psql "$PROD_DIRECT_URL" -c \
      "SELECT id, name, public, file_size_limit, created_at FROM storage.buckets WHERE id='trade-previews';" \
      2>&1 | tee .planning/phases/034-supabase-production-setup/evidence/09-bucket-state.txt
    ```

    **Hard assertions:**
    - File contains the literal string `trade-previews`.
    - `psql -At -c "SELECT public::text FROM storage.buckets WHERE id='trade-previews'"` returns exactly `false` (NOT `true`, NOT `t`, NOT empty).
    - `psql -At -c "SELECT file_size_limit FROM storage.buckets WHERE id='trade-previews'"` returns `536870912` (512 MB, per migration).

    **If `public=true`:** HALT — Pitfall #20 fired. Either someone toggled the bucket public via Dashboard between Plan 02 and now, OR migration 20260417 did not run with `ON CONFLICT DO UPDATE SET public = EXCLUDED.public`. Re-run Plan 02 (`supabase db push --linked`) — the migration is idempotent and resets `public=false`.

    **If the row does not exist at all:** Plan 02 did not actually push migration 20260417. Re-run Plan 02 from the top.

    **DO NOT:**
    - Toggle the bucket public/private via Dashboard. The migration owns the value.
    - Modify `storage.buckets` rows by hand. The migration is the source of truth.
  </action>
  <verify>
    <automated>test -s .planning/phases/034-supabase-production-setup/evidence/09-bucket-state.txt &amp;&amp; grep -q 'trade-previews' .planning/phases/034-supabase-production-setup/evidence/09-bucket-state.txt &amp;&amp; grep -qE '\| f( |$)|\|false' .planning/phases/034-supabase-production-setup/evidence/09-bucket-state.txt</automated>
  </verify>
  <acceptance_criteria>
    - File `evidence/09-bucket-state.txt` exists, size > 0, contains the literal string `trade-previews`.
    - File reflects `public=false` — psql tabular output shows ` f ` in the public column (psql `false` rendering) OR the file contains the literal `false`.
    - Live query `SELECT public::text FROM storage.buckets WHERE id='trade-previews'` returns exactly `false`.
    - Live query `SELECT file_size_limit FROM storage.buckets WHERE id='trade-previews'` returns `536870912`.
  </acceptance_criteria>
  <done>
    DEP-SB-07 partial satisfied: bucket exists, public=false. CORS still pending — Task 4.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: USER configures bucket CORS via Dashboard + captures screenshot</name>
  <read_first>
    - 034-RESEARCH.md §8 (L462-L478) — Dashboard CORS path + exact JSON shape (preferred over CLI which is MEDIUM confidence)
    - 034-CONTEXT.md D-07 (lines 41) — origins HARD-CODED to digswap.com.br + www.digswap.com.br
    - 034-VALIDATION.md L77 — manual-only verification rationale
  </read_first>
  <what-built>
    Edge Functions are deployed (Tasks 1-2). Bucket exists with public=false (Task 3). The remaining DEP-SB-07 piece is CORS configuration. CLI confidence is MEDIUM (RESEARCH.md L478 — community-reported edge cases) so the dashboard is the primary path. Screenshot is the only evidence form available because no API can dump CORS state.
  </what-built>
  <how-to-verify>
    **Step 1 — Navigate to bucket CORS settings in Dashboard:**

    1. Open https://supabase.com/dashboard/project/$PROD_REF/storage/buckets/trade-previews in a browser.
    2. Click the **Configuration** tab (or the gear icon → Configuration).
    3. Scroll to the **CORS** section.

    **Step 2 — Configure exactly these values (NO `digswap.com`, NO wildcards, NO `*.vercel.app`):**

    - **Allowed origins** (one entry per line OR comma-separated, depending on UI):
      - `https://digswap.com.br`
      - `https://www.digswap.com.br`
    - **Allowed methods** (check these 5):
      - `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`
    - **Allowed headers** (one per line OR comma-separated):
      - `Authorization`
      - `Content-Type`
      - `x-upsert`
      - `x-supabase-api-version`
    - **Max age** (seconds): `3600`
    - **Exposed headers**: leave blank (default).

    **Step 3 — Save.** Click the save/apply button. Wait for the success toast/confirmation.

    **Step 4 — Take screenshot:**

    1. Take a screenshot of the CORS section showing the configured rules. Make sure both origins are visible in the screenshot AND the Save confirmation/toast is visible (or capture immediately after save).
    2. Save to `.planning/phases/034-supabase-production-setup/evidence/10-cors-dashboard.png`. File size MUST be > 10 KB.

    **Step 5 — Sanity proof (optional but cheap):**

    From a terminal, attempt a CORS preflight from a fake origin (NOT `digswap.com.br`) to prove CORS is being enforced:

    ```
    curl -i -X OPTIONS "https://${PROD_REF}.supabase.co/storage/v1/object/trade-previews/test.bin" \
      -H "Origin: https://malicious.example.com" \
      -H "Access-Control-Request-Method: PUT"
    ```

    Expected: response either lacks `Access-Control-Allow-Origin` or sets it to NOT include `https://malicious.example.com`. (No need to capture this — it's a sanity-only step.)

    **Halt-on-fail (per RESEARCH.md §10 row LOW for CORS):**
    - Dashboard fails to save: retry. If persistent, fall back to CLI per RESEARCH.md §8 L466-L477 — `supabase storage update-bucket-cors` with the same JSON shape. Capture both attempts.
    - Save succeeds but screenshot file size < 10 KB: re-screenshot at higher resolution.

    **CRITICAL — DO NOT:**
    - Add `https://digswap.com` to allowed origins. The real domain is `.com.br`. Doc-debt-debt is being cleaned up in a separate QUICK after Phase 34.
    - Add `https://*.vercel.app` to allowed origins. CONTEXT D-07 explicitly says any pre-cutover testing from vercel.app URLs SHOULD fail CORS — this is intentional security posture.
    - Add `*` (wildcard) to allowed origins. That defeats the entire purpose of D-07.
  </how-to-verify>
  <resume-signal>
    Reply with "approved" once `evidence/10-cors-dashboard.png` is saved AND both `https://digswap.com.br` + `https://www.digswap.com.br` are visible in the screenshot. If the dashboard rejected the save, attach the error and we'll fall back to CLI.
  </resume-signal>
  <acceptance_criteria>
    - File `.planning/phases/034-supabase-production-setup/evidence/10-cors-dashboard.png` exists.
    - `stat` reports the file is a regular file with size > 10 KB.
    - User confirmation in resume signal explicitly mentions both `https://digswap.com.br` AND `https://www.digswap.com.br` (proves both origins were entered, not just one).
    - User confirmation does NOT mention `digswap.com` (no .br) or `*.vercel.app` or wildcard `*` — those are forbidden per D-07.
  </acceptance_criteria>
</task>

</tasks>

<verification>
- [ ] All 6 evidence files exist and are non-empty: `07a-cleanup-deploy.log`, `07b-validate-deploy.log`, `07c-cleanup-curl.txt`, `07d-validate-curl.txt`, `09-bucket-state.txt`, `10-cors-dashboard.png` (>10 KB).
- [ ] cleanup-trade-previews curl returned HTTP 200 with body `{"deleted":0,...}`.
- [ ] validate-preview curl returned HTTP 401 with body `{"valid":false,...}`.
- [ ] `psql -At -c "SELECT public::text FROM storage.buckets WHERE id='trade-previews'"` returns `false`.
- [ ] CORS screenshot shows BOTH `https://digswap.com.br` AND `https://www.digswap.com.br`, no other origins.
- [ ] No `supabase secrets set` was run (env vars are auto-injected).
- [ ] No `supabase functions deploy` was run against the dev project ref.
</verification>

<success_criteria>
- DEP-SB-04: both Edge Functions deployed, both invocable, both auth-correct (cleanup admits anon+key, validate rejects anon).
- DEP-SB-07: bucket exists, public=false, CORS hard-coded to the two production origins.
- 48h TTL: satisfied by the 3-piece mechanism (preview_expires_at column from migration + hourly trade-preview-cleanup cron from Plan 03 Task 2 + cleanup-trade-previews edge function from Task 1). RESEARCH.md §8 L482-L492 confirms there is no separate Storage lifecycle to add.
</success_criteria>

<output>
After completion, create `.planning/phases/034-supabase-production-setup/034-04-SUMMARY.md` documenting:
- Both Edge Function URLs (`https://$PROD_REF.supabase.co/functions/v1/cleanup-trade-previews` + `.../validate-preview`).
- Curl smoke results: HTTP 200 + body for cleanup, HTTP 401 + body for validate.
- Bucket state: id, public flag, file_size_limit (cite from evidence/09).
- CORS allowed origins (cite from screenshot description, not the file itself).
- A note: "Plan 05 (DATABASE_URL doc + final verify.sh + phase SUMMARY) is now safe to start once Plan 03 also lands."
</output>
