---
phase: 035-vercel-environment-wiring
plan: 02
type: execute
wave: 2
depends_on:
  - 035-01-wave-0-scaffolding-and-config-edits-PLAN
files_modified:
  - .vercel/repo.json
  - .planning/phases/035-vercel-environment-wiring/evidence/01-link-confirm.txt
  - .planning/phases/035-vercel-environment-wiring/evidence/06a-project-settings.txt
autonomous: false
requirements:
  - DEP-VCL-01
  - DEP-VCL-08
gap_closure: false

must_haves:
  truths:
    - "Vercel project `digswap-web` exists in team `team_WuQK7GkPndJ2xH9YKvZTMtB3` (D-01/D-02)"
    - "GitHub repo `cbraidatto/digswap` is connected to the Vercel project (production branch = main)"
    - "Root Directory = `apps/web` (the only app shipped to Vercel; apps/desktop is NOT)"
    - "Plan = Hobby (D-03 — free-tier launch carry-forward from Phase 34)"
    - "Node.js Version = 20.x in Project Settings (D-04, DEP-VCL-08)"
    - "Build command = `pnpm --filter @digswap/web build`; Install = `pnpm install --frozen-lockfile`"
    - "Local repo has `.vercel/repo.json` linking apps/web → digswap-web (gitignored)"
  artifacts:
    - path: ".vercel/repo.json"
      provides: "Local CLI link from monorepo root to digswap-web project (gitignored, written by `vercel link --repo`)"
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/01-link-confirm.txt"
      provides: "vercel whoami + vercel project ls + repo.json content (sanitized)"
      min_lines: 10
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/06a-project-settings.txt"
      provides: "Snapshot of Project Settings: Node version, build/install commands, Root Directory, production branch, plan"
      min_lines: 8
  key_links:
    - from: "Vercel project digswap-web"
      to: "GitHub cbraidatto/digswap"
      via: "Vercel Git integration (Dashboard → Settings → Git)"
      pattern: "github.com/cbraidatto/digswap"
    - from: ".vercel/repo.json"
      to: "apps/web subdirectory"
      via: "vercel link --repo"
      pattern: "digswap-web"
---

<objective>
Wave 1: provision the Vercel project + link the monorepo + lock down Project Settings (Root Directory, branch, Node version, build/install commands, plan tier).

This is the prerequisite for any env-var population (Plan 03/04) and any deploy (Plan 05). No env vars are touched in this plan — the project must exist with correct settings BEFORE secrets are added so we never have orphaned secrets sitting in a half-configured project.

