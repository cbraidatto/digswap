---
phase: 034-supabase-production-setup
verified: 2026-04-26T00:00:00Z
status: passed
score: 8/8 must-haves verified
must_haves_satisfied: 8/8
requirements_satisfied: 8/8
requirements_deferred: 2/2 (DEP-SB-08, DEP-SB-09)
path_deviations_logged: 3
re_verification: false
---

# Phase 34: Supabase Production Setup — Verification Report

**Phase Goal (authoritative per CONTEXT.md):** Provision `digswap-prod` Supabase project (us-east-1, Free tier, isolated from dev), apply all 35 migrations via MCP-equivalent of `supabase db push --linked`, get Security Advisor green (zero ERROR findings), deploy 2 Edge Functions, confirm 3+ active pg_cron jobs, populate Vault with `trade_preview_project_url` + `trade_preview_publishable_key` (legacy JWT, 208 chars) before the next cron tick, create `trade-previews` bucket (public=false, RLS policies enforce per-user and per-trade access), and document the prod DATABASE_URL pooler format in `evidence/14-database-url-template.txt` for Phase 35 to consume. Stop at evidence artifacts — no Vercel env var writes.

**Verified:** 2026-04-26
**Status:** PASSED
**Re-verification:** No — initial verification
**Mode:** MCP-only execution (path deviation #1 from original CLI plan)

---

## Goal-Backward Walk

### Clause 1: digswap-prod project provisioned in us-east-1, isolated from dev

**Evidence:** `evidence/01-projects-list.txt` + `evidence/02-link-confirm.txt`
- Project ref: `swyfhpgerzvvmoswkjyt` (20-char alphanumeric)
- Dev project ref: `mrkgoucqcbqjhrdjcnpw` — distinct, confirmed different
- Region: us-east-1 (US East, N. Virginia) — matches D-01
- Tier: Free — matches D-02
- `evidence/15-verify-final.txt` CTE row: `DEP-SB-01: PASS — postgres on project ref swyfhpgerzvvmoswkjyt`

**Status: VERIFIED**

---

### Clause 2: All 35 migrations applied (MCP equivalent of supabase db push --linked; no drizzle-kit)

**Evidence:** `evidence/04-db-push.txt`
- Per-migration log: 35 sequential `apply_migration` calls, each returning `{"success":true}`
- Migrations 33 and 35 failed first attempt with PK collision on auto-generated version; both retried sequentially and succeeded
- Post-apply state: `mcp__supabase__list_migrations` returns 35 entries, all distinct
- All 35 names in log match the `supabase/migrations/` file list
- `evidence/15-verify-final.txt`: `DEP-SB-02: PASS — 35 migrations recorded in supabase_migrations.schema_migrations`
- No `drizzle-kit` invocation anywhere in the commit trail or evidence (all writes routed through MCP; ADR-003 honored)
- Path-deviation #1 documented in `evidence/00-path-deviation.md`: MCP `apply_migration` writes to the same `supabase_migrations.schema_migrations` table as `supabase db push`, ADR-003 fully honored

**Status: VERIFIED**

---

### Clause 3: Security Advisor green (zero ERROR findings, WARN advisory only)

**Evidence:** `evidence/05-security-advisor.json`
- `"ERROR": 0` — no blocking findings
- `"WARN": 50` — all advisory: 1 function_search_path_mutable, 2 extension_in_public, 1 materialized_view_in_api, 46 pg_graphql_anon_table_exposed
- `"tables_without_rls": 0` — critical check passes
- `"policies_with_missing_columns": 0` — critical check passes
- `satisfies_DEP_SB_03: true`

**Evidence:** `evidence/05b-rls-probe.txt`
- DO block executed under `SET LOCAL ROLE authenticated` with constructed JWT for non-existent uuid
- 4 RLS-locked tables probed (profiles, direct_messages, trade_requests, discogs_tokens)
- Result: `rls_probe_ok` returned; no RAISE EXCEPTION, no anon fallthrough

**Evidence:** `evidence/04-db-push.txt` post-apply state
- `mcp__supabase__list_tables` returns 42 tables in public, ALL with `rls_enabled=true`

**Note on 50 WARN findings:** All are advisory and exist in dev as well. None are "Tables without RLS" or "Policies with missing columns." Tracked as post-MVP tech debt.

**Status: VERIFIED**

---

### Clause 4: 2 Edge Functions deployed and invocable

**Evidence:** `evidence/07a-cleanup-deploy.log` + `evidence/07b-validate-deploy.log`
- `cleanup-trade-previews`: id `ee4f774a-2338-4bd4-8948-31fbf3ce423d`, version 1, status ACTIVE, verify_jwt=true
- `validate-preview`: id `ec55d000-0626-4cd5-8adc-0586c6236276`, version 1, status ACTIVE, verify_jwt=true
- Both deployed via MCP with `_shared/preview-rules.ts` and `_shared/responses.ts` bundled

**Evidence:** `evidence/07c-cleanup-curl.txt`
- `POST .../functions/v1/cleanup-trade-previews` with legacy anon JWT Bearer
- Response: `HTTP/1.1 200 OK` + body `{"deleted":0,"bucket":"trade-previews","updated":0}` — exact match to must_haves

**Evidence:** `evidence/07d-validate-curl.txt`
- Probe 1 (no auth): `HTTP/1.1 401` with `UNAUTHORIZED_NO_AUTH_HEADER`
- Probe 2 (anon JWT): `HTTP/1.1 401` with `UNAUTHORIZED_INVALID_JWT_FORMAT` (gateway-level rejection)

**Note:** Initial smoke test on cleanup failed with `401 UNAUTHORIZED_INVALID_JWT_FORMAT` when Vault held the modern `sb_publishable_*` key. Root cause: gateway with `verify_jwt=true` requires JWT format; the modern publishable key is an API key. Fixed by replacing with legacy anon JWT (208 chars). Correction documented in `evidence/06-vault-secrets.txt` and path-deviation #3.

**Status: VERIFIED**

---

### Clause 5: 3+ active pg_cron jobs under role postgres

**Evidence:** `evidence/08-cron-jobs.txt`

| jobid | jobname | schedule | active | username |
|-------|---------|----------|--------|----------|
| 1 | recalculate-rankings | `*/15 * * * *` | true | postgres |
| 2 | trade-preview-cleanup | `0 * * * *` | true | postgres |
| 3 | purge-soft-deleted-collection-items | `0 3 * * *` | true | postgres |

- Exactly 3 active jobs, all under role `postgres` (Pitfall #18 satisfied)
- `cleanup-stripe-event-log` was never scheduled (only commented in migration); correct behavior for free-tier MVP without Stripe
- `evidence/15-verify-final.txt`: `DEP-SB-05: PASS`

**Status: VERIFIED**

---

### Clause 6: Vault populated with both required secrets BEFORE next cron tick

**Evidence:** `evidence/06-vault-secrets.txt` (corrected version after Plan 04)

| name | secret_len |
|------|------------|
| trade_preview_project_url | 40 |
| trade_preview_publishable_key | 208 |

- `trade_preview_project_url` length 40 = `https://swyfhpgerzvvmoswkjyt.supabase.co` (40 chars) ✓
- `trade_preview_publishable_key` length 208 = legacy anon JWT (eyJhbGciOiJIUzI1NiI... format) ✓
- Vault populated at ~19:11 UTC; next `trade-preview-cleanup` tick: 20:00 UTC — ~49 min window, Pitfall #11 satisfied
- Decrypted values NOT written to evidence (length-only verification, no value disclosure)
- The 208-char length requirement is hard (must be legacy JWT for `verify_jwt=true` gateway): CONFIRMED

**Status: VERIFIED**

---

### Clause 7: trade-previews bucket (public=false, access governed by RLS on storage.objects)

**Evidence:** `evidence/09-bucket-state.txt`

| field | value |
|-------|-------|
| public | false |
| file_size_limit | 536870912 (512 MB) |
| mime_count | 10 |
| allowed_mime_types | audio/flac, audio/x-flac, audio/mpeg, audio/mp3, audio/wav, audio/x-wav, audio/aiff, audio/x-aiff, audio/ogg, application/ogg |
| created_at | 2026-04-26 18:47:04 (via migration M32) |

**CORS re-interpretation (path-deviation #2):** `evidence/10-cors-investigation.md` documents 3 probes proving per-bucket CORS does not exist in modern Supabase Storage:
1. `storage.buckets` schema has no CORS column
2. Schema-wide search for `*cors*`/`*origin*` tables returns zero rows
3. `mcp__supabase__get_storage_config` returns no CORS field

Resolution: D-07's intent ("lock down access to the bucket") is satisfied by the Storage RLS policies created by migration `20260417_trade_preview_infrastructure.sql`:
- `trade_previews_insert_owner`: only authenticated users uploading to a folder named after their own `auth.uid()` AND with a matching `collection_items` row they own
- `trade_previews_select_participant`: only trade participants (requester or provider) can SELECT, joining through `trade_proposal_items` → `trade_proposals` → `trade_requests`

These RLS rules are stronger than CORS (they enforce business invariants regardless of origin or transport; CORS only blocks browsers).

**48h TTL mechanism:** 3-piece wiring confirmed live:
1. `trade_proposal_items.preview_expires_at` column (set to now() + 48h on upload) — in migration M32
2. `trade-preview-cleanup` pg_cron job (hourly at :00) — ACTIVE per evidence/08
3. `cleanup-trade-previews` Edge Function — returns 200 per evidence/07c

**Status: VERIFIED (with path-deviation #2 accepted)**

---

### Clause 8: DATABASE_URL pooler template documented for Phase 35

**Evidence:** `evidence/14-database-url-template.txt`

Template line:
```
DATABASE_URL = postgresql://postgres.swyfhpgerzvvmoswkjyt:<DB_PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Token verification:
- `aws-0-us-east-1.pooler.supabase.com:6543` — present ✓
- `?pgbouncer=true` — present ✓
- `prepare: false` — present in the Drizzle config code block ✓

Password placeholder `<DB_PASSWORD>` confirmed — real password NOT in file, NOT in any commit.

**Status: VERIFIED**

---

### Clause 9: Stop at evidence artifacts — no Vercel env var writes

**Evidence:** Git diff of all Phase 34 commits (`13c3fc9..be682c8`) — files changed:
- `.planning/phases/034-supabase-production-setup/` tree (evidence, scripts, summaries)
- `.mcp.json` (MCP server config — project-scoped, no secrets)
- `.agents/skills/` (skill symlinks — dev tooling only)

**Zero touches to:**
- `apps/web/.env*` — not modified
- `vercel.json` — not modified
- Any `apps/` source file — not modified

The 9 commits in this phase touch only `.planning/`, `.mcp.json`, and `.agents/` — all infrastructure/evidence artifacts. Phase 35 boundary respected.

**Status: VERIFIED**

---

## Observable Truths Summary

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | `digswap-prod` project exists in us-east-1, isolated from dev | VERIFIED | evidence/01, 02, 15 |
| 2 | All 35 migrations applied via MCP (no drizzle-kit) | VERIFIED | evidence/04 — 35 `{"success":true}` entries |
| 3 | Security Advisor: 0 ERROR, 42 tables all RLS-enabled | VERIFIED | evidence/05-security-advisor.json |
| 4 | RLS machinery exercised under role=authenticated with JWT | VERIFIED | evidence/05b — `rls_probe_ok` |
| 5 | 2 Edge Functions ACTIVE, smoke-tested 200/401 | VERIFIED | evidence/07a-07d |
| 6 | 3 active pg_cron jobs under role postgres | VERIFIED | evidence/08 |
| 7 | Vault: 2 secrets, correct names, correct lengths (40+208) | VERIFIED | evidence/06 |
| 8 | `trade-previews` bucket: public=false, 10 MIME types, RLS policies on storage.objects | VERIFIED | evidence/09, 10 |
| 9 | DATABASE_URL template: all 3 required tokens, no real password | VERIFIED | evidence/14 |
| 10 | No Vercel env vars written (Phase 35 boundary respected) | VERIFIED | git diff 13c3fc9..be682c8 |

**Score: 10/10 observable truths verified (maps to 8/8 DEP-SB requirements)**

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| DEP-SB-01 | Separate `digswap-prod` project, never shares with dev | SATISFIED | evidence/01-02, 15 |
| DEP-SB-02 | All migrations via `supabase db push` equivalent (never drizzle-kit) | SATISFIED | evidence/04 (35/35 applied via MCP) |
| DEP-SB-03 | RLS green: Security Advisor zero ERROR, zero unprotected tables, zero broken policies | SATISFIED | evidence/05-security-advisor.json + 05b-rls-probe.txt |
| DEP-SB-04 | Edge Functions deployed (`cleanup-trade-previews`, `validate-preview`) | SATISFIED | evidence/07a-07d |
| DEP-SB-05 | pg_cron: 3+ active jobs (`COUNT(*) FROM cron.job WHERE active` = 3) | SATISFIED | evidence/08 |
| DEP-SB-06 | Vault: `trade_preview_project_url` + `trade_preview_publishable_key` | SATISFIED | evidence/06 (40c + 208c) |
| DEP-SB-07 | `trade-previews` bucket: CORS configured, 48h TTL, Public=off | SATISFIED (re-interpreted) | evidence/09 (public=false), 10 (CORS N/A, RLS stronger), cron+EF wiring (48h TTL) |
| DEP-SB-10 | DATABASE_URL uses PgBouncer pooler port 6543, `?pgbouncer=true`, `prepare: false` | SATISFIED | evidence/14 |

---

## Deferred Items Confirmed Not Claimed

| Requirement | Description | Deferred By | In Any `requirements-completed`? | Status |
|-------------|-------------|-------------|----------------------------------|--------|
| DEP-SB-08 | Supabase Pro tier + auto-pause off | CONTEXT.md D-03 (Free-tier launch decision) | NO — grep across all 5 plan SUMMARYs returns zero matches | CORRECTLY DEFERRED |
| DEP-SB-09 | PITR + rehearsed restore | CONTEXT.md D-05 (Free-tier launch decision) | NO — grep across all 5 plan SUMMARYs returns zero matches | CORRECTLY DEFERRED |

Both appear only in `034-SUMMARY.md` under `requirements_deferred` and in `evidence/15-verify-final.txt` under "Deferred (not validated this phase)." Neither appears in any plan's `requirements-completed` field. Deferred scope is clean.

---

## Path Deviations

All 3 deviations are properly documented and the `evidence/00-path-deviation.md` + `evidence/10-cors-investigation.md` + `evidence/06-vault-secrets.txt` correction note constitute the audit trail required for the phase record.

### Deviation 1: CLI → MCP-only execution mode

| Field | Value |
|-------|-------|
| Original plan | `supabase link` + `supabase db push --linked` + `supabase functions deploy` + `psql` |
| Actual | Project-scoped Supabase MCP at `https://mcp.supabase.com/mcp?project_ref=swyfhpgerzvvmoswkjyt` for all DDL/DML/Edge-Function/Storage operations |
| Rationale | DB password never enters AI/repo context; OAuth-scoped credentials pin to project_ref (Pitfall #4 impossible by construction); ADR-003 honored (same migrations table, same trail) |
| Evidence | `evidence/00-path-deviation.md` — full file-level CLI→MCP equivalence mapping |
| Goal impact | None — all 8 DEP-SB-* requirements satisfied; migration trail integrity preserved |

### Deviation 2: Per-bucket CORS → N/A (feature does not exist)

| Field | Value |
|-------|-------|
| Original plan | Configure CORS via Dashboard: `digswap.com.br` + `www.digswap.com.br` allow-list (D-07) |
| Actual finding | Per-bucket CORS is not a configurable setting in modern Supabase Storage; 3 SQL/MCP probes confirm: no CORS column on `storage.buckets`, no `*cors*`/`*origin*` tables, no CORS field in project-level Storage config |
| Resolution | D-07's intent ("lock down access") satisfied by Storage RLS policies `trade_previews_insert_owner` + `trade_previews_select_participant` on `storage.objects` — stronger than CORS (enforces business invariants, applies regardless of origin or transport) |
| Evidence | `evidence/10-cors-investigation.md` |
| Goal impact | None — access lockdown is stronger via RLS; CORS was a mechanism, not a goal |

### Deviation 3: Vault publishable_key format correction (sb_publishable_* → legacy anon JWT)

| Field | Value |
|-------|-------|
| Original plan (Plan 03) | Stored modern `sb_publishable_IeeRHNQVnO_06UUNfWdk_Q_cQAO5xXS` (46 chars) |
| Failure | Plan 04 smoke test returned `401 UNAUTHORIZED_INVALID_JWT_FORMAT` — gateway with `verify_jwt=true` requires JWT format; `sb_publishable_*` is an API key, not a JWT |
| Fix | Deleted modern entry, re-inserted legacy anon JWT (208 chars); cleanup smoke returns 200 with expected body |
| Evidence | `evidence/06-vault-secrets.txt` correction note + `evidence/07c-cleanup-curl.txt` showing 200 |
| Goal impact | None — DEP-SB-06 and DEP-SB-04 both satisfied after correction; cron pipeline wired end-to-end |

---

## Required Artifacts

| Artifact | Provided | Status | Notes |
|----------|----------|--------|-------|
| `scripts/verify.sh` | Wave 0 scaffolding harness | VERIFIED | Exists, executable, covers all 8 DEP-SB-* checks |
| `scripts/rls-probe.sql` | JWT-bound RLS probe | VERIFIED | Contains `SET ROLE authenticated` per must_haves |
| `scripts/drop-and-recreate.md` | Catastrophic halt runbook | VERIFIED | Contains `Pause project` — 5-step procedure |
| `evidence/04-db-push.txt` | Migration apply log | VERIFIED | 35 `{"success":true}` entries, 2 retry observations |
| `evidence/05-security-advisor.json` | Security Advisor verdict | VERIFIED | `{"ERROR": 0, "WARN": 50}`, `satisfies_DEP_SB_03: true` |
| `evidence/05b-rls-probe.txt` | RLS probe result | VERIFIED | `rls_probe_ok` returned, no fallthrough |
| `evidence/06-vault-secrets.txt` | Vault contents (corrected) | VERIFIED | 40c + 208c, correction note present |
| `evidence/07c-cleanup-curl.txt` | Cleanup Edge Function smoke | VERIFIED | `200 OK` + `{"deleted":0,"bucket":"trade-previews","updated":0}` |
| `evidence/07d-validate-curl.txt` | Validate Edge Function smoke | VERIFIED | `401` on no-auth + `401` on anon |
| `evidence/08-cron-jobs.txt` | pg_cron job listing | VERIFIED | 3 active rows under postgres role |
| `evidence/09-bucket-state.txt` | Bucket state probe | VERIFIED | `public=false`, 10 MIME types |
| `evidence/10-cors-investigation.md` | CORS investigation + D-07 re-interpretation | VERIFIED | 3 probes, conclusion, D-07 satisfaction matrix |
| `evidence/14-database-url-template.txt` | DATABASE_URL pooler template | VERIFIED | All 3 required tokens present, no real password |
| `evidence/15-verify-final.txt` | Final 8/8 verify CTE | VERIFIED | `8/8 in-scope DEP-SB-* requirements satisfied` |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `evidence/09-bucket-state.txt` lines 37-44 | States "CORS config awaiting user Dashboard action (next step)" — this was the state BEFORE Plan 04 ran; the file was NOT updated after the CORS N/A finding | Info | No impact — `evidence/10-cors-investigation.md` closes the gap; the stale note in 09 is a documentation artifact, not a correctness issue |

No blocker anti-patterns found. The stale CORS note in evidence/09 is superseded by evidence/10 and is correctly captured in the phase SUMMARY path-deviation log.

---

## Behavioral Spot-Checks

This phase is infrastructure (no runnable application code). All behavioral verification was done via MCP probes and curl against the live prod project. The evidence files ARE the spot-check results.

| Behavior | Evidence File | Result |
|----------|--------------|--------|
| cleanup-trade-previews returns 200 with expected JSON | evidence/07c | PASS — `HTTP/1.1 200` + `{"deleted":0,"bucket":"trade-previews","updated":0}` |
| validate-preview returns 401 to unauthenticated requests | evidence/07d | PASS — `HTTP/1.1 401 UNAUTHORIZED_NO_AUTH_HEADER` + `401 UNAUTHORIZED_INVALID_JWT_FORMAT` |
| 3 cron jobs active under postgres role | evidence/08 | PASS — 3 rows, all `active=true`, all `username=postgres` |
| 42 tables, all RLS-enabled | evidence/04 (post-apply probe) | PASS — `42 tables in public, ALL with rls_enabled=true` |
| Vault has exactly 2 required secrets at correct lengths | evidence/06 | PASS — `trade_preview_project_url: 40`, `trade_preview_publishable_key: 208` |
| DATABASE_URL template has all 3 required tokens | evidence/14 | PASS — verify grep documented inline |

---

## Human Verification Required

None for this phase. All goal clauses have direct evidence file support (JSON, text, curl output). No visual UI behavior or external service integration depends on human attestation for phase completion.

**Optional post-phase human verification (non-blocking for phase close):**

1. **Free-tier billing confirmation** — Dashboard view confirms project is on Free tier. This was deferred per CONTEXT.md D-03 (DEP-SB-08 deferred). Not required for phase pass.

2. **CORS origin enforcement (future)** — If a real attack vector emerges requiring HTTP-level origin lockdown, Vercel Edge Middleware or Cloudflare rules would need to be added (post-MVP per evidence/10-cors-investigation.md). Not required for phase pass.

---

## Gaps Summary

**No gaps.** All 8 in-scope DEP-SB-* requirements are satisfied with direct evidence. The 2 deferred requirements (DEP-SB-08, DEP-SB-09) are correctly out of scope per CONTEXT.md D-03/D-05. The 3 path deviations are fully documented. The phase boundary (no Vercel writes) is clean.

---

## Recommendations (Non-Blocking)

1. **evidence/09-bucket-state.txt stale CORS note** — Lines 37-44 still describe the "CORS config awaiting user Dashboard action" that was later found to be N/A. Consider updating the file with a reference to evidence/10 for future reader clarity. No functional impact.

2. **pg_graphql_anon_table_exposed (46 WARN)** — Post-MVP hardening: revoke anon SELECT on the most sensitive tables or move them to a non-graphql schema. Already tracked in `evidence/05-security-advisor.json` as post-MVP tech debt.

3. **function_search_path_mutable (1 WARN)** — `public.recalculate_rankings` needs `SET search_path = public, pg_temp` in its definition. Post-MVP fix.

4. **Doc-debt: digswap.com → digswap.com.br** — CONTEXT.md D-06 flagged this. ROADMAP.md, REQUIREMENTS.md, PROJECT.md still contain `digswap.com`. Recommended QUICK title: `domain rename: digswap.com → digswap.com.br across all .planning/ docs`. Non-blocking for Phase 34 but should be resolved before Phase 36 (DNS cutover).

5. **verify.sh remains CLI-dependent** — `scripts/verify.sh` was built for psql + curl invocation from a local CLI, but Phase 34 ran entirely via MCP. For Phase 38 re-verification in a CI/CD harness with `DATABASE_URL` available (after Phase 35 wires it), `verify.sh` will be runnable. In the meantime, `evidence/15-verify-final.txt` (SQL CTE) is the authoritative final check.

---

## Phase 35 Readiness

All Phase 35 inputs are captured:

| Input | Value | Source |
|-------|-------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://swyfhpgerzvvmoswkjyt.supabase.co` | evidence/01 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | legacy anon JWT, 208 chars (do not use sb_publishable_* for jwt-gated functions) | evidence/06, also in Vault |
| `DATABASE_URL` template | `postgresql://postgres.swyfhpgerzvvmoswkjyt:<DB_PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true` | evidence/14 |
| Drizzle config requirement | `prepare: false` | evidence/14 |
| `SUPABASE_SERVICE_ROLE_KEY` | NOT captured (auto-injected to Edge Functions; user copies from Dashboard → Settings → API → service_role secret) | TBD in Phase 35 |

---

*Verified: 2026-04-26*
*Verifier: Claude (gsd-verifier)*
