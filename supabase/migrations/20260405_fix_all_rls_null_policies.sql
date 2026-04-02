-- SEC-01: Fix null-condition RLS policies across all affected tables.
--
-- Root cause: Policies created via Supabase dashboard with no USING/WITH CHECK
-- expression result in pg_get_expr(polqual) = null.
-- For PERMISSIVE policies, a null USING clause defaults to USING (true) —
-- meaning any authenticated user passes, not just the row owner.
--
-- This migration drops all null-condition policies and replaces them with
-- correct user_id = auth.uid() scoped policies.

-- ─── activity_feed ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own activity feed" ON activity_feed;
CREATE POLICY "activity_feed_select_own" ON activity_feed
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ─── backup_codes (2FA) ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own backup codes" ON backup_codes;
CREATE POLICY "backup_codes_select_own" ON backup_codes
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "backup_codes_insert_own" ON backup_codes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "backup_codes_update_own" ON backup_codes
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "backup_codes_delete_own" ON backup_codes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── badges (public read) ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Badges are publicly readable" ON badges;
CREATE POLICY "badges_select_all" ON badges
  FOR SELECT TO authenticated USING (true);

-- ─── collection_items ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own collection" ON collection_items;
CREATE POLICY "collection_items_select_own" ON collection_items
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "collection_items_insert_own" ON collection_items
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "collection_items_update_own" ON collection_items
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "collection_items_delete_own" ON collection_items
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── crate_items ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own crate items" ON crate_items;
CREATE POLICY "crate_items_select_own" ON crate_items
  FOR SELECT TO authenticated
  USING (crate_id IN (SELECT id FROM crates WHERE user_id = auth.uid()));
CREATE POLICY "crate_items_insert_own" ON crate_items
  FOR INSERT TO authenticated
  WITH CHECK (crate_id IN (SELECT id FROM crates WHERE user_id = auth.uid()));
CREATE POLICY "crate_items_update_own" ON crate_items
  FOR UPDATE TO authenticated
  USING (crate_id IN (SELECT id FROM crates WHERE user_id = auth.uid()))
  WITH CHECK (crate_id IN (SELECT id FROM crates WHERE user_id = auth.uid()));
CREATE POLICY "crate_items_delete_own" ON crate_items
  FOR DELETE TO authenticated
  USING (crate_id IN (SELECT id FROM crates WHERE user_id = auth.uid()));

-- ─── crates ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own crates" ON crates;
CREATE POLICY "crates_select_own" ON crates
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "crates_insert_own" ON crates
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "crates_update_own" ON crates
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "crates_delete_own" ON crates
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── discogs_tokens ───────────────────────────────────────────────────────────
-- Was: TO public, ALL, null conditions — wide open to any request
DROP POLICY IF EXISTS "Users can manage own tokens" ON discogs_tokens;
CREATE POLICY "discogs_tokens_select_own" ON discogs_tokens
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "discogs_tokens_insert_own" ON discogs_tokens
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "discogs_tokens_update_own" ON discogs_tokens
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "discogs_tokens_delete_own" ON discogs_tokens
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── follows ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own follows" ON follows;
CREATE POLICY "follows_select_all" ON follows
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "follows_insert_own" ON follows
  FOR INSERT TO authenticated WITH CHECK (follower_id = auth.uid());
CREATE POLICY "follows_delete_own" ON follows
  FOR DELETE TO authenticated USING (follower_id = auth.uid());

-- ─── group_invites ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage group invites" ON group_invites;
CREATE POLICY "group_invites_select_participant" ON group_invites
  FOR SELECT TO authenticated
  USING (invited_by = auth.uid() OR invitee_id = auth.uid());
CREATE POLICY "group_invites_insert_own" ON group_invites
  FOR INSERT TO authenticated WITH CHECK (invited_by = auth.uid());
CREATE POLICY "group_invites_update_invitee" ON group_invites
  FOR UPDATE TO authenticated
  USING (invitee_id = auth.uid()) WITH CHECK (invitee_id = auth.uid());

-- ─── group_members ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage group membership" ON group_members;
CREATE POLICY "group_members_select_all" ON group_members
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_members_insert_own" ON group_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "group_members_delete_own" ON group_members
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── group_posts ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage group posts" ON group_posts;
CREATE POLICY "group_posts_select_member" ON group_posts
  FOR SELECT TO authenticated
  USING (group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()));
CREATE POLICY "group_posts_insert_member" ON group_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );
CREATE POLICY "group_posts_update_own" ON group_posts
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "group_posts_delete_own" ON group_posts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── groups ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage groups" ON groups;
CREATE POLICY "groups_select_all" ON groups
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "groups_insert_own" ON groups
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "groups_update_own" ON groups
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY "groups_delete_own" ON groups
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- ─── import_jobs ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own import jobs" ON import_jobs;
CREATE POLICY "import_jobs_select_own" ON import_jobs
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ─── notification_preferences ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own notification preferences" ON notification_preferences;
CREATE POLICY "notification_preferences_select_own" ON notification_preferences
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notification_preferences_insert_own" ON notification_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "notification_preferences_update_own" ON notification_preferences
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ─── notifications ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── profiles (CRITICAL) ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_delete_own" ON profiles
  FOR DELETE TO authenticated USING (id = auth.uid());

-- ─── releases (public read) ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Releases are publicly readable" ON releases;
CREATE POLICY "releases_select_all" ON releases
  FOR SELECT TO authenticated USING (true);

-- ─── reviews ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own reviews" ON reviews;
CREATE POLICY "reviews_select_all" ON reviews
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "reviews_insert_own" ON reviews
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reviews_update_own" ON reviews
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "reviews_delete_own" ON reviews
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── set_tracks ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own set tracks" ON set_tracks;
CREATE POLICY "set_tracks_select_own" ON set_tracks
  FOR SELECT TO authenticated
  USING (set_id IN (SELECT id FROM sets WHERE user_id = auth.uid()));
CREATE POLICY "set_tracks_insert_own" ON set_tracks
  FOR INSERT TO authenticated
  WITH CHECK (set_id IN (SELECT id FROM sets WHERE user_id = auth.uid()));
CREATE POLICY "set_tracks_delete_own" ON set_tracks
  FOR DELETE TO authenticated
  USING (set_id IN (SELECT id FROM sets WHERE user_id = auth.uid()));

-- ─── sets ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own sets" ON sets;
CREATE POLICY "sets_select_own" ON sets
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "sets_insert_own" ON sets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "sets_update_own" ON sets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "sets_delete_own" ON sets
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── subscriptions (CRITICAL) ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service can insert subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service can update subscriptions" ON subscriptions;
CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "subscriptions_insert_service" ON subscriptions
  FOR INSERT TO supabase_auth_admin WITH CHECK (true);
CREATE POLICY "subscriptions_update_service" ON subscriptions
  FOR UPDATE TO supabase_auth_admin USING (true) WITH CHECK (true);

-- ─── trade_reviews ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own trade reviews" ON trade_reviews;
CREATE POLICY "trade_reviews_select_all" ON trade_reviews
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "trade_reviews_insert_own" ON trade_reviews
  FOR INSERT TO authenticated WITH CHECK (reviewer_id = auth.uid());

-- ─── user_badges ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own badges" ON user_badges;
CREATE POLICY "user_badges_select_all" ON user_badges
  FOR SELECT TO authenticated USING (true);

-- ─── user_rankings ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Rankings are publicly readable" ON user_rankings;
CREATE POLICY "user_rankings_select_all" ON user_rankings
  FOR SELECT TO authenticated USING (true);

-- ─── user_sessions (CRITICAL) ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own sessions" ON user_sessions;
CREATE POLICY "user_sessions_select_own" ON user_sessions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "user_sessions_insert_own" ON user_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_sessions_delete_own" ON user_sessions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ─── wantlist_items ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can manage own wantlist" ON wantlist_items;
CREATE POLICY "wantlist_items_select_own" ON wantlist_items
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "wantlist_items_insert_own" ON wantlist_items
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "wantlist_items_update_own" ON wantlist_items
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "wantlist_items_delete_own" ON wantlist_items
  FOR DELETE TO authenticated USING (user_id = auth.uid());
