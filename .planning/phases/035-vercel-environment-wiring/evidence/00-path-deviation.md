# Phase 35 Path Deviation Log: MCP-first + CLI-for-writes

**Date:** 2026-04-26
**Decision owner:** Solo developer (user)
**Approved during:** /gsd:plan-phase 35 + /gsd:execute-phase 35

## Pattern inherited from Phase 34

Phase 34 established the **MCP-first / CLI-for-writes** pattern (see `.planning/phases/034-supabase-production-setup/evidence/00-path-deviation.md`). Phase 35 adopts the same pattern adapted to Vercel:

- **MCP for read/observability** — `mcp__vercel__list_deployments`, `mcp__vercel__get_deployment`, `mcp__vercel__get_deployment_build_logs`, `mcp__vercel__get_runtime_logs`. OAuth-bound to `thiagobraidatto-3732`. Zero re-auth prompts.
- **CLI for writes** — `vercel project add`, `vercel link --repo`, `vercel env add KEY <env>`, `vercel deploy --prod`, `vercel pull`, `vercel build`, `vercel inspect`. Authenticated via `VERCEL_TOKEN` env var sourced from `$HOME/.vercel-token` (D-20 mitigation).

## Why this matters for Phase 35

Vercel CLI auth file at `$HOME/AppData/Roaming/com.vercel.cli/Data/auth.json` does NOT persist between Bash sub-shells under the Claude Code sandbox (verified during Phase 34 D-04 recon: 2 sequential `vercel teams ls` + `vercel projects ls` calls triggered 2 device codes). Mitigation:

1. User created `$HOME/.vercel-token` once (Vercel Dashboard → Settings → Tokens → 30-day, scoped to `team_WuQK7GkPndJ2xH9YKvZTMtB3`).
2. Every Bash call that runs `vercel` starts with `export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"`.
3. Multiple CLI commands batch into a single Bash heredoc when feasible (one possible device-code prompt per sub-shell, not per command).

## D-05 secret-isolation deviation (acknowledged)

User explicitly chose (D-05) to allow Claude to populate ALL env vars via MCP/CLI — DB password + service_role key transit through AI context temporarily. Mitigations:

- Secrets NEVER written to evidence files or SUMMARY.md (length-only or presence-only)
- HANDOFF_HMAC_SECRET + IMPORT_WORKER_SECRET generated locally via `openssl rand -hex 32 | vercel env add ... --sensitive` (one-shot pipe — value never enters a shell variable, never echoes)
- `--sensitive` flag on all 10 secret env vars (encrypted-at-rest in Vercel; not readable post-creation)
- Leak suspicion → revoke via Supabase Dashboard (service_role) + Vercel Dashboard (project DB) + Phase 35.1 gap-closure plan re-populates

## Path deviations actually observed during execute

(filled by execute-phase as deviations occur — examples: open-question 1 vercel project add --scope behavior, open-question 3 vercel pull file location)
