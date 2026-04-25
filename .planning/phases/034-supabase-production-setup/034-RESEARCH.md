# Phase 34: Supabase Production Setup — Research

**Researched:** 2026-04-24
**Domain:** Supabase Cloud production provisioning (project creation, migration push, RLS verification, Edge Functions deploy, pg_cron + Vault setup, Storage bucket, pooler URL doc)
**Confidence:** HIGH on mechanics (Supabase CLI + dashboard flows are well-documented and the migration trail was already verified clean in Phase 33). MEDIUM on the few gotchas where official docs disagree with community patterns (CORS for Storage buckets, Storage TTL — flagged inline).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Region**
- D-01: Projeto `digswap-prod` criado em **`us-east-1`** (US East, N. Virginia). Razão: alinha com Vercel `iad1` minimizando RTT DB↔API serverless. Diverge do dev (us-west-2).

**Pricing / tier strategy**
- D-02: Lançamento em **Free-Tier, sem monetização**. Supabase Free + Vercel Hobby. Stripe Live deferido pós-MVP.
- D-03: `DEP-SB-08` (Supabase Pro active, auto-pause off) → **deferido**.
- D-04: **Aceitar auto-pause** do free-tier (7 dias de inatividade pausa o projeto; primeiro request após pausa tem ~1s cold wake-up). Consequência aceita: pg_cron jobs não executam durante pausa mas permanecem `active` (DEP-SB-05 ainda satisfeito).
- D-05: `DEP-SB-09` (PITR + rehearsed restore) → **deferido**. Backup diário automático do Supabase Free cobre MVP.

**Domain correction**
- D-06: Domínio real é **`digswap.com.br`**, não `digswap.com`. Toda URL de produção daqui em diante usa `.com.br`.

**Storage bucket CORS**
- D-07: CORS do bucket `trade-previews` configurado em Phase 34 com `https://digswap.com.br` + `https://www.digswap.com.br`. Origem hard-coded para o domínio real desde a criação do bucket.
- D-08: Bucket permanece `Public = off`, TTL de 48h via mecanismo já existente (preview_expires_at + cron + cleanup function).

**Migrations strategy**
- D-09: Migrations aplicadas exclusivamente via `supabase link --project-ref <prod-ref>` + `supabase db push --linked`. **Nunca** `drizzle-kit push` ou `drizzle-kit migrate` contra prod.
- D-10: Antes de cada comando destrutivo, confirmar manualmente que `supabase link` aponta para prod.
- D-11: Security Advisor rodado após o push — bloqueio da fase se qualquer tabela sem RLS aparecer. Teste sob role `authenticated` com JWT real, não só service_role.

**Vault + pg_cron**
- D-12: Vault populado **antes** de qualquer função agendada rodar. Secrets obrigatórios: `trade_preview_project_url` + `trade_preview_publishable_key`.
- D-13: pg_cron jobs rodam sob role `postgres` via `cron.schedule()`. Os 3+ jobs ativos esperados: `recalculate-rankings`, `trade-preview-cleanup`, `purge-soft-deleted-collection-items`.

**Connection pooler**
- D-14: `DATABASE_URL` de prod usa o pooler transaction-mode: `aws-0-us-east-1.pooler.supabase.com:6543` com `?pgbouncer=true`. Drizzle config usa `prepare: false`. Esta string **não** é escrita no Vercel nesta fase — só fica documentada para Phase 35 consumir.

### Claude's Discretion
- Flags exatas para `supabase db push` (ex.: `--dry-run` antes de live apply)
- Formato dos evidence snippets (screenshots vs psql output)
- Ordem de execução dentro da fase
- Protocolo de halt-on-fail (fix-forward vs Phase 34.1)
- Criação de audit user em prod (agora vs deferir para Phase 38)

