---
phase: 034-supabase-production-setup
plan: 01
subsystem: infra
tags: [supabase, mcp, oauth, prod-bootstrap, halt-protocol]

requires:
  - phase: 033-pre-deploy-audit-gate
    provides: migration trail proven reset-clean
  - phase: 033.1-audit-gate-closure
    provides: Vault wrapper migration (20260424000000), RUNBOOK.md gotchas

provides:
  - Wave 0 verification harness (verify.sh, rls-probe.sql, drop-and-recreate.md)
  - evidence/ directory in git tree
  - digswap-prod Supabase Cloud project (ref swyfhpgerzvvmoswkjyt, us-east-1, Free tier)
  - Project-scoped Supabase MCP wired into the repo (.mcp.json)
  - Documented path deviation: CLI → MCP-only execution mode

affects: [034-02-migration-push, 034-03-vault-cron, 034-04-edge-functions-bucket, 034-05-database-url-doc, 035-vercel-env-wiring]

tech-stack:
  added:
    - "@supabase/agent-skills (project-scoped, .agents/skills/)"
    - "Project-scoped MCP server: supabase (HTTP transport, OAuth)"
  patterns:
    - "MCP-first prod operations — DDL/DML/Edge-Function/Storage all flow through project-scoped OAuth, no DB password in repo or AI context"
    - "Path-deviation logging — when execution method changes from plan, write evidence/00-path-deviation.md before proceeding"

key-files:
  created:
    - .planning/phases/034-supabase-production-setup/scripts/verify.sh
    - .planning/phases/034-supabase-production-setup/scripts/rls-probe.sql
    - .planning/phases/034-supabase-production-setup/scripts/drop-and-recreate.md
    - .planning/phases/034-supabase-production-setup/evidence/.gitkeep
    - .planning/phases/034-supabase-production-setup/evidence/00-path-deviation.md
    - .planning/phases/034-supabase-production-setup/evidence/01-projects-list.txt
    - .planning/phases/034-supabase-production-setup/evidence/02-link-confirm.txt
    - .mcp.json
    - .agents/skills/supabase/
    - .agents/skills/supabase-postgres-best-practices/
  modified: []

key-decisions:
  - "PROD_REF = swyfhpgerzvvmoswkjyt (us-east-1, Free tier — D-01 + D-02 honored)"
  - "MCP-only execution mode — supabase CLI is never invoked against prod; all writes go through OAuth-scoped project MCP at https://mcp.supabase.com/mcp?project_ref=swyfhpgerzvvmoswkjyt"
  - "Path deviation accepted: ADR-003's intent (supabase/migrations is the only trail) is honored because mcp__supabase__apply_migration writes to the same supabase_migrations.schema_migrations table as supabase db push"
  - "Pitfall #4 (wrong-DB migration) is impossible by construction — MCP URL is pinned to project_ref, no env-switching mistake possible"

patterns-established:
  - "Project-scoped MCP for prod work — .mcp.json checked into repo with project_ref pinned, no shared credentials"
  - "Evidence inventory follows the original plan numbering (01-15) even when format changes (e.g., screenshot → JSON) — diff stays scannable"
  - "Path-deviation document is mandatory whenever plan execution method changes — keeps audit trail clean for the next session"

requirements-completed: [DEP-SB-01]

duration: ~25min (across 2 sessions due to MCP setup)
completed: 2026-04-26
---

# Phase 34 Plan 01: Wave 0 Scaffolding + Project Create

**Wave-0 verification harness shipped + digswap-prod created on Supabase Cloud (ref swyfhpgerzvvmoswkjyt, us-east-1, Free tier) + project-scoped MCP wired with full OAuth scope, replacing the originally-planned `supabase link --project-ref` step.**

## Performance

- **Duration:** ~25min (split across 2 sessions — Task 1 in session 1, Tasks 2+3 + MCP setup in session 2)
- **Tasks:** 3 (1 auto + 1 checkpoint:human-action + 1 auto)
- **Files modified:** 10 (8 new files + .mcp.json + skill symlinks)

## Accomplishments

- Wave-0 verification harness committed: `scripts/verify.sh` (executable, 8 DEP-SB-* checks, accepts PROD_REF/PROD_DIRECT_URL/PROD_ANON_KEY from env), `scripts/rls-probe.sql` (SET ROLE authenticated + JWT-bound probe across 4 RLS-locked tables), `scripts/drop-and-recreate.md` (5-step catastrophic halt runbook with Phase 34.1 escalation threshold)
- `digswap-prod` Supabase project created in us-east-1 on the Free tier (ref `swyfhpgerzvvmoswkjyt`, 20-char alphanumeric, distinct from dev `mrkgoucqcbqjhrdjcnpw`)
- Project-scoped Supabase MCP added to `.mcp.json` with OAuth completed; granted scopes: organizations:read, projects:read+write, database:read+write, analytics:read, secrets:read, edge_functions:read+write, environment:read+write, storage:read
- Supabase agent-skills installed (`supabase` + `supabase-postgres-best-practices`) at `.agents/skills/`
- Path-deviation document written documenting why we shifted from `supabase db push --linked` to MCP-only execution and how each evidence artifact maps from the original plan

