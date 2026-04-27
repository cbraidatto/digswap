---
phase: 037-external-integrations
plan: 00
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/web/src/lib/env.ts
  - .env.local.example
  - .planning/phases/037-external-integrations/evidence/00-bootstrap.md
  - .planning/phases/037-external-integrations/evidence/00-tokens-handling.md
  - .planning/phases/037-external-integrations/evidence/00-stripe-submit.md
autonomous: false
requirements: []
gap_closure: false
user_setup:
  - service: resend
    why: "Wave 3 needs API key to call POST /domains, configure Supabase Auth SMTP"
    env_vars:
      - name: RESEND_API_KEY
        source: "Resend Dashboard > API Keys > Create API Key (full_access scope, name='digswap-prod')"
  - service: supabase-management-api
    why: "Waves 1, 3 use PATCH /v1/projects/{ref}/config/auth for OAuth + SMTP config"
    env_vars:
      - name: SUPABASE_ACCESS_TOKEN
        source: "https://supabase.com/dashboard/account/tokens > Generate new token"
  - service: stripe
    why: "Live mode activation has 1-3 business day SLA; must start Day 1"
    dashboard_config:
      - task: "Submit Stripe Live activation form (CPF + bank + business activity = Software/Tecnologia)"
        location: "https://dashboard.stripe.com (toggle to Live mode > Activate)"

must_haves:
  truths:
    - "evidence/ directory exists in 037-external-integrations/ for downstream waves to write to"
    - "apps/web/src/lib/env.ts validates NEXT_PUBLIC_BILLING_ENABLED as a boolean string with default 'false'"
    - "Vercel Production scope contains NEXT_PUBLIC_BILLING_ENABLED=false (set BEFORE Wave 4 flips it to true)"
    - "~/.resend-token exists, ASCII no-BOM, returns 200 from GET https://api.resend.com/domains"
    - "~/.supabase-token exists, ASCII no-BOM, returns project list including swyfhpgerzvvmoswkjyt from GET https://api.supabase.com/v1/projects"
    - "User has submitted Stripe Live activation form; SLA timer started (recorded in evidence/00-stripe-submit.md with submission timestamp)"
  artifacts:
    - path: ".planning/phases/037-external-integrations/evidence/00-bootstrap.md"
      provides: "Wave 0 bootstrap log: directory creation, Zod schema entry, Vercel env add"
      min_lines: 20
    - path: ".planning/phases/037-external-integrations/evidence/00-tokens-handling.md"
      provides: "Sanitized audit of ~/.resend-token + ~/.supabase-token placement (file size, ASCII check, probe HTTP code)"
      min_lines: 15
    - path: ".planning/phases/037-external-integrations/evidence/00-stripe-submit.md"
      provides: "Stripe Live activation submission record: submission timestamp, activity declared, expected SLA window"
      min_lines: 12
    - path: "apps/web/src/lib/env.ts"
      provides: "Zod publicSchema entry for NEXT_PUBLIC_BILLING_ENABLED"
      contains: "NEXT_PUBLIC_BILLING_ENABLED"
  key_links:
    - from: "apps/web/src/lib/env.ts publicSchema"
      to: "Vercel Production scope env var NEXT_PUBLIC_BILLING_ENABLED"
      via: "validatePublicEnv() reads process.env.NEXT_PUBLIC_BILLING_ENABLED at module load"
      pattern: "NEXT_PUBLIC_BILLING_ENABLED"
    - from: "~/.resend-token"
      to: "Resend API GET /domains"
      via: "Authorization: Bearer header"
      pattern: "Bearer \\$\\(cat ~/\\.resend-token\\)"
    - from: "~/.supabase-token"
      to: "Supabase Management API GET /v1/projects"
      via: "Authorization: Bearer header"
      pattern: "Bearer \\$\\(cat ~/\\.supabase-token\\)"
---

<objective>
Wave 0 bootstrap for Phase 37: create the evidence/ directory, add the NEXT_PUBLIC_BILLING_ENABLED feature flag to the env Zod schema (default false), seed the flag into Vercel Production scope, collect the Resend API key and Supabase Management API access token onto disk (mirroring the Phase 36 ~/.hostinger-token pattern), and START the 1-3 business day Stripe Live activation SLA timer by having the user submit the activation form. No DEP-INT requirements close in this wave — Wave 0 unlocks Waves 1-3 to run in parallel and provides the gate for Wave 4 (Stripe finalize).

