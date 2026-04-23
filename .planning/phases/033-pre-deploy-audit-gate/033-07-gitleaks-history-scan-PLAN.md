---
phase: 033-pre-deploy-audit-gate
plan: 07
type: execute
wave: 3
depends_on: [033-01]
files_modified:
  - .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks.json
  - .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-stdout.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-count.txt
  - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
autonomous: true
requirements: [DEP-AUD-07]

must_haves:
  truths:
    - "gitleaks v8 runs via Docker (no host install) against --all --full-history"
    - "Scan uses .gitleaks.toml from Plan 01 (extends defaults with 7 DigSwap-specific rules)"
    - "Output JSON file contains zero findings (array length = 0)"
    - "AUDIT-REPORT.md §7 flipped to PASS"
  artifacts:
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks.json"
      provides: "gitleaks report — MUST be an empty array []"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-stdout.txt"
      provides: "gitleaks verbose stdout (config loaded N rules, scan progress)"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-count.txt"
      provides: "Count of findings (must be 0)"
      contains: ""
  key_links:
    - from: ".gitleaks.toml"
      to: ".planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks.json"
      via: "Docker-invoked gitleaks git scanner consumes the config and writes JSON"
      pattern: "gitleaks"
---

<objective>
DEP-AUD-07: scan the full git history for committed secrets using gitleaks v8 (Docker image — no host install required on Windows). Scope: the 7 DigSwap-specific secret names from ROADMAP criterion 6 — `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `HANDOFF_HMAC_SECRET`, `IMPORT_WORKER_SECRET`, `DISCOGS_CONSUMER_SECRET`, `DATABASE_URL` inline password. Plus gitleaks' default 100+ detectors.

Purpose: Pitfalls #1 and #2 (NEXT_PUBLIC_ misprefix, `.env.local` committed). The scan is a verification gate — if nothing was committed, evidence/07-gitleaks.json is `[]` and the audit passes. If something was committed, per D-10 it is fixed inline (rotate the secret, update the allowlist).

Output: 3 evidence files (JSON report + stdout log + count) and AUDIT-REPORT.md §7 flipped to PASS.

**Plan is autonomous** — Docker + gitleaks are fully scripted.
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
@.gitleaks.toml

<interfaces>
<!-- .gitleaks.toml produced by Plan 01 (Wave 0), verified loadable via: -->
<!-- docker run --rm -v "$(pwd):/repo" -w /repo ghcr.io/gitleaks/gitleaks:latest git --config /repo/.gitleaks.toml --no-banner -->
<!-- -->
<!-- 7 custom rule IDs (per Plan 01): -->
<!--   digswap-supabase-service-role, digswap-stripe-secret, digswap-stripe-webhook, -->
<!--   digswap-handoff-hmac, digswap-import-worker, digswap-discogs-secret, digswap-pg-url-password -->
<!-- -->
<!-- RESEARCH.md §Audit 7 note: gitleaks exit code 1 = findings present, NOT a tool error. -->
<!-- The authoritative check is the JSON report length, NOT the exit code. -->
<!-- -->
<!-- Pitfall D (RESEARCH.md §Common Pitfalls D): TOML syntax errors silently exclude rules. -->
<!-- Plan 01 already verified the config loads — but Task 1 below re-verifies before scanning. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Verify .gitleaks.toml loads N rules, then run full-history scan</name>
  <files>
    .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks.json
    .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-stdout.txt
    .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-count.txt
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md §Audit 7 (exact Docker command, pass criteria, gotchas)
    - .planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md §Common Pitfalls D (TOML config silent-exclusion detection)
    - .gitleaks.toml (confirm Plan 01 wrote all 7 custom rule IDs)
    - .planning/phases/033-pre-deploy-audit-gate/033-CONTEXT.md (D-14 — gitleaks decision and evidence format)
    - .planning/phases/033-pre-deploy-audit-gate/evidence/00-docker.txt (Plan 01 confirmed Docker Desktop up)
  </read_first>
  <action>
**Step 1 — Confirm Docker Desktop is still running and gitleaks image is pulled:**

```bash
docker info >/dev/null 2>&1 || { echo "Docker not running — start Docker Desktop"; exit 1; }

# Pull the image (idempotent — no-op if already local)
docker pull ghcr.io/gitleaks/gitleaks:latest 2>&1 | tail -5
```

**Step 2 — Verify .gitleaks.toml loads cleanly (per Pitfall D):**

```bash
docker run --rm -v "$(pwd):/repo" -w /repo ghcr.io/gitleaks/gitleaks:latest \
  git --config /repo/.gitleaks.toml --no-banner --verbose \
  2>&1 | grep -iE "loaded config|rules" | head -5
