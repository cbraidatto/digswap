---
phase: 035-vercel-environment-wiring
plan: 06
type: execute
wave: 5
depends_on:
  - 035-05-first-prod-deploy-and-verify-PLAN
files_modified:
  - .planning/phases/035-vercel-environment-wiring/evidence/08-playwright-smoke.txt
  - .planning/phases/035-vercel-environment-wiring/evidence/09-verify-final.txt
  - .planning/phases/035-vercel-environment-wiring/035-SUMMARY.md
autonomous: false
requirements:
  - DEP-VCL-10
gap_closure: false

must_haves:
  truths:
    - "Playwright anon-only suite ran against the *.vercel.app deploy URL with PLAYWRIGHT_BASE_URL override (D-17)"
    - "Suite results: zero failures on anon-only specs (auth-required specs are skipped per D-17 — they need a seeded test user which Phase 38 owns)"
    - "evidence/09-verify-final.txt aggregates DEP-VCL-{01..10} status into a single 9-row table (DEP-VCL-07 marked DEFERRED)"
    - "035-SUMMARY.md exists with frontmatter requirements_completed: [DEP-VCL-01,02,03,04,05,06,08,09,10] + requirements_deferred: [DEP-VCL-07]"
  artifacts:
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/08-playwright-smoke.txt"
      provides: "Playwright run summary: passed/skipped/failed counts + report path + any flakies"
      min_lines: 10
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/09-verify-final.txt"
      provides: "Single-pass DEP-VCL-{01..10} status table for /gsd:verify-work consumption"
      min_lines: 15
    - path: ".planning/phases/035-vercel-environment-wiring/035-SUMMARY.md"
      provides: "Phase-level summary tying together all 6 plans + path deviations + deferred items + Phase 36 readiness"
---

<objective>
Wave 4: run Playwright anon-only smoke suite against the `*.vercel.app` deploy URL (D-17 — user explicitly chose this over /api/health-only), aggregate all 9 in-scope DEP-VCL-* checks into `evidence/09-verify-final.txt`, and write `035-SUMMARY.md` paralleling Phase 34 structure.

This plan finalizes Phase 35 — after this, /gsd:verify-work + ROADMAP/STATE close happen in the orchestrator.

Halt-on-fail: Playwright failures need triage. If anon-only specs fail, that's a real Phase 35 blocker (preview is broken). If auth-required specs fail because they're not properly skipped, that's a test selection issue (fix and re-run).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/035-vercel-environment-wiring/035-CONTEXT.md
@.planning/phases/035-vercel-environment-wiring/035-RESEARCH.md
@.planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt
@.planning/phases/035-vercel-environment-wiring/evidence/04-secret-grep-static.txt
@.planning/phases/035-vercel-environment-wiring/evidence/05-hsts-curl.txt
@.planning/phases/035-vercel-environment-wiring/evidence/06-deploy-inspect.txt
@.planning/phases/035-vercel-environment-wiring/evidence/07-health-probe.txt
@apps/web/playwright.config.ts
@apps/web/tests

<interfaces>
Playwright config (after Plan 01 edit):
- `playwright.config.ts` reads `process.env.PLAYWRIGHT_BASE_URL` to override `baseURL`
- `webServer` block disabled when `PLAYWRIGHT_BASE_URL` is external (i.e., starts with `https://`)
- Test files in `apps/web/tests/` — selection via `--grep "@smoke"` or by path

Anon-only spec selection (RESEARCH §10):
- Specs that test public routes (`/`, `/signin`, `/signup`, `/pricing`, `/api/health`) without authenticated state
- Specs that need a logged-in user are SKIPPED in Phase 35 (Phase 38 seeds a real prod user via Auth Admin API)
- Selection mechanism: tests tagged with `@smoke` annotation, or directory-based (`tests/anon/`), or grep pattern