Purpose: Bootstrap is sequential because every downstream wave needs at least one of these artifacts. Stripe SLA is the critical-path long-pole — Day 1 submission is mandatory per ROADMAP and CONTEXT D-13.

Output: Tokens on disk, evidence/ directory + 3 bootstrap logs, env.ts patched with NEXT_PUBLIC_BILLING_ENABLED, Vercel Production scope seeded with the flag at false, Stripe activation form submitted with SLA timer started.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
<files_to_read>
- `.planning/phases/037-external-integrations/037-CONTEXT.md` (D-01..D-04 Stripe activation, D-13 wave structure, D-14 feature flag, D-17 account ownership)
- `.planning/phases/037-external-integrations/037-RESEARCH.md` §"Recommended Wave Structure" (Wave 0 sub-tasks 0.x), §"Open Questions" #3 (Supabase access token), §"Pitfall P-NEW-1" (Stripe SLA delay), §"Pitfall P-NEW-3" (Supabase Auth SMTP rate-limit pre-emptive bump)
- `.planning/phases/037-external-integrations/037-VALIDATION.md` §"Wave 0 Prerequisites Gate"
- `.planning/phases/035-vercel-environment-wiring/035-SUMMARY.md` §"Path deviations" (CLI for env-var writes; --sensitive flag pattern; encrypted-at-rest audit methodology)
- `.planning/phases/036-dns-ssl-cutover/036-SUMMARY.md` §"Inputs ready for Phase 37" (Hostinger token + ~/.vercel-token availability; Hostinger MCP requires session restart)
- `.planning/phases/036-dns-ssl-cutover/evidence/00-token-handling.md` (ASCII no-BOM token-on-disk pattern: `printf %s "$VALUE" > ~/.token-name`)
- `apps/web/src/lib/env.ts` (Zod schemas — current shape; NEXT_PUBLIC_BILLING_ENABLED entry must be added to publicSchema)
- `CLAUDE.md` (root) §"Stack" — confirms NEXT_PUBLIC_* must be added to publicSchema and `.env.local.example`
</files_to_read>

<interfaces>
Current `apps/web/src/lib/env.ts` publicSchema (excerpt — entry to add lines below):
```typescript
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1, "NEXT_PUBLIC_SUPABASE_URL is required"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, "..."),
  NEXT_PUBLIC_SITE_URL: ...,
  NEXT_PUBLIC_APP_URL: ...,
  NEXT_PUBLIC_STRIPE_PRICE_MONTHLY: z.string().optional().default(""),
  NEXT_PUBLIC_STRIPE_PRICE_ANNUAL: z.string().optional().default(""),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional().default(""),
  NEXT_PUBLIC_MIN_DESKTOP_VERSION: z.string().optional().default("0.2.0"),
  // NEW (Phase 37 Wave 0):
  // NEXT_PUBLIC_BILLING_ENABLED: z.string().optional().default("false"),
});
```

`validatePublicEnv()` MUST also be patched to read `process.env.NEXT_PUBLIC_BILLING_ENABLED` (mirroring how it reads NEXT_PUBLIC_STRIPE_PRICE_MONTHLY etc).

Token-on-disk pattern (Phase 36 evidence/00-token-handling.md):
```bash
# ASCII no-BOM single-shot write — use printf %s, not echo (echo adds trailing newline)
printf %s "RESEND_API_KEY_VALUE_HERE" > ~/.resend-token
chmod 600 ~/.resend-token
# Probe:
curl -sS -w '\nHTTP_CODE:%{http_code}\n' \
  -H "Authorization: Bearer $(cat ~/.resend-token)" \
  https://api.resend.com/domains
```
</interfaces>

<!-- Pitfall reminder (P-NEW-1 — RESEARCH §"Pitfall P-NEW-1"): Stripe Brazil PF approval can take >3 business days if Stripe requests document re-upload. Wave 0 task 0.5 mitigates by having user attach all expected docs (CPF, RG front, proof of residence, bank proof) proactively. -->
<!-- Pitfall reminder (P-NEW-3 — RESEARCH §"Pitfall P-NEW-3"): Supabase Auth SMTP defaults to 30 emails/hour; raised to 100/hour in Wave 3 task 3.5. Mentioned here so Wave 0 doesn't accidentally lock the default. -->

