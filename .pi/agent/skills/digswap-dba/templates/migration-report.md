# Migration Report

## Summary

| Field | Value |
|-------|-------|
| **Migration File** | `supabase/migrations/YYYYMMDD_name.sql` |
| **Date Reviewed** | YYYY-MM-DD |
| **Risk Level** | `LOW` / `MEDIUM` / `HIGH` / `CRITICAL` |
| **Reviewed By** | DBA Skill |

## Changes

| # | Statement | Table(s) Affected | Type |
|---|-----------|-------------------|------|
| 1 | Description of change | table_name | CREATE / ALTER / DROP / POLICY / INDEX |

## RLS Impact

- [ ] New tables have RLS enabled
- [ ] New tables have correct policies (SELECT/INSERT/UPDATE/DELETE as needed)
- [ ] Existing policies are not removed without replacement
- [ ] Service-role-only tables use `USING (false)` pattern
- [ ] No overly permissive `USING (true)` on user-scoped tables

**RLS Notes:** (Describe any policy additions, removals, or modifications)

## Rollback SQL

```sql
-- Paste the complete rollback (DOWN) SQL here
-- Every CREATE must have a DROP, every ADD COLUMN a DROP COLUMN, etc.
```

- [ ] Rollback SQL tested on staging/local

## Drizzle Schema Sync

- [ ] Drizzle schema file(s) updated to match migration
- [ ] `drizzle-kit check` passes without drift warnings

## Test Results

| Test | Result |
|------|--------|
| Migration applies cleanly on staging | PASS / FAIL |
| Application connects after migration | PASS / FAIL |
| RLS: anon returns empty | PASS / FAIL |
| RLS: wrong user returns empty | PASS / FAIL |
| RLS: owner returns correct data | PASS / FAIL |
| No table locks or long queries | PASS / FAIL |

## Recommendation

**GO** / **NO-GO** / **CONDITIONAL GO**

**Conditions (if conditional):**
-

**Residual Risk:**
-
