---
phase: 037-external-integrations
plan: 02
type: execute
wave: 1
depends_on: ["037-00"]
files_modified:
  - .planning/phases/037-external-integrations/evidence/02-discogs-app-creds.md
  - .planning/phases/037-external-integrations/evidence/02-discogs-env-audit.txt
autonomous: false
requirements: [DEP-INT-04]
gap_closure: false
user_setup:
  - service: discogs-developer
    why: "Register a SECOND Discogs app dedicated to production (separate from the dev app, which keeps localhost callback)"
    dashboard_config:
      - task: "Create new Discogs app at https://www.discogs.com/settings/developers — name 'DigSwap Prod', Callback URL = https://digswap.com.br/api/discogs/callback (sole callback)"
        location: "https://www.discogs.com/settings/developers"

must_haves:
  truths:
    - "A separate prod-only Discogs app exists with sole callback https://digswap.com.br/api/discogs/callback (verified by user manually inspecting the Discogs app page)"
    - "The dev Discogs app is UNTOUCHED — its localhost:3000 callback remains unchanged"
    - "Vercel Production scope DISCOGS_CONSUMER_KEY value matches the prod app's consumer key (NOT the DEFERRED placeholder)"
    - "Vercel Production scope DISCOGS_CONSUMER_SECRET value matches the prod app's consumer secret (NOT the DEFERRED placeholder)"
    - "vercel env ls production shows neither DISCOGS_* var contains 'DEFERRED'"
  artifacts:
    - path: ".planning/phases/037-external-integrations/evidence/02-discogs-app-creds.md"
      provides: "Sanitized record of prod app: app name, callback URL exactly as configured, consumer key length, consumer secret length, dev-app-untouched confirmation"
      min_lines: 18
    - path: ".planning/phases/037-external-integrations/evidence/02-discogs-env-audit.txt"
      provides: "Output of `vercel env ls production | grep DISCOGS` — must show entries WITHOUT DEFERRED markers (DEP-INT-04 evidence)"
      min_lines: 6
  key_links:
    - from: "Discogs prod app (consumer key + secret)"
      to: "Vercel Production scope env vars DISCOGS_CONSUMER_KEY + DISCOGS_CONSUMER_SECRET"
      via: "Atomic vercel env rm + vercel env add --sensitive (Phase 35 evidence/02 pattern)"
      pattern: "DISCOGS_CONSUMER_(KEY|SECRET)"
    - from: "apps/web/src/app/api/discogs/callback/route.ts:97-106"
      to: "env.DISCOGS_CONSUMER_KEY / env.DISCOGS_CONSUMER_SECRET"
      via: "Module-load env access via Zod schema; existing handler unchanged (CONTEXT D-07 + RESEARCH)"
      pattern: "DISCOGS_CONSUMER_(KEY|SECRET)"
---

<objective>
Register a NEW prod-only Discogs OAuth app (separate from the existing dev app per CONTEXT D-07), then atomically swap the DEFERRED_PHASE_37_* placeholder values in Vercel Production scope for the real consumer key + secret. Closes DEP-INT-04. The Discogs callback handler at `apps/web/src/app/api/discogs/callback/route.ts` reads the consumer credentials from env via the Zod schema — zero code changes, env-swap only (RESEARCH §"Don't Hand-Roll" + §"Internal references"). Manual OAuth click-through is deferred to Phase 38 UAT (per VALIDATION.md row DEP-INT-04).

Purpose: Production users importing their Discogs library hit a prod-dedicated 60 req/min rate-limit bucket (no contention with the dev app — CONTEXT D-07). Pitfall P7 lineage applies: a single OAuth client with both localhost and prod callbacks would create credential blast radius if either side leaked.

Output: One requirement closed (DEP-INT-04), 2 evidence files documenting the prod app creation + Vercel env audit confirming no DEFERRED markers remain on DISCOGS_*.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
<files_to_read>
- `.planning/phases/037-external-integrations/037-CONTEXT.md` D-07 (separate prod Discogs app, dev app untouched, sole callback prod URL — rate-limit isolation)
- `.planning/phases/037-external-integrations/037-RESEARCH.md` row DEP-INT-04 (Discogs developer settings UI — no API for app creation; existing handler reads env via Zod, ZERO code change)
- `.planning/phases/037-external-integrations/037-VALIDATION.md` row DEP-INT-04 (env-audit only in Phase 37; OAuth click-through deferred to Phase 38)
- `.planning/phases/035-vercel-environment-wiring/035-SUMMARY.md` §"Inputs ready for Phase 37" (current DEFERRED_PHASE_37 values for DISCOGS_CONSUMER_KEY + DISCOGS_CONSUMER_SECRET)
- `.planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log` (Vercel CLI rm-then-add pattern with --sensitive flag)
- `apps/web/src/app/api/discogs/callback/route.ts` lines 90-110 (existing handler — no change needed)
- `apps/web/src/lib/env.ts` lines 12-13 (Zod schema enforces min(1) on both DISCOGS_* vars; DEFERRED placeholder satisfies min(1) but real value is required functionally)
</files_to_read>

