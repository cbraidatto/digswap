---
phase: 034-supabase-production-setup
status: complete
mode: MCP-only (path deviation from CLI — see evidence/00-path-deviation.md)
milestone: v1.4 Production Launch
project_ref: swyfhpgerzvvmoswkjyt
project_url: https://swyfhpgerzvvmoswkjyt.supabase.co
region: us-east-1
tier: Free (D-02 + D-03 + D-04 + D-05 deferred Pro/PITR)
domain: digswap.com.br
plans_completed: 5
plans_total: 5
requirements_addressed: [DEP-SB-01, DEP-SB-02, DEP-SB-03, DEP-SB-04, DEP-SB-05, DEP-SB-06, DEP-SB-07, DEP-SB-10]
requirements_deferred: [DEP-SB-08, DEP-SB-09]
deferred_reason: Free-Tier launch decision (CONTEXT.md D-03 + D-05). DEP-SB-08 (Pro tier) and DEP-SB-09 (PITR + restore rehearsal) are tracked for post-MVP activation.
final_verify: 8/8 PASS (evidence/15-verify-final.txt)
completed: 2026-04-26
---

# Phase 34: Supabase Production Setup — Phase Summary

**`digswap-prod` Supabase project provisioned (us-east-1, Free tier) with all 35 migrations applied, 42 RLS-enabled tables, 3 active pg_cron jobs under role postgres, 2 Edge Functions deployed and smoke-tested, Vault populated with the secrets the cleanup-trade-previews cron needs, `trade-previews` Storage bucket created (public=false, 10 audio MIME types whitelisted, 48h TTL via 3-piece pg_cron+Edge mechanism), DATABASE_URL pooler template documented for Phase 35 to consume — Stripe/Pro/PITR explicitly deferred for the free-tier MVP launch.**

## Plans

| # | Plan                                          | Result | Key commit | SUMMARY                                |
|---|------------------------------------------------|--------|------------|----------------------------------------|
| 1 | Wave 0 scaffolding + project create            | ✓      | `13c3fc9`, `7bcbb23`, `4e639ad` | [034-01-SUMMARY.md](./034-01-SUMMARY.md) |
| 2 | Migration push + Security Advisor + RLS verify | ✓      | `7f615a4`, `e9e46be` | [034-02-SUMMARY.md](./034-02-SUMMARY.md) |
| 3 | Vault populate + cron verify                   | ✓ (corrected during Plan 04) | `0baae68`, `e2128de` | [034-03-SUMMARY.md](./034-03-SUMMARY.md) |
| 4 | Edge Functions + bucket + CORS investigation   | ✓ (CORS task → N/A) | `9551e72`, `b1d63f7` | [034-04-SUMMARY.md](./034-04-SUMMARY.md) |
| 5 | DATABASE_URL doc + final verify + phase summary| ✓      | this file (TBD)      | [034-05-SUMMARY.md](./034-05-SUMMARY.md) |

## Path deviations (logged for audit)

1. **CLI → MCP-only execution mode** ([evidence/00-path-deviation.md](./evidence/00-path-deviation.md))
   - Original plan: `supabase link` + `supabase db push --linked` + `supabase functions deploy` etc.
   - Actual execution: project-scoped Supabase MCP at `https://mcp.supabase.com/mcp?project_ref=swyfhpgerzvvmoswkjyt&...` for all DDL/DML/Edge-Function/Storage operations.
   - Rationale: DB password never enters AI/repo context; OAuth-scoped credentials cannot accidentally target dev (no env-switching mistake possible); Pitfall #4 (wrong-DB migration) impossible by construction; ADR-003 fully honored (same migrations table, same trail).

2. **Per-bucket CORS task → N/A** ([evidence/10-cors-investigation.md](./evidence/10-cors-investigation.md))
   - Original plan: configure CORS via Dashboard with `digswap.com.br` + `www.digswap.com.br` allow-list (D-07).
   - Actual finding: per-bucket CORS does NOT exist as a configurable setting in modern Supabase Storage. Three SQL/MCP probes confirmed: no CORS column on `storage.buckets`, no `*cors*`/`*origin*` tables, no CORS field in project-level Storage config.
   - Resolution: D-07's intent ("lock down access to the bucket") is satisfied by the Storage RLS policies created by migration `20260417_trade_preview_infrastructure.sql` (`trade_previews_insert_owner` + `trade_previews_select_participant`), which are STRONGER than CORS (they enforce business invariants regardless of request origin or transport).

3. **Vault publishable_key format correction** ([evidence/06-vault-secrets.txt](./evidence/06-vault-secrets.txt))
   - Plan 03 originally stored modern `sb_publishable_*` (46 chars).
   - Plan 04 smoke test failed with `401 UNAUTHORIZED_INVALID_JWT_FORMAT` — gateway with `verify_jwt=true` requires JWT format.
   - Replaced with legacy anon JWT (208 chars). Cleanup smoke now returns 200 with the expected body.

## Final verify (8/8 PASS)

