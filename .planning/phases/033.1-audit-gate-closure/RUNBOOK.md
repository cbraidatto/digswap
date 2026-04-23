# Phase 33.1 — Operator Runbook

Local-development prerequisites and gotchas surfaced by the Phase 33 audit. Read this before running ANY plan in `.planning/phases/033.1-audit-gate-closure/`.

## 1. Local `.env.local` MUST include NEXT_PUBLIC_APP_URL

**Symptom:** `pnpm --filter @digswap/web build` fails with a Zod env-schema error like:
```
Invalid environment variables: { NEXT_PUBLIC_APP_URL: 'Required' }
```

**Root cause:** `apps/web/.env.local.example` line 9 declares `NEXT_PUBLIC_APP_URL=http://localhost:3000` as a required var, but the user's local `apps/web/.env.local` (gitignored — never committed) was missing it as of 2026-04-22 (Phase 33 Plan 02 build initially failed for this reason; AUDIT-REPORT.md §1 Finding #3 + §8 Bonus audit finding).

**Fix:** Add this line to your local `apps/web/.env.local`:
```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
Do NOT commit `.env.local`. Verify with:
```bash
grep -c '^NEXT_PUBLIC_APP_URL=' apps/web/.env.local
# expected output: 1
```

Then re-run `pnpm --filter @digswap/web build` — it should now succeed.

## 2. Other env-var gotchas

The `apps/web/.env.local.example` file lists 21 required + 4 optional vars (Phase 33 DEP-AUD-08 §8 inventory). The Zod schema in `apps/web/src/lib/env.ts` enforces all 21 required vars at boot. If you re-clone the repo, copy the example file:
```bash
cp apps/web/.env.local.example apps/web/.env.local
# then fill in real values from the dev Supabase project mrkgoucqcbqjhrdjcnpw
```

## 3. Vault smoke-test (after Plan 01 lands)

After Plan 01 (`033.1-01-vault-remediation`) lands, the dev project should have the Vault extension installed. To re-verify before Phase 34, run:
```bash
node --input-type=module -e "import pg from 'pg'; import fs from 'fs'; const url=fs.readFileSync('apps/web/.env.local','utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim(); const c=new pg.Client({connectionString:url}); await c.connect(); const r=await c.query(\"SELECT count(*)::int AS plaintext_count FROM public.discogs_tokens\"); console.log(r.rows[0]); await c.end();"
# expected output: { plaintext_count: 0 }
```

## 4. Session-revocation E2E (after Plan 04 lands)

The Playwright spec `apps/web/tests/e2e/audit/session-revocation.audit.spec.ts` requires two env vars at run-time:
```bash
export AUDIT_USER_EMAIL=audit+33@digswap.test
export AUDIT_USER_PASSWORD=<chosen-value-from-Plan-04>
pnpm --filter @digswap/web exec playwright test audit/session-revocation.audit.spec.ts
```

The audit user `audit+33@digswap.test` must exist on dev project `mrkgoucqcbqjhrdjcnpw` with Auto-Confirm ON (created via Supabase Dashboard → Auth → Users → Add user as part of Plan 04 Task 1).
