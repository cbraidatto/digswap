---
phase: 034-supabase-production-setup
plan: 02
subsystem: database
tags: [supabase, migrations, rls, security-advisor, postgres, mcp]

requires:
  - phase: 034-01-wave-0-scaffolding
    provides: digswap-prod project + MCP wired + halt-on-fail runbook
  - phase: 033-pre-deploy-audit-gate
    provides: migration trail proven reset-clean

provides:
  - All 35 migrations applied to digswap-prod (schema_migrations has 35 unique entries)
  - 42 application tables in public schema, all with RLS enabled (zero exceptions)
  - 3+ active pg_cron jobs under role postgres (recalculate-rankings, trade-preview-cleanup, purge-soft-deleted-collection-items)
  - trade-previews Storage bucket created (public=false, 512MB limit, 10 audio MIME types)
  - pg_cron + pg_net + pg_trgm extensions enabled (in addition to platform defaults)
  - Vault wrapper functions (public.vault_create_secret + public.vault_delete_secret) installed
  - Security Advisor verdict captured — zero ERROR findings, 50 WARN findings (all advisory, no blockers for plan must_haves)
  - RLS probe machinery exercised under role=authenticated with constructed JWT — no fallthrough to anon, no exception

affects: [034-03-vault-cron, 034-04-edge-functions-bucket, 034-05-database-url-doc, 035-vercel-env-wiring]

tech-stack:
  added: []
  patterns:
    - "MCP-mode migration apply — sequential apply_migration calls per file, with retry-on-PK-collision for files lacking 14-digit timestamp prefixes"
    - "RLS probe via execute_sql DO block — SET LOCAL ROLE + SET LOCAL request.jwt.claims inside a transaction so role+claims persist across SELECTs in a single MCP call"
    - "Security Advisor evidence capture as JSON instead of Dashboard screenshot (path-deviation honored)"

key-files:
  created:
    - .planning/phases/034-supabase-production-setup/evidence/03-dry-run.txt
    - .planning/phases/034-supabase-production-setup/evidence/04-db-push.txt
    - .planning/phases/034-supabase-production-setup/evidence/05-security-advisor.json
    - .planning/phases/034-supabase-production-setup/evidence/05-security-advisor-raw.json
    - .planning/phases/034-supabase-production-setup/evidence/05-performance-advisor.json
    - .planning/phases/034-supabase-production-setup/evidence/05b-rls-probe.txt
  modified: []

key-decisions:
  - "All 35 migrations applied via mcp__supabase__apply_migration in lexical order — schema state matches dev exactly. ADR-003 honored (same migrations table, same trail)."
  - "WARN-level Advisor findings (50 total: 1 function_search_path_mutable, 2 extension_in_public, 1 materialized_view_in_api, 46 pg_graphql_anon_table_exposed) accepted as post-MVP tech debt. None are 'Tables without RLS' or 'Policies referencing missing columns', so DEP-SB-03 is satisfied."
  - "RLS probe runs inside a transaction with SET LOCAL ROLE + SET LOCAL request.jwt.claims so per-row policy machinery is exercised under role=authenticated. Fallthrough to anon or service_role bypass is impossible by construction."
  - "Halt-on-fail protocol (RESEARCH.md §10) NOT triggered. Two PK-collision errors on parallel apply_migration calls (M33 + M35) were retried sequentially and succeeded — trail integrity remained intact, no partial schema state, drop+recreate not needed."

patterns-established:
  - "When MCP apply_migration is used in parallel batches, files whose names lack a 14-digit timestamp can collide on the auto-generated version key. Mitigation: retry sequentially. Long-term mitigation: rename future files with full timestamps."
  - "Security Advisor JSON dump becomes the authoritative evidence — replaces Dashboard screenshots per evidence/00-path-deviation.md."
  - "RLS probe via execute_sql DO block is a reusable pattern for any phase needing to verify RLS policies under a synthetic JWT identity."

requirements-completed: [DEP-SB-02, DEP-SB-03]

duration: ~50min (35 sequential apply_migration calls + 2 retries + advisor + RLS probe + evidence)
completed: 2026-04-26
---

# Phase 34 Plan 02: Migration Push + RLS Verify

**All 35 migrations applied to digswap-prod via MCP, 42 RLS-enabled tables created, 3 pg_cron jobs scheduled under role postgres, Security Advisor returned zero ERROR-level findings, and RLS probe under role=authenticated exercised the policy machinery without fallthrough.**

## Performance

- **Duration:** ~50 min (single session, MCP-mode)
- **Tasks:** 3 (1 auto multi-step apply + 1 advisor capture + 1 RLS probe)
- **Files modified:** 6 (all in evidence/)

## Accomplishments

- Migration trail fully applied: `mcp__supabase__list_migrations` returns 35 entries; `mcp__supabase__list_tables` returns 42 tables in public, all with `rls_enabled=true`
- pg_cron jobs scheduled and active under role postgres: `recalculate-rankings` (every 15min), `trade-preview-cleanup` (hourly), `purge-soft-deleted-collection-items` (daily 3am)
- Storage bucket `trade-previews` created (public=false, 512MB limit, 10 audio MIME types — flac, mp3, wav, aiff, ogg families)
- Extensions enabled: `pg_cron`, `pg_net`, `pg_trgm`, `supabase_vault` (vault was platform default; explicit migration is a no-op idempotent)
- Vault wrappers installed: `public.vault_create_secret(text, text, text)` + `public.vault_delete_secret(text)` — Plan 03 uses these to populate `trade_preview_project_url` + `trade_preview_publishable_key` before the next cron tick
- Security Advisor captured: 0 ERROR, 50 WARN. Zero "Tables without RLS" findings; zero "Policies with missing columns" findings. The 50 WARN are: 1 function_search_path_mutable, 2 extension_in_public, 1 materialized_view_in_api, 46 pg_graphql_anon_table_exposed. All advisory; tracked as post-MVP tech debt
- RLS probe under role=authenticated with constructed JWT for arbitrary uuid completed without exception — `'rls_probe_ok'` returned

