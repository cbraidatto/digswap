# Backup and Restore Reference

DigSwap's data lives in Supabase Cloud PostgreSQL. Data loss is not recoverable from application code. Backup strategy must be verified before it is needed.

## Supabase Automatic Backups

| Plan | Backup Frequency | Retention | PITR |
|------|-----------------|-----------|------|
| Free | Daily | 7 days | No |
| Pro ($25/mo) | Daily | 14 days | Yes (up to 7 days) |
| Team | Daily | 30 days | Yes (up to 28 days) |

- PITR (Point-in-Time Recovery) allows restoring to any second within the retention window. Available on Pro+ plans only.
- Automatic backups run during low-traffic windows. They include all schemas, data, extensions, and RLS policies.

## Manual Backup Before Critical Operations

Before any destructive migration (`DROP`, `ALTER TYPE`, `RENAME`, bulk `DELETE`), take a manual backup:

```bash
# Full database dump (run from a machine with network access to Supabase)
pg_dump "postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres" \
  --format=custom \
  --file=digswap_backup_$(date +%Y%m%d_%H%M%S).dump

# Single table dump
pg_dump "postgresql://..." \
  --table=public.collection_items \
  --format=custom \
  --file=collection_items_backup.dump

# Schema-only dump (no data, useful for migration verification)
pg_dump "postgresql://..." \
  --schema-only \
  --file=schema_only.sql
```

## Restore Procedures

### From Supabase Dashboard (PITR)
1. Navigate to Project Settings > Database > Backups.
2. Select the target restore point (date/time).
3. Confirm restore. This replaces the current database entirely.
4. Verify application connectivity and RLS policies after restore.

### From pg_dump File
```bash
# Restore full dump
pg_restore --dbname="postgresql://..." --clean --if-exists digswap_backup.dump

# Restore single table
pg_restore --dbname="postgresql://..." --table=collection_items --clean collection_items_backup.dump
```

### Restore Verification Checklist
- [ ] Row counts match pre-backup expectations for critical tables
- [ ] RLS policies are intact (run `SELECT * FROM pg_policies;`)
- [ ] Application can authenticate and fetch data
- [ ] Materialized views are refreshed (`REFRESH MATERIALIZED VIEW ...`)
- [ ] Indexes exist and are valid (`SELECT * FROM pg_stat_user_indexes;`)
- [ ] Edge Functions and triggers are firing correctly

## GDPR Data Export

DigSwap must support a user's right to data portability. Export all data for a given user:

```sql
-- Generate JSON export for a single user
SELECT json_build_object(
  'profile', (SELECT row_to_json(p) FROM profiles p WHERE p.id = '<user_id>'),
  'collection', (SELECT json_agg(row_to_json(c)) FROM collection_items c WHERE c.user_id = '<user_id>'),
  'wantlist', (SELECT json_agg(row_to_json(w)) FROM wantlist_items w WHERE w.user_id = '<user_id>'),
  'trades', (SELECT json_agg(row_to_json(t)) FROM trade_requests t WHERE t.requester_id = '<user_id>' OR t.provider_id = '<user_id>'),
  'reviews', (SELECT json_agg(row_to_json(r)) FROM trade_reviews r WHERE r.reviewer_id = '<user_id>'),
  'notifications', (SELECT json_agg(row_to_json(n)) FROM notifications n WHERE n.user_id = '<user_id>')
);
```

## Test Restore Before You Need It

Run a restore drill at least once before launch:

1. Dump production to a local file.
2. Restore to a local Supabase instance (`supabase start` + `pg_restore`).
3. Run the application against the restored database.
4. Verify data integrity, RLS, and query performance.

If this drill has not been completed, the backup strategy is not validated.