### Deferred Ideas (OUT OF SCOPE)
- DEP-SB-08 — Supabase Pro activation (deferred post-MVP)
- DEP-SB-09 — PITR + rehearsed restore (deferred post-MVP, daily backup substitutes)
- Stripe Live activation (DEP-INT-01/02) — removed from MVP scope
- Vercel Pro upgrade — Phase 35/38 will revisit
- UptimeRobot keep-alive — Phase 39 if needed
- Doc-sync sweep `digswap.com` → `digswap.com.br` (Phase 34 planning decides: bulk in this phase OR follow-up QUICK)
- pg_cron behavior under auto-pause ADR (worth writing post-MVP)
- Audit user in prod (planner's call: now in Phase 34 OR defer to Phase 38)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEP-SB-01 | Separate `digswap-prod` Supabase project created (never shares with dev) | §"CLI command sequence" — dashboard creation step (no public API for project creation), `supabase projects list` confirmation, distinct project ref from dev |
| DEP-SB-02 | All migrations applied via `supabase db push` (never `drizzle-kit push` against prod) | §"Migration trail strategy" — 35 migrations validated reset-clean in Phase 33 evidence/02b, `--linked` + `--dry-run` workflow, ADR-003 enforces drizzle-prod-guard.mjs at script level |
| DEP-SB-03 | RLS verified — Security Advisor green, zero unprotected tables, zero policies referencing missing columns | §"Security Advisor + RLS evidence" — dashboard path, real-JWT test under role `authenticated` (Pitfall #5), psql repro recipe |
| DEP-SB-04 | Edge Functions deployed (`cleanup-trade-previews`, `validate-preview`) | §"Edge Function deployment" — `supabase functions deploy <name> --project-ref <prod>` syntax, env auto-injection (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY), curl smoke verification |
| DEP-SB-05 | pg_cron jobs active (`SELECT COUNT(*) FROM cron.job WHERE active` returns 3+) | §"pg_cron verification" — exact 3 expected jobs (ranking 15min, preview cleanup hourly, purge daily 03:00), Stripe event log cron is dormant per CONTEXT |
| DEP-SB-06 | Supabase Vault populated with secrets required by pg_cron (`trade_preview_project_url`, `trade_preview_publishable_key`) | §"Vault population recipe" — exact SQL via `public.vault_create_secret()` wrapper from migration 20260424000000, value sources (prod Supabase URL + anon publishable key) |
| DEP-SB-07 | `trade-previews` storage bucket created (CORS configured, 48h TTL, Public=off) | §"Storage bucket creation" — bucket created by migration 20260417 (Public=off enforced via SQL), CORS via dashboard, TTL via existing cron+cleanup mechanism (NOT native lifecycle — Supabase Storage has no lifecycle API) |
| DEP-SB-10 | `DATABASE_URL` uses PgBouncer transaction pooler on port 6543 with `prepare: false` | §"DATABASE_URL pooler format" — exact connection string template, query string `?pgbouncer=true`, Drizzle compatibility verified in `apps/web/src/lib/db/index.ts` |

**Deferred (NOT planned in Phase 34):**
- DEP-SB-08 (Supabase Pro + auto-pause off)
- DEP-SB-09 (PITR + rehearsed restore)
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These directives bind Phase 34 planning:

- **GSD workflow enforcement** — all repo edits MUST go through a GSD command. Phase 34 plans are executed via `/gsd:execute-phase 34`.
- **Solo developer constraint** — every plan step must be executable by one person; no team handoffs.
- **Stack already locked** — Next.js 15.5 + Supabase Cloud + Drizzle ORM + Tailwind v4. Phase 34 does not introduce new libraries.
- **Migration policy ADR-003** — `supabase/migrations/` is sole authoritative trail for prod. `drizzle-kit push` against prod is blocked by `scripts/drizzle-prod-guard.mjs`.
- **Skills available** — `digswap-dba` (migration/RLS review), `digswap-devops` (env/CI/Vercel), `digswap-sre` (production readiness). Plans should reference these where applicable.
- **CSP / security posture** — already hardened in Phase 33 (nonce + strict-dynamic). No new web-facing endpoints introduced in Phase 34.

## Summary

Phase 34 is pure infrastructure provisioning — no new application code is written. The 35-file migration trail in `supabase/migrations/` was independently verified to reset clean in Phase 33 (evidence file `02b-*` confirms `supabase db reset` against a throwaway Cloud project produced exit=0). Phase 34 takes that exact trail and applies it to a fresh `digswap-prod` project on Supabase Free in `us-east-1`, then layers seven configuration steps on top: Edge Function deploy, Vault secret insertion, Storage bucket CORS configuration, Security Advisor verification, pg_cron activation check, pooler URL documentation, and an explicit halt-on-fail protocol.

The risk profile is operational, not technical. Every command in this phase has a single correct invocation; the failure modes are: (a) running a destructive command against the wrong project ref (Pitfall #4 — solved by `supabase link` + manual `supabase projects list` confirmation before each push), (b) testing RLS only under `service_role` and missing real-user policy gaps (Pitfall #5 — solved by Security Advisor + a manual JWT-bound psql session), (c) triggering pg_cron before Vault is populated (Pitfall #11/#18 — solved by ordering: Vault writes BEFORE first cron tick window). Free-tier auto-pause is accepted as a consequence and not mitigated in this phase.

**Primary recommendation:** Execute as 7 sequential tasks, gated by an explicit halt-on-fail rule (catastrophic = drop+recreate, recoverable = fix-forward; Phase 34.1 only if scope grows past 2 hours of fixes). Use `--dry-run` before every `db push`. Capture all evidence as text artifacts (psql output, CLI stdout) in `evidence/`, plus dashboard screenshots only where SQL cannot prove the state (Security Advisor "green" badge, bucket CORS UI). Do NOT create the prod audit user in Phase 34 — defer to Phase 38 to keep prod data clean until UAT begins.

---

## 1. Phase Goal Restatement (Free-Tier Adjusted)

Provision a brand-new `digswap-prod` Supabase project in **us-east-1** on the **Free tier** (auto-pause accepted, no PITR), apply the entire `supabase/migrations/` trail (35 files) via `supabase db push --linked`, verify RLS via Security Advisor under `role authenticated` with a real JWT, deploy the two Edge Functions (`cleanup-trade-previews` and `validate-preview`), confirm at least 3 active pg_cron jobs (`recalculate-rankings`, `trade-preview-cleanup`, `purge-soft-deleted-collection-items`), populate Supabase Vault with `trade_preview_project_url` + `trade_preview_publishable_key` (resolved against the new prod project's URL + anon publishable key), confirm the `trade-previews` bucket exists with `public=false` (already enforced by migration 20260417) and add CORS allowing `https://digswap.com.br` + `https://www.digswap.com.br`, and finally document — but do NOT write into Vercel — the prod `DATABASE_URL` in pooler-transaction-mode format. The TTL behavior of 48h is satisfied by the existing `preview_expires_at` column + hourly `trade-preview-cleanup` cron + `cleanup-trade-previews` Edge Function combination, which is already in the migration trail; this phase does not add a new lifecycle mechanism. Stripe Live, Pro tier, and PITR are out of scope per the locked Free-Tier launch decision.

---

## 2. CLI Command Sequence (numbered, exact flags)

Pre-requisite: `supabase --version` ≥ `2.x` (already in devDependencies via `pnpm dlx supabase` or globally installed). User must be logged in: `supabase login` once per machine.

```bash
# 0. Sanity — confirm CLI is current and you are NOT linked to anything yet
supabase --version
supabase projects list  # confirm dev project is visible; prod project does NOT yet exist

# 1. CREATE PROJECT — DASHBOARD STEP (no CLI for this)
#    Go to https://supabase.com/dashboard/projects → New project
#    Org: <your org>
#    Name: digswap-prod
#    Database password: <strong, store in password manager>
#    Region: us-east-1 (US East, N. Virginia)
#    Pricing plan: Free
#    Wait ~2 min for provisioning. Capture the project ref shown in the URL
#    https://supabase.com/dashboard/project/<PROD_REF> — set as env var:
export PROD_REF="<the-ref-from-the-dashboard-URL>"
echo "PROD_REF=$PROD_REF"  # sanity print, must NOT match dev ref mrkgoucqcbqjhrdjcnpw

# 2. LINK CLI to prod (sticky across terminal sessions — re-confirm before every push)
supabase link --project-ref "$PROD_REF"
# Will prompt for the database password set in step 1.
# Verify link target:
cat supabase/.temp/project-ref  # MUST equal $PROD_REF, NOT mrkgoucqcbqjhrdjcnpw

# 3. DRY-RUN the migration trail — surfaces ordering/syntax errors before live apply
supabase db push --linked --dry-run
# Expected: prints all 35 migration filenames in lexical order with "would apply" status.
# If any file is flagged as "would skip" or "already applied" — STOP. The project is not empty.

# 4. APPLY MIGRATIONS — live push
supabase db push --linked
# Expected: each of the 35 files prints "Applying migration <file>" then "DONE".
# Capture stdout to evidence/04-db-push.txt for the verifier to replay.

# 5. SECURITY ADVISOR — DASHBOARD STEP
#    Dashboard → Project (digswap-prod) → Advisors → Security Advisor → Run
#    Expected status: GREEN with zero "Tables without RLS" and zero "Policy column mismatch" warnings.
#    Capture screenshot to evidence/05-security-advisor.png.

# 6. POPULATE VAULT — must run BEFORE first cron tick (D-12, Pitfall #11)
#    Direct psql via the session-mode connection (NOT pooler — Vault writes need a real session).
#    Use the connection string from Dashboard → Settings → Database → Connection string → URI (Session mode, port 5432)
#    Set as PROD_DIRECT_URL only in the current shell — never write to .env.local.
read -s -p "Paste PROD_DIRECT_URL (port 5432, NOT 6543): " PROD_DIRECT_URL
echo
psql "$PROD_DIRECT_URL" <<SQL
SELECT public.vault_create_secret(
  'https://${PROD_REF}.supabase.co',
  'trade_preview_project_url',
  'Phase 34 — prod project URL for pg_cron HTTP callbacks'
);
SELECT public.vault_create_secret(
  '<paste-prod-anon-publishable-key-from-dashboard>',
  'trade_preview_publishable_key',
  'Phase 34 — prod anon key used as Bearer for cleanup-trade-previews'
);
SQL
# Verify both secrets land:
psql "$PROD_DIRECT_URL" -c "SELECT name, created_at FROM vault.secrets WHERE name IN ('trade_preview_project_url','trade_preview_publishable_key');"
# Expected: 2 rows, both created within the last minute.

# 7. DEPLOY EDGE FUNCTIONS
supabase functions deploy cleanup-trade-previews --project-ref "$PROD_REF"
supabase functions deploy validate-preview --project-ref "$PROD_REF"
# Capture stdouts to evidence/07a-cleanup.txt and evidence/07b-validate.txt.
# NOTE: Edge Functions auto-receive SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the runtime —
# do NOT use `supabase secrets set` for those. `supabase secrets set` is ONLY needed if the
# functions reference custom env vars (these two do not).

# 8. VERIFY pg_cron — count active jobs
psql "$PROD_DIRECT_URL" -c "SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;"
# Expected: 3 rows — recalculate-rankings (every 15 min), trade-preview-cleanup (hourly),
# purge-soft-deleted-collection-items (daily 03:00 UTC). All active=true.

# 9. CONFIRM trade-previews bucket
psql "$PROD_DIRECT_URL" -c "SELECT id, name, public, file_size_limit FROM storage.buckets WHERE id='trade-previews';"
# Expected: public=false (NOT t), file_size_limit=536870912 (512 MB).

# 10. ADD CORS — DASHBOARD STEP (also CLI possible — see §8)
#     Dashboard → Storage → trade-previews bucket → Configuration → CORS
#     Add origins: https://digswap.com.br and https://www.digswap.com.br
#     Methods: GET, POST, PUT, DELETE, OPTIONS
#     Headers: Authorization, Content-Type, x-upsert, x-supabase-api-version
#     Max-age: 3600
#     Capture screenshot to evidence/10-cors.png.

# 11. SMOKE TEST Edge Function invocability (curl + JWT)
ANON_KEY="<paste-prod-anon-publishable-key>"
curl -X POST "https://${PROD_REF}.supabase.co/functions/v1/cleanup-trade-previews" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"source":"phase-34-smoke","bucket":"trade-previews"}'
# Expected: HTTP 200 with body {"deleted":0,"bucket":"trade-previews","updated":0}
# (zero deletes on a fresh prod with no preview rows yet).

# 12. UNLINK to avoid wrong-project drift in next session
supabase unlink   # or just leave it linked; re-confirm with `cat supabase/.temp/project-ref` next time
```

**Why `--dry-run` is mandatory before live push:** It is the single cheapest defense against the "applying out-of-order" failure mode. The 2026-04-23 audit found 7 distinct migration-ordering / drift bugs that the audit reset-clean test caught; `--dry-run` confirms the SAME set of files would be applied to prod as Phase 33's verified throwaway target.

**Why `supabase secrets set` is NOT in the sequence:** The 2 Edge Functions in this codebase (`cleanup-trade-previews`, `validate-preview`) only reference `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, both of which are auto-injected by the Supabase Edge runtime. There are no custom env vars to set. `supabase secrets set` is unrelated to Vault — it is the Edge Function env-var mechanism, NOT the pg_cron / Postgres secret mechanism. Vault is populated via SQL (step 6).

---

## 3. Migration Trail Strategy

**Inputs:**
- 35 migrations in `supabase/migrations/` (counted 2026-04-24).
- Phase 33 verification artifact `evidence/02b-throwaway-cloud.txt` proves the trail applies clean to an empty Supabase project (commit `090bdcc`).
- ADR-003 + `scripts/drizzle-prod-guard.mjs` block any accidental `drizzle-kit` against prod.

**Risk:** Project ref drift (Pitfall #4). The `supabase link` state is sticky across terminal sessions, so a midnight session that was last linked to dev can apply prod-intended SQL to dev, or vice versa.

**Strategy:**

1. **Two terminal-level safety checks before every push:**
   ```bash
   supabase projects list        # confirm prod ref is visible and active
   cat supabase/.temp/project-ref # confirm linked ref equals $PROD_REF, NOT dev (mrkgoucqcbqjhrdjcnpw)
   ```
2. **Always `--dry-run` first** — `supabase db push --linked --dry-run` enumerates every file the live push would apply, in order.
3. **Capture full stdout** of the live push to `evidence/04-db-push.txt`. This is the artifact the verifier replays.
4. **Idempotency claim** — every migration in the trail uses `IF NOT EXISTS` / `ON CONFLICT DO NOTHING` / `CREATE OR REPLACE` patterns (verified in audit Phase 33 Plan 03). Re-running `db push` on an already-applied trail is a no-op.
5. **Post-push schema diff sanity** — optional but cheap:
   ```bash
   supabase db dump --linked --schema-only -f /tmp/prod-schema.sql
   diff <(supabase db dump --linked=false --schema-only --db-url "$DEV_DIRECT_URL") /tmp/prod-schema.sql
   ```
   Expected: zero diff except for project-specific identifiers (project ref, timestamps in extension comments).

**No-go signals during dry-run:**
- "would skip" on any file — project not empty, abort and investigate.
- "would apply" includes a file NOT in the local trail — CLI cache stale, run `supabase migration list --linked` to confirm.
- Order in dry-run differs from `ls supabase/migrations/` — lexical sort drift, abort.

---

## 4. Security Advisor + RLS Evidence Protocol

**Why this matters:** Pitfall #5 — RLS policies that worked under `service_role` (used in dev for manual testing) silently fail under `authenticated` role (real users in prod). The Security Advisor catches the structural cases (table without policies, policy referencing missing column); a real-JWT psql session catches the semantic cases (policy returns empty for a legitimate user).

**Step A — Dashboard Security Advisor:**

1. Dashboard → Project (`digswap-prod`) → **Advisors** (left nav) → **Security Advisor**.
2. Click **Run advisor**. Wait ~30s.
3. Expected GREEN state:
   - "Tables without RLS enabled" → 0
   - "Policies that reference missing columns" → 0
   - "Functions without secure search_path" → 0 (or only the Supabase-managed ones we cannot fix)
4. Capture screenshot → `evidence/05-security-advisor.png`. Verifier needs visual confirmation; CLI cannot dump advisor state today.

**Step B — psql under `role authenticated` with a real JWT (Pitfall #5 concrete repro):**

This is the test that catches the difference between dev-with-service-role and prod-with-real-user.

```bash
# Generate a one-shot JWT for an arbitrary test user UUID. Use the prod JWT secret from
# Dashboard → Settings → API → JWT Secret. (For Phase 34 we don't need a real user yet — a
# constructed JWT for an arbitrary uuid is enough to prove RLS denies anonymous reads.)

# Quick approach with node (no extra deps):
node --input-type=module <<'EOF'
import jwt from 'jsonwebtoken';
const secret = process.env.PROD_JWT_SECRET;  // paste from dashboard
const token = jwt.sign(
  { sub: '00000000-0000-0000-0000-000000000001', role: 'authenticated', aud: 'authenticated' },
  secret,
  { expiresIn: '1h' }
);
console.log(token);
EOF
# Save the printed token as $TEST_JWT.

# Run a probe query as authenticated:
psql "$PROD_DIRECT_URL" <<SQL
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aud":"authenticated"}';
-- Sample probes (a fresh empty prod should always return 0 here):
SELECT COUNT(*) AS visible_profiles FROM public.profiles;        -- 0 expected
SELECT COUNT(*) AS visible_dms FROM public.direct_messages;      -- 0 expected
SELECT COUNT(*) AS visible_trades FROM public.trade_requests;    -- 0 expected
SELECT COUNT(*) AS visible_tokens FROM public.discogs_tokens;    -- 0 expected (RLS denies cross-user)
RESET ROLE;
SQL
```

If any probe returns >0 on an empty prod, RLS is misconfigured. Capture stdout → `evidence/05b-rls-probe.txt`.

**Negative sanity check:**

```bash
psql "$PROD_DIRECT_URL" -c "SET ROLE authenticated; SELECT COUNT(*) FROM public.handoff_tokens;"
# Expected: ERROR — handoff_tokens has USING (false) policy, denies all authenticated reads.
```

A success here (zero error, returned a row count) means RLS on a sensitive table failed. Capture as `evidence/05c-handoff-tokens-deny.txt`.

---

## 5. Edge Function Deployment + Invocation Verification

**Inputs:** `supabase/functions/cleanup-trade-previews/index.ts` (already implemented), `supabase/functions/validate-preview/index.ts` (already implemented), shared helpers in `supabase/functions/_shared/`.

**Deploy syntax (verified against current docs):**

```bash
supabase functions deploy cleanup-trade-previews --project-ref "$PROD_REF"
supabase functions deploy validate-preview --project-ref "$PROD_REF"
```

**Env vars:** Both functions read only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, both **auto-injected** by the Supabase Edge runtime. No `supabase secrets set` calls are needed for this phase. Confirmed in `cleanup-trade-previews/index.ts:5-6` and `validate-preview/index.ts:9-10`.

**Post-deploy verification — `cleanup-trade-previews`:**

```bash
ANON_KEY="<paste-prod-anon-key>"
curl -i -X POST "https://${PROD_REF}.supabase.co/functions/v1/cleanup-trade-previews" \
  -H "Authorization: Bearer ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"source":"phase-34-smoke","bucket":"trade-previews"}'
```

Expected: `HTTP/2 200` with body `{"deleted":0,"bucket":"trade-previews","updated":0}`. A 4xx means the function rejected the request shape; a 5xx means runtime error (likely SUPABASE_SERVICE_ROLE_KEY not yet propagated — wait 60s and retry).

**Post-deploy verification — `validate-preview`:**

This function requires a real user JWT (rejects anon). For Phase 34 a sanity check that the function endpoint exists and rejects anon properly is sufficient:

```bash
curl -i -X POST "https://${PROD_REF}.supabase.co/functions/v1/validate-preview" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `HTTP/2 401` with body `{"valid":false,"errors":["Missing bearer token."]}`. A 404 means the function is not deployed; a 200 means auth is bypassed (security regression — abort).

**Capture both responses to:** `evidence/07c-cleanup-curl.txt` and `evidence/07d-validate-curl.txt`.

**Deploy log capture:** `supabase functions deploy ... 2>&1 | tee evidence/07a-cleanup-deploy.log`.

---

## 6. Vault Population Recipe (exact SQL)

**Why Vault, not `supabase secrets set`:** The pg_cron job `trade-preview-cleanup` is a SQL function (`public.invoke_trade_preview_cleanup` defined in migration `20260417_trade_preview_infrastructure.sql:125-169`) that reads from `vault.decrypted_secrets`. It cannot read Edge Function env vars. The only way to feed values into pg_cron's runtime is via Supabase Vault.

**Wrapper origin:** Migration `20260424000000_enable_vault_extension.sql` (Phase 33.1) installed `public.vault_create_secret(text, text, text)` as a SECURITY DEFINER wrapper around the actual `vault.create_secret(text, text, text, uuid)` function. PostgREST routes `rpc(...)` to public schema only; the wrapper bridges that gap. It is idempotent — running on fresh prod is a no-op for the extension, and inserts the wrapper functions cleanly.

**Secret values:**

| Secret name | Value | Source |
|-------------|-------|--------|
| `trade_preview_project_url` | `https://<PROD_REF>.supabase.co` | The new prod project URL — appears as `Project URL` in Dashboard → Settings → API |
| `trade_preview_publishable_key` | The prod **anon publishable key** (NOT service_role) | Dashboard → Settings → API → `anon` `public` key. This key is safe to embed in the Vault row because it is also exposed to the browser anyway. |

**SQL recipe — run via psql against PROD_DIRECT_URL (session-mode, port 5432):**

```sql
-- Idempotent: deletes any existing entry first to avoid name collisions on retry.
SELECT public.vault_delete_secret('trade_preview_project_url');
SELECT public.vault_delete_secret('trade_preview_publishable_key');

-- Create both secrets. Description is optional but makes audit trail readable.
SELECT public.vault_create_secret(
  'https://YOUR_PROD_REF.supabase.co',
  'trade_preview_project_url',
  'Phase 34 — prod project URL consumed by trade-preview-cleanup pg_cron job'
);

SELECT public.vault_create_secret(
  'YOUR_PROD_ANON_PUBLISHABLE_KEY',
  'trade_preview_publishable_key',
  'Phase 34 — prod anon publishable key used as Bearer auth for cleanup-trade-previews edge function'
);

-- Verify both secrets land:
SELECT name, created_at, length(decrypted_secret) AS value_len
FROM vault.decrypted_secrets
WHERE name IN ('trade_preview_project_url', 'trade_preview_publishable_key')
ORDER BY name;
```

Expected verify output:
```
              name              |          created_at           | value_len
--------------------------------+-------------------------------+-----------
 trade_preview_project_url      | 2026-04-XX XX:XX:XX.XXXXXX+00 |  ~40 chars
 trade_preview_publishable_key  | 2026-04-XX XX:XX:XX.XXXXXX+00 | ~220 chars (Supabase JWT)
```

Capture to `evidence/06-vault-secrets.txt`.

**Timing rule (Pitfall #11):** Vault MUST be populated **before** the first scheduled tick of `trade-preview-cleanup` (every hour at minute 0). On a fresh prod created at e.g. 14:23, the first cron tick lands at 15:00 — that's a 37-minute window during which Vault must be populated, otherwise the first invocation logs `RAISE NOTICE 'Skipping... Vault secrets not configured'` (visible in `cron.job_run_details`). Functionally not destructive (the function exits cleanly), but creates noise in the audit trail. Plan to populate Vault within the same task as the migration push.

---

## 7. pg_cron Verification Queries

**Expected jobs after migration push:**

| jobname | schedule | command | source migration |
|---------|----------|---------|------------------|
| `recalculate-rankings` | `*/15 * * * *` | `SELECT recalculate_rankings()` | `20260327_ranking_function.sql:86-90` |
| `trade-preview-cleanup` | `0 * * * *` | `SELECT public.invoke_trade_preview_cleanup();` | `20260417_trade_preview_infrastructure.sql:187-191` |
| `purge-soft-deleted-collection-items` | `0 3 * * *` | `DELETE FROM collection_items WHERE deleted_at < ...` | `20260419_purge_soft_deleted.sql:14-18` |

The Stripe-event-log cron from `20260106_drizzle_0005_stripe_event_log.sql` is **dormant per CONTEXT D** — table exists but no webhook writes to it on Free-Tier launch. Inspect the migration to confirm whether it schedules a cron job; if it does, the count is 4 (still ≥3, satisfying DEP-SB-05).

**Verification SQL:**

```sql
-- Count active jobs (DEP-SB-05 minimum: 3)
SELECT COUNT(*) AS active_jobs FROM cron.job WHERE active = true;

-- Detail listing — confirm names + schedules
SELECT jobid, jobname, schedule, active, command
FROM cron.job
ORDER BY jobid;

-- Confirm jobs run as 'postgres' role (Pitfall #18)
SELECT jobid, jobname, username
FROM cron.job
ORDER BY jobid;
-- Expected: every row's username = 'postgres'
```

If `username` for any job is NOT `postgres`, the job will silently no-op on Supabase Cloud. Fix by re-creating under `SET ROLE postgres` — but in this codebase all 3 cron-creating migrations use plain `cron.schedule(...)` from a migration that runs as `postgres` already, so this should be a verification step, not a fix step.

**Auto-pause caveat (D-04):** Free-tier projects pause after 7 days of zero traffic. While paused, `cron.job` rows remain `active=true` (so DEP-SB-05 stays green) but `cron.job_run_details` will show no recent runs. To check post-launch:

```sql
SELECT jobid, status, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC LIMIT 10;
```

Empty result on a paused project is expected. Active project should show runs every 15 min for `recalculate-rankings`.

Capture all three queries' output to `evidence/08-cron-jobs.txt`.

---

## 8. Storage Bucket Creation (CORS, TTL clarification)

**Bucket creation:** **Already in the migration trail.** `supabase/migrations/20260417_trade_preview_infrastructure.sql:39-68` does:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('trade-previews', 'trade-previews', false, 536870912, ARRAY[...]::text[])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, ...;
```

This means after Step 4 (`supabase db push --linked`), the bucket already exists with `public=false`. Phase 34 does NOT need a separate "create bucket" step — only verify and configure CORS.

**CORS — confirmed: Supabase Storage CORS is configured per-bucket via DASHBOARD or CLI.** Dashboard path: Storage → `trade-previews` → Configuration → CORS. UI accepts allowed origins, methods, headers, and max-age.

**CORS via CLI (alternative — D-07 hard-codes origin so this is one-shot):**

```bash
supabase storage update-bucket-cors \
  --bucket-name trade-previews \
  --cors-config '{
    "allowedOrigins": ["https://digswap.com.br", "https://www.digswap.com.br"],
    "allowedMethods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "allowedHeaders": ["Authorization", "Content-Type", "x-upsert", "x-supabase-api-version"],
    "maxAgeSeconds": 3600
  }' \
  --project-ref "$PROD_REF"
```

⚠ **MEDIUM confidence on this CLI form.** Search results show this command exists but documentation coverage is thin — community discussions (Supabase issue #29421) suggest some users hit edge cases. Recommend dashboard approach as primary and CLI as backup. Capture screenshot of the dashboard CORS state as `evidence/10-cors-dashboard.png`.

**Consequence of D-07:** Any pre-cutover testing from `*.vercel.app` URLs will fail CORS. Intentional — forces all real upload flows through the official domain only.

**TTL — IMPORTANT CLARIFICATION:**

Supabase Storage **has no native lifecycle policy / TTL feature**. (Verified 2026-04-24 via official docs + community discussions — feature is requested but not shipped.) The 48h TTL for trade previews is **already implemented** as a 3-piece mechanism:

1. **Per-object expiration timestamp** — `trade_proposal_items.preview_expires_at` (column added in migration 20260417). Application code sets this to `now() + interval '48 hours'` when uploading a preview.
2. **Hourly pg_cron sweeper** — `trade-preview-cleanup` job (defined in migration 20260417) calls `public.invoke_trade_preview_cleanup()` every hour at `:00`.
3. **Edge Function executor** — `cleanup-trade-previews/index.ts` queries `trade_proposal_items WHERE preview_expires_at <= NOW()`, removes the storage objects via `admin.storage.from('trade-previews').remove(paths)`, then NULLs out the row's `preview_storage_path` and `preview_expires_at`.

**Therefore: DEP-SB-07's "48h TTL" is satisfied by Phase 34 IF AND ONLY IF Steps 4 (migrations), 6 (Vault), 7 (Edge Function deploy), and 8 (cron verification) all land. There is no separate lifecycle rule to add.**

This insight saves the planner an entire phantom task. Document this clearly in PLAN so the executor doesn't waste time looking for a Storage lifecycle UI that doesn't exist.

---

## 9. DATABASE_URL Pooler Format + Drizzle Compatibility

**Format (verified against Pitfall #17 + supabase-production.md):**

```
postgresql://postgres.<PROD_REF>:<DB_PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Components:
- `postgres.<PROD_REF>` — the user is literally `postgres.{project_ref}` for pooled connections (NOT just `postgres`)
- `<DB_PASSWORD>` — set during step 1 (DASHBOARD project creation), URL-encode any special chars
- `aws-0-us-east-1` — host prefix MUST match the chosen region; us-east-1 is locked per D-01
- `:6543` — transaction pooler port (NOT direct `:5432`)
- `?pgbouncer=true` — query string flag that the postgres driver and Drizzle both honor

**Drizzle compatibility — confirmed in `apps/web/src/lib/db/index.ts`:**

The existing dev config uses `prepare: false` (verified per ADR-003 + supabase-production.md). The same code, when given the prod pooler URL, will work without modification. No code change needed for Phase 34.

**Where this URL goes (NOT now, NOT here):**

This phase **only documents** the URL template. The actual write to Vercel env vars happens in Phase 35 (DEP-VCL-02). Document the URL template in `evidence/14-database-url-template.txt` (NOT the URL with the real password — keep that in a password manager only).

**Phase 35 will need:**
- `DATABASE_URL` = pooler URL above (Production scope, sensitive)
- `NEXT_PUBLIC_SUPABASE_URL` = `https://<PROD_REF>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = same anon key Vault has
- `SUPABASE_SERVICE_ROLE_KEY` = service role from Dashboard → Settings → API (NOT in Vault, used by app server-side only)

Phase 34 surfaces these values for Phase 35 — does not write them anywhere.

---

## 10. Halt-on-Fail Protocol (recommended default)

**Recommendation for the planner to bake into 034 plans:**

| Failure Mode | Severity | Action | Why |
|--------------|----------|--------|-----|
| `supabase link` fails (wrong password, network) | LOW | Retry up to 3× | Transient |
| `supabase db push --linked --dry-run` reports "would skip" or "already applied" on a fresh project | HIGH | Stop. Verify project ref. If correct project, drop+recreate. | Indicates project was not actually empty (someone else applied migrations) |
| `supabase db push --linked` fails MID-trail (file N applies, file N+1 errors) | CRITICAL | **Drop+recreate the project from Dashboard.** Do not attempt fix-forward. | Migration trail is non-transactional; partial state is unrecoverable on Free tier (no PITR per D-05). Recreating loses zero data because prod is empty. |
| Single migration file has a syntax error caught by `--dry-run` | MEDIUM | Fix the SQL file in repo, re-run dry-run, then live push. | Fixable in source; same fix applies cleanly to the empty prod (idempotent migrations). |
| Security Advisor reports a regression | HIGH | **Halt. Open Phase 34.1 if fix exceeds 2h.** Do not push more changes. | Fix-forward is acceptable for a single small policy gap, but multiple reds = systemic issue worth a planning round-trip. |
| Edge Function deploy fails (build error, runtime error) | MEDIUM | Re-run `supabase functions deploy`. If persistent, check function code in `supabase/functions/<name>/index.ts`. | Function deploys are independent of DB state; safe to retry. |
| Vault secret insertion errors | HIGH | Halt. Investigate via `psql` directly. Likely root cause: extension didn't install (check `\dx vault`) | Without Vault, pg_cron silently skips the cleanup job. Not catastrophic short-term but makes evidence file 06 incomplete. |
| CORS dashboard / CLI fails | LOW | Retry. If persistent, fall back to dashboard (CLI is MEDIUM confidence). | Cosmetic blocker only — bucket already exists with correct public=false. |

**Default rule — bake into planning:** _"If a step exceeds 30 minutes of fix attempts, OR if multiple steps fail during the same session, OR if the failure required dropping the prod project once already, halt and open Phase 34.1. Otherwise fix-forward inline."_

**Drop+recreate procedure (catastrophic only):**
1. Dashboard → Project Settings → General → **Pause project** then **Delete project**
2. Wait ~2 min for resource teardown
3. Repeat Step 1 of §2 (create new project, get new PROD_REF)
4. Update PROD_REF env var, re-link
5. Resume from Step 3 (`db push --dry-run`)

Drop+recreate is acceptable on Phase 34 because **prod has no user data yet**. After Phase 38 (UAT users in prod), drop+recreate becomes destructive.

---

## 11. Doc-Debt Handling (`digswap.com` → `digswap.com.br`)

**Scope of debt:** 64 occurrences across 12 files (verified 2026-04-24 via `grep "digswap\.com[^.]"` in repo):

| File | Count | Category |
|------|-------|----------|
| `.planning/research/PITFALLS.md` | 14 | Research doc |
| `.planning/research/ARCHITECTURE.md` | 17 | Research doc |
| `.planning/research/STACK.md` | 8 | Research doc |
| `.planning/research/SUMMARY.md` | 5 | Research doc |
| `.planning/ROADMAP.md` | 4 | Roadmap |
| `.planning/research/ADR-001-strategic-direction.md` | 2 | ADR |
| `.planning/phases/10-positioning-radar-workspace/10-04-PLAN.md` | 2 | Old phase plan (closed) |
| `.planning/phases/034-supabase-production-setup/034-DISCUSSION-LOG.md` | 4 | Phase 34 working doc |
| `.planning/phases/034-supabase-production-setup/034-CONTEXT.md` | 2 | Phase 34 context (already correct? may be referencing the old name in passing) |
| `.pi/agent/skills/digswap-devops/references/environment-strategy.md` | 2 | Skill reference |
| `.pi/agent/skills/digswap-sre/workflows/health-check.md` | 3 | Skill workflow |
| `.pi/reports/sre-prr-report.md` | 1 | Skill report |

**Recommendation: Open a follow-up QUICK after Phase 34 execution, NOT bundle into Phase 34 plans.**

**Rationale:**
1. **Phase 34 is infrastructure-only** — bundling 64 doc edits across 12 files inflates the phase scope by 30+ minutes of pure search-and-replace work that has zero infrastructure dependency.
2. **Sed-able pattern** — the substitution is mechanical (`digswap\.com\b` → `digswap.com.br` with manual review of each hit; some PITFALLS.md occurrences are inside example commands like `dig CAA digswap.com` that will need updating to `digswap.com.br`).
3. **Risk of intermixing concerns** — if the doc sweep introduces a regression or merge conflict, it would block Phase 34 commits unnecessarily.
4. **GSD QUICK is the right primitive** for "atomic, mechanical, low-risk repo-wide change" — exactly this shape.

**Suggested QUICK title:** `quick-260424-rename-digswap-com-to-digswap-com-br` (post-Phase-34).

**Files to leave alone:**
- Closed phase plans (`phases/10-04-PLAN.md`) — historical record, do not edit
- `.pi/reports/sre-prr-report.md` — historical artifact

**Files to update in the QUICK:** the other 10 files (research/*, ROADMAP, ADRs, skill references, current Phase 34 working docs).

---

## 12. Audit User Creation — Recommendation

**Question:** Create the prod audit user (e.g., `audit+prod@digswap.test`) during Phase 34 (now) or defer to Phase 38 (UAT)?

**Recommendation: Defer to Phase 38.**

**Rationale:**
1. **Phase 34 has no use for the audit user.** None of the 7 verification steps in §2 require an authenticated session against the prod app — the JWT-bound RLS probe in §4 uses a constructed JWT for an arbitrary UUID, not a real Supabase Auth row.
2. **Prod stays "clean" until smoke tests run.** No real Auth rows exist until Phase 38, which makes any anomaly in `auth.users` during Phase 35-37 trivially traceable. Adding a row in Phase 34 muddies that signal.
3. **Phase 33.1 already established the pattern.** The Admin API approach (`POST /auth/v1/admin/users` with `email_confirm=true`) is documented in CONTEXT D-Phase-33.1 — Phase 38 just calls the same recipe against prod. No additional research debt.
4. **Cost of deferring is zero.** Phase 38 is 4 phases away in execution time but the procedure takes ~5 minutes. Adding it to Phase 34 saves nothing operationally and adds noise to the artifact set.

**Phase 34 plans should NOT include any `auth.users` writes.** Document the deferral explicitly in plan SUMMARY: "Audit user creation: deferred to Phase 38 per RESEARCH §12."

---

## Architecture Patterns

### Pattern 1: Dashboard-create + CLI-link + CLI-push

**What:** New Supabase project lifecycle is split between dashboard (creation, pricing tier, region selection) and CLI (everything else).
**When to use:** Always for Supabase Cloud — there is no public API for project creation.
**Example:**
```bash
# Step 1: dashboard creates project, you copy the project ref out of the URL
# Step 2: CLI takes over
supabase link --project-ref "$PROD_REF"
supabase db push --linked --dry-run
supabase db push --linked
```

### Pattern 2: psql session-mode for one-shot SQL, pooler-mode for app runtime

**What:** Two connection strings exist. Use direct (port 5432) for migrations, Vault writes, and any one-shot DDL; use pooler (port 6543) for the running Next.js app.
**When to use:** Phase 34 uses ONLY direct (5432) because everything is one-shot. Phase 35 introduces pooler for app runtime.

### Pattern 3: SQL-create + dashboard-CORS for Storage buckets

**What:** Bucket creation is in a migration (idempotent SQL `INSERT INTO storage.buckets`), but CORS configuration is dashboard-only or via the (less stable) `supabase storage update-bucket-cors` CLI.
**Example:** See migration `20260417_trade_preview_infrastructure.sql:39-68` — bucket and RLS policies created in SQL; CORS layered on via dashboard step in §8.

### Pattern 4: Vault-via-public-wrapper for PostgREST RPC

**What:** `vault.create_secret` is in the `vault` schema and not exposed by PostgREST. The `public.vault_create_secret` SECURITY DEFINER wrapper (from migration `20260424000000_enable_vault_extension.sql`) bridges the gap.
**When to use:** Anywhere app code or psql calls need to create a Vault secret — use the public wrapper, not the vault.create_secret directly.

### Anti-Patterns to Avoid

- **Running `drizzle-kit push` against prod** — blocked by `scripts/drizzle-prod-guard.mjs`, but worth restating: ADR-003 makes `supabase/migrations/` the only authoritative trail.
- **Using `supabase secrets set` for pg_cron secrets** — `supabase secrets set` is for Edge Function env vars only. pg_cron reads from `vault.decrypted_secrets`. Confusing the two will cause the cleanup cron to silently skip every tick.
- **Linking and immediately pushing without a dry-run** — every push starts with `--dry-run`. No exceptions.
- **Testing RLS only with `service_role`** — bypasses every policy. Always test with a real JWT under `role authenticated`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Project creation API | Custom REST call to Supabase management API | Dashboard manual step | No public API for project creation; private one is unstable |
| Migration runner | A custom node script that loops over `supabase/migrations/*.sql` and runs psql | `supabase db push --linked` | The CLI handles the `supabase_migrations.schema_migrations` history table for you; rolling your own desyncs the journal |
| Vault SDK | Direct REST calls to `/rest/v1/rpc/vault_create_secret` | Use the existing wrapper via psql | The wrapper is SECURITY DEFINER and idempotent; the REST call requires extra header juggling |
| TTL for Storage | A new lifecycle policy mechanism, S3-style | Existing per-object `preview_expires_at` + hourly cron | Supabase Storage has no native lifecycle; the trade-preview-cleanup mechanism is already validated |
| Custom JWT generator for RLS testing | A dedicated test harness | One-shot `node -e` with `jsonwebtoken` package | Phase 34 needs JWT generation exactly once for RLS probes; harness is overkill |

**Key insight:** Phase 34 is provisioning, not engineering. Every "how do I X" already has an answer in the supabase CLI / dashboard / existing migrations. Hand-rolling adds risk for zero benefit.

## Runtime State Inventory

> Phase 34 creates fresh runtime state on a new prod project. There is no rename / refactor / migration of existing data, so most categories are inapplicable.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — prod project is brand new and empty | Migrations populate schema; Vault populated explicitly in Step 6 |
| Live service config | Supabase Dashboard config: project name, region, billing tier, Storage CORS, Security Advisor advisor state. NOT in git. | Dashboard manual ops, captured to `evidence/` as screenshots |
| OS-registered state | None — Supabase Cloud is fully managed | None |
| Secrets / env vars | NEW: `PROD_REF`, `PROD_DIRECT_URL`, prod DB password, prod anon key, prod service role key. None of these go to git. | Operator stores in password manager + uses one-shot env exports during Phase 34 commands |
| Build artifacts | None — Phase 34 deploys Edge Functions but those are server-side TypeScript, no build artifact tracked locally beyond `supabase/functions/` source | None |

**Nothing found in category "Stored data":** Verified by — prod project is created fresh in Step 1; no pre-existing data exists.
**Nothing found in category "OS-registered state":** Verified by — Supabase Cloud is SaaS, no OS-level service registration involved.

## Common Pitfalls

### Pitfall 1: Project ref drift (Pitfall #4 from PITFALLS.md)
**What goes wrong:** `supabase link` is sticky. A midnight session that was last linked to dev runs `supabase db push` thinking it's prod.
**Why it happens:** Solo dev tired; CLI gives no visual cue about which project is linked.
**How to avoid:** Always run `cat supabase/.temp/project-ref` BEFORE every `db push` / `db reset` invocation. Compare against the documented `$PROD_REF`. Stash this as a one-line bash function:
```bash
confirm-link() { local expected=$1; local actual=$(cat supabase/.temp/project-ref); [ "$actual" = "$expected" ] && echo "✓ linked to $actual" || (echo "✗ EXPECTED $expected got $actual"; return 1); }
confirm-link "$PROD_REF" || exit 1
```
**Warning signs:** `supabase db push --dry-run` shows "would skip" on every file — that means migrations are already applied somewhere.

### Pitfall 2: RLS works in dev because service_role bypasses (Pitfall #5)
**What goes wrong:** Every dev query hits Supabase via the service_role admin client. RLS never runs. Same query in prod under real user JWT returns empty.
**Why it happens:** `apps/web/src/lib/supabase/admin.ts` exists for legitimate reasons (Vault writes, cron callbacks); developers default to it.
**How to avoid:** Step 4 §B in this document — run a JWT-bound psql probe against an empty prod and assert `0 visible_*` for tables that should be RLS-locked.
**Warning signs:** Security Advisor green but app returns "no results" for a logged-in user with valid data.

### Pitfall 3: Vault not populated before first cron tick (Pitfall #11)
**What goes wrong:** `trade-preview-cleanup` runs every hour at `:00`. If Vault is empty, the function `RAISE NOTICE 'Skipping...'` and returns. Functionally fine but pollutes `cron.job_run_details`.
**Why it happens:** Migration push happens in Step 4, Vault populates in Step 6 — easy to forget Step 6 if execution is interrupted.
**How to avoid:** In planning, batch Steps 4-6 into a single task so the executor cannot leave the project in "migrations applied but Vault empty" state.
**Warning signs:** `SELECT COUNT(*) FROM cron.job_run_details WHERE return_message ILIKE '%Skipping%'` returns nonzero rows.

### Pitfall 4: Pooler URL on port 5432 instead of 6543 (Pitfall #17)
**What goes wrong:** App connects in serverless. Within minutes, exhausts max connections (25 on Free).
**Why it happens:** Two URLs exist in the dashboard (Session 5432 vs Transaction 6543); copy-paste the wrong one.
**How to avoid:** Phase 34 only documents the URL template; explicit string check `:6543` + `?pgbouncer=true`. Phase 35 inherits this template — if it ends up in Vercel without `:6543`, abort that phase.
**Warning signs:** `prepared statement "..." does not exist` errors intermittently in app logs (means port is right but `prepare: false` was lost).

### Pitfall 5: pg_cron job under wrong role (Pitfall #18)
**What goes wrong:** Job created under role X with no cron privileges → silent no-op.
**Why it happens:** Migration runner role differs from `postgres` on some self-hosted setups.
**How to avoid:** On Supabase Cloud, migrations run as `postgres` by default — no fix needed. Verify post-push: `SELECT username FROM cron.job` — every row must say `postgres`.
**Warning signs:** Rankings stale, cleanup never runs, but `cron.job` rows show `active=true`.

### Pitfall 6: Storage bucket Public default flipped at creation (Pitfall #20)
**What goes wrong:** Newer Supabase versions default Public=off, but if an admin clicks the bucket and toggles "Make public" by accident, every uploaded preview is world-readable.
**Why it happens:** Dashboard UI gives a single click to toggle Public.
**How to avoid:** Migration 20260417 enforces `public = false` via `ON CONFLICT DO UPDATE SET public = EXCLUDED.public`. Re-running the migration resets the flag. Verify post-push: `SELECT public FROM storage.buckets WHERE id='trade-previews'` MUST return `f`.
**Warning signs:** A `curl https://<ref>.supabase.co/storage/v1/object/public/trade-previews/...` returns 200 instead of 404.

## Code Examples

### Verifying the migration trail before push
```bash
# Source: §3 Migration Trail Strategy + Phase 33 evidence/02b-throwaway-cloud.txt
supabase projects list
cat supabase/.temp/project-ref
[ "$(cat supabase/.temp/project-ref)" = "$PROD_REF" ] || exit 1
supabase db push --linked --dry-run | tee evidence/03-dry-run.txt
```

### Vault population (idempotent)
```sql
-- Source: migration 20260424000000_enable_vault_extension.sql
SELECT public.vault_delete_secret('trade_preview_project_url');
SELECT public.vault_create_secret(
  'https://<PROD_REF>.supabase.co',
  'trade_preview_project_url',
  'Phase 34 — prod URL'
);
```

### RLS probe under authenticated role
```sql
-- Source: PITFALLS.md Pitfall #5 + this RESEARCH §4 Step B
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aud":"authenticated"}';
SELECT COUNT(*) FROM public.discogs_tokens;  -- expected: 0
RESET ROLE;
```

### Edge Function smoke test
```bash
# Source: cleanup-trade-previews/index.ts behavior contract
curl -i -X POST "https://${PROD_REF}.supabase.co/functions/v1/cleanup-trade-previews" \
  -H "Authorization: Bearer ${PROD_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"source":"phase-34-smoke","bucket":"trade-previews"}'
# Expected: HTTP/2 200, body {"deleted":0,"bucket":"trade-previews","updated":0}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Two migration trails (drizzle/ + supabase/migrations/) silently diverging | `supabase/migrations/` is sole authoritative trail; `scripts/drizzle-prod-guard.mjs` blocks drizzle-kit against prod | 2026-04-23 (commit 090bdcc, Phase 33 Plan 03 + ADR-003) | Phase 34 has a single deterministic source of truth |
| `discogs_tokens` plaintext fallback | Vault-only via `public.vault_create_secret` wrapper | 2026-04-24 (Phase 33.1 Plan 01) | Vault wrapper is in the migration trail; Phase 34 inherits the fix |
| `auth-helpers-nextjs` (deprecated) | `@supabase/ssr` for App Router | Already in package.json | Mentioned only — not a Phase 34 concern |
| `next lint` (deprecated) | Biome | Already in repo | Mentioned only — not a Phase 34 concern |

**Deprecated/outdated:**
- `drizzle-kit push` against prod: blocked by guard script, never to be used.
- Plaintext token storage in `discogs_tokens` table: Phase 33.1 hardened oauth.ts to throw on Vault failure; the table remains for `deleteTokens()` cleanup of legacy rows only.

## Open Questions

1. **Does the Stripe-event-log migration `20260106_drizzle_0005_stripe_event_log.sql` schedule a pg_cron job?**
   - What we know: CONTEXT D mentions a `cleanup-stripe-event-log` cron that "may be left active or unschedule explicitly."
   - What's unclear: did the migration actually schedule it, and if so, will it appear in `cron.job` (making the count 4 instead of 3)?
   - Recommendation: After Step 8 (cron verification), if 4 jobs appear, either leave the dormant job (zero impact, table never gets writes in Free-Tier launch) or `SELECT cron.unschedule(<jobid>)` to keep the surface area minimal. Planner decides.

2. **CORS via CLI — confidence MEDIUM.**
   - What we know: `supabase storage update-bucket-cors` exists and accepts a JSON config.
   - What's unclear: Documentation coverage is thin and community discussions report edge cases.
   - Recommendation: Use dashboard as primary path; CLI as backup if dashboard is down. Capture both as evidence if both attempted.

3. **Free-tier auto-pause + pg_cron interaction.**
   - What we know: Auto-pause halts all activity including pg_cron. CONTEXT D-04 accepts this. `cron.job` rows remain `active=true` so DEP-SB-05 stays green.
   - What's unclear: Will `cron.job_run_details` show "missed" runs when the project unpauses, or do those runs simply disappear? Does the next tick on unpause double-execute?
   - Recommendation: Not a Phase 34 blocker. Worth a small experiment in a throwaway project to confirm behavior — defer to a follow-up note in `STATE.md` after Phase 34 lands.

4. **Custom-domain Storage URL stays at `<PROD_REF>.supabase.co`.**
   - What we know: Custom domains for Supabase Storage require Pro tier per the supabase-production.md skill reference.
   - What's unclear: Will the Storage upload URL embedded in app bundles change between Free and a future Pro upgrade? If yes, the URL must not be hard-coded in app code.
   - Recommendation: Phase 34 plans must NOT bake the prod Supabase URL into client bundles — it goes through `NEXT_PUBLIC_SUPABASE_URL` (Phase 35). On future Pro upgrade, only the env var changes, no code change. This is already the pattern; flagging only as a reminder.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | All Phase 34 steps | ✓ (presumed; in repo devDependencies) | 2.x (verify with `supabase --version`) | None — required |
| psql client (libpq) | Steps 6, 7, 8, 9 | Likely available on user's machine via Postgres install or git-bash | Any 14+ | Could use Supabase Dashboard SQL Editor as fallback for one-shot queries |
| node | Step 4 JWT generation | ✓ (project uses Node 20+) | 20.x | None |
| `jsonwebtoken` npm pkg (one-shot) | Step 4 JWT generation | likely available transitively, else `pnpm dlx jsonwebtoken` | Any | Use Dashboard SQL Editor's `auth.jwt()` helper instead |
| Browser (for Dashboard) | Steps 1, 5, 10 | ✓ | Modern | None — Dashboard is the only path to Security Advisor and CORS UI |
| Password manager | Storing PROD_REF, DB password, anon key, service role key | User's discipline | n/a | None — secrets must not go to disk |

**Missing dependencies with no fallback:** None expected.
**Missing dependencies with fallback:** psql could be substituted by Dashboard SQL Editor for ad-hoc queries.

## Validation Architecture

> Mandatory per Nyquist gate (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — Phase 34 is infrastructure, not application code. Verification is via psql + curl + Dashboard inspection, not via vitest/playwright. |
| Config file | none — see Wave 0 |
| Quick run command | `bash .planning/phases/034-supabase-production-setup/scripts/verify.sh` (planner creates this in Wave 0) |
| Full suite command | Same — there is no separate "quick" vs "full" for infra phases |
| Phase gate | All evidence files present in `evidence/`, all manual screenshot artifacts captured, halt-on-fail protocol respected |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEP-SB-01 | Separate `digswap-prod` project exists, distinct ref from dev | manual + CLI | `supabase projects list \| grep digswap-prod && [ "$(cat supabase/.temp/project-ref)" != "mrkgoucqcbqjhrdjcnpw" ]` | ❌ Wave 0 — verify.sh |
| DEP-SB-02 | All 35 migrations applied via supabase db push, no drizzle-kit | CLI | `supabase migration list --linked \| wc -l` ≥ 35; AND `node scripts/drizzle-prod-guard.mjs` exits 0 | ❌ Wave 0 |
| DEP-SB-03 | Security Advisor green; RLS denies anon reads on RLS-locked tables | manual (dashboard) + psql | dashboard screenshot + psql RLS probe under role authenticated | ❌ Wave 0 — manual + scripted |
| DEP-SB-04 | Both Edge Functions deployed and invocable | curl | `curl -X POST .../functions/v1/cleanup-trade-previews` returns 200; `curl .../validate-preview` returns 401 (anon) | ❌ Wave 0 |
| DEP-SB-05 | ≥3 active pg_cron jobs | psql | `psql -c "SELECT COUNT(*) FROM cron.job WHERE active"` ≥ 3 | ❌ Wave 0 |
| DEP-SB-06 | Vault has both required secrets | psql | `psql -c "SELECT name FROM vault.decrypted_secrets WHERE name IN ('trade_preview_project_url','trade_preview_publishable_key')"` returns 2 rows | ❌ Wave 0 |
| DEP-SB-07 | trade-previews bucket exists, public=false, CORS configured | psql + dashboard | `psql -c "SELECT public FROM storage.buckets WHERE id='trade-previews'"` returns `f`; CORS screenshot | ❌ Wave 0 — manual + scripted |
| DEP-SB-10 | DATABASE_URL template documented for Phase 35 | text inspection | grep `aws-0-us-east-1.pooler.supabase.com:6543` and `?pgbouncer=true` and `prepare: false` in evidence/14-database-url-template.txt | ❌ Wave 0 — text artifact |

### Sampling Rate

- **Per task commit:** Run the relevant verification command for the requirement(s) the task addresses.
- **Per wave merge:** Re-run all CLI/psql probes (`bash scripts/verify.sh`); re-confirm screenshots are still in evidence/.
- **Phase gate:** All 8 requirement-level checks pass + halt-on-fail protocol observed + RUNBOOK / SUMMARY artifacts present.

### Wave 0 Gaps

- [ ] `.planning/phases/034-supabase-production-setup/scripts/verify.sh` — orchestrates psql + curl probes and emits a single pass/fail summary. Should accept `$PROD_REF`, `$PROD_DIRECT_URL`, `$PROD_ANON_KEY` from environment.
- [ ] `.planning/phases/034-supabase-production-setup/scripts/rls-probe.sql` — the JWT-bound psql probe from §4 Step B, parameterized for re-use.
- [ ] `.planning/phases/034-supabase-production-setup/scripts/drop-and-recreate.md` — short procedure for catastrophic halt cases (manual dashboard steps).
- [ ] `evidence/` directory created (placeholder `.gitkeep`).
- [ ] Framework install: none (no test runner needed for infra phase).

### Observability Hooks

- **CLI stdout/stderr:** Captured via `tee evidence/<step>-*.txt` for every CLI command.
- **psql output:** Same pattern.
- **Dashboard state:** Screenshots PNG into `evidence/` for Security Advisor, CORS, billing tier confirmation.
- **Halt signals:** Documented in §10 — every failure mode has a defined action; planner must include in plan SUMMARY which (if any) failures were encountered and what action was taken.

### Evidence-Capture Protocol

| Step | Artifact path | Format | Mandatory? |
|------|---------------|--------|-----------|
| 1 (project create) | `evidence/01-projects-list.txt` | text (`supabase projects list` output) | yes |
| 2 (link) | `evidence/02-link-confirm.txt` | text (`cat supabase/.temp/project-ref`) | yes |
| 3 (dry-run) | `evidence/03-dry-run.txt` | text (full stdout) | yes |
| 4 (live push) | `evidence/04-db-push.txt` | text (full stdout, including final summary) | yes |
| 5 (Security Advisor) | `evidence/05-security-advisor.png` + `evidence/05b-rls-probe.txt` | screenshot + text | yes |
| 6 (Vault) | `evidence/06-vault-secrets.txt` | text (verify query output, NOT decrypted secrets) | yes |
| 7 (Edge Functions) | `evidence/07a-cleanup-deploy.log`, `07b-validate-deploy.log`, `07c-cleanup-curl.txt`, `07d-validate-curl.txt` | text | yes |
| 8 (cron) | `evidence/08-cron-jobs.txt` | text | yes |
| 9 (bucket) | `evidence/09-bucket-state.txt` | text | yes |
| 10 (CORS) | `evidence/10-cors-dashboard.png` | screenshot | yes |
| 14 (DATABASE_URL doc) | `evidence/14-database-url-template.txt` | text (template only, NOT real password) | yes |

## Sources

### Primary (HIGH confidence)
- `supabase/migrations/20260417_trade_preview_infrastructure.sql` — bucket + cron + invoke function definitions (lines 39-191)
- `supabase/migrations/20260424000000_enable_vault_extension.sql` — Vault extension + public wrappers (full file)
- `supabase/migrations/20260327_ranking_function.sql:86-90` — recalculate-rankings cron schedule
- `supabase/migrations/20260419_purge_soft_deleted.sql:14-18` — purge cron schedule
- `supabase/functions/cleanup-trade-previews/index.ts` — function contract + env requirements
- `supabase/functions/validate-preview/index.ts` — function contract + auth behavior
- `apps/web/src/lib/discogs/oauth.ts:100-137` — storeTokens contract (Vault-only, no fallback)
- `.planning/phases/033-pre-deploy-audit-gate/033-VERIFICATION.md` — migration trail validated reset-clean
- `.planning/ADR-003-drizzle-dev-only.md` — migration policy authority
- `.planning/research/PITFALLS.md` §3, §4, §5, §11, §17, §18, §20, §26 — pitfall taxonomy
- `.planning/research/STACK.md` — version pins, env var inventory
- `.planning/research/ARCHITECTURE.md` — deploy topology + monorepo mapping
- [Supabase CLI db push reference](https://supabase.com/docs/reference/cli/supabase-db-push) — `--linked`, `--dry-run` flags verified
- [Supabase CLI link reference](https://supabase.com/docs/reference/cli/supabase-link) — `--project-ref` flag
- [Supabase CLI functions deploy reference](https://supabase.com/docs/reference/cli/supabase-functions-deploy) — deploy syntax
- [Supabase Vault docs](https://supabase.com/docs/guides/database/vault) — Transparent Column Encryption + decrypted_secrets view
- [Supabase Edge Functions secrets docs](https://supabase.com/docs/guides/functions/secrets) — confirms `supabase secrets set` is for env vars, NOT Vault

### Secondary (MEDIUM confidence)
- [Supabase Storage CORS — community discussion #35343](https://github.com/orgs/supabase/discussions/35343) — confirms dashboard + CLI paths, edge cases noted
- [Supabase Storage Lifecycle — community discussion #20171](https://github.com/orgs/supabase/discussions/20171) — confirms NO native lifecycle feature; community workaround = manual cron
- [drdroid Stack Diagnosis: Supabase Storage CORS](https://drdroid.io/stack-diagnosis/supabase-storage-an-error-occurred-while-attempting-to-configure-cors-for-a-storage-bucket) — `supabase storage update-bucket-cors` syntax
- `.pi/agent/skills/digswap-devops/references/supabase-production.md` — connection pooling guidance, prepare:false rationale
- `.pi/agent/skills/digswap-dba/SKILL.md` — RLS audit + migration safety rules

### Tertiary (LOW confidence — flagged)
- `supabase storage update-bucket-cors` CLI exact JSON shape — documented in MEDIUM source but lightly tested in production. Recommend dashboard as primary, CLI as fallback.
- pg_cron behavior on auto-pause unpause — community discussion suggests jobs resume cleanly without double-execution, but no authoritative reference. Treat as open question, validate post-launch.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies introduced; all components already in repo.
- CLI sequence: HIGH — every flag verified against current Supabase docs; migration trail proven via Phase 33 audit evidence.
- RLS / Security Advisor protocol: HIGH — Pitfall #5 + Phase 33.1 patterns are clear.
- Vault recipe: HIGH — exact wrapper SQL shown in migration 20260424000000.
- pg_cron verification: HIGH — 3 expected jobs confirmed by direct migration file inspection.
- Storage TTL clarification: HIGH — verified Supabase has no native lifecycle; existing 3-piece mechanism IS the TTL.
- CORS via CLI: MEDIUM — exists but thin docs; dashboard recommended as primary.
- Halt-on-fail recommendation: MEDIUM — judgment call, no objective answer; documented rationale in §10.
- Doc-debt scope: HIGH — exact file/count list captured via grep.

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days; Supabase CLI moves slowly enough that 30 days is safe).

## RESEARCH COMPLETE