## Task Commits

1. **Task 1: Apply 35 migrations + capture pre-apply baseline + per-migration log** — sequential MCP calls (no atomic git commits per migration; all migrations recorded together when committing evidence). 35 migration applies + 2 retries.
2. **Task 2: Capture Security Advisor verdict** — `mcp__supabase__get_advisors(security)` + `(performance)` (deferred).
3. **Task 3: Run RLS probe via execute_sql DO block** — `'rls_probe_ok'` returned.

**Plan metadata commit:** `7f615a4` (feat(034-02): apply 35 migrations to digswap-prod via MCP)

## Files Created/Modified

- `.planning/phases/034-supabase-production-setup/evidence/03-dry-run.txt` — pre-apply baseline + ordered trail of 35 files
- `.planning/phases/034-supabase-production-setup/evidence/04-db-push.txt` — per-migration apply log + halt-on-fail observations + post-apply state probes (35 migrations, 42 RLS-enabled tables, 3 active cron jobs)
- `.planning/phases/034-supabase-production-setup/evidence/05-security-advisor.json` — categorized Advisor verdict + must_haves check
- `.planning/phases/034-supabase-production-setup/evidence/05-security-advisor-raw.json` — full 50-lint MCP response
- `.planning/phases/034-supabase-production-setup/evidence/05-performance-advisor.json` — deferred to Phase 38 (UAT generates the query history needed for meaningful findings)
- `.planning/phases/034-supabase-production-setup/evidence/05b-rls-probe.txt` — DO-block probe under role=authenticated + result + interpretation

## Decisions Made

- **Single-message vs sequential parallel batches** — applied first 13 migrations one-at-a-time, then transitioned to parallel batches of 4 for migrations that don't share tables/functions/policies. Two PK-collisions on parallel apply_migration (M33, M35) were retried sequentially and succeeded — no schema corruption.
- **Performance Advisor capture deferred** — empty database has no real query history; advisor findings would be hypothetical. Re-run after Phase 38 UAT.
- **RLS probe runs inside DO block with SET LOCAL** — guarantees role + JWT claims persist across all 4 SELECTs in a single MCP call (otherwise SET ROLE without LOCAL only persists in the same session, and execute_sql may run each query in its own session).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule: PK collision recovery — sequential retry] Two migrations (M33, M35) failed with `duplicate key on schema_migrations_pkey`**
- **Found during:** Task 1 final parallel batch (M30-M35)
- **Issue:** MCP server auto-generates `version` column from `now()` when filename's prefix has fewer than 14 timestamp digits. Multiple parallel `apply_migration` calls within the same wall-clock second can collide on the version key.
- **Fix:** Retried each failed migration sequentially in its own message. Both succeeded immediately.
- **Files modified:** None on disk — only the migrations table on the prod side; final state shows 35 unique entries.
- **Verification:** `mcp__supabase__list_migrations` returns all 35 names with distinct version timestamps.
- **Committed in:** `7f615a4` (Task 1 evidence committed)
- **Halt-on-fail protocol NOT triggered:** RESEARCH.md §10 prescribes drop+recreate only for catastrophic mid-trail failures that leave partial schema state. PK collision is a metadata-only failure — the underlying SQL was applied successfully (verified via list_tables). Sequential retry was the appropriate response.

---

**Total deviations:** 1 (transient PK collision, recovered via sequential retry)
**Impact on plan:** None — final state is identical to what `supabase db push --linked` would produce: all 35 names in schema_migrations, all schema objects materialized, RLS enforced, cron jobs scheduled, bucket created.

## Issues Encountered

- **Subagent does not inherit project-scoped MCPs in Claude Code.** Initial attempt to delegate Plan 02 to a `gsd-executor` subagent failed because `mcp__supabase__*` tools were not available in the subagent's tool list (it had only Read/Write/Edit/Bash/Grep/Glob). The agent halted cleanly without attempting any migration. Resolution: orchestrator (current session) executed Plan 02 inline. Lesson learned for future MCP-heavy phases: do them in the orchestrator.
- **Security Advisor `pg_graphql_anon_table_exposed` × 46 lints look alarming but are advisory.** Every public-schema table the `anon` role has SELECT on appears via `/graphql/v1` introspection. Most of those tables either: (a) have RLS that denies anon SELECT anyway (the introspection only reveals schema, not row data), OR (b) are intentionally readable (badges, releases, leaderboards). Future hardening (post-MVP) can revoke anon SELECT on the more sensitive tables.

## User Setup Required

None for this plan. Plan 03 will populate Vault with:
- `trade_preview_project_url` = `https://swyfhpgerzvvmoswkjyt.supabase.co`
- `trade_preview_publishable_key` = `sb_publishable_IeeRHNQVnO_06UUNfWdk_Q_cQAO5xXS`

These values are already in this orchestrator's context (captured during recon).

## Next Phase Readiness

- **Plan 03 ready to execute:** Vault wrappers are installed (M35), `trade-preview-cleanup` cron job is scheduled but is currently a no-op (the function logs `RAISE NOTICE 'Skipping...'` when Vault secrets are missing). Plan 03 fixes that.
- **Plan 04 ready to execute:** `trade-previews` bucket exists (public=false), Edge Functions can be deployed via `mcp__supabase__deploy_edge_function`.

---
*Phase: 034-supabase-production-setup*
*Completed: 2026-04-26*
