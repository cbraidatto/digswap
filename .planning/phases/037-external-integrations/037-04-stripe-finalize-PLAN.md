---
phase: 037-external-integrations
plan: 04
type: execute
wave: 2
depends_on: ["037-00"]
files_modified:
  - .planning/phases/037-external-integrations/evidence/04-stripe-approval-confirm.md
  - .planning/phases/037-external-integrations/evidence/04-stripe-token-handling.md
  - .planning/phases/037-external-integrations/evidence/04-stripe-prices.md
  - .planning/phases/037-external-integrations/evidence/04-webhook-create.json
  - .planning/phases/037-external-integrations/evidence/04-vercel-atomic-swap.log
  - .planning/phases/037-external-integrations/evidence/04-redeploy-and-ping.md
  - .planning/phases/037-external-integrations/evidence/14-verify-final.txt
  - .planning/phases/037-external-integrations/037-SUMMARY.md
autonomous: false
requirements: [DEP-INT-01, DEP-INT-02, DEP-INT-03]
gap_closure: false
user_setup:
  - service: stripe-live
    why: "Live mode keys + Live Price IDs are only accessible after Stripe approves activation (1-3 business day SLA from Wave 0)"
    env_vars:
      - name: STRIPE_LIVE_SECRET_KEY
        source: "Stripe Dashboard (Live mode toggle ON) > Developers > API keys > sk_live_*"
    dashboard_config:
      - task: "Toggle dashboard to Live mode (after approval email)"
        location: "https://dashboard.stripe.com (top-left mode toggle)"
      - task: "Create 2 Live Prices matching existing test-mode price names (monthly + annual)"
        location: "https://dashboard.stripe.com/prices (Live mode)"

must_haves:
  truths:
    - "User has confirmed Stripe Live mode is activated (sk_live_ key visible in dashboard)"
    - "~/.stripe-live-token contains the sk_live_* secret, ASCII no-BOM, returns 200 from GET https://api.stripe.com/v1/account"
    - "Stripe Live mode has exactly one webhook endpoint at https://digswap.com.br/api/stripe/webhook subscribed to checkout.session.completed, customer.subscription.updated, customer.subscription.deleted, invoice.payment_failed"
    - "The 4 Stripe env vars (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PRICE_MONTHLY, NEXT_PUBLIC_STRIPE_PRICE_ANNUAL) AND the billing flag (NEXT_PUBLIC_BILLING_ENABLED) all flipped together in Vercel Production scope (atomic — single redeploy)"
    - "vercel env ls production for these 5 vars contains zero DEFERRED markers and NEXT_PUBLIC_BILLING_ENABLED=true"
    - "Test webhook ping (Stripe dashboard or stripe trigger CLI) returned 200 from Vercel runtime logs"
    - "evidence/14-verify-final.txt aggregator shows DEP-INT-01..08 = 8 PASS"
    - "037-SUMMARY.md exists with status: complete, requirements_addressed listing all 8 DEP-INT-NN"
  artifacts:
    - path: ".planning/phases/037-external-integrations/evidence/04-stripe-approval-confirm.md"
      provides: "User-attested Stripe Live activation timestamp and dashboard mode confirmation"
      min_lines: 10
    - path: ".planning/phases/037-external-integrations/evidence/04-stripe-token-handling.md"
      provides: "Sanitized record of ~/.stripe-live-token: file size, ASCII check, GET /v1/account probe HTTP 200"
      min_lines: 12
    - path: ".planning/phases/037-external-integrations/evidence/04-stripe-prices.md"
      provides: "2 Live Price IDs (price_*) — these are not secrets, log full values"
      min_lines: 14
    - path: ".planning/phases/037-external-integrations/evidence/04-webhook-create.json"
      provides: "POST /v1/webhook_endpoints request + response (sanitized: secret length only, full webhook id retained)"
      min_lines: 15
    - path: ".planning/phases/037-external-integrations/evidence/04-vercel-atomic-swap.log"
      provides: "Sequenced rm-then-add log for 5 env vars + git commit + push trigger"
      min_lines: 25
    - path: ".planning/phases/037-external-integrations/evidence/04-redeploy-and-ping.md"
      provides: "vercel inspect of new deploy (READY status), webhook ping result (200), Vercel runtime log excerpt"
      min_lines: 18
    - path: ".planning/phases/037-external-integrations/evidence/14-verify-final.txt"
      provides: "Single-pass aggregator: DEP-INT-01..08 PASS table"
      min_lines: 30
    - path: ".planning/phases/037-external-integrations/037-SUMMARY.md"
      provides: "Phase summary with frontmatter, plan summaries, all 8 requirements addressed, evidence inventory"
      min_lines: 80
  key_links:
    - from: "Stripe Live API (sk_live_*)"
      to: "Vercel Production STRIPE_SECRET_KEY"
      via: "Atomic vercel env rm + add --sensitive in same shell session as 4 other vars"
      pattern: "STRIPE_SECRET_KEY"
    - from: "Stripe Live webhook endpoint (whsec_live_*)"
      to: "Vercel Production STRIPE_WEBHOOK_SECRET"
      via: "Captured from POST /v1/webhook_endpoints response.secret field; piped into vercel env add"
      pattern: "whsec_"
    - from: "Live Price IDs (price_*)"
      to: "Vercel Production NEXT_PUBLIC_STRIPE_PRICE_MONTHLY + _ANNUAL"
      via: "User pastes; vercel env add (non-sensitive — these are public/client-visible)"
      pattern: "price_"
    - from: "NEXT_PUBLIC_BILLING_ENABLED=true"
      to: "Pricing page UI gate + /api/stripe/* route gate"
      via: "Module-load env read in apps/web/src/lib/env.ts publicSchema; redeploy required to flip"
      pattern: "NEXT_PUBLIC_BILLING_ENABLED"
    - from: "Vercel git push origin claude/...:main"
      to: "Production deploy READY status"
      via: "GitHub auto-deploy (Phase 35 evidence/06 — CLI deploy unreliable from worktree)"
      pattern: "githubDeployment"
---

<objective>
Finalize Stripe Live integration after the Wave 0 SLA timer expires (Stripe approval email lands): collect the sk_live_* secret + 2 Live Price IDs from the user, create the prod webhook endpoint via Stripe API (capturing the whsec_live_* in response), atomically swap 5 env vars (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_STRIPE_PRICE_MONTHLY, NEXT_PUBLIC_STRIPE_PRICE_ANNUAL, NEXT_PUBLIC_BILLING_ENABLED=false→true) in a single shell session, trigger a single git commit + push to drive ONE redeploy (Pitfall P21 atomicity), then ping the webhook and confirm 200 in Vercel runtime logs. Closes DEP-INT-01, DEP-INT-02, DEP-INT-03 and writes the phase aggregator + SUMMARY.

Purpose: This is the moment the v1.4 freemium engine becomes live. Wave 4 is the LAST wave because Stripe Live activation is the long-pole external dependency (CONTEXT D-13).

