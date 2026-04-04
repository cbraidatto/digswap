-- ============================================================================
-- Security Audit Phase 2: Medium/Low severity fixes
-- Covers: wantlist_items RLS, notifications INSERT, listening_logs,
--         search_signals unique constraint, acquire_trade_lease terminal check
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. wantlist_items: Restrict SELECT to owner only
--    AUDIT: "wantlist_items SELECT publico expoe todas wantlists"
--    The public SELECT policy lets any authenticated user enumerate all
--    wantlists. Replace with owner-only policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view wantlist items" ON wantlist_items;
DROP POLICY IF EXISTS "wantlist_items_select_own" ON wantlist_items;

CREATE POLICY "wantlist_items_select_own"
  ON wantlist_items FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Ensure RLS is enforced
ALTER TABLE wantlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wantlist_items FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. notifications: Block user-generated INSERT
--    AUDIT: "notifications INSERT - usuario pode criar notificacoes fake para si"
--    Notifications should only be created by the service role (admin client).
--    Users can only SELECT and UPDATE (mark as read) their own notifications.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;

-- No INSERT policy for authenticated = only service_role can insert
-- Ensure SELECT and UPDATE policies exist for owner only
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;

CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON notifications;

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 3. listening_logs: Fix dual PERMISSIVE policies = effectively public
--    AUDIT: "listening_logs - Duas policies PERMISSIVE = tudo publico"
--    Two PERMISSIVE SELECT policies combine with OR, making all logs visible.
--    Replace with a single owner-only policy.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own listening logs" ON listening_logs;
DROP POLICY IF EXISTS "listening_logs_select_all" ON listening_logs;
DROP POLICY IF EXISTS "listening_logs_select_own" ON listening_logs;
DROP POLICY IF EXISTS "Users can view listening logs" ON listening_logs;

CREATE POLICY "listening_logs_select_own"
  ON listening_logs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE listening_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_logs FORCE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 4. search_signals: Add UNIQUE constraint on user_id
--    Required for the ON CONFLICT DO UPDATE atomic upsert pattern.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'search_signals_user_id_unique'
  ) THEN
    -- Remove duplicates first (keep the most recently reinforced row)
    DELETE FROM search_signals a
    USING search_signals b
    WHERE a.user_id = b.user_id
      AND a.last_reinforced_at < b.last_reinforced_at;

    ALTER TABLE search_signals
      ADD CONSTRAINT search_signals_user_id_unique UNIQUE (user_id);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. acquire_trade_lease: Reject trades in terminal status
--    AUDIT: "acquire_trade_lease() aceita trades em status terminal"
--    A user could acquire a lease on a completed/cancelled/declined/expired trade.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION acquire_trade_lease(
  p_trade_id uuid,
  p_device_id text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trade record;
  v_existing_lease record;
  v_lease_id uuid;
BEGIN
  -- Fetch the trade
  SELECT * INTO v_trade
  FROM trade_requests
  WHERE id = p_trade_id;

  IF v_trade IS NULL THEN
    RETURN jsonb_build_object('error', 'Trade not found');
  END IF;

  -- SECURITY: Reject terminal statuses — no lease should be acquired on
  -- completed, declined, cancelled, or expired trades.
  IF v_trade.status IN ('completed', 'declined', 'cancelled', 'expired') THEN
    RETURN jsonb_build_object('error', 'Trade is in a terminal state and cannot be leased');
  END IF;

  -- Verify the user is a participant
  IF v_trade.requester_id != p_user_id AND v_trade.provider_id != p_user_id THEN
    RETURN jsonb_build_object('error', 'Not a participant in this trade');
  END IF;

  -- Check for existing active lease
  SELECT * INTO v_existing_lease
  FROM trade_leases
  WHERE trade_id = p_trade_id
    AND released_at IS NULL
    AND expires_at > now();

  IF v_existing_lease IS NOT NULL THEN
    IF v_existing_lease.device_id = p_device_id AND v_existing_lease.user_id = p_user_id THEN
      -- Same device, extend the lease
      UPDATE trade_leases
      SET expires_at = now() + interval '5 minutes'
      WHERE id = v_existing_lease.id;

      RETURN jsonb_build_object(
        'lease_id', v_existing_lease.id,
        'extended', true
      );
    ELSE
      RETURN jsonb_build_object('error', 'Another device holds the lease');
    END IF;
  END IF;

  -- Create new lease
  INSERT INTO trade_leases (trade_id, user_id, device_id, expires_at)
  VALUES (p_trade_id, p_user_id, p_device_id, now() + interval '5 minutes')
  RETURNING id INTO v_lease_id;

  RETURN jsonb_build_object(
    'lease_id', v_lease_id,
    'extended', false
  );
END;
$$;

-- Ensure only authenticated users can call it (not anon)
REVOKE EXECUTE ON FUNCTION acquire_trade_lease(uuid, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION acquire_trade_lease(uuid, text, uuid) TO authenticated;
