# Migration Safety Reference

Rules and patterns for safe schema migrations in DigSwap's Supabase PostgreSQL + Drizzle ORM environment.

## Golden Rules

1. **Never DROP TABLE or DROP COLUMN without a backup.** Run `pg_dump --table=<table>` or confirm Supabase PITR is active before any destructive DDL.
2. **ADD COLUMN with DEFAULT to avoid full table rewrite.** PostgreSQL 11+ handles `ADD COLUMN ... DEFAULT <value>` without rewriting the table, but `ADD COLUMN ... DEFAULT <expression>` (volatile) still rewrites. Always use literal defaults.
3. **CREATE INDEX CONCURRENTLY for large tables.** Standard `CREATE INDEX` takes an `ACCESS EXCLUSIVE` lock. Use `CONCURRENTLY` for `collection_items`, `wantlist_items`, `releases`, `activity_feed`, and any table over 10K rows.
4. **Test migrations on a Supabase branch database before production.** Use `supabase db branch` or a separate Supabase project for staging. Never test DDL on the production database.
5. **Always write DOWN migration alongside UP.** Supabase has no automatic rollback. The developer is responsible for the reverse SQL.

## Drizzle Kit Commands

| Command | When to Use |
|---------|-------------|
| `drizzle-kit generate` | Generate SQL migration files from Drizzle schema changes |
| `drizzle-kit push` | Apply schema directly to dev database (skips migration files) |
| `drizzle-kit migrate` | Apply pending migration files to a target database |
| `drizzle-kit check` | Verify migration consistency without applying |
| `drizzle-kit introspect` | Generate Drizzle schema from existing database (reverse engineer) |

## Supabase CLI Commands

| Command | When to Use |
|---------|-------------|
| `supabase db diff` | Compare local schema against remote, generate migration SQL |
| `supabase migration new <name>` | Create a new empty migration file with timestamp prefix |
| `supabase db push` | Apply pending migrations to linked Supabase project |
| `supabase db reset` | Reset local database to clean state (destructive, dev only) |
| `supabase db lint` | Run schema linter for common issues |

## Transaction Safety

- Wrap multi-step migrations in a single transaction when all steps must succeed or fail together.
- Exception: `CREATE INDEX CONCURRENTLY` cannot run inside a transaction. Isolate it in its own migration file.
- Use `DO $$ BEGIN ... END $$;` blocks for conditional DDL (e.g., `IF NOT EXISTS` checks on policies or constraints).

## DigSwap-Specific Migration Naming

Migration files follow the pattern: `YYYYMMDD_descriptive_name.sql` (e.g., `20260409_perf_and_security.sql`). Keep names lowercase with underscores. Include the category prefix when possible:

- `fix_` -- bug fix or correction
- `add_` -- new table or column
- `perf_` -- performance optimization (indexes, materialized views)
- `rls_` -- RLS policy changes
- `security_` -- security hardening

## Common Dangerous Patterns

| Pattern | Risk | Mitigation |
|---------|------|------------|
| `ALTER COLUMN SET TYPE` | Full table rewrite + exclusive lock | Add new column, backfill, swap, drop old |
| `ALTER COLUMN SET NOT NULL` | Full table scan to validate | Add CHECK constraint first, then convert |
| `DROP COLUMN` | Irreversible data loss | Backup column data to separate table first |
| `RENAME TABLE / COLUMN` | Breaks all application code referencing old name | Deploy app code first, then rename |
| `ALTER COLUMN DROP DEFAULT` | Existing INSERTs without explicit value will fail | Update application code first |
| Removing a RLS policy | Silently denies all access (RLS enabled + no policies = deny) | Always add replacement policy in same transaction |
