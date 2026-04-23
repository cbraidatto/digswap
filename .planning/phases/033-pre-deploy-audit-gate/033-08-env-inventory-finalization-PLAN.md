---
phase: 033-pre-deploy-audit-gate
plan: 08
type: execute
wave: 4
depends_on: [033-01, 033-02, 033-03, 033-04, 033-05, 033-06, 033-07]
files_modified:
  - .planning/phases/033-pre-deploy-audit-gate/evidence/08a-vars-found.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/08b-var-count.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/08c-tbd-count.txt
  - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
autonomous: true
requirements: [DEP-AUD-08]

must_haves:
  truths:
    - "Every variable in apps/web/.env.local.example is represented as a row in AUDIT-REPORT.md §8"
    - "Every non-optional row has an actionable Source of prod value (Supabase / Stripe / openssl / Upstash / Resend / Sentry / Discogs / deterministic / static)"
    - "Zero `| TBD |` literal rows remain in AUDIT-REPORT.md (grep returns 0)"
    - "All 8 DEP-AUD-* checkboxes in AUDIT-REPORT.md are flipped to [x]"
    - "Top-of-file **Verdict:** line is GREEN — all 8 checks pass"
    - "**Executed:** line populated with ISO8601 date"
    - "Sign-off section populated (Wave 4 signature)"
  artifacts:
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/08a-vars-found.txt"
      provides: "Auto-extracted list of every env var from .env.local.example"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/08b-var-count.txt"
      provides: "Total count of env vars in .env.local.example (sanity check vs inventory table)"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/08c-tbd-count.txt"
      provides: "Count of `| TBD |` literal rows in AUDIT-REPORT.md (phase-exit gate — must be 0)"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md"
      provides: "Final phase deliverable — all 8 sections populated, verdict GREEN, sign-off complete"
      contains: "Verdict: GREEN"
  key_links:
    - from: "apps/web/.env.local.example"
      to: "AUDIT-REPORT.md §8 inventory table"
      via: "Every var in the example file becomes a table row with prod-value source column"
      pattern: "NEXT_PUBLIC_SUPABASE_URL"
    - from: "AUDIT-REPORT.md §§1–7 (per-check verdicts)"
      to: "AUDIT-REPORT.md top-of-file Verdict line"
      via: "Top verdict summarizes the 8 individual section verdicts"
      pattern: "Verdict: GREEN"
---

<objective>
Wave 4 synthesizes the entire Phase 33 audit. Two jobs in one plan because they share a single file (AUDIT-REPORT.md) and must commit together as the phase exit gate:

1. **DEP-AUD-08 env inventory** — generate the 21-row (25 including optional) table in AUDIT-REPORT.md §8 mapping every var in `apps/web/.env.local.example` to its prod-value source (Supabase / Stripe / openssl / Upstash / Resend / Sentry / Discogs / deterministic / static). Per D-15, zero `| TBD |` rows must remain before Phase 34 can start.
2. **AUDIT-REPORT.md finalization** — flip the top-of-file **Verdict:** from `PENDING — execution in progress` to `GREEN — all 8 checks pass`, populate the **Executed:** date, populate the **Sign-Off** section. Confirm all 8 DEP-AUD-* checkboxes are `[x]` (set by Plans 02–07) and all 8 section verdicts are `PASS`.

Purpose: D-17 locks the exit gate — Phase 34 does not start until AUDIT-REPORT.md shows all 8 green. This plan produces that artifact and the phase-exit machine-checkable evidence (`grep -c '| TBD |' AUDIT-REPORT.md` = 0).

Output: 3 evidence files (08a, 08b, 08c), a fully-populated AUDIT-REPORT.md, and phase-exit certainty.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/033-pre-deploy-audit-gate/033-CONTEXT.md
@.planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md
@.planning/phases/033-pre-deploy-audit-gate/033-VALIDATION.md
@.planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
@apps/web/.env.local.example

