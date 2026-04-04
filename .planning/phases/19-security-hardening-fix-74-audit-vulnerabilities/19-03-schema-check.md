# Schema Alignment Spot-Check Results

Verified all 8 Drizzle schema files against production security migrations (20260411_security_audit_fixes.sql and 20260412_security_audit_phase2.sql).

| Schema File | Migration | Status | Notes |
|-------------|-----------|--------|-------|
| collections.ts | 20260411 | PASS | No migration changes affect collection_items. CRUD RLS policies (select/insert/update/delete own) present and correct. |
| social.ts | 20260411 | PASS | Neither migration modifies follows or activity_feed tables. Existing policies (select_all for follows, select/insert own for activity_feed) unchanged. |
| groups.ts | 20260411 | PASS | Neither migration modifies groups, group_members, or group_posts. All policies (select_all, insert/update/delete creator/member) intact. |
| group-invites.ts | 20260412 | PASS | Neither migration modifies group_invites. SELECT (created_by = auth.uid) and INSERT (created_by = auth.uid) policies present. NOTE comment about missing invitee_id is pre-existing documentation, not a security gap. |
| wantlist.ts | 20260412 | PASS | Migration drops public SELECT ("Users can view wantlist items") and creates owner-only "wantlist_items_select_own". Drizzle schema has matching wantlist_items_select_own (user_id = auth.uid). Also has insert_own, delete_own, update_own with proper owner checks. Fully aligned. |
| notifications.ts | 20260412 | PASS | Migration drops all INSERT policies (blocks user-generated notifications). Drizzle schema has only select_own and update_own -- no INSERT policy. Only service_role (admin client) can insert. Fully aligned. |
| listening-logs.ts | 20260412 | PASS | Migration drops dual PERMISSIVE SELECT policies and creates single "listening_logs_select_own". Drizzle schema has single listening_logs_select_own (user_id = auth.uid) plus insert_own. No duplicate policies. Fully aligned. |
| trades.ts | 20260411+12 | PASS | Migration 20260411 drops trade_requests UPDATE policies (trade_requests_update_participant, trade_requests_update_policy). Drizzle schema for tradeRequests has only SELECT and INSERT -- no UPDATE policy. Migration 20260411 adds handoff_tokens_no_direct_access (USING false, WITH CHECK false). Drizzle schema has matching handoff_tokens_no_direct_access (for: "all", using: false, withCheck: false). Migration 20260412 acquire_trade_lease terminal status check is a SQL function, not a table RLS policy -- outside Drizzle schema scope. Fully aligned. |

## Summary

**Result: 8/8 PASS** -- All Drizzle schema files are correctly aligned with production security migrations.

## Additional Fix Applied

The 20260411 migration also adds `WITH CHECK (user_id = auth.uid())` to `challenge_entries_update_own` in the challenge_entries table (engagement.ts). The Drizzle schema was missing this WITH CHECK clause. **Fixed:** Added `withCheck: sql\`\${table.userId} = \${authUid}\`` to the challenge_entries_update_own policy in engagement.ts to match the production migration. [Rule 2 - Auto-add missing critical functionality: security policy alignment]