</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 0.1: Bootstrap evidence/ directory and add NEXT_PUBLIC_BILLING_ENABLED Zod entry</name>
  <files>
    .planning/phases/037-external-integrations/evidence/00-bootstrap.md
    apps/web/src/lib/env.ts
    .env.local.example
  </files>
  <read_first>
    - apps/web/src/lib/env.ts (full file — entry must be added to publicSchema AND validatePublicEnv() reader at lines 73-81)
    - .env.local.example (or `apps/web/.env.local.example` — locate via `find . -name '.env.local.example' -not -path './node_modules/*'`)
    - .planning/phases/037-external-integrations/037-CONTEXT.md (D-14 feature flag default false, flips true in Wave 4)
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Open Questions" #5 (read once at module load — matches existing publicEnv pattern)
  </read_first>
  <action>
    1. Create the evidence directory:
       ```bash
       mkdir -p .planning/phases/037-external-integrations/evidence
       ```

    2. Edit `apps/web/src/lib/env.ts`:
       - In `publicSchema` (line 38-55), add the entry AFTER `NEXT_PUBLIC_MIN_DESKTOP_VERSION`:
         ```typescript
         NEXT_PUBLIC_BILLING_ENABLED: z.string().optional().default("false"),
         ```
       - In `validatePublicEnv()` (line 72-89), add the field to the parse object (after `NEXT_PUBLIC_MIN_DESKTOP_VERSION`):
         ```typescript
         NEXT_PUBLIC_BILLING_ENABLED: process.env.NEXT_PUBLIC_BILLING_ENABLED,
         ```

    3. Locate and edit `.env.local.example`. Run `find . -name '.env.local.example' -not -path './node_modules/*'` to find it. Add line:
       ```
       NEXT_PUBLIC_BILLING_ENABLED=false
       ```
       (group it near the other NEXT_PUBLIC_STRIPE_* lines)

    4. Verify the schema typechecks:
       ```bash
       pnpm --filter @digswap/web typecheck 2>&1 | tee /tmp/typecheck-wave0.log
       ```
       Expect: exit code 0, no errors related to publicSchema.

    5. Verify the build still succeeds:
       ```bash
       pnpm --filter @digswap/web build 2>&1 | tail -30 | tee -a /tmp/typecheck-wave0.log
       ```
       Expect: build completes (no Zod parse failures from missing NEXT_PUBLIC_BILLING_ENABLED — defaults to "false" in dev).

    6. Write `.planning/phases/037-external-integrations/evidence/00-bootstrap.md` with:
       - Timestamp of execution
       - Confirmation that `evidence/` directory was created
       - Diff of `apps/web/src/lib/env.ts` (just the added lines)
       - Confirmation that `.env.local.example` was updated (path + diff)
       - Output of `pnpm typecheck` exit code
       - Output of `pnpm build` last 10 lines (success marker)
       - Decision rationale: per CONTEXT D-14 "default false in Wave 0, flip to true in Wave 4 atomic swap"
  </action>
  <acceptance_criteria>
    - `test -d .planning/phases/037-external-integrations/evidence/` returns true
    - `grep -c 'NEXT_PUBLIC_BILLING_ENABLED' apps/web/src/lib/env.ts` returns at least `2` (one in publicSchema, one in validatePublicEnv)
    - `grep '^NEXT_PUBLIC_BILLING_ENABLED' .env.local.example` returns `NEXT_PUBLIC_BILLING_ENABLED=false` (path may be `apps/web/.env.local.example`)
    - `pnpm --filter @digswap/web typecheck` exits with code 0
    - `pnpm --filter @digswap/web build` exits with code 0
    - `evidence/00-bootstrap.md` exists, ≥20 lines, contains the literal strings `NEXT_PUBLIC_BILLING_ENABLED`, `typecheck`, `build`
  </acceptance_criteria>
  <done>Zod schema patched with billing flag, evidence directory exists, typecheck + build pass cleanly.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 0.2: Add NEXT_PUBLIC_BILLING_ENABLED=false to Vercel Production scope</name>
  <files>
    .planning/phases/037-external-integrations/evidence/00-bootstrap.md
  </files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log (CLI command shape — `vercel env add KEY production` reads value from stdin)
    - .planning/phases/035-vercel-environment-wiring/035-SUMMARY.md §"Path deviations" #1 (hybrid CLI+MCP+Dashboard pattern; CLI for env-var writes is canonical)
  </read_first>
  <action>
    1. Verify Vercel CLI is logged in:
       ```bash
       vercel whoami --token "$(cat ~/.vercel-token)"
       ```
       Expect: prints user identifier (not "Not authenticated").

    2. Add the flag to Production scope (NOT --sensitive — it's a public, non-secret feature flag):
       ```bash
       printf %s "false" | vercel env add NEXT_PUBLIC_BILLING_ENABLED production --token "$(cat ~/.vercel-token)" 2>&1 | tee -a /tmp/wave0-env.log
       ```
       If the var already exists, CLI will error with "already exists" — in that case, run:
       ```bash
       vercel env rm NEXT_PUBLIC_BILLING_ENABLED production --yes --token "$(cat ~/.vercel-token)"
       printf %s "false" | vercel env add NEXT_PUBLIC_BILLING_ENABLED production --token "$(cat ~/.vercel-token)" 2>&1 | tee -a /tmp/wave0-env.log
       ```

    3. Confirm via `vercel env ls`:
       ```bash
       vercel env ls production --token "$(cat ~/.vercel-token)" 2>&1 | grep NEXT_PUBLIC_BILLING_ENABLED
       ```
       Expect: line showing `NEXT_PUBLIC_BILLING_ENABLED` in `Production` scope (encrypted-at-rest representation OK per Phase 35 D-05 audit methodology).

    4. ALSO add the flag to Preview scope (per Phase 35 D-13 — Preview never uses Stripe Live; flag stays false in Preview forever):
       ```bash
       printf %s "false" | vercel env add NEXT_PUBLIC_BILLING_ENABLED preview --token "$(cat ~/.vercel-token)" 2>&1 | tee -a /tmp/wave0-env.log
       ```
       (Same `rm`-then-`add` fallback if it already exists.)

    5. Append to `evidence/00-bootstrap.md`:
       - Section "Vercel env-var bootstrap"
       - The `vercel env ls production | grep NEXT_PUBLIC_BILLING_ENABLED` output line
       - The `vercel env ls preview | grep NEXT_PUBLIC_BILLING_ENABLED` output line
       - Note: per Phase 35 D-13, Preview value stays `false` even after Wave 4 flips Production to `true`
  </action>
  <acceptance_criteria>
    - `vercel env ls production --token "$(cat ~/.vercel-token)" | grep -c NEXT_PUBLIC_BILLING_ENABLED` returns ≥1
    - `vercel env ls preview --token "$(cat ~/.vercel-token)" | grep -c NEXT_PUBLIC_BILLING_ENABLED` returns ≥1
    - `evidence/00-bootstrap.md` contains both grep output lines (literal strings `NEXT_PUBLIC_BILLING_ENABLED` AND `Production` AND `Preview`)
    - The CLI command output (in /tmp/wave0-env.log) shows "Added Environment Variable" or equivalent success marker
  </acceptance_criteria>
  <done>NEXT_PUBLIC_BILLING_ENABLED=false present in both Production and Preview scopes; evidence captured.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 0.3: User pastes Resend API key to ~/.resend-token (one-shot, ASCII no-BOM) — checkpoint</name>
  <files>
    .planning/phases/037-external-integrations/evidence/00-tokens-handling.md
  </files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/evidence/00-token-handling.md (printf %s pattern — no trailing newline)
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Environment Availability" row "Resend API key"
  </read_first>
  <action>
    INSTRUCTIONS TO USER (paste into chat as a checkpoint):

    1. Open https://resend.com/api-keys (log in if needed; user account = `thiagobraidatto@gmail.com` per memory).

    2. Click "Create API Key":
       - Name: `digswap-prod`
       - Permission: `Full access` (we need both `domains.send` and `domains.full_access`; Full access covers both)
       - Domain: leave as `All domains` (the digswap.com.br domain doesn't exist in Resend yet — Wave 3 creates it).

    3. Copy the API key value (starts with `re_`, ~32-50 chars). The dashboard ONLY shows it ONCE.

    4. In a fresh git-bash terminal at the repo root, run (replace `<PASTE>` with the actual key):
       ```bash
       printf %s "<PASTE>" > ~/.resend-token
       chmod 600 ~/.resend-token
       ```
       IMPORTANT: use `printf %s` (NO `echo` — echo adds a trailing newline that will break Bearer auth).

    5. Verify the token works:
       ```bash
       curl -sS -w '\nHTTP_CODE:%{http_code}\n' \
         -H "Authorization: Bearer $(cat ~/.resend-token)" \
         https://api.resend.com/domains
       ```
       Expect: `HTTP_CODE:200` and a JSON body (probably `{"data":[]}` since no domains exist yet).

    6. Reply with one of:
       - "approved" (if the curl returned HTTP 200) → Wave 0 continues
       - "issue: <details>" (if anything went wrong)

    Resume signal: `approved`

    Then Claude appends to `evidence/00-tokens-handling.md`:
       - File size: `wc -c < ~/.resend-token` (expect 32-60 bytes)
       - ASCII check: `file ~/.resend-token` (expect "ASCII text" — NO BOM, NO UTF-16)
       - Probe HTTP code (sanitized — DO NOT log token value): "GET /domains returned 200"
       - Timestamp of token creation
  </action>
  <acceptance_criteria>
    - `test -f ~/.resend-token` returns true
    - `wc -c < ~/.resend-token` returns a number between 30 and 80
    - `head -c 3 ~/.resend-token` outputs `re_` (Resend key prefix)
    - `curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $(cat ~/.resend-token)" https://api.resend.com/domains` returns `200`
    - `evidence/00-tokens-handling.md` exists, contains literal strings `~/.resend-token`, `200`, and an ASCII-check confirmation
    - Token VALUE is NOT logged in any evidence file (Phase 36 sanitization standard)
  </acceptance_criteria>
  <done>Resend API key on disk, probe returns 200, evidence sanitized.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 0.4: User pastes Supabase Management API access token to ~/.supabase-token — checkpoint</name>
  <files>
    .planning/phases/037-external-integrations/evidence/00-tokens-handling.md
  </files>
  <read_first>
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Open Questions" #3 (token availability + creation step)
    - .planning/phases/036-dns-ssl-cutover/evidence/00-token-handling.md (token-on-disk pattern, exact same as Resend)
  </read_first>
  <action>
    INSTRUCTIONS TO USER (paste into chat as a checkpoint):

    1. Open https://supabase.com/dashboard/account/tokens (log in if needed).

    2. Click "Generate new token":
       - Name: `digswap-phase37-mgmt`
       - Click "Generate token".

    3. Copy the token value (starts with `sbp_`, ~40+ chars). The dashboard shows it ONLY ONCE.

    4. In git-bash at the repo root:
       ```bash
       printf %s "<PASTE>" > ~/.supabase-token
       chmod 600 ~/.supabase-token
       ```
       (Same `printf %s` rule — no echo.)

    5. Verify the token works AND the project is visible:
       ```bash
       curl -sS \
         -H "Authorization: Bearer $(cat ~/.supabase-token)" \
         https://api.supabase.com/v1/projects \
         | jq '.[] | {id, name}' 2>&1 | tee /tmp/supabase-projects.json
       ```
       Expect: a JSON list including an entry where `"id": "swyfhpgerzvvmoswkjyt"` (the prod project ref locked from Phase 34).

    6. If `swyfhpgerzvvmoswkjyt` is NOT in the list:
       - Token may be scoped to wrong organization → recreate with Personal Access scope
       - OR user may need to be added to the project — reply "issue: project not visible"

    7. Reply: `approved` (if project visible) OR `issue: <details>`.

    Resume signal: `approved`

    Then Claude appends to `evidence/00-tokens-handling.md`:
       - File size + ASCII check (NO TOKEN VALUE)
       - Probe result: "GET /v1/projects returned 200, contained id swyfhpgerzvvmoswkjyt"
       - Timestamp
  </action>
  <acceptance_criteria>
    - `test -f ~/.supabase-token` returns true
    - `wc -c < ~/.supabase-token` returns a number between 30 and 80
    - `head -c 4 ~/.supabase-token` outputs `sbp_` (Supabase personal token prefix)
    - `curl -sS -H "Authorization: Bearer $(cat ~/.supabase-token)" https://api.supabase.com/v1/projects | grep -c swyfhpgerzvvmoswkjyt` returns ≥1
    - `evidence/00-tokens-handling.md` contains literal strings `~/.supabase-token`, `swyfhpgerzvvmoswkjyt`, `200`
    - Token value NOT in any evidence file
  </acceptance_criteria>
  <done>Supabase management token on disk, prod project ref visible in API, evidence sanitized.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 0.5: User submits Stripe Live activation form — checkpoint (starts SLA timer)</name>
  <files>
    .planning/phases/037-external-integrations/evidence/00-stripe-submit.md
  </files>
  <read_first>
    - .planning/phases/037-external-integrations/037-CONTEXT.md (D-01 same Stripe account; D-02 CPF / Pessoa Física; D-13 Wave 0 = SLA timer start)
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Pitfall P-NEW-1" (proactive doc upload to avoid SLA stretch)
    - .planning/ROADMAP.md line 656 — "this activation must be initiated on Day 1 of the milestone because Stripe's SLA is 1-3 business days — waiting until this phase is too late"
  </read_first>
  <action>
    INSTRUCTIONS TO USER (paste into chat as a checkpoint):

    Stripe Live activation has a 1-3 business day SLA. Submit the form NOW so the timer starts; Waves 1-3 (OAuth, Discogs, Resend) run in parallel during the wait. Wave 4 finalizes Stripe AFTER approval.

    1. Open https://dashboard.stripe.com (log into the SAME Stripe account used for `sk_test_*` per CONTEXT D-01).

    2. Top-left: toggle from `Test mode` → `Live mode`. The dashboard will prompt: "Activate payments" (or similar). Click "Activate".

    3. Fill the activation form (CPF / Pessoa Física path per CONTEXT D-02):

       a. **Country**: Brazil
       b. **Business type**: `Individual` (Pessoa Física) — NOT Company / CNPJ
       c. **Industry / Business activity**: choose `Software / Tecnologia` (or closest English equivalent — likely "Software")
       d. **Personal info**: full legal name (as on RG), CPF, date of birth, residential address (proof-of-address required)
       e. **Bank account**: Brazilian bank, agência (4 digits), conta-corrente number, account type (Pessoa Física Conta Corrente)
       f. **Identity verification documents** (PROACTIVELY upload all 3 to avoid Stripe re-requesting later — RESEARCH P-NEW-1):
          - CPF (digital or photo)
          - RG front side (or CNH front)
          - Proof of residence ≤90 days old (utility bill, bank statement, official letter)
       g. **Statement descriptor**: `DIGSWAP` (or similar 5-22 char string)
       h. **Website URL**: `https://digswap.com.br`
       i. **Product description**: 1-2 sentences (e.g., "Social network for vinyl collectors with optional premium subscriptions for advanced search/discovery features")

    4. **Submit the form**. Stripe will show "Information submitted, under review" or similar.

    5. Note the submission timestamp (your local time + timezone).

    6. Reply with one of:
       - `submitted, awaiting approval — <YYYY-MM-DD HH:MM TZ>` → Wave 0 closes; Waves 1-3 unblocked
       - `issue: <details>` (e.g., Stripe rejected at submit, requires more docs)

    Resume signal: `submitted, awaiting approval`

    Then Claude writes `evidence/00-stripe-submit.md` with:
    - Submission timestamp (UTC + user's local TZ)
    - Business activity declared: `Software / Tecnologia`
    - Account type: Pessoa Física (CPF) per CONTEXT D-02
    - Documents uploaded proactively: CPF, RG, proof of residence
    - Expected SLA: 1-3 business days (per Stripe support; RESEARCH §"Open Questions" #1 notes median uncertain)
    - Wave 4 trigger: Stripe approval email lands → user replies in execution session, Wave 4 begins
    - Side-effect: Waves 1-3 (037-01, 037-02, 037-03) UNBLOCKED to run in parallel
    - **NO SECRET VALUES** — Stripe Live keys don't exist yet (only after approval)
  </action>
  <acceptance_criteria>
    - `evidence/00-stripe-submit.md` exists, ≥12 lines
    - File contains literal strings: `Pessoa Física` (or `CPF`), `Software`, `submitted`, a timestamp pattern (e.g., `2026-04-`)
    - File contains the line: `Wave 4 trigger: Stripe approval email`
    - User has replied `submitted, awaiting approval` (or equivalent) in the execution session — recorded in evidence
    - File does NOT contain any value matching `sk_live_[a-zA-Z0-9_]+` (no Live keys exist yet)
  </acceptance_criteria>
  <done>Stripe Live activation form submitted, SLA timer started, evidence captured, Waves 1-3 are unblocked.</done>
</task>

</tasks>

<verification>
After all 5 tasks complete:

1. **evidence/ directory + 3 logs:**
   ```bash
   ls -la .planning/phases/037-external-integrations/evidence/
   # Expect: 00-bootstrap.md, 00-tokens-handling.md, 00-stripe-submit.md (each ≥12 lines)
   ```

2. **Zod schema patched + tokens on disk:**
   ```bash
   grep -c 'NEXT_PUBLIC_BILLING_ENABLED' apps/web/src/lib/env.ts  # ≥2
   grep '^NEXT_PUBLIC_BILLING_ENABLED' .env.local.example apps/web/.env.local.example 2>/dev/null  # one match
   pnpm --filter @digswap/web typecheck  # exit 0
   wc -c < ~/.resend-token  # 30-80
   wc -c < ~/.supabase-token  # 30-80
   ```

3. **Vercel env state:**
   ```bash
   vercel env ls production --token "$(cat ~/.vercel-token)" | grep NEXT_PUBLIC_BILLING_ENABLED  # ≥1 line
   vercel env ls preview --token "$(cat ~/.vercel-token)" | grep NEXT_PUBLIC_BILLING_ENABLED  # ≥1 line
   ```

4. **Token API probes return 200:**
   ```bash
   curl -sS -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $(cat ~/.resend-token)" https://api.resend.com/domains
   # 200
   curl -sS -H "Authorization: Bearer $(cat ~/.supabase-token)" https://api.supabase.com/v1/projects | grep -c swyfhpgerzvvmoswkjyt
   # ≥1
   ```

5. **Stripe SLA timer started:** evidence/00-stripe-submit.md contains "submitted" timestamp and "Pessoa Física" / "Software" markers.
</verification>

<success_criteria>
- All 5 tasks complete; 3 evidence files exist with ≥12 lines each
- `apps/web/src/lib/env.ts` has 2 references to `NEXT_PUBLIC_BILLING_ENABLED` (publicSchema + validatePublicEnv)
- `.env.local.example` has `NEXT_PUBLIC_BILLING_ENABLED=false` line
- `pnpm --filter @digswap/web typecheck && pnpm --filter @digswap/web build` both succeed
- `~/.resend-token` and `~/.supabase-token` exist, each return 200 from their respective probe
- Vercel Production AND Preview scopes contain `NEXT_PUBLIC_BILLING_ENABLED=false`
- User has replied in chat: Stripe Live activation form submitted with timestamp; SLA timer is RUNNING
- Token VALUES never appear in any evidence file (sanitization standard)
- **Phase 37 Waves 1, 2, 3 are now UNBLOCKED to run in parallel** (this is the key Wave 0 deliverable)
</success_criteria>

<output>
After completion, create `.planning/phases/037-external-integrations/037-00-SUMMARY.md` with sections:

1. **Frontmatter** (status: complete, plan: 00, wave: 0, requirements_addressed: [] — Wave 0 closes no DEP-INT IDs)
2. **What this plan delivered** — 1-paragraph summary
3. **Tasks completed** — table of 5 tasks with commits
4. **Path deviations** (if any — e.g., env-var already existed in Vercel and required `rm`+`add`)
5. **Tokens-on-disk inventory** — `~/.resend-token` (size, probe HTTP), `~/.supabase-token` (size, probe HTTP, project visible)
6. **Stripe activation status** — submission timestamp, expected SLA, Wave 4 trigger condition
7. **Inputs ready for Waves 1-3** — list of 3 tokens (vercel, resend, supabase) + status of Stripe (in-flight)
8. **Inputs ready for Wave 4** — pending: ~/.stripe-live-token (created on Stripe approval); 4 pending env-var swaps; webhook ping target URL
9. **Evidence inventory** — list of 3 evidence files with brief description each
10. **Next plan** — Waves 1, 2, 3 can run in PARALLEL via gsd-executor

Commit message: `docs(037-00): wave 0 prereqs complete — tokens on disk, billing flag scaffolded, Stripe SLA running`
</output>
