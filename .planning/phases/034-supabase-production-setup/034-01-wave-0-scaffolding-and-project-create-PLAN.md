---
phase: 034-supabase-production-setup
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - .planning/phases/034-supabase-production-setup/scripts/verify.sh
  - .planning/phases/034-supabase-production-setup/scripts/rls-probe.sql
  - .planning/phases/034-supabase-production-setup/scripts/drop-and-recreate.md
  - .planning/phases/034-supabase-production-setup/evidence/.gitkeep
  - .planning/phases/034-supabase-production-setup/evidence/01-projects-list.txt
  - .planning/phases/034-supabase-production-setup/evidence/02-link-confirm.txt
autonomous: false
requirements: [DEP-SB-01]
requirements_addressed: [DEP-SB-01]
gap_closure: false
must_haves:
  truths:
    - "scripts/verify.sh exists and is executable, accepts PROD_REF, PROD_DIRECT_URL, PROD_ANON_KEY from environment, and emits a single pass/fail summary across all DEP-SB checks"
    - "scripts/rls-probe.sql exists and contains the JWT-bound psql probe from RESEARCH.md §4 Step B"
    - "scripts/drop-and-recreate.md exists and documents the 5-step catastrophic-halt procedure from RESEARCH.md §10"
    - "evidence/ directory exists in git tree (via .gitkeep)"
    - "digswap-prod Supabase project exists in us-east-1 on the Free tier"
    - "supabase CLI is linked to the prod project ref (NOT dev mrkgoucqcbqjhrdjcnpw)"
  artifacts:
    - path: ".planning/phases/034-supabase-production-setup/scripts/verify.sh"
      provides: "Single orchestrator that runs every requirement-level psql/curl probe and emits pass/fail"
      contains: "DEP-SB-01, DEP-SB-02, DEP-SB-03, DEP-SB-04, DEP-SB-05, DEP-SB-06, DEP-SB-07, DEP-SB-10"
    - path: ".planning/phases/034-supabase-production-setup/scripts/rls-probe.sql"
      provides: "JWT-bound RLS probe that runs SET ROLE authenticated + SET request.jwt.claims and asserts 0 rows on RLS-locked tables"
      contains: "SET ROLE authenticated"
    - path: ".planning/phases/034-supabase-production-setup/scripts/drop-and-recreate.md"
      provides: "Operator-facing recovery procedure for catastrophic mid-trail migration failure"
      contains: "Pause project"
    - path: ".planning/phases/034-supabase-production-setup/evidence/01-projects-list.txt"
      provides: "supabase projects list output proving the new project exists with a distinct ref"
      contains: "digswap-prod"
    - path: ".planning/phases/034-supabase-production-setup/evidence/02-link-confirm.txt"
      provides: "Contents of supabase/.temp/project-ref proving CLI is linked to the prod ref"
  key_links:
    - from: "scripts/verify.sh"
      to: "scripts/rls-probe.sql"
      via: "psql -f"
      pattern: "rls-probe\\.sql"
    - from: "evidence/02-link-confirm.txt"
      to: "supabase/.temp/project-ref"
      via: "cat"
      pattern: "[a-z0-9]{20}"
---

<objective>
Lay the Wave 0 foundation for Phase 34 BEFORE any migration runs against prod: install the verify.sh harness, the rls-probe.sql template, and the drop-and-recreate.md catastrophic-halt runbook; create the evidence/ directory in git; create the digswap-prod Supabase Cloud project in us-east-1 (dashboard-only — no public API exists); and link the CLI to the new project ref. No migrations apply in this plan. This is the safe-to-redo plan.

Purpose: Phase 34 RESEARCH.md §10 ("Halt-on-Fail Protocol") requires that the verify harness exist BEFORE Wave 1 runs the migration push. Validation infrastructure (verify.sh, rls-probe.sql) per RESEARCH.md §"Validation Architecture" Wave 0 Gaps must be in place. This plan owns those scaffolding artifacts so the Wave 1 plan only invokes them, never builds them.

Output: 4 script/scaffold files committed to repo, 2 evidence files written (1 CLI capture + 1 link confirmation), 1 fresh Supabase Cloud project provisioned in us-east-1 on Free tier.
</objective>

<execution_context>
@C:\Users\INTEL\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\INTEL\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/ADR-003-drizzle-dev-only.md