<interfaces>
<!-- Env var inventory verified 2026-04-21 against apps/web/.env.local.example: 25 vars total -->
<!-- 21 non-optional (must have a prod value) + 4 optional (YOUTUBE_API_KEY, SYSTEM_USER_ID, NEXT_PUBLIC_MIN_DESKTOP_VERSION defaults to static "1", RESEND_FROM_EMAIL is deterministic from domain) -->
<!-- Full source-of-value matrix: RESEARCH.md §Audit 8 -->
<!-- Inventory Columns: # | Variable | Domain | Scope (Public/Server) | Source of prod value | Secret? | Assigned (Y/N) -->
<!-- "Assigned (Y/N)" stays "N" for Phase 33 — flipped to "Y" in Phases 34-37 when Vercel vars are populated -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Auto-extract env vars from .env.local.example and populate AUDIT-REPORT.md §8 inventory table</name>
  <files>
    .planning/phases/033-pre-deploy-audit-gate/evidence/08a-vars-found.txt
    .planning/phases/033-pre-deploy-audit-gate/evidence/08b-var-count.txt
    .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
  </files>
  <read_first>
    - apps/web/.env.local.example (source of truth — 25 var lines confirmed 2026-04-21)
    - .planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md §Audit 8 (21-row inventory template with source-of-value column — copy this exactly)
    - .planning/phases/033-pre-deploy-audit-gate/033-CONTEXT.md (D-15 — "zero TBD rows before exit")
    - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md (current §8 skeleton from Plan 01)
  </read_first>
  <action>
Generate the env var list mechanically, then populate AUDIT-REPORT.md §8 with the 25-row inventory table using the exact template from RESEARCH.md §Audit 8.

**Step 1 — Auto-extract vars from the example file:**

```bash
# Every line matching VAR_NAME=... (comments and blank lines excluded)
grep -E '^[A-Z_][A-Z_0-9]*=' apps/web/.env.local.example \
  | awk -F= '{print $1}' \
  | tee .planning/phases/033-pre-deploy-audit-gate/evidence/08a-vars-found.txt

# Count them
grep -cE '^[A-Z_][A-Z_0-9]*=' apps/web/.env.local.example \
  | tee .planning/phases/033-pre-deploy-audit-gate/evidence/08b-var-count.txt

# Expected: 25 total (21 non-optional + 4 optional per CONTEXT.md / RESEARCH.md)
```

**Step 2 — Replace AUDIT-REPORT.md §8 skeleton with the full inventory table.**

Read the current `.planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md`. Find the `## §8 DEP-AUD-08 Environment Variable Inventory` section and replace its entire body (from `**Status:** pending` through the placeholder `| — | (populated in Plan 08 ...)` row up to `**Verdict:** —`) with this exact block:

```markdown
## §8 DEP-AUD-08 Environment Variable Inventory

**Status:** PASS
**Source:** `apps/web/.env.local.example` (25 variables: 21 non-optional + 4 optional)
**Timestamp:** <ISO8601 of when this table was populated>

**Source-of-value legend:**
- Supabase = Supabase Dashboard → prod project → Project Settings / Database
- Stripe = Stripe Dashboard → Developers / Products
- openssl = `openssl rand -hex 32` on dev machine (NEVER reuse dev value)
- Upstash = Upstash Console → prod Redis database
- Resend = Resend Dashboard → API Keys / Domains
- Sentry = Sentry Dashboard → prod project → Client Keys / Auth Tokens
- Discogs = Discogs Developer Settings → prod app
- Deterministic = derived from prod domain (e.g. `https://<domain>`)
- Static = constant literal set once (e.g. `1`)

