---
phase: 34
slug: supabase-production-setup
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 34 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `.planning/phases/034-supabase-production-setup/034-RESEARCH.md` §"Validation Architecture" (L806-L869).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — Phase 34 is infrastructure (Supabase prod provisioning), not application code. Verification is via `psql` + `curl` + Dashboard inspection, not vitest/playwright. |
| **Config file** | none — Wave 0 installs the verify scripts |
| **Quick run command** | `bash .planning/phases/034-supabase-production-setup/scripts/verify.sh` |
| **Full suite command** | Same — no separate "quick" vs "full" for an infra phase |
| **Estimated runtime** | ~30s for the full CLI/psql probe pass (manual screenshots excluded) |

---

## Sampling Rate

- **After every task commit:** Run the verification command for the requirement(s) the task addresses (subset of `verify.sh`).
- **After every plan wave:** Re-run `bash scripts/verify.sh` end-to-end and re-confirm screenshots in `evidence/`.
- **Before `/gsd:verify-work`:** Full suite must be green AND every mandatory `evidence/` artifact present (see Evidence-Capture Protocol in RESEARCH.md L854-L868).
- **Max feedback latency:** ~30 seconds.

---

## Per-Task Verification Map

> Plan/wave/task IDs are TBD — populated by gsd-planner. Requirement-level checks below are immutable from RESEARCH.md.

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| DEP-SB-01 | Separate `digswap-prod` project exists; ref distinct from dev | manual + CLI | `supabase projects list \| grep digswap-prod && [ "$(cat supabase/.temp/project-ref)" != "mrkgoucqcbqjhrdjcnpw" ]` | ❌ Wave 0 — `verify.sh` | ⬜ pending |
| DEP-SB-02 | All 35 migrations applied via `supabase db push --linked`; no drizzle-kit | CLI | `supabase migration list --linked \| wc -l` ≥ 35 AND `node scripts/drizzle-prod-guard.mjs` exits 0 | ❌ Wave 0 | ⬜ pending |
| DEP-SB-03 | Security Advisor green; RLS denies anon reads on RLS-locked tables under role `authenticated` with real JWT | manual (dashboard) + psql | dashboard screenshot + parameterized `scripts/rls-probe.sql` | ❌ Wave 0 — manual + scripted | ⬜ pending |
| DEP-SB-04 | `cleanup-trade-previews` and `validate-preview` Edge Functions deployed and invocable | curl | `curl -X POST .../functions/v1/cleanup-trade-previews` returns 200; `curl .../validate-preview` returns 401 (anon) | ❌ Wave 0 | ⬜ pending |
| DEP-SB-05 | ≥3 active pg_cron jobs (ranking, cleanup, purge — stripe-event-log dormant) | psql | `psql -c "SELECT COUNT(*) FROM cron.job WHERE active"` ≥ 3 | ❌ Wave 0 | ⬜ pending |
| DEP-SB-06 | Vault has both required secrets (`trade_preview_project_url`, `trade_preview_publishable_key`) | psql | `psql -c "SELECT name FROM vault.decrypted_secrets WHERE name IN ('trade_preview_project_url','trade_preview_publishable_key')"` returns 2 rows | ❌ Wave 0 | ⬜ pending |
| DEP-SB-07 | `trade-previews` bucket exists, public=false, CORS hard-coded to `digswap.com.br` + `www.digswap.com.br` | psql + dashboard | `psql -c "SELECT public FROM storage.buckets WHERE id='trade-previews'"` returns `f`; CORS dashboard screenshot | ❌ Wave 0 — manual + scripted | ⬜ pending |
| DEP-SB-10 | DATABASE_URL pooler template documented for Phase 35 (host `aws-0-us-east-1.pooler.supabase.com:6543`, `?pgbouncer=true`, `prepare: false`) | text inspection | grep three required tokens in `evidence/14-database-url-template.txt` | ❌ Wave 0 — text artifact | ⬜ pending |

**Deferred per CONTEXT.md (NOT validated this phase):**
- DEP-SB-08 — Pro tier + auto-pause off
- DEP-SB-09 — PITR + rehearsed restore

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `.planning/phases/034-supabase-production-setup/scripts/verify.sh` — orchestrates psql + curl probes, accepts `$PROD_REF`, `$PROD_DIRECT_URL`, `$PROD_ANON_KEY` from environment, emits single pass/fail summary
- [ ] `.planning/phases/034-supabase-production-setup/scripts/rls-probe.sql` — JWT-bound psql probe (RESEARCH.md §4 Step B), parameterized for re-use
- [ ] `.planning/phases/034-supabase-production-setup/scripts/drop-and-recreate.md` — short procedure for catastrophic halt cases (manual dashboard steps)
- [ ] `.planning/phases/034-supabase-production-setup/evidence/.gitkeep` — placeholder so `evidence/` exists in git tree
- [ ] Framework install: **none** (no test runner needed for an infra phase)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Project creation in `us-east-1` | DEP-SB-01 | No public API for project creation — Supabase Dashboard only | Dashboard → New Project → name `digswap-prod`, region `us-east-1` (US East — N. Virginia). Capture `evidence/01-projects-list.txt` afterward. |
| Security Advisor "green" verdict | DEP-SB-03 | Advisor lives in dashboard UI; CLI does not surface its verdict | Dashboard → Database → Advisors → run all checks, screenshot zero high/critical findings to `evidence/05-security-advisor.png` |
| CORS rules on `trade-previews` bucket | DEP-SB-07 | Storage CORS UI confidence is HIGH; CLI confidence is MEDIUM (per RESEARCH.md L893) | Dashboard → Storage → `trade-previews` → CORS tab; screenshot rules to `evidence/10-cors-dashboard.png` |
| Free-tier billing confirmation | DEP-SB-08 deferred (no-op this phase) | Dashboard view only | Skip — DEP-SB-08 deferred per CONTEXT.md D-03 |

---

## Validation Sign-Off

- [ ] Every plan task has `<acceptance_criteria>` mapped to one or more rows in the table above (or to a manual-only behavior)
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify command
- [ ] Wave 0 covers all MISSING references (`scripts/verify.sh`, `scripts/rls-probe.sql`, `scripts/drop-and-recreate.md`, `evidence/.gitkeep`)
- [ ] No watch-mode flags (Phase 34 has no test runner)
- [ ] Feedback latency < 30s (single `verify.sh` run)
- [ ] `nyquist_compliant: true` set in frontmatter once gsd-plan-checker passes

**Approval:** pending
