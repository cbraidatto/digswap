# Supabase Production

Production management, scaling, and operational guidance for DigSwap on Supabase.

## Free to Pro Upgrade Path

| Feature | Free Tier | Pro ($25/mo) |
|---------|-----------|--------------|
| Database size | 500MB | 8GB (then $0.125/GB) |
| Auth MAU | 50,000 | 100,000 |
| Realtime connections | 200 concurrent | 500 concurrent |
| Edge Function invocations | 500K/month | 2M/month |
| Storage | 1GB | 100GB |
| Backups | Daily (7 day retention) | Daily + PITR |
| Custom domains | No | Yes |

Upgrade trigger: when database exceeds 400MB or concurrent realtime connections regularly hit 150+. DigSwap's collection data (releases, wantlists, matches) grows with each Discogs import.

## Connection Pooling

DigSwap uses Drizzle ORM with the `postgres` driver connecting through Supabase's PgBouncer (transaction mode).

Critical configuration in Drizzle connection setup:
- Use the **connection pooler URL** (port 6543), not the direct connection (port 5432)
- Set `prepare: false` in the Drizzle config. PgBouncer in transaction mode does not support prepared statements. Omitting this causes "prepared statement does not exist" errors.
- The `DATABASE_URL` env var must point to the pooler URL

Direct connection (port 5432) is only for migrations via `drizzle-kit push` or `drizzle-kit migrate`, which need prepared statement support.

## Automatic Backups and PITR

- **Free tier**: Daily backups retained for 7 days. Restore via Supabase dashboard.
- **Pro tier**: Point-in-Time Recovery (PITR) allows restoring to any second within the retention window. Essential for recovering from bad migrations.
- Always take a manual backup before running migrations in production: Supabase dashboard > Database > Backups > Create backup.

## Migration Safety

1. **Never run migrations directly in production**. Use Supabase branching or a staging project.
2. Test the migration in a Supabase branch database first (`supabase db branch create`).
3. Generate migrations with `drizzle-kit generate`, review the SQL, then apply with `drizzle-kit migrate`.
4. Keep rollback SQL alongside every migration. Drizzle does not generate rollback files automatically -- write them manually.
5. For destructive changes (DROP COLUMN, DROP TABLE), use a two-phase approach: first deploy code that does not depend on the column, then drop the column in the next release.

## Realtime Connection Limits

DigSwap uses Supabase Realtime for in-app notifications (wantlist matches, trade requests, messages).

- **Free tier**: 200 concurrent connections. Sufficient for early MVP.
- **Pro tier**: 500 concurrent connections.
- Monitor via Supabase dashboard > Realtime > Connections.
- If approaching limits: ensure clients disconnect on page unload, use channel multiplexing (one channel per user, not per feature), and debounce subscription setup.

## RLS Verification in Production

Row Level Security policies are the primary authorization layer. Before every deploy:

1. Run `supabase db lint` against the staging branch to detect tables without RLS enabled.
2. Verify that new tables have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in their migration.
3. Test RLS policies with both authenticated and anonymous roles using the Supabase SQL Editor.
4. The AppSec skill ([digswap-appsec](../digswap-appsec/SKILL.md)) covers RLS review in depth.

## Custom Domains and SSL

- Available on Pro plan only.
- Configure in Supabase dashboard > Settings > Custom Domains.
- Useful for hiding the `*.supabase.co` URL from end users in API calls.
- SSL is managed automatically by Supabase.