| # | Variable | Domain | Scope | Source of prod value | Secret? | Assigned (Y/N) |
|---|----------|--------|-------|----------------------|---------|----------------|
| 1 | NEXT_PUBLIC_SUPABASE_URL | Supabase | Public | Supabase Dashboard → prod project → Project Settings → API → URL | No | N |
| 2 | NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Supabase | Public | Supabase Dashboard → prod project → Project Settings → API → anon/publishable key | No | N |
| 3 | SUPABASE_SERVICE_ROLE_KEY | Supabase | Server | Supabase Dashboard → prod project → Project Settings → API → service_role key (mask in screenshots) | **YES** | N |
| 4 | DATABASE_URL | Supabase | Server | Supabase Dashboard → prod project → Database → Connection Pooling → Transaction (port 6543) — with password (see DEP-SB-10) | **YES** | N |
| 5 | NEXT_PUBLIC_SITE_URL | App | Public | Deterministic: `https://<prod-domain>` (set after Phase 36 DNS cutover) | No | N |
| 6 | NEXT_PUBLIC_APP_URL | App | Public | Deterministic: same as NEXT_PUBLIC_SITE_URL for v1.4 | No | N |
| 7 | STRIPE_SECRET_KEY | Stripe | Server | Stripe Dashboard → Developers → API keys → Secret key (Live mode) — `sk_live_*` (Phase 37 DEP-INT-01) | **YES** | N |
| 8 | STRIPE_WEBHOOK_SECRET | Stripe | Server | Stripe Dashboard → Developers → Webhooks → `https://<domain>/api/stripe/webhook` endpoint → Signing secret (`whsec_live_*`) — Phase 37 DEP-INT-02 | **YES** | N |
| 9 | NEXT_PUBLIC_STRIPE_PRICE_MONTHLY | Stripe | Public | Stripe Dashboard → Products → Monthly plan → Pricing → Live-mode Price ID (`price_*`) — Phase 37 DEP-INT-03 | No | N |
| 10 | NEXT_PUBLIC_STRIPE_PRICE_ANNUAL | Stripe | Public | Stripe Dashboard → Products → Annual plan → Live-mode Price ID — Phase 37 DEP-INT-03 | No | N |
| 11 | NEXT_PUBLIC_SENTRY_DSN | Sentry | Public | Sentry Dashboard → prod project → Settings → Client Keys (DSN) — Phase 39 DEP-MON-01 | No | N |
| 12 | SENTRY_ORG | Sentry | Server | Sentry Dashboard → org slug (from URL) — Phase 39 DEP-MON-01 | No | N |
| 13 | SENTRY_PROJECT | Sentry | Server | Sentry Dashboard → prod project slug — Phase 39 DEP-MON-01 | No | N |
| 14 | SENTRY_AUTH_TOKEN | Sentry | Server | Sentry Dashboard → Settings → Auth Tokens → create with `project:releases` scope — Phase 39 DEP-MON-01 | **YES** | N |
| 15 | UPSTASH_REDIS_REST_URL | Upstash | Server | Upstash Console → prod Redis database → REST API → URL | No | N |
| 16 | UPSTASH_REDIS_REST_TOKEN | Upstash | Server | Upstash Console → prod Redis database → REST API → Read-write token | **YES** | N |
| 17 | DISCOGS_CONSUMER_KEY | Discogs | Server | Discogs Developer Settings → prod app → Consumer Key — Phase 37 DEP-INT-04 | No | N |
| 18 | DISCOGS_CONSUMER_SECRET | Discogs | Server | Discogs Developer Settings → prod app → Consumer Secret — Phase 37 DEP-INT-04 | **YES** | N |
| 19 | IMPORT_WORKER_SECRET | App | Server | openssl: `openssl rand -hex 32` on dev machine (NEVER reuse dev value) — Phase 35 DEP-VCL-06 | **YES** | N |
| 20 | HANDOFF_HMAC_SECRET | App | Server | openssl: `openssl rand -hex 32` on dev machine (NEVER reuse dev value) — Phase 35 DEP-VCL-06 | **YES** | N |
| 21 | RESEND_API_KEY | Resend | Server | Resend Dashboard → API Keys → create "DigSwap prod" key with `sending` scope — Phase 37 DEP-INT-07 | **YES** | N |
| 22 | RESEND_FROM_EMAIL | Resend | Server | Deterministic: `noreply@<prod-domain>` — Phase 37 DEP-INT-07 | No | N |
| 23 | YOUTUBE_API_KEY | Optional | Server | N/A — optional (blank if YouTube preview feature not used) | No | N |
| 24 | SYSTEM_USER_ID | Optional | Server | N/A — optional (generated at first run) | No | N |
| 25 | NEXT_PUBLIC_MIN_DESKTOP_VERSION | App | Public | Static: `1` for v1.4 | No | N |

**Notes:**
- "Assigned (Y/N)" stays "N" across all rows for Phase 33. It flips to "Y" in Phases 34–37 (Supabase / Vercel / Integrations) as the actual Vercel env vars are populated per DEP-VCL-02.
- Phase 33's scope is only: "is there a known, actionable source for each value?" — NOT "is the value in Vercel yet?"
- 7 vars carry the `NEXT_PUBLIC_` prefix (rows 1, 2, 5, 6, 9, 10, 11, 25 = 8 counted). This matches DEP-VCL-05's allowlist; Phase 35 mechanically grep-checks `.next/static/` for leaked secrets per Pitfall #1.

