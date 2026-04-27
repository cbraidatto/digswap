---
phase: 034-supabase-production-setup
plan: 03
type: execute
wave: 2
depends_on: ["034-02"]
files_modified:
  - .planning/phases/034-supabase-production-setup/evidence/06-vault-secrets.txt
  - .planning/phases/034-supabase-production-setup/evidence/08-cron-jobs.txt
autonomous: false
requirements: [DEP-SB-05, DEP-SB-06]
requirements_addressed: [DEP-SB-05, DEP-SB-06]
gap_closure: false
must_haves:
  truths:
    - "Vault contains exactly 2 named secrets: 'trade_preview_project_url' (= 'https://<PROD_REF>.supabase.co') AND 'trade_preview_publishable_key' (= prod anon publishable key from Dashboard → Settings → API)"
    - "Vault is populated BEFORE the next pg_cron tick of trade-preview-cleanup (every hour at minute 0) — Pitfall #11 satisfied"
    - "cron.job has at least 3 active rows: recalculate-rankings, trade-preview-cleanup, purge-soft-deleted-collection-items"
    - "Every active cron.job runs as username='postgres' (Pitfall #18 satisfied)"
  artifacts:
    - path: ".planning/phases/034-supabase-production-setup/evidence/06-vault-secrets.txt"
      provides: "psql verify-query output proving 2 vault.decrypted_secrets rows exist (without leaking the decrypted values themselves)"
      contains: "trade_preview_project_url"
    - path: ".planning/phases/034-supabase-production-setup/evidence/08-cron-jobs.txt"
      provides: "psql output of active cron.job listing (jobid, jobname, schedule, active, username), proving DEP-SB-05 satisfied"
      contains: "trade-preview-cleanup"
  key_links:
    - from: "public.vault_create_secret(text,text,text)"
      to: "vault.decrypted_secrets view"
      via: "SECURITY DEFINER wrapper from migration 20260424000000_enable_vault_extension.sql"
      pattern: "vault_create_secret"
    - from: "public.invoke_trade_preview_cleanup() pg_cron job"
      to: "vault.decrypted_secrets WHERE name = 'trade_preview_project_url'"
      via: "SQL SELECT inside the SECURITY DEFINER cron-callback function (migration 20260417 L125-169)"
      pattern: "trade_preview_project_url"
---

<objective>
Populate Supabase Vault on digswap-prod with the 2 secrets that pg_cron's `trade-preview-cleanup` job requires (`trade_preview_project_url` + `trade_preview_publishable_key`), THEN verify pg_cron has at least 3 active jobs and every job runs under role `postgres`. Vault MUST be populated first because Pitfall #11 timing requires the secrets to exist before the first scheduled tick fires (next hour at :00).

Purpose: DEP-SB-06 (Vault) and DEP-SB-05 (pg_cron) are tightly coupled — the cron job for trade-preview-cleanup reads `vault.decrypted_secrets` at runtime via a SECURITY DEFINER SQL function (migration 20260417 L125-169), and if Vault is empty when the cron ticks, the function logs `RAISE NOTICE 'Skipping... Vault secrets not configured'` and pollutes `cron.job_run_details`. This plan enforces the ordering by doing both in one plan.

Output: 2 evidence text files capturing Vault verify output + pg_cron listing. No app code changes. No new migrations.
</objective>

<execution_context>
@C:\Users\INTEL\.claude\get-shit-done\workflows\execute-plan.md
@C:\Users\INTEL\.claude\get-shit-done\templates\summary.md
</execution_context>

<context>
@.planning/phases/034-supabase-production-setup/034-CONTEXT.md
@.planning/phases/034-supabase-production-setup/034-RESEARCH.md
@.planning/phases/034-supabase-production-setup/034-VALIDATION.md
@.planning/phases/034-supabase-production-setup/034-02-SUMMARY.md
@supabase/migrations/20260424000000_enable_vault_extension.sql
@supabase/migrations/20260327_ranking_function.sql
@supabase/migrations/20260417_trade_preview_infrastructure.sql
@supabase/migrations/20260419_purge_soft_deleted.sql
</context>

