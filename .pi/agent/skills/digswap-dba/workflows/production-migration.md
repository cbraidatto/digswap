# Workflow: Production Migration

**Objective:** Safely apply a reviewed migration to the production Supabase PostgreSQL database.

## Prerequisites

- The migration has passed the [migration-review](./migration-review.md) workflow with a GO recommendation.
- Rollback SQL exists and has been reviewed.
- The Drizzle schema in `apps/web/src/lib/db/schema/` is in sync with the migration.

## Steps

### 1. Pre-Migration Backup
- Confirm Supabase automatic backups are current (check dashboard > Database > Backups).
- For HIGH or CRITICAL risk migrations, take a manual `pg_dump` of affected tables.
- Record the current timestamp as the restore point reference.

```bash
# Manual backup of affected tables
pg_dump "postgresql://..." --table=public.<affected_table> --format=custom --file=pre_migration_<name>_$(date +%Y%m%d).dump
```

### 2. Apply to Staging Branch
- If a Supabase branch database exists, apply the migration there first.
- If no branch exists, use a local Supabase instance (`supabase start`).

```bash
# Apply migration to local
supabase db push --local

# Or apply specific migration file
psql "postgresql://localhost:54322/postgres" -f supabase/migrations/<migration_file>.sql
```

### 3. Smoke Test on Staging
Run these checks against the staging database:

- [ ] Migration applies without errors
- [ ] Application starts and connects successfully
- [ ] Key queries work: collection fetch, wantlist fetch, profile load, ranking display
- [ ] RLS policies pass: anon returns empty, wrong user returns empty, owner returns correct data
- [ ] No unexpected locks or long-running queries in `pg_stat_activity`

### 4. Apply to Production

```bash
# Via Supabase CLI (recommended)
supabase db push --linked

# Or via direct connection
psql "$SUPABASE_DB_URL" -f supabase/migrations/<migration_file>.sql
```

- Apply during low-traffic hours when possible.
- Monitor the Supabase dashboard for query errors during application.

### 5. Post-Migration Verification

Run immediately after applying:

```sql
-- Check for any failed or invalid indexes
SELECT indexrelid::regclass, indisvalid
FROM pg_index WHERE NOT indisvalid;

-- Verify RLS is enabled on affected tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('<affected_tables>');

-- Check active policies on affected tables
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('<affected_tables>');

-- Check for blocked queries
SELECT pid, state, query, wait_event_type
FROM pg_stat_activity
WHERE state != 'idle' AND query NOT LIKE '%pg_stat%';
```

### 6. Monitor (15-minute window)
- Watch Supabase dashboard for error rate spikes.
- Check application logs for database connection errors or query failures.
- Verify Drizzle ORM queries work correctly with the new schema.
- Confirm Supabase Realtime subscriptions still function (if RLS policies changed).

### 7. Rollback Procedure (if migration fails)

If issues are detected:

1. **Immediate:** Apply the rollback SQL prepared during migration review.
2. **If rollback SQL fails:** Restore from the pre-migration `pg_dump` backup.
3. **If backup restore fails:** Use Supabase PITR to restore to the pre-migration timestamp (Pro plan required).
4. **Post-rollback:** Verify application stability, then investigate the failure before retrying.

```bash
# Apply rollback SQL
psql "$SUPABASE_DB_URL" -f rollback_<migration_name>.sql

# Or restore from backup
pg_restore --dbname="$SUPABASE_DB_URL" --clean --if-exists pre_migration_<name>.dump
```

## Deliverable

Update the migration report with:
- Actual application timestamp
- Post-migration verification results
- Any issues encountered and how they were resolved
