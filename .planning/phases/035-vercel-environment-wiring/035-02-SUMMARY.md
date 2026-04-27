---
phase: 035-vercel-environment-wiring
plan: 02
subsystem: infra
tags: [vercel, project-create, github-link, settings]

requires:
  - phase: 035-01-wave-0-scaffolding
    provides: VERCEL_TOKEN at $HOME/.vercel-token (zero device-code prompts)

provides:
  - Vercel project `digswap-web` created (prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY) in team_WuQK7GkPndJ2xH9YKvZTMtB3
  - GitHub repo `cbraidatto/digswap` linked (production branch = main)
  - Project Settings configured: framework=nextjs, rootDirectory=apps/web, buildCommand=pnpm --filter @digswap/web build, installCommand=pnpm install --frozen-lockfile, nodeVersion=20.x
  - Local `.vercel/repo.json` created (gitignored) — Bash CLI calls in Plans 03-06 know the project
  - 9/9 acceptance checks PASS (DEP-VCL-01 + DEP-VCL-08 satisfied)

affects: [035-03-env-vars-prod, 035-04-env-vars-preview, 035-05-deploy-verify, 035-06-playwright]

tech-stack:
  added: []
  patterns:
    - "Vercel project creation via 3 layers: CLI `vercel project add` (empty project) + Dashboard/OAuth (GitHub link) + REST API PATCH (Build/Install/Node settings)"
    - "Configuration via `curl PATCH /v9/projects/<name>` is faster than Dashboard click-through for non-OAuth settings"

key-files:
  created:
    - .planning/phases/035-vercel-environment-wiring/evidence/01-link-confirm.txt (1260 bytes)
    - .planning/phases/035-vercel-environment-wiring/evidence/06a-project-settings.txt (with 9/9 PASS acceptance check)
    - .vercel/repo.json (4-key map: remoteName + projects[id, name, directory, orgId])
  modified: []

key-decisions:
  - "Bypassed Plan 02 Task 1 Dashboard wizard partially: project creation via CLI (`vercel project add digswap-web`) + settings via REST API PATCH; only GitHub Git connection required Dashboard (OAuth flow can't be API'd)"
  - "Production branch = main confirmed via API read (was already set by Dashboard during Git connect)"

patterns-established:
  - "Vercel REST API for project settings: `PATCH /v9/projects/<name>?teamId=X` accepts {framework, rootDirectory, buildCommand, installCommand, nodeVersion} in one call. Returns updated project."
  - "Git OAuth connection ALWAYS requires Dashboard interaction (Login Connections → GitHub) — no API workaround. Document for future phases."

requirements-completed: [DEP-VCL-01, DEP-VCL-08]

duration: ~5min (CLI create + API settings + Dashboard Git OAuth + verify)
completed: 2026-04-26
---

# Phase 35 Plan 02: Vercel Project Create + Link + Settings

**Vercel project `digswap-web` (prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY) created in team_WuQK7GkPndJ2xH9YKvZTMtB3 via CLI `vercel project add`, then configured via REST API PATCH for framework=nextjs/rootDirectory=apps/web/buildCommand/installCommand/nodeVersion=20.x in one call, then GitHub repo cbraidatto/digswap connected via Dashboard OAuth flow (single user click), production branch=main, local .vercel/repo.json written, and 9/9 acceptance checks PASS.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 3 (Task 1 user-checkpoint via Dashboard for Git OAuth + Task 2 vercel link + Task 3 settings verify)
- **Files modified:** 2 evidence files + .vercel/repo.json

## Accomplishments

- Vercel project `digswap-web` created with id `prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY` in team `thiagobraidatto-3732's projects` (`team_WuQK7GkPndJ2xH9YKvZTMtB3`)
- GitHub `cbraidatto/digswap` linked, production branch = `main` (confirmed via API read)
- Settings via single `PATCH /v9/projects/digswap-web` API call:
  - framework: nextjs
  - rootDirectory: apps/web
  - buildCommand: `pnpm --filter @digswap/web build`
  - installCommand: `pnpm install --frozen-lockfile`
  - nodeVersion: 20.x