<interfaces>
Key SQL contracts the executor will call. Extracted from the migration files. Use the public wrapper, NOT vault.create_secret directly (PostgREST routes only public schema).

From `supabase/migrations/20260424000000_enable_vault_extension.sql` (Phase 33.1, SECURITY DEFINER + idempotent grants):
- `public.vault_create_secret(secret_value text, secret_name text, secret_description text) RETURNS uuid`
- `public.vault_delete_secret(secret_name text) RETURNS void`

From `supabase/migrations/20260417_trade_preview_infrastructure.sql` (cron callback):
- `public.invoke_trade_preview_cleanup()` — SECURITY DEFINER. Reads `vault.decrypted_secrets` for `trade_preview_project_url` (URL of the cleanup-trade-previews edge function host) and `trade_preview_publishable_key` (Bearer token used in HTTP call). Cron schedule: `0 * * * *` (hourly at :00).

From `vault` schema (Supabase-managed):
- `vault.decrypted_secrets` is a view exposing decrypted values, NOT the encrypted `vault.secrets` table.
- Columns: `id, name, description, secret, decrypted_secret, key_id, nonce, created_at, updated_at`.
- Verify shape: `SELECT name, created_at, length(decrypted_secret) FROM vault.decrypted_secrets WHERE name IN (...)` — never select `decrypted_secret` itself for evidence files.