Output: 3 final requirements closed, 8 evidence files (6 plan-specific + 1 phase aggregator + 1 SUMMARY).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
<files_to_read>
- `.planning/phases/037-external-integrations/037-CONTEXT.md` D-01..D-04 (Stripe activation contract — same account, CPF, single webhook path, Phase 37 closes at webhook ping = 200; real $1 deferred to Phase 38), D-13 (Wave 4 atomic swap), D-14 (feature flag flips here), D-16 (Phase 36 carry-overs are NOT this phase's scope)
- `.planning/phases/037-external-integrations/037-RESEARCH.md` §"Pattern 1: Atomic Multi-Env-Var Swap" (full 5-var rm-then-add sequence), §"Pitfall P6" (single-secret env design — no code branching), §"Pitfall P21" (5-var atomic), §"Pitfall P-NEW-2" (Preview scope MUST NOT be touched), §"Code Examples > Stripe webhook endpoint creation", §"Code Examples > Webhook ping verification" + §"Open Questions" #4 (`stripe trigger` CLI fallback if dashboard test-button absent in Live mode)
- `.planning/phases/037-external-integrations/037-VALIDATION.md` rows DEP-INT-01..03 + §"Phase Gate"
- `.planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log` (rm-then-add CLI shape)
- `.planning/phases/035-vercel-environment-wiring/035-SUMMARY.md` §"Path deviations" #4 (CLI deploy unreliable from worktree → use `git push` to trigger GitHub auto-deploy)
- `.planning/phases/036-dns-ssl-cutover/036-SUMMARY.md` (production URL = `https://digswap.com.br`)
- `apps/web/src/app/api/stripe/webhook/route.ts` lines 16-23 + 304 + 324-338 (existing handler reads ONE env var via `getWebhookSecret()`; signature verification via `stripe.webhooks.constructEvent()`; switch over 4 event types — these are exactly what `enabled_events[]` in webhook creation must list)
- `apps/web/src/lib/env.ts` lines 23-30 (Zod min(10) on STRIPE_SECRET_KEY/WEBHOOK_SECRET in production — empty deploy fails fast)
- evidence/00-stripe-submit.md (Wave 0 submission timestamp — used to compute SLA elapsed)
</files_to_read>

<interfaces>
**Stripe webhook creation API** (RESEARCH §"Code Examples"):
```bash
curl https://api.stripe.com/v1/webhook_endpoints \
  -u "${STRIPE_LIVE_SECRET_KEY}:" \
  -d "url=https://digswap.com.br/api/stripe/webhook" \
  -d "description=DigSwap production webhook (Phase 37)" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=customer.subscription.updated" \
  -d "enabled_events[]=customer.subscription.deleted" \
  -d "enabled_events[]=invoice.payment_failed" \
  -d "api_version=2024-06-20"

# Response:
# {
#   "id": "we_<...>",
#   "secret": "whsec_<...>",        ← capture this — Vercel env value
#   "url": "https://digswap.com.br/api/stripe/webhook",
#   "enabled_events": [...],
#   ...
# }
```

**Atomic 5-var swap** (RESEARCH §"Pattern 1"):
```bash
set -e
VTOKEN="$(cat ~/.vercel-token)"
for K in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET NEXT_PUBLIC_STRIPE_PRICE_MONTHLY NEXT_PUBLIC_STRIPE_PRICE_ANNUAL NEXT_PUBLIC_BILLING_ENABLED; do
  vercel env rm "$K" production --yes --token "$VTOKEN" 2>&1 | tee -a /tmp/swap.log
done

printf %s "$STRIPE_LIVE_KEY"  | vercel env add STRIPE_SECRET_KEY production --sensitive --token "$VTOKEN"
printf %s "$WHSEC_LIVE"       | vercel env add STRIPE_WEBHOOK_SECRET production --sensitive --token "$VTOKEN"
printf %s "$PRICE_MONTHLY"    | vercel env add NEXT_PUBLIC_STRIPE_PRICE_MONTHLY production --token "$VTOKEN"
printf %s "$PRICE_ANNUAL"     | vercel env add NEXT_PUBLIC_STRIPE_PRICE_ANNUAL production --token "$VTOKEN"
printf %s "true"              | vercel env add NEXT_PUBLIC_BILLING_ENABLED production --token "$VTOKEN"

git commit --allow-empty -m "feat(037-04): activate Stripe Live + flip billing flag"
git push origin <current-branch>:main
```

**Webhook ping verification** (RESEARCH §"Open Questions" #4):
- Primary path: Stripe dashboard → Webhooks → endpoint → "Send test webhook" button (UI; works in Live mode for endpoints created via API per recent docs).
- Fallback if button absent: `stripe trigger checkout.session.completed --api-key sk_live_*` (Stripe CLI; user has it from prior phases per RESEARCH).
- Verification: tail Vercel runtime logs (Vercel MCP if available, or `vercel inspect <deploy_url> --logs --token "$(cat ~/.vercel-token)"` if MCP unloaded). Look for HTTP 200 in webhook handler response.
</interfaces>

<!-- Pitfall reminder (P21 — RESEARCH §"Pitfall P21"): All 5 vars MUST flip in single shell session + single git push + single redeploy. Partial swap = `sk_live_` paired with `whsec_test_` = signature verification fails on every webhook. The `set -e` halt-on-fail is critical. -->
<!-- Pitfall reminder (P6 — RESEARCH §"Pitfall P6"): Existing webhook handler at route.ts:16-23 reads ONE secret. NO test/live branching in code. Pitfall mitigated by env design. -->
<!-- Pitfall reminder (P-NEW-2 — RESEARCH §"Pitfall P-NEW-2"): The 5-var swap touches PRODUCTION ONLY. Preview scope keeps test/dummy values. After swap, audit Preview to confirm no `sk_live_` leaked. -->

</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 4.0: Gate check — confirm Stripe Live mode activated; halt + retry if not approved yet</name>
  <files>
    .planning/phases/037-external-integrations/evidence/04-stripe-approval-confirm.md
  </files>
  <read_first>
    - evidence/00-stripe-submit.md (Wave 0 submission timestamp + expected 1-3 business day SLA)
    - .planning/phases/037-external-integrations/037-CONTEXT.md D-15 (Phase 38 UAT requires Stripe Live operational; if delay > 3 BD, milestone slips)
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Pitfall P-NEW-1" (delay-blocks-milestone scenario)
  </read_first>
  <action>
    INSTRUCTIONS TO USER (paste into chat as a checkpoint):

    Wave 4 only proceeds AFTER Stripe Live mode is approved. From Wave 0, the SLA is 1-3 business days.

    1. Open https://dashboard.stripe.com.

    2. Top-left: confirm the dashboard mode toggle shows BOTH `Test mode` and `Live mode` options (pre-approval, only Test is available).

    3. Toggle to **Live mode**.

    4. Left nav → Developers → API keys.
       - Confirm you see a `Standard keys` section with:
         - Publishable key: `pk_live_*`
         - Secret key: `sk_live_*` (click "Reveal live key" — Stripe will require email/password re-auth or 2FA)

    5. If both are present and visible, Live mode is active. Proceed to step 6.

    6. **If activation is still pending** (Live mode toggle is disabled OR you see "Activate payments" CTAs):
       - Reply: `not yet — pending` → Wave 4 halts; Phase 38 UAT may need to start without Stripe (per CONTEXT D-14 feature flag protection)
       - The execution session can be resumed when approval lands

    7. **If activation is approved**:
       - Note the approval timestamp from the email Stripe sent (subject typically "Welcome to Stripe — your account is active" or similar).
       - Reply: `approved — activated <YYYY-MM-DD HH:MM TZ>` → Wave 4 continues

    Resume signal: `approved — activated ...`

    Then Claude writes `evidence/04-stripe-approval-confirm.md`:
    - Submission → approval elapsed time (computed from evidence/00-stripe-submit.md timestamp vs user-reported approval timestamp)
    - Activation timestamp (UTC + user TZ)
    - Confirmation: dashboard shows pk_live_* and sk_live_*
    - Confirmation: Live mode toggle is active
    - **NO secret key value** logged (only existence confirmed)
  </action>
  <acceptance_criteria>
    - User has replied either `approved — activated ...` (Wave 4 continues) OR `not yet — pending` (Wave 4 halts cleanly)
    - If approved: `evidence/04-stripe-approval-confirm.md` exists, ≥10 lines
    - File contains literal strings: `Live mode`, `sk_live_`, `pk_live_`, an approval timestamp pattern
    - File DOES NOT contain a value matching `sk_live_[A-Za-z0-9]{20,}` (no key value)
    - File computes elapsed time vs Wave 0 submission (e.g., `Elapsed SLA: 2 business days`)
  </acceptance_criteria>
  <done>Stripe Live activated; Wave 4 cleared to proceed (or halted with clean state if not).</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 4.1: User pastes sk_live_* secret to ~/.stripe-live-token (one-shot, ASCII no-BOM) — checkpoint</name>
  <files>
    .planning/phases/037-external-integrations/evidence/04-stripe-token-handling.md
  </files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/evidence/00-token-handling.md (printf %s pattern)
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Wave 0 Gaps" "(~/.stripe-live-token created Wave 4 from Stripe dashboard, NOT before — Live keys don't exist until activation)"
  </read_first>
  <action>
    INSTRUCTIONS TO USER (paste into chat as checkpoint):

    1. In Stripe Dashboard (Live mode) → Developers → API keys.
    2. Click "Reveal live key" next to `Secret key`. Re-auth if Stripe prompts (email/password + possibly 2FA).
    3. Copy the full `sk_live_*` value.

    4. In git-bash at the repo root:
       ```bash
       printf %s "<PASTE>" > ~/.stripe-live-token
       chmod 600 ~/.stripe-live-token
       ```
       (Same `printf %s` rule — NO echo.)

    5. Verify the token works:
       ```bash
       curl -sS -o /dev/null -w '%{http_code}\n' \
         -u "$(cat ~/.stripe-live-token):" \
         https://api.stripe.com/v1/account
       ```
       Expect: `200`. If 401 — secret was pasted wrong (likely missing chars or whitespace). Rebuild the token file.

    6. Reply: `approved` (HTTP 200) or `issue: HTTP <N>`.

    Resume signal: `approved`

    Then Claude writes `evidence/04-stripe-token-handling.md`:
    - Timestamp
    - File size: `wc -c < ~/.stripe-live-token` (expect 50-110 bytes for sk_live_*)
    - ASCII check: `file ~/.stripe-live-token` (expect "ASCII text" no BOM)
    - First 7 chars confirmation: `head -c 7 ~/.stripe-live-token` outputs `sk_live` (NO trailing chars logged)
    - Probe HTTP code: `200`
    - **NO TOKEN VALUE** anywhere in evidence
  </action>
  <acceptance_criteria>
    - `test -f ~/.stripe-live-token` returns true
    - `wc -c < ~/.stripe-live-token` returns a number between 40 and 120
    - `head -c 7 ~/.stripe-live-token` outputs `sk_live` (Stripe Live secret prefix)
    - `curl -sS -o /dev/null -w '%{http_code}' -u "$(cat ~/.stripe-live-token):" https://api.stripe.com/v1/account` returns `200`
    - `evidence/04-stripe-token-handling.md` exists, ≥12 lines, contains literal strings `sk_live`, `200`, `ASCII`
    - File DOES NOT contain a value matching `sk_live_[A-Za-z0-9]{20,}`
  </acceptance_criteria>
  <done>Live secret token on disk, probe returns 200, evidence sanitized.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 4.2: User creates 2 Live Price IDs (monthly + annual) and shares both — checkpoint</name>
  <files>
    .planning/phases/037-external-integrations/evidence/04-stripe-prices.md
  </files>
  <read_first>
    - .planning/phases/037-external-integrations/037-RESEARCH.md row DEP-INT-03 (price_* prefix; mode-scoped — test prices invisible from Live API)
    - .planning/phases/037-external-integrations/037-CONTEXT.md D-04 (Live Price IDs in NEXT_PUBLIC_STRIPE_PRICE_MONTHLY/_ANNUAL)
  </read_first>
  <action>
    INSTRUCTIONS TO USER (paste into chat as checkpoint):

    Background: Stripe Prices are mode-scoped. The `price_*` IDs you created in Test mode are invisible from Live mode. You must create matching Live-mode Prices.

    1. In Stripe Dashboard (Live mode) → Products. (URL pattern: `dashboard.stripe.com/products` — NOT `dashboard.stripe.com/test/products`).
    2. If a `DigSwap Pro` (or whatever your product is named) Product does NOT exist in Live, create it:
       - Click "Add product"
       - Name: same as Test mode (e.g., `DigSwap Pro`)
       - Description: same as Test
       - Default price: skip (we'll create both monthly + annual prices below)
    3. For the Product, click "Add another price" → fill in **Monthly** price:
       - Pricing model: Standard / Recurring
       - Price: <same R$ amount as your Test mode monthly>
       - Billing period: Monthly
       - Currency: BRL
       - Click "Save price"
       - Copy the resulting `price_*` ID (visible on the price detail page; click the copy icon)
    4. Repeat for **Annual** price (Billing period: Yearly).
    5. Reply with EXACTLY this format (Price IDs are NOT secrets — they're public/client-side, log full):
       ```
       price_monthly_live: price_1...
       price_annual_live: price_1...
       ```

    Resume signal: chat reply containing both `price_*` lines.

    Then Claude:
    - Probes both via Stripe API to confirm they exist in Live mode and are non-test:
      ```bash
      for PID in $PRICE_MONTHLY $PRICE_ANNUAL; do
        curl -sS -o /tmp/price-$PID.json -w "$PID HTTP=%{http_code}\n" \
          -u "$(cat ~/.stripe-live-token):" \
          "https://api.stripe.com/v1/prices/$PID"
      done
      # Expect: HTTP 200 for both. The /v1/prices endpoint with sk_live_* returns 200 only for Live mode prices.
      ```
    - Writes `evidence/04-stripe-prices.md`:
      - Timestamp
      - Monthly price_id (full): price_*
      - Annual price_id (full): price_*
      - Probe results: GET /v1/prices/<id> with sk_live → 200 for both
      - Confirmation: prices are Live mode (test prices return 404 with sk_live)
      - Currency: BRL (or as configured)
      - Recurring intervals: monthly/yearly
  </action>
  <acceptance_criteria>
    - User has replied with `price_monthly_live:` and `price_annual_live:` lines
    - Both probes returned HTTP 200 (verifies the IDs are valid AND in Live mode)
    - `evidence/04-stripe-prices.md` exists, ≥14 lines
    - File contains both full `price_*` IDs (these are public, OK to log)
    - File contains literal strings: `Live mode`, `200`, `BRL` (or the currency in use)
    - Shell vars `$PRICE_MONTHLY` and `$PRICE_ANNUAL` set for Task 4.4
  </acceptance_criteria>
  <done>2 Live Price IDs captured + verified via Stripe API. Vars exported for atomic swap.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4.3: Create Stripe Live webhook endpoint via API; capture whsec_live_*</name>
  <files>
    .planning/phases/037-external-integrations/evidence/04-webhook-create.json
  </files>
  <read_first>
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Code Examples > Stripe webhook endpoint creation"
    - apps/web/src/app/api/stripe/webhook/route.ts lines 324-338 (the 4 event types in the handler's switch — these are EXACTLY what enabled_events[] must list)
    - evidence/04-stripe-token-handling.md (~/.stripe-live-token returns 200)
  </read_first>
  <action>
    1. Idempotency check — does a webhook for `https://digswap.com.br/api/stripe/webhook` already exist (e.g., from a prior partial Wave 4 attempt)?
       ```bash
       EXISTING=$(curl -sS -u "$(cat ~/.stripe-live-token):" \
         "https://api.stripe.com/v1/webhook_endpoints?limit=100" \
         | jq -r '.data[] | select(.url == "https://digswap.com.br/api/stripe/webhook") | .id')

       if [ -n "$EXISTING" ]; then
         echo "Webhook already exists: $EXISTING"
         echo "Note: existing webhook's secret cannot be re-revealed; if it's a remnant of a failed attempt, delete and recreate"
         echo "Decision: keep existing if you already have its whsec_, or delete-and-recreate to get a fresh one"
         # For Phase 37 cleanliness, delete and recreate so we capture a fresh secret in this evidence file:
         curl -sS -X DELETE -u "$(cat ~/.stripe-live-token):" "https://api.stripe.com/v1/webhook_endpoints/$EXISTING" > /tmp/wh-delete.json
       fi
       ```

    2. Create webhook (capture the secret in response):
       ```bash
       curl -sS https://api.stripe.com/v1/webhook_endpoints \
         -u "$(cat ~/.stripe-live-token):" \
         -d "url=https://digswap.com.br/api/stripe/webhook" \
         -d "description=DigSwap production webhook (Phase 37 Wave 4)" \
         -d "enabled_events[]=checkout.session.completed" \
         -d "enabled_events[]=customer.subscription.updated" \
         -d "enabled_events[]=customer.subscription.deleted" \
         -d "enabled_events[]=invoice.payment_failed" \
         -d "api_version=2024-06-20" \
         > /tmp/wh-create-resp.json

       cat /tmp/wh-create-resp.json | jq '{id, url, enabled_events, status, livemode, secret_present: (.secret | length > 0)}'
       ```

    3. Capture the secret into a shell var (ONE PLACE — never written to a file):
       ```bash
       export WHSEC_LIVE=$(jq -r '.secret' /tmp/wh-create-resp.json)
       export WEBHOOK_ID=$(jq -r '.id' /tmp/wh-create-resp.json)

       # Sanity check
       echo "$WHSEC_LIVE" | head -c 6  # expect "whsec_"
       echo "WEBHOOK_ID=$WEBHOOK_ID"
       ```
       If `$WHSEC_LIVE` is empty or doesn't start with `whsec_`, the API call failed — re-run.

    4. Persist evidence (sanitize secret to length-only):
       ```bash
       jq -n \
         --slurpfile resp /tmp/wh-create-resp.json \
         --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
         '{
           created_at: $ts,
           request: {
             method: "POST",
             url: "https://api.stripe.com/v1/webhook_endpoints",
             body: {
               url: "https://digswap.com.br/api/stripe/webhook",
               enabled_events: ["checkout.session.completed", "customer.subscription.updated", "customer.subscription.deleted", "invoice.payment_failed"],
               api_version: "2024-06-20"
             }
           },
           response_sanitized: ($resp[0] | {id, object, url, enabled_events, status, livemode, api_version, description, secret: (.secret // "" | "<set; prefix=whsec_; length=" + (length|tostring) + ">"), created}),
           expected_handler_match: "All 4 enabled_events match apps/web/src/app/api/stripe/webhook/route.ts switch statement (lines 324-338)"
         }' \
         > .planning/phases/037-external-integrations/evidence/04-webhook-create.json
       ```
  </action>
  <acceptance_criteria>
    - `evidence/04-webhook-create.json` exists, ≥15 lines, valid JSON
    - `jq -r '.response_sanitized.url' evidence/04-webhook-create.json` returns `https://digswap.com.br/api/stripe/webhook`
    - `jq -r '.response_sanitized.livemode' evidence/04-webhook-create.json` returns `true` (Live mode webhook, not test)
    - `jq -r '.response_sanitized.id' evidence/04-webhook-create.json` matches pattern `we_[A-Za-z0-9]+`
    - `jq '.response_sanitized.enabled_events | length' evidence/04-webhook-create.json` returns `4`
    - `jq -r '.response_sanitized.enabled_events[]' evidence/04-webhook-create.json | sort` lists EXACTLY: `checkout.session.completed`, `customer.subscription.deleted`, `customer.subscription.updated`, `invoice.payment_failed` (matches handler switch — Pitfall P6 design contract)
    - `jq -r '.response_sanitized.secret' evidence/04-webhook-create.json` matches pattern `<set; prefix=whsec_; length=N>`
    - Shell var `$WHSEC_LIVE` set + starts with `whsec_`
    - File DOES NOT contain a value matching `whsec_[A-Za-z0-9]{20,}` (sanitized)
  </acceptance_criteria>
  <done>Stripe Live webhook endpoint exists with 4 events matching handler. whsec_live_* captured in shell var.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4.4: Atomic 5-var Vercel swap + single git commit + push (drives single redeploy)</name>
  <files>
    .planning/phases/037-external-integrations/evidence/04-vercel-atomic-swap.log
  </files>
  <read_first>
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Pattern 1: Atomic Multi-Env-Var Swap" (full bash sequence + Pitfall P21 rationale)
    - .planning/phases/035-vercel-environment-wiring/035-SUMMARY.md §"Path deviations" #4 (CLI deploy unreliable from worktree → use git push)
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Pitfall P-NEW-2" (Preview scope MUST NOT be touched)
  </read_first>
  <action>
    1. Pre-swap audit (baseline):
       ```bash
       VTOKEN="$(cat ~/.vercel-token)"
       vercel env pull /tmp/env.pre --environment=production --token "$VTOKEN" --yes >/dev/null 2>&1
       {
         echo "=== Phase 37 Wave 4 — Pre-swap state ==="
         echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
         echo ""
         vercel env ls production --token "$VTOKEN" | grep -E '^[[:space:]]*(STRIPE_|NEXT_PUBLIC_STRIPE_|NEXT_PUBLIC_BILLING_)'
         echo ""
         echo "DEFERRED markers in Stripe vars + BILLING flag value pre-swap:"
         grep -E '^(STRIPE_(SECRET_KEY|WEBHOOK_SECRET)|NEXT_PUBLIC_STRIPE_PRICE_(MONTHLY|ANNUAL)|NEXT_PUBLIC_BILLING_ENABLED)=' /tmp/env.pre \
           | sed 's/=\(sk_live_\|whsec_\)[A-Za-z0-9_]\+/=<live-secret-redacted>/' \
           | sed 's/=\(price_\)[A-Za-z0-9]\+/=<price-id-redacted>/'
         rm -f /tmp/env.pre
       } > /tmp/swap-pre.log
       cat /tmp/swap-pre.log
       ```
       At this point, expect to see `STRIPE_SECRET_KEY=sk_live_DEFERRED_PHASE_37_NOT_FOR_USE`, etc., and `NEXT_PUBLIC_BILLING_ENABLED=false`.

    2. Atomic swap — single shell session, halt-on-fail:
       ```bash
       set -e
       VTOKEN="$(cat ~/.vercel-token)"
       STRIPE_KEY=$(cat ~/.stripe-live-token)

       # Echo a header into the log
       {
         echo ""
         echo "=== Atomic 5-var swap ==="
         echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
         echo ""
       } >> /tmp/swap-pre.log

       # Step 1: Remove all 5 (rm-then-add per Phase 35 idiom)
       for K in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET NEXT_PUBLIC_STRIPE_PRICE_MONTHLY NEXT_PUBLIC_STRIPE_PRICE_ANNUAL NEXT_PUBLIC_BILLING_ENABLED; do
         vercel env rm "$K" production --yes --token "$VTOKEN" 2>&1 | tee -a /tmp/swap-pre.log
       done

       # Step 2: Add fresh values (sensitive flag for secrets only)
       printf %s "$STRIPE_KEY"      | vercel env add STRIPE_SECRET_KEY production --sensitive --token "$VTOKEN" 2>&1 | tee -a /tmp/swap-pre.log
       printf %s "$WHSEC_LIVE"      | vercel env add STRIPE_WEBHOOK_SECRET production --sensitive --token "$VTOKEN" 2>&1 | tee -a /tmp/swap-pre.log
       printf %s "$PRICE_MONTHLY"   | vercel env add NEXT_PUBLIC_STRIPE_PRICE_MONTHLY production --token "$VTOKEN" 2>&1 | tee -a /tmp/swap-pre.log
       printf %s "$PRICE_ANNUAL"    | vercel env add NEXT_PUBLIC_STRIPE_PRICE_ANNUAL production --token "$VTOKEN" 2>&1 | tee -a /tmp/swap-pre.log
       printf %s "true"             | vercel env add NEXT_PUBLIC_BILLING_ENABLED production --token "$VTOKEN" 2>&1 | tee -a /tmp/swap-pre.log

       set +e
       ```

    3. Post-swap audit:
       ```bash
       vercel env pull /tmp/env.post --environment=production --token "$VTOKEN" --yes >/dev/null 2>&1
       {
         echo ""
         echo "=== Post-swap state ==="
         echo "DEFERRED markers in Stripe vars (expect 0):"
         grep -c -E '^(STRIPE_|NEXT_PUBLIC_STRIPE_).*DEFERRED' /tmp/env.post || echo "0"
         echo ""
         echo "NEXT_PUBLIC_BILLING_ENABLED value:"
         grep '^NEXT_PUBLIC_BILLING_ENABLED=' /tmp/env.post
         echo ""
         echo "vercel env ls production filtered:"
         vercel env ls production --token "$VTOKEN" | grep -E '^[[:space:]]*(STRIPE_|NEXT_PUBLIC_STRIPE_|NEXT_PUBLIC_BILLING_)'
         rm -f /tmp/env.post
       } >> /tmp/swap-pre.log

       # Verify Preview scope UNTOUCHED (Pitfall P-NEW-2)
       {
         echo ""
         echo "=== Preview scope check (must NOT have sk_live_ — Pitfall P-NEW-2) ==="
         vercel env pull /tmp/env.preview --environment=preview --token "$VTOKEN" --yes >/dev/null 2>&1
         LIVE_LEAK=$(grep -c -E '^(STRIPE_).*sk_live_' /tmp/env.preview || echo "0")
         echo "Live-key leak count in Preview: $LIVE_LEAK"
         if [ "$LIVE_LEAK" -gt "0" ]; then
           echo "FAIL — Preview scope contains sk_live_ — Pitfall P-NEW-2 violated"
           exit 1
         else
           echo "PASS — Preview scope clean"
         fi
         rm -f /tmp/env.preview
       } >> /tmp/swap-pre.log
       ```

    4. Single git commit + push to drive ONE redeploy (Pitfall P21 atomicity):
       ```bash
       CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
       echo "Current branch: $CURRENT_BRANCH" >> /tmp/swap-pre.log

       # --allow-empty because env-var changes don't touch tracked files; the commit is just a redeploy trigger
       git commit --allow-empty -m "feat(037-04): activate Stripe Live mode + flip billing flag (DEP-INT-01,02,03)" 2>&1 | tee -a /tmp/swap-pre.log

       # Push current branch to main (Phase 35 D-04 deploy method)
       git push origin "${CURRENT_BRANCH}:main" 2>&1 | tee -a /tmp/swap-pre.log
       ```

    5. Persist final log:
       ```bash
       cp /tmp/swap-pre.log .planning/phases/037-external-integrations/evidence/04-vercel-atomic-swap.log
       ```
  </action>
  <acceptance_criteria>
    - All 5 `vercel env add` commands in the log show success markers (e.g., "Added Environment Variable")
    - `evidence/04-vercel-atomic-swap.log` exists, ≥25 lines
    - File contains literal string `DEFERRED markers in Stripe vars (expect 0):` followed by `0`
    - File contains literal string `NEXT_PUBLIC_BILLING_ENABLED=true`
    - File contains literal string `Live-key leak count in Preview: 0`
    - File contains literal string `PASS — Preview scope clean`
    - File contains a `git push origin` line
    - File DOES NOT contain a raw `sk_live_[A-Za-z0-9]{20,}` value (only `=<live-secret-redacted>` markers from sed)
    - File DOES NOT contain a raw `whsec_[A-Za-z0-9]{20,}` value
  </acceptance_criteria>
  <done>5-var atomic swap completed in single shell session. Single git commit pushed. Preview scope verified clean. Redeploy is in flight.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4.5: Wait for redeploy READY + ping webhook + verify 200 in Vercel runtime logs</name>
  <files>
    .planning/phases/037-external-integrations/evidence/04-redeploy-and-ping.md
  </files>
  <read_first>
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Code Examples > Webhook ping verification" + §"Open Questions" #4 (dashboard test-button + stripe trigger fallback)
    - .planning/phases/035-vercel-environment-wiring/evidence/06-deploy-inspect.txt (deploy READY pattern)
  </read_first>
  <action>
    1. Wait for the redeploy to reach READY (poll up to 5min):
       ```bash
       VTOKEN="$(cat ~/.vercel-token)"
       for i in $(seq 1 30); do
         LATEST=$(vercel ls --token "$VTOKEN" 2>&1 | grep -E '^[[:space:]]*https?://' | head -1)
         echo "[$i/30] $LATEST"
         if echo "$LATEST" | grep -qi "READY"; then
           DEPLOY_URL=$(echo "$LATEST" | awk '{print $1}')
           echo "READY: $DEPLOY_URL"
           break
         fi
         sleep 10
       done

       # Confirm prod alias is pointing at the new deploy
       curl -sI https://digswap.com.br/api/health | head -3
       ```

    2. INSTRUCTIONS TO USER (paste into chat as checkpoint):

       What was built (autonomously by Tasks 4.0-4.4): Stripe Live mode active, webhook endpoint registered, 5 env vars swapped, redeploy completed.

       How to verify (please do this — DEP-INT-02 closes only on a 200 webhook ping):

       **Path A (preferred — Stripe Dashboard "Send test webhook"):**
       a. Go to https://dashboard.stripe.com (Live mode) → Developers → Webhooks → click the endpoint Claude just created (URL: `https://digswap.com.br/api/stripe/webhook`).
       b. Top-right of the endpoint detail page, click `Send test webhook`.
       c. Choose event: `checkout.session.completed`.
       d. Click `Send test webhook`.
       e. Stripe shows the response status — expect `HTTP 200` with response body `{"received":true}` or similar.
       f. Reply: `path-A approved — 200` or `path-A failed: <status + response>`

       **Path B (fallback if dashboard button unavailable in Live mode — RESEARCH §"Open Questions" #4):**

       In a terminal (Stripe CLI required — user has it from prior phases):
       ```bash
       stripe trigger checkout.session.completed --api-key $(cat ~/.stripe-live-token)
       ```

       Then check Vercel runtime logs:
       ```bash
       # Use Vercel MCP if available, else CLI:
       vercel inspect <deploy-url-from-step-1> --logs --token "$(cat ~/.vercel-token)" 2>&1 | grep -E '(stripe.webhook|HTTP|200|400)' | tail -20
       ```
       Look for a line showing `POST /api/stripe/webhook 200`.

       Reply: `path-B approved — 200` or `path-B failed: <details>`

    3. Then Claude writes `evidence/04-redeploy-and-ping.md`:
       - Deploy URL + READY timestamp
       - Production alias HTTP code (from `curl -sI`)
       - Path used (A or B)
       - Webhook ping response code
       - Vercel runtime log excerpt showing 200 (sanitize any payload data)
       - Stripe webhook delivery log excerpt (from dashboard or `stripe events resend ...` output)
       - Conclusion: DEP-INT-02 SATISFIED
  </action>
  <acceptance_criteria>
    - `evidence/04-redeploy-and-ping.md` exists, ≥18 lines
    - File contains literal strings: `READY`, `digswap.com.br`, `200`
    - File contains literal string `DEP-INT-02 SATISFIED`
    - File documents whether Path A (dashboard) or Path B (CLI) was used
    - User has replied `path-A approved — 200` OR `path-B approved — 200`
    - Production alias `curl -sI https://digswap.com.br/api/health` showed HTTP 200 (deploy is live)
  </acceptance_criteria>
  <done>Webhook handler verified live: 200 response on synthetic event from Stripe Live. DEP-INT-02 closed.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 4.6: Final phase aggregator + 037-SUMMARY.md</name>
  <files>
    .planning/phases/037-external-integrations/evidence/14-verify-final.txt
    .planning/phases/037-external-integrations/037-SUMMARY.md
  </files>
  <read_first>
    - All 4 plan SUMMARYs (037-00..037-04 — Tasks 4.6 is the LAST so 037-04-SUMMARY can be written from this plan)
    - .planning/phases/037-external-integrations/037-VALIDATION.md §"Per-Requirement Verification Map"
    - .planning/phases/036-dns-ssl-cutover/evidence/14-verify-final.txt (aggregator format reference)
    - .planning/phases/036-dns-ssl-cutover/036-SUMMARY.md (phase summary format reference)
  </read_first>
  <action>
    1. Build the per-DEP-INT aggregator. For each requirement, compute PASS/FAIL by re-probing live state:
       ```bash
       VTOKEN="$(cat ~/.vercel-token)"
       AGG_FILE=.planning/phases/037-external-integrations/evidence/14-verify-final.txt

       {
         echo "=== Phase 37 — Final Verify Aggregator ==="
         echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
         echo ""
         echo "Production URL: https://digswap.com.br"
         echo "Vercel project: digswap-web (prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY)"
         echo ""
         printf "%-13s | %-7s | %s\n" "Requirement" "Status" "Source"
         printf "%-13s-+-%-7s-+-%s\n" "-------------" "-------" "------"

         # DEP-INT-01: STRIPE_SECRET_KEY = sk_live (no DEFERRED)
         vercel env pull /tmp/v.env --environment=production --token "$VTOKEN" --yes >/dev/null 2>&1
         D1=$(grep -c -E '^STRIPE_SECRET_KEY=.*DEFERRED' /tmp/v.env || echo "0")
         if [ "$D1" -eq "0" ] && grep -qE '^STRIPE_SECRET_KEY=' /tmp/v.env; then
           printf "%-13s | %-7s | %s\n" "DEP-INT-01" "PASS" "evidence/04-stripe-token-handling.md + atomic-swap.log"
         else
           printf "%-13s | %-7s | %s\n" "DEP-INT-01" "FAIL" "STRIPE_SECRET_KEY still DEFERRED or missing"
         fi

         # DEP-INT-02: webhook ping returned 200
         if grep -q "DEP-INT-02 SATISFIED" .planning/phases/037-external-integrations/evidence/04-redeploy-and-ping.md 2>/dev/null; then
           printf "%-13s | %-7s | %s\n" "DEP-INT-02" "PASS" "evidence/04-redeploy-and-ping.md (synthetic event 200)"
         else
           printf "%-13s | %-7s | %s\n" "DEP-INT-02" "FAIL" "no SATISFIED marker in 04-redeploy-and-ping.md"
         fi

         # DEP-INT-03: NEXT_PUBLIC_STRIPE_PRICE_* = price_* (no DEFERRED)
         D3=$(grep -c -E '^NEXT_PUBLIC_STRIPE_PRICE_(MONTHLY|ANNUAL)=.*DEFERRED' /tmp/v.env || echo "0")
         if [ "$D3" -eq "0" ] && grep -qE '^NEXT_PUBLIC_STRIPE_PRICE_MONTHLY=price_' /tmp/v.env && grep -qE '^NEXT_PUBLIC_STRIPE_PRICE_ANNUAL=price_' /tmp/v.env; then
           printf "%-13s | %-7s | %s\n" "DEP-INT-03" "PASS" "evidence/04-stripe-prices.md + atomic-swap.log"
         else
           printf "%-13s | %-7s | %s\n" "DEP-INT-03" "FAIL" "Stripe prices still DEFERRED or wrong prefix"
         fi

         # DEP-INT-04: DISCOGS_* not DEFERRED
         D4=$(grep -c -E '^DISCOGS_CONSUMER_(KEY|SECRET)=.*DEFERRED' /tmp/v.env || echo "0")
         if [ "$D4" -eq "0" ]; then
           printf "%-13s | %-7s | %s\n" "DEP-INT-04" "PASS" "evidence/02-discogs-env-audit.txt"
         else
           printf "%-13s | %-7s | %s\n" "DEP-INT-04" "FAIL" "DISCOGS_* still DEFERRED"
         fi

         # DEP-INT-05: allow-list contains digswap.com.br/**
         AL=$(jq -r '.contains_digswap_wildcard' .planning/phases/037-external-integrations/evidence/01-allow-list.json 2>/dev/null)
         if [ "$AL" = "true" ]; then
           printf "%-13s | %-7s | %s\n" "DEP-INT-05" "PASS" "evidence/01-allow-list.json"
         else
           printf "%-13s | %-7s | %s\n" "DEP-INT-05" "FAIL" "allow-list missing digswap.com.br/**"
         fi

         # DEP-INT-06: Google OAuth click-through PASS
         if grep -q "PASS" .planning/phases/037-external-integrations/evidence/01b-google-signin-test.md 2>/dev/null; then
           printf "%-13s | %-7s | %s\n" "DEP-INT-06" "PASS" "evidence/01b-google-signin-test.md"
         else
           printf "%-13s | %-7s | %s\n" "DEP-INT-06" "FAIL" "no PASS marker in 01b-google-signin-test.md"
         fi

         # DEP-INT-07: Resend domain verified
         RS=$(jq -r '.final_status' .planning/phases/037-external-integrations/evidence/03-resend-verified.json 2>/dev/null)
         if [ "$RS" = "verified" ]; then
           printf "%-13s | %-7s | %s\n" "DEP-INT-07" "PASS" "evidence/03-resend-verified.json"
         else
           printf "%-13s | %-7s | %s\n" "DEP-INT-07" "FAIL" "Resend status=$RS"
         fi

         # DEP-INT-08: Supabase SMTP routes via Resend + DKIM PASS
         SH=$(jq -r '.post.smtp_host' .planning/phases/037-external-integrations/evidence/03-supabase-smtp-config.json 2>/dev/null)
         DK=$(grep -c "DEP-INT-08 SATISFIED" .planning/phases/037-external-integrations/evidence/03b-smtp-deliverability.md 2>/dev/null || echo "0")
         if [ "$SH" = "smtp.resend.com" ] && [ "$DK" -ge "1" ]; then
           printf "%-13s | %-7s | %s\n" "DEP-INT-08" "PASS" "evidence/03-supabase-smtp-config.json + 03b-smtp-deliverability.md"
         else
           printf "%-13s | %-7s | %s\n" "DEP-INT-08" "FAIL" "smtp_host=$SH; deliverability_satisfied=$DK"
         fi

         echo ""
         echo "Billing flag (Wave 4 atomic): $(grep '^NEXT_PUBLIC_BILLING_ENABLED=' /tmp/v.env)"
         echo "Stripe Live secret key prefix on Production: $(grep '^STRIPE_SECRET_KEY=' /tmp/v.env | cut -c1-22 | sed 's/=.*$/=<redacted>/' )"
         echo ""

         # Preview scope safety check (P-NEW-2)
         vercel env pull /tmp/v.preview --environment=preview --token "$VTOKEN" --yes >/dev/null 2>&1
         PR_LEAK=$(grep -c -E '^STRIPE_(SECRET_KEY|WEBHOOK_SECRET)=.*sk_live_' /tmp/v.preview || echo "0")
         echo "Preview scope sk_live_ leak count: $PR_LEAK (expect 0)"
         rm -f /tmp/v.env /tmp/v.preview

         echo ""
         echo "=== SUMMARY ==="
         PASSES=$(grep -c '| PASS' "$AGG_FILE" 2>/dev/null || echo "0")
         echo "Total PASS: ${PASSES}/8"
       } > "$AGG_FILE"

       # Re-count after the file is written
       PASSES=$(grep -c '| PASS' "$AGG_FILE")
       echo "Final PASS count: $PASSES / 8"
       sed -i "s/Total PASS: 0\/8/Total PASS: ${PASSES}\/8/" "$AGG_FILE" 2>/dev/null || \
         (grep -v "Total PASS:" "$AGG_FILE" > /tmp/agg-clean && echo "Total PASS: ${PASSES}/8" >> /tmp/agg-clean && mv /tmp/agg-clean "$AGG_FILE")

       cat "$AGG_FILE"
       ```

    2. Write per-plan SUMMARY for this Wave 4 plan (037-04-SUMMARY.md) using the **Write tool** (not heredoc).
       Required structure:
       - Frontmatter fields (in a single YAML block at the top of the file): `phase: 037-external-integrations`, `plan: 04`, `status: complete`, `wave: 2`, `requirements_addressed: [DEP-INT-01, DEP-INT-02, DEP-INT-03]`, `completed: <today>`
       - Title heading: `# Phase 37 Plan 04 — Stripe Live Finalize — Summary`
       - Body sections (fill from actual execution): 1-paragraph overview, tasks-completed table, path deviations log, atomic-swap log summary, webhook ping result, sanitized credential audit (length-only), evidence inventory list (7 files)

    3. Write the phase-wide 037-SUMMARY.md (the FINAL artifact):
       Use Write tool to create `.planning/phases/037-external-integrations/037-SUMMARY.md` with:
       - Frontmatter:
         ```yaml
         phase: 037-external-integrations
         status: complete
         mode: hybrid (Stripe API + Vercel CLI + Hostinger DNS API + Supabase Management API + 4 user checkpoints)
         milestone: v1.4 Production Launch
         production_url: https://digswap.com.br
         supabase_project_ref: swyfhpgerzvvmoswkjyt
         vercel_project_id: prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY
         resend_domain: digswap.com.br
         stripe_live_webhook_id: <from evidence/04-webhook-create.json .response_sanitized.id>
         google_oauth_client_id: <from evidence/01-google-oauth-creds.md>
         discogs_prod_app: DigSwap Prod
         plans_completed: 5
         plans_total: 5
         requirements_addressed: [DEP-INT-01, DEP-INT-02, DEP-INT-03, DEP-INT-04, DEP-INT-05, DEP-INT-06, DEP-INT-07, DEP-INT-08]
         final_verify: <PASSES>/8 — evidence/14-verify-final.txt
         completed: <date>
         ```
       - Section "Plans" — table of 5 plans + key commits + SUMMARY links
       - Section "Path deviations" — collected from each 037-NN-SUMMARY
       - Section "Final verify (8/8 satisfied)" — copy table from 14-verify-final.txt
       - Section "Inputs ready for Phase 38 (Smoke Tests + UAT)" — Stripe Live operational, Resend domain verified, Google OAuth + Discogs prod app + Supabase allow-list all live
       - Section "POST-PHASE-37 TODOs" — DMARC `p=none → p=quarantine` escalation deferred POST-MVP per CONTEXT; rotate `~/.stripe-live-token` after launch (post-MVP); rotate `~/.resend-token` after launch
       - Section "Carry-overs flagged" — Phase 36 D-16 items (CSP inline-style, OAuth silent-fail UX) explicitly NOT in Phase 37 scope; Phase 38 owns
       - Section "Evidence inventory" — list all evidence files across 037-00..037-04 (~16 files)
       - Section "Next phase" — `/gsd:plan-phase 38` Smoke Tests + Human UAT

    4. Stage all evidence + summaries for git:
       ```bash
       git add .planning/phases/037-external-integrations/
       git status
       ```
       Do NOT commit yet — leave for the parent execute-phase orchestrator to commit (or per project convention).
  </action>
  <acceptance_criteria>
    - `evidence/14-verify-final.txt` exists, ≥30 lines
    - `grep -c '| PASS' evidence/14-verify-final.txt` returns at least `8` (all 8 DEP-INT requirements)
    - `grep '| FAIL' evidence/14-verify-final.txt` returns nothing (no failures — if any, halt and re-run failing wave)
    - `grep 'Total PASS: 8/8' evidence/14-verify-final.txt` returns 1 line
    - `grep 'Preview scope sk_live_ leak count: 0' evidence/14-verify-final.txt` returns 1 line (Pitfall P-NEW-2 final check)
    - `037-SUMMARY.md` exists, ≥80 lines
    - `037-SUMMARY.md` frontmatter `requirements_addressed` lists all 8 DEP-INT-NN
    - `037-SUMMARY.md` contains "Plans" section with 5 entries (037-00..037-04)
    - `037-SUMMARY.md` contains "Inputs ready for Phase 38" section
    - `037-04-SUMMARY.md` exists with status: complete and 3 requirements_addressed (DEP-INT-01..03)
  </acceptance_criteria>
  <done>Phase 37 closed: 8/8 requirements PASS, aggregator + per-plan + phase-level SUMMARY written, all evidence captured. Phase 38 can begin.</done>
</task>

</tasks>

<verification>
After all 7 tasks:

1. **All evidence files exist (Wave 4 specific):**
   ```bash
   ls .planning/phases/037-external-integrations/evidence/04-* .planning/phases/037-external-integrations/evidence/14-verify-final.txt
   # Expect 7 files total (04-stripe-approval, 04-stripe-token, 04-stripe-prices, 04-webhook-create, 04-vercel-atomic-swap, 04-redeploy-and-ping, 14-verify-final)
   ```

2. **Phase aggregator green:**
   ```bash
   grep 'Total PASS: 8/8' .planning/phases/037-external-integrations/evidence/14-verify-final.txt
   # 1 line
   grep '| FAIL' .planning/phases/037-external-integrations/evidence/14-verify-final.txt
   # exit 1 (no failures)
   ```

3. **Phase SUMMARY:**
   ```bash
   wc -l .planning/phases/037-external-integrations/037-SUMMARY.md  # ≥80
   grep -c 'DEP-INT-0[1-8]' .planning/phases/037-external-integrations/037-SUMMARY.md  # ≥8
   ```

4. **Pitfall P21 atomicity verified:** the atomic-swap.log shows all 5 vars added in same shell session; single git commit pushed; Preview scope has zero `sk_live_` matches.

5. **Pitfall P-NEW-2 verified:** Preview scope has zero `sk_live_` keys (re-confirmed in aggregator).

6. **No leaked secrets:**
   ```bash
   grep -RIE 'sk_live_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{20,}' .planning/phases/037-external-integrations/evidence/04-* .planning/phases/037-external-integrations/evidence/14-verify-final.txt 2>/dev/null
   # exit 1 (no matches — all secrets sanitized to length-only)
   ```

7. **Production app shows billing UI live:**
   ```bash
   curl -sI https://digswap.com.br/api/health
   # HTTP/2 200
   ```
</verification>

<success_criteria>
- 7 evidence files (Wave 4 specific) + 14-verify-final.txt aggregator + 037-04-SUMMARY.md + 037-SUMMARY.md exist with correct content
- DEP-INT-01 closed: STRIPE_SECRET_KEY = sk_live_* in Vercel Production (no DEFERRED)
- DEP-INT-02 closed: Stripe Live webhook endpoint subscribed to 4 events; synthetic event returned HTTP 200 from `/api/stripe/webhook`
- DEP-INT-03 closed: Both NEXT_PUBLIC_STRIPE_PRICE_* contain real Live price_* IDs (no DEFERRED)
- NEXT_PUBLIC_BILLING_ENABLED flipped from false → true atomically with the 4 Stripe vars (Pitfall P21)
- Single git commit + push triggered ONE redeploy (no mid-state)
- Preview scope verified clean: zero sk_live_ leaks (Pitfall P-NEW-2)
- evidence/14-verify-final.txt aggregator shows 8/8 DEP-INT PASS
- 037-SUMMARY.md exists with all 8 requirements_addressed and Phase 38 inputs ready
- No raw sk_live_, whsec_, or other long-form secret values in any evidence file (length-only sanitization)
- Real $1 transaction test EXPLICITLY DEFERRED to Phase 38 UAT (per CONTEXT D-04)
- Phase 36 carry-overs (CSP inline-style, OAuth silent-fail UX) EXPLICITLY NOT in Phase 37 scope (per CONTEXT D-16)
</success_criteria>

<output>
This plan creates BOTH `037-04-SUMMARY.md` (per-plan summary) AND `037-SUMMARY.md` (phase-level summary) in Task 4.6.

Per-plan SUMMARY (`037-04-SUMMARY.md`) must contain:
1. Frontmatter (status, plan: 04, wave: 2, requirements_addressed: [DEP-INT-01, DEP-INT-02, DEP-INT-03])
2. What this plan delivered — 1 paragraph
3. Tasks completed — 7 tasks with status
4. Path deviations (e.g., Stripe approval took N business days; webhook test path A or B)
5. Stripe activation timeline — Wave 0 submission → Wave 4 finalize elapsed
6. Atomic swap log summary
7. Webhook ping result
8. Sanitized credential audit (length-only)
9. Evidence inventory — 7 files

Phase-level SUMMARY (`037-SUMMARY.md`) must contain:
1. Frontmatter (full — see Task 4.6 step 3)
2. Plans table (5 plans)
3. Path deviations (collected across waves)
4. Final verify table (8/8 PASS)
5. Inputs ready for Phase 38 — Stripe operational, Resend verified, OAuth + Discogs + allow-list all live
6. POST-PHASE-37 TODOs (DMARC escalation deferred, token rotations, etc.)
7. Carry-overs flagged (Phase 36 D-16 items → Phase 38)
8. Evidence inventory (~16 files across all waves)
9. Next phase: Phase 38 Smoke Tests + Human UAT

Commit message (parent orchestrator): `docs(037): close all 8 DEP-INT requirements; Stripe Live + Google OAuth + Discogs prod + Resend SMTP all wired`
</output>
