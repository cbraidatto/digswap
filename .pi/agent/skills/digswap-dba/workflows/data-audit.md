# Workflow: Data Audit

**Objective:** Verify data integrity, RLS coverage, index health, and sensitive data exposure across DigSwap's database.

## Trigger

The user asks for a data integrity check, orphan scan, RLS gap analysis, index coverage review, or general database health assessment.

## Checks

### 1. Orphan Records (Foreign Key Violations)

Identify rows referencing non-existent parent records. DigSwap's key FK relationships:

```sql
-- Collection items referencing deleted releases
SELECT ci.id, ci.release_id
FROM collection_items ci
LEFT JOIN releases r ON ci.release_id = r.id
WHERE ci.release_id IS NOT NULL AND r.id IS NULL;

-- Wantlist items referencing deleted releases
SELECT wi.id, wi.release_id
FROM wantlist_items wi
LEFT JOIN releases r ON wi.release_id = r.id
WHERE wi.release_id IS NOT NULL AND r.id IS NULL;

-- Trade messages referencing deleted trades
SELECT tm.id, tm.trade_id
FROM trade_messages tm
LEFT JOIN trade_requests tr ON tm.trade_id = tr.id
WHERE tr.id IS NULL;

-- Crate items referencing deleted crates
SELECT ci.id, ci.crate_id
FROM crate_items ci
LEFT JOIN crates c ON ci.crate_id = c.id
WHERE c.id IS NULL;

-- User badges referencing deleted badges
SELECT ub.id, ub.badge_id
FROM user_badges ub
LEFT JOIN badges b ON ub.badge_id = b.id
WHERE b.id IS NULL;

-- Group posts referencing deleted groups
SELECT gp.id, gp.group_id
FROM group_posts gp
LEFT JOIN groups g ON gp.group_id = g.id
WHERE g.id IS NULL;
```

### 2. RLS Coverage Gaps

Identify tables with RLS disabled or no policies:

```sql
-- Tables with RLS disabled
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
  AND tablename NOT IN ('schema_migrations', 'drizzle_migrations');

-- Tables with RLS enabled but zero policies
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
GROUP BY t.tablename
HAVING COUNT(p.policyname) = 0;

-- Policies with null or overly permissive conditions
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual IS NULL OR qual = 'true')
  AND tablename NOT IN ('profiles', 'releases', 'badges', 'user_badges', 'user_rankings', 'groups', 'group_members', 'follows', 'trade_reviews');
```

### 3. Sensitive Data Exposure

Check for data that should not be accessible via the public API:

```sql
-- Discogs tokens (should be strictly owner-scoped)
SELECT COUNT(*) as token_count FROM discogs_tokens;

-- Backup codes (2FA, CRITICAL)
SELECT COUNT(*) as backup_code_count FROM backup_codes;

-- Handoff tokens (should have zero direct access)
-- This query via authenticated role should return 0
SELECT COUNT(*) FROM handoff_tokens;
```

### 4. Index Coverage

Verify indexes exist on commonly queried columns:

```sql
-- Tables with sequential scans but no indexes on filter columns
SELECT relname, seq_scan, idx_scan, seq_tup_read
FROM pg_stat_user_tables
WHERE seq_scan > 1000
  AND (idx_scan IS NULL OR idx_scan = 0)
ORDER BY seq_scan DESC;

-- Missing indexes on foreign key columns
SELECT
  tc.table_name,
  kcu.column_name,
  CASE WHEN i.indexrelid IS NOT NULL THEN 'INDEXED' ELSE 'MISSING INDEX' END as status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN pg_index i ON i.indrelid = (tc.table_name::regclass)
  AND kcu.column_name = ANY(
    SELECT a.attname FROM pg_attribute a WHERE a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
  )
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public';

-- Expected indexes for DigSwap high-traffic queries
-- collection_items: user_id, release_id
-- wantlist_items: user_id, release_id
-- trade_requests: requester_id, provider_id
-- notifications: user_id
-- activity_feed: user_id, created_at
-- releases: genre (GIN), style (GIN)
-- profiles: username (trigram GIN)
```

### 5. Data Consistency

```sql
-- Users with profile but no auth.users entry
SELECT p.id FROM profiles p
LEFT JOIN auth.users u ON p.id = u.id
WHERE u.id IS NULL;

-- Duplicate collection items (same user + release)
SELECT user_id, release_id, COUNT(*) as dupes
FROM collection_items
WHERE release_id IS NOT NULL
GROUP BY user_id, release_id
HAVING COUNT(*) > 1;

-- Trade requests in impossible states
SELECT id, status, created_at
FROM trade_requests
WHERE status = 'pending' AND created_at < NOW() - INTERVAL '30 days';
```

## Deliverable

Produce an audit report with:
- Total tables checked
- Orphan record count per relationship
- RLS gaps found (table + missing operation)
- Sensitive data exposure findings
- Index recommendations
- Data consistency issues
- Priority-ordered remediation steps
