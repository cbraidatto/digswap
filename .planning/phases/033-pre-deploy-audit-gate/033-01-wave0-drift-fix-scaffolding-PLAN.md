---
phase: 033-pre-deploy-audit-gate
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - drizzle/0002_showcase_cards.sql
  - scripts/drizzle-prod-guard.mjs
  - package.json
  - .planning/ADR-003-drizzle-dev-only.md
  - .gitleaks.toml
  - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
  - .planning/phases/033-pre-deploy-audit-gate/evidence/.gitignore
  - .planning/phases/033-pre-deploy-audit-gate/evidence/00-docker.txt
  - apps/web/tests/e2e/audit/session-revocation.audit.spec.ts
autonomous: true
requirements: [DEP-AUD-02, DEP-AUD-04, DEP-AUD-07]

must_haves:
  truths:
    - "drizzle/0002_showcase_cards.sql is deleted (orphan file no longer in repo)"
    - "scripts/drizzle-prod-guard.mjs exits non-zero when DATABASE_URL contains a prod ref"
    - "package.json has predb:push and predb:migrate scripts that invoke the guard"
    - "ADR-003 formalizes D-01..D-05 (drizzle is dev-only, supabase/migrations authoritative)"
    - ".gitleaks.toml loads with 7+ custom rules plus the default ruleset"
    - "AUDIT-REPORT.md skeleton has 8 unchecked checkboxes (one per DEP-AUD-01..08)"
    - "evidence/ folder exists with a .gitignore excluding 05c/05d token-sample files"
    - "Playwright spec file exists at apps/web/tests/e2e/audit/session-revocation.audit.spec.ts"
    - "Docker Desktop pre-flight passes (docker info returns exit 0)"
  artifacts:
    - path: ".planning/ADR-003-drizzle-dev-only.md"
      provides: "Locked decision record for D-01..D-05 (drizzle dev-only policy)"
      contains: "id: ADR-003"
    - path: "scripts/drizzle-prod-guard.mjs"
      provides: "Runtime guard that aborts drizzle-kit against prod"
      contains: "process.exit(1)"
    - path: ".gitleaks.toml"
      provides: "Custom secret-scan config scoped to 7 DigSwap secret names"
      contains: "digswap-supabase-service-role"
    - path: ".planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md"
      provides: "Evidence report skeleton — populated across Waves 1–4"
      contains: "DEP-AUD-01"
    - path: "apps/web/tests/e2e/audit/session-revocation.audit.spec.ts"
      provides: "Scaffolded Playwright spec; executed in Wave 2 (Plan 04)"
      contains: "logged-out JWT is rejected within 60s"
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/.gitignore"
      provides: "Excludes sample-token files (05c, 05d) from commit"
      contains: "05c"
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/00-docker.txt"
      provides: "Docker Desktop pre-flight evidence (docker info output)"
      contains: "Server Version"
  key_links:
    - from: "package.json scripts.predb:push"
      to: "scripts/drizzle-prod-guard.mjs"
      via: "npm pre-hook chain"
      pattern: "node scripts/drizzle-prod-guard.mjs"
    - from: "ADR-003"
      to: "scripts/drizzle-prod-guard.mjs"
      via: "Cross-reference — ADR documents what the script enforces"
      pattern: "drizzle-prod-guard"
---

