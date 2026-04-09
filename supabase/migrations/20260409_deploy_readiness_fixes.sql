-- ============================================================================
-- Migration: Deploy readiness fixes
-- 1. Drop broken acquire_trade_lease 3-param overload (references non-existent trade_leases table)
-- 2. Add terminal status check to the working 5-param version
-- 3. Add WITH CHECK to search_signals and digger_dna UPDATE policies
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Drop the broken 3-param overload
--    Created in 20260412_security_audit_phase2.sql, it references a
--    "trade_leases" table that does not exist. The correct table is
--    "trade_runtime_sessions" (used by the 5-param version).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.acquire_trade_lease(uuid, text, uuid);

-- ---------------------------------------------------------------------------
-- 2. Recreate the 5-param version with terminal status check
--    The original (20260331) does not reject completed/declined/cancelled/expired trades.
--    This adds the security fix from the audit without the broken table reference.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.acquire_trade_lease(
  p_trade_id uuid,
  p_device_id text,
  p_client_kind text default 'desktop',
  p_desktop_version integer default 1,
  p_trade_protocol_version integer default 1
)
RETURNS TABLE (
  id uuid,
  trade_id uuid,
  user_id uuid,
  device_id text,
  client_kind text,
  desktop_version integer,
  trade_protocol_version integer,
  last_ice_candidate_type varchar,
  acquired_at timestamptz,
  heartbeat_at timestamptz,
  released_at timestamptz,
  lease_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := timezone('utc', now());
  v_user_id uuid := auth.uid();
  v_existing public.trade_runtime_sessions%rowtype;
  v_session public.trade_runtime_sessions%rowtype;
  v_trade_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING message = 'not_authenticated';
  END IF;

  IF p_device_id IS NULL OR length(trim(p_device_id)) = 0 THEN
    RAISE EXCEPTION USING message = 'device_id_required';
  END IF;

  -- Fetch trade status and verify participant in one query
  SELECT tr.status INTO v_trade_status
  FROM public.trade_requests tr
  WHERE tr.id = p_trade_id
    AND (tr.requester_id = v_user_id OR tr.provider_id = v_user_id);

  IF v_trade_status IS NULL THEN
    RAISE EXCEPTION USING message = 'trade_not_found_or_forbidden';
  END IF;

  -- SECURITY: Reject terminal statuses (audit fix from Phase 19)
  IF v_trade_status IN ('completed', 'declined', 'cancelled', 'expired') THEN
    RAISE EXCEPTION USING message = 'trade_in_terminal_state';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.trade_runtime_sessions trs
  WHERE trs.trade_id = p_trade_id
    AND trs.user_id = v_user_id
    AND trs.released_at IS NULL
  FOR UPDATE;

  IF found THEN
    IF v_existing.device_id = p_device_id THEN
      UPDATE public.trade_runtime_sessions
      SET
        client_kind = p_client_kind,
        desktop_version = p_desktop_version,
        trade_protocol_version = p_trade_protocol_version,
        heartbeat_at = v_now,
        updated_at = v_now
      WHERE public.trade_runtime_sessions.id = v_existing.id
      RETURNING * INTO v_session;

      UPDATE public.trade_requests
      SET
        last_joined_lobby_at = v_now,
        updated_at = v_now
      WHERE public.trade_requests.id = p_trade_id;

      RETURN QUERY
      SELECT
        v_session.id,
        v_session.trade_id,
        v_session.user_id,
        v_session.device_id,
        v_session.client_kind,
        v_session.desktop_version,
        v_session.trade_protocol_version,
        v_session.last_ice_candidate_type,
        v_session.acquired_at,
        v_session.heartbeat_at,
        v_session.released_at,
        v_session.heartbeat_at + interval '45 seconds';
      RETURN;
    END IF;

    IF v_existing.heartbeat_at >= v_now - interval '45 seconds' THEN
      RAISE EXCEPTION USING
        message = 'lease_conflict',
        detail = 'Another device currently holds this trade lease.';
    END IF;

    UPDATE public.trade_runtime_sessions
    SET
      released_at = v_now,
      updated_at = v_now
    WHERE public.trade_runtime_sessions.id = v_existing.id;
  END IF;

  INSERT INTO public.trade_runtime_sessions (
    trade_id,
    user_id,
    device_id,
    client_kind,
    desktop_version,
    trade_protocol_version,
    acquired_at,
    heartbeat_at,
    created_at,
    updated_at
  )
  VALUES (
    p_trade_id,
    v_user_id,
    p_device_id,
    p_client_kind,
    p_desktop_version,
    p_trade_protocol_version,
    v_now,
    v_now,
    v_now,
    v_now
  )
  RETURNING * INTO v_session;

  UPDATE public.trade_requests
  SET
    last_joined_lobby_at = v_now,
    updated_at = v_now
  WHERE public.trade_requests.id = p_trade_id;

  RETURN QUERY
  SELECT
    v_session.id,
    v_session.trade_id,
    v_session.user_id,
    v_session.device_id,
    v_session.client_kind,
    v_session.desktop_version,
    v_session.trade_protocol_version,
    v_session.last_ice_candidate_type,
    v_session.acquired_at,
    v_session.heartbeat_at,
    v_session.released_at,
    v_session.heartbeat_at + interval '45 seconds';
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Add WITH CHECK to search_signals UPDATE policy
--    Without WITH CHECK, a user could UPDATE a row to change user_id to
--    another user, bypassing ownership.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS search_signals_update_own ON public.search_signals;
CREATE POLICY search_signals_update_own ON public.search_signals
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Add WITH CHECK to digger_dna UPDATE policy
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS digger_dna_update_own ON public.digger_dna;
CREATE POLICY digger_dna_update_own ON public.digger_dna
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
