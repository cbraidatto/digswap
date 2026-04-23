# Phase 33 Audit Report

**Executed:** (fill during Wave 4)
**main HEAD at audit start:** 8762c232c65c5a66589d7902fe4fb3584e4a0bba (pre-Phase-33 tip plus 033-01 scaffolding)
**Verdict:** PENDING — execution in progress

## Checklist

- [~] DEP-AUD-01: CI gates — typecheck/test/build/audit PASS, lint DEBT (20 residual errors, deferred to 33.1)  — evidence/01*-*.txt
- [x] DEP-AUD-02: `supabase db reset` clean on local Docker AND throwaway Supabase Cloud (D-07 BLOCKING gate PASS) — evidence/02a-*.txt, evidence/02b-*.txt
- [ ] DEP-AUD-03: Cold-start curl — all 4 public routes 200 in <3s after idle      — evidence/03-*.txt
- [ ] DEP-AUD-04: Session revocation — logged-out JWT returns 401 within 60s       — evidence/04-*.txt
- [ ] DEP-AUD-05: Discogs tokens Vault-wrapped — zero plaintext rows               — evidence/05a-*.txt, evidence/05b-*.txt
- [ ] DEP-AUD-06: CSP re-confirmed — nonce-based header, zero violations on 5 routes — evidence/06*-*
- [ ] DEP-AUD-07: gitleaks scan — zero findings across full git history            — evidence/07-gitleaks.json
- [ ] DEP-AUD-08: Env inventory — all 21 vars have actionable prod-value source, zero `| TBD |` rows — §8 table below

## §1 DEP-AUD-01 CI Gates + Prod Audit

**Status:** PARTIAL (4/5 sub-gates PASS; lint deferred to 33.1)
**main HEAD:** 8762c232c65c5a66589d7902fe4fb3584e4a0bba
**Timestamp:** 2026-04-22T23:55:00Z (typecheck), ~00:15Z 2026-04-23 (lint/test/build/audit)

**Commands:**
```
pnpm --filter @digswap/web typecheck    # exit 0 (after fix — see Notes) — evidence/01a-typecheck.txt
pnpm --filter @digswap/web lint         # exit 1 (20 residual errors)    — evidence/01b-lint.txt
pnpm --filter @digswap/web test         # exit 0 (1568 pass, 4 skip)     — evidence/01c-test.txt
pnpm --filter @digswap/web build        # exit 0 (after env fix — Notes) — evidence/01d-build.txt
pnpm audit --prod --audit-level high    # exit 0 (8 moderate, 0 high)    — evidence/01e-audit.txt
```

**Tail excerpts:**
```
typecheck:
> tsc --noEmit

typecheck exit=0

lint:
Found 20 errors. Found 105 warnings. Found 2 infos.
lint exit=1

test:
Test Files  149 passed | 1 skipped (150)
Tests  1568 passed | 4 skipped | 7 todo (1579)
Duration  55.62s
test exit=0

build:
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
build exit=0

audit:
8 vulnerabilities found
Severity: 8 moderate
audit exit=0
```

### Findings (independent verification caught what CI claimed was green)

1. **Typecheck FAIL on main HEAD (BEFORE fix):** 40+ TypeScript errors in test files added 2026-04-14 (commit 524c872 "+880 tests"). Core issues: `tests/e2e/fixtures/auth.ts` had a broken `{ authedPage: typeof base }` type (cascaded to 24 errors across 8 e2e specs); `LeadStatus` never included `"interested"` used in 5 places; spread-to-`vi.fn` type errors, sort union narrowing, drizzle mock casting. Fixed in commit `e506d35` (7 files, 6 fixes) — typecheck now exits 0.

2. **Lint FAIL on main HEAD (135 errors, 123 warnings):** `biome check --write` autofixed 98 files + `--write --unsafe` on 3 targeted files. **20 residual errors** remained across source components (not autofixable):
   - 8 × noUnusedFunctionParameters
   - 6 × noExplicitAny (profile-hero, profile-sidebar)
   - 2 × noNonNullAssertion (wrapped.ts, trades components)
   - 1 × useParseIntRadix
   - 1 × useExhaustiveDependencies
   - 1 × noImgElement
   - 1 × useAriaPropsSupportedByRole
   
   **Plus** autofix reshuffles exposed additional errors after initial pass (formatter revealed noUnusedVariables, noSvgWithoutTitle, more noNonNullAssertion, etc.). Total lint debt exceeds D-16's 2h threshold — **deferred to decimal phase 33.1** per user decision.