Expected 3 cron jobs after Plan 02 push (per RESEARCH.md §7):
- `recalculate-rankings` — schedule `*/15 * * * *` (every 15 min)
- `trade-preview-cleanup` — schedule `0 * * * *` (hourly at :00)
- `purge-soft-deleted-collection-items` — schedule `0 3 * * *` (daily 03:00 UTC)
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Populate Vault with both secrets via public.vault_create_secret wrapper</name>
  <files>
    .planning/phases/034-supabase-production-setup/evidence/06-vault-secrets.txt
  </files>
  <read_first>
    - 034-RESEARCH.md §6 (L350-L400) — full Vault recipe, exact SQL, value sources, idempotency rationale
    - 034-RESEARCH.md §"Common Pitfalls" Pitfall 3 (L692-L696) — Vault MUST be populated before first cron tick at :00
    - supabase/migrations/20260424000000_enable_vault_extension.sql — confirms public.vault_create_secret + public.vault_delete_secret wrappers exist
    - supabase/migrations/20260417_trade_preview_infrastructure.sql L125-L169 — confirms which secret names the cron callback reads
  </read_first>
  <action>
    Insert 2 secrets into Vault via the `public.vault_create_secret` wrapper (NOT `vault.create_secret` directly — PostgREST only routes public schema). Use the prod direct (session-mode, port 5432) URL — Vault writes need a real session, not the pooler.

    **Inputs the operator must supply at runtime (NEVER persist to repo):**
    1. `PROD_REF` — already known from Plan 01 Task 2.
    2. `PROD_DIRECT_URL` — port 5432 session-mode URL from Dashboard → Settings → Database → Connection string → URI (Session mode).
    3. `PROD_ANON_KEY` — Dashboard → Settings → API → `anon` `public` key (NOT service_role).

    **Run (bash):**

    1. Assert env vars: `: "${PROD_REF:?PROD_REF env var required}"`. Then `read -s -p "Paste PROD_DIRECT_URL (port 5432, session mode): " PROD_DIRECT_URL; echo`. Hard-check the URL contains `:5432` (NOT `:6543`) — abort if not.
    2. Prompt for the anon key: `read -s -p "Paste PROD_ANON_KEY: " PROD_ANON_KEY; echo`. Hard-check `${#PROD_ANON_KEY} -ge 100` (anon JWT is ~220 chars; service_role would also be ~220 but starts with `eyJ` so do a soft check that the prefix is `eyJ`).
    3. Compute `PROJECT_URL="https://${PROD_REF}.supabase.co"`.
    4. Run a psql here-doc that first deletes any pre-existing rows (idempotent re-runs), then inserts both secrets via the wrapper. Inline the literal SQL below — do NOT abstract into a separate file:

       ```
       psql "$PROD_DIRECT_URL" -v ON_ERROR_STOP=1 -c "SELECT public.vault_delete_secret('trade_preview_project_url');"
       psql "$PROD_DIRECT_URL" -v ON_ERROR_STOP=1 -c "SELECT public.vault_delete_secret('trade_preview_publishable_key');"
       psql "$PROD_DIRECT_URL" -v ON_ERROR_STOP=1 -c \
         "SELECT public.vault_create_secret('${PROJECT_URL}', 'trade_preview_project_url', 'Phase 34 — prod project URL consumed by trade-preview-cleanup pg_cron job');"
       psql "$PROD_DIRECT_URL" -v ON_ERROR_STOP=1 -c \
         "SELECT public.vault_create_secret('${PROD_ANON_KEY}', 'trade_preview_publishable_key', 'Phase 34 — prod anon publishable key used as Bearer auth for cleanup-trade-previews edge function');"
       ```

    5. Verify — capture name + created_at + LENGTH only (NEVER the decrypted_secret value itself). Pipe to `evidence/06-vault-secrets.txt`:

       ```
       psql "$PROD_DIRECT_URL" -At -c \
         "SELECT name || '|' || created_at || '|len=' || length(decrypted_secret) FROM vault.decrypted_secrets WHERE name IN ('trade_preview_project_url', 'trade_preview_publishable_key') ORDER BY name;" \
         | tee .planning/phases/034-supabase-production-setup/evidence/06-vault-secrets.txt
       ```

    6. Hard-assert the captured file has exactly 2 matching lines: `ROWS=$(grep -cE '^trade_preview_(project_url|publishable_key)\|' .planning/phases/034-supabase-production-setup/evidence/06-vault-secrets.txt)` then `[ "$ROWS" = "2" ]` or abort.

    7. Length sanity check on both rows: project URL `len=` should be 25-80 chars; anon key `len=` should be ≥100 chars. Warn (not abort) if outside expected ranges.

    **Halt-on-fail (per RESEARCH.md §10 row HIGH for Vault errors):**
    - If `vault_create_secret` fails because the wrapper does not exist → migration `20260424000000_enable_vault_extension.sql` did not apply. Check Plan 02 evidence/04-db-push.txt for that filename. Do NOT manually `CREATE EXTENSION` — re-run Plan 02 from the top.
    - If only 1 row appears in evidence/06 (one insert silently dropped): verify via `psql -c "\\dx vault"` that the extension is installed. If not installed, halt and open Phase 34.1.

    **DO NOT:**
    - Write `PROD_DIRECT_URL` or `PROD_ANON_KEY` to any file. The verify-query output captures only `name`, `created_at`, and `length(decrypted_secret)` — never the decrypted value itself.
    - Use `supabase secrets set` for these — that's the Edge Function env-var mechanism, NOT the Vault mechanism (RESEARCH.md §"Anti-Patterns" L643).
    - Use the pooler URL (port 6543) — Vault writes need a real session.
  </action>
  <verify>
    <automated>test -s .planning/phases/034-supabase-production-setup/evidence/06-vault-secrets.txt &amp;&amp; grep -qE '^trade_preview_project_url\|' .planning/phases/034-supabase-production-setup/evidence/06-vault-secrets.txt &amp;&amp; grep -qE '^trade_preview_publishable_key\|' .planning/phases/034-supabase-production-setup/evidence/06-vault-secrets.txt</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/034-supabase-production-setup/evidence/06-vault-secrets.txt` exists, file size > 0.
    - File contains exactly 2 lines matching `^trade_preview_(project_url|publishable_key)\|` (one per named secret).
    - File does NOT contain the decrypted values themselves — only `name|created_at|len=N` per row (manually grep that no `eyJ` JWT prefix and no `https://` URL appear in the file).
    - Each line includes a `len=` suffix where the integer is ≥ 25 (URL) or ≥ 100 (anon key) respectively.
    - The Vault wrapper used was `public.vault_create_secret` (proven by absence of `vault.create_secret` direct calls in the action).
  </acceptance_criteria>
  <done>
    DEP-SB-06 satisfied: Vault contains both required secrets. The next scheduled tick of trade-preview-cleanup (next :00) will succeed instead of logging "Skipping... Vault secrets not configured." Pitfall #11 timing window honored.
  </done>