**Verdict:** PASS — all 25 variables mapped to an actionable source; zero `TBD` entries.
```

**Step 3 — Flip the DEP-AUD-08 checkbox** at the top of AUDIT-REPORT.md:

```
- [ ] DEP-AUD-08: Env inventory — ...
```

becomes

```
- [x] DEP-AUD-08: Env inventory — ...
```

**Step 4 — Sanity-check the changes:**

```bash
# No more TBD rows
grep -c '| TBD |' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md \
  | tee .planning/phases/033-pre-deploy-audit-gate/evidence/08c-tbd-count.txt
# Expected first line: 0

# 25 inventory rows
grep -c '^| [0-9]* |' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
# Expected: 25

# DEP-AUD-08 is now checked
grep -c '^- \[x\] DEP-AUD-08' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
# Expected: 1
```

**If failing (per D-16):** If the inventory generator finds a var in `.env.local.example` that isn't in the table above, add a new row with a researched source (not `TBD`). If a table row has no corresponding var in the example file, drop the row. Fix time: <15 min.
  </action>
  <verify>
    <automated>test -f .planning/phases/033-pre-deploy-audit-gate/evidence/08a-vars-found.txt && [ "$(head -1 .planning/phases/033-pre-deploy-audit-gate/evidence/08b-var-count.txt | tr -d '[:space:]')" = "25" ] && [ "$(grep -c '| TBD |' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md)" = "0" ] && [ "$(grep -c '^- \[x\] DEP-AUD-08' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md)" = "1" ] && [ "$(grep -c '^| [0-9]* |' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md)" -ge "25" ] && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `evidence/08a-vars-found.txt` exists and contains at least the string `NEXT_PUBLIC_SUPABASE_URL`
    - `evidence/08b-var-count.txt` first line is `25` (the total count from `.env.local.example`)
    - `evidence/08c-tbd-count.txt` first line is `0`
    - `grep -c '| TBD |' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md` outputs `0`
    - AUDIT-REPORT.md contains at least 25 numbered inventory rows (`grep -c '^| [0-9]* |'` returns ≥ 25)
    - AUDIT-REPORT.md §8 Status line is `PASS`
    - AUDIT-REPORT.md §8 Verdict line is `PASS — all 25 variables mapped to an actionable source; zero \`TBD\` entries.`
    - AUDIT-REPORT.md §8 table contains row for every var found in `.env.local.example` (checked by substring match for each var name)
    - AUDIT-REPORT.md §8 contains source-of-value legend with all 9 categories (Supabase, Stripe, openssl, Upstash, Resend, Sentry, Discogs, Deterministic, Static)
    - `grep -c '^- \[x\] DEP-AUD-08' AUDIT-REPORT.md` returns 1
  </acceptance_criteria>
  <done>§8 inventory table fully populated with 25 rows and actionable sources; zero TBD entries; DEP-AUD-08 checkbox flipped.</done>
</task>

<task type="auto">
  <name>Task 2: Finalize AUDIT-REPORT.md — flip top-of-file verdict to GREEN, populate Executed/Sign-Off</name>
  <files>
    .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md (confirm §1–§8 all show PASS from Plans 02–08 Task 1)
    - .planning/phases/033-pre-deploy-audit-gate/evidence/00-head.txt (main HEAD sha captured in Plan 02)
    - .planning/phases/033-pre-deploy-audit-gate/033-CONTEXT.md (D-17 — exit gate for Phase 34)
    - .planning/phases/033-pre-deploy-audit-gate/033-VALIDATION.md §Validation Sign-Off (final checklist)
  </read_first>
  <action>
Final synthesis. Confirm every section is green, then flip the top-of-file metadata.

**Step 1 — Pre-flight: confirm all 8 sections show PASS.**