## Task Commits

1. **Task 1: Create scripts/ scaffolding (verify.sh, rls-probe.sql, drop-and-recreate.md, evidence/.gitkeep)** — `13c3fc9` (feat)
2. **Task 2: USER creates digswap-prod on Supabase Dashboard (us-east-1, Free)** — checkpoint completed, no commit (manual Dashboard action)
3. **Task 3: Capture project ref + path deviation log + MCP wiring** — `7bcbb23` (feat)

## Files Created/Modified

- `.planning/phases/034-supabase-production-setup/scripts/verify.sh` — bash harness for verifying all 8 DEP-SB-* checks
- `.planning/phases/034-supabase-production-setup/scripts/rls-probe.sql` — JWT-bound RLS probe (4 tables: profiles, direct_messages, trade_requests, discogs_tokens)
- `.planning/phases/034-supabase-production-setup/scripts/drop-and-recreate.md` — 5-step catastrophic-halt runbook
- `.planning/phases/034-supabase-production-setup/evidence/.gitkeep` — evidence/ directory in git tree
- `.planning/phases/034-supabase-production-setup/evidence/00-path-deviation.md` — CLI → MCP path deviation rationale + per-artifact mapping
- `.planning/phases/034-supabase-production-setup/evidence/01-projects-list.txt` — project identification + pre-migration baseline state
- `.planning/phases/034-supabase-production-setup/evidence/02-link-confirm.txt` — project ref + OAuth scope manifest (replaces `cat supabase/.temp/project-ref`)
- `.mcp.json` — project-scoped MCP config (supabase server pinned to project_ref=swyfhpgerzvvmoswkjyt)
- `.agents/skills/supabase/` — supabase agent skill (universal — works with Codex, Gemini, Copilot etc.)
- `.agents/skills/supabase-postgres-best-practices/` — Postgres best-practices skill

## Decisions Made

- **MCP-only execution mode** chosen for the rest of Phase 34 (Plans 02-05). Rationale: the project-scoped MCP gives equivalent capability to the CLI without the DB password ever entering the AI/repo context. ADR-003 honored (same migrations trail, same `supabase_migrations.schema_migrations` table). Pitfall #4 impossible by construction (MCP URL pinned to project_ref).
- **Modern publishable key** (`sb_publishable_*`) chosen over the legacy anon JWT for Vault and future Phase 35 env vars. Rationale: independent rotation + better security per Supabase recommendation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Method change with user consent] Switched from `supabase link --project-ref` to project-scoped MCP**
- **Found during:** Task 3 (originally `supabase link` + capture `.temp/project-ref`)
- **Issue:** The CLI path required the user to type the database password into an interactive prompt while an executor agent was watching — a pattern that violates the "DB password never enters AI/repo context" discipline.
- **Fix:** User added the project-scoped Supabase MCP via `claude mcp add` and authenticated via OAuth. All subsequent prod operations route through the MCP instead of the CLI.
- **Files modified:** `.mcp.json` (created), `evidence/02-link-confirm.txt` (replaces `.temp/project-ref` capture), `evidence/00-path-deviation.md` (new — full mapping)
- **Verification:** `mcp__supabase__get_project_url` returns `https://swyfhpgerzvvmoswkjyt.supabase.co` ✓; `mcp__supabase__list_migrations` returns `[]` (proving fresh project) ✓; OAuth scopes cover all required operations for Plans 02-05 (database:read+write, edge_functions:write, etc.)
- **Committed in:** `7bcbb23`

---

**Total deviations:** 1 method-level (with explicit user consent)
**Impact on plan:** Path equivalence preserved — every artifact in the original plan maps to an MCP equivalent (see `evidence/00-path-deviation.md`). ADR-003 honored. Halt-on-fail protocol unchanged.

## Issues Encountered

- **None during execution.** One observation worth recording: the Vault extension (`supabase_vault 0.3.1`) is pre-enabled by Supabase platform on new projects, which makes the migration `20260424000000_enable_vault_extension.sql` idempotent (no-op on prod). This is the desired behavior — confirmed during recon before Plan 02 starts.
- **`pg_cron` and `pg_net`** are NOT yet installed (will be enabled by migrations during Plan 02). This is expected.

## User Setup Required

None at this point. The remaining user-facing work in Phase 34 is:
- Plan 04 T4: Configure CORS on bucket `trade-previews` via Dashboard (the MCP scope has only `storage:read`, no bucket-CORS write). User will be prompted at that point.

## Next Phase Readiness

- **Plan 02 ready to execute:** all 35 migration files exist in `supabase/migrations/`, lexical-ordered, MCP `apply_migration` available, halt-on-fail runbook in place at `scripts/drop-and-recreate.md`.
- **Vault wrapper migration is idempotent** (Vault already enabled), so no special handling needed.
- **Pre-migration baseline captured** in `evidence/01-projects-list.txt`: 0 migrations applied, 0 tables in public, 0 buckets, 0 Advisor lints, postgres 17.6, UTC.

---
*Phase: 034-supabase-production-setup*
*Completed: 2026-04-26*