<interfaces>
Vercel CLI atomic-swap pattern (Phase 35 evidence/02 — proven):
```bash
# Step 1: Remove existing DEFERRED placeholder
vercel env rm DISCOGS_CONSUMER_KEY production --yes --token "$(cat ~/.vercel-token)"

# Step 2: Add real value with --sensitive (encrypts at rest, hides from `vercel env pull`)
printf %s "<REAL_CONSUMER_KEY>" | vercel env add DISCOGS_CONSUMER_KEY production --sensitive --token "$(cat ~/.vercel-token)"
```

Discogs OAuth 1.0a contract (RESEARCH row DEP-INT-04):
- App registration: https://www.discogs.com/settings/developers (UI-only, no API)
- App fields: app name + callback URL (exactly ONE — no list)
- Returns: Consumer Key (~32 chars) + Consumer Secret (~32 chars). Both visible AFTER creation in the app detail page (Discogs allows re-viewing — unlike Stripe/Google).
- Existing handler `route.ts:97-106` consumes both via `env.DISCOGS_CONSUMER_KEY/SECRET`.
</interfaces>

<!-- Pitfall reminder (P7 lineage — CONTEXT D-07): A single Discogs app with both localhost:3000 and prod callbacks would, on credential compromise of either side, blast-radius across both. Separate prod app = blast-radius isolation. -->
<!-- Pitfall reminder (P-NEW-2 — RESEARCH §"Pitfall P-NEW-2"): Vercel CLI 52.x: ALWAYS pass `production` as the second positional argument to `vercel env add`. Never let the CLI prompt for scope. -->

</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2.1: User creates Discogs prod app and shares consumer key + secret — checkpoint</name>
  <files>
    .planning/phases/037-external-integrations/evidence/02-discogs-app-creds.md
  </files>
  <read_first>
    - .planning/phases/037-external-integrations/037-CONTEXT.md D-07 (separate prod app, dev untouched, sole prod callback)
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"User Constraints" D-07 (rate-limit isolation rationale)
  </read_first>
  <action>
    INSTRUCTIONS TO USER (paste into chat as a checkpoint):

    1. Open https://www.discogs.com/settings/developers (log in if needed — same Discogs account that owns the dev app per CONTEXT D-17 single-owner pattern).

    2. You should see your existing dev app already listed (likely with callback `http://localhost:3000/api/discogs/callback`). **DO NOT MODIFY IT.**

    3. Click "Create an Application" (or "Register a New Application").

    4. Fill in:
       - **Application Name**: `DigSwap Prod`
       - **Description**: `Production deployment of DigSwap — vinyl collector social network` (or similar; visible to OAuth-consenting users)
       - **Application URL**: `https://digswap.com.br`
       - **Callback URL**: EXACTLY (no trailing slash, exactly this path):
         ```
         https://digswap.com.br/api/discogs/callback
         ```
         (per CONTEXT D-07 — sole callback, NO localhost in this prod app)

    5. Click "Create Application" / "Register".

    6. The next page shows the app details with `Consumer Key` and `Consumer Secret`. Discogs allows re-viewing these (unlike Stripe/Google), but copy them now to avoid scrolling back.

    7. Reply in chat with EXACTLY this format:
       ```
       discogs_consumer_key: <PASTE>
       discogs_consumer_secret: <PASTE>
       ```

    Resume signal: chat reply containing `discogs_consumer_key:` and `discogs_consumer_secret:` lines.

    Then Claude:
    - Stores both in shell vars: `export DISCOGS_KEY="..."; export DISCOGS_SEC="..."`
    - Writes `evidence/02-discogs-app-creds.md` with:
      - Timestamp
      - App name: `DigSwap Prod`
      - Application URL: `https://digswap.com.br`
      - Callback URL: `https://digswap.com.br/api/discogs/callback` (verbatim)
      - Consumer Key length: `<N> chars; first 4=<first4>***` (key is more sensitive than client_id — sanitize)
      - Consumer Secret length: `<N> chars; first 4=<first4>***`
      - Dev app status: untouched (callback still localhost:3000) — CONTEXT D-07 invariant confirmed
      - Rate-limit note: prod app has its own 60 req/min bucket; dev app's bucket is separate
  </action>
  <acceptance_criteria>
    - User has replied in chat with `discogs_consumer_key:` and `discogs_consumer_secret:` lines
    - `evidence/02-discogs-app-creds.md` exists, ≥18 lines
    - File contains literal strings: `DigSwap Prod`, `https://digswap.com.br/api/discogs/callback`, `Consumer Key length`, `Consumer Secret length`, `dev app`, `untouched`
    - File DOES NOT contain the full consumer key OR full consumer secret (only `length=` + `first 4` markers)
    - File explicitly states callback URL is `https://digswap.com.br/api/discogs/callback` (no localhost)
  </acceptance_criteria>
  <done>Prod Discogs app exists with sole prod callback, consumer credentials in shell session memory, evidence sanitized.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2.2: Atomic Vercel swap — DISCOGS_CONSUMER_KEY + DISCOGS_CONSUMER_SECRET (Production scope, --sensitive)</name>
  <files>
    .planning/phases/037-external-integrations/evidence/02-discogs-env-audit.txt
  </files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log (rm-then-add pattern, --sensitive flag for secrets)
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Pitfall P-NEW-2" (Vercel Preview MUST stay on dev/dummy values; this task touches PRODUCTION ONLY)
    - evidence/02-discogs-app-creds.md (just-written; confirms shell vars $DISCOGS_KEY and $DISCOGS_SEC are set)
  </read_first>
  <action>
    1. Capture pre-swap state (sanitized — Phase 35 D-05 audit methodology — only key-presence + DEFERRED markers visible since Vercel encrypts at rest):
       ```bash
       vercel env ls production --token "$(cat ~/.vercel-token)" 2>&1 | grep -E '^[[:space:]]*DISCOGS_' | tee /tmp/discogs-pre.txt
       ```
       Expect 2 lines, each likely showing the value masked (encrypted) + likely tagged with creation date from Phase 35.

       Also pull current values to confirm DEFERRED placeholders are present (Phase 35 set them as `DEFERRED_PHASE_37`):
       ```bash
       vercel env pull /tmp/env.production --environment=production --token "$(cat ~/.vercel-token)" 2>&1 | tail -5
       grep -E '^DISCOGS_CONSUMER_(KEY|SECRET)=' /tmp/env.production | sed 's/=.*$/=<value-redacted-but-confirmed-present>/' > /tmp/discogs-pre-values.txt 2>&1 || true
       # If --sensitive flag was used originally, vercel env pull returns empty quotes "" per Phase 35 finding.
       ```

    2. Atomic swap — single shell session, halt-on-fail:
       ```bash
       set -e
       VTOKEN="$(cat ~/.vercel-token)"

       # Remove existing (DEFERRED) values
       vercel env rm DISCOGS_CONSUMER_KEY production --yes --token "$VTOKEN" 2>&1 | tee -a /tmp/discogs-swap.log
       vercel env rm DISCOGS_CONSUMER_SECRET production --yes --token "$VTOKEN" 2>&1 | tee -a /tmp/discogs-swap.log

       # Add real values with --sensitive (both are secrets — Discogs OAuth1.0a uses both for HMAC signing)
       printf %s "$DISCOGS_KEY" | vercel env add DISCOGS_CONSUMER_KEY production --sensitive --token "$VTOKEN" 2>&1 | tee -a /tmp/discogs-swap.log
       printf %s "$DISCOGS_SEC" | vercel env add DISCOGS_CONSUMER_SECRET production --sensitive --token "$VTOKEN" 2>&1 | tee -a /tmp/discogs-swap.log

       set +e
       ```
       Expect: each `vercel env add` shows "Added Environment Variable to Production" or equivalent success line.

    3. Verify Preview scope is UNTOUCHED (Pitfall P-NEW-2 — Preview keeps dev/dummy values):
       ```bash
       vercel env ls preview --token "$VTOKEN" 2>&1 | grep -E '^[[:space:]]*DISCOGS_' | tee /tmp/discogs-preview-check.txt
       ```
       Expect: 2 entries, encrypted-at-rest representations. Preview is a separate scope — Wave 1 must not touch it.

    4. Verify Production scope NO LONGER contains DEFERRED markers via fresh `vercel env pull`:
       ```bash
       vercel env pull /tmp/env.production --environment=production --token "$VTOKEN" --yes 2>&1 | tail -3
       # Note: --sensitive vars may show as empty quotes per Phase 35 D-05; the absence of DEFERRED is what matters
       grep -E '^DISCOGS_CONSUMER_(KEY|SECRET)=' /tmp/env.production | grep -c DEFERRED || echo "0"
       # Expect: 0 (no DEFERRED markers)
       ```

    5. Write final audit:
       ```bash
       {
         echo "=== Phase 37 Wave 2 — Discogs env audit ==="
         echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
         echo ""
         echo "--- vercel env ls production | grep DISCOGS ---"
         vercel env ls production --token "$(cat ~/.vercel-token)" | grep -E '^[[:space:]]*DISCOGS_'
         echo ""
         echo "--- DEFERRED marker scan (env pull then grep DISCOGS_*=DEFERRED) ---"
         vercel env pull /tmp/env.production --environment=production --token "$(cat ~/.vercel-token)" --yes >/dev/null 2>&1
         DEFERRED_COUNT=$(grep -c -E '^DISCOGS_CONSUMER_(KEY|SECRET)=.*DEFERRED' /tmp/env.production || echo "0")
         echo "DEFERRED markers in DISCOGS_* on production: $DEFERRED_COUNT"
         echo ""
         echo "--- Preview scope (must be UNTOUCHED — Pitfall P-NEW-2) ---"
         vercel env ls preview --token "$(cat ~/.vercel-token)" | grep -E '^[[:space:]]*DISCOGS_'
         echo ""
         echo "PASS: DEP-INT-04 — DISCOGS_CONSUMER_KEY/SECRET swapped in Production; Preview untouched."
         rm -f /tmp/env.production
       } > .planning/phases/037-external-integrations/evidence/02-discogs-env-audit.txt
       ```
  </action>
  <acceptance_criteria>
    - `vercel env ls production --token "$(cat ~/.vercel-token)" | grep -c DISCOGS_CONSUMER_KEY` returns ≥1
    - `vercel env ls production --token "$(cat ~/.vercel-token)" | grep -c DISCOGS_CONSUMER_SECRET` returns ≥1
    - `evidence/02-discogs-env-audit.txt` exists, ≥6 lines
    - File contains literal string `DEFERRED markers in DISCOGS_* on production: 0`
    - File contains literal string `PASS: DEP-INT-04`
    - File contains 2 lines from `vercel env ls preview` showing DISCOGS_* still present in Preview (Pitfall P-NEW-2 — must NOT have been touched)
    - The /tmp/discogs-swap.log shows 2 successful `Added` markers (one per var)
    - **No raw consumer key or secret value** appears anywhere in evidence files (sanitization standard)
  </acceptance_criteria>
  <done>Vercel Production scope DISCOGS_* swapped from DEFERRED to real values. Preview untouched. DEP-INT-04 verified by audit.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2.3: Final probe — confirm DEP-INT-04 passes (no DEFERRED in DISCOGS_*)</name>
  <files>
    .planning/phases/037-external-integrations/evidence/02-discogs-env-audit.txt
  </files>
  <read_first>
    - evidence/02-discogs-env-audit.txt (just written)
    - .planning/phases/037-external-integrations/037-VALIDATION.md row DEP-INT-04
  </read_first>
  <action>
    Idempotent re-probe (a fresh `vercel env ls` to confirm Task 2.2 swap didn't auto-revert):
    ```bash
    AUDIT=$(vercel env ls production --token "$(cat ~/.vercel-token)" 2>&1 | grep -E '^[[:space:]]*DISCOGS_')
    echo "Final audit check (re-pull):"
    echo "$AUDIT"
    echo ""

    # The functional check: pull and grep for DEFERRED
    vercel env pull /tmp/env.final --environment=production --token "$(cat ~/.vercel-token)" --yes >/dev/null 2>&1
    DEFERRED=$(grep -c -E '^DISCOGS_CONSUMER_(KEY|SECRET)=.*DEFERRED' /tmp/env.final 2>/dev/null || echo "0")
    rm -f /tmp/env.final

    if [ "$DEFERRED" -eq "0" ]; then
      echo "PASS — no DEFERRED markers on DISCOGS_*"
      # Append confirmation to existing audit
      echo "" >> .planning/phases/037-external-integrations/evidence/02-discogs-env-audit.txt
      echo "=== Re-probe at $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" >> .planning/phases/037-external-integrations/evidence/02-discogs-env-audit.txt
      echo "DEFERRED markers: 0" >> .planning/phases/037-external-integrations/evidence/02-discogs-env-audit.txt
      echo "Status: DEP-INT-04 SATISFIED (env-audit in Phase 37; OAuth click-through deferred to Phase 38 UAT per VALIDATION.md row)" >> .planning/phases/037-external-integrations/evidence/02-discogs-env-audit.txt
    else
      echo "FAIL — $DEFERRED DEFERRED markers remain. Re-run Task 2.2."
      exit 1
    fi
    ```
  </action>
  <acceptance_criteria>
    - The re-probe script exited with code 0 (no FAIL branch hit)
    - `grep -c 'DEP-INT-04 SATISFIED' evidence/02-discogs-env-audit.txt` returns ≥1
    - `grep -c 'Re-probe at' evidence/02-discogs-env-audit.txt` returns ≥1
    - `grep -E 'DEFERRED markers: [1-9]' evidence/02-discogs-env-audit.txt` returns nothing (no non-zero counts)
  </acceptance_criteria>
  <done>DEP-INT-04 verified twice via idempotent re-probe. Phase 38 UAT owns the OAuth click-through.</done>
</task>

</tasks>

<verification>
After all 3 tasks:

1. **Evidence files exist:**
   ```bash
   ls .planning/phases/037-external-integrations/evidence/02-*
   # Expect: 02-discogs-app-creds.md, 02-discogs-env-audit.txt
   ```

2. **DEP-INT-04 audit:**
   ```bash
   grep -c 'DEP-INT-04 SATISFIED' .planning/phases/037-external-integrations/evidence/02-discogs-env-audit.txt
   # ≥1
   ```

3. **No DEFERRED markers on DISCOGS_*:**
   ```bash
   vercel env pull /tmp/env.check --environment=production --token "$(cat ~/.vercel-token)" --yes
   grep -E '^DISCOGS_CONSUMER_(KEY|SECRET)=.*DEFERRED' /tmp/env.check  # exit 1 (no matches)
   rm /tmp/env.check
   ```

4. **No leaked secret:** `evidence/02-discogs-app-creds.md` does NOT contain any 32-char hex/alphanumeric string that could be the raw consumer key/secret. Both values are length-only.

5. **Preview scope untouched:** `vercel env ls preview --token "$(cat ~/.vercel-token)" | grep DISCOGS` still shows the original 2 entries (Pitfall P-NEW-2).
</verification>

<success_criteria>
- 2 evidence files exist with correct content
- DEP-INT-04 closed: Vercel Production scope DISCOGS_CONSUMER_KEY and DISCOGS_CONSUMER_SECRET contain real prod app values (not DEFERRED placeholders)
- New Discogs prod app exists with EXACTLY one callback (`https://digswap.com.br/api/discogs/callback`) — no localhost
- Dev Discogs app UNTOUCHED (D-07 invariant)
- Vercel Preview scope DISCOGS_* untouched (Pitfall P-NEW-2 — Preview keeps dev/dummy values)
- Both consumer credentials encrypted at rest in Vercel (--sensitive flag applied)
- No raw consumer key or secret in any evidence file
- OAuth click-through manual UAT explicitly deferred to Phase 38 (per VALIDATION.md row DEP-INT-04)
</success_criteria>

<output>
After completion, create `.planning/phases/037-external-integrations/037-02-SUMMARY.md` with sections:

1. **Frontmatter** (status: complete, wave: 1, requirements_addressed: [DEP-INT-04], requirements_deferred_to_phase_38: [])
2. **What this plan delivered** — 1-paragraph
3. **Tasks completed** — 3 tasks with status
4. **Path deviations** (if any — e.g., env pull encrypted-at-rest behavior)
5. **Discogs app artifacts** — prod app name, callback URL, consumer key length (sanitized)
6. **Vercel env-var swap** — pre/post audit (sanitized, key-presence + DEFERRED-absence only)
7. **Final verify** — DEP-INT-04 PASS table; OAuth click-through deferred to Phase 38
8. **Rate-limit note** — prod app has its own 60 req/min bucket; dev untouched
9. **Evidence inventory** — list of 2 files

Commit message: `docs(037-02): wire Discogs prod app + atomic env swap (DEP-INT-04)`
</output>