</task>

<task type="auto">
  <name>Task 2: Verify pg_cron has 3+ active jobs and all run as role postgres</name>
  <files>
    .planning/phases/034-supabase-production-setup/evidence/08-cron-jobs.txt
  </files>
  <read_first>
    - 034-RESEARCH.md §7 (L404-L446) — pg_cron verification queries (count, detail, role check)
    - 034-RESEARCH.md §"Common Pitfalls" Pitfall 5 (L704-L708) — Pitfall #18: pg_cron under wrong role silently no-ops
    - 034-CONTEXT.md D-13 — 3+ active jobs expected (Stripe-event-log dormant per CONTEXT)
    - supabase/migrations/20260327_ranking_function.sql L86-L90 — recalculate-rankings cron schedule
    - supabase/migrations/20260417_trade_preview_infrastructure.sql L187-L191 — trade-preview-cleanup cron schedule
    - supabase/migrations/20260419_purge_soft_deleted.sql L14-L18 — purge cron schedule
  </read_first>
  <action>
    Run 4 SQL queries against `cron.job` and capture all output to `evidence/08-cron-jobs.txt`. Hard-assert 3 conditions: (a) at least 3 active jobs exist, (b) each of the 3 expected job names is present, (c) every active job runs under `username='postgres'`.

    **Run (bash, with PROD_DIRECT_URL still in env from Task 1 — re-prompt if a new shell):**

    1. Print a header with timestamp into the evidence file: `echo "=== Phase 34 cron verify — captured $(date -u +%Y-%m-%dT%H:%M:%SZ) ===" > .planning/phases/034-supabase-production-setup/evidence/08-cron-jobs.txt`

    2. Append Q1 (count) to the evidence file (use `psql ... | tee -a`):
       - `psql "$PROD_DIRECT_URL" -c "SELECT COUNT(*) AS active_jobs FROM cron.job WHERE active = true;"`

    3. Append Q2 (detail listing):
       - `psql "$PROD_DIRECT_URL" -c "SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;"`

    4. Append Q3 (role check, Pitfall #18):
       - `psql "$PROD_DIRECT_URL" -c "SELECT jobid, jobname, username FROM cron.job WHERE active = true ORDER BY jobid;"`

    5. Append Q4 (jobs NOT running as postgres — must return 0 rows):
       - `psql "$PROD_DIRECT_URL" -c "SELECT jobid, jobname, username FROM cron.job WHERE active = true AND username <> 'postgres';"`

    6. Hard-assertions parsed against live DB (NOT against the file we just wrote, to avoid false-pass on capture errors):
       - `ACTIVE=$(psql "$PROD_DIRECT_URL" -At -c "SELECT COUNT(*) FROM cron.job WHERE active = true")`. Abort if `[ "$ACTIVE" -lt 3 ]`.
       - `NON_POSTGRES=$(psql "$PROD_DIRECT_URL" -At -c "SELECT COUNT(*) FROM cron.job WHERE active = true AND username <> 'postgres'")`. Abort if `[ "$NON_POSTGRES" != "0" ]` — Pitfall #18.

    7. Confirm each of the 3 expected job names is in the captured evidence file:
       - `for name in recalculate-rankings trade-preview-cleanup purge-soft-deleted-collection-items; do grep -q "$name" .planning/phases/034-supabase-production-setup/evidence/08-cron-jobs.txt || { echo "ABORT: missing $name"; exit 1; }; done`

    **If 4 jobs appear** (e.g., the Stripe-event-log cleanup migration also scheduled one): per CONTEXT.md "Stripe event log tabela aplicada-mas-dormente" + RESEARCH.md "Open Questions" #1, leave it active (zero impact on Free-Tier launch — table is never written to). Do NOT call `cron.unschedule()` in Phase 34. The 4th job is captured by Q2's detail listing.

    **If `username` for any active row is NOT 'postgres'**: HALT per RESEARCH.md §10. Pitfall #18 says these jobs silently no-op. Open Phase 34.1 — do not attempt to fix-forward this in Phase 34 because it implies a deeper migration ordering or extension issue.

    **DO NOT:**
    - Run `cron.schedule()` or `cron.unschedule()` manually here. The 3 expected jobs are scheduled by migrations applied in Plan 02 — touching them by hand bypasses the migration trail.
    - Confuse `cron.job` (the schedule registry) with `cron.job_run_details` (the execution log). DEP-SB-05 reads `cron.job` only.
  </action>
  <verify>
    <automated>test -s .planning/phases/034-supabase-production-setup/evidence/08-cron-jobs.txt &amp;&amp; grep -q 'recalculate-rankings' .planning/phases/034-supabase-production-setup/evidence/08-cron-jobs.txt &amp;&amp; grep -q 'trade-preview-cleanup' .planning/phases/034-supabase-production-setup/evidence/08-cron-jobs.txt &amp;&amp; grep -q 'purge-soft-deleted-collection-items' .planning/phases/034-supabase-production-setup/evidence/08-cron-jobs.txt</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/034-supabase-production-setup/evidence/08-cron-jobs.txt` exists, file size > 0.
    - File contains all 3 of these literal strings (one per expected cron job): `recalculate-rankings`, `trade-preview-cleanup`, `purge-soft-deleted-collection-items`.
    - Live query `SELECT COUNT(*) FROM cron.job WHERE active = true` returns ≥3.
    - Live query `SELECT COUNT(*) FROM cron.job WHERE active = true AND username <> 'postgres'` returns 0.
    - The evidence file shows each of Q1-Q4 was actually executed (file contains the strings `active_jobs`, `jobname`, `username`).
  </acceptance_criteria>
  <done>
    DEP-SB-05 satisfied: at least 3 active pg_cron jobs, all running as `postgres`. Pitfall #18 verified clean. Combined with Task 1 (DEP-SB-06), the trade-preview-cleanup cron job is now wired end-to-end and will execute successfully on its next :00 tick.
  </done>
</task>

</tasks>

<verification>
- [ ] `evidence/06-vault-secrets.txt` exists; contains exactly 2 lines matching `^trade_preview_(project_url|publishable_key)\|`; no decrypted values leaked.
- [ ] `evidence/08-cron-jobs.txt` exists; contains all 3 expected cron job names; Q1-Q4 outputs are present.
- [ ] Live `SELECT COUNT(*) FROM cron.job WHERE active = true` returns ≥3.
- [ ] Live `SELECT COUNT(*) FROM cron.job WHERE active = true AND username <> 'postgres'` returns 0.
- [ ] Vault was populated BEFORE the next :00 cron tick (timestamp on `evidence/06-vault-secrets.txt` precedes the next hourly tick boundary).
</verification>

<success_criteria>
- DEP-SB-05: ≥3 active pg_cron jobs, every one running as `postgres`. Pitfall #18 satisfied.
- DEP-SB-06: Vault contains both `trade_preview_project_url` and `trade_preview_publishable_key`. Pitfall #11 timing window honored.
- The cleanup-trade-previews edge function (deployed in parallel Plan 04) will be invocable by `public.invoke_trade_preview_cleanup` cron callback at the next :00 tick.
</success_criteria>

<output>
After completion, create `.planning/phases/034-supabase-production-setup/034-03-SUMMARY.md` documenting:
- Vault: 2 named secrets in place (cite the 2 lines from evidence/06-vault-secrets.txt — names + lengths only, never values).
- pg_cron: count of active jobs (3 expected, possibly 4 if Stripe-event-log cron also scheduled). List each jobname + schedule.
- Confirmation that Vault was populated BEFORE the next :00 cron tick (compare timestamp on evidence/06 to the current hour).
- A note: "Plan 04 (Edge Functions + bucket + CORS) can run in parallel with this plan; both feed Plan 05 (DATABASE_URL doc + final verify)."
</output>