Final verify aggregator (`evidence/09-verify-final.txt`):
- Reads results from evidence/03 + evidence/04 + evidence/05 + evidence/06 + evidence/07 + evidence/08
- Produces 9-row table: DEP-VCL-{01..10} (07 marked DEFERRED), each with PASS/FAIL/DEFERRED status + evidence file ref
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Run Playwright anon-only smoke against *.vercel.app</name>
  <files>.planning/phases/035-vercel-environment-wiring/evidence/08-playwright-smoke.txt</files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §10 (Playwright config + test selection)
    - .planning/phases/035-vercel-environment-wiring/035-CONTEXT.md D-17 (full Playwright suite, NOT just /api/health)
    - apps/web/playwright.config.ts (after Plan 01 edit — must support PLAYWRIGHT_BASE_URL)
  </read_first>
  <action>
```bash
set -u
DEPLOY_URL="$(cat .planning/phases/035-vercel-environment-wiring/evidence/.deploy-url)"
EVIDENCE=".planning/phases/035-vercel-environment-wiring/evidence/08-playwright-smoke.txt"

{
  echo "# Phase 35 Plan 06 Task 1 — Playwright anon smoke"
  echo "# Date: $(date -Is)"
  echo "# Target: $DEPLOY_URL"
  echo "# Selection: anon-only specs (auth-required tests are SKIPPED — Phase 38 owns)"
  echo ""
} > "$EVIDENCE"

cd apps/web

# Run Playwright with BASE_URL override
# If tests are tagged @smoke, use --grep; otherwise fall back to running all tests with PLAYWRIGHT_BASE_URL
# Tests requiring auth will fail-skip via test.skip() or beforeEach guard — those are expected
export PLAYWRIGHT_BASE_URL="$DEPLOY_URL"

# Try @smoke first (preferred — explicit anon tag)
RESULT_FILE=/tmp/playwright-result.json
if pnpm exec playwright test --grep "@smoke" --reporter=json --output="$RESULT_FILE" 2>&1 | tail -50 >> "../../$EVIDENCE"; then
  EXIT_CODE=0
else
  EXIT_CODE=$?
fi

# If no @smoke tag exists in the suite, fall back to running tests in tests/anon/ or all tests
if grep -qE "no tests found" "../../$EVIDENCE"; then
  echo "" >> "../../$EVIDENCE"
  echo "## Fallback: running full suite (no @smoke tag found)" >> "../../$EVIDENCE"
  pnpm exec playwright test --reporter=json --output="$RESULT_FILE" 2>&1 | tail -100 >> "../../$EVIDENCE"
  EXIT_CODE=$?
fi

cd ../..

# Parse summary from the result file (if json reporter wrote it)
{
  echo ""
  echo "## Summary"
  if [ -f "$RESULT_FILE" ]; then
    echo "Playwright JSON report: $RESULT_FILE"
    PASSED=$(jq -r '[.suites[]?.specs[]?.tests[]?.results[]? | select(.status == "passed")] | length' "$RESULT_FILE" 2>/dev/null || echo "?")
    FAILED=$(jq -r '[.suites[]?.specs[]?.tests[]?.results[]? | select(.status == "failed")] | length' "$RESULT_FILE" 2>/dev/null || echo "?")
    SKIPPED=$(jq -r '[.suites[]?.specs[]?.tests[]?.results[]? | select(.status == "skipped")] | length' "$RESULT_FILE" 2>/dev/null || echo "?")
    echo "  Passed: $PASSED"
    echo "  Failed: $FAILED"
    echo "  Skipped: $SKIPPED"
  else
    echo "  (json report not produced — check stderr above)"
  fi
  echo ""
  echo "## Verdict"
  if [ "$EXIT_CODE" -eq 0 ]; then
    echo "✓ DEP-VCL-10 PASS (Playwright anon suite green)"
  else
    echo "⚠ Playwright exited with code $EXIT_CODE — review failures above"
    echo "  If failures are auth-required tests not properly skipped: that's a test config issue, not a build issue"
    echo "  If failures are anon-only tests: that's a real Phase 35 blocker — investigate"
  fi
} >> "$EVIDENCE"

cat "$EVIDENCE" | tail -30
```
  </action>
  <verify>
    <automated>test -s .planning/phases/035-vercel-environment-wiring/evidence/08-playwright-smoke.txt &amp;&amp; (grep -q "DEP-VCL-10 PASS" .planning/phases/035-vercel-environment-wiring/evidence/08-playwright-smoke.txt || grep -qE "Failed: 0\b" .planning/phases/035-vercel-environment-wiring/evidence/08-playwright-smoke.txt) &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - File exists, size > 800 bytes
    - File contains "DEP-VCL-10 PASS" OR "Failed: 0" (anon suite green)
    - File does NOT contain "blocker" or "real Phase 35 blocker" markers
    - File contains a "Summary" section with passed/failed/skipped counts
  </acceptance_criteria>
  <done>
    DEP-VCL-10 fully satisfied (build green + /api/health + Playwright anon suite). Phase 36 cutover unblocked.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Aggregate DEP-VCL-{01..10} into single-pass final verify table</name>
  <files>.planning/phases/035-vercel-environment-wiring/evidence/09-verify-final.txt</files>
  <read_first>
    - All previous evidence files (06, 03, 04, 05, 07, 08) — to extract PASS/FAIL status per DEP-VCL-* requirement
    - .planning/phases/035-vercel-environment-wiring/035-VALIDATION.md (test map)
  </read_first>
  <action>