```

Must print a line containing `loaded config with <N> rules` where N is ≥ 7 (gitleaks defaults + our 7 custom). If N is less than expected, a TOML syntax error silently excluded a rule — re-verify `.gitleaks.toml` from Plan 01 before running the full scan.

**Step 3 — Run the full-history scan:**

```bash
# Windows bash note: $(pwd) in Git Bash returns MSYS-style /c/Users/...;
# Docker Desktop accepts this via WSL2. If Docker rejects the path, use $(pwd -W) instead.

docker run --rm -v "$(pwd):/repo" -w /repo ghcr.io/gitleaks/gitleaks:latest \
  git \
  --config /repo/.gitleaks.toml \
  --log-opts="--all --full-history" \
  --report-format json \
  --report-path /repo/.planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks.json \
  --verbose \
  /repo \
  2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-stdout.txt

GITLEAKS_EXIT=$?
echo "gitleaks exit=$GITLEAKS_EXIT" >> .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-stdout.txt
```

**Important exit-code note (per RESEARCH.md §Audit 7):** gitleaks returns exit code **1** when findings are present (the opposite of most tools). Do NOT trust the exit code alone. The authoritative check is the JSON report length.

**Step 4 — Count findings:**

```bash
# Primary: use jq if available
if command -v jq >/dev/null 2>&1; then
  jq 'length' .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks.json \
    | tee .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-count.txt
else
  # Fallback per RESEARCH.md §Environment Availability: Python or Node one-liner
  python -c "import json; print(len(json.load(open('.planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks.json'))))" \
    | tee .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-count.txt \
  || node -e "console.log(JSON.parse(require('fs').readFileSync('.planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks.json','utf8')).length)" \
    | tee .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-count.txt
fi

echo "---" >> .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-count.txt
echo "count check at: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-count.txt
```

**Pass criterion (per D-14 + ROADMAP #6):**

- `evidence/07-gitleaks-count.txt` first line is `0`
- `evidence/07-gitleaks.json` is either `[]` or an empty JSON array equivalent (gitleaks writes `[]` on no findings)
- `evidence/07-gitleaks-stdout.txt` contains `no leaks found` OR does NOT contain any `[finding]` blocks

Confirm:

```bash
FINDING_COUNT=$(head -1 .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-count.txt)
echo "finding_count=$FINDING_COUNT"
# PASS: finding_count == 0
# FAIL: finding_count >= 1 — fail-inline per D-10
```

**Step 5 — If findings > 0 (fail-inline per D-10, D-16):**

For each finding, classify:

1. **False positive** — a placeholder / test value that slipped past the allowlist:
   - Update `.gitleaks.toml` allowlist (add to `regexes` or `paths`)
   - Re-run the scan (Step 3)
   - Commit the allowlist update as a separate commit

2. **Real secret** — an actual committed secret. Treat as incident:
   - a. Rotate the secret in its authoritative service (Supabase / Stripe / Discogs / Resend / etc.)
   - b. Update `.gitleaks.toml` allowlist to suppress the now-dead value so the next scan is clean
   - c. Decide: scrub git history (BFG Repo-Cleaner) vs accept leak as permanent and rotate (default choice if repo is public — scrubbing is cosmetic because leaks are scraped within minutes)

Fix time per finding: 30 min – 2h (rotation takes longer than allowlist update). If >2 real findings, escalate to decimal phase 33.1.

**Gotchas:**

- Windows path mount: if Docker complains about the `-v "$(pwd):/repo"` path, substitute `$(pwd -W)` (Git Bash builtin returning `C:/Users/...`).
- Empty `evidence/07-gitleaks.json` file vs `[]` content: gitleaks writes `[]` explicitly. If the file is zero bytes, the scan failed mid-run — re-check Docker is running and retry.
  </action>
  <verify>
    <automated>test -f .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks.json && test -f .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-count.txt && [ "$(head -1 .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-count.txt | tr -d '[:space:]')" = "0" ] && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `evidence/07-gitleaks.json` exists
    - `evidence/07-gitleaks.json` content is the literal `[]` OR a JSON array with length 0
    - `evidence/07-gitleaks-stdout.txt` exists and contains `gitleaks exit=` line
    - `evidence/07-gitleaks-stdout.txt` contains `loaded config` substring (confirming .gitleaks.toml parsed)
    - `evidence/07-gitleaks-count.txt` first line is `0` (after trimming whitespace)
    - No uncommitted files matching the gitleaks rules (running `docker run ... git --uncommitted` as a bonus check returns 0 findings — nice to have, not required)
  </acceptance_criteria>
  <done>Full git-history scan executed against .gitleaks.toml; evidence shows zero findings; authoritative check (JSON length) = 0.</done>
</task>

<task type="auto">
  <name>Task 2: Populate AUDIT-REPORT.md §7 with PASS verdict</name>
  <files>
    .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-count.txt (the number)
    - .planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks-stdout.txt (header excerpt)
    - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md (current §7 skeleton)
  </read_first>
  <action>
Replace the §7 skeleton with PASS content.

**§7 replacement block:**

```markdown
## §7 DEP-AUD-07 Git History Secret Scan

