---
phase: 034-supabase-production-setup
plan: 05
type: execute
wave: 3
depends_on: ["034-03", "034-04"]
files_modified:
  - .planning/phases/034-supabase-production-setup/evidence/14-database-url-template.txt
  - .planning/phases/034-supabase-production-setup/evidence/15-verify-final.txt
autonomous: false
requirements: [DEP-SB-10]
requirements_addressed: [DEP-SB-10]
gap_closure: false
must_haves:
  truths:
    - "evidence/14-database-url-template.txt documents the prod DATABASE_URL pooler template with all 3 required tokens: 'aws-0-us-east-1.pooler.supabase.com:6543' AND '?pgbouncer=true' AND 'prepare: false'"
    - "The doc explicitly states this is a TEMPLATE — the real password is NOT written to the file (Phase 35 will pass via Vercel env, not via file)"
    - "evidence/15-verify-final.txt captures a single end-to-end run of scripts/verify.sh that exits 0 and shows PASS for every DEP-SB-* check (01, 02, 03, 04, 05, 06, 07, 10)"
    - "Phase 34 SUMMARY at 034-SUMMARY.md exists and links to every evidence/ artifact, every plan SUMMARY, and the deferred-decisions log"
  artifacts:
    - path: ".planning/phases/034-supabase-production-setup/evidence/14-database-url-template.txt"
      provides: "Pooler-format DATABASE_URL template (tokens only — no real password) for Phase 35 to consume"
      contains: "aws-0-us-east-1.pooler.supabase.com:6543"
    - path: ".planning/phases/034-supabase-production-setup/evidence/15-verify-final.txt"
      provides: "stdout of bash scripts/verify.sh — single-pane snapshot of every DEP-SB-* check"
      contains: "PASS"
    - path: ".planning/phases/034-supabase-production-setup/034-SUMMARY.md"
      provides: "Phase-level SUMMARY tying together all 5 plan SUMMARYs + deferred-decision log"
      contains: "DEP-SB-10"
  key_links:
    - from: "evidence/14-database-url-template.txt"
      to: "Phase 35 Vercel env var DATABASE_URL"
      via: "operator copy-paste during /gsd:plan-phase 35 / execute"
      pattern: "DATABASE_URL"
    - from: "scripts/verify.sh"
      to: "every DEP-SB-* requirement automated check"
      via: "bash invocation"
      pattern: "verify\\.sh"
---

<objective>
Close out Phase 34 with the two artifacts the downstream phase (Phase 35 — Vercel env wiring) needs to start: a documented DATABASE_URL template (pooler-mode, port 6543, prepare:false) and a single-pane final-verify run that proves every DEP-SB-* check is green. This plan does NOT write env vars to Vercel — that's Phase 35. It only surfaces the template + final attestation.

Purpose: DEP-SB-10 requires the DATABASE_URL to use the PgBouncer transaction pooler on port 6543 with `prepare: false`. The format is locked by RESEARCH.md §9 + Pitfall #17. Phase 35 needs the exact template (host, port, query string) — but NOT the real password — to populate `DATABASE_URL` in Vercel. Documenting it here in `evidence/14-database-url-template.txt` (alongside `prepare: false` rationale from `apps/web/src/lib/db/index.ts`) is the hand-off contract.

Output: 1 template text file, 1 final-verify text file, 1 phase-level SUMMARY.md. Zero code changes. Zero new migrations. Zero Vercel/DNS/external-service touches.
</objective>

<execution_context>
@C:\Users\INTEL\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\INTEL\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/phases/034-supabase-production-setup/034-CONTEXT.md
@.planning/phases/034-supabase-production-setup/034-RESEARCH.md
@.planning/phases/034-supabase-production-setup/034-VALIDATION.md
@.planning/phases/034-supabase-production-setup/034-01-SUMMARY.md
@.planning/phases/034-supabase-production-setup/034-02-SUMMARY.md
@.planning/phases/034-supabase-production-setup/034-03-SUMMARY.md
@.planning/phases/034-supabase-production-setup/034-04-SUMMARY.md
@.planning/phases/034-supabase-production-setup/scripts/verify.sh
@apps/web/src/lib/db/index.ts
</context>