Halt-on-fail blast radius: LOW. If linkage corrupts mid-execution, drop+recreate the project from Dashboard (no env vars are at risk yet). If `vercel link` fails at the END of this plan, halt the whole phase per RESEARCH §11 (it's the foundational write).

Purpose: DEP-VCL-01 (project linked, Root Directory = apps/web) + DEP-VCL-08 (Node 20 pinned).

Output:
- Vercel project `digswap-web` exists in `team_WuQK7GkPndJ2xH9YKvZTMtB3`, Hobby plan, connected to `cbraidatto/digswap` (main branch)
- Project Settings: Root Directory = `apps/web`, Build Command = `pnpm --filter @digswap/web build`, Install Command = `pnpm install --frozen-lockfile`, Node.js Version = 20.x
- `.vercel/repo.json` at repo root (gitignored — confirmed by `.gitignore` line 38: `.vercel`)
- evidence/01-link-confirm.txt + evidence/06a-project-settings.txt capture the state for audit
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/035-vercel-environment-wiring/035-CONTEXT.md
@.planning/phases/035-vercel-environment-wiring/035-RESEARCH.md
@.planning/phases/035-vercel-environment-wiring/evidence/00-path-deviation.md
@pnpm-workspace.yaml
@apps/web/package.json
@package.json

<interfaces>
<!-- Inputs ready for this plan -->

Locked decisions from CONTEXT.md (NON-NEGOTIABLE):
- D-01: Project name = `digswap-web`. GitHub repo: `cbraidatto/digswap`. Production branch = `main`. Root Directory = `apps/web`.
- D-02: Team scope = `team_WuQK7GkPndJ2xH9YKvZTMtB3` (= `thiagobraidatto-3732's projects`). Recon (2026-04-26) confirmed 0 existing projects.
- D-03: Plan = Vercel Hobby. NO Pro upgrade in Phase 35.
- D-04: Node.js Version = 20 in Project Settings.

Auth precondition (from Plan 01 Task 4 checkpoint):
- Strategy 1: `$HOME/.vercel-token` exists, mode 600, contains 30-day team-scoped token
- Strategy 2: graceful degradation — accept device-code prompts; batch CLI commands in heredocs

Monorepo facts (verified from current files):
- Root `package.json`: `packageManager: "pnpm@10.30.3"` — Vercel auto-detects this version
- `pnpm-workspace.yaml`: `apps/*` + `packages/*`; only `@digswap/web` ships to Vercel
- `apps/web/package.json`: build script = `next build`; the `--filter @digswap/web` happens at the workspace root layer
- `apps/desktop` exists but is NOT a Vercel target (out of scope this milestone)

CLI commands (RESEARCH §2.1 + §6):
- `vercel project add digswap-web --scope team_WuQK7GkPndJ2xH9YKvZTMtB3` (non-interactive create)
- `vercel link --repo --yes --scope team_WuQK7GkPndJ2xH9YKvZTMtB3 --project digswap-web` (creates `.vercel/repo.json`)
- Vercel Git connection (no CLI command; Dashboard step OR REST API via `vercel api PATCH /v9/projects/digswap-web ...`)
- Project Settings (Root Directory, Node version, build/install commands) — Dashboard recommended (RESEARCH §6 — `vercel.json` NOT recommended for Phase 35)
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1 (CHECKPOINT): User creates Vercel project via Dashboard "New Project" wizard</name>
  <files>(no repo files; user-driven Dashboard action)</files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §2.1 lines 132-150 (CLI sequence + Dashboard wizard recommendation)
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md "Manual-Only Verifications" table line 78 (rationale for Dashboard wizard for first creation)
    - .planning/phases/035-vercel-environment-wiring/035-VALIDATION.md "Manual-Only Verifications" table
    - .planning/phases/035-vercel-environment-wiring/035-CONTEXT.md D-01/D-02/D-03/D-04 lines 19-23
  </read_first>
  <what-built>
    The Vercel CLI does NOT have a single command that combines "create project + connect GitHub + set Root Directory" in one step. The Dashboard "New Project → Import from GitHub" wizard auto-detects Next.js + pnpm workspace + offers a Root Directory picker — three things that the CLI either cannot do at all (`vercel git connect` does not exist) or makes error-prone if done piecemeal.

    First-time project creation is a one-shot Dashboard click-through; afterwards the CLI takes over for everything else (env vars, deploy, inspect).

    Once the user completes this step, `mcp__vercel__list_projects` will return `digswap-web` and `vercel link --repo` (Task 2) will succeed.
  </what-built>
  <how-to-verify>
    User actions (Dashboard wizard, ~3 minutes):

    1. Open https://vercel.com/new
    2. Under "Import Git Repository", search for `cbraidatto/digswap` (you must already have GitHub connected to your Vercel account; if not, click "Continue with GitHub" first)
    3. Click **Import** next to `cbraidatto/digswap`
    4. **Configure Project** step:
       - **Project Name:** `digswap-web` (NOT the default `digswap` — D-01 requires `-web` suffix to leave room for `digswap-desktop` in v1.5)
       - **Framework Preset:** Next.js (auto-detected — confirm)
       - **Root Directory:** click **Edit** → select `apps/web/` → click **Continue** (D-01)
       - **Build and Output Settings** (expand):
         - Build Command: **Override** → `pnpm --filter @digswap/web build`
         - Output Directory: leave default (`.next`)
         - Install Command: **Override** → `pnpm install --frozen-lockfile`
       - **Environment Variables:** **leave EMPTY** — Plans 03/04 populate via CLI (D-05/D-06). Skipping here is intentional.
    5. **Team selection (top of page):** confirm `thiagobraidatto-3732's projects` is selected (D-02). NOT "Personal Account" if a separate one exists.
    6. **Plan tier:** Hobby (default for free Vercel accounts; D-03 — do NOT upgrade to Pro).
    7. Click **Deploy**.
    8. Vercel will START the first build attempt. **It will FAIL** because no env vars are populated yet — this is EXPECTED and OK. The project will be created regardless. Wait for the failure (~2 minutes) then proceed.

    **Verification before clicking "approved":**

    ```bash
    # MCP read — confirms project exists, no auth prompt
    # In the agent: invoke mcp__vercel__list_projects with team_WuQK7GkPndJ2xH9YKvZTMtB3
    # Expected: response contains a project named "digswap-web" with framework "nextjs"
    ```

    Or via CLI:
    ```bash
    export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"
    vercel projects ls --scope team_WuQK7GkPndJ2xH9YKvZTMtB3 | grep digswap-web
    # Expected: a row showing digswap-web, framework=nextjs, last updated just now
    ```

    Type "approved" when:
    - Vercel Dashboard shows project `digswap-web` in `thiagobraidatto-3732's projects` team
    - Project Overview page shows "Connected to GitHub: cbraidatto/digswap"
    - Project Settings → General shows Root Directory = `apps/web`
    - Project Settings → General shows Framework Preset = Next.js
    - First build attempt failed with env-var error (this is expected — Plan 03 fixes it)

    Type "halt" if any of the above are wrong — fix in Dashboard before proceeding.
  </how-to-verify>
  <acceptance_criteria>
    - `mcp__vercel__list_projects` (or `vercel projects ls`) returns a project named `digswap-web` in team `team_WuQK7GkPndJ2xH9YKvZTMtB3`
    - Dashboard URL `https://vercel.com/thiagobraidatto-3732s-projects/digswap-web/settings` loads (proves project exists with correct slug)
    - Project Settings → General shows: Root Directory = `apps/web`, Framework = Next.js, Build Command override = `pnpm --filter @digswap/web build`, Install Command override = `pnpm install --frozen-lockfile`
    - Project Settings → Git shows: connected to `cbraidatto/digswap`, Production Branch = `main`
    - Plan badge shows "Hobby" (NOT "Pro")
    - First deploy attempt may have failed with env-var error — acceptable; documented as expected in evidence
  </acceptance_criteria>
  <resume-signal>
    Type "approved" once Dashboard confirms project exists with the 4 settings above. Type "halt" if any setting is wrong.
  </resume-signal>
  <done>
    Vercel project `digswap-web` exists with Root Directory = apps/web, Hobby plan, GitHub connected to cbraidatto/digswap, production branch = main.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Run `vercel link --repo` to write .vercel/repo.json + capture evidence/01-link-confirm.txt</name>
  <files>
    .vercel/repo.json
    .planning/phases/035-vercel-environment-wiring/evidence/01-link-confirm.txt
  </files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §2.1 lines 132-146 (vercel link --repo command — exact flags)
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §13 lines 797-815 (VERCEL_TOKEN sourcing pattern)
    - .gitignore (verify `.vercel` is gitignored — should be at line ~38)
    - .planning/phases/035-vercel-environment-wiring/evidence/00-path-deviation.md
  </read_first>
  <action>
Single Bash heredoc (one sub-shell, one possible auth event total). Run from repo root:

```bash
set -u
export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"
[ -n "$VERCEL_TOKEN" ] || { echo "VERCEL_TOKEN not set — Plan 01 Task 4 checkpoint not completed" >&2; exit 1; }

# Step 1: confirm auth without re-prompting
vercel whoami
echo "---"

# Step 2: link the monorepo root → digswap-web (creates .vercel/repo.json)
# --repo flag is mandatory for monorepos (RESEARCH §2.1)
# --yes skips interactive confirmation
vercel link --repo --yes \
  --scope team_WuQK7GkPndJ2xH9YKvZTMtB3 \
  --project digswap-web

echo "---"
ls -la .vercel/repo.json
echo "---"
cat .vercel/repo.json

# Step 3: list projects (sanity)
vercel projects ls --scope team_WuQK7GkPndJ2xH9YKvZTMtB3 | grep -E "digswap-web|NAME"
```

Capture stdout+stderr to `.planning/phases/035-vercel-environment-wiring/evidence/01-link-confirm.txt`. Sanitize before commit:

- The `vercel whoami` output (just username — safe)
- The `vercel link --repo` output (project name + scope — safe)
- `.vercel/repo.json` content (project IDs only — safe; no secrets)
- `vercel projects ls` row for digswap-web (safe)

If `vercel link --repo --project digswap-web` errors with "project not found", the user's Task 1 checkpoint may have used a different project name. Halt and ask user to verify.

If `vercel link --repo` errors with auth failure even with `VERCEL_TOKEN` set, the token may not be team-scoped — re-create per Plan 01 Task 4 with correct scope.
  </action>
  <verify>
    <automated>test -f .vercel/repo.json &amp;&amp; grep -q "digswap-web" .vercel/repo.json &amp;&amp; test -f .planning/phases/035-vercel-environment-wiring/evidence/01-link-confirm.txt &amp;&amp; grep -q "thiagobraidatto-3732" .planning/phases/035-vercel-environment-wiring/evidence/01-link-confirm.txt &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - File `.vercel/repo.json` exists in repo root (and is gitignored — `git status .vercel/` shows no tracked changes)
    - `.vercel/repo.json` contains string `digswap-web` (the project name) AND the team ID
    - File `.planning/phases/035-vercel-environment-wiring/evidence/01-link-confirm.txt` exists, size > 500 bytes
    - evidence/01-link-confirm.txt contains the literal string `thiagobraidatto-3732` (whoami output)
    - evidence/01-link-confirm.txt contains the literal string `digswap-web` (project list)
    - evidence/01-link-confirm.txt does NOT contain any value that looks like a secret (no `eyJ...` JWTs, no `sk_...`, no `whsec_...`, no `postgres://...:...` connection strings)
    - `vercel whoami` from the heredoc output returned `thiagobraidatto-3732` (no device-code prompt fired)
  </acceptance_criteria>
  <done>
    Local `.vercel/repo.json` maps repo → digswap-web project; evidence/01-link-confirm.txt captures the auth + linkage state.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Verify Project Settings (Node 20, build/install, branch, plan) + capture evidence/06a-project-settings.txt</name>
  <files>.planning/phases/035-vercel-environment-wiring/evidence/06a-project-settings.txt</files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §6 lines 334-366 (Project Settings recommendations)
    - .planning/phases/035-vercel-environment-wiring/035-CONTEXT.md D-04 line 23 (Node 20 in Project Settings)
    - .planning/REQUIREMENTS.md DEP-VCL-08 line 50
  </read_first>
  <action>
Verify Project Settings via MCP (no CLI re-auth needed). Use `mcp__vercel__get_project` if available, otherwise fall back to CLI:

```bash
# MCP-first attempt:
# Invoke mcp__vercel__get_project with idOrName="digswap-web", teamId="team_WuQK7GkPndJ2xH9YKvZTMtB3"
# Expected response includes: name, framework, nodeVersion, buildCommand, installCommand, rootDirectory, productionBranch

# CLI fallback if MCP doesn't expose the field:
export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"
vercel inspect digswap-web --scope team_WuQK7GkPndJ2xH9YKvZTMtB3 || \
  vercel api GET /v9/projects/digswap-web?teamId=team_WuQK7GkPndJ2xH9YKvZTMtB3
```

Inspect the response and verify (the executor MUST check each):
- `name` = `digswap-web` (D-01)
- `framework` = `nextjs`
- `nodeVersion` = `20.x` (D-04, DEP-VCL-08)
- `rootDirectory` = `apps/web` (D-01)
- `buildCommand` = `pnpm --filter @digswap/web build`
- `installCommand` = `pnpm install --frozen-lockfile`
- `link.productionBranch` (or equivalent) = `main` (D-01)
- `accountId` and team ID = `team_WuQK7GkPndJ2xH9YKvZTMtB3` (D-02)

If ANY of these is wrong, fix via Dashboard (Project Settings → General OR Settings → Git OR Settings → Build & Output) BEFORE proceeding to Plan 03. Document the fix in evidence/00-path-deviation.md.

If `nodeVersion` is `18.x` or `22.x` (Vercel may default to a different version), navigate to Project Settings → General → Node.js Version → select `20.x` → Save → re-run this task.

Write the sanitized verification result to `evidence/06a-project-settings.txt`:

```text
# evidence/06a-project-settings.txt
# Phase 35 Plan 02 Task 3 — Project Settings snapshot
# Date: <ISO timestamp>

Project name:        digswap-web                                    [PASS — D-01]
Team ID:             team_WuQK7GkPndJ2xH9YKvZTMtB3                  [PASS — D-02]
Framework preset:    nextjs                                         [PASS — auto-detected]
Node.js version:     20.x                                           [PASS — D-04, DEP-VCL-08]
Root Directory:      apps/web                                       [PASS — D-01]
Build command:       pnpm --filter @digswap/web build               [PASS]
Install command:     pnpm install --frozen-lockfile                 [PASS]
Production branch:   main                                           [PASS — D-01]
Plan:                Hobby                                          [PASS — D-03]
Connected GitHub:    cbraidatto/digswap                             [PASS]

DEP-VCL-01 (project linked, Root Directory apps/web): PASS
DEP-VCL-08 (Node 20 pinned): PASS
```
  </action>
  <verify>
    <automated>test -f .planning/phases/035-vercel-environment-wiring/evidence/06a-project-settings.txt &amp;&amp; grep -q "Node.js version:.*20" .planning/phases/035-vercel-environment-wiring/evidence/06a-project-settings.txt &amp;&amp; grep -q "Root Directory:.*apps/web" .planning/phases/035-vercel-environment-wiring/evidence/06a-project-settings.txt &amp;&amp; grep -q "DEP-VCL-01.*PASS" .planning/phases/035-vercel-environment-wiring/evidence/06a-project-settings.txt &amp;&amp; grep -q "DEP-VCL-08.*PASS" .planning/phases/035-vercel-environment-wiring/evidence/06a-project-settings.txt &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/035-vercel-environment-wiring/evidence/06a-project-settings.txt` exists, size > 600 bytes
    - File contains literal string `Node.js version:` followed somewhere by `20`
    - File contains literal string `Root Directory:` followed by `apps/web`
    - File contains literal string `Build command:` followed by `pnpm --filter @digswap/web build`
    - File contains literal string `Install command:` followed by `pnpm install --frozen-lockfile`
    - File contains literal string `Production branch:` followed by `main`
    - File contains literal string `Plan:` followed by `Hobby`
    - File contains the literal string `DEP-VCL-01: PASS` (or equivalent format)
    - File contains the literal string `DEP-VCL-08: PASS` (or equivalent format)
    - File does NOT contain any value resembling a secret (no JWT, no API key, no DB URL with password)
  </acceptance_criteria>
  <done>
    Project Settings verified to match D-01/D-02/D-03/D-04; evidence/06a-project-settings.txt commits the snapshot. DEP-VCL-01 + DEP-VCL-08 satisfied (modulo first deploy still failing — Plan 05 owns that fix).
  </done>
</task>

</tasks>

<verification>
After Plan 02 completion:

1. `mcp__vercel__list_projects` (team_WuQK7GkPndJ2xH9YKvZTMtB3) returns one project named `digswap-web`
2. `.vercel/repo.json` exists at repo root, contains `digswap-web`, is NOT staged in git (gitignored)
3. `evidence/01-link-confirm.txt` + `evidence/06a-project-settings.txt` exist with the right contents
4. NO env vars have been added yet (Plans 03/04 own that)
5. NO deploy has been triggered (the first-deploy auto-fail from Task 1 wizard is expected; Plan 05 triggers the first SUCCESSFUL deploy after env vars are in place)
</verification>

<success_criteria>
- [ ] Vercel project digswap-web exists in correct team (D-01, D-02)
- [ ] Project linked to GitHub cbraidatto/digswap, branch main (D-01)
- [ ] Root Directory = apps/web (DEP-VCL-01)
- [ ] Node.js Version = 20.x (DEP-VCL-08, D-04)
- [ ] Build command = `pnpm --filter @digswap/web build`
- [ ] Install command = `pnpm install --frozen-lockfile`
- [ ] Plan = Hobby (D-03)
- [ ] `.vercel/repo.json` written and gitignored
- [ ] evidence/01-link-confirm.txt + evidence/06a-project-settings.txt committed (sanitized)
- [ ] First failed deploy from wizard is acknowledged as expected (no env vars yet)
</success_criteria>

<output>
After completion, create `.planning/phases/035-vercel-environment-wiring/035-02-SUMMARY.md` capturing:
- Project IDs (digswap-web project_id, team_id) — for downstream plans to reference
- Settings snapshot (Node version, Root Directory, build/install commands, plan tier)
- Confirmation that Plan 03 + Plan 04 can now run in parallel (they only depend on the project existing)
- Any path deviations observed during execute (e.g., open-question 1 from RESEARCH about `vercel project add --scope` behavior — was it needed? did it work?) — append to `evidence/00-path-deviation.md`
</output>
