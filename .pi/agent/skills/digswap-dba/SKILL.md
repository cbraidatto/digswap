---
name: digswap-dba
description: DigSwap database administration — migration review, RLS policy audit, query performance tuning, backup strategy, data integrity verification, and Supabase PostgreSQL operational guidance. Use when reviewing or writing migrations, auditing Row Level Security policies, optimizing slow queries, planning schema changes, verifying data integrity, managing Drizzle ORM schema, or when the user asks to audit, optimize, migrate, backup, or fix database issues.
---

# DigSwap DBA

Use this skill when making any change that touches the database: schema modifications, migration authoring or review, RLS policy changes, index tuning, data integrity checks, or backup/restore operations.

DigSwap runs on Supabase PostgreSQL with Drizzle ORM. The Drizzle schema lives in `apps/web/src/lib/db/schema/` (21 files). Production migrations live in `supabase/migrations/` (23+ SQL files). RLS is the primary authorization layer -- a policy gap is a security incident.

## Core Rules

1. Never apply a migration to production without a tested rollback path. Write the DOWN SQL before the UP SQL.
2. Every table containing user data MUST have RLS enabled with correct `auth.uid()` scoping. No exceptions.
3. Back up before any destructive operation. `DROP TABLE`, `DROP COLUMN`, `ALTER TYPE`, and `RENAME` require explicit backup confirmation.
4. Prefer `CREATE INDEX CONCURRENTLY` for any table with more than 10K rows. Non-concurrent index creation locks writes.
5. Keep Drizzle schema (`apps/web/src/lib/db/schema/`) and SQL migrations (`supabase/migrations/`) in sync. Drift between them is a ticking time bomb.
6. Use `prepare: false` in Drizzle connection config when connecting through Supabase's PgBouncer (transaction mode). Named prepared statements break in transaction pooling.

## Workflow Router

Choose exactly one primary workflow, then load only the references needed for that task.

- If the user asks to review a migration, diff, or schema change before applying it, read [workflows/migration-review.md](./workflows/migration-review.md).
- If the user is applying a migration to production or staging, read [workflows/production-migration.md](./workflows/production-migration.md).
- If the user asks for a data integrity check, orphan scan, RLS audit, or index coverage review, read [workflows/data-audit.md](./workflows/data-audit.md).

Always read [references/migration-safety.md](./references/migration-safety.md) first. Then load additional references as needed:

- RLS policies, auth.uid() patterns, service role usage: [references/rls-audit.md](./references/rls-audit.md)
- Backup procedures, pg_dump, Supabase PITR, restore: [references/backup-restore.md](./references/backup-restore.md)

## DigSwap Priorities

Bias toward these concerns because they are especially relevant to DigSwap:

- **RLS on every user-facing table.** DigSwap had a critical incident where null-condition RLS policies defaulted to `USING (true)`, granting any authenticated user full access. See `20260405_fix_all_rls_null_policies.sql`. Never repeat this.
- **Migration rollback SQL.** Every migration must ship with a reversible counterpart. Supabase has no built-in rollback -- you must write it yourself.
- **Supabase connection pooling with Drizzle.** Always use `prepare: false` with the `postgres` driver when connecting through PgBouncer. The `pg` driver is not recommended.
- **Materialized views for rankings.** `user_rankings` is read-heavy and computed from multiple tables. Use materialized views refreshed on schedule (pg_cron) rather than real-time aggregation.
- **Sensitive tables with no direct access.** `handoff_tokens`, `trade_runtime_sessions`, and `trade_transfer_receipts` use `USING (false)` RLS to block all client access. Only server-side service role code may touch them.
- **Schema drift detection.** Drizzle schema files define policies inline (e.g., `pgPolicy` in table definitions), but production may have policies added via raw SQL migrations. Run `supabase db diff` regularly to detect drift.

## Output Contract

Every response from this skill should include:

1. Risk assessment (LOW / MEDIUM / HIGH / CRITICAL) for any proposed change.
2. The exact SQL or Drizzle schema change, never pseudocode.
3. Rollback SQL for every destructive operation.
4. RLS impact analysis -- does this change affect who can read or write data?
5. Performance impact -- will this lock tables, require full scans, or degrade query plans?

## Templates

Use these output templates when the user wants a structured artifact:

- [templates/migration-report.md](./templates/migration-report.md)
