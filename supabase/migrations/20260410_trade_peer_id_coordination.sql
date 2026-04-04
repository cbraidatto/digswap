-- Migration: H-09 peer ID coordination via Supabase Realtime
-- Adds peer_id column to trade_runtime_sessions, an RPC to publish it,
-- and a SELECT RLS policy so trade participants can receive Realtime
-- postgres_changes events for their own trade session rows.

-- 1. Add peer_id column
ALTER TABLE public.trade_runtime_sessions
  ADD COLUMN IF NOT EXISTS peer_id VARCHAR(100);

-- 2. Enable Realtime replication for the table
-- (supabase_realtime publication must include this table for postgres_changes)
ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_runtime_sessions;

-- 3. RLS: allow trade participants to SELECT session rows for their own trade
--    (needed for Realtime postgres_changes delivery)
DROP POLICY IF EXISTS trade_runtime_sessions_participants_select ON public.trade_runtime_sessions;
CREATE POLICY trade_runtime_sessions_participants_select
  ON public.trade_runtime_sessions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.trade_requests tr
      WHERE tr.id = trade_runtime_sessions.trade_id
        AND (tr.requester_id = auth.uid() OR tr.provider_id = auth.uid())
    )
  );

-- 4. RPC: update_trade_peer_id
--    Security definer so it bypasses RLS on UPDATE (direct UPDATE is still
--    blocked for non-owners). Validates the calling user is a participant
--    in the trade and owns the session row before writing.
CREATE OR REPLACE FUNCTION public.update_trade_peer_id(
  p_trade_id uuid,
  p_device_id text,
  p_peer_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Verify caller is a trade participant
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_requests tr
    WHERE tr.id = p_trade_id
      AND (tr.requester_id = v_uid OR tr.provider_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'trade_not_found';
  END IF;

  -- Update only the row owned by this user + device
  UPDATE public.trade_runtime_sessions
  SET
    peer_id = p_peer_id,
    updated_at = now()
  WHERE trade_id = p_trade_id
    AND user_id = v_uid
    AND device_id = p_device_id
    AND released_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_trade_peer_id(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_trade_peer_id(uuid, text, text) TO authenticated;