- `.vercel/repo.json` written (gitignored at line 101 of `.gitignore`)
- evidence/01-link-confirm.txt + evidence/06a-project-settings.txt captured (9/9 PASS)

## Task Commits

1. **Task 1: User Dashboard checkpoint (GitHub OAuth + repo link)** — no commit (Dashboard action; verified via API read)
2. **Tasks 2+3 (link + settings verify)** — TBD (this commit)

## Files Created/Modified

- `.planning/phases/035-vercel-environment-wiring/evidence/01-link-confirm.txt` — vercel whoami + vercel link --repo --yes output + .vercel/repo.json contents + projects ls row
- `.planning/phases/035-vercel-environment-wiring/evidence/06a-project-settings.txt` — API response + 9/9 PASS acceptance checklist
- `.vercel/repo.json` — gitignored, maps repo → project for Bash CLI calls

## Decisions Made

- **Hybrid approach (CLI + API + Dashboard) chosen over Dashboard wizard:** CLI creates empty project in 200ms, REST API PATCH sets all 5 build/runtime settings in one call, Dashboard handles only the OAuth-bound GitHub connection. Reduces user friction to ONE click (the GitHub OAuth) vs ~7 clicks for full Dashboard wizard. Documented as new pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule: API path optimization] Original plan called for Dashboard wizard for project create + GitHub link in single user action**
- **Found during:** Task 1 setup
- **Issue:** Dashboard wizard would have required user to: (a) navigate to vercel.com/new, (b) authorize GitHub if not already, (c) select repo, (d) name the project, (e) set Root Directory, (f) override Build Command, (g) override Install Command, (h) confirm Hobby tier. 8 clicks minimum.
- **Fix:** Split into 3 layers — CLI for project create (`vercel project add digswap-web`), API for settings (single PATCH), Dashboard for GitHub OAuth only (must be Dashboard because Login Connections require browser-based OAuth).
- **Files modified:** None as code; only the execution path changed
- **Verification:** API GET /v9/projects/digswap-web returns all 9 expected fields; 9/9 PASS in evidence/06a
- **Committed in:** TBD (this commit)

**2. [Rule: Python encoding] First evidence/06a-project-settings.txt write failed because Python printed Unicode `✓✗` characters that Windows cp1252 can't encode**
- **Found during:** Task 3 evidence generation
- **Issue:** Python's print() with Unicode checkmarks crashed with `UnicodeEncodeError` on Windows
- **Fix:** Replaced `✓✗` with ASCII `[PASS][FAIL]`. The check logic was identical; only display strings changed.
- **Files modified:** evidence/06a-project-settings.txt (regenerated)
- **Verification:** File now reads cleanly, all 9 acceptance lines visible
- **Committed in:** TBD

---

**Total deviations:** 2 (both reduce friction without changing semantics)
**Impact on plan:** None — DEP-VCL-01 + DEP-VCL-08 fully satisfied; subsequent plans unblocked.

## Issues Encountered

- **GitHub OAuth required Dashboard interaction:** REST API at `POST /v9/projects/digswap-web/link` returned `bad_request: You need to add a Login Connection to your GitHub account first`. This is a one-time Vercel account-level OAuth flow that has no API equivalent. Documented as established pattern for future phases.

## User Setup Required

None for next plans. Plans 03/04 read `VERCEL_TOKEN` from `~/.vercel-token` and the project from `.vercel/repo.json` automatically.

## Next Phase Readiness

- **Plan 03 (Production env vars) unblocked:** `vercel env add KEY production [--sensitive]` will succeed against `digswap-web` without re-prompting auth.
- **Plan 04 (Preview env vars) unblocked:** same surface as Plan 03, different scope.
- **First deploy from Plan 05 will pull settings from this configuration** — Node 20, pnpm install, filtered build, all set.

---
*Phase: 035-vercel-environment-wiring*
*Completed: 2026-04-26*