3. **Build FAIL (BEFORE env fix):** `next build` requires `.env.local` populated with `HANDOFF_HMAC_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_APP_URL` (Zod env schema). User's `.env.local` was missing `NEXT_PUBLIC_APP_URL`. **Added to env file locally** (not committed); also flagged as DEP-AUD-08 input.

4. **Audit PASS:** 8 moderate vulnerabilities reported, zero high/critical. Passes `--audit-level high` threshold.

**Verdict:** PARTIAL — typecheck/test/build/audit PASS after inline fixes; lint has 20 residual errors deferred to Phase 33.1. This audit did what DEP-AUD-01 was designed to do — caught that commit `35ed595` "fix: resolve all pre-deploy blockers" left typecheck + lint broken.

## §2 DEP-AUD-02 Supabase Migration Reset

**Status:** PASS — Audit 2a (local Docker) AND Audit 2b (throwaway Supabase Cloud — D-07 BLOCKING gate) both clean

**Local reset command:** `pnpm dlx supabase start` + `supabase db reset`
**Local result:** `Finished supabase db reset on branch main.` · reset exit=0 · evidence/02a-reset.txt

**Cloud sequence:** `projects create --org-id waevgaqloxyszeutagko --region us-east-1` → `link --project-ref dfgcarnjahflocnsdhxs` → `db push --linked --yes` → `db reset --linked --yes` → `projects delete`
**Cloud project:** `digswap-audit-20260422-2215` (ref `dfgcarnjahflocnsdhxs`), East US (North Virginia), free-tier default size
**Cloud results:**
- create exit=0 (evidence/02b-create.txt)
- link exit=0 (evidence/02b-link.txt) — paranoia marker `●` confirmed on throwaway, NOT on `vinyldig` dev project
- push exit=0 (evidence/02b-push.txt) — `Finished supabase db push.` with 40 migrations applied
- reset exit=0 (evidence/02b-reset.txt) — `Finished supabase db reset` — **D-07 BLOCKING gate PASSED**
- delete exit=0 (evidence/02b-delete.txt) — `Deleted project: digswap-audit-20260422-2215`, post-delete `projects list` shows only `vinyldig`

**Teardown proof:** evidence/02b-teardown.txt (user visually confirmed via dashboard screenshot pasted inline 2026-04-23; PNG file skipped — dashboard state matches the CLI `DELETE CONFIRMED` automatic check)
**Verdict:** PASS — SYSTEMIC #0 drift resolved end-to-end; the 40-migration trail applies cleanly on both local and cloud.

### Findings (layered — each fix revealed a deeper issue)

**Layer 1 — migration ordering bug (FIRST ATTEMPT):**
`supabase/migrations/030_purge_soft_deleted.sql` sorts lexicographically BEFORE the `20260327_*` files. Per the D-03 decision, drizzle is supposed to create base tables — but `supabase db reset` only replays files in `supabase/migrations/`, never touching `drizzle/`. So `030_*` tried to `ALTER TABLE collection_items ADD COLUMN deleted_at` on an empty database. First failure:
```
Applying migration 030_purge_soft_deleted.sql...
ERROR: relation "collection_items" does not exist (SQLSTATE 42P01)
```

**Layer 2 — architectural misread of ADR-003 (CONSOLIDATION ATTEMPT):**
Copied drizzle/0000–0005 into `supabase/migrations/` with pre-dated prefixes (`20260101_drizzle_0000_*.sql` … `20260106_drizzle_0005_*.sql`) and renamed `030_purge_soft_deleted.sql` → `20260419_purge_soft_deleted.sql`. This closed Layer 1 — migrations 20260101–20260105 applied OK — but the next migration (0004 GIN indexes) failed:
```
Applying migration 20260105_drizzle_0004_gin_indexes.sql...
ERROR: CREATE INDEX CONCURRENTLY cannot be executed within a pipeline (SQLSTATE 25001)
CREATE INDEX CONCURRENTLY IF NOT EXISTS releases_style_gin_idx
```
Supabase CLI wraps migrations in a transaction; `CREATE INDEX CONCURRENTLY` cannot run in transactions. **Fixed inline** — removed `CONCURRENTLY` keyword (moot on empty DB).

