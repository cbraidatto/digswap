---
phase: 034-supabase-production-setup
plan: 02
type: execute
wave: 1
depends_on: ["034-01"]
files_modified:
  - .planning/phases/034-supabase-production-setup/evidence/03-dry-run.txt
  - .planning/phases/034-supabase-production-setup/evidence/04-db-push.txt
  - .planning/phases/034-supabase-production-setup/evidence/05-security-advisor.png
  - .planning/phases/034-supabase-production-setup/evidence/05b-rls-probe.txt
autonomous: false
requirements: [DEP-SB-02, DEP-SB-03]
requirements_addressed: [DEP-SB-02, DEP-SB-03]
gap_closure: false
must_haves:
  truths:
    - "All 35 migrations from supabase/migrations/ apply cleanly to digswap-prod via supabase db push --linked, in lexical order"
    - "supabase db push was preceded by a successful --dry-run that listed all 35 files and flagged none as 'would skip'"
    - "Security Advisor (Dashboard → Advisors) reports zero 'Tables without RLS enabled' findings, zero 'Policies that reference missing columns' findings"
    - "Under role authenticated with a constructed JWT for an arbitrary uuid, RLS-locked tables (profiles, direct_messages, trade_requests, discogs_tokens) return 0 rows on the empty prod project"
    - "Halt-on-fail protocol per RESEARCH.md §10 was honored — the executor either succeeded cleanly or invoked drop-and-recreate.md"
  artifacts:
    - path: ".planning/phases/034-supabase-production-setup/evidence/03-dry-run.txt"
      provides: "Full stdout of supabase db push --linked --dry-run, proving the trail enumerates 35 files in order with no skips"
      contains: "would apply"
    - path: ".planning/phases/034-supabase-production-setup/evidence/04-db-push.txt"
      provides: "Full stdout of the live supabase db push --linked, including final summary"
      contains: "Applying migration"
    - path: ".planning/phases/034-supabase-production-setup/evidence/05-security-advisor.png"
      provides: "Dashboard screenshot of Security Advisor green verdict (no API exists for this state)"
    - path: ".planning/phases/034-supabase-production-setup/evidence/05b-rls-probe.txt"
      provides: "psql output of rls-probe.sql under role authenticated, proving 0 rows on RLS-locked tables"
      contains: "visible_profiles|0"
  key_links:
    - from: "supabase db push --linked"
      to: "supabase/migrations/*.sql"
      via: "supabase CLI migration runner (NOT drizzle-kit)"
      pattern: "supabase db push --linked"
    - from: "scripts/rls-probe.sql"
      to: "evidence/05b-rls-probe.txt"
      via: "psql -f"
      pattern: "rls-probe\\.sql"
---

<objective>
Apply the entire 35-file `supabase/migrations/` trail to digswap-prod via `supabase db push --linked` (never drizzle-kit; ADR-003 enforces), then verify RLS is correctly applied via the Dashboard Security Advisor AND the JWT-bound psql probe under role authenticated. This is the highest halt-on-fail risk plan in Phase 34 — catastrophic mid-trail failures route to scripts/drop-and-recreate.md.

Purpose: DEP-SB-02 + DEP-SB-03 must both be green before any pg_cron tick fires (next hour at :00) and before any Edge Function is deployed against this DB. The Pitfall #5 + Pitfall #4 protections require a real-JWT probe (not just service_role) and a project-ref re-confirmation BEFORE every push invocation. Phase 33 evidence/02b-throwaway-cloud.txt already proved this exact migration trail resets clean against an empty Cloud project on commit 090bdcc — Phase 34 inherits that proof; live push should be uneventful.

Output: 4 evidence artifacts (1 dry-run text, 1 live push text, 1 dashboard screenshot, 1 RLS probe text) + a clean prod schema with all 35 migrations applied + Security Advisor green verdict on file.
</objective>

<execution_context>
@C:\Users\INTEL\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\INTEL\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/phases/034-supabase-production-setup/034-CONTEXT.md
@.planning/phases/034-supabase-production-setup/034-RESEARCH.md
@.planning/phases/034-supabase-production-setup/034-VALIDATION.md
@.planning/phases/034-supabase-production-setup/034-01-SUMMARY.md
@.planning/phases/034-supabase-production-setup/scripts/drop-and-recreate.md
@.planning/phases/034-supabase-production-setup/scripts/rls-probe.sql
@.planning/ADR-003-drizzle-dev-only.md
@.planning/phases/033-pre-deploy-audit-gate/033-VERIFICATION.md
@supabase/migrations
</context>

