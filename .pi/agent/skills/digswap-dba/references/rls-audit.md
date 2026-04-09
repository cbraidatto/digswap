# RLS Audit Reference

Row Level Security is the primary authorization layer in DigSwap. A missing or misconfigured RLS policy is equivalent to a broken access control vulnerability.

## Fundamental Rule

Every table containing user data MUST have `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;` and at least one policy per operation type (SELECT, INSERT, UPDATE, DELETE) that the application uses.

## Minimum Policy Set for User-Owned Tables

```sql
-- Owner can read their own rows
CREATE POLICY "<table>_select_own" ON <table>
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Owner can insert their own rows
CREATE POLICY "<table>_insert_own" ON <table>
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Owner can update their own rows
CREATE POLICY "<table>_update_own" ON <table>
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Owner can delete their own rows
CREATE POLICY "<table>_delete_own" ON <table>
  FOR DELETE TO authenticated USING (user_id = auth.uid());
```

## Service Role Bypass

The Supabase service role (`service_role` key) bypasses ALL RLS policies. This is by design.

- Use service role ONLY in trusted server-side code: server actions, API routes, Edge Functions, webhooks.
- NEVER expose the service role key to the browser. The anon key and user JWT are the only keys that should reach the client.
- Tables like `handoff_tokens`, `trade_runtime_sessions`, and `trade_transfer_receipts` intentionally block all authenticated access (`USING (false)`) and rely exclusively on service role operations.

## DigSwap Tables Requiring RLS

### Owner-scoped (user_id = auth.uid())
- `collection_items` -- user's vinyl collection
- `wantlist_items` -- user's wantlist
- `crates` -- user's curated crates
- `crate_items` -- items in user's crates (scoped via crate ownership)
- `notifications` -- user's notifications
- `notification_preferences` -- user's notification settings
- `import_jobs` -- user's Discogs import jobs
- `discogs_tokens` -- user's OAuth tokens (CRITICAL -- token leak = account takeover)
- `user_sessions` -- user's active sessions
- `activity_feed` -- user's activity entries
- `backup_codes` -- user's 2FA backup codes (CRITICAL)
- `sets` / `set_tracks` -- user's DJ sets
- `subscriptions` -- user's billing state (insert/update via service role only)
- `listening_logs` -- user's listening history
- `search_signals` -- user's search behavior

### Participant-scoped (requester OR provider)
- `trade_requests` -- both trade participants can SELECT
- `trade_messages` -- both trade participants can SELECT and INSERT

### Publicly readable (all authenticated)
- `profiles` -- any authenticated user can view any profile
- `releases` -- catalog data is shared
- `badges` / `user_badges` -- public achievement display
- `user_rankings` -- leaderboard is public
- `groups` -- group listings are public
- `group_members` -- membership is public
- `trade_reviews` -- reviews are public reputation signals
- `follows` -- follow graph is public (SELECT), but only owner can INSERT/DELETE

### No direct access (USING false)
- `handoff_tokens` -- web-to-desktop trade handoff (service role only)
- `trade_runtime_sessions` -- desktop runtime tracking (service role only)
- `trade_transfer_receipts` -- completed transfer records (service role only)

## Testing RLS Policies

Run these checks after any RLS change:

1. **Query as anon role** -- should return zero rows on all user-scoped tables.
2. **Query as wrong user** -- authenticate as User A, query for User B's data. Must return zero rows.
3. **Query as owner** -- authenticate as User A, query for User A's data. Must return correct rows.
4. **INSERT as wrong user** -- try to insert a row with another user's ID. Must fail.
5. **UPDATE across boundary** -- try to update another user's row. Must fail.

## Dangerous Patterns to Watch For

- **Missing WHERE auth.uid() check** -- a policy with `USING (true)` on a user-scoped table grants access to ALL rows.
- **Null-condition policies** -- policies created via Supabase dashboard with no expression default to `USING (true)`. This was the root cause of DigSwap's major RLS incident (fixed in `20260405_fix_all_rls_null_policies.sql`).
- **Overly permissive SELECT** -- `collection_items` should NOT have `USING (true)` for SELECT. A user's collection is private unless explicitly shared.
- **Missing UPDATE WITH CHECK** -- an UPDATE policy with USING but no WITH CHECK allows the user to change `user_id` to another user's ID.
- **Forgetting RLS on new tables** -- `ALTER TABLE <new_table> ENABLE ROW LEVEL SECURITY;` must appear in the same migration that creates the table.