**Layer 3 — schema drift beyond drizzle (OPEN, escalated to 33.1):**
After the index fix, next failure was:
```
Applying migration 20260328_leads_rls.sql...
ERROR: relation "leads" does not exist (SQLSTATE 42P01)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY
```
The `leads` table is defined in `apps/web/src/lib/db/schema/leads.ts` (TypeScript Drizzle schema) but **does not appear in any drizzle/*.sql or supabase/migrations/*.sql file**. It was clearly created on the dev Supabase project via direct `drizzle-kit push` without generating a migration. **Dev and prod schema have diverged silently from the committed SQL trail.**

This is almost certainly not isolated to `leads`. Each subsequent `db reset` attempt would reveal the next missing table/column via `ERROR: relation X does not exist`. Repeating this whack-a-mole inside Plan 03 exceeds D-16's 2h threshold.

### Impact on ADR-003

ADR-003 claims `supabase/migrations/` is the "sole authoritative trail for production" — this claim is **false as of 2026-04-22**. `drizzle-kit push` has been used against the dev Supabase project to materialize schemas (notably `leads`) that were never reconciled back into either trail. ADR-003 describes the *intended* state, not the *actual* state.

### Migration fixes landed in this plan (partial progress)

- `supabase/migrations/20260101_drizzle_0000_initial.sql` (new — copy of drizzle/0000)
- `supabase/migrations/20260102_drizzle_0001_groups_slug.sql` (new)
- `supabase/migrations/20260103_drizzle_0002_profile_showcase.sql` (new)
- `supabase/migrations/20260104_drizzle_0003_trade_tos.sql` (new)
- `supabase/migrations/20260105_drizzle_0004_gin_indexes.sql` (new — CONCURRENTLY stripped)
- `supabase/migrations/20260106_drizzle_0005_stripe_event_log.sql` (new)
- `supabase/migrations/20260419_purge_soft_deleted.sql` (renamed from `030_purge_soft_deleted.sql`)

These close Layers 1 and 2 but NOT Layer 3. Reset still fails on the first dev-only table (`leads`).

### Deferred to Phase 33.1

1. Regenerate Drizzle migrations: `drizzle-kit generate` against current schema to capture `leads` and any other tables/columns missing from the SQL trail
2. Merge those newly-generated Drizzle migrations into `supabase/migrations/` with appropriate timestamps
3. Walk all `supabase/migrations/*.sql` files that reference tables NOT in the current SQL trail — document, add or drop each
4. Re-run `supabase db reset` until it completes with zero ERROR/FATAL
5. Then repeat on the throwaway Supabase Cloud project (D-07 gate)
6. Revise ADR-003 to either (a) document drizzle-first deploy sequence or (b) commit to the consolidation post-33.1
7. Close DEP-AUD-02 as PASS

**Estimated effort for 33.1 DEP-AUD-02 portion:** 4–8 hours depending on how many hidden tables/columns exist.

### Resolution landed 2026-04-23 (commit 090bdcc)

Local gate ultimately resolved inline inside this plan (against the earlier "deferred to 33.1" call). Seven distinct drift categories surfaced and were fixed:

| # | Symptom | Root cause | Fix |
|---|---------|------------|-----|
| 1 | `ERROR: relation "collection_items" does not exist` on 030_purge_soft_deleted.sql | Lexical ordering + drizzle-only base schema | Copied drizzle/0000–0005 into supabase/migrations with pre-dated prefixes; renamed 030_* to 20260419_* |
| 2 | `CREATE INDEX CONCURRENTLY cannot be executed within a pipeline` | Supabase CLI wraps migrations in a transaction | Removed CONCURRENTLY keyword from 20260105_drizzle_0004_gin_indexes.sql |
| 3 | `ERROR: relation "leads" does not exist` | `leads` only existed on dev Supabase via ad-hoc drizzle-kit push | Created leads + 5 other drift tables in new 20260107_drift_capture_missing_tables.sql |
| 4 | `policy "backup_codes_select_own" already exists` | Drizzle/0000 already creates the policy; 20260405 tried to create it again | Prepended `DROP POLICY IF EXISTS` to every CREATE POLICY in 20260405 (later superseded by #6) |
| 5 | `ERROR: duplicate key value violates unique constraint "schema_migrations_pkey"` | Two files share the same `20260401_` version prefix (trade_messages.sql + trade_presence_rpc.sql) | Renamed 20260401, 20260406, 20260409, 20260416 duplicate-prefix files to 14-digit timestamps (format `YYYYMMDDHHMMSS`) |
| 6 | `ERROR: column "invited_by" does not exist` (group_invites), then `column "created_by" does not exist` (groups) | 20260405 policies reference columns that never existed — the migration is out-of-sync with the schema | Archived 20260405 to .planning/phases/033-pre-deploy-audit-gate/deprecated-migrations/; added explicit policies for drift tables to 20260107 |
| 7 | `ERROR: column "open_for_trade" does not exist` on 20260409000002 | 20260415_open_for_trade_and_rating.sql adds the column five dates AFTER 20260409 uses it | Moved 20260415 earlier to 20260405000000 |

Also: `discogs_tokens` is a ghost table — referenced in `apps/web/src/lib/discogs/oauth.ts` but NOT present in drizzle/*.ts schema nor any SQL migration. Inferred schema from `.upsert()` call and added to drift-capture migration.

**ADR-003 is still false as a statement about history.** `supabase/migrations/` was not authoritative as of 2026-04-22; it became authoritative via this plan's work. A 33.1 task should revise ADR-003 to reflect the new state (supabase/migrations now includes a drift-capture migration, drizzle/* is still useful for schema diffing but not as a separate trail).

**Audit 2b (throwaway cloud — D-07 BLOCKING gate) has NOT been attempted yet.** It requires the Task 2 checkpoint (operator runs `supabase login` and captures SUPABASE_ORG_ID) before Task 3's automated provision/link/reset/teardown can run.

## §3 DEP-AUD-03 Cold-Start Public Routes (LOCAL ONLY per D-08)

**Status:** pending
**Command:** (populated in Plan 04)
**Routes tested:** /, /signin, /signup, /pricing
**Results:** —
**Verdict:** —

## §4 DEP-AUD-04 Session Revocation E2E

**Status:** pending
**Command:** (populated in Plan 04)
**Pre-logout status:** —
**Post-logout status:** —
**Elapsed ms:** —
**Verdict:** —

## §5 DEP-AUD-05 Discogs Tokens via Supabase Vault

**Status:** pending
**Project queried:** dev Supabase (not prod — see D-06 scope)
**plaintext_count:** —
**vault_count:** —
**Verdict:** —

## §6 DEP-AUD-06 CSP Re-Confirmation

**Status:** pending
**Header sample:** (populated in Plan 06)
**Routes with zero violations:** —
**Verdict:** —

## §7 DEP-AUD-07 Git History Secret Scan

**Status:** pending
**Command:** (populated in Plan 07)
**Findings count:** —
**Verdict:** —

## §8 DEP-AUD-08 Environment Variable Inventory

**Status:** pending
**Source:** apps/web/.env.local.example (21 required + 4 optional variables)

| # | Variable | Domain | Scope | Source of prod value | Secret? | Assigned (Y/N) |
|---|----------|--------|-------|----------------------|---------|----------------|
| — | (populated in Plan 08 from RESEARCH.md §Audit 8 table) | — | — | TBD | — | N |

**Verdict:** —

---

## Sign-Off

All 8 checks must show a verdict of PASS (or explicit documented acceptance) and `grep -c '| TBD |' AUDIT-REPORT.md` must return 0 before Phase 34 can begin.

**Signed-off:** (Wave 4)