```bash
set -u
EVIDENCE=".planning/phases/035-vercel-environment-wiring/evidence/09-verify-final.txt"
EVD_DIR=".planning/phases/035-vercel-environment-wiring/evidence"

# Helper: extract status from an evidence file based on grep pattern
status_of() {
  local FILE="$1"; local PATTERN="$2"; local DEFAULT="$3"
  if [ -f "$FILE" ] && grep -qE "$PATTERN" "$FILE"; then echo "PASS"
  elif [ -f "$FILE" ]; then echo "FAIL"
  else echo "$DEFAULT"
  fi
}

DEP01=$(status_of "$EVD_DIR/06-deploy-inspect.txt" "READY|✓ Node 20" "MISSING")
DEP02=$(status_of "$EVD_DIR/03-env-pull-prod-audit.txt" "DEP-VCL-02.*PASS" "MISSING")
DEP03=$(status_of "$EVD_DIR/03b-env-pull-preview-audit.txt" "Dev project ref.*found" "MISSING")
DEP04=$(status_of "$EVD_DIR/04-secret-grep-static.txt" "DEP-VCL-04 PASS" "MISSING")
DEP05=$(status_of "$EVD_DIR/03-env-pull-prod-audit.txt" "DEP-VCL-05.*PASS" "MISSING")
DEP06=$(status_of "$EVD_DIR/03-env-pull-prod-audit.txt" "HMAC PASS" "MISSING")
DEP08=$(status_of "$EVD_DIR/06-deploy-inspect.txt" "Node\\.js Version.*20" "MISSING")
DEP09=$(status_of "$EVD_DIR/05-hsts-curl.txt" "DEP-VCL-09 PASS" "MISSING")
DEP10A=$(status_of "$EVD_DIR/07-health-probe.txt" "DEP-VCL-10 partial PASS" "MISSING")
DEP10B=$(status_of "$EVD_DIR/08-playwright-smoke.txt" "DEP-VCL-10 PASS|Failed: 0" "MISSING")

# Compose final DEP-VCL-10 status (BOTH parts must pass)
if [ "$DEP10A" = "PASS" ] && [ "$DEP10B" = "PASS" ]; then DEP10="PASS"
else DEP10="FAIL"; fi

{
  echo "# Phase 35 — Final Verify (single-pass DEP-VCL-{01..10} aggregator)"
  echo "# Date: $(date -Is)"
  echo "# Source evidence files: 06, 03, 03b, 04, 05, 07, 08"
  echo ""
  echo "| Req       | Status              | Detail                                                          |"
  echo "|-----------|---------------------|-----------------------------------------------------------------|"
  echo "| DEP-VCL-01 | $DEP01              | Project linked + first deploy READY (evidence/06)              |"
  echo "| DEP-VCL-02 | $DEP02              | 21 prod env vars in Production scope only (evidence/03)        |"
  echo "| DEP-VCL-03 | $DEP03              | Preview = Supabase dev, prod ref absent (evidence/03b)         |"
  echo "| DEP-VCL-04 | $DEP04              | Post-build secret grep zero hits (evidence/04)                 |"
  echo "| DEP-VCL-05 | $DEP05              | Exactly 7 NEXT_PUBLIC_* (evidence/03)                          |"
  echo "| DEP-VCL-06 | $DEP06              | HMAC + IMPORT_WORKER >=32 chars, ≠ dev (evidence/03)            |"
  echo "| DEP-VCL-07 | DEFERRED            | Vercel Pro upgrade — trigger: first paying user (D-03)         |"
  echo "| DEP-VCL-08 | $DEP08              | Node.js Version: 20.x (evidence/06)                            |"
  echo "| DEP-VCL-09 | $DEP09              | HSTS max-age=300 launch window (evidence/05)                   |"
  echo "| DEP-VCL-10 | $DEP10              | /api/health 200 + Playwright suite green (evidence/07 + 08)    |"
  echo ""
  echo "## Pass rate"
  TOTAL_IN_SCOPE=9
  PASSES=0
  for s in $DEP01 $DEP02 $DEP03 $DEP04 $DEP05 $DEP06 $DEP08 $DEP09 $DEP10; do
    [ "$s" = "PASS" ] && PASSES=$((PASSES + 1))
  done
  echo "$PASSES / $TOTAL_IN_SCOPE in-scope DEP-VCL-* satisfied"
  echo "1 deferred (DEP-VCL-07 — Free-Tier launch, per CONTEXT.md D-03)"
  echo ""
  if [ "$PASSES" -eq "$TOTAL_IN_SCOPE" ]; then
    echo "## Phase 35 ready to mark COMPLETE in ROADMAP.md + STATE.md"
  else
    echo "## Phase 35 has gaps — investigate FAIL/MISSING rows above before /gsd:verify-work"
  fi
} > "$EVIDENCE"

cat "$EVIDENCE"
```
  </action>
  <verify>
    <automated>test -s .planning/phases/035-vercel-environment-wiring/evidence/09-verify-final.txt &amp;&amp; grep -q "9 / 9" .planning/phases/035-vercel-environment-wiring/evidence/09-verify-final.txt &amp;&amp; grep -q "ready to mark COMPLETE" .planning/phases/035-vercel-environment-wiring/evidence/09-verify-final.txt &amp;&amp; ! grep -q "FAIL\|MISSING" .planning/phases/035-vercel-environment-wiring/evidence/09-verify-final.txt &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - File exists, size > 800 bytes
    - Contains 10-row table (header + 9 in-scope DEP-VCL-* rows + 1 DEFERRED row)
    - Contains "9 / 9 in-scope DEP-VCL-* satisfied"
    - Contains "Phase 35 ready to mark COMPLETE in ROADMAP.md + STATE.md"
    - Zero "FAIL" or "MISSING" entries in the body table
  </acceptance_criteria>
  <done>
    All 9 in-scope DEP-VCL-* requirements aggregated into single-pass evidence. /gsd:verify-work has a single file to read for goal-backward verification.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Write 035-SUMMARY.md (phase-level summary)</name>
  <files>.planning/phases/035-vercel-environment-wiring/035-SUMMARY.md</files>
  <read_first>
    - $HOME/.claude/get-shit-done/templates/summary.md (template structure)
    - .planning/phases/034-supabase-production-setup/034-SUMMARY.md (reference structure from Phase 34)
    - .planning/phases/035-vercel-environment-wiring/evidence/09-verify-final.txt (final status)
    - All 035-NN-SUMMARY.md (Plan-level summaries — to aggregate)
  </read_first>
  <action>
