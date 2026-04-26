# Phase 34 Path Deviation: CLI → MCP-only

**Date:** 2026-04-26
**Decision owner:** Solo developer (user)
**Approved during:** /gsd:execute-phase 34 session

## What changed

The plan as written called for the standard Supabase CLI flow:

- `supabase link --project-ref <ref>` (Plan 01 T3)
- `supabase db push --linked --dry-run` then live (Plan 02 T1)
- `supabase functions deploy <name>` (Plan 04 T1)
- `psql "$PROD_DIRECT_URL" -f scripts/rls-probe.sql` (Plan 02 T3)
- `psql "$PROD_DIRECT_URL" -c "SELECT public.vault_create_secret(...)"` (Plan 03 T1)
- `psql -c "SELECT count(*) FROM cron.job WHERE active"` (Plan 03 T2)

We replaced all of this with the project-scoped Supabase MCP at
`https://mcp.supabase.com/mcp?project_ref=swyfhpgerzvvmoswkjyt&features=...`.

## Why we deviated

1. **The DB password never enters the AI/repo context.** The MCP authenticates via
   OAuth with the user's Supabase account; no postgres password is generated, stored,
   typed, or passed. This is strictly safer than the CLI path which would have
   required the user to type the password into an interactive `supabase link` prompt
   while an executor agent watches.
2. **The MCP URL is pinned to `project_ref=swyfhpgerzvvmoswkjyt`.** Pitfall #4
   (wrong-DB migration) is impossible by construction — there is no `supabase link`
   step that could mistakenly target dev. Even a typo in this evidence file cannot
   route writes to the wrong project.
3. **Per-migration atomic recording.** `mcp__supabase__apply_migration` registers
   each migration in `supabase_migrations.schema_migrations` the same way
   `supabase db push --linked` does. ADR-003's "supabase/migrations is the only
   trail" rule is fully honored — both paths use the same trail and the same
   tracking table.
4. **Edge Function deploy via MCP** uses the same artifact contract (function name +
   files + entrypoint + verify_jwt) as `supabase functions deploy`, just over the
   project's REST API rather than the CLI.

## What did NOT change

- **Migration trail.** All 35 SQL files in `supabase/migrations/` are applied
  in lexical order, exactly as `supabase db push` would. ADR-003 still holds.
- **Halt-on-fail protocol.** RESEARCH.md §10 still applies. If any migration
  fails mid-trail, the recovery is still: drop the project (Dashboard) → recreate
  fresh → restart Plan 02.
- **Vault-before-cron ordering.** Plan 03 still populates Vault BEFORE the next
  pg_cron tick of `trade-preview-cleanup` (Pitfall #11).
- **CORS configuration.** Plan 04 T4 still goes through the Dashboard — the MCP
  scope is `storage:read` only, no bucket-CORS write API. This is the only
  remaining manual checkpoint in the phase.
- **Security Advisor evidence.** Plan 02 T2 captures the Advisor verdict via
  `mcp__supabase__get_advisors` instead of a Dashboard screenshot. The verdict
  itself (zero high/critical findings) is the same data.
- **Audit user creation.** Still deferred to Phase 38 (no change).
- **Doc-debt `digswap.com` → `digswap.com.br`.** Still a follow-up QUICK
  (no change).

## File-level evidence mapping (CLI → MCP equivalents)

| Original plan file | MCP equivalent | Format |
|---|---|---|
| `evidence/01-projects-list.txt` (CLI stdout) | same name, MCP recon dump | text |
| `evidence/02-link-confirm.txt` (`.temp/project-ref`) | same name, OAuth-pinned ref + scope manifest | text |
| `evidence/03-dry-run.txt` (`db push --dry-run`) | same name, MCP-derived diff: list_migrations before vs intended trail | text |
| `evidence/04-db-push.txt` (`db push` stdout) | same name, per-migration `apply_migration` log | text |
| `evidence/05-security-advisor.png` (screenshot) | `evidence/05-security-advisor.json` | JSON (the same data, just structured) |
| `evidence/05b-rls-probe.txt` (psql output) | same name, MCP `execute_sql` output | text |
| `evidence/06-vault-secrets.txt` (psql) | same name, MCP `execute_sql` output | text |
| `evidence/07a-cleanup-deploy.log` (CLI deploy log) | same name, MCP `deploy_edge_function` response | text |
| `evidence/07b-validate-deploy.log` | same name | text |
| `evidence/07c-cleanup-curl.txt` (curl smoke) | same name (curl still works against the live Edge Function) | text |
| `evidence/07d-validate-curl.txt` | same name | text |
| `evidence/08-cron-jobs.txt` (psql) | same name, MCP `execute_sql` output | text |
| `evidence/09-bucket-state.txt` (psql) | same name, MCP `list_storage_buckets` + `execute_sql` | text |
| `evidence/10-cors-dashboard.png` | unchanged — Dashboard screenshot still required | png |
| `evidence/14-database-url-template.txt` | unchanged — text template, no MCP needed | text |
| `evidence/15-verify-final.txt` | unchanged — bash run of scripts/verify.sh OR equivalent MCP probe re-run | text |

## Consequences for Plan 02 halt-on-fail

If `mcp__supabase__apply_migration` returns a non-200 / error mid-trail, the
recovery procedure in `scripts/drop-and-recreate.md` still applies. The
difference: instead of `supabase db reset` (impossible without DB password),
we drop the project from the Dashboard and re-create it. The user will need
to re-add the MCP server with the new project_ref.