```bash
# All 8 checkboxes must be [x]
CHECKED=$(grep -c '^- \[x\] DEP-AUD-' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md)
UNCHECKED=$(grep -c '^- \[ \] DEP-AUD-' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md)
echo "checked=$CHECKED unchecked=$UNCHECKED"
# REQUIRED: checked=8 unchecked=0

# All 8 section Status lines must be PASS
STATUS_PASS=$(grep -c '^\*\*Status:\*\* PASS' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md)
echo "status_pass=$STATUS_PASS"
# REQUIRED: status_pass=8

# No TBD rows
TBD=$(grep -c '| TBD |' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md)
echo "tbd=$TBD"
# REQUIRED: tbd=0
```

If any of those fail, STOP and escalate — the phase cannot be finalized. The preceding plans (02–07) or Task 1 of this plan left work undone. Identify which section is not PASS and either (a) re-run the responsible plan, or (b) open a decimal phase 33.N for that specific gap per D-16.

**Step 2 — Update the top-of-file header block.** Read AUDIT-REPORT.md and replace the header block (from `# Phase 33 Audit Report` to the line before `## Checklist`) with this exact content, substituting real values:

```markdown
# Phase 33 Audit Report

**Executed:** <ISO8601 date-only, e.g. 2026-04-21 — day finalization runs>
**main HEAD at audit start:** <sha from evidence/00-head.txt, unchanged from Plan 02>
**Verdict:** GREEN — all 8 checks pass

```

Do NOT touch the `## Checklist` block (Plans 02–07 and Task 1 flipped each checkbox). Do NOT touch §1–§8 (populated by earlier plans).

**Step 3 — Populate the Sign-Off section** at the bottom of the file. Replace the existing `## Sign-Off` block with:

```markdown
---

## Sign-Off

All 8 checks show verdict `PASS`. `grep -c '| TBD |' AUDIT-REPORT.md` returns `0`. Phase 34 (Supabase Production Setup) unblocked per D-17.

**Signed-off:** <ISO8601 date, Wave 4 finalization>
**main HEAD at sign-off:** <current HEAD sha — may differ from `main HEAD at audit start` if fail-inline fixes landed during the phase>

| # | Check | Evidence | Verdict |
|---|-------|----------|---------|
| 1 | DEP-AUD-01 CI gates + prod audit | evidence/01*-*.txt | PASS |
| 2 | DEP-AUD-02 Migration reset (local + cloud) | evidence/02a-*.txt, evidence/02b-*.txt, evidence/02b-teardown.png | PASS |
| 3 | DEP-AUD-03 Cold-start curl (4 public routes) | evidence/03-*.txt | PASS |
| 4 | DEP-AUD-04 Session revocation E2E | evidence/04-*.txt | PASS |
| 5 | DEP-AUD-05 Discogs tokens via Vault | evidence/05a-*.txt, evidence/05b-*.txt | PASS |
| 6 | DEP-AUD-06 CSP re-confirmation | evidence/06a-*.txt, evidence/06b-*.txt, evidence/06c-*.png | PASS |
| 7 | DEP-AUD-07 Git history secret scan | evidence/07-gitleaks.json, evidence/07-gitleaks-stdout.txt | PASS |
| 8 | DEP-AUD-08 Env inventory (25 vars) | evidence/08a-*.txt, AUDIT-REPORT.md §8 | PASS |

**Phase 34 prerequisites satisfied:**
- SYSTEMIC #0 drift closed (orphan deleted, ADR-003 committed, prod-guard wired)
- Migration trail proven replayable from empty DB (local Docker + throwaway cloud)
- Cold-start local proof captured (Vercel proof deferred to Phase 38 per D-09)
- Session revocation path proven via Playwright spec (regression guard permanent)
- Discogs Vault path confirmed (no plaintext rows on dev)
- CSP nonce-based, zero violations across 5 routes
- Git history clean — zero committed secrets
- Env inventory actionable — zero TBD rows

Phase 34 can now begin against a known-clean baseline.
```

**Step 4 — Final sanity checks** (machine-enforced phase-exit gate):