<halt_on_fail_protocol>
This plan operates under the halt-on-fail protocol defined in 034-RESEARCH.md §10 (L529-L554). Do NOT re-derive or improvise:

| Failure Mode | Action |
|--------------|--------|
| `--dry-run` reports "would skip" / "already applied" on the empty prod | STOP. Verify project ref. If ref correct → invoke `scripts/drop-and-recreate.md`. |
| `supabase db push --linked` fails MID-trail (file N applies, file N+1 errors) | **CRITICAL — invoke `scripts/drop-and-recreate.md` immediately.** Do not fix-forward. |
| Single-file SQL syntax error caught by `--dry-run` | Fix the SQL file in repo, re-run dry-run, then live push. |
| Security Advisor reports a regression | HALT. If fix exceeds 2h or > 1 red, open Phase 34.1. |
| `supabase link` transient failure | Retry up to 3×. |

Default rule: If a step exceeds 30 minutes of fix attempts, OR if multiple steps fail in the same session, OR if drop-and-recreate has already been invoked once, HALT and open Phase 34.1.
</halt_on_fail_protocol>

<tasks>

<task type="auto">
  <name>Task 1: Re-confirm link target + dry-run + live db push</name>
  <files>
    .planning/phases/034-supabase-production-setup/evidence/03-dry-run.txt,
    .planning/phases/034-supabase-production-setup/evidence/04-db-push.txt
  </files>
  <read_first>
    - 034-RESEARCH.md §2 Steps 3-4 (L131-L139) — exact dry-run + live push commands
    - 034-RESEARCH.md §3 (L213-L243) — Migration Trail Strategy: two terminal-level safety checks before every push
    - 034-RESEARCH.md §10 (L529-L554) — halt-on-fail protocol (especially the "MID-trail failure" CRITICAL row)
    - .planning/phases/034-supabase-production-setup/scripts/drop-and-recreate.md — recovery procedure
    - .planning/ADR-003-drizzle-dev-only.md — drizzle-kit is FORBIDDEN against prod
  </read_first>
  <action>
    Re-confirm the CLI is still linked to PROD_REF (not dev), then run the dry-run, capture stdout, then run the live push, capture stdout.

    **Run (in this order, in repo root, with `PROD_REF` exported in the shell):**

    ```bash
    # Pre-flight — Pitfall #4 protection. Pre-confirm link before EVERY destructive command.
    supabase projects list \
      | tee -a .planning/phases/034-supabase-production-setup/evidence/01-projects-list.txt
    test -f supabase/.temp/project-ref || { echo "ABORT: not linked. Re-run 034-01 Task 3."; exit 1; }
    LINKED="$(cat supabase/.temp/project-ref)"
    [ "$LINKED" = "$PROD_REF" ] \
      || { echo "ABORT: linked=$LINKED, PROD_REF=$PROD_REF (mismatch)"; exit 1; }
    [ "$LINKED" != "mrkgoucqcbqjhrdjcnpw" ] \
      || { echo "ABORT: linked to DEV — refusing to push"; exit 1; }
    echo "OK: linked to PROD_REF=$LINKED — proceeding"

    # 1. DRY-RUN — surfaces ordering / syntax errors before live apply.
    #    Capture full stdout to evidence/03-dry-run.txt for the verifier to replay.
    supabase db push --linked --dry-run 2>&1 \
      | tee .planning/phases/034-supabase-production-setup/evidence/03-dry-run.txt

    # Hard-check: dry-run output must include "would apply" lines and must NOT include "would skip".
    if grep -qi 'would skip' .planning/phases/034-supabase-production-setup/evidence/03-dry-run.txt; then
      echo "ABORT: dry-run reports 'would skip' — project not empty."
      echo "Invoke scripts/drop-and-recreate.md (RESEARCH.md §10 row HIGH)."
      exit 1
    fi
    APPLY_COUNT=$(grep -ciE 'would apply|applying migration' .planning/phases/034-supabase-production-setup/evidence/03-dry-run.txt)
    [ "$APPLY_COUNT" -ge 30 ] \
      || { echo "ABORT: dry-run mentions only $APPLY_COUNT migrations; expected ~35."; exit 1; }

    # 2. LIVE PUSH — applies all migrations. Capture full stdout.
    supabase db push --linked 2>&1 \
      | tee .planning/phases/034-supabase-production-setup/evidence/04-db-push.txt
    PUSH_EXIT=${PIPESTATUS[0]}

    if [ "$PUSH_EXIT" -ne 0 ]; then
      echo "MID-TRAIL FAILURE — RESEARCH.md §10 CRITICAL row applies."
      echo "Action: invoke scripts/drop-and-recreate.md, then resume from Plan 02 Task 1."
      exit 1
    fi

    # 3. Sanity — at least 30 lines of "Applying migration" output (35 expected).
    APPLIED=$(grep -ciE 'applying migration|finished migration' .planning/phases/034-supabase-production-setup/evidence/04-db-push.txt)
    echo "Migrations referenced in push log: $APPLIED"
    [ "$APPLIED" -ge 30 ] \
      || { echo "ABORT: push log shows only $APPLIED migration markers; expected ~35."; exit 1; }

    # 4. Confirm migration history table is populated.
    supabase migration list --linked \
      | tee -a .planning/phases/034-supabase-production-setup/evidence/04-db-push.txt
    ```

    **If push fails mid-trail:** stop immediately, do not retry, do not attempt fix-forward. Open `.planning/phases/034-supabase-production-setup/scripts/drop-and-recreate.md` and follow the 6 steps. Then return to Plan 02 Task 1 from the top.

    **If push succeeds but `supabase migration list --linked` shows fewer than 35 entries:** the trail did not fully apply — capture the discrepancy in `evidence/04-db-push.txt` as a tail-appended note and surface to the user before proceeding to Task 2.

    **DO NOT:** Run `drizzle-kit push`, `drizzle-kit migrate`, or any psql DDL by hand. ADR-003 + `scripts/drizzle-prod-guard.mjs` forbid these against prod.
  </action>
  <verify>
    <automated>test -s .planning/phases/034-supabase-production-setup/evidence/03-dry-run.txt && grep -qiE 'would apply|applying migration' .planning/phases/034-supabase-production-setup/evidence/03-dry-run.txt && ! grep -qi 'would skip' .planning/phases/034-supabase-production-setup/evidence/03-dry-run.txt && test -s .planning/phases/034-supabase-production-setup/evidence/04-db-push.txt && grep -qiE 'applying migration|finished migration' .planning/phases/034-supabase-production-setup/evidence/04-db-push.txt && [ "$(supabase migration list --linked 2>/dev/null | grep -cE '^[[:space:]]*[0-9]{14}')" -ge 35 ]</automated>
  </verify>
  <acceptance_criteria>
    - `evidence/03-dry-run.txt` exists, file size > 0, contains literal `would apply` (or equivalent CLI output) at least once.
    - `evidence/03-dry-run.txt` does NOT contain `would skip` (case-insensitive).
    - `evidence/04-db-push.txt` exists, file size > 0, contains `Applying migration` (case-insensitive) at least 30 times.
    - `supabase migration list --linked` (live query) returns ≥35 rows that match the 14-digit timestamp pattern.
    - Linked ref still equals `$PROD_REF` AND is NOT `mrkgoucqcbqjhrdjcnpw` after the push.
    - `node scripts/drizzle-prod-guard.mjs` (if invoked against the prod URL) exits 0 — no drizzle-kit was used.
  </acceptance_criteria>
  <done>
    All 35 migrations applied to digswap-prod. Schema is in the same state as the throwaway Cloud project verified in Phase 33 evidence/02b. DEP-SB-02 satisfied.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: USER runs Security Advisor in Dashboard + captures screenshot</name>
  <read_first>
    - 034-RESEARCH.md §4 Step A (L249-L257) — exact Dashboard path and expected GREEN state
    - 034-VALIDATION.md L77 — manual-only verifications table row for DEP-SB-03
  </read_first>
  <what-built>
    All 35 migrations are applied to digswap-prod. Security Advisor lives in the Dashboard UI; the CLI cannot dump its verdict (RESEARCH.md §4 Step A). Operator confirmation + screenshot is the only evidence form available.
  </what-built>
  <how-to-verify>
    1. Open https://supabase.com/dashboard/project/$PROD_REF/database/security in a browser (logged in to your Supabase org). Path: Project (`digswap-prod`) → **Advisors** (left nav) → **Security Advisor**.
    2. Click **Run advisor**. Wait ~30 seconds for the scan to complete.
    3. Confirm the GREEN state — every section below must show ZERO findings:
       - **Tables without RLS enabled** → 0
       - **Policies that reference missing columns** → 0
       - **Functions without secure search_path** → 0 (or only Supabase-managed entries you cannot fix)
       - **Auth policies** section → no high/critical findings
    4. Take a screenshot of the Security Advisor results page (the full advisor verdict, not just the header).
    5. Save the screenshot to `.planning/phases/034-supabase-production-setup/evidence/05-security-advisor.png`. File size MUST be > 10 KB (proves it's a real screenshot, not an empty placeholder).

    **Halt-on-fail (per RESEARCH.md §10 row HIGH):**
    - If 1 finding appears and the fix is small (e.g., add a missing policy via a new migration), fix-forward inline: write the migration, run another `supabase db push --linked`, re-run advisor.
    - If 2+ findings OR the fix exceeds 2 hours of effort, halt and open Phase 34.1.

    Expected outcome: `evidence/05-security-advisor.png` is on disk, file size > 10 KB, depicting the green advisor verdict with zero high/critical findings.
  </how-to-verify>
  <resume-signal>
    Reply with "approved" once `evidence/05-security-advisor.png` is saved AND the advisor was green. If any findings appeared, describe them and the fix-forward decision.
  </resume-signal>
  <acceptance_criteria>
    - File `.planning/phases/034-supabase-production-setup/evidence/05-security-advisor.png` exists.
    - `stat` reports the file is a regular file with size > 10 KB.
    - User confirmation in resume signal includes "approved" OR a decision log of the fix-forward path taken.
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: JWT-bound RLS probe under role authenticated</name>
  <files>
    .planning/phases/034-supabase-production-setup/evidence/05b-rls-probe.txt
  </files>
  <read_first>
    - 034-RESEARCH.md §4 Step B (L259-L304) — exact rationale + SQL pattern (Pitfall #5: service_role masks RLS gaps)
    - .planning/phases/034-supabase-production-setup/scripts/rls-probe.sql — the probe to run (built in Plan 01 Task 1)
    - 034-VALIDATION.md L46 — DEP-SB-03 automated check
  </read_first>
  <action>
    Run the JWT-bound psql probe against the prod direct (session-mode) URL. The probe asserts that under role `authenticated` with a constructed JWT for an arbitrary uuid, every RLS-locked table returns 0 rows on the empty prod project.

    **Pre-requisite:** the operator has the prod direct (session-mode, port **5432**, NOT 6543) connection string. Source: Dashboard → Settings → Database → Connection string → URI (Session mode). Pass via env at runtime — never write to `.env.local`.

    **Run:**

    ```bash
    # Operator pastes the session-mode (port 5432) URL — NOT the pooler URL.
    read -s -p "Paste PROD_DIRECT_URL (port 5432, session mode): " PROD_DIRECT_URL
    echo
    [ -n "$PROD_DIRECT_URL" ] || { echo "ABORT: PROD_DIRECT_URL empty"; exit 1; }
    echo "$PROD_DIRECT_URL" | grep -q ':5432' \
      || { echo "ABORT: URL must contain :5432 (session mode), not :6543 (pooler)"; exit 1; }

    # Run the rls-probe.sql created in Plan 01 Task 1, capture stdout.
    psql "$PROD_DIRECT_URL" -At \
      -f .planning/phases/034-supabase-production-setup/scripts/rls-probe.sql \
      2>&1 | tee .planning/phases/034-supabase-production-setup/evidence/05b-rls-probe.txt

    # Hard-assert each visible_* row equals 0.
    for row in visible_profiles visible_dms visible_trades visible_tokens; do
      if ! grep -qE "^${row}\\|0\$" .planning/phases/034-supabase-production-setup/evidence/05b-rls-probe.txt; then
        echo "ABORT: $row != 0 — RLS misconfigured (Pitfall #5)."
        echo "Halt per RESEARCH.md §10 row HIGH: open Phase 34.1 for investigation."
        exit 1
      fi
    done
    echo "OK: all RLS probes returned 0 rows under role authenticated."
    ```

    **Negative sanity check (optional but cheap):** confirm the `handoff_tokens` USING-false policy denies authenticated reads. RESEARCH.md §4 Step B "Negative sanity check" (L297-L304):

    ```bash
    psql "$PROD_DIRECT_URL" -c \
      "SET ROLE authenticated; SET request.jwt.claims TO '{\"sub\":\"00000000-0000-0000-0000-000000000001\",\"role\":\"authenticated\",\"aud\":\"authenticated\"}'; SELECT COUNT(*) FROM public.handoff_tokens; RESET ROLE;" \
      2>&1 | tee -a .planning/phases/034-supabase-production-setup/evidence/05b-rls-probe.txt
    # Acceptable outputs: ERROR (USING(false) deny) OR count=0. A non-zero count means the policy regressed.
    ```

    **DO NOT:**
    - Use the pooler URL (port 6543) for this — Vault writes and `SET request.jwt.claims` semantics need a real session.
    - Use the service_role key for this probe — service_role bypasses RLS and would falsely pass (Pitfall #5).
    - Persist `PROD_DIRECT_URL` to `.env.local` or any committed file.
  </action>
  <verify>
    <automated>test -s .planning/phases/034-supabase-production-setup/evidence/05b-rls-probe.txt && grep -qE '^visible_profiles\|0$' .planning/phases/034-supabase-production-setup/evidence/05b-rls-probe.txt && grep -qE '^visible_dms\|0$' .planning/phases/034-supabase-production-setup/evidence/05b-rls-probe.txt && grep -qE '^visible_trades\|0$' .planning/phases/034-supabase-production-setup/evidence/05b-rls-probe.txt && grep -qE '^visible_tokens\|0$' .planning/phases/034-supabase-production-setup/evidence/05b-rls-probe.txt</automated>
  </verify>
  <acceptance_criteria>
    - `evidence/05b-rls-probe.txt` exists, file size > 0.
    - File contains exactly these 4 substrings (one per probed table), all with count `0`:
      - `visible_profiles|0`
      - `visible_dms|0`
      - `visible_trades|0`
      - `visible_tokens|0`
    - `evidence/05b-rls-probe.txt` does NOT contain any line where a `visible_*` count is greater than 0.
    - The probe ran via `psql -f` referencing the existing `scripts/rls-probe.sql` (proves Plan 01 Wave-0 scaffolding actually got used).
  </acceptance_criteria>
  <done>
    DEP-SB-03 satisfied: Security Advisor green AND JWT-bound psql probe shows 0 rows on RLS-locked tables. Schema and RLS posture on digswap-prod match the dev project's verified-clean state. Wave 2 (Plans 03 + 04) is now safe to start.
  </done>
</task>

</tasks>

<verification>
- [ ] `evidence/03-dry-run.txt` exists; contains `would apply`; does NOT contain `would skip`.
- [ ] `evidence/04-db-push.txt` exists; contains ≥30 occurrences of `Applying migration`.
- [ ] `supabase migration list --linked` returns ≥35 rows.
- [ ] `evidence/05-security-advisor.png` exists; file size > 10 KB.
- [ ] `evidence/05b-rls-probe.txt` exists; all 4 `visible_*|0` lines present; no `visible_*` line with count > 0.
- [ ] `cat supabase/.temp/project-ref` still equals PROD_REF (not dev) — link did not drift mid-plan.
- [ ] No `drizzle-kit` invocations were made (search shell history if uncertain).
</verification>

<success_criteria>
- DEP-SB-02: All migrations applied via `supabase db push --linked`; `supabase migration list --linked` shows ≥35 entries; ADR-003 + drizzle-prod-guard not violated.
- DEP-SB-03: Security Advisor verdict green (screenshot on file); RLS probe under role authenticated returns 0 rows on every probed RLS-locked table.
- Halt-on-fail protocol from RESEARCH.md §10 was honored: either no halt occurred OR the appropriate scripts/drop-and-recreate.md path was taken.
</success_criteria>

<output>
After completion, create `.planning/phases/034-supabase-production-setup/034-02-SUMMARY.md` documenting:
- Number of migrations applied (cite `supabase migration list --linked` count).
- Whether any halt-on-fail event was triggered (most likely "no — clean push").
- The 4 evidence artifacts and their byte sizes.
- The RLS probe results — quote the four `visible_*|0` lines from `evidence/05b-rls-probe.txt`.
- A note: "Wave 2 plans (034-03 Vault+cron, 034-04 Edge Functions+bucket+CORS) are now safe to start in parallel."
</output>
