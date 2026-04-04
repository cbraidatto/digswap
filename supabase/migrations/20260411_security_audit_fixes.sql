-- ============================================================================
-- Security Audit Fixes (2026-04-03)
-- Addresses critical and high vulnerabilities from white-box audit
-- ============================================================================

-- ─── CRITICAL: Ensure discogs_tokens has RLS enabled ──────────────────────
-- The table may have been created via dashboard without RLS.
-- This is idempotent — safe to run even if RLS is already enabled.
ALTER TABLE IF EXISTS public.discogs_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.discogs_tokens FORCE ROW LEVEL SECURITY;

-- Ensure policies exist (idempotent via DROP IF EXISTS + CREATE)
DROP POLICY IF EXISTS "discogs_tokens_select_own" ON public.discogs_tokens;
CREATE POLICY "discogs_tokens_select_own" ON public.discogs_tokens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "discogs_tokens_insert_own" ON public.discogs_tokens;
CREATE POLICY "discogs_tokens_insert_own" ON public.discogs_tokens
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "discogs_tokens_update_own" ON public.discogs_tokens;
CREATE POLICY "discogs_tokens_update_own" ON public.discogs_tokens
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "discogs_tokens_delete_own" ON public.discogs_tokens;
CREATE POLICY "discogs_tokens_delete_own" ON public.discogs_tokens
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ─── CRITICAL: Ensure handoff_tokens has RLS enabled ──────────────────────
ALTER TABLE IF EXISTS public.handoff_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.handoff_tokens FORCE ROW LEVEL SECURITY;

-- Block all direct access (only RPCs/admin should touch this table)
DROP POLICY IF EXISTS "handoff_tokens_no_direct_access" ON public.handoff_tokens;
CREATE POLICY "handoff_tokens_no_direct_access" ON public.handoff_tokens
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);


-- ─── HIGH: Fix finalize_trade_transfer — validate status + role ───────────
CREATE OR REPLACE FUNCTION public.finalize_trade_transfer(
  p_trade_id uuid,
  p_device_id text,
  p_file_name text DEFAULT NULL,
  p_file_size_bytes bigint DEFAULT NULL,
  p_file_hash_sha256 text DEFAULT NULL,
  p_completed_at timestamptz DEFAULT now(),
  p_ice_candidate_type text DEFAULT NULL,
  p_trade_protocol_version int DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_trade record;
  v_receipt_id uuid;
  v_reconciled timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Fetch trade and validate participation + status
  SELECT id, requester_id, provider_id, status
    INTO v_trade
    FROM public.trade_requests
   WHERE id = p_trade_id
     AND (requester_id = v_user_id OR provider_id = v_user_id)
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'trade_not_found';
  END IF;

  -- SECURITY: Only allow finalization from valid transfer states
  IF v_trade.status NOT IN ('transferring', 'accepted', 'previewing') THEN
    RAISE EXCEPTION 'invalid_trade_status: %', v_trade.status;
  END IF;

  -- Insert receipt (idempotent via ON CONFLICT)
  INSERT INTO public.trade_transfer_receipts (
    trade_id, user_id, device_id,
    file_name, file_size_bytes, file_hash_sha256,
    ice_candidate_type, trade_protocol_version,
    completed_at
  ) VALUES (
    p_trade_id, v_user_id, p_device_id,
    p_file_name, p_file_size_bytes, p_file_hash_sha256,
    p_ice_candidate_type, p_trade_protocol_version,
    p_completed_at
  )
  ON CONFLICT (trade_id, user_id, device_id, file_hash_sha256) DO UPDATE
    SET completed_at = EXCLUDED.completed_at
  RETURNING id, reconciled_at INTO v_receipt_id, v_reconciled;

  -- Mark trade as completed only if not already
  UPDATE public.trade_requests
     SET status = 'completed',
         updated_at = now()
   WHERE id = p_trade_id
     AND status <> 'completed';

  RETURN jsonb_build_object(
    'receipt_id', v_receipt_id,
    'trade_status', 'completed',
    'reconciled_at', v_reconciled
  );
END;
$$;


-- ─── HIGH: Restrict trade_requests UPDATE to only allowed fields ──────────
-- Drop overly permissive UPDATE policy
DROP POLICY IF EXISTS "trade_requests_update_participant" ON public.trade_requests;
DROP POLICY IF EXISTS "trade_requests_update_policy" ON public.trade_requests;

-- No direct UPDATE allowed — all state transitions via server actions + admin client
-- This prevents PostgREST users from changing status, IDs, or hashes directly
-- Server actions use createAdminClient() which bypasses RLS


-- ─── MEDIUM: Revoke public execute on recalculate_rankings ────────────────
REVOKE ALL ON FUNCTION public.recalculate_rankings() FROM public;
REVOKE ALL ON FUNCTION public.recalculate_rankings() FROM authenticated;
REVOKE ALL ON FUNCTION public.recalculate_rankings() FROM anon;
-- Only postgres (cron) can call it
GRANT EXECUTE ON FUNCTION public.recalculate_rankings() TO postgres;


-- ─── MEDIUM: Fix challenge_entries UPDATE — add WITH CHECK ────────────────
DROP POLICY IF EXISTS "challenge_entries_update_own" ON public.challenge_entries;
CREATE POLICY "challenge_entries_update_own" ON public.challenge_entries
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