<interfaces>
Pooler-mode DATABASE_URL template (from RESEARCH.md §9 L498-L514 + Pitfall #17):

```
postgresql://postgres.<PROD_REF>:<DB_PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Required tokens (Phase 35 verifier will grep for these literal strings):
- Host: `aws-0-us-east-1.pooler.supabase.com:6543` — region-locked to us-east-1 per D-01.
- User format: `postgres.<PROD_REF>` (NOT just `postgres`).
- Query string: `?pgbouncer=true`.
- Drizzle/postgres-js client config: `prepare: false` (verified in `apps/web/src/lib/db/index.ts`, set in `apps/web/scripts/sim-upload.ts` for pooler-mode parity).

Three places this URL goes in Phase 35 (mentioned in this template doc but NOT written by Phase 34):
- `DATABASE_URL` in Vercel env (Production scope, sensitive).
- `NEXT_PUBLIC_SUPABASE_URL` = `https://<PROD_REF>.supabase.co`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = same anon key Vault has.
- `SUPABASE_SERVICE_ROLE_KEY` = service role from Dashboard → Settings → API.

Phase 34 surfaces these values as a checklist for Phase 35 — does not write them to anything.
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Write DATABASE_URL template doc with all 3 required tokens</name>
  <files>
    .planning/phases/034-supabase-production-setup/evidence/14-database-url-template.txt
  </files>
  <read_first>
    - 034-RESEARCH.md §9 (L496-L526) — exact pooler URL format, breakdown of components, Phase 35 hand-off list
    - 034-RESEARCH.md §"Common Pitfalls" Pitfall 4 (L698-L702) — Pitfall #17: port 5432 vs 6543 distinction
    - 034-CONTEXT.md D-14 — locked decision: pooler transaction-mode, prepare:false, NOT written to Vercel in Phase 34
    - apps/web/src/lib/db/index.ts — confirms prepare:false rationale
  </read_first>
  <action>
    Create a single text file at `.planning/phases/034-supabase-production-setup/evidence/14-database-url-template.txt` documenting the pooler URL template + the 4 Phase-35 hand-off variables. The file must contain (verbatim) all 3 required tokens that the verify harness greps for: `aws-0-us-east-1.pooler.supabase.com:6543`, `?pgbouncer=true`, and `prepare: false`.

    **Required content (write exactly this — line-for-line; substitute `<PROD_REF>` with the literal placeholder string `<PROD_REF>`, NOT the actual ref):**

    ```
    Phase 34 — DATABASE_URL Template for Phase 35
    Captured: <YYYY-MM-DD by executor>
    Source: 034-RESEARCH.md §9 (L496-L526), CONTEXT.md D-14

    ## Format (template only — real password lives in operator's password manager, NEVER in this file)

    postgresql://postgres.<PROD_REF>:<DB_PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true

    ## Required tokens (Phase 35 verifier greps for these literal strings)

    1. Host: aws-0-us-east-1.pooler.supabase.com:6543
       - Region prefix `aws-0-us-east-1` is LOCKED to us-east-1 per CONTEXT D-01.
       - Port `:6543` is the transaction pooler (PgBouncer). Port 5432 is session-mode and MUST NOT be used for app runtime.
    2. Query string: ?pgbouncer=true
       - postgres-js + Drizzle both honor this flag.
    3. Drizzle client config: prepare: false
       - Required for PgBouncer transaction-mode compatibility (Pitfall #17).
       - Already set in apps/web/src/lib/db/index.ts and apps/web/scripts/sim-upload.ts.

    ## User format detail

    The user is `postgres.<PROD_REF>` (NOT just `postgres`). PROD_REF was captured in 034-01-SUMMARY.md.
    Special characters in <DB_PASSWORD> must be URL-encoded.

    ## Phase 35 hand-off — 4 variables to populate in Vercel (Production scope only)

    | Variable | Value source |
    |---|---|
    | DATABASE_URL | Use the template above with the prod password from password manager |
    | NEXT_PUBLIC_SUPABASE_URL | https://<PROD_REF>.supabase.co |
    | NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Dashboard → Settings → API → anon public (same key Vault has — verify by length match against evidence/06-vault-secrets.txt) |
    | SUPABASE_SERVICE_ROLE_KEY | Dashboard → Settings → API → service_role (NOT in Vault, used by app server-side only) |

    ## What this file is NOT

    - Not the real DATABASE_URL with the real password (NEVER write that to a tracked file).
    - Not Vercel env config (Phase 35 owns that).
    - Not a substitute for the operator's password manager.

    ## Verification

    Phase 35 will fail-fast if its DATABASE_URL is missing any of the three required tokens. To pre-check:

      grep -q 'aws-0-us-east-1.pooler.supabase.com:6543' <this-file>   # exit 0
      grep -q '?pgbouncer=true'                              <this-file>   # exit 0
      grep -q 'prepare: false'                               <this-file>   # exit 0

    Source: scripts/verify.sh DEP-SB-10 block.
    ```

    **DO NOT:**
    - Substitute `<PROD_REF>` with the actual project ref. The template MUST keep the placeholder so any reader knows this is a template, not a credential.
    - Write the real `<DB_PASSWORD>` into this file. It lives in the operator's password manager only.
    - Write any service_role key, anon key value, or HMAC secret into this file. The hand-off table cites their source location (Dashboard) — Phase 35 reads from there.

    **Verification of the file (post-write):** the 3 grep commands listed in the file itself MUST all exit 0.
  </action>
  <verify>
    <automated>test -s .planning/phases/034-supabase-production-setup/evidence/14-database-url-template.txt &amp;&amp; grep -q 'aws-0-us-east-1.pooler.supabase.com:6543' .planning/phases/034-supabase-production-setup/evidence/14-database-url-template.txt &amp;&amp; grep -q '?pgbouncer=true' .planning/phases/034-supabase-production-setup/evidence/14-database-url-template.txt &amp;&amp; grep -q 'prepare: false' .planning/phases/034-supabase-production-setup/evidence/14-database-url-template.txt</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/034-supabase-production-setup/evidence/14-database-url-template.txt` exists, size > 0.
    - File contains the literal string `aws-0-us-east-1.pooler.supabase.com:6543` (DEP-SB-10 host token, exact match).
    - File contains the literal string `?pgbouncer=true` (DEP-SB-10 query-string token).
    - File contains the literal string `prepare: false` (DEP-SB-10 Drizzle config token).
    - File contains the literal string `<PROD_REF>` (proves the placeholder was preserved, not substituted).
    - File does NOT contain any string matching the regex `:6543` followed by anything other than `/postgres?pgbouncer=true` (no leakage of an alternative pooler URL).
    - File does NOT contain any string starting with `eyJ` (no JWT/anon-key leakage).
  </acceptance_criteria>
  <done>
    DEP-SB-10 satisfied: pooler template documented; Phase 35 has the exact tokens to populate Vercel env when its time comes.
  </done>
</task>

<task type="auto">
  <name>Task 2: Run scripts/verify.sh end-to-end + capture green pass</name>
  <files>
    .planning/phases/034-supabase-production-setup/evidence/15-verify-final.txt
  </files>
  <read_first>
    - .planning/phases/034-supabase-production-setup/scripts/verify.sh — orchestrator built in Plan 01 Task 1
    - 034-VALIDATION.md — full per-requirement test map
  </read_first>
  <action>
    With all of Plan 01-04 evidence in place, run `scripts/verify.sh` end-to-end and capture stdout. Every DEP-SB-* check should report PASS.

    **Pre-flight:**
    - Re-export `PROD_REF`, prompt for `PROD_DIRECT_URL` and `PROD_ANON_KEY` if a fresh shell.
    - `[ "$(cat supabase/.temp/project-ref)" = "$PROD_REF" ]` — abort if linked ref drifted.

    **Run:**

    ```
    PROD_REF="$PROD_REF" PROD_DIRECT_URL="$PROD_DIRECT_URL" PROD_ANON_KEY="$PROD_ANON_KEY" \
      bash .planning/phases/034-supabase-production-setup/scripts/verify.sh \
      2>&1 | tee .planning/phases/034-supabase-production-setup/evidence/15-verify-final.txt
    EXIT=${PIPESTATUS[0]}
    ```

    **Hard assertions:**
    - `EXIT` is 0.
    - `evidence/15-verify-final.txt` ends with a `SUMMARY:` line where the FAIL count is `0`.
    - The captured file contains `PASS` for every DEP-SB-* check (DEP-SB-01, 02, 03, 04, 05, 06, 07, 10).
    - The captured file does NOT contain `FAIL` (any single FAIL means a regression vs prior plan).

    **If any FAIL appears:** Re-read the failing check's source plan, re-run the relevant evidence-capture task there, then re-run this verify. Do NOT edit `verify.sh` to make a check pass — that's evidence forgery. The script is the contract.

    **DO NOT:**
    - Use service_role for `PROD_ANON_KEY`. The anon key is what the verify expects.
    - Modify `scripts/verify.sh` here. The script was sealed in Plan 01 — Plan 05 is verification, not iteration.
  </action>
  <verify>
    <automated>test -s .planning/phases/034-supabase-production-setup/evidence/15-verify-final.txt &amp;&amp; grep -q 'PASS' .planning/phases/034-supabase-production-setup/evidence/15-verify-final.txt &amp;&amp; ! grep -q 'FAIL' .planning/phases/034-supabase-production-setup/evidence/15-verify-final.txt &amp;&amp; grep -qE 'SUMMARY:.*[0-9]+ pass.*0 fail' .planning/phases/034-supabase-production-setup/evidence/15-verify-final.txt</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/034-supabase-production-setup/evidence/15-verify-final.txt` exists, size > 0.
    - File contains `PASS` (case-sensitive) at least 8 times — one per DEP-SB-* check (01, 02, 03, 04, 05, 06, 07, 10).
    - File does NOT contain `FAIL` anywhere.
    - File ends with a SUMMARY line in the shape `SUMMARY: <N> pass, 0 fail`.
    - The verify script exited 0 (process exit code).
  </acceptance_criteria>
  <done>
    Phase 34 has a single-pane final attestation. Every DEP-SB-* requirement has both a per-plan evidence artifact AND a final harness pass. Ready for SUMMARY.
  </done>
</task>

<task type="auto">
  <name>Task 3: Write phase-level 034-SUMMARY.md</name>
  <files>
    .planning/phases/034-supabase-production-setup/034-SUMMARY.md
  </files>
  <read_first>
    - 034-CONTEXT.md (full file) — locked decisions, deferred ideas, doc-debt
    - 034-RESEARCH.md §11 (L557-L590) — doc-debt scope (digswap.com → digswap.com.br) — must be flagged for follow-up QUICK
    - 034-RESEARCH.md §12 (L593-L606) — audit user creation deferred to Phase 38
    - 034-RESEARCH.md §"Open Questions" — auto-pause + pg_cron interaction worth ADR post-MVP
    - .planning/phases/034-supabase-production-setup/034-01-SUMMARY.md
    - .planning/phases/034-supabase-production-setup/034-02-SUMMARY.md
    - .planning/phases/034-supabase-production-setup/034-03-SUMMARY.md
    - .planning/phases/034-supabase-production-setup/034-04-SUMMARY.md
  </read_first>
  <action>
    Write a phase-level SUMMARY at `.planning/phases/034-supabase-production-setup/034-SUMMARY.md`. The SUMMARY ties together all 5 plan SUMMARYs, lists every evidence/ artifact with its byte size, captures locked-decision fingerprints (region, tier, domain, CORS origins), and surfaces deferred-but-still-real follow-ups for downstream phases.

    **Required sections (in this order):**

    1. **Frontmatter:**

       ```
       ---
       phase: 034-supabase-production-setup
       status: complete
       completed: <YYYY-MM-DD by executor>
       requirements_addressed: [DEP-SB-01, DEP-SB-02, DEP-SB-03, DEP-SB-04, DEP-SB-05, DEP-SB-06, DEP-SB-07, DEP-SB-10]
       requirements_deferred: [DEP-SB-08, DEP-SB-09]
       depends_on: [Phase 33.1]
       unblocks: [Phase 35]
       ---
       ```

    2. **Phase Goal Restatement** (2-3 sentences, free-tier scope from CONTEXT.md).

    3. **What Was Done — by plan** (table):

       | Plan | Requirements | Key artifacts |
       |---|---|---|
       | 034-01 | DEP-SB-01 | scripts/verify.sh, scripts/rls-probe.sql, scripts/drop-and-recreate.md, evidence/01, evidence/02 |
       | 034-02 | DEP-SB-02, DEP-SB-03 | evidence/03 (dry-run), evidence/04 (live push), evidence/05 (advisor), evidence/05b (rls probe) |
       | 034-03 | DEP-SB-05, DEP-SB-06 | evidence/06 (vault), evidence/08 (cron) |
       | 034-04 | DEP-SB-04, DEP-SB-07 | evidence/07a-d (functions), evidence/09 (bucket), evidence/10 (CORS) |
       | 034-05 | DEP-SB-10 | evidence/14 (DATABASE_URL template), evidence/15 (final verify) |

    4. **Locked-decision fingerprint** (from CONTEXT.md, repeat verbatim):
       - Region: us-east-1 (D-01)
       - Tier: Free, auto-pause accepted (D-02, D-03, D-04)
       - PITR: deferred (D-05)
       - Domain: digswap.com.br (D-06)
       - CORS origins: digswap.com.br + www.digswap.com.br only (D-07)
       - Bucket public=false, 48h TTL via existing 3-piece mechanism (D-08)
       - Migrations: supabase db push --linked only, never drizzle-kit (D-09, D-10)
       - Security Advisor: green required (D-11)
       - Vault: 2 secrets via public.vault_create_secret wrapper (D-12)
       - pg_cron: postgres role, 3+ active jobs (D-13)
       - DATABASE_URL: aws-0-us-east-1.pooler.supabase.com:6543 + ?pgbouncer=true + prepare:false (D-14)

    5. **Evidence inventory** (table with file path + byte size for every file in `evidence/`):

       Use `wc -c` or `stat` to populate sizes. Format:

       ```
       | Artifact | Size | Captured by |
       |---|---|---|
       | evidence/01-projects-list.txt | <bytes>B | 034-01 Task 3 |
       | evidence/02-link-confirm.txt | <bytes>B | 034-01 Task 3 |
       | evidence/03-dry-run.txt | <bytes>B | 034-02 Task 1 |
       | evidence/04-db-push.txt | <bytes>B | 034-02 Task 1 |
       | evidence/05-security-advisor.png | <bytes>B | 034-02 Task 2 |
       | evidence/05b-rls-probe.txt | <bytes>B | 034-02 Task 3 |
       | evidence/06-vault-secrets.txt | <bytes>B | 034-03 Task 1 |
       | evidence/07a-cleanup-deploy.log | <bytes>B | 034-04 Task 1 |
       | evidence/07b-validate-deploy.log | <bytes>B | 034-04 Task 1 |
       | evidence/07c-cleanup-curl.txt | <bytes>B | 034-04 Task 2 |
       | evidence/07d-validate-curl.txt | <bytes>B | 034-04 Task 2 |
       | evidence/08-cron-jobs.txt | <bytes>B | 034-03 Task 2 |
       | evidence/09-bucket-state.txt | <bytes>B | 034-04 Task 3 |
       | evidence/10-cors-dashboard.png | <bytes>B | 034-04 Task 4 |
       | evidence/14-database-url-template.txt | <bytes>B | 034-05 Task 1 |
       | evidence/15-verify-final.txt | <bytes>B | 034-05 Task 2 |
       ```

       To populate, run: `for f in .planning/phases/034-supabase-production-setup/evidence/*; do echo "$f $(wc -c < "$f")"; done`.

    6. **Halt-on-fail events** — list any drop+recreate, fix-forward, or Phase 34.1 escalations. If none, write "No halt events. Migration push and Edge Function deploy completed cleanly on first attempt."

    7. **Deferred for follow-up** (cite each with a target):
       - **Doc-debt sweep `digswap.com → digswap.com.br`** — RESEARCH.md §11 inventories 64 occurrences across 12 files. Open as a QUICK after this phase. Suggested title: `quick-260424-rename-digswap-com-to-digswap-com-br`. Files NOT to touch: closed phase plans (`.planning/phases/10-04-PLAN.md`), `.pi/reports/sre-prr-report.md`. The current Phase 34 working docs (CONTEXT.md, DISCUSSION-LOG.md) are eligible for the sweep.
       - **Audit user creation in prod** — RESEARCH.md §12. Deferred to Phase 38 (UAT) per the rationale that Phase 34 has no use for an authenticated app session, and prod stays clean until smoke tests run. Phase 38 plan owner reproduces the Phase 33.1 Admin API recipe.
       - **DEP-SB-08 (Pro tier + auto-pause off)** — deferred post-MVP (CONTEXT D-03). Trigger: 500MB DB pressure OR first paying user.
       - **DEP-SB-09 (PITR + rehearsed restore)** — deferred post-MVP (CONTEXT D-05). Backup daily covers MVP. Rehearsal happens on a throwaway Pro project once Pro is activated.
       - **pg_cron behavior under auto-pause** — RESEARCH.md "Open Questions" #3. Worth a small experiment in a throwaway project + ADR post-MVP. Not a Phase 34 blocker.

    8. **Hand-off to Phase 35:**

       Phase 35 needs exactly these 4 values from this phase:
       - `DATABASE_URL` template — see `evidence/14-database-url-template.txt` (template only — operator must add password from password manager).
       - `NEXT_PUBLIC_SUPABASE_URL` — `https://<PROD_REF>.supabase.co` where PROD_REF is captured in `034-01-SUMMARY.md`.
       - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Dashboard → Settings → API → `anon` `public`. Length matches `len=` in `evidence/06-vault-secrets.txt` row 2 (~220 chars).
       - `SUPABASE_SERVICE_ROLE_KEY` — Dashboard → Settings → API → `service_role`.

       Phase 35 verifier MUST grep all 3 DEP-SB-10 tokens (host, query string, prepare:false) in any DATABASE_URL it commits to Vercel.

    9. **Final attestation** — quote the SUMMARY line from `evidence/15-verify-final.txt`. Must read `SUMMARY: <N> pass, 0 fail` where N ≥ the number of `check` calls in `scripts/verify.sh` (≥10 individual checks across the 8 requirements).

    **DO NOT:**
    - Write any real key, password, or service-role JWT into the SUMMARY.
    - Mark `requirements_deferred` empty — DEP-SB-08 and DEP-SB-09 are explicitly deferred and must be listed.
    - Add Phase 34 to the doc-debt sweep — that's a separate follow-up QUICK as established by RESEARCH.md §11.
  </action>
  <verify>
    <automated>test -s .planning/phases/034-supabase-production-setup/034-SUMMARY.md &amp;&amp; grep -qE '^requirements_addressed:.*DEP-SB-01.*DEP-SB-02.*DEP-SB-03.*DEP-SB-04.*DEP-SB-05.*DEP-SB-06.*DEP-SB-07.*DEP-SB-10' .planning/phases/034-supabase-production-setup/034-SUMMARY.md &amp;&amp; grep -qE '^requirements_deferred:.*DEP-SB-08.*DEP-SB-09' .planning/phases/034-supabase-production-setup/034-SUMMARY.md &amp;&amp; grep -q 'digswap.com.br' .planning/phases/034-supabase-production-setup/034-SUMMARY.md &amp;&amp; grep -q 'aws-0-us-east-1.pooler.supabase.com:6543' .planning/phases/034-supabase-production-setup/034-SUMMARY.md</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/034-supabase-production-setup/034-SUMMARY.md` exists, size > 0.
    - Frontmatter `requirements_addressed` lists all 8 in-scope IDs (DEP-SB-01, 02, 03, 04, 05, 06, 07, 10).
    - Frontmatter `requirements_deferred` lists exactly DEP-SB-08 and DEP-SB-09.
    - SUMMARY mentions `digswap.com.br` (correct domain) AT LEAST 3 times across CORS, doc-debt, and hand-off sections.
    - SUMMARY does NOT mention `digswap.com` standalone (without `.br` suffix) except in the explicit doc-debt-cleanup mention where it appears as part of the rename target string.
    - SUMMARY contains all 14 D-01 through D-14 lock fingerprints (not just a subset).
    - Evidence-inventory table lists all 16 artifact paths with non-zero byte sizes.
    - Hand-off-to-Phase-35 section identifies exactly 4 env-var values + their dashboard sources.
    - SUMMARY does NOT contain any string starting with `eyJ` (no JWT leakage).
    - SUMMARY does NOT contain `password` followed by an `=` and a value (no credential leakage).
  </acceptance_criteria>
  <done>
    Phase 34 closes with a single SUMMARY that downstream phases (35, 38, 39) and any future audit can use as the canonical record. Phase 34 work is shippable.
  </done>
</task>

</tasks>

<verification>
- [ ] `evidence/14-database-url-template.txt` exists; contains all 3 DEP-SB-10 tokens (host, ?pgbouncer=true, prepare: false); does NOT contain a real password or anon key value.
- [ ] `evidence/15-verify-final.txt` exists; contains PASS for every DEP-SB-* check; does NOT contain FAIL; ends with `SUMMARY: <N> pass, 0 fail`.
- [ ] `034-SUMMARY.md` exists with valid frontmatter + all 9 sections + correct domain (digswap.com.br) + complete locked-decision fingerprint.
- [ ] Every file under `evidence/` is referenced in the SUMMARY's evidence inventory table.
- [ ] No new migrations were authored. No `apps/web/` source code was modified. No Vercel/DNS/external-service config touched.
</verification>

<success_criteria>
- DEP-SB-10: pooler-mode DATABASE_URL template documented with all 3 required tokens; Phase 35 has the exact format to populate Vercel env when its time comes.
- All 8 in-scope DEP-SB-* requirements (01, 02, 03, 04, 05, 06, 07, 10) reflect PASS in the final-verify run.
- DEP-SB-08 and DEP-SB-09 are documented as deferred with their trigger conditions, never silently dropped.
- Doc-debt sweep + audit user + Pro/PITR all surface as named follow-ups with target phases — no work hidden in the corners.
- Phase 34 SUMMARY is the single source of truth a future audit can read in 5 minutes to know what shipped and what was deferred.
</success_criteria>

<output>
After Plan 05 completes, the phase output is the SUMMARY itself. The orchestrator (`/gsd:execute-phase 34`) will:

1. Confirm `034-SUMMARY.md` matches the requirements_addressed / deferred lists.
2. Update `.planning/STATE.md` to mark Phase 34 complete and Phase 35 ready.
3. Update `.planning/REQUIREMENTS.md` rows DEP-SB-01..07,10 from `Pending` → `Complete`. Leave DEP-SB-08, DEP-SB-09 as `Pending (deferred post-MVP)`.

User-facing next steps (NOT performed by Phase 34):
- Open the doc-debt-cleanup QUICK: `/gsd:quick "rename digswap.com to digswap.com.br across research, ROADMAP, ADRs, skill references, Phase 34 working docs"`.
- Then start Phase 35: `/clear`, then `/gsd:plan-phase 35`.
</output>