Write `.planning/phases/035-vercel-environment-wiring/035-SUMMARY.md` paralleling Phase 34 SUMMARY structure. Required sections:

- Frontmatter:
  - `phase: 035-vercel-environment-wiring`
  - `status: complete`
  - `mode: MCP+CLI hybrid (with VERCEL_TOKEN-from-~/.vercel-token mitigation per D-20)`
  - `milestone: v1.4 Production Launch`
  - `vercel_team: thiagobraidatto-3732s-projects`
  - `vercel_project: digswap-web`
  - `deploy_url: <captured from evidence/.deploy-url>`
  - `plans_completed: 6`
  - `plans_total: 6`
  - `requirements_addressed: [DEP-VCL-01, DEP-VCL-02, DEP-VCL-03, DEP-VCL-04, DEP-VCL-05, DEP-VCL-06, DEP-VCL-08, DEP-VCL-09, DEP-VCL-10]`
  - `requirements_deferred: [DEP-VCL-07]`
  - `deferred_reason: Free-Tier launch decision (CONTEXT.md D-03). DEP-VCL-07 (Vercel Pro upgrade) tracked for first paying user.`
  - `final_verify: 9/9 in-scope DEP-VCL-* satisfied (evidence/09-verify-final.txt)`
  - `completed: <today>`