<objective>
Wave 0 removes the `drizzle/` vs `supabase/migrations/` drift (SYSTEMIC #0 from 2026-04-03 audit) and scaffolds every artifact that Waves 1–4 depend on. Nothing in Wave 0 runs a CI check or probes a database — it sets the stage so the remaining audits have somewhere to land evidence.

Purpose: Without Wave 0, (a) the DEP-AUD-02 reset test runs against a repo that still carries the known drift, (b) DEP-AUD-07 has no config file, (c) DEP-AUD-04 has no test file to execute, and (d) the evidence has no folder to live in. Wave 0 is the prerequisite for every subsequent wave.

Output:
- `drizzle/0002_showcase_cards.sql` DELETED (D-03)
- `scripts/drizzle-prod-guard.mjs` wired into `predb:push` / `predb:migrate` (D-04)
- `.planning/ADR-003-drizzle-dev-only.md` committed (D-05)
- `.gitleaks.toml` at repo root with custom rules (for Plan 07)
- `AUDIT-REPORT.md` skeleton with 8 checkboxes and 8 section headings
- `evidence/.gitignore` excluding 05c/05d sample outputs
- `apps/web/tests/e2e/audit/session-revocation.audit.spec.ts` scaffolded (executed by Plan 04)
- Docker Desktop confirmed running (evidence/00-docker.txt)
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
@.planning/ADR-001-strategic-direction.md
@.planning/ADR-002-desktop-trade-runtime.md
@drizzle/meta/_journal.json
@package.json

<interfaces>
<!-- Orphan file confirmation: drizzle/ directory listing vs drizzle/meta/_journal.json -->
<!-- Journal tracks 6 entries: 0000_wandering_lord_hawal, 0001_thick_jackpot, 0002_aberrant_pyro, 0003_free_gateway, 0004_gin_indexes_genre_leaderboard_mv, 0005_stripe_event_log -->
<!-- On-disk files include those 6 PLUS the orphan drizzle/0002_showcase_cards.sql -->
<!-- Verified 2026-04-21 per RESEARCH.md §Summary -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Docker pre-flight + delete orphan drizzle migration + scaffold evidence folder</name>
  <files>
    drizzle/0002_showcase_cards.sql
    .planning/phases/033-pre-deploy-audit-gate/evidence/.gitignore
    .planning/phases/033-pre-deploy-audit-gate/evidence/00-docker.txt
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/033-CONTEXT.md (D-03 orphan deletion decision)
    - .planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md §Audit 2 (why this blocks W1b) and §Audit 5 gotcha 4 (why 05c/05d are sensitive)
    - drizzle/meta/_journal.json (confirm the orphan is NOT in the journal)
  </read_first>
  <action>
Run Docker Desktop pre-flight, delete the orphan migration file, and create the evidence folder with its gitignore.

**Step 1 — Docker pre-flight (per 033-VALIDATION.md Manual-Only Verifications):**

```bash
# Confirm Docker Desktop is up — Audits 2a + 7 both require it
docker info > .planning/phases/033-pre-deploy-audit-gate/evidence/00-docker.txt 2>&1
echo "docker info exit code: $?" >> .planning/phases/033-pre-deploy-audit-gate/evidence/00-docker.txt
```

If `docker info` fails (Docker Desktop is not running), STOP this plan and surface the error to the user. Audit 2a (Plan 03) and Audit 7 (Plan 07) cannot run without Docker.

**Step 2 — Confirm the orphan then delete it (D-03):**

```bash
# Confirm the file exists AND is NOT in the journal
test -f drizzle/0002_showcase_cards.sql || { echo "FAIL: orphan missing — investigate"; exit 1; }
grep -q "0002_showcase_cards" drizzle/meta/_journal.json && { echo "FAIL: file IS in journal — do NOT delete"; exit 1; }

# Remove the orphan via git
git rm drizzle/0002_showcase_cards.sql
```

**Step 3 — Create evidence folder and .gitignore:**

Create directory `.planning/phases/033-pre-deploy-audit-gate/evidence/` (git tracks the .gitignore; subsequent evidence files are committed individually by later plans).

Write `.planning/phases/033-pre-deploy-audit-gate/evidence/.gitignore` with these exact contents:

```gitignore
# Phase 33 DEP-AUD-05 — Discogs token sample outputs may reveal token prefixes.
# Redact manually before committing specific samples, or leave ignored.
05c-plaintext-sample.txt
05d-vault-sample.txt

# Allow everything else (02a-*, 02b-*, 03-*, 04-*, 05a-*, 05b-*, 06-*, 07-*, 08-*, 00-*) to be committed.
!00-docker.txt
!.gitignore
```

**Step 4 — Verify everything:**

```bash
# Confirm the deletion is staged
git status --short drizzle/0002_showcase_cards.sql   # expect "D  drizzle/0002_showcase_cards.sql"

# Confirm the evidence folder exists
test -d .planning/phases/033-pre-deploy-audit-gate/evidence || exit 1
test -f .planning/phases/033-pre-deploy-audit-gate/evidence/.gitignore || exit 1
test -f .planning/phases/033-pre-deploy-audit-gate/evidence/00-docker.txt || exit 1
```

**If failing (per D-16):** Docker Desktop not running = block the wave and ask user to start it. Orphan already deleted on a prior attempt = treat Step 2 as a no-op and proceed. These are <5min issues — do not escalate.
  </action>
  <verify>
    <automated>test ! -f drizzle/0002_showcase_cards.sql && test -f .planning/phases/033-pre-deploy-audit-gate/evidence/.gitignore && test -f .planning/phases/033-pre-deploy-audit-gate/evidence/00-docker.txt && grep -q "Server Version" .planning/phases/033-pre-deploy-audit-gate/evidence/00-docker.txt && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `test -f drizzle/0002_showcase_cards.sql` returns non-zero (file is deleted)
    - `git status --short` shows `D  drizzle/0002_showcase_cards.sql` (staged deletion)
    - `test -d .planning/phases/033-pre-deploy-audit-gate/evidence/` returns 0
    - `.planning/phases/033-pre-deploy-audit-gate/evidence/.gitignore` contains literal string `05c-plaintext-sample.txt`
    - `.planning/phases/033-pre-deploy-audit-gate/evidence/.gitignore` contains literal string `05d-vault-sample.txt`
    - `.planning/phases/033-pre-deploy-audit-gate/evidence/00-docker.txt` contains `Server Version` (Docker daemon responded)
    - `drizzle/meta/_journal.json` does NOT contain `0002_showcase_cards` (orphan was never in journal — sanity check)
  </acceptance_criteria>
  <done>Docker Desktop confirmed running, orphan drizzle file deleted, evidence folder exists with gitignore — downstream waves can run.</done>
</task>

<task type="auto">
  <name>Task 2: Create drizzle-prod-guard.mjs, wire into package.json, write ADR-003</name>
  <files>
    scripts/drizzle-prod-guard.mjs
    package.json
    .planning/ADR-003-drizzle-dev-only.md
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/033-CONTEXT.md (D-04, D-05 — guard script + ADR decisions)
    - .planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md §Architecture Patterns (full guard source) and §Code Examples (ADR-003 template)
    - package.json (current scripts block — guard adds predb:push/predb:migrate without removing existing keys)
    - .planning/ADR-002-desktop-trade-runtime.md (ADR format precedent — follow same frontmatter shape)
  </read_first>
  <action>
Implement the D-04 script-level guard, wire it into package.json via npm `pre*` hooks, and write ADR-003 documenting the D-01..D-05 decisions.

**Step 1 — Create `scripts/drizzle-prod-guard.mjs`** with this exact source (copied from RESEARCH.md §Architecture Patterns):

```javascript
#!/usr/bin/env node
// scripts/drizzle-prod-guard.mjs
// Phase 33 SYSTEMIC #0 fix — refuses drizzle-kit push/migrate if DATABASE_URL
// points at the prod Supabase project. See ADR-003.
//
// Prod Supabase connection strings contain the project ref in the host, e.g.
//   postgresql://postgres.<prod-ref>:password@aws-0-<region>.pooler.supabase.com:6543/postgres
//
// The guard fires when the URL contains any ref listed in DRIZZLE_PROD_REFS
// (comma-separated env var set once on the dev machine after Phase 34 creates the prod project).

const url = process.env.DATABASE_URL ?? "";
const prodRefs = (process.env.DRIZZLE_PROD_REFS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const looksLikeProd = prodRefs.some((ref) => ref && url.includes(ref));

if (looksLikeProd) {
  console.error(
    "\u2717 drizzle-kit is NEVER used against prod. Apply migrations via `supabase db push`. See ADR-003.",
  );
  process.exit(1);
}

console.log("\u2713 drizzle-kit guard: DATABASE_URL is not prod.");
```

Note: The guard does NOT currently fail when `DRIZZLE_PROD_REFS` is unset — that env var is populated by the operator on their dev machine after Phase 34 creates the prod project. For Phase 33 purposes, running `node scripts/drizzle-prod-guard.mjs` with neither var set MUST print the success line and exit 0 so the test below passes.

**Step 2 — Wire into `package.json`:**

Read the current `package.json` scripts block. Add these three lines inside `"scripts"` (preserving all existing entries):

```json
    "db:guard": "node scripts/drizzle-prod-guard.mjs",
    "predb:push": "pnpm db:guard",
    "predb:migrate": "pnpm db:guard"
```

If `db:push` or `db:migrate` scripts do not yet exist in the root `package.json`, add them now as placeholders that defer to the future workspace-level drizzle-kit command:

```json
    "db:push": "echo 'drizzle-kit push is invoked from the workspace that owns the schema — this root script exists so the predb:push guard always runs first' && exit 0",
    "db:migrate": "echo 'drizzle-kit migrate is invoked from the workspace that owns the schema — this root script exists so the predb:migrate guard always runs first' && exit 0"
```

**Step 3 — Test the guard locally:**

```bash
# Case A — no env vars: must pass
DATABASE_URL="" DRIZZLE_PROD_REFS="" node scripts/drizzle-prod-guard.mjs
# Expect exit 0 and line "drizzle-kit guard: DATABASE_URL is not prod."

# Case B — prod ref matched: must fail
DATABASE_URL="postgresql://postgres.abcd1234:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres" \
DRIZZLE_PROD_REFS="abcd1234" \
  node scripts/drizzle-prod-guard.mjs ; echo "exit=$?"
# Expect exit 1 and the ADR-003 error message
```

**Step 4 — Write `.planning/ADR-003-drizzle-dev-only.md`** using the exact template from RESEARCH.md §Code Examples.

**Important: the template below uses `{FENCE}` as a placeholder for the literal three-dash YAML fence (`-` + `-` + `-`). When writing the file, replace every `{FENCE}` with a real three-dash line. The placeholder exists only so this PLAN.md's own frontmatter parser is not confused by a nested YAML fence.**

```markdown
{FENCE}
id: ADR-003
title: Drizzle Kit is Dev-Only — Production Migrations via Supabase CLI
date: 2026-04-21
status: accepted
deciders: [user, Claude]
supersedes: []
{FENCE}

# ADR-003: Drizzle Kit is Dev-Only; Production Migrations via Supabase CLI

## Context

As of 2026-04, the repo has two migration trails:
- `drizzle/` (6 journal entries via `drizzle-kit generate`) — TypeScript-first schema authoring
- `supabase/migrations/` (28 SQL files) — hand-written RLS policies, pg_cron schedules, pg_net outbound calls, Supabase Vault operations

Drizzle cannot express RLS policies, pg_cron schedules, or Vault calls in its generated SQL. The two trails diverged (see `20260405_fix_all_rls_null_policies.sql` referencing columns not modeled in the Drizzle schema; `drizzle/0002_showcase_cards.sql` existed outside the journal). The 2026-04-06 deploy-readiness audit flagged this as SYSTEMIC #0.

## Decision

1. **`supabase/migrations/` is the sole authoritative trail for production.** All prod schema changes MUST go through `supabase db push --linked`.
2. **`drizzle/` is dev-only.** Drizzle Kit generates TypeScript types from `apps/web/src/lib/db/schema/` and produces SQL snapshots for local reference. These snapshots are NOT applied to prod.
3. **A script-level guard (`scripts/drizzle-prod-guard.mjs`) refuses `drizzle-kit push` / `drizzle-kit migrate` when `DATABASE_URL` points at prod** (detected via `DRIZZLE_PROD_REFS` env var substring match).
4. **The orphan file `drizzle/0002_showcase_cards.sql`** (never present in `drizzle/meta/_journal.json`) **is deleted** as part of this ADR's introduction.

## Consequences

- Writing new schema: add the Drizzle schema in `apps/web/src/lib/db/schema/`, run `drizzle-kit generate` for types, then hand-author the matching SQL in `supabase/migrations/YYYYMMDD_<slug>.sql` and apply via `supabase db push`.
- Developers cannot accidentally mutate prod schema via `drizzle-kit` — the guard script exits non-zero.
- CI remains unchanged; `drizzle-kit` is not run in CI.
- Future schema-drift audits compare: `apps/web/src/lib/db/schema/*.ts` ↔ the SQL that `supabase/migrations/*.sql` produces against a reset DB.

## Status

Accepted 2026-04-21 as part of Phase 33 (Pre-Deploy Audit Gate).
```

**Step 5 — Final sanity check:**

```bash
# Guard is executable as a node script
node --check scripts/drizzle-prod-guard.mjs && echo "syntax OK"

# package.json parses as JSON
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json OK')"

# package.json contains the three new keys
grep -E '"db:guard"|"predb:push"|"predb:migrate"' package.json | wc -l
# Expect 3
```

**If failing (per D-16):** If existing `package.json` has `db:push`/`db:migrate` scripts wired differently, prepend `pnpm db:guard && ` to the existing command instead of overwriting — the goal is the guard runs first, not that we own the script. Fix time: ~10 min.
  </action>
  <verify>
    <automated>node --check scripts/drizzle-prod-guard.mjs && grep -q "process.exit(1)" scripts/drizzle-prod-guard.mjs && grep -q '"predb:push"' package.json && grep -q '"predb:migrate"' package.json && grep -q "id: ADR-003" .planning/ADR-003-drizzle-dev-only.md && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `scripts/drizzle-prod-guard.mjs` exists and `node --check` passes
    - `scripts/drizzle-prod-guard.mjs` contains literal string `process.exit(1)`
    - `scripts/drizzle-prod-guard.mjs` references `DRIZZLE_PROD_REFS`
    - `package.json` contains `"db:guard"` script pointing to the guard
    - `package.json` contains `"predb:push"` script that invokes `pnpm db:guard`
    - `package.json` contains `"predb:migrate"` script that invokes `pnpm db:guard`
    - Running `node scripts/drizzle-prod-guard.mjs` with no env vars exits 0 and prints success line
    - Running with `DATABASE_URL=postgresql://postgres.abcd1234:p@host DRIZZLE_PROD_REFS=abcd1234 node scripts/drizzle-prod-guard.mjs` exits 1
    - `.planning/ADR-003-drizzle-dev-only.md` exists
    - `.planning/ADR-003-drizzle-dev-only.md` contains `id: ADR-003`, `status: accepted`, and the section headings `## Context`, `## Decision`, `## Consequences`, `## Status`
    - ADR-003 references `drizzle-prod-guard.mjs` in the Decision section
    - ADR-003 mentions the orphan file deletion (D-03) in the Decision section
  </acceptance_criteria>
  <done>Guard script aborts on prod DATABASE_URL, package.json pre-hooks wire it in, ADR-003 formalizes D-01..D-05 as a permanent record.</done>
</task>

<task type="auto">
  <name>Task 3: Write .gitleaks.toml, AUDIT-REPORT.md skeleton, and session-revocation spec scaffold</name>
  <files>
    .gitleaks.toml
    .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
    apps/web/tests/e2e/audit/session-revocation.audit.spec.ts
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md §Audit 7 (full .gitleaks.toml template) and §Audit 4 (full Playwright spec) and §Architecture Patterns (AUDIT-REPORT.md template)
    - .planning/phases/033-pre-deploy-audit-gate/033-CONTEXT.md (D-11..D-15 — evidence format decisions)
    - apps/web/.env.local.example (the var list that DEP-AUD-08 inventories; influences `.gitleaks.toml` allowlist)
    - apps/web/tests/e2e/auth-flow.spec.ts (existing Playwright conventions to match — import paths, test shape)
    - apps/web/playwright.config.ts (confirm test pattern matches e2e/audit/*.spec.ts discovery)
  </read_first>
  <action>
Create three scaffolded files that Waves 1–4 populate with evidence.

**Step 1 — Write `.gitleaks.toml` at repo root** using the exact TOML from RESEARCH.md §Audit 7. Paste the full contents:

```toml
# .gitleaks.toml — Phase 33 DEP-AUD-07 config
# Extends gitleaks' default rules; adds custom rules scoped to the 7 DigSwap secret names.

title = "DigSwap Pre-Deploy Audit (Phase 33)"

[extend]
useDefault = true

# Rule: Supabase service-role key (JWT-shaped, ~400 chars)
[[rules]]
id = "digswap-supabase-service-role"
description = "Supabase service_role JWT detected (possible hardcoded secret)"
regex = '''(?i)(service_role|SUPABASE_SERVICE_ROLE_KEY)[^a-z0-9_]{1,30}(eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})'''
secretGroup = 2
tags = ["digswap", "supabase", "service-role"]

# Rule: Stripe live/test keys
[[rules]]
id = "digswap-stripe-secret"
description = "Stripe sk_live/sk_test key"
regex = '''\bsk_(live|test)_[0-9a-zA-Z]{24,}\b'''
tags = ["digswap", "stripe"]

# Rule: Stripe webhook signing secret
[[rules]]
id = "digswap-stripe-webhook"
description = "Stripe whsec_* webhook signing secret"
regex = '''\bwhsec_[0-9a-zA-Z]{32,}\b'''
tags = ["digswap", "stripe", "webhook"]

# Rule: HANDOFF_HMAC_SECRET with real-looking hex
[[rules]]
id = "digswap-handoff-hmac"
description = "HANDOFF_HMAC_SECRET = <32+ hex chars>"
regex = '''HANDOFF_HMAC_SECRET\s*[:=]\s*["']?([0-9a-f]{32,})'''
secretGroup = 1
tags = ["digswap", "hmac"]

# Rule: IMPORT_WORKER_SECRET with real-looking hex
[[rules]]
id = "digswap-import-worker"
description = "IMPORT_WORKER_SECRET = <32+ hex chars>"
regex = '''IMPORT_WORKER_SECRET\s*[:=]\s*["']?([0-9a-zA-Z]{32,})'''
secretGroup = 1
tags = ["digswap", "import-worker"]

# Rule: Discogs consumer secret
[[rules]]
id = "digswap-discogs-secret"
description = "DISCOGS_CONSUMER_SECRET with real value"
regex = '''DISCOGS_CONSUMER_SECRET\s*[:=]\s*["']?([A-Za-z0-9]{20,})'''
secretGroup = 1
tags = ["digswap", "discogs"]

# Rule: Postgres URL with inline password
[[rules]]
id = "digswap-pg-url-password"
description = "postgresql:// URL with inline password"
regex = '''postgres(ql)?://[^:\s]+:([^@\s]{8,})@[a-z0-9.-]+'''
secretGroup = 2
tags = ["digswap", "database"]

# Allowlist — these tokens are safe/expected placeholders
[[allowlists]]
description = "Skip .env.example files and CI dummy values"
paths = [
  '''\.env\.local\.example$''',
  '''\.env\.example$''',
  '''\.github/workflows/ci\.yml$''',
  '''CLAUDE\.md$''',
  '''\.planning/.*\.md$''',
  '''\.pi/agent/skills/.*\.md$''',
]
# Also ignore placeholder literals that appear in tests / docs
regexes = [
  '''dev-hmac-secret-not-for-production''',
  '''ci-.*-secret''',
  '''placeholder-key''',
  '''generate_a_random_32_char_string''',
  '''your_[a-z_]+_(key|secret|url|token)''',
]
```

Test that gitleaks accepts this config:

```bash
docker run --rm -v "$(pwd):/repo" -w /repo ghcr.io/gitleaks/gitleaks:latest \
  git --config /repo/.gitleaks.toml --no-banner --verbose 2>&1 | head -20
```

Look for a line like `INF loaded config with N rules` in the first 15 lines. N must be ≥ 7 (default rule count + our 7 custom). If the line doesn't appear, gitleaks rejected the TOML — fix the syntax error.

**Step 2 — Write `.planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md` skeleton** (D-11). Later plans (02..08) populate their sections; Wave 4 (Plan 08) flips the checkboxes and writes the final verdict.

```markdown
# Phase 33 Audit Report

**Executed:** (fill during Wave 4)
**main HEAD at audit start:** (fill from evidence/00-head.txt in Plan 02)
**Verdict:** PENDING — execution in progress

## Checklist

- [ ] DEP-AUD-01: CI gates green (typecheck, build, test, lint) + prod audit clean  — evidence/01*-*.txt
- [ ] DEP-AUD-02: `supabase db reset` clean on local Docker + throwaway cloud      — evidence/02a-*.txt, evidence/02b-*.txt
- [ ] DEP-AUD-03: Cold-start curl — all 4 public routes 200 in <3s after idle      — evidence/03-*.txt
- [ ] DEP-AUD-04: Session revocation — logged-out JWT returns 401 within 60s       — evidence/04-*.txt
- [ ] DEP-AUD-05: Discogs tokens Vault-wrapped — zero plaintext rows               — evidence/05a-*.txt, evidence/05b-*.txt
- [ ] DEP-AUD-06: CSP re-confirmed — nonce-based header, zero violations on 5 routes — evidence/06*-*
- [ ] DEP-AUD-07: gitleaks scan — zero findings across full git history            — evidence/07-gitleaks.json
- [ ] DEP-AUD-08: Env inventory — all 21 vars have actionable prod-value source, zero `| TBD |` rows — §8 table below

## §1 DEP-AUD-01 CI Gates + Prod Audit

**Status:** pending
**Command:** (populated in Plan 02)
**Exit code:** —
**Output excerpt:** —
**Verdict:** —

## §2 DEP-AUD-02 Supabase Migration Reset

**Status:** pending
**Local reset command:** (populated in Plan 03)
**Cloud reset command:** (populated in Plan 03)
**Teardown proof:** evidence/02b-teardown.png
**Verdict:** —

## §3 DEP-AUD-03 Cold-Start Public Routes (LOCAL ONLY per D-08)

**Status:** pending
**Command:** (populated in Plan 04)
**Routes tested:** /, /signin, /signup, /pricing
**Results:** —
**Verdict:** —

## §4 DEP-AUD-04 Session Revocation E2E

**Status:** pending
**Command:** (populated in Plan 04)
**Pre-logout status:** —
**Post-logout status:** —
**Elapsed ms:** —
**Verdict:** —

## §5 DEP-AUD-05 Discogs Tokens via Supabase Vault

**Status:** pending
**Project queried:** dev Supabase (not prod — see D-06 scope)
**plaintext_count:** —
**vault_count:** —
**Verdict:** —

## §6 DEP-AUD-06 CSP Re-Confirmation

**Status:** pending
**Header sample:** (populated in Plan 06)
**Routes with zero violations:** —
**Verdict:** —

## §7 DEP-AUD-07 Git History Secret Scan

**Status:** pending
**Command:** (populated in Plan 07)
**Findings count:** —
**Verdict:** —

## §8 DEP-AUD-08 Environment Variable Inventory

**Status:** pending
**Source:** apps/web/.env.local.example (21 required + 4 optional variables)

| # | Variable | Domain | Scope | Source of prod value | Secret? | Assigned (Y/N) |
|---|----------|--------|-------|----------------------|---------|----------------|
| — | (populated in Plan 08 from RESEARCH.md §Audit 8 table) | — | — | TBD | — | N |

**Verdict:** —

---

## Sign-Off

All 8 checks must show a verdict of PASS (or explicit documented acceptance) and `grep -c '| TBD |' AUDIT-REPORT.md` must return 0 before Phase 34 can begin.

**Signed-off:** (Wave 4)
```

**Step 3 — Scaffold `apps/web/tests/e2e/audit/session-revocation.audit.spec.ts`** using the exact TypeScript from RESEARCH.md §Audit 4. Create the `audit/` subdirectory under `apps/web/tests/e2e/` if needed, then write the file. The spec is NOT executed in Plan 01 (no server running); Plan 04 runs it.

```typescript
import { test, expect, request as pwRequest } from "@playwright/test";

// DEP-AUD-04: a logged-out JWT must return 401 on protected API routes within 60s.
// This is a "claim verification" test produced by Phase 33's audit —
// it runs against the LOCAL prod server (pnpm start on :3000).
// Scaffolded in Plan 01 (Wave 0); executed in Plan 04 (Wave 2).
//
// Required env vars at run-time (Plan 04 supplies these):
//   AUDIT_USER_EMAIL    — pre-created audit user (audit+33@digswap.test recommended)
//   AUDIT_USER_PASSWORD — password for the audit user
//   NEXT_PUBLIC_SUPABASE_URL — inherited from .env.local via pnpm start

test("logged-out JWT is rejected within 60s", async ({ page }) => {
  const AUDIT_EMAIL = process.env.AUDIT_USER_EMAIL;
  const AUDIT_PASSWORD = process.env.AUDIT_USER_PASSWORD;
  expect(AUDIT_EMAIL, "AUDIT_USER_EMAIL env var required").toBeTruthy();
  expect(AUDIT_PASSWORD, "AUDIT_USER_PASSWORD env var required").toBeTruthy();

  // 1. Sign in with the audit user
  await page.goto("http://localhost:3000/signin");
  await page.fill('input[name="email"]', AUDIT_EMAIL!);
  await page.fill('input[name="password"]', AUDIT_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/feed|\/onboarding/, { timeout: 10_000 });

  // 2. Extract the access token from the Supabase auth cookie
  const cookies = await page.context().cookies();
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const authCookieName = `sb-${projectRef}-auth-token`;
  const authCookie = cookies.find((c) => c.name === authCookieName);
  expect(authCookie, "must have auth cookie after signin").toBeDefined();

  // Cookie may be JSON array or base64-prefixed (Supabase SSR changed formats in 2025)
  let rawValue = authCookie!.value;
  if (rawValue.startsWith("base64-")) {
    rawValue = Buffer.from(rawValue.slice(7), "base64").toString();
  }
  const parsed = JSON.parse(decodeURIComponent(rawValue));
  const accessToken = Array.isArray(parsed) ? parsed[0] : parsed.access_token;
  expect(accessToken, "must extract access_token").toBeTruthy();

  // 3. Confirm the token works BEFORE logout.
  // Plan 04 will replace PROTECTED_ENDPOINT with a concrete route after grepping
  // apps/web/src/app/api/*/route.ts for a route NOT in the middleware bypass list
  // (middleware bypasses /api/stripe/, /api/og/, /api/discogs/import, /api/desktop/).
  const PROTECTED_ENDPOINT = process.env.AUDIT_PROTECTED_ENDPOINT ?? "http://localhost:3000/api/user/me";

  const apiClient = await pwRequest.newContext();
  const preLogoutResp = await apiClient.get(PROTECTED_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  console.log("[audit] pre-logout status:", preLogoutResp.status());
  expect(preLogoutResp.status(), "token must work before logout").toBeLessThan(400);

  // 4. Log out via the UI
  await page.goto("http://localhost:3000/settings/sessions");
  await page.click("text=/sign.*out/i");
  await page.waitForURL(/\/signin/, { timeout: 10_000 });

  // 5. Replay the token — expect 401 within 60s
  const start = Date.now();
  let finalStatus = 0;
  while (Date.now() - start < 60_000) {
    const resp = await apiClient.get(PROTECTED_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    finalStatus = resp.status();
    if (finalStatus === 401) break;
    await new Promise((r) => setTimeout(r, 2_000));
  }
  const elapsedMs = Date.now() - start;
  console.log(`[audit] post-logout status: ${finalStatus} after ${elapsedMs}ms`);
  expect(finalStatus, "logged-out token must return 401").toBe(401);
  expect(elapsedMs, "must be rejected within 60s").toBeLessThan(60_000);
});
```

**Step 4 — Final sanity check:**

```bash
# gitleaks config loads without errors
docker run --rm -v "$(pwd):/repo" -w /repo ghcr.io/gitleaks/gitleaks:latest \
  git --config /repo/.gitleaks.toml --no-banner 2>&1 | grep -i "loaded config" | head -1
# Must print something like: "INF loaded config with N rules"

# AUDIT-REPORT.md contains 8 checkboxes
grep -c '^- \[ \] DEP-AUD-' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
# Expect 8

# Playwright spec is syntactically valid TypeScript
cd apps/web && npx tsc --noEmit tests/e2e/audit/session-revocation.audit.spec.ts 2>&1 | head -5
# Expect zero errors (or only errors relative to the Playwright test runner's type resolution, which is fine)
```

**If failing (per D-16):**
- gitleaks TOML parse error: compare character-by-character to the template; TOML is strict about `[[rules]]` brackets.
- TypeScript error on the spec: confirm `@playwright/test` is in `apps/web/package.json` devDependencies; if the `audit/` folder is not picked up by `playwright.config.ts` testMatch, add it in Plan 04 rather than here.

Fix time: ~15 min each. Within D-16 inline budget.
  </action>
  <verify>
    <automated>test -f .gitleaks.toml && test -f .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md && test -f apps/web/tests/e2e/audit/session-revocation.audit.spec.ts && [ "$(grep -c '^- \[ \] DEP-AUD-' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md)" = "8" ] && grep -q "digswap-supabase-service-role" .gitleaks.toml && grep -q "digswap-stripe-secret" .gitleaks.toml && grep -q "digswap-handoff-hmac" .gitleaks.toml && grep -q "digswap-import-worker" .gitleaks.toml && grep -q "digswap-discogs-secret" .gitleaks.toml && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `.gitleaks.toml` exists at repo root
    - `.gitleaks.toml` contains `[[rules]]` blocks with IDs `digswap-supabase-service-role`, `digswap-stripe-secret`, `digswap-stripe-webhook`, `digswap-handoff-hmac`, `digswap-import-worker`, `digswap-discogs-secret`, `digswap-pg-url-password` (all 7)
    - `.gitleaks.toml` contains `[extend] useDefault = true`
    - `.gitleaks.toml` allowlist includes paths for `\.env\.local\.example$` and `\.planning/.*\.md$`
    - `docker run --rm -v "$(pwd):/repo" -w /repo ghcr.io/gitleaks/gitleaks:latest git --config /repo/.gitleaks.toml --no-banner 2>&1 | grep -c "loaded config"` returns ≥ 1
    - `.planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md` exists
    - AUDIT-REPORT.md contains exactly 8 unchecked DEP-AUD checkboxes (`grep -c '^- \[ \] DEP-AUD-'` returns 8)
    - AUDIT-REPORT.md contains section headings `## §1 DEP-AUD-01` through `## §8 DEP-AUD-08`
    - `apps/web/tests/e2e/audit/session-revocation.audit.spec.ts` exists
    - The spec file contains `test("logged-out JWT is rejected within 60s"`
    - The spec file references `AUDIT_USER_EMAIL` and `AUDIT_USER_PASSWORD` env vars
    - The spec file imports from `@playwright/test`
  </acceptance_criteria>
  <done>gitleaks config loads, AUDIT-REPORT.md skeleton has 8 sections, session-revocation spec scaffolded — Plans 04 and 07 have inputs, Plans 02–08 have a place to record verdicts.</done>
</task>

</tasks>

<verification>
1. `test ! -f drizzle/0002_showcase_cards.sql` (orphan deleted)
2. `node scripts/drizzle-prod-guard.mjs` exits 0 with no env vars set
3. `DATABASE_URL=postgresql://postgres.abcd:p@h DRIZZLE_PROD_REFS=abcd node scripts/drizzle-prod-guard.mjs` exits 1
4. `grep -q "predb:push" package.json && grep -q "predb:migrate" package.json` (both hooks wired)
5. `grep -q "id: ADR-003" .planning/ADR-003-drizzle-dev-only.md` (ADR committed)
6. `docker run --rm -v "$(pwd):/repo" -w /repo ghcr.io/gitleaks/gitleaks:latest git --config /repo/.gitleaks.toml --no-banner 2>&1 | grep -q "loaded config"`
7. `grep -c '^- \[ \] DEP-AUD-' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md` returns 8
8. `test -f apps/web/tests/e2e/audit/session-revocation.audit.spec.ts`
9. `test -f .planning/phases/033-pre-deploy-audit-gate/evidence/.gitignore`
10. Commit all with message `docs(033): wave 0 drift fix + audit scaffolding` and files staged from this plan
</verification>

<success_criteria>
- SYSTEMIC #0 drift closed: orphan deleted, prod guard wired, ADR-003 committed
- Wave 1 (Plans 02, 03) can begin — no scaffold is missing
- Wave 2 (Plan 04) has a Playwright spec file to execute
- Wave 3 (Plan 07) has `.gitleaks.toml` to scan against
- Wave 4 (Plan 08) has an AUDIT-REPORT.md skeleton to populate
- Docker Desktop confirmed available for Audits 2a and 7
</success_criteria>

<output>
After completion, create `.planning/phases/033-pre-deploy-audit-gate/033-01-SUMMARY.md`
</output>
</content>
</invoke>