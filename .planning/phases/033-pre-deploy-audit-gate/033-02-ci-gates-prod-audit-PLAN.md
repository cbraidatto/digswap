---
phase: 033-pre-deploy-audit-gate
plan: 02
type: execute
wave: 1
depends_on: [033-01]
files_modified:
  - .planning/phases/033-pre-deploy-audit-gate/evidence/00-head.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/01a-typecheck.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/01b-lint.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/01c-test.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/01d-build.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/01e-audit.txt
  - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
autonomous: true
requirements: [DEP-AUD-01]

must_haves:
  truths:
    - "4 CI gates (typecheck, lint, test, build) complete against main HEAD with exit code 0"
    - "pnpm audit --prod --audit-level high reports zero HIGH/CRITICAL advisories"
    - "Each gate's stdout+stderr is captured in evidence/01*-*.txt via tee"
    - "AUDIT-REPORT.md §1 shows PASS verdict with main HEAD sha and tail excerpts"
  artifacts:
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/00-head.txt"
      provides: "main HEAD sha captured at audit start"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/01a-typecheck.txt"
      provides: "tsc --noEmit output"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/01b-lint.txt"
      provides: "Biome lint output"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/01c-test.txt"
      provides: "Vitest run output"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/01d-build.txt"
      provides: "next build output"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/01e-audit.txt"
      provides: "pnpm audit --prod output"
      contains: ""
  key_links:
    - from: ".planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md §1"
      to: ".planning/phases/033-pre-deploy-audit-gate/evidence/01*-*.txt"
      via: "§1 references evidence/ filenames and pastes last ~20 lines of each"
      pattern: "evidence/01"
---

<objective>
DEP-AUD-01: prove all 4 CI gates and the prod-only pnpm audit run clean against current main HEAD. This is an independent re-run of what CI already runs on every push — the point is to capture the outputs locally with timestamps for the audit record, not to retest what CI tested.

Purpose: ROADMAP criterion 1 requires both (a) the 4 gates green, AND (b) `pnpm audit --prod --audit-level high` reports zero HIGH/CRITICAL. Phase 33 cannot declare baseline cleanliness without this evidence. Runs in parallel with Plan 03 (Wave 1b).

Output: Six evidence files (00-head.txt + 01a..01e) and an updated AUDIT-REPORT.md §1 with the verdict line.
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/033-pre-deploy-audit-gate/033-CONTEXT.md
@.planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md
@.planning/phases/033-pre-deploy-audit-gate/033-VALIDATION.md
@.planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
@apps/web/package.json
@.github/workflows/ci.yml

<interfaces>
<!-- Script names verified 2026-04-21 against apps/web/package.json: -->
<!--   typecheck -> tsc --noEmit -->
<!--   lint      -> biome check -->
<!--   test      -> vitest run -->
<!--   build     -> next build -->
<!-- All invoked via pnpm --filter @digswap/web <script> from repo root. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Capture main HEAD and run all 4 CI gates with tee</name>
  <files>
    .planning/phases/033-pre-deploy-audit-gate/evidence/00-head.txt
    .planning/phases/033-pre-deploy-audit-gate/evidence/01a-typecheck.txt
    .planning/phases/033-pre-deploy-audit-gate/evidence/01b-lint.txt
    .planning/phases/033-pre-deploy-audit-gate/evidence/01c-test.txt
    .planning/phases/033-pre-deploy-audit-gate/evidence/01d-build.txt
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md §Audit 1 (exact command sequence + pass/fail thresholds)
    - .planning/phases/033-pre-deploy-audit-gate/033-CONTEXT.md (D-12 — paste output directly in AUDIT-REPORT)
    - apps/web/package.json (confirm script names typecheck / lint / test / build)
    - .github/workflows/ci.yml (CI env-var prelude — set the same env vars locally if build requires them)
  </read_first>
  <action>
Run the 4 CI gates against main HEAD from the repo root. Every command uses `2>&1 | tee <evidence>` to capture both stdout and stderr.

**Step 1 — Capture main HEAD:**