- Body:
  - One-paragraph substantive headline (what shipped)
  - Plans table (6 rows: 01-06, with key commits + per-plan SUMMARY links)
  - Path deviations (if any — likely 0 since the planner agent handled most of them already documented; note the planner-quota path-deviation if applicable)
  - Final verify (copy 9-row table from evidence/09)
  - Deferred section (DEP-VCL-07 + Stripe + Sentry + Discogs prod app, all carried forward)
  - Inputs ready for Phase 36 (DNS cutover):
    - Production deploy URL: <from .deploy-url>
    - Vercel project ID + team ID
    - Domain to cut over: digswap.com.br (Hostinger DNS)
    - Note: HSTS still at max-age=300 — bump after Phase 38 + 1-week soak
  - Doc-debt flagged for follow-up QUICK (digswap.com → digswap.com.br already from Phase 34, may have new occurrences from Phase 35 commits to sweep)
  - Evidence inventory (10 files in evidence/, list)
  - Next phase: /gsd:plan-phase 36

After writing, commit via:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" commit "feat(035-06): final verify + phase SUMMARY (9/9 in-scope DEP-VCL-* satisfied)" \
  --files \
    ".planning/phases/035-vercel-environment-wiring/evidence/08-playwright-smoke.txt" \
    ".planning/phases/035-vercel-environment-wiring/evidence/09-verify-final.txt" \
    ".planning/phases/035-vercel-environment-wiring/035-SUMMARY.md"

node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap update-plan-progress "035" "06"
```
  </action>
  <verify>
    <automated>test -s .planning/phases/035-vercel-environment-wiring/035-SUMMARY.md &amp;&amp; grep -q "status: complete" .planning/phases/035-vercel-environment-wiring/035-SUMMARY.md &amp;&amp; grep -q "requirements_addressed.*DEP-VCL-01.*DEP-VCL-10" .planning/phases/035-vercel-environment-wiring/035-SUMMARY.md &amp;&amp; grep -q "requirements_deferred.*DEP-VCL-07" .planning/phases/035-vercel-environment-wiring/035-SUMMARY.md &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - File exists, size > 3000 bytes
    - Frontmatter `status: complete`
    - Frontmatter `requirements_addressed` lists all 9 in-scope DEP-VCL-* IDs
    - Frontmatter `requirements_deferred: [DEP-VCL-07]`
    - Body contains 6-row Plans table
    - Body contains the 10-row final verify table copied from evidence/09
    - Body contains "Inputs ready for Phase 36" section with the deploy URL and domain
    - Body links to /gsd:plan-phase 36 as the next step
  </acceptance_criteria>
  <done>
    Phase 35 SUMMARY committed. /gsd:execute-phase orchestrator can now mark Phase 35 complete and advance STATE.md to Phase 36.
  </done>
</task>

</tasks>

<halt_on_fail>
Per RESEARCH §11:
- Task 1 Playwright suite has failures → triage: are they anon-only specs (real blocker) or auth-required not-properly-skipped (test config bug)? If real blocker, halt + fix root cause + redeploy. If test config bug, fix the spec or grep selection.
- Task 2 aggregator shows any FAIL/MISSING in the table → BLOCK Task 3 SUMMARY write. Investigate which evidence file is missing/wrong, fix, re-run Tasks 1-2 of this plan.
- Task 3 SUMMARY commit fails → re-attempt. If persistent, manually `git add` + `git commit` with same message.
</halt_on_fail>
