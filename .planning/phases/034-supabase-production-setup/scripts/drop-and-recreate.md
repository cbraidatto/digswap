# Phase 34 — Drop+Recreate Procedure (Catastrophic Halt Only)

Use ONLY when `supabase db push --linked` fails MID-trail (file N applies, file N+1 errors).
Migration trail is non-transactional; partial state is unrecoverable on Free tier (no PITR per D-05).
Drop+recreate loses zero data because prod is empty in Phase 34.

Source: 034-RESEARCH.md §10 (L529-L554).

## Procedure

1. **Dashboard** → Project Settings → General → **Pause project** (top button).
2. **Dashboard** → Project Settings → General → **Delete project** (bottom of page; type project name to confirm).
3. Wait ~2 min for resource teardown to complete.
4. Repeat Step 1 of 034-RESEARCH.md §2:
   - Dashboard → New project → Org `<your org>` → Name `digswap-prod` → Region **us-east-1 (US East, N. Virginia)** → Pricing **Free** → Database password (use a NEW strong password; store in password manager).
   - Wait ~2 min for provisioning. Capture the new PROD_REF from the dashboard URL.
5. Update env: `export PROD_REF="<new-ref>"`. Re-run `supabase link --project-ref "$PROD_REF"`.
6. Resume from RESEARCH.md §2 Step 3 (`supabase db push --linked --dry-run`).

## Halt threshold (RESEARCH.md §10 default rule)

> If a step exceeds 30 minutes of fix attempts, OR if multiple steps fail during the same session,
> OR if the failure required dropping the prod project once already, halt and open Phase 34.1.
> Otherwise fix-forward inline.

## When NOT to use this

- Single-file SQL syntax error caught by `--dry-run`: fix the SQL file in repo, re-run dry-run, then live push (RESEARCH.md §10 row "MEDIUM").
- Edge Function deploy failure: re-run `supabase functions deploy` (independent of DB state).
- Vault insertion error: investigate via `psql` (root cause likely extension didn't install).
- CORS dashboard fail: cosmetic only, retry.

Drop+recreate is acceptable on Phase 34 ONLY because prod has no user data yet. After Phase 38 (UAT users in prod), drop+recreate becomes destructive.