```bash
# All 8 checkboxes flipped
CHECKED=$(grep -c '^- \[x\] DEP-AUD-' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md)
test "$CHECKED" = "8" || { echo "FAIL: checked=$CHECKED (want 8)"; exit 1; }

# Zero unchecked
UNCHECKED=$(grep -c '^- \[ \] DEP-AUD-' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md)
test "$UNCHECKED" = "0" || { echo "FAIL: unchecked=$UNCHECKED"; exit 1; }

# Zero TBD rows
TBD=$(grep -c '| TBD |' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md)
test "$TBD" = "0" || { echo "FAIL: tbd=$TBD"; exit 1; }

# Verdict line is GREEN
grep -q '^\*\*Verdict:\*\* GREEN' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md \
  || { echo "FAIL: Verdict not GREEN"; exit 1; }

# Sign-Off table has 8 rows
SIGN_ROWS=$(grep -c '^| [1-8] | DEP-AUD-0[1-8]' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md)
test "$SIGN_ROWS" = "8" || { echo "FAIL: sign-off rows=$SIGN_ROWS"; exit 1; }

echo "Phase 33 exit gate: ALL PASS"
```

**If failing (per D-16):** Each failure mode points to a specific earlier plan that didn't finalize. Re-run that plan's finalization task (typically the last Task that populates AUDIT-REPORT.md §N). Do NOT fabricate a PASS — the whole point of the audit is that the evidence backs the verdict.
  </action>
  <verify>
    <automated>CHECKED=$(grep -c '^- \[x\] DEP-AUD-' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md); UNCHECKED=$(grep -c '^- \[ \] DEP-AUD-' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md); TBD=$(grep -c '| TBD |' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md); test "$CHECKED" = "8" && test "$UNCHECKED" = "0" && test "$TBD" = "0" && grep -q '^\*\*Verdict:\*\* GREEN' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md && grep -q 'Phase 33 prerequisites satisfied\|Phase 34 prerequisites satisfied' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c '^- \[x\] DEP-AUD-' AUDIT-REPORT.md` returns `8`
    - `grep -c '^- \[ \] DEP-AUD-' AUDIT-REPORT.md` returns `0`
    - `grep -c '| TBD |' AUDIT-REPORT.md` returns `0` (phase exit gate per D-15)
    - Top-of-file `**Verdict:**` line is `GREEN — all 8 checks pass` (not the placeholder `PENDING — execution in progress`)
    - Top-of-file `**Executed:**` line contains an ISO8601 date (not the placeholder `(fill during Wave 4)`)
    - Top-of-file `**main HEAD at audit start:**` contains a 40-char git sha (not the placeholder)
    - `## Sign-Off` section contains the 8-row verdict summary table (`grep -c '^| [1-8] | DEP-AUD-0[1-8]'` returns 8)
    - `## Sign-Off` section contains the phrase `Phase 34 prerequisites satisfied`
    - `## Sign-Off` section contains `Signed-off:` line with ISO8601 date
    - All 8 `^**Status:** PASS` lines present (one per section §1–§8)
  </acceptance_criteria>
  <done>AUDIT-REPORT.md finalized with GREEN verdict; sign-off captures the 8-row summary and explicitly unblocks Phase 34 per D-17.</done>
</task>

</tasks>

<verification>
1. `grep -c '^- \[x\] DEP-AUD-' AUDIT-REPORT.md` returns 8
2. `grep -c '^- \[ \] DEP-AUD-' AUDIT-REPORT.md` returns 0
3. `grep -c '| TBD |' AUDIT-REPORT.md` returns 0 (D-15 phase-exit gate)
4. `evidence/08a-vars-found.txt` and `evidence/08b-var-count.txt` both exist
5. `evidence/08c-tbd-count.txt` first line is `0`
6. Top-of-file `**Verdict:**` line is `GREEN — all 8 checks pass`
7. Sign-Off section table has 8 rows, one per DEP-AUD-0N
8. `grep -c '^\*\*Status:\*\* PASS' AUDIT-REPORT.md` returns 8
9. Commit with message `docs(033): phase 33 audit gate GREEN — all 8 checks pass, Phase 34 unblocked`
</verification>

<success_criteria>
- DEP-AUD-08 inventory complete — 25 rows, zero TBD
- AUDIT-REPORT.md top-of-file Verdict = GREEN
- All 8 DEP-AUD-* checkboxes [x]
- All 8 section Status = PASS
- Sign-Off table complete with evidence paths
- Phase 34 (Supabase Production Setup) explicitly unblocked per D-17
- Machine-checkable exit gate satisfied: `grep -c '| TBD |' AUDIT-REPORT.md` = 0
</success_criteria>

<output>
After completion, create `.planning/phases/033-pre-deploy-audit-gate/033-08-SUMMARY.md`
</output>