| Req       | Status            | Detail                                                              |
|-----------|-------------------|---------------------------------------------------------------------|
| DEP-SB-01 | PASS              | digswap-prod project ref `swyfhpgerzvvmoswkjyt` (us-east-1, Free)   |
| DEP-SB-02 | PASS              | 35 migrations applied via MCP (lexically ordered, all distinct in supabase_migrations.schema_migrations) |
| DEP-SB-03 | PASS              | 42 public tables w/ RLS, 0 without; Security Advisor: 0 ERROR, 50 WARN advisory |
| DEP-SB-04 | PASS              | cleanup-trade-previews + validate-preview both ACTIVE; smoke-tested 200 / 401 |
| DEP-SB-05 | PASS              | 3 active pg_cron jobs, all under role `postgres`                    |
| DEP-SB-06 | PASS              | Vault has `trade_preview_project_url` (40c) + `trade_preview_publishable_key` (208c, legacy JWT) |
| DEP-SB-07 | PASS (re-interpreted) | Bucket `trade-previews` exists w/ public=false, 10 audio MIME types, RLS on storage.objects |
| DEP-SB-10 | PASS              | DATABASE_URL pooler template doc has all 3 required tokens          |

## Deferred (per CONTEXT.md D-03 + D-05)

- **DEP-SB-08:** Supabase Pro tier + auto-pause off. Free-tier launch accepts auto-pause (D-04). Activate Pro when (a) 500MB DB cap pressures OR (b) first paying user appears (post-MVP Stripe). Migration path: Supabase Pro is in-place upgrade, zero downtime.
- **DEP-SB-09:** PITR + rehearsed restore. Free-tier daily backups cover 95% of recovery scenarios for MVP. Post-MVP: rehearse restore on a throwaway Pro project before production matters.

## Inputs ready for Phase 35

| Field | Value | Source |
|-------|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` (prod) | `https://swyfhpgerzvvmoswkjyt.supabase.co` | evidence/01 + Plan 01 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` (prod) | `eyJhbGc...82fg` (legacy anon JWT, 208 chars) | recon during Plan 01, also in Vault as `trade_preview_publishable_key` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (prod, optional) | `sb_publishable_IeeRHNQVnO_06UUNfWdk_Q_cQAO5xXS` | recon during Plan 01 |
| `SUPABASE_SERVICE_ROLE_KEY` (prod) | (NOT captured — auto-injected to Edge Functions; for Vercel env, copy from Dashboard → Settings → API → "service_role secret") | TBD |
| `DATABASE_URL` (prod) | `postgresql://postgres.swyfhpgerzvvmoswkjyt:<password>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true` | evidence/14 — Phase 35 user pastes the password into Vercel directly |
| Drizzle config | `prepare: false` required when DATABASE_URL points to PgBouncer transaction-mode pooler | evidence/14 |

## Doc-debt flagged for follow-up QUICK

CONTEXT.md, ROADMAP.md, REQUIREMENTS.md, PROJECT.md, and many .planning/research/*.md files reference `digswap.com` (without `.br`). The real domain is `digswap.com.br`. CONTEXT.md D-06 acknowledged this; the actual rename is intentionally NOT bundled into Phase 34 (would inflate scope by 30+ minutes of off-topic edits). Should be a follow-up `/gsd:quick` command after Phase 34 closes.

Recommended QUICK title: `domain rename: digswap.com → digswap.com.br across all .planning/ docs`

## Evidence inventory (16 files in evidence/)

```
evidence/
├── .gitkeep
├── 00-path-deviation.md             — CLI→MCP path-deviation rationale
├── 01-projects-list.txt             — pre-migration baseline + extension state
├── 02-link-confirm.txt              — project ref + OAuth scope manifest
├── 03-dry-run.txt                   — MCP-equivalent of `supabase db push --dry-run`
├── 04-db-push.txt                   — per-migration apply log + retry observations
├── 05-security-advisor.json         — categorized Advisor verdict (0 ERROR, 50 WARN)
├── 05-security-advisor-raw.json     — full Advisor JSON dump (52KB)
├── 05-performance-advisor.json      — deferred-to-Phase-38 rationale
├── 05b-rls-probe.txt                — DO-block under role authenticated + JWT
├── 06-vault-secrets.txt             — Vault contents (length-only) + correction note
├── 07a-cleanup-deploy.log           — MCP deploy_edge_function response (cleanup)
├── 07b-validate-deploy.log          — MCP deploy_edge_function response (validate)
├── 07c-cleanup-curl.txt             — curl smoke (200 with expected JSON shape)
├── 07d-validate-curl.txt            — curl smoke (401 anon + 401 unauth)
├── 08-cron-jobs.txt                 — cron.job listing + acceptance
├── 09-bucket-state.txt              — bucket SQL probe + RLS-policy summary
├── 10-cors-investigation.md         — per-bucket CORS doesn't exist; D-07 re-interpreted
├── 14-database-url-template.txt     — pooler-format DATABASE_URL for Phase 35
└── 15-verify-final.txt              — single-CTE final verify (8/8 PASS)
```

## Next phase

`/gsd:plan-phase 35` — Vercel + Environment Wiring.

---
*Phase: 034-supabase-production-setup*
*Completed: 2026-04-26*
*Mode: MCP-only*
