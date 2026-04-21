# Phase 33: Pre-Deploy Audit Gate — Research

**Researched:** 2026-04-21
**Domain:** Pre-deploy verification gate (8 audits + 1 migration-drift fix) for Next.js 15 + Supabase + pnpm monorepo on Windows host
**Confidence:** HIGH — every command below is verified against the repo, `apps/web/package.json`, CI workflow, and April 2026 Supabase / gitleaks docs

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Drift `drizzle/` vs `supabase/migrations/` (SYSTEMIC #0 from 2026-04-03 audit):**
- **D-01:** `supabase/migrations/` is the **sole authoritative trail** for prod. Prod migrations apply exclusively via `supabase db push` or equivalent CLI — never `drizzle-kit push`, never `drizzle-kit migrate`.
- **D-02:** `drizzle/` is kept in repo for **development use only** — schema authoring via TypeScript + type generation (`drizzle-kit generate`). It produces SQL snapshots that are NOT applied to prod automatically.
- **D-03:** Delete the orphan file `drizzle/0002_showcase_cards.sql` (present in `drizzle/` but not in `drizzle/meta/_journal.json` — confirmed during research).
- **D-04:** Add a hard block so `drizzle-kit push` cannot target prod. Implementation: `package.json` script wrapper that errors when `DATABASE_URL` points at the prod Supabase host (detect via project ref pattern), plus docs in `CONTRIBUTING.md` or equivalent.
- **D-05:** Write a short ADR (`.planning/ADR-003-drizzle-dev-only.md`) capturing the decision and rationale — permanent reference for future contributors.

**`supabase db reset` test environment (DEP-AUD-02):**
- **D-06:** Run `supabase db reset` on **both** environments:
  1. **Local Supabase via Docker** — quick check, matches solo-dev workflow
  2. **Throwaway hosted Supabase Cloud project** — 1:1 with prod environment; free tier; provisioned, tested, deleted within the phase
- **D-07:** The hosted throwaway project is the "blocker" — if it fails, Phase 34 cannot start. Local is a fast-feedback step before the cloud test.

**Cold-start verification (DEP-AUD-03):**
- **D-08:** Phase 33 does **local proof only** — `pnpm build && pnpm --filter @digswap/web start`, let server idle 15 min, then `curl -I http://localhost:3000/`, `/signin`, `/signup`, `/pricing`. Pass: all return 200, no server-side exceptions in logs.
- **D-09:** **Real cold-start validation (Vercel serverless) is explicitly deferred to Phase 38** (DEP-UAT-03).
- **D-10:** If the local proof surfaces any crash on public routes, **fix inline** in Phase 33 before progressing to Phase 34.

**Evidence artifact (DEP-AUD-01 through DEP-AUD-08):**
- **D-11:** Single committed artifact: `.planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md`. Structure: checkbox per requirement + evidence block (command run, output excerpt or screenshot link, timestamp, pass/fail verdict).
- **D-12:** For CI gate evidence (DEP-AUD-01), paste output of `pnpm --filter @digswap/web typecheck`, `build`, `lint`, `test` + `pnpm audit --prod --audit-level high` directly in the report.
- **D-13:** For session revocation E2E (DEP-AUD-04), capture curl output showing `200` before logout + `401` within 60s after logout with same bearer.
- **D-14:** For git history scan (DEP-AUD-07), use **gitleaks** (standard, maintained, docker-runnable) — output its JSON report with zero findings.
- **D-15:** For env inventory (DEP-AUD-08), generate a table in AUDIT-REPORT.md mapping every var in `.env.local.example` to its prod value source — zero `TBD` rows before exit.

**Failing-gate handling:**
- **D-16:** If any of the 8 checks fails, **fix inline** in Phase 33 scope. Only open a decimal phase (33.1, 33.2) when a fix is >2h of work.
- **D-17:** No partial promotions — Phase 34 does not start until AUDIT-REPORT.md shows all 8 checks green.

### Claude's Discretion

- Exact shell command syntax for reset tests, build commands, and curl payloads
- Format/style of AUDIT-REPORT.md sections beyond the checkbox + evidence skeleton
- ADR-003 wording and structure
- Whether to use a Makefile/justfile target or just shell scripts for the audit flow
- How to phrase the `package.json` drizzle-kit block (error message, detection logic)
- CSP verification approach for DEP-AUD-06 (likely just confirm existing memory note + a smoke test of DevTools console on localhost, unless something regressed)

### Deferred Ideas (OUT OF SCOPE)

- Wire gitleaks into CI as a recurring job (post-v1.4 chore)
- Automated env inventory drift detection (post-v1.4)
- `supabase db reset` in CI (post-launch)
- ADR for `NEXT_PUBLIC_` prefix hygiene (post-v1.4)
- Any prod Supabase/Vercel/Stripe/Discogs/Resend/Upstash/Sentry setup (Phases 34–37)
- Vercel serverless cold-start tuning (Phase 38)
- DNS/SSL/CAA records (Phase 36)
- Monitoring/observability wiring (Phase 39)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEP-AUD-01 | All 4 CI gates green against main (typecheck, build, test, lint) + `pnpm audit --prod --audit-level high` | §Audit 1 — verified pnpm workspace script names match `apps/web/package.json`; CI env-var prelude documented |
| DEP-AUD-02 | Migration trail applies cleanly on empty Supabase — `supabase db reset` succeeds locally + on throwaway cloud project | §Audit 2 — exact two-stage flow (local Docker, then `supabase projects create/delete`); includes SYSTEMIC #0 drift-fix as precondition |
| DEP-AUD-03 | Cold-start 500 fix independently verified via curl on `/`, `/signin`, `/signup`, `/pricing` (LOCAL ONLY per D-08) | §Audit 3 — `pnpm build && pnpm start` + 15-min idle + `curl -o /dev/null -w` pattern |
| DEP-AUD-04 | Session revocation E2E: logged-out token returns 401 within 60s | §Audit 4 — Playwright-captured JWT + curl replay; middleware path in `apps/web/src/lib/supabase/middleware.ts:96-112` |
| DEP-AUD-05 | Discogs OAuth tokens encrypted via Supabase Vault (no plaintext fallback) | §Audit 5 — `vault.decrypted_secrets` view query; `discogs_tokens` table COUNT check; path evidence in `apps/web/src/lib/discogs/oauth.ts:92-129` |
| DEP-AUD-06 | Outstanding CSP issue from 2026-03-28 audit confirmed resolved or documented | §Audit 6 — re-confirmation only (user memory says fixed); DevTools Console check on local prod build |
| DEP-AUD-07 | Git history scanned — zero committed secrets | §Audit 7 — gitleaks v8 via Docker (no host install required on Windows); custom `.gitleaks.toml` scoped to the 7 target secret names |
| DEP-AUD-08 | Env inventory: every `.env.local.example` var mapped to prod value source, zero `TBD` | §Audit 8 — 21-row table template; source-of-value matrix (Supabase dashboard / Stripe dashboard / `openssl rand -hex 32` / Upstash / Resend / Sentry / Discogs prod app) |
</phase_requirements>

---

## Summary

Phase 33 is a pure verification gate. Every one of the 8 DEP-AUD-* checks reduces to: run a specific command, capture its output, and paste that output (with a verdict) into `AUDIT-REPORT.md`. Nothing in this phase touches production infrastructure; nothing ships new product code. The one structural change permitted is **SYSTEMIC #0** — deleting `drizzle/0002_showcase_cards.sql`, adding the prod-guard script, and writing ADR-003. Those must complete before DEP-AUD-02 runs because the reset test validates the trail that SYSTEMIC #0 cleans up.

**Environment baseline confirmed:**
- `pnpm` 10.30.3 present on PATH (Windows host)
- `supabase` CLI available via `pnpm dlx supabase` (returns v2.93.0 — tested during research)
- `docker` / `gitleaks` NOT on PATH — must use Docker Desktop; research confirmed both tools run fine via `docker run` when Docker Desktop is up
- CI workflow (`.github/workflows/ci.yml`) already runs `typecheck`, `lint`, `test`, `build` — Phase 33 re-runs the same scripts locally against `main` HEAD for independent evidence

**Migration drift inventory (verified 2026-04-21):**
- `drizzle/meta/_journal.json` tracks 6 entries: `0000_wandering_lord_hawal`, `0001_thick_jackpot`, `0002_aberrant_pyro`, `0003_free_gateway`, `0004_gin_indexes_genre_leaderboard_mv`, `0005_stripe_event_log`
- Files on disk in `drizzle/`: those 6 files PLUS `drizzle/0002_showcase_cards.sql` (the orphan)
- `supabase/migrations/` has 28 files: `030_purge_soft_deleted.sql` + 27 date-tagged files `20260327_*` through `20260418_*`

**Primary recommendation:** Execute in five waves — (W0) drift-fix + ADR-003 (blocks W1's reset test); (W1) DEP-AUD-01 CI gates in parallel with DEP-AUD-02 reset tests; (W2) DEP-AUD-03 cold-start + DEP-AUD-04 session revocation (require a running local prod build); (W3) DEP-AUD-05 Vault + DEP-AUD-06 CSP + DEP-AUD-07 gitleaks (independent checks); (W4) DEP-AUD-08 env inventory + AUDIT-REPORT.md assembly (synthesizes everything). Total time budget: **6–9 hours** of focused work if nothing fails; each fail-inline contingency adds 1–2h.

---

## Standard Stack

### Core (already in repo — do NOT re-choose)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pnpm | 10.30.3 | Workspace/package manager | Declared in root `package.json` `packageManager` field; all scripts use `pnpm --filter` |
| Next.js | 15.5.15 | Web app framework | `apps/web/package.json` pins `next@15.5.15` |
| Supabase CLI | 2.93.0 (via `pnpm dlx supabase`) | Migration apply, reset, project create/delete | Works cross-platform without global install; matches `supabase/migrations/` trail |
| Docker Desktop | Windows (must be running) | Host for local Supabase + gitleaks container | Required for `supabase start` (local reset) AND `docker run ghcr.io/gitleaks/gitleaks:latest` |
| gitleaks | v8+ (`ghcr.io/gitleaks/gitleaks:latest` via Docker) | Git-history secret scan | Maintained, Docker-runnable, JSON output; no Node install needed |
| Biome | 2.4.8 | Lint (via `pnpm --filter @digswap/web lint`) | Already wired |
| Vitest | 4.1.2 | Unit/integration tests | Already wired |
| Playwright | 1.58.2 | E2E tests (used for DEP-AUD-04 session revocation) | Already wired |
| `tsc --noEmit` | TypeScript 5.x | Typecheck | Wired as `pnpm --filter @digswap/web typecheck` |

### Tools Introduced This Phase

| Tool | Why | Alternative |
|------|-----|-------------|
| gitleaks (Docker) | DEP-AUD-07 git history scan | TruffleHog — more false-positives; rejected per D-14 "standard, maintained, docker-runnable" |
| `.gitleaks.toml` config file | Scope DEP-AUD-07 to the 7 target secret names | Inline `--config-path` with ad-hoc rules — less reviewable |
| Prod-guard shell script (invoked by npm `pre*` hook) | D-04 hard block on `drizzle-kit push` against prod | Husky pre-commit hook — rejected because the block needs to fire at script-run time, not commit time |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Local Supabase + throwaway cloud (D-06) | Throwaway cloud only | Loses fast-feedback; local Docker reset catches tooling-specific issues in seconds, not minutes |
| gitleaks Docker | gitleaks native Windows binary | Binary install adds PATH surface on a Windows host; Docker image is reproducible and matches what CI would run if wired later |
| Playwright for session revocation E2E | Raw curl + manual JWT copy | Playwright already wired; produces a committed test file that doubles as regression guard |

**Installation (all Phase 33 tooling, no global installs required):**
```bash
# Supabase CLI (via pnpm dlx — no global install)
pnpm dlx supabase --version   # expect 2.x

# gitleaks (via Docker — Docker Desktop must be running)
docker pull ghcr.io/gitleaks/gitleaks:latest

# Everything else already in apps/web/package.json devDependencies
```

**Version verification performed:**
- `pnpm dlx supabase --version` → `2.93.0` (verified 2026-04-21)
- `pnpm --version` → `10.30.3` (verified 2026-04-21)
- gitleaks latest via GHCR: `ghcr.io/gitleaks/gitleaks:latest` (official image per gitleaks/gitleaks GitHub)

---

## Architecture Patterns

### AUDIT-REPORT.md Structure (D-11)

Single file per phase, committed alongside other phase artifacts:

```
.planning/phases/033-pre-deploy-audit-gate/
├── 033-CONTEXT.md       (exists)
├── 033-RESEARCH.md      (this file)
├── 033-PLAN-*.md        (produced by planner)
├── AUDIT-REPORT.md      (Wave-4 deliverable — evidence for all 8 checks)
├── evidence/            (pasted command outputs, JSON reports, screenshots)
│   ├── 01-ci-gates.txt
│   ├── 02a-db-reset-local.txt
│   ├── 02b-db-reset-cloud.txt
│   ├── 03-coldstart-curl.txt
│   ├── 04-session-revocation.txt
│   ├── 05-vault-discogs.txt
│   ├── 06-csp-console.png
│   ├── 07-gitleaks-report.json
│   └── 08-env-inventory.md
```

Rationale: evidence files (raw command output, JSON, screenshots) live in `evidence/`; AUDIT-REPORT.md links to them and contains the summary verdict. Keeps AUDIT-REPORT.md readable while preserving full forensic trail.

### AUDIT-REPORT.md Section Template (recommended)

```markdown
# Phase 33 Audit Report

**Executed:** <date>
**main HEAD at audit start:** <git rev-parse HEAD>
**Verdict:** [GREEN — all 8 checks pass] / [BLOCKED — N checks failed, see below]

## Checklist
- [x] DEP-AUD-01: CI gates green ............. PASS (evidence: evidence/01-ci-gates.txt)
- [x] DEP-AUD-02: Supabase reset clean ....... PASS (evidence: evidence/02a-*, 02b-*)
- [ ] DEP-AUD-03: Cold-start curl 200/3s ..... BLOCKED — see §3
- ...

## §1 DEP-AUD-01 CI Gates
**Command:** `pnpm --filter @digswap/web typecheck && pnpm --filter @digswap/web lint && pnpm --filter @digswap/web test && pnpm --filter @digswap/web build && pnpm audit --prod --audit-level high`
**Exit code:** 0
**Timestamp:** <ISO8601>
**Output excerpt:** first + last 20 lines (full in evidence/01-ci-gates.txt)
**Verdict:** PASS

## §2 DEP-AUD-02 ...
```

### SYSTEMIC #0 Fix Pattern (Wave 0, must complete before DEP-AUD-02)

Three sub-tasks (D-03 + D-04 + D-05):

**1. Delete orphan:**
```bash
git rm drizzle/0002_showcase_cards.sql
```

**2. Add prod-guard script** — recommended implementation at root `package.json` scripts block:

```json
{
  "scripts": {
    "db:guard": "node scripts/drizzle-prod-guard.mjs",
    "predb:push": "pnpm db:guard",
    "predb:migrate": "pnpm db:guard"
  }
}
```

And `scripts/drizzle-prod-guard.mjs`:

```javascript
// Refuses drizzle-kit push/migrate if DATABASE_URL points at the prod Supabase project.
// Prod Supabase connection strings contain the project ref in the host — e.g.
//   postgresql://postgres.<prod-ref>:password@aws-0-<region>.pooler.supabase.com:6543/postgres
// The guard fires when the URL contains any ref listed in DRIZZLE_PROD_REFS (comma-separated env)
// OR when it matches a hard-coded prod pattern.
const url = process.env.DATABASE_URL ?? "";
const prodRefs = (process.env.DRIZZLE_PROD_REFS ?? "").split(",").filter(Boolean);
const looksLikeProd = prodRefs.some(ref => ref && url.includes(ref));
if (looksLikeProd) {
  console.error("✗ drizzle-kit is NEVER used against prod. Apply migrations via `supabase db push`. See ADR-003.");
  process.exit(1);
}
console.log("✓ drizzle-kit guard: DATABASE_URL is not prod.");
```

Rationale: script-level guard runs automatically when any developer (or AI agent) triggers a `db:push` / `db:migrate` script. `DRIZZLE_PROD_REFS` env var is set on the dev machine once, at the same time the prod Supabase project is created in Phase 34.

**3. Write ADR-003** — template in §Code Examples below.

### Waves (dependency graph)

```
Wave 0 (SYSTEMIC #0 fix) — blocks Wave 1b
├─ T-0.1 Delete drizzle/0002_showcase_cards.sql
├─ T-0.2 Add prod-guard script + wire predb:push/predb:migrate
├─ T-0.3 Write ADR-003
└─ T-0.4 Update CONTRIBUTING.md with drizzle dev-only policy

Wave 1 (independent, can run in parallel)
├─ T-1a DEP-AUD-01 CI gates (typecheck/lint/test/build + pnpm audit)
└─ T-1b DEP-AUD-02 Reset trail (requires Wave 0 complete)
     ├─ T-1b.i Local Docker reset
     └─ T-1b.ii Throwaway cloud reset (provision → reset → delete)

Wave 2 (requires a running local prod build; can be sequential or parallel)
├─ T-2a DEP-AUD-03 Cold-start curl
└─ T-2b DEP-AUD-04 Session revocation E2E

Wave 3 (independent checks, all parallel)
├─ T-3a DEP-AUD-05 Vault/Discogs token check
├─ T-3b DEP-AUD-06 CSP re-confirmation
└─ T-3c DEP-AUD-07 gitleaks git-history scan

Wave 4 (synthesis)
├─ T-4a DEP-AUD-08 Env inventory table
└─ T-4b Assemble AUDIT-REPORT.md + link evidence/* files
```

**Why T-1b depends on Wave 0:** The reset test validates the current state of the `supabase/migrations/` trail. If the orphan `drizzle/0002_showcase_cards.sql` is still present when DEP-AUD-02 runs, nothing breaks functionally (the file isn't applied), but the audit report would capture a repo that still contains the known drift. Cleaner to fix first and then prove clean.

**Why T-2a/T-2b can be parallel:** Both need `pnpm start` running. One `start` process serves both. One human operator can run the curl (T-2a) while Playwright (T-2b) is also hitting localhost — no port conflict because Playwright uses the same 3000 server. Practically may be sequential for a solo dev, but the plan shouldn't force it.

### Anti-Patterns to Avoid

- **Running DEP-AUD-02 against the dev Supabase project.** `supabase db reset --linked` **DROPS AND RECREATES THE ENTIRE DATABASE**. The only safe targets are (a) local Docker Supabase, and (b) a freshly-created throwaway cloud project. Before running, `supabase projects list` and `supabase link --project-ref <throwaway-ref>` must be verified.
- **Running `pnpm audit` without `--prod`.** Dev deps (Playwright browsers, Vite, etc.) have many known but non-exploitable advisories; `--prod` filters them out. `--audit-level high` filters noise below HIGH.
- **Letting evidence files live only in stdout.** Without `tee` (or `2>&1 | tee`), the output isn't captured. Use `2>&1 | tee evidence/NN-*.txt` on every command.
- **Running the gitleaks scan on the worktree with uncommitted `.env.local`.** The scan checks COMMITTED history, not the working tree. Confirm `.env.local` is gitignored before running (and after running, to catch ordering mistakes).
- **Trusting a passing `curl /` as proof of cold-start fix.** Pitfall #8's actual failure mode is 500 after a 15-min Lambda idle. Locally, `pnpm start` doesn't suffer true cold-start. D-08 accepts this limitation — "local proof only"; real verification is Phase 38.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git-history secret scan | Custom regex over `git log -p` | gitleaks (via Docker) | gitleaks ships 100+ detectors, handles entropy thresholds, and outputs stable JSON. A hand-rolled regex misses packed-objects and historical file renames. |
| Session-revocation E2E | Custom HTTP harness | Playwright `browserContext` + `page.request` | Playwright can capture the real browser JWT from cookies, then replay it as a raw request — zero custom token-extraction code. |
| Supabase local DB | Manual docker-compose | `supabase start` | Ships the full stack (Postgres + Auth + Storage + Realtime + Edge Functions) with the correct extensions (pgsodium, pg_cron, supabase_vault) pre-enabled. |
| Prod DB detection | Hard-coded prod URL string | `DRIZZLE_PROD_REFS` env + substring match in guard script | Solo-dev workflow: set it once, guard works anywhere. Hard-coded string would leak prod identity into the repo before Phase 34 creates the project. |
| Env inventory format | Freeform Markdown prose | Table with 5 fixed columns (§Audit 8) | Planner + verifier both machine-check for `TBD` rows; structured table makes the zero-TBD criterion enforceable. |

**Key insight:** This phase is about producing evidence, not building tooling. Every "I could write a quick script for this" impulse should resolve to "is there a maintained tool that already does it?" — and in every case for Phase 33 the answer is yes.

---

## Audit 1 — DEP-AUD-01: CI Gates + Prod Audit

**Exact commands** (run from repo root):

```bash
# Capture current main HEAD for the audit report
git rev-parse HEAD > evidence/00-head.txt

# The 4 CI gates, each with output captured
pnpm --filter @digswap/web typecheck 2>&1 | tee evidence/01a-typecheck.txt
pnpm --filter @digswap/web lint      2>&1 | tee evidence/01b-lint.txt
pnpm --filter @digswap/web test      2>&1 | tee evidence/01c-test.txt
pnpm --filter @digswap/web build     2>&1 | tee evidence/01d-build.txt

# Dependency security audit (production only, HIGH+)
pnpm audit --prod --audit-level high 2>&1 | tee evidence/01e-audit.txt
```

**Pass/fail thresholds:**

| Command | PASS criterion |
|---------|----------------|
| typecheck | Exit 0; final line matches `Done in N.NNs` (tsc returns non-zero on any error) |
| lint | Exit 0; Biome output ends with `Checked N files ... No fixes applied` (no errors; warnings allowed) |
| test | Exit 0; Vitest footer shows `Test Files  X passed (X)` with 0 failed and 0 "pending if treated as failure" |
| build | Exit 0; output includes `✓ Generating static pages` and `○ (Static) ● (SSG) ƒ (Dynamic)` route table |
| audit | Exit 0 OR `No known vulnerabilities found` in output |

**Evidence shape:** Plain text files in `evidence/01*.txt` captured via `tee`. AUDIT-REPORT.md §1 pastes the last ~20 lines of each (the summary footer) and declares verdict.

**Windows/Path gotchas:**
- The `tee` command ships with Git Bash / MSYS2 on Windows — confirmed part of the default Git-for-Windows install. PowerShell's `Tee-Object` works but forces `\r\n` line endings; prefer bash shell for consistency.
- Running `pnpm --filter` from a nested directory works thanks to pnpm's workspace-root detection — no `cd` required.
- Exit codes in PowerShell: `$LASTEXITCODE` after each command, not `$?`. Prefer bash.

**Time budget:** ~8–15 min total (typecheck ~30s, lint ~10s, test ~60-90s, build ~60-120s, audit ~10s). No fail-inline budget needed if CI already passed on main — which it did per commit 35ed595.

---

## Audit 2 — DEP-AUD-02: `supabase db reset` on Empty DB

**Prerequisite:** Wave 0 SYSTEMIC #0 fix complete (orphan deleted, ADR-003 committed).

### 2a. Local Docker reset (fast-feedback first)

**Exact commands:**

```bash
# Ensure Docker Desktop is running (Windows host)
docker info 2>&1 | head -3   # expect "Server Version: ..."

# Start the local Supabase stack (pulls images first time)
pnpm dlx supabase start 2>&1 | tee evidence/02a-start.txt
# Note: on first run expect 3-5 min of image downloads. Subsequent runs ~30s.

# Run the reset against the LOCAL stack (no --linked flag = local)
pnpm dlx supabase db reset 2>&1 | tee evidence/02a-reset.txt

# Stop the local stack when done
pnpm dlx supabase stop
```

**Pass criterion:**
- `supabase start` output ends with `Started supabase local development setup.`
- `supabase db reset` exits 0; last lines of output show `Finished supabase db reset on branch local.`
- No error substring in output: grep for `ERROR`, `FATAL`, `relation .* does not exist` — all must be zero matches

### 2b. Throwaway hosted cloud reset (the GATE per D-07)

**Exact commands** (sequence matters — requires `supabase login` performed once, beforehand):

```bash
# One-time setup (only if not already logged in)
pnpm dlx supabase login   # browser OAuth flow

# List orgs to grab org-id
pnpm dlx supabase orgs list 2>&1 | tee evidence/02b-orgs.txt
# Copy the org ref you'll use below

# Create the throwaway project (name: digswap-audit-YYYYMMDD)
AUDIT_PROJECT_NAME="digswap-audit-$(date +%Y%m%d-%H%M)"
AUDIT_DB_PASSWORD=$(openssl rand -hex 16)
pnpm dlx supabase projects create "$AUDIT_PROJECT_NAME" \
  --org-id <your-org-id> \
  --region us-east-1 \
  --db-password "$AUDIT_DB_PASSWORD" \
  --size nano \
  2>&1 | tee evidence/02b-create.txt
# Capture the project ref from the output

AUDIT_PROJECT_REF="<paste-ref-from-above>"

# Link the repo to the throwaway project
pnpm dlx supabase link --project-ref "$AUDIT_PROJECT_REF" \
  --password "$AUDIT_DB_PASSWORD" \
  2>&1 | tee evidence/02b-link.txt

# Confirm linked ref matches the throwaway (paranoia step — D-07)
pnpm dlx supabase projects list 2>&1 | grep "●"   # the ● marks the linked project

# Apply all migrations via db push (the prod pattern, applied to throwaway)
pnpm dlx supabase db push --linked 2>&1 | tee evidence/02b-push.txt

# Alternative: reset --linked, which drops everything then reapplies from supabase/migrations/
# Use push for first-time; use reset for the "can the trail replay from scratch?" check
# Per D-06 "applies the entire supabase/migrations/ trail end-to-end" — use RESET for the audit proof
pnpm dlx supabase db reset --linked 2>&1 | tee evidence/02b-reset.txt
# When prompted "Do you want to reset the remote database?" — answer Y

# TEARDOWN — delete the throwaway project
pnpm dlx supabase projects delete "$AUDIT_PROJECT_REF" 2>&1 | tee evidence/02b-delete.txt
# Confirm via projects list that it's gone
pnpm dlx supabase projects list 2>&1 | grep "$AUDIT_PROJECT_REF" && echo "NOT DELETED" || echo "DELETED"
```

**Pass criterion:**
- `projects create` exit 0; output includes `API URL: https://<ref>.supabase.co`
- `db push --linked` exit 0; output includes `Finished supabase db push.`
- `db reset --linked` exit 0; output includes `Finished supabase db reset on branch <ref>`
- `projects delete` exit 0; subsequent `projects list` does NOT show the ref

**Evidence shape:** 5 text files in `evidence/02b-*.txt`. AUDIT-REPORT.md §2 pastes the tail of `02b-reset.txt` showing migration count applied + final success line.

**Critical gotchas:**

1. **`supabase db reset --linked` is destructive by default** — it drops all user-created entities. Safe here because the project is throwaway; fatal if accidentally run against the dev or prod project. **Mandatory safety step** before running: `supabase projects list` AND confirm `●` marker points at the throwaway ref.
2. **Free-tier org project limit:** Supabase free tier allows 2 projects per org. If the dev `digswap-dev` project exists AND a throwaway was left from a prior audit run, the create call fails. Inspect + clean up stale throwaways first via `projects list`.
3. **Region: use `us-east-1`** for the throwaway to match the likely prod region (per ARCHITECTURE.md recommendation). Different regions can surface different extension availability — unusual but worth eliminating.
4. **Size `nano`** (smallest compute) keeps costs at $0 (free tier). Default `micro` also free-tier-eligible.
5. **Delete immediately after the reset passes.** Leaving the project around consumes the free-tier slot, blocking Phase 34's real prod creation.
6. **`pg_cron` behavior on fresh project:** Migrations that `SELECT cron.schedule(...)` may warn but not fail on a fresh project if the role running them lacks superuser (this is Pitfall #18). If `02b-reset.txt` shows cron warnings, document in AUDIT-REPORT.md but do not block — Phase 34 handles cron-creating migrations via the SQL Editor per Pitfall #18's fix.

**Time budget:** 2a ~5-10 min (first-run image pull), 2b ~15-20 min (project provisioning is ~2 min, reset ~2 min, delete ~30s). Total ~25 min. Fail-inline budget: if a migration breaks under reset, the fix is in `supabase/migrations/` — 15-60 min depending on the break.

---

## Audit 3 — DEP-AUD-03: Cold-Start Public Routes (LOCAL ONLY per D-08)

**Exact commands** (bash — run from repo root):

```bash
# 1. Produce a production build with real env
pnpm --filter @digswap/web build 2>&1 | tee evidence/03-build.txt

# 2. Start the production server (terminal A — foreground or background)
pnpm --filter @digswap/web start &
START_PID=$!
echo "Started Next.js prod server, PID=$START_PID"

# 3. Wait for ready — poll up to 30s
for i in {1..30}; do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ && echo " ready" && break
  sleep 1
done

# 4. Enforce the 15-min idle per D-08
echo "Idling for 15 min (per D-08) to simulate cold-ish state..."
sleep 900

# 5. Curl each public route, capturing code + time + full headers
for path in / /signin /signup /pricing; do
  echo "=== $path ==="
  curl -o /dev/null -w "HTTP %{http_code}  time_total=%{time_total}s  time_starttransfer=%{time_starttransfer}s\n" \
       "http://localhost:3000${path}"
  echo "--- headers ---"
  curl -sI "http://localhost:3000${path}" | head -20
done 2>&1 | tee evidence/03-coldstart.txt

# 6. Check server logs (terminal A's output) for exceptions
# If you ran `pnpm start &`, stderr is inline. Capture via:
kill $START_PID
wait $START_PID 2>&1 | tee evidence/03-server-stderr.txt
```

**Pass criterion:**

| Observable | Threshold |
|------------|-----------|
| HTTP status per route | 200 (NOT 500, 404, 301, or 503) |
| `time_total` | < 3.0s (per ROADMAP success criterion 3) |
| Server log | Zero lines matching `Error:`, `TypeError`, `UnhandledRejection`, or stack traces |

**Evidence shape:** `evidence/03-coldstart.txt` (curl output) + `evidence/03-server-stderr.txt` (server log). AUDIT-REPORT.md §3 pastes the 4 `HTTP ... time_total=...` lines and declares verdict.

**Windows-specific gotchas:**

1. **`sleep 900` in PowerShell doesn't work** (PowerShell has `Start-Sleep -Seconds 900`). Use bash (Git Bash / WSL).
2. **`&` backgrounding in PowerShell:** use `Start-Job` instead. Simpler: keep `pnpm start` in one terminal, run curl in another.
3. **Env vars at build time:** `.env.local` must be present with valid-looking dev values for the Zod schema in `apps/web/src/lib/env.ts` to pass. Using throwaway cloud project's URL/anon key (from Audit 2) is legitimate; otherwise the dev Supabase values are fine (the build doesn't actually hit Supabase).
4. **Port conflict with concurrent `pnpm dev`:** Per the 2026-04-06 audit, port 3000 may already be in use (`EADDRINUSE`). Kill any prior dev server before `pnpm start`: `lsof -ti:3000 | xargs kill` (Git Bash) or `Get-NetTCPConnection -LocalPort 3000 | Stop-Process` (PowerShell).

**Why local proof satisfies D-08:** Real cold-start (fresh Lambda on Vercel) requires Vercel. The local prod server is always-warm, so it cannot prove Pitfall #8's actual failure surface. What it CAN prove — and what DEP-AUD-03 scopes to — is that the code path doesn't throw at import/first-request time. The 15-min idle approximates the situation where internal module caches settle without the middleware being exercised, but it's not a true cold start. D-09 defers the real test to Phase 38 (DEP-UAT-03).

**Fail-inline guidance (per D-10):** If any route returns 500 or a stack trace appears in stderr, the fix almost certainly lives in `apps/web/src/lib/supabase/middleware.ts:45-47` (`getUser()` call) or `apps/web/src/app/pricing/page.tsx` (which per the 2026-04-06 audit also calls `getUser()` for a public route). Wrap those calls in try/catch, treat failure as anonymous, continue. Fix time: ~30-60 min.

**Time budget:** 15-min sleep is the dominant cost. Total wall-clock ~20 min; active work ~3 min.

---

## Audit 4 — DEP-AUD-04: Session Revocation E2E

**Exact pattern** (Playwright + raw curl replay):

Create `apps/web/tests/e2e/audit/session-revocation.audit.spec.ts`:

```typescript
import { test, expect, request as pwRequest } from "@playwright/test";

// DEP-AUD-04: a logged-out JWT must return 401 on protected API routes within 60s.
// This is a "claim verification" test produced by Phase 33's audit —
// it runs against the LOCAL prod server (pnpm start on :3000).

test("logged-out JWT is rejected within 60s", async ({ page, browser }) => {
  // 1. Sign in with a known audit user (created for this purpose)
  const AUDIT_EMAIL = process.env.AUDIT_USER_EMAIL!;
  const AUDIT_PASSWORD = process.env.AUDIT_USER_PASSWORD!;

  await page.goto("http://localhost:3000/signin");
  await page.fill('input[name="email"]', AUDIT_EMAIL);
  await page.fill('input[name="password"]', AUDIT_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/feed|\/onboarding/, { timeout: 10_000 });

  // 2. Extract the access token from the Supabase auth cookie
  const cookies = await page.context().cookies();
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split(".")[0];
  const authCookieName = `sb-${projectRef}-auth-token`;
  const authCookie = cookies.find((c) => c.name === authCookieName);
  expect(authCookie, "must have auth cookie after signin").toBeDefined();

  // The cookie stores a JSON array [access_token, refresh_token, ...] possibly base64-prefixed
  let rawValue = authCookie!.value;
  if (rawValue.startsWith("base64-")) {
    rawValue = Buffer.from(rawValue.slice(7), "base64").toString();
  }
  const parsed = JSON.parse(decodeURIComponent(rawValue));
  const accessToken = Array.isArray(parsed) ? parsed[0] : parsed.access_token;
  expect(accessToken, "must extract access_token").toBeTruthy();

  // 3. Confirm the token works on a protected API BEFORE logout
  const apiClient = await pwRequest.newContext();
  const preLogoutResp = await apiClient.get("http://localhost:3000/api/user/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  console.log("[audit] pre-logout status:", preLogoutResp.status());
  expect(preLogoutResp.status(), "token must work before logout").toBeLessThan(400);

  // 4. Log out via the UI
  await page.goto("http://localhost:3000/settings/sessions");  // or wherever logout lives
  await page.click("text=/sign.*out/i");
  await page.waitForURL(/\/signin/, { timeout: 10_000 });

  // 5. Replay the same token against the protected API — expect 401 within 60s
  const start = Date.now();
  let finalStatus = 0;
  while (Date.now() - start < 60_000) {
    const resp = await apiClient.get("http://localhost:3000/api/user/me", {
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

**Run:**

```bash
# With pnpm start still running from Audit 3
AUDIT_USER_EMAIL="audit+33@digswap.test" \
AUDIT_USER_PASSWORD="<password>" \
  pnpm --filter @digswap/web exec playwright test audit/session-revocation.audit.spec.ts 2>&1 | tee evidence/04-session-revocation.txt
```

**Pass criterion:**
- Test exits 0
- Log shows `pre-logout status: <2xx>` AND `post-logout status: 401 after <ms>` where `ms < 60000`

**Evidence shape:** `evidence/04-session-revocation.txt`. AUDIT-REPORT.md §4 pastes the three `[audit]` log lines.

**Gotchas:**

1. **Endpoint `/api/user/me` must exist and be protected.** If it doesn't, substitute any protected API route. `apps/web/src/app/api/` should have one such route — verify before writing the test. Candidate endpoints that are protected (per middleware.ts matcher + the session allowlist check): any non-bypassed `/api/*`. The middleware source explicitly bypasses `/api/stripe/`, `/api/og/`, `/api/discogs/import`, `/api/desktop/` — pick an endpoint NOT in that bypass list.
2. **Audit user must already exist.** Create `audit+33@digswap.test` in the dev Supabase project once, before the test runs. Do NOT commit the password; pass via env var.
3. **`NEXT_PUBLIC_SUPABASE_URL` must be set at test time** so the project ref extraction works. Since `pnpm start` loads `.env.local`, Playwright invoked from the same shell inherits it.
4. **Cookie encoding varies** — Supabase SSR switched formats in 2025. The code handles both the JSON array form and the `base64-` prefix form (matches `apps/web/src/lib/supabase/middleware.ts:82-90`).
5. **60s bound comes from ROADMAP criterion 4 and user_sessions allowlist check.** Middleware revalidates on every request, so a revoked session should fail the next protected request — typically sub-second, never 60s. If it takes 55s to fail, something's wrong but still passes.

**Time budget:** ~5 min once the test file is written. Writing the test: ~30 min. Fail-inline: if the token keeps working past 60s, the session revocation is broken and needs a real fix — Pitfall #10 scope, 1-2h.

---

## Audit 5 — DEP-AUD-05: Discogs Tokens via Supabase Vault

**Background** (verified from `apps/web/src/lib/discogs/oauth.ts:84-130`):
- `storeTokens()` tries `admin.rpc("vault_create_secret", {secret, name: "discogs_token:<user_id>"})` first.
- If Vault fails, it falls back to upserting into `public.discogs_tokens` (plaintext `access_token`, `access_token_secret` columns).
- This is exactly Pitfall #11's risk: the fallback path writes plaintext.

**What Supabase Vault looks like on disk** (verified via Supabase Vault docs April 2026):
- Table: `vault.secrets` — stores `secret` column (encrypted bytes via pgsodium-derived key).
- View: `vault.decrypted_secrets` — decrypts on read via server-side key.
- Calling `vault_create_secret(secret, name)` inserts an encrypted row; the plaintext never touches disk.

**Exact commands** (run against the **dev** Supabase project — the one that already has Discogs OAuth users from development use):

```bash
# Option A — via Supabase CLI linked to DEV project (safe, read-only)
pnpm dlx supabase link --project-ref <dev-ref>  # link once
pnpm dlx supabase db dump --linked --data-only -s public | grep discogs_tokens

# Option B — via psql (if you have DATABASE_URL loaded for dev)
# 5.1 Count tokens stored via the FALLBACK path (plaintext)
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS plaintext_count FROM public.discogs_tokens;" 2>&1 | tee evidence/05a-plaintext-count.txt

# 5.2 Count tokens stored via Vault
psql "$DATABASE_URL" -c "SELECT COUNT(*) AS vault_count FROM vault.decrypted_secrets WHERE name LIKE 'discogs_token:%';" 2>&1 | tee evidence/05b-vault-count.txt

# 5.3 Sample a row from each (confirm shape, NOT the secret itself — redact before committing)
psql "$DATABASE_URL" -c "SELECT user_id, LEFT(access_token, 8) AS token_prefix, created_at FROM public.discogs_tokens LIMIT 3;" 2>&1 | tee evidence/05c-plaintext-sample.txt
psql "$DATABASE_URL" -c "SELECT name, created_at FROM vault.secrets WHERE name LIKE 'discogs_token:%' LIMIT 3;" 2>&1 | tee evidence/05d-vault-sample.txt
```

**Pass criterion (per D-14 / ROADMAP #5):**

| Observable | PASS |
|------------|------|
| `plaintext_count` (public.discogs_tokens) | 0 — no plaintext rows exist |
| `vault_count` (vault.decrypted_secrets LIKE 'discogs_token:%') | > 0 if any Discogs user exists; 0 is OK if no dev user has connected Discogs yet |
| Sample row inspection | plaintext table's `access_token` column is empty / absent (or the column itself has been dropped); Vault table has encrypted rows |

**If `plaintext_count > 0`:** that's Pitfall #11 confirmed live. Fix inline per D-10 before declaring Audit 5 green:
1. Confirm `supabase_vault` extension is enabled: `CREATE EXTENSION IF NOT EXISTS supabase_vault;` (no-op if already enabled).
2. Write a one-off migration that re-runs the Vault write path for each plaintext row, then `DELETE` the plaintext row.
3. Re-run the count checks.
Estimated fix time: 1-2h → **within D-16's 2h fail-inline budget**.

**Evidence shape:** `evidence/05a-*.txt` through `evidence/05d-*.txt`. AUDIT-REPORT.md §5 shows the two COUNTs and declares verdict.

**CRITICAL safety rule:** **Do NOT commit the sample outputs until redacted.** Even though `token_prefix` shows only 8 chars, and `vault.decrypted_secrets` needs admin auth to read, the pattern is still a security smell. AUDIT-REPORT.md should show counts only; the detail sample files should be gitignored (add `evidence/05c-*.txt`, `evidence/05d-*.txt` to a phase-scoped `.gitignore`).

**Gotchas:**

1. **`psql` may not be on PATH on Windows.** If not, either install Postgres client, or use Supabase dashboard SQL Editor: Project → SQL Editor → paste the 4 queries one at a time → screenshot the count results. Screenshots are valid evidence per D-11.
2. **Dev vs audit context:** per CONTEXT.md, Phase 33 avoids touching prod. The verification runs against the **dev** Supabase project — the only existing project with real Discogs token data. Vault behavior on prod is separately verified in Phase 34 (DEP-SB-06).
3. **`vault_create_secret` RPC is admin-only.** The audit queries read `vault.secrets` and `vault.decrypted_secrets` directly, which requires the service-role key via psql. Anon key will get permission-denied.
4. **Zero Discogs users is OK.** If `vault_count = 0` AND `plaintext_count = 0`, the storage path has never been exercised. That's not a failure — it's an empty set. Document explicitly: "No Discogs users in dev DB; cannot verify storage path via data inspection." In that case, recommend a second evidence source: a one-time integration test that calls `storeTokens()` against the local Supabase stack (from Audit 2a) and confirms the Vault path fires. Add 30 min if needed.

**Time budget:** 10-20 min for the queries if everything works; +1-2h if plaintext_count > 0 and the migration fix is needed.

---

## Audit 6 — DEP-AUD-06: CSP Confirmation (Re-Verify, Don't Re-Fix)

**Background:** Per user memory (`project_security_posture.md`, 2026-03-28 audit), the CSP unsafe-inline issue was resolved with nonce-based CSP. DEP-AUD-06 is a **re-confirmation** — prove the fix held, don't re-solve.

**Code path verified:**
- `apps/web/src/middleware.ts:10-24` generates per-request nonce + CSP header via `generateCspHeader(nonce, isDev)` from `apps/web/src/lib/security/csp.ts`
- Middleware sets both response header `Content-Security-Policy` and request header `x-nonce`
- Dev mode has relaxed CSP (`isDev=true`); prod mode is strict

**Exact commands:**

```bash
# With `pnpm start` running on :3000 from Audit 3
# 1. Confirm CSP header is present and nonce-based in prod build
curl -sI http://localhost:3000/ | grep -i "content-security-policy" | tee evidence/06a-csp-header.txt

# Expected: nonce-N2EzN... pattern appears; unsafe-inline should NOT appear (only for non-dev build)

# 2. Check key surfaces: /, /signin, /pricing, /feed (behind auth — use curl with cookie), /api/og/rarity/...
for path in / /signin /pricing; do
  echo "=== $path ==="
  curl -sI "http://localhost:3000${path}" | grep -i "content-security-policy"
done 2>&1 | tee evidence/06b-csp-all-routes.txt

# 3. Manual DevTools smoke — the canonical CSP check
# a. Open http://localhost:3000/ in a fresh Chrome profile
# b. DevTools → Console
# c. Navigate: / , /signin , /signup , /pricing , /feed (after signin)
# d. Expect ZERO entries matching "Refused to execute" / "Refused to load" / "violates the following Content Security Policy"
# e. Screenshot the empty Console for each route, save to evidence/06c-console-<route>.png
```

**Pass criterion:**
- CSP header present on every route (not an empty header)
- Header contains `nonce-<base64>` for script-src
- Header does NOT contain `unsafe-inline` for script-src in prod mode (dev mode has it; we're running prod-built)
- DevTools Console screenshots show zero CSP violations across the 5 key routes

**Evidence shape:** `evidence/06a-*.txt` (header), `evidence/06b-*.txt` (multi-route), `evidence/06c-*.png` (console screenshots — at least one per route). AUDIT-REPORT.md §6 pastes the header sample and confirms the memory note.

**If a CSP violation IS found:** per D-10, fix inline. Fix patterns:
- Missing `nonce` on a shadcn or third-party `<script>` tag: add `nonce={nonce}` prop, sourced from the `x-nonce` request header.
- New external origin not in allowlist: add to `apps/web/src/lib/security/csp.ts` allowlist array.

Estimated fix time: 15-45 min per violation. If >2 violations surface, consider escalating to decimal phase per D-16.

**Gotchas:**

1. **`pnpm dev` has relaxed CSP** — do NOT test DEP-AUD-06 against `pnpm dev`. MUST be `pnpm build && pnpm start` so the prod CSP kicks in.
2. **Stripe Checkout surface** — DEP-UAT-08 (Phase 38) covers Stripe in the real flow. Phase 33 CSP check is "no violations on the pre-checkout pages" only.
3. **`/api/og/*` is excluded from middleware** (confirmed in `middleware.ts:44`), so CSP headers are not set there — that's intentional, not a bug.

**Time budget:** 10-15 min.

---

## Audit 7 — DEP-AUD-07: Git History Secret Scan (gitleaks)

**Target secret names** (per ROADMAP criterion 6 + Pitfall #1/#2):
1. `SUPABASE_SERVICE_ROLE_KEY` (and any `service_role` literal)
2. `STRIPE_SECRET_KEY` (any `sk_live_*` or `sk_test_*` JWT-shaped token)
3. `STRIPE_WEBHOOK_SECRET` (any `whsec_*`)
4. `HANDOFF_HMAC_SECRET` (32+ hex chars with this env name)
5. `IMPORT_WORKER_SECRET` (32+ chars with this env name)
6. `DISCOGS_CONSUMER_SECRET` (and Discogs consumer key pattern)
7. `DATABASE_URL` (any `postgresql://...:<password>@...`)

### Config file (`.gitleaks.toml` at repo root)

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

### Exact scan command (Docker, no host install required)

```bash
# Ensure Docker Desktop is running (Windows host)
docker info 2>&1 | head -3

# Full-history scan with JSON report
docker run --rm -v "$(pwd):/repo" -w /repo ghcr.io/gitleaks/gitleaks:latest \
  git \
  --config /repo/.gitleaks.toml \
  --log-opts="--all --full-history" \
  --report-format json \
  --report-path /repo/evidence/07-gitleaks-report.json \
  --verbose \
  /repo 2>&1 | tee evidence/07-gitleaks-stdout.txt

# Count findings
jq 'length' evidence/07-gitleaks-report.json 2>&1 | tee evidence/07-gitleaks-count.txt
```

**Windows bash note:** `$(pwd)` in Git Bash returns MSYS-style `/c/Users/...`; Docker Desktop accepts this via its WSL2 integration. If Docker complains, substitute `$(pwd -W)` (Git Bash builtin that returns `C:/Users/...`).

**Pass criterion:**

| Observable | PASS |
|------------|------|
| gitleaks exit code | 0 (findings present) OR 1 (no findings detected — gitleaks returns 1 if clean AND `--exit-code` isn't customized; confirm with the JSON length) |
| `jq 'length' evidence/07-gitleaks-report.json` | `0` |
| stdout contains | `"level":"info","message":"no leaks found"` OR zero `[finding]` lines |

**Important gotcha:** gitleaks uses exit code **1** to signal "leaks found" (the opposite of most tools). The authoritative check is the length of the JSON report, NOT the exit code. Always read the JSON.

**Evidence shape:** `evidence/07-gitleaks-report.json` (full JSON) + `evidence/07-gitleaks-stdout.txt` (log) + `evidence/07-gitleaks-count.txt` (the count). AUDIT-REPORT.md §7 pastes the count line and declares verdict.

**If findings > 0** (per D-10 fail-inline):

For each finding, cross-reference: is it a **real** secret that was committed, or a placeholder that slipped past the allowlist?

- **Real secret:** treat as incident. Steps: (a) rotate the secret in its authoritative service, (b) update the rule/allowlist so the scan doesn't re-alert on the known-dead value, (c) decide whether to scrub git history (BFG Repo-Cleaner) or accept the leak as permanent and rotate. (c) is a judgment call: if the repo is public, scrubbing is cosmetic because leaks are already scraped — rotation is what matters.
- **False positive:** update `.gitleaks.toml` allowlist and re-run.

Estimated fix time per finding: 30 min – 2h (rotation takes longer). If >2 real findings, escalate to decimal phase (33.1) per D-16.

**Time budget:** 5-15 min for the scan itself on a repo this size. Worktree currently has 185 dirty entries per 2026-04-06 audit, so the scan has some work to do. Fail-inline: 30 min to 4h depending on findings.

---

## Audit 8 — DEP-AUD-08: Environment Variable Inventory

**Source of truth:** `apps/web/.env.local.example` — **21 variables** across 8 domains (inventoried 2026-04-21):

### Inventory table template for AUDIT-REPORT.md §8

```markdown
| # | Variable | Domain | Scope | Source of prod value | Secret? | Assigned (Y/N) |
|---|----------|--------|-------|----------------------|---------|----------------|
| 1 | NEXT_PUBLIC_SUPABASE_URL | Supabase | Public | Supabase Dashboard → prod project → Project Settings → API → URL | No | N |
| 2 | NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Supabase | Public | Supabase Dashboard → prod project → Project Settings → API → anon/publishable key | No | N |
| 3 | SUPABASE_SERVICE_ROLE_KEY | Supabase | Server | Supabase Dashboard → prod project → Project Settings → API → service_role key (mask!) | **YES** | N |
| 4 | DATABASE_URL | Supabase | Server | Supabase Dashboard → prod project → Database → Connection Pooling → Transaction (port 6543) → with password | **YES** | N |
| 5 | NEXT_PUBLIC_SITE_URL | App | Public | Deterministic: `https://<prod-domain>` (set after Phase 36 DNS cutover) | No | N |
| 6 | NEXT_PUBLIC_APP_URL | App | Public | Deterministic: same as SITE_URL for v1 | No | N |
| 7 | STRIPE_SECRET_KEY | Stripe | Server | Stripe Dashboard → Developers → API keys → Secret key (Live mode) — `sk_live_*` | **YES** | N |
| 8 | STRIPE_WEBHOOK_SECRET | Stripe | Server | Stripe Dashboard → Developers → Webhooks → `https://<domain>/api/stripe/webhook` endpoint → Signing secret (whsec_*) — Phase 37 registers | **YES** | N |
| 9 | NEXT_PUBLIC_STRIPE_PRICE_MONTHLY | Stripe | Public | Stripe Dashboard → Products → Monthly plan → Pricing → Live-mode Price ID (`price_*`) | No | N |
| 10 | NEXT_PUBLIC_STRIPE_PRICE_ANNUAL | Stripe | Public | Stripe Dashboard → Products → Annual plan → Live-mode Price ID | No | N |
| 11 | NEXT_PUBLIC_SENTRY_DSN | Sentry | Public | Sentry Dashboard → prod project → Settings → Client Keys (DSN) | No | N |
| 12 | SENTRY_ORG | Sentry | Server | Sentry Dashboard → org slug (URL) | No | N |
| 13 | SENTRY_PROJECT | Sentry | Server | Sentry Dashboard → prod project slug | No | N |
| 14 | SENTRY_AUTH_TOKEN | Sentry | Server | Sentry Dashboard → Settings → Auth Tokens → create with `project:releases` scope | **YES** | N |
| 15 | UPSTASH_REDIS_REST_URL | Upstash | Server | Upstash Console → prod Redis database → REST API → URL | No | N |
| 16 | UPSTASH_REDIS_REST_TOKEN | Upstash | Server | Upstash Console → prod Redis database → REST API → Read-write token | **YES** | N |
| 17 | DISCOGS_CONSUMER_KEY | Discogs | Server | Discogs Developer Settings → prod app → Consumer Key | No | N |
| 18 | DISCOGS_CONSUMER_SECRET | Discogs | Server | Discogs Developer Settings → prod app → Consumer Secret | **YES** | N |
| 19 | IMPORT_WORKER_SECRET | App | Server | Local generation: `openssl rand -hex 32` (NEVER reuse dev value) | **YES** | N |
| 20 | HANDOFF_HMAC_SECRET | App | Server | Local generation: `openssl rand -hex 32` (NEVER reuse dev value) | **YES** | N |
| 21 | RESEND_API_KEY | Resend | Server | Resend Dashboard → API Keys → create "DigSwap prod" with `sending` scope | **YES** | N |
| — | RESEND_FROM_EMAIL | Resend | Server | Deterministic: `noreply@<prod-domain>` | No | N |
| — | YOUTUBE_API_KEY | Optional | Server | (optional — skip if not using YouTube preview feature) | No | N |
| — | SYSTEM_USER_ID | Optional | Server | (optional — generated at first run) | No | N |
| — | NEXT_PUBLIC_MIN_DESKTOP_VERSION | App | Public | Static constant; set to `1` for v1.4 | No | N |
```

**Count discrepancy note:** CONTEXT.md says "21 vars", RESEARCH.md Audit 8 table shows 21 primary + 4 optional. The 21 number matches the **non-optional** vars that MUST have a prod value. Optional vars appear in the table marked as "optional" and are allowed a blank "Source" column with the justification "N/A — optional".

### Exact verification script

```bash
# 1. Generate the inventory table automatically from .env.local.example
awk -F= '
  /^#/ { domain=$0; next }
  /^[A-Z_]+=/ { gsub(/^\s+|\s+$/, "", $1); print "| " $1 " | " domain " |" }
' apps/web/.env.local.example 2>&1 | tee evidence/08a-vars-found.txt

# 2. Sanity check: count variables
grep -c '^[A-Z_][A-Z_0-9]*=' apps/web/.env.local.example 2>&1 | tee evidence/08b-var-count.txt
# Expect: 21 (or the currently committed count — verify it matches the table)

# 3. Validate zero "TBD" rows in AUDIT-REPORT.md §8 once human completes it
grep -c '| TBD |' AUDIT-REPORT.md 2>&1 | tee evidence/08c-tbd-count.txt
# PASS criterion: 0
```

**Pass criterion (per D-15):**

| Observable | PASS |
|------------|------|
| Every var in `.env.local.example` appears as a row in AUDIT-REPORT.md §8 | 100% |
| Every non-optional row has a "Source of prod value" that is actionable (not `TBD`) | 100% |
| `grep -c '| TBD |' AUDIT-REPORT.md` | `0` |

**Evidence shape:** `evidence/08a-*.txt` (var list), `evidence/08b-*.txt` (count), `evidence/08c-*.txt` (TBD count). AUDIT-REPORT.md §8 embeds the full inventory table.

**Note on "Assigned (Y/N)" column:** this stays "N" during Phase 33. Phases 34–37 flip rows to "Y" as the actual Vercel env var values are populated. Phase 33's scope is only: "is there a known, actionable source for each value?" — not "is the value in Vercel yet?"

**Time budget:** 45-90 min to complete the table accurately on first pass; most of that is looking up where each value lives in each dashboard. Subsequent milestones can copy this table as the authoritative inventory.

---

## Runtime State Inventory

*This is a verification phase with no data rename/migration; Steps 2.5's full 5-category inventory doesn't apply. Captured minimal state below for planner awareness.*

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `discogs_tokens` table (fallback path) in dev Supabase — verified via code path in `apps/web/src/lib/discogs/oauth.ts:115-123` | Read-only audit queries only (Audit 5); no migration. If `plaintext_count > 0`, fail-inline migration scoped per D-10. |
| Live service config | None — Phase 33 touches no external service. Throwaway Supabase project created (Audit 2b) is lifecycle-managed within the phase. | Ensure teardown step runs (delete throwaway project). |
| OS-registered state | Docker Desktop must be running for Audit 2a (local Supabase) and Audit 7 (gitleaks container). Not persisted between runs. | Document in runbook: "Docker Desktop required; start it before Wave 1 and Wave 3." |
| Secrets/env vars | `DRIZZLE_PROD_REFS` env var introduced by SYSTEMIC #0 fix (Wave 0 T-0.2). Set on dev machine once Phase 34 reveals the prod ref. | Document in CONTRIBUTING.md (part of ADR-003 commit). Not needed during Phase 33 itself (no prod ref exists yet). |
| Build artifacts | `.next/` folder created by Audit 3's `pnpm build`. Can be deleted between runs. | None — ignored by git. |

**Nothing found in category:** The verify-only nature of the phase means runtime state mostly doesn't apply. Explicit note here prevents the planner from thinking this step was skipped.

---

## Common Pitfalls

### Pitfall A: `supabase db reset --linked` against dev by accident

**What goes wrong:** Operator types the wrong ref during `supabase link`, or forgets a prior `link` command. `supabase db reset --linked` drops every user-created entity in the linked project. If that link is the dev project (`digswap-dev`), all dev data is gone — months of test users, Discogs imports, test trades.

**Why it happens:** `supabase link` is sticky across terminal sessions. The `●` indicator in `supabase projects list` is easy to miss.

**How to avoid:** Before any `db reset --linked`, run `supabase projects list` and CONFIRM the `●` marker is on the throwaway project name (e.g., `digswap-audit-20260421-1400`), not `digswap-dev`. Bake this check into the plan as a gate step.

**Warning signs:** If you can't remember creating a throwaway project in the last hour, you haven't. Stop and re-create.

### Pitfall B: Running Audit 5 plaintext-count on the WRONG project

**What goes wrong:** If Audit 5 queries the throwaway Supabase project created in Audit 2 (which just had a fresh reset), it will return `plaintext_count = 0` trivially — proving nothing about the dev data posture.

**Why it happens:** `DATABASE_URL` in the shell may still point at the throwaway from Audit 2.

**How to avoid:** Audit 5 explicitly uses the **dev** Supabase URL. Before running the count queries, `echo $DATABASE_URL | grep pooler | head -1` and confirm the host contains the dev project ref, NOT the throwaway ref. Pass `DATABASE_URL=<dev-url>` inline to each psql invocation to be safe.

### Pitfall C: `pnpm audit` noise from dev-dependencies

**What goes wrong:** Running `pnpm audit` without `--prod` surfaces advisories for Playwright browsers, esbuild, Vite, etc. — noise that can bury a real prod vulnerability.

**How to avoid:** Always `--prod --audit-level high`. Document the flag combo in the commit that adds the audit step.

### Pitfall D: gitleaks config syntax errors

**What goes wrong:** The `.gitleaks.toml` TOML syntax is strict. A missing bracket on `[[rules]]` silently excludes the rule. The scan runs "clean" because the custom rule never loads.

**How to avoid:** After writing `.gitleaks.toml`, run:
```bash
docker run --rm -v "$(pwd):/repo" -w /repo ghcr.io/gitleaks/gitleaks:latest \
  git --config /repo/.gitleaks.toml --no-banner --verbose 2>&1 | head -30
```
Look for `INF loaded config with N rules` in the first 10 lines — N must equal `default_rules_count + 7` (the 7 custom rules above). If N is less, a rule didn't parse.

### Pitfall E: Windows line-ending corruption in evidence files

**What goes wrong:** `tee` on Git Bash writes LF; PowerShell's `Out-File` writes CRLF. Mixing produces evidence files that confuse grep and diff when reviewed later.

**How to avoid:** Run the entire audit in one shell flavor (recommended: Git Bash). Add `.gitattributes` rule for `evidence/*.txt` → `text eol=lf` if needed.

### Pitfall F: Audit 3 false-positive success because server never actually cold-started

**What goes wrong:** `pnpm start` keeps the Node process warm the entire time. The 15-min sleep simulates passage of time, not a true fresh-process cold start. If Pitfall #8 is still present but only fires on module-first-load, the local audit misses it.

**How to avoid:** D-08 accepts this limitation explicitly. For additional confidence, ALSO run `pnpm build && time node .next/standalone/server.js` (if standalone output is enabled) and curl `/` on first request — the first-request time_total captures module-load latency. This is a "nice to have"; the ROADMAP success criterion is satisfied by the simpler flow.

---

## Code Examples

### ADR-003 Template (for Wave 0 T-0.3)

```markdown
---
id: ADR-003
title: Drizzle Kit is Dev-Only — Production Migrations via Supabase CLI
date: 2026-04-21
status: accepted
deciders: [user, Claude]
supersedes: []
---

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

### Prod-Guard Script (for Wave 0 T-0.2)

See §Architecture Patterns above for the full `scripts/drizzle-prod-guard.mjs` content and `package.json` wiring.

### Session Revocation E2E Skeleton (for DEP-AUD-04)

See §Audit 4 above.

### gitleaks TOML Config (for DEP-AUD-07)

See §Audit 7 above.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Running `drizzle-kit push` against any environment including prod | ADR-003: Drizzle dev-only; `supabase db push` for prod | 2026-04-21 (this phase) | No accidental trail divergence; explicit SQL authorship for RLS/cron |
| pgsodium direct encryption | Supabase Vault (wraps pgsodium, exposes stable SDK) | Supabase announced pgsodium deprecation cycle ~2026 | Discogs tokens should use `vault_create_secret` RPC; fallback table is a known gap |
| `supabase db reset` on linked remote requires `Y` confirmation, often as default | As of supabase/cli issue #1875, the default was changed to **not** `Y` | ~2024 | Reduces accidental reset risk, but operator must still confirm |

**Deprecated/outdated:**
- **`@supabase/auth-helpers-nextjs`** — already replaced by `@supabase/ssr` in this repo. No action needed.
- **Legacy Drizzle Kit `<0.30` migration format** — not in use. Current `drizzle-kit@^0.31.10` aligned with `drizzle-orm@^0.45.1`.

---

## Open Questions

1. **Does `/api/user/me` or equivalent protected route exist for Audit 4 replay?**
   - What we know: middleware bypasses `/api/stripe/`, `/api/og/`, `/api/discogs/import`, `/api/desktop/`. So any other `/api/*` route is protected.
   - What's unclear: the specific canonical protected endpoint.
   - Recommendation: the planner's first task for DEP-AUD-04 is `grep -r "export async function GET\|export async function POST" apps/web/src/app/api/ --include="route.ts" | head -20` to enumerate candidates, then pick one that both (a) is in the protected set and (b) queries the authenticated user (so 401 is the actual response, not 200 with empty data).

2. **Are there any Discogs OAuth users in the dev Supabase DB?**
   - What we know: the code path exists; the `discogs_tokens` table exists.
   - What's unclear: whether any row has been written during development.
   - Recommendation: if `plaintext_count = 0 AND vault_count = 0`, the planner should add a sub-task "exercise `storeTokens()` once against local Supabase to prove the Vault path fires" — per §Audit 5 gotcha #4.

3. **Does the 2026-03-28 CSP fix hold under the current build?**
   - What we know: user memory says yes.
   - What's unclear: any regression between 2026-03-28 and main@HEAD.
   - Recommendation: DEP-AUD-06 re-confirms via DevTools; if ANY violation surfaces, fix inline per D-10.

4. **Should the throwaway Supabase project teardown be automatic or manual?**
   - What we know: `supabase projects delete <ref>` works.
   - What's unclear: whether the plan should include an automatic teardown hook or a checkbox.
   - Recommendation: manual teardown as a named task in the plan. Automatic teardown hides the cost; a named task reminds the operator. Zero extra wall-clock.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| pnpm | All audits (script runners) | ✓ | 10.30.3 | — |
| Node.js | All audits | ✓ (implied — pnpm requires it) | ≥20 (per CI) | — |
| Supabase CLI | Audit 2 (both local + cloud), Audit 5 (link to dev) | ✓ via `pnpm dlx supabase` | 2.93.0 | — |
| Docker Desktop | Audit 2a (local Supabase), Audit 7 (gitleaks image) | ⚠ NOT verified on PATH | — | **Required** — no CLI fallback for Audit 2a; Audit 7 could fall back to a native gitleaks binary install on Windows, but Docker is simpler |
| gitleaks | Audit 7 | ✗ (use Docker image) | — | Docker image `ghcr.io/gitleaks/gitleaks:latest` is the primary path; OK |
| psql / Postgres client | Audit 5 queries | ⚠ Likely NOT on PATH on Windows | — | Supabase Dashboard SQL Editor (screenshots as evidence) |
| `jq` | Audit 7 result count | ⚠ Git Bash on Windows doesn't ship jq by default | — | `python -c "import json; print(len(json.load(open('evidence/07-gitleaks-report.json'))))"` |
| `openssl` | Audit 2b (password generation) | ✓ (ships with Git for Windows) | — | `node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"` |
| `curl` | Audit 3 (cold-start), Audit 6 (CSP header) | ✓ (ships with Git for Windows and Windows 10+ natively) | — | PowerShell `Invoke-WebRequest` |
| `tee`, `grep`, `head`, `awk` | Evidence capture across all audits | ✓ (Git Bash) | — | PowerShell has equivalents but with different syntax |
| Browser (Chrome) | Audit 6 (DevTools CSP screenshots) | ✓ (user environment) | — | Edge DevTools (same engine) |

**Missing dependencies with no fallback:**
- **Docker Desktop running:** blocking for Audit 2a and Audit 7. Confirm with `docker info` BEFORE Wave 1 / Wave 3 execution.

**Missing dependencies with fallback:**
- **psql:** Supabase SQL Editor (screenshot-based evidence)
- **jq:** Python or Node one-liner
- **Gitleaks binary:** Docker image (primary path — no binary install needed)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 (unit/integration) + Playwright 1.58.2 (E2E) + Biome 2.4.8 (lint) + tsc 5.x (typecheck) |
| Config file | `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts`, `biome.json` at repo root |
| Quick run command | `pnpm --filter @digswap/web test` (runs Vitest once) |
| Full suite command | `pnpm --filter @digswap/web typecheck && pnpm --filter @digswap/web lint && pnpm --filter @digswap/web test && pnpm --filter @digswap/web build && pnpm audit --prod --audit-level high` |

### Phase Requirements → Observable → Evidence Map

Phase 33 is unusual: **the validation architecture IS the phase's deliverable.** Each DEP-AUD-* is itself a validation step, so the "what proves it?" question is answered by each audit's command + evidence pair.

| Req ID | Behavior | Test Type | Automated Command | Evidence File | File Exists? |
|--------|----------|-----------|-------------------|---------------|--------------|
| DEP-AUD-01 | 4 CI gates + prod audit pass against main | unit/integration (existing Vitest + Biome + tsc + next build) + shell | `pnpm --filter @digswap/web typecheck && lint && test && build && pnpm audit --prod --audit-level high` | `evidence/01*-*.txt` | ✅ (CI already runs these) |
| DEP-AUD-02 | `supabase db reset` applies all migrations | integration (shell + Supabase CLI) | `pnpm dlx supabase db reset` (local) + `pnpm dlx supabase db reset --linked` (throwaway) | `evidence/02a-*.txt`, `evidence/02b-*.txt` | ❌ Wave 0+1 produce |
| DEP-AUD-03 | Public routes return 200 in <3s | smoke (shell + curl) | Multi-route curl loop in §Audit 3 | `evidence/03-*.txt` | ❌ Wave 2 produces |
| DEP-AUD-04 | Logged-out JWT → 401 within 60s | E2E (Playwright) | `pnpm --filter @digswap/web exec playwright test audit/session-revocation.audit.spec.ts` | `evidence/04-*.txt` + test file | ❌ Wave 2 produces (test file is new) |
| DEP-AUD-05 | Discogs tokens NOT in plaintext | SQL probe | psql queries against `public.discogs_tokens` + `vault.decrypted_secrets` | `evidence/05*-*.txt` | ❌ Wave 3 produces |
| DEP-AUD-06 | CSP header + zero violations on 5 routes | smoke (shell + manual DevTools) | curl for header + manual browser walk | `evidence/06*-*` | ❌ Wave 3 produces |
| DEP-AUD-07 | Zero secrets in git history | git scan | `docker run ... gitleaks git --config .gitleaks.toml --log-opts="--all --full-history" --report-format json --report-path ...` | `evidence/07-*.json` + `.gitleaks.toml` | ❌ Wave 0 adds config; Wave 3 scans |
| DEP-AUD-08 | Env inventory has zero TBD rows | doc review | `grep -c '| TBD |' AUDIT-REPORT.md` | `evidence/08*-*.txt` + §8 table in AUDIT-REPORT.md | ❌ Wave 4 produces |

### Sampling Rate
- **Per task commit (fine granularity per `.planning/config.json`):** Whatever single command that task runs — e.g., the Wave 0 T-0.1 orphan deletion commits via `git rm` and needs no separate validation (CI catches any downstream break).
- **Per wave merge:** Re-run `pnpm --filter @digswap/web typecheck && lint && test && build` to confirm no regression (takes ~3 min). For fine granularity, this is the Nyquist check.
- **Phase gate (exit criterion):** `AUDIT-REPORT.md` shows 8 checked boxes AND `grep -c '| TBD |' AUDIT-REPORT.md` returns 0.

### Wave 0 Gaps (need Wave 0 creation before execution proceeds)
- [ ] `.gitleaks.toml` — custom rules + allowlist for Audit 7
- [ ] `scripts/drizzle-prod-guard.mjs` — DATABASE_URL prod detection + abort
- [ ] `.planning/ADR-003-drizzle-dev-only.md` — locked decision record
- [ ] `apps/web/tests/e2e/audit/session-revocation.audit.spec.ts` — new E2E test file (produced in Wave 2)
- [ ] `.planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md` — skeleton scaffolded Wave 0, populated Waves 1–4
- [ ] `.planning/phases/033-pre-deploy-audit-gate/evidence/.gitignore` — excludes sample data files that may contain tokens (05c, 05d)

*(Framework install step: none — all tooling already in `apps/web/devDependencies` or via `pnpm dlx` / `docker run`.)*

---

## Project Constraints (from CLAUDE.md)

Directives extracted from `CLAUDE.md` and skill SKILL.md files that Phase 33 MUST honor:

- **Solo developer optimization:** every tool decision should favor simplicity and solo maintainability (Core Rules §6 digswap-appsec, CLAUDE.md Constraints)
- **OWASP Top 10 mandatory:** Phase 33's secret scan (DEP-AUD-07) and session revocation test (DEP-AUD-04) are direct OWASP #1 (Broken Access Control) / #8 (Software & Data Integrity) coverage
- **Portuguese-first user communication:** user memory says "Sempre responder em português brasileiro." Applies to chat responses; RESEARCH.md/AUDIT-REPORT.md/ADR-003 remain in English (code/docs convention)
- **GSD workflow enforcement:** all file edits flow through `/gsd:execute-phase 33`; the plan must produce executable task structure
- **`supabase/migrations/` is the authoritative trail** (digswap-dba Core Rules §5): Phase 33 ADR-003 formalizes this rule; D-01 locks it
- **Never apply migration to prod without tested rollback path** (digswap-dba Core Rules §1): not triggered in Phase 33 (verification only); relevant for Phase 34
- **`prepare: false` in Drizzle connection config** (digswap-dba Core Rules §6): already honored in `apps/web/src/lib/db/index.ts`; Phase 33 does not touch this
- **`NEXT_PUBLIC_` prefix hygiene:** only 7 specific vars may carry it (Pitfall #1). Phase 33's Audit 8 table makes this explicit via the "Scope" column

---

## Sources

### Primary (HIGH confidence)
- `.planning/phases/033-pre-deploy-audit-gate/033-CONTEXT.md` — locked user decisions D-01..D-17 (internal, authoritative)
- `.planning/REQUIREMENTS.md` — DEP-AUD-01 through DEP-AUD-08 definitions (internal, authoritative)
- `.planning/ROADMAP.md` §Phase 33 — goal, 8 success criteria, P0 pitfalls mapping (internal, authoritative)
- `.planning/research/PITFALLS.md` — Pitfalls #1, #2, #3, #8, #10, #11 (direct codebase inspection; HIGH)
- `.planning/research/STACK.md` — 13-item REQUIRED checklist (direct codebase inspection; HIGH)
- `.planning/research/ARCHITECTURE.md` — migration pipeline decision (`supabase/migrations/` authoritative)
- `.planning/ADR-002-desktop-trade-runtime.md` — ADR format precedent (used to derive ADR-003 template)
- `apps/web/package.json` — exact script names: `typecheck`, `lint`, `test`, `build` (confirmed 2026-04-21)
- `apps/web/.env.local.example` — 21-var inventory (inventoried 2026-04-21)
- `apps/web/src/middleware.ts` — CSP nonce generation path (read 2026-04-21)
- `apps/web/src/lib/supabase/middleware.ts` — `getUser()` + session allowlist code path (read 2026-04-21, lines 45-123)
- `apps/web/src/lib/discogs/oauth.ts` — Vault + fallback token storage logic (read 2026-04-21, lines 84-155)
- `apps/web/src/lib/env.ts` — Zod env schema, HANDOFF_HMAC/STRIPE production-required assertions (read 2026-04-21)
- `drizzle/meta/_journal.json` + `drizzle/` listing — orphan `0002_showcase_cards.sql` confirmed (listed 2026-04-21)
- `supabase/migrations/` — 28-file trail confirmed (listed 2026-04-21)
- `.github/workflows/ci.yml` — CI env-var prelude + job structure (read 2026-04-21)
- `.planning/quick/260406-aud-deploy-readiness-audit/260406-aud-SUMMARY.md` — original blocker list + 35ed595 fix claims (read 2026-04-21)
- Supabase Vault docs — https://supabase.com/docs/guides/database/vault (HIGH, official, verified 2026-04-21)
- Supabase CLI `db reset` — https://supabase.com/docs/reference/cli/supabase-db-reset (HIGH, official)
- Supabase CLI `projects create` — https://supabase.com/docs/reference/cli/supabase-projects-create (HIGH, official, verified 2026-04-21 via WebFetch)
- gitleaks GitHub — https://github.com/gitleaks/gitleaks (HIGH, official, verified 2026-04-21 via WebFetch for v8 flags and Docker image path)

### Secondary (MEDIUM confidence)
- Descope blog: Next.js 15 vs 16 comparison — https://www.descope.com/blog/post/nextjs15-vs-nextjs16 (cross-referenced with Next.js upgrade guide)
- Makerkit Supabase Vault tutorial — https://makerkit.dev/blog/tutorials/supabase-vault (cross-referenced with official docs)
- gitleaks JSON report behavior — pkg.go.dev/github.com/zricethezav/gitleaks/v8 (community-verified; gitleaks-official wrapper)

### Tertiary (LOW confidence — not relied on for authoritative claims)
- Miscellaneous blog posts on Supabase CLI usage — only used to sanity-check flag signatures; primary sources are the official CLI reference

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against the repo and npm registry as of 2026-04-21
- Audit commands: HIGH — each reviewed against official docs (Supabase CLI, gitleaks, pnpm)
- Evidence shapes: HIGH — file structure mirrors the solo-dev evidence pattern already used in `.planning/quick/`
- Windows gotchas: MEDIUM — verified via local env probe, but any WSL/Windows version quirk could surface; guidance is tested on Git Bash for Windows
- Time budgets: MEDIUM — estimates based on typical command duration; highly dependent on Docker Desktop warm state
- CSP re-confirmation guidance: MEDIUM — depends on user memory accuracy about the 2026-03-28 fix; Audit 6 is a re-check by design

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30 days — stack is stable; revalidate if Supabase CLI has a major version bump, Next.js 16 becomes the recommended default, or gitleaks config format changes)

---

## RESEARCH COMPLETE

**Phase:** 33 — Pre-Deploy Audit Gate
**Confidence:** HIGH

### Key Findings
- Every DEP-AUD-* check resolves to a single copy-pasteable command with a clear pass/fail threshold and a named evidence file — no strategy ambiguity for the planner to resolve.
- **Wave 0 (SYSTEMIC #0 fix) must precede Wave 1b (DEP-AUD-02 reset tests)** — deleting the orphan, wiring the guard script, and landing ADR-003 puts the repo in the clean state that the reset test then proves.
- **Docker Desktop is the critical host-environment prerequisite** for Audits 2a and 7. All other tooling runs via `pnpm dlx` or native Git Bash — no global installs required.
- **Supabase CLI v2.93.0 verified available via `pnpm dlx supabase`** on the current Windows host; `supabase projects create` + `supabase projects delete` are the exact commands for the throwaway cloud project lifecycle (D-06).
- **gitleaks via Docker image `ghcr.io/gitleaks/gitleaks:latest`** with a custom `.gitleaks.toml` (7 scoped rules + project-aware allowlist) is the exact DEP-AUD-07 implementation; exit code is deliberately NOT the authoritative signal (always check JSON length).
- **Audit 5 (Vault/Discogs) needs two COUNT queries and may need a one-off write-path test** if both counts are zero — the planner should include a conditional task for that case.
- **Audit 6 (CSP) is primarily a re-confirmation, not a fix** — matches user memory; a real fix is only triggered by a fail-inline finding per D-10.
- **Total time budget: 6–9h** of focused work for a green path; per-audit fail-inline budgets total up to ~6 additional hours worst-case, all within D-16's 2h-per-issue ceiling.

### File Created
`.planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All tools verified against repo + live npm/Docker registries |
| Audit commands | HIGH | Each command cross-referenced with official Supabase / gitleaks / pnpm docs |
| Architecture (wave graph) | HIGH | Follows deterministic dependencies; no assumptions |
| Pitfalls | HIGH | All 7 Pitfalls mapped direct from PITFALLS.md file citations |
| Time budgets | MEDIUM | Depends on Docker warm-state + solo-dev execution cadence |

### Open Questions
1. Which specific protected `/api/*` endpoint should Audit 4's replay target? — planner's first task enumerates, selects one.
2. Are there Discogs-connected users in the dev Supabase DB? — if `plaintext + vault = 0`, planner adds a write-path exercise sub-task.
3. Is the 2026-03-28 CSP fix unchanged? — Audit 6 re-confirms; fail-inline fix scoped if regression found.

### Ready for Planning
Research complete. Planner can now decompose the 8 audits + 1 drift-fix into 9 coarse-grained plans across 5 waves (Wave 0 blocks, Waves 1/2/3 contain parallel lanes, Wave 4 synthesizes). Every evidence shape, pass/fail threshold, and fallback path is concrete.