# Phase 34 specs
@.planning/phases/034-supabase-production-setup/034-CONTEXT.md
@.planning/phases/034-supabase-production-setup/034-RESEARCH.md
@.planning/phases/034-supabase-production-setup/034-VALIDATION.md

# Phase 33 baseline (proves migration trail resets clean on empty Cloud)
@.planning/phases/033-pre-deploy-audit-gate/033-VERIFICATION.md
@.planning/phases/033.1-audit-gate-closure/RUNBOOK.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create scripts/ scaffolding (verify.sh, rls-probe.sql, drop-and-recreate.md)</name>
  <files>
    .planning/phases/034-supabase-production-setup/scripts/verify.sh,
    .planning/phases/034-supabase-production-setup/scripts/rls-probe.sql,
    .planning/phases/034-supabase-production-setup/scripts/drop-and-recreate.md,
    .planning/phases/034-supabase-production-setup/evidence/.gitkeep
  </files>
  <read_first>
    - 034-RESEARCH.md §"Validation Architecture" (L806-L869) — Wave 0 Gaps + Evidence-Capture Protocol table
    - 034-RESEARCH.md §4 Step B (L259-L304) — exact SQL for rls-probe.sql (SET ROLE authenticated + SET request.jwt.claims)
    - 034-RESEARCH.md §10 (L529-L554) — drop+recreate procedure (5 steps, dashboard-only)
    - 034-VALIDATION.md L42-L51 — per-requirement automated commands that verify.sh must orchestrate
  </read_first>
  <action>
    Create the four Wave-0 scaffolding files exactly as specified. NO mocks — these scripts must actually run when Wave 1+ invokes them.

    **File 1: `.planning/phases/034-supabase-production-setup/scripts/verify.sh`** — bash, executable, accepts `PROD_REF`, `PROD_DIRECT_URL`, `PROD_ANON_KEY` from env. Structure:

    ```bash
    #!/usr/bin/env bash
    # Phase 34 verify harness — orchestrates every DEP-SB-* requirement check.
    # Usage:
    #   PROD_REF=xxx PROD_DIRECT_URL=postgresql://... PROD_ANON_KEY=eyJ... \
    #     bash .planning/phases/034-supabase-production-setup/scripts/verify.sh
    set -uo pipefail

    : "${PROD_REF:?PROD_REF env var required}"
    : "${PROD_DIRECT_URL:?PROD_DIRECT_URL env var required (port 5432, session mode)}"
    : "${PROD_ANON_KEY:?PROD_ANON_KEY env var required}"

    PASS=0; FAIL=0
    check() {
      local name="$1"; shift
      if "$@" >/dev/null 2>&1; then
        echo "  PASS  $name"; PASS=$((PASS+1))
      else
        echo "  FAIL  $name"; FAIL=$((FAIL+1))
      fi
    }

    echo "=== DEP-SB-01: separate digswap-prod project, ref distinct from dev ==="
    check "supabase projects list contains digswap-prod" \
      bash -c 'supabase projects list 2>&1 | grep -q digswap-prod'
    check "linked ref is NOT dev (mrkgoucqcbqjhrdjcnpw)" \
      bash -c '[ "$(cat supabase/.temp/project-ref 2>/dev/null)" != "mrkgoucqcbqjhrdjcnpw" ]'
    check "linked ref equals PROD_REF" \
      bash -c '[ "$(cat supabase/.temp/project-ref 2>/dev/null)" = "$PROD_REF" ]'

    echo "=== DEP-SB-02: 35+ migrations applied via supabase db push ==="
    check "supabase migration list --linked has >=35 entries" \
      bash -c '[ "$(supabase migration list --linked 2>/dev/null | grep -cE "^[[:space:]]*[0-9]{14}")" -ge 35 ]'

    echo "=== DEP-SB-03: RLS probe denies authenticated reads on RLS-locked tables ==="
    check "rls-probe.sql returns visible_profiles=0" \
      bash -c "psql \"\$PROD_DIRECT_URL\" -At -f .planning/phases/034-supabase-production-setup/scripts/rls-probe.sql | grep -qE '^visible_profiles\\|0\$'"

    echo "=== DEP-SB-04: Edge Functions invocable ==="
    check "cleanup-trade-previews returns HTTP 200" \
      bash -c "curl -s -o /dev/null -w '%{http_code}' -X POST \"https://\$PROD_REF.supabase.co/functions/v1/cleanup-trade-previews\" -H \"Authorization: Bearer \$PROD_ANON_KEY\" -H 'Content-Type: application/json' -d '{\"source\":\"verify\",\"bucket\":\"trade-previews\"}' | grep -q '^200$'"
    check "validate-preview returns HTTP 401 for anon" \
      bash -c "curl -s -o /dev/null -w '%{http_code}' -X POST \"https://\$PROD_REF.supabase.co/functions/v1/validate-preview\" -H 'Content-Type: application/json' -d '{}' | grep -q '^401$'"

    echo "=== DEP-SB-05: >=3 active pg_cron jobs ==="
    check "cron.job has >=3 active rows" \
      bash -c "[ \"\$(psql \"\$PROD_DIRECT_URL\" -At -c 'SELECT COUNT(*) FROM cron.job WHERE active = true')\" -ge 3 ]"
    check "every active cron.job runs as role postgres" \
      bash -c "[ \"\$(psql \"\$PROD_DIRECT_URL\" -At -c \"SELECT COUNT(*) FROM cron.job WHERE active = true AND username <> 'postgres'\")\" = '0' ]"

    echo "=== DEP-SB-06: Vault has both required secrets ==="
    check "vault.decrypted_secrets contains trade_preview_project_url + trade_preview_publishable_key" \
      bash -c "[ \"\$(psql \"\$PROD_DIRECT_URL\" -At -c \"SELECT COUNT(*) FROM vault.decrypted_secrets WHERE name IN ('trade_preview_project_url','trade_preview_publishable_key')\")\" = '2' ]"

    echo "=== DEP-SB-07: trade-previews bucket exists, public=false ==="
    check "storage.buckets.trade-previews has public=false" \
      bash -c "[ \"\$(psql \"\$PROD_DIRECT_URL\" -At -c \"SELECT public::text FROM storage.buckets WHERE id='trade-previews'\")\" = 'false' ]"

    echo "=== DEP-SB-10: DATABASE_URL template doc has all three required tokens ==="
    EVIDENCE=.planning/phases/034-supabase-production-setup/evidence/14-database-url-template.txt
    check "evidence/14-database-url-template.txt mentions aws-0-us-east-1.pooler.supabase.com:6543" \
      bash -c "grep -q 'aws-0-us-east-1\\.pooler\\.supabase\\.com:6543' \"\$EVIDENCE\""
    check "evidence/14-database-url-template.txt mentions ?pgbouncer=true" \
      bash -c "grep -q '?pgbouncer=true' \"\$EVIDENCE\""
    check "evidence/14-database-url-template.txt mentions prepare: false" \
      bash -c "grep -q 'prepare: false' \"\$EVIDENCE\""

    echo
    echo "=== SUMMARY: $PASS pass, $FAIL fail ==="
    [ "$FAIL" -eq 0 ]
    ```

    **File 2: `.planning/phases/034-supabase-production-setup/scripts/rls-probe.sql`** — psql script that the verify harness pipes via `psql -f`. Probes 4 RLS-locked tables under role `authenticated` with a constructed JWT claim. Source: RESEARCH.md §4 Step B.

    ```sql
    -- Phase 34 RLS probe — verifies that role 'authenticated' with an arbitrary
    -- user-uuid sees ZERO rows on tables that should be RLS-locked.
    -- Source: 034-RESEARCH.md §4 Step B (L259-L304).
    -- Run via: psql "$PROD_DIRECT_URL" -At -f scripts/rls-probe.sql
    SET ROLE authenticated;
    SET request.jwt.claims TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aud":"authenticated"}';
    SELECT 'visible_profiles|' || COUNT(*) FROM public.profiles;
    SELECT 'visible_dms|' || COUNT(*) FROM public.direct_messages;
    SELECT 'visible_trades|' || COUNT(*) FROM public.trade_requests;
    SELECT 'visible_tokens|' || COUNT(*) FROM public.discogs_tokens;
    RESET ROLE;
    ```

    **File 3: `.planning/phases/034-supabase-production-setup/scripts/drop-and-recreate.md`** — operator runbook for catastrophic mid-trail migration failure. Source: RESEARCH.md §10 L546-L552. Mandatory contents:

    ```markdown
    # Phase 34 — Drop+Recreate Procedure (Catastrophic Halt Only)

    Use ONLY when `supabase db push --linked` fails MID-trail (file N applies, file N+1 errors).
    Migration trail is non-transactional; partial state is unrecoverable on Free tier (no PITR per D-05).
    Drop+recreate loses zero data because prod is empty in Phase 34.

    Source: 034-RESEARCH.md §10 (L529-L554).

    ## Procedure

    1. **Dashboard** → Project Settings → General → **Pause project** (top button).
    2. **Dashboard** → Project Settings → General → **Delete project** (bottom of page; type project name to confirm).
    3. Wait ~2 min for resource teardown to complete.
    4. Repeat Step 1 of 034-RESEARCH.md §2:
       - Dashboard → New project → Org `<your org>` → Name `digswap-prod` → Region **us-east-1 (US East, N. Virginia)** → Pricing **Free** → Database password (use a NEW strong password; store in password manager).
       - Wait ~2 min for provisioning. Capture the new PROD_REF from the dashboard URL.
    5. Update env: `export PROD_REF="<new-ref>"`. Re-run `supabase link --project-ref "$PROD_REF"`.
    6. Resume from RESEARCH.md §2 Step 3 (`supabase db push --linked --dry-run`).

    ## Halt threshold (RESEARCH.md §10 default rule)

    > If a step exceeds 30 minutes of fix attempts, OR if multiple steps fail during the same session,
    > OR if the failure required dropping the prod project once already, halt and open Phase 34.1.
    > Otherwise fix-forward inline.

    ## When NOT to use this

    - Single-file SQL syntax error caught by `--dry-run`: fix the SQL file in repo, re-run dry-run, then live push (RESEARCH.md §10 row "MEDIUM").
    - Edge Function deploy failure: re-run `supabase functions deploy` (independent of DB state).
    - Vault insertion error: investigate via `psql` (root cause likely extension didn't install).
    - CORS dashboard fail: cosmetic only, retry.

    Drop+recreate is acceptable on Phase 34 ONLY because prod has no user data yet. After Phase 38 (UAT users in prod), drop+recreate becomes destructive.
    ```

    **File 4: `.planning/phases/034-supabase-production-setup/evidence/.gitkeep`** — empty file (0 bytes) so the `evidence/` directory exists in the git tree.

    Make `verify.sh` executable: `chmod +x .planning/phases/034-supabase-production-setup/scripts/verify.sh` (run via Bash tool after Write).
  </action>
  <verify>
    <automated>test -x .planning/phases/034-supabase-production-setup/scripts/verify.sh && grep -q 'DEP-SB-01' .planning/phases/034-supabase-production-setup/scripts/verify.sh && grep -q 'DEP-SB-10' .planning/phases/034-supabase-production-setup/scripts/verify.sh && grep -q 'SET ROLE authenticated' .planning/phases/034-supabase-production-setup/scripts/rls-probe.sql && grep -q 'Pause project' .planning/phases/034-supabase-production-setup/scripts/drop-and-recreate.md && test -f .planning/phases/034-supabase-production-setup/evidence/.gitkeep</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/034-supabase-production-setup/scripts/verify.sh` exists, is executable (`test -x` returns 0), references all 8 in-scope requirement IDs (`DEP-SB-01`, `02`, `03`, `04`, `05`, `06`, `07`, `10` — grep each one).
    - File `.planning/phases/034-supabase-production-setup/scripts/rls-probe.sql` exists and contains literal strings `SET ROLE authenticated` and `00000000-0000-0000-0000-000000000001` and `discogs_tokens`.
    - File `.planning/phases/034-supabase-production-setup/scripts/drop-and-recreate.md` exists and contains literal strings `Pause project`, `Delete project`, `us-east-1`, `Phase 34.1`.
    - File `.planning/phases/034-supabase-production-setup/evidence/.gitkeep` exists (0-byte file is acceptable).
    - `verify.sh` is bash-syntax-valid: `bash -n .planning/phases/034-supabase-production-setup/scripts/verify.sh` returns 0.
    - `rls-probe.sql` has no obvious SQL syntax errors as judged by line-grep: contains exactly 4 `SELECT` lines (one per probed table) plus the SET/RESET pair.
  </acceptance_criteria>
  <done>
    All four files written and committed-ready. `verify.sh` executable. No prod project exists yet — Task 2 creates it.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: USER creates digswap-prod Supabase project on dashboard (us-east-1, Free tier)</name>
  <read_first>
    - 034-RESEARCH.md §2 Step 1 (L113-L122) — exact dashboard form fields
    - 034-CONTEXT.md D-01 + D-02 (region locked us-east-1, tier locked Free)
  </read_first>
  <what-built>
    Wave-0 scripts and evidence/ scaffold are committed. The next step requires the operator to create the prod Supabase project on the Dashboard — there is no public CLI/API for project creation (RESEARCH.md §2 Step 1 + §"Architecture Patterns" Pattern 1).
  </what-built>
  <how-to-verify>
    1. Open https://supabase.com/dashboard/projects in a browser (logged in to your Supabase org).
    2. Click **New project**.
    3. Fill in EXACTLY:
       - **Org:** `<your org>`
       - **Name:** `digswap-prod`
       - **Database password:** generate a fresh strong password and store in your password manager (DO NOT reuse dev password; DO NOT type it into any file in this repo).
       - **Region:** `us-east-1 (US East, N. Virginia)` — locked by D-01.
       - **Pricing plan:** **Free** — locked by D-02. Do NOT click Pro.
    4. Click **Create new project**. Wait ~2 minutes for provisioning to finish.
    5. Once provisioned, copy the project ref from the URL: `https://supabase.com/dashboard/project/<PROD_REF>` — the segment after `/project/` is the ref. Store this value somewhere you can paste in Task 3.
    6. Confirm in the dashboard:
       - Settings → General → Region shows `US East (N. Virginia) — us-east-1`.
       - Settings → Billing → Plan shows `Free`.

    Expected outcome: A `digswap-prod` project exists on Supabase Cloud in us-east-1 on the Free tier, ref distinct from dev `mrkgoucqcbqjhrdjcnpw`.
  </how-to-verify>
  <resume-signal>
    Reply with the new prod project ref (e.g., "approved, PROD_REF=abcdef1234567890wxyz") OR describe the issue if creation failed.
  </resume-signal>
  <acceptance_criteria>
    - User confirms project name is exactly `digswap-prod`.
    - User confirms region is `us-east-1 (US East, N. Virginia)`.
    - User confirms tier is `Free` (not Pro, not Team).
    - User provides a 20-character lowercase-alphanumeric project ref distinct from `mrkgoucqcbqjhrdjcnpw`.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: supabase link to prod ref + capture evidence/01 + evidence/02</name>
  <files>
    .planning/phases/034-supabase-production-setup/evidence/01-projects-list.txt,
    .planning/phases/034-supabase-production-setup/evidence/02-link-confirm.txt
  </files>
  <read_first>
    - 034-RESEARCH.md §2 Step 2 (L124-L130) — exact `supabase link` invocation + the post-link confirm via `cat supabase/.temp/project-ref`
    - 034-RESEARCH.md §"Common Pitfalls" Pitfall 1 (L676-L685) — confirm-link bash function pattern
    - 034-VALIDATION.md L44 — DEP-SB-01 automated check
  </read_first>
  <action>
    With the new PROD_REF supplied by the operator in Task 2, link the CLI to the prod project and capture two evidence artifacts.

    **Run (in this order, in the repo root):**

    ```bash
    # 1. Sanity print the env var the operator just supplied (NEVER write the value to a file
    #    other than the two evidence captures below — never stash to .env.local).
    export PROD_REF="<paste-the-20-char-ref-from-task-2>"
    echo "PROD_REF=$PROD_REF"
    [ "$PROD_REF" != "mrkgoucqcbqjhrdjcnpw" ] || { echo "REFUSING: PROD_REF equals dev ref"; exit 1; }

    # 2. Capture supabase projects list — proves digswap-prod exists with a distinct ref.
    supabase projects list \
      | tee .planning/phases/034-supabase-production-setup/evidence/01-projects-list.txt

    # 3. Link CLI to prod (will prompt for the database password set during Task 2).
    supabase link --project-ref "$PROD_REF"

    # 4. Confirm link target equals PROD_REF, NOT dev — capture to evidence/02.
    {
      echo "Phase 34 link confirm — captured $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      echo "Expected PROD_REF: $PROD_REF"
      echo "Linked ref (cat supabase/.temp/project-ref):"
      cat supabase/.temp/project-ref
      echo
      echo "Linked ref MUST NOT equal dev ref mrkgoucqcbqjhrdjcnpw"
    } | tee .planning/phases/034-supabase-production-setup/evidence/02-link-confirm.txt

    # 5. Hard-assert linked ref equals PROD_REF before continuing.
    [ "$(cat supabase/.temp/project-ref)" = "$PROD_REF" ] \
      || { echo "ABORT: linked ref != PROD_REF"; exit 1; }
    [ "$(cat supabase/.temp/project-ref)" != "mrkgoucqcbqjhrdjcnpw" ] \
      || { echo "ABORT: linked to DEV"; exit 1; }
    echo "OK: linked to $PROD_REF (NOT dev)"
    ```

    **No migrations run yet.** Do NOT run `supabase db push` in this plan — that is Plan 02's first action.

    **If `supabase link` fails** (transient / wrong password): retry up to 3× per RESEARCH.md §10 row "LOW". If still failing, halt and surface the error to the user — do NOT delete and recreate the project for a link failure.
  </action>
  <verify>
    <automated>test -s .planning/phases/034-supabase-production-setup/evidence/01-projects-list.txt && grep -q 'digswap-prod' .planning/phases/034-supabase-production-setup/evidence/01-projects-list.txt && test -s .planning/phases/034-supabase-production-setup/evidence/02-link-confirm.txt && grep -q 'Linked ref' .planning/phases/034-supabase-production-setup/evidence/02-link-confirm.txt && test "$(cat supabase/.temp/project-ref)" != 'mrkgoucqcbqjhrdjcnpw'</automated>
  </verify>
  <acceptance_criteria>
    - `evidence/01-projects-list.txt` exists, file size > 0, and contains the literal string `digswap-prod` (proves project visible to the CLI session that captured the file).
    - `evidence/02-link-confirm.txt` exists, file size > 0, contains the literal strings `Phase 34 link confirm`, `Expected PROD_REF:`, `Linked ref`.
    - `cat supabase/.temp/project-ref` returns a 20-char lowercase-alphanumeric value that is NOT `mrkgoucqcbqjhrdjcnpw`.
    - `cat supabase/.temp/project-ref` matches the `PROD_REF` value embedded in `evidence/02-link-confirm.txt` (both reference the same ref).
  </acceptance_criteria>
  <done>
    Two evidence files committed-ready. CLI is linked to `digswap-prod`. No SQL has been applied yet. Wave 1 (Plan 02) can now safely invoke `supabase db push --linked`.
  </done>
</task>

</tasks>

<verification>
- [ ] `bash -n .planning/phases/034-supabase-production-setup/scripts/verify.sh` returns 0 (script is syntactically valid).
- [ ] `grep -c 'DEP-SB-' .planning/phases/034-supabase-production-setup/scripts/verify.sh` ≥ 8.
- [ ] `cat supabase/.temp/project-ref` returns the new PROD_REF and does NOT equal `mrkgoucqcbqjhrdjcnpw`.
- [ ] `evidence/01-projects-list.txt` and `evidence/02-link-confirm.txt` exist and are non-empty.
</verification>

<success_criteria>
- DEP-SB-01 verified: `digswap-prod` project exists on Supabase Cloud in us-east-1 on the Free tier; project ref distinct from dev; CLI is linked.
- Wave-0 harness in place: `verify.sh` (executable), `rls-probe.sql`, `drop-and-recreate.md`, `evidence/.gitkeep` all committed-ready.
- Operator can re-run `bash .planning/phases/034-supabase-production-setup/scripts/verify.sh` from this point onward (it will fail until later plans land migrations / Vault / functions, which is the expected pre-Wave-1 state).
- Zero migrations applied yet — Wave 1 is the next step.
</success_criteria>

<output>
After completion, create `.planning/phases/034-supabase-production-setup/034-01-SUMMARY.md` documenting:
- The new PROD_REF (NOT the database password — that lives in the operator's password manager only).
- The exact contents of `evidence/01-projects-list.txt` and `evidence/02-link-confirm.txt`.
- Confirmation that no migrations have been pushed.
- A note: "Wave 1 (Plan 02) is now safe to start. Halt-on-fail protocol from RESEARCH.md §10 applies starting with the first `supabase db push --linked` invocation."
</output>