**Status:** PASS
**Timestamp:** <ISO8601 when scan ran>

**Tool:** gitleaks v8 (Docker image `ghcr.io/gitleaks/gitleaks:latest`)
**Config:** `.gitleaks.toml` (extends gitleaks defaults with 7 DigSwap-specific rules)

**Command:**
```
docker run --rm -v "$(pwd):/repo" -w /repo ghcr.io/gitleaks/gitleaks:latest \
  git --config /repo/.gitleaks.toml --log-opts="--all --full-history" \
  --report-format json \
  --report-path /repo/.planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks.json \
  --verbose /repo
```

**Rule coverage (7 custom + gitleaks defaults):**
- digswap-supabase-service-role (Supabase service_role JWT)
- digswap-stripe-secret (sk_live / sk_test)
- digswap-stripe-webhook (whsec_*)
- digswap-handoff-hmac (HANDOFF_HMAC_SECRET)
- digswap-import-worker (IMPORT_WORKER_SECRET)
- digswap-discogs-secret (DISCOGS_CONSUMER_SECRET)
- digswap-pg-url-password (postgresql:// inline password)
- Plus gitleaks' default 100+ detectors

**Results:**
- `evidence/07-gitleaks.json` length: **0** (zero findings)
- `evidence/07-gitleaks-stdout.txt` contains `no leaks found` message
- Config loaded `<N>` rules (see stdout "loaded config with <N> rules")

**Verdict:** PASS — zero committed secrets across full git history. Pitfalls #1 and #2 are NOT live.
```

Flip the checkbox:

```
- [ ] DEP-AUD-07: ...
```

→

```
- [x] DEP-AUD-07: ...
```

Verify:
```bash
grep -c '^- \[x\] DEP-AUD-07' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md   # expect 1
```
  </action>
  <verify>
    <automated>grep -q "^- \[x\] DEP-AUD-07" .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md && grep -A 3 "## §7 DEP-AUD-07" .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md | grep -q "Status:.*PASS" && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - AUDIT-REPORT.md §7 Status line is `PASS`
    - AUDIT-REPORT.md §7 references `evidence/07-gitleaks.json`
    - AUDIT-REPORT.md §7 records the actual findings count `0`
    - AUDIT-REPORT.md §7 mentions all 7 custom rule IDs
    - `grep -c '^- \[x\] DEP-AUD-07' AUDIT-REPORT.md` returns 1
  </acceptance_criteria>
  <done>DEP-AUD-07 checkbox flipped, §7 populated with PASS verdict and evidence references.</done>
</task>

</tasks>

<verification>
1. `evidence/07-gitleaks.json` length = 0 (via jq / python / node)
2. `evidence/07-gitleaks-count.txt` first line is `0`
3. `evidence/07-gitleaks-stdout.txt` confirms config loaded + scan completed
4. `grep -c '^- \[x\] DEP-AUD-07' AUDIT-REPORT.md` returns 1
5. Commit evidence + AUDIT-REPORT.md with `docs(033): DEP-AUD-07 gitleaks scan clean`
</verification>

<success_criteria>
- gitleaks v8 Docker scan against `--all --full-history` returns zero findings
- `.gitleaks.toml` config with 7 custom rules loads cleanly
- AUDIT-REPORT.md §7 shows PASS
- Pitfalls #1 and #2 confirmed NOT live in git history
</success_criteria>

<output>
After completion, create `.planning/phases/033-pre-deploy-audit-gate/033-07-SUMMARY.md`
</output>