```bash
# Must be on main or have checked out main's HEAD
git rev-parse HEAD > .planning/phases/033-pre-deploy-audit-gate/evidence/00-head.txt
git log -1 --oneline >> .planning/phases/033-pre-deploy-audit-gate/evidence/00-head.txt
```

**Step 2 — Run the 4 gates in this exact order** (from repo root; use Git Bash / WSL on Windows — PowerShell's `Tee-Object` forces CRLF and breaks grep):

```bash
# Typecheck — ~30s
pnpm --filter @digswap/web typecheck 2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/01a-typecheck.txt
echo "typecheck exit=$?" >> .planning/phases/033-pre-deploy-audit-gate/evidence/01a-typecheck.txt

# Lint — ~10s
pnpm --filter @digswap/web lint 2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/01b-lint.txt
echo "lint exit=$?" >> .planning/phases/033-pre-deploy-audit-gate/evidence/01b-lint.txt

# Test — ~60-90s
pnpm --filter @digswap/web test 2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/01c-test.txt
echo "test exit=$?" >> .planning/phases/033-pre-deploy-audit-gate/evidence/01c-test.txt

# Build — ~60-120s
pnpm --filter @digswap/web build 2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/01d-build.txt
echo "build exit=$?" >> .planning/phases/033-pre-deploy-audit-gate/evidence/01d-build.txt
```

**Pass thresholds (per RESEARCH.md §Audit 1):**

| Gate | PASS criterion (check after the command runs) |
|------|-----------------------------------------------|
| typecheck | `grep "typecheck exit=0" evidence/01a-typecheck.txt` |
| lint | `grep "lint exit=0" evidence/01b-lint.txt` (warnings allowed; errors forbidden) |
| test | `grep "test exit=0" evidence/01c-test.txt` AND test footer shows 0 failed |
| build | `grep "build exit=0" evidence/01d-build.txt` AND output includes `✓ Generating static pages` |

**Common gotchas:**

1. **Port 3000 busy from another Next dev server** — `next build` doesn't need :3000, but if a previous `pnpm start` is still running, kill it: `lsof -ti:3000 | xargs -r kill` (Git Bash) or close the terminal that owns it.
2. **`.env.local` required for the build's Zod env schema** — per `apps/web/src/lib/env.ts`, HANDOFF_HMAC/STRIPE vars are production-required. Running the audit against main expects a working `.env.local` populated with dev values.
3. **`pnpm --filter @digswap/web <script>` from repo root** works because pnpm walks up to the workspace — no `cd apps/web` needed.

**If any gate fails (per D-10, D-16):**

- Typecheck errors → open the exact files cited in the output; D-16 allows ≤2h inline fix. If the error is beyond 2h, mark this plan BLOCKED and open decimal phase 33.1.
- Lint errors → `pnpm --filter @digswap/web lint --write` fixes autofixable issues; commit the fixes separately and re-run.
- Test failure → if flaky, re-run ONCE; if deterministic, fail-inline per D-16.
- Build failure → most often an env.ts Zod miss; populate the missing var in `.env.local` and re-run.

Record any fix commits in AUDIT-REPORT.md §1 "Notes" subsection below the verdict.

**Time budget (per RESEARCH.md):** ~8–15 min total if green on first run.
  </action>
  <verify>
    <automated>test -f .planning/phases/033-pre-deploy-audit-gate/evidence/00-head.txt && grep -q "typecheck exit=0" .planning/phases/033-pre-deploy-audit-gate/evidence/01a-typecheck.txt && grep -q "lint exit=0" .planning/phases/033-pre-deploy-audit-gate/evidence/01b-lint.txt && grep -q "test exit=0" .planning/phases/033-pre-deploy-audit-gate/evidence/01c-test.txt && grep -q "build exit=0" .planning/phases/033-pre-deploy-audit-gate/evidence/01d-build.txt && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `evidence/00-head.txt` exists and contains a 40-char git sha
    - `evidence/01a-typecheck.txt` exists and contains `typecheck exit=0`
    - `evidence/01b-lint.txt` exists and contains `lint exit=0`
    - `evidence/01c-test.txt` exists and contains `test exit=0`
    - `evidence/01d-build.txt` exists and contains `build exit=0`
    - `evidence/01d-build.txt` contains the substring `Generating static pages` (proves Next build actually completed)
    - `evidence/01c-test.txt` does NOT contain `failed (` with a non-zero number immediately before (simple heuristic: no `FAIL ` line in the last 30 lines)
  </acceptance_criteria>
  <done>All 4 CI gates green against main HEAD with outputs captured to evidence/.</done>
</task>

<task type="auto">
  <name>Task 2: Run pnpm audit --prod --audit-level high and populate AUDIT-REPORT.md §1</name>
  <files>
    .planning/phases/033-pre-deploy-audit-gate/evidence/01e-audit.txt
    .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/evidence/01a-typecheck.txt (Task 1 output — copy tail for AUDIT-REPORT summary)
    - .planning/phases/033-pre-deploy-audit-gate/evidence/01b-lint.txt (same)
    - .planning/phases/033-pre-deploy-audit-gate/evidence/01c-test.txt (same)
    - .planning/phases/033-pre-deploy-audit-gate/evidence/01d-build.txt (same)
    - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md (current §1 skeleton from Plan 01)
    - .planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md §Common Pitfalls C (why --prod --audit-level high matters)
  </read_first>
  <action>
Run the dependency audit, then populate AUDIT-REPORT.md §1 with a PASS verdict and tail excerpts.

**Step 1 — Run the prod-only audit from repo root:**

```bash
# Must be run from repo root — pnpm audit walks the workspace deps
pnpm audit --prod --audit-level high 2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/01e-audit.txt
echo "audit exit=$?" >> .planning/phases/033-pre-deploy-audit-gate/evidence/01e-audit.txt
```

**Pass criterion:**

- Exit code 0 (written as `audit exit=0` at the tail) OR the output contains `No known vulnerabilities found`
- The output does NOT contain any line with severity `high` or `critical` (severity `moderate` / `low` are tolerated by `--audit-level high`)

Confirm via:

```bash
grep -iE "high|critical" .planning/phases/033-pre-deploy-audit-gate/evidence/01e-audit.txt | \
  grep -iv "No known vulnerabilities" | \
  grep -iv "audit-level high"   # filter out the command flag itself
```

If that pipeline outputs any lines that describe an actual advisory (i.e., a package name + severity), treat as FAIL per D-16 — fix inline (update the dep or add a justified override). If only `moderate` / `low` appear, that's PASS.

**Step 2 — Populate AUDIT-REPORT.md §1.**

Read the current `AUDIT-REPORT.md`, then replace the §1 block (from `## §1 DEP-AUD-01 CI Gates + Prod Audit` up to `## §2`) with this exact content, substituting the real values:

```markdown
## §1 DEP-AUD-01 CI Gates + Prod Audit

**Status:** PASS
**main HEAD:** <contents of evidence/00-head.txt — first line>
**Timestamp:** <ISO8601 of when the gates ran, e.g. 2026-04-21T14:30:00Z>

**Commands:**
```
pnpm --filter @digswap/web typecheck    # exit 0 — evidence/01a-typecheck.txt
pnpm --filter @digswap/web lint         # exit 0 — evidence/01b-lint.txt
pnpm --filter @digswap/web test         # exit 0 — evidence/01c-test.txt
pnpm --filter @digswap/web build        # exit 0 — evidence/01d-build.txt
pnpm audit --prod --audit-level high    # exit 0 — evidence/01e-audit.txt
```

**Tail excerpts (last 5 lines of each):**

```
typecheck:
<paste last 5 lines of evidence/01a-typecheck.txt>

lint:
<paste last 5 lines of evidence/01b-lint.txt>

test:
<paste last 5 lines of evidence/01c-test.txt>

build:
<paste last 5 lines of evidence/01d-build.txt>

audit:
<paste last 5 lines of evidence/01e-audit.txt>
```

**Verdict:** PASS — all 4 CI gates green on main HEAD; zero HIGH/CRITICAL prod advisories.
```

Then flip the top-of-file checklist line from:
```
- [ ] DEP-AUD-01: CI gates green ...
```
to:
```
- [x] DEP-AUD-01: CI gates green ...
```

Also update the top-of-file header fields:
- `**main HEAD at audit start:**` — paste the sha from `evidence/00-head.txt`

DO NOT touch `**Executed:**` or `**Verdict:**` at the top — those are Wave 4's responsibility.

**Step 3 — Sanity check:**

```bash
# §1 now says PASS and DEP-AUD-01 checkbox is flipped
grep -c '^- \[x\] DEP-AUD-01' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
# Expect 1
grep -c "Verdict: PASS" .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
# Expect at least 1 (our §1)

# Remaining 7 checkboxes still unchecked
grep -c '^- \[ \] DEP-AUD-' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
# Expect 7
```

**If failing (per D-16):** HIGH/CRITICAL advisory with exploitable prod code path = inline update (`pnpm --filter @digswap/web update <package>`), re-run audit, commit fix. If ≥2h of work, escalate to decimal phase 33.1.
  </action>
  <verify>
    <automated>test -f .planning/phases/033-pre-deploy-audit-gate/evidence/01e-audit.txt && { grep -q "audit exit=0" .planning/phases/033-pre-deploy-audit-gate/evidence/01e-audit.txt || grep -q "No known vulnerabilities found" .planning/phases/033-pre-deploy-audit-gate/evidence/01e-audit.txt; } && [ "$(grep -c '^- \[x\] DEP-AUD-01' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md)" = "1" ] && [ "$(grep -c '^- \[ \] DEP-AUD-' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md)" = "7" ] && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `evidence/01e-audit.txt` exists
    - `evidence/01e-audit.txt` contains `audit exit=0` OR contains `No known vulnerabilities found`
    - `evidence/01e-audit.txt` grep for advisory severity (filtering out command flag): no line containing a package-advisory `│.*high.*│` or `│.*critical.*│` markup
    - AUDIT-REPORT.md top-of-file `**main HEAD at audit start:**` is populated with a git sha (not the literal `(fill from evidence/00-head.txt...)` placeholder)
    - AUDIT-REPORT.md §1 `**Status:**` line is `PASS`
    - AUDIT-REPORT.md §1 contains 5 `exit 0` references (one per command)
    - AUDIT-REPORT.md §1 contains tail excerpts (not placeholder `<paste last 5 lines...>`)
    - AUDIT-REPORT.md §1 ends with `**Verdict:** PASS`
    - `grep -c '^- \[x\] DEP-AUD-01' AUDIT-REPORT.md` returns 1
    - `grep -c '^- \[ \] DEP-AUD-' AUDIT-REPORT.md` returns 7 (the other 7 audits still pending)
  </acceptance_criteria>
  <done>DEP-AUD-01 checkbox flipped to [x], AUDIT-REPORT.md §1 shows PASS with real command output excerpts and the prod-audit evidence captured.</done>
</task>

</tasks>

<verification>
1. All 5 evidence files exist and end with `exit=0` markers
2. `grep -c '^- \[x\] DEP-AUD-01' AUDIT-REPORT.md` returns 1
3. `grep "Verdict: PASS" AUDIT-REPORT.md` finds at least the §1 verdict
4. Commit evidence + AUDIT-REPORT.md changes with message `docs(033): DEP-AUD-01 CI gates + prod audit green`
</verification>

<success_criteria>
- All 4 CI gates (typecheck, lint, test, build) pass against main HEAD
- `pnpm audit --prod --audit-level high` shows zero HIGH/CRITICAL advisories
- AUDIT-REPORT.md §1 is complete with verdict PASS
- DEP-AUD-01 is the first check to be flipped to [x]
</success_criteria>

<output>
After completion, create `.planning/phases/033-pre-deploy-audit-gate/033-02-SUMMARY.md`
</output>
