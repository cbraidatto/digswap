-- Fix broken trade_requests RLS policies.
-- The previous policies had null USING/WITH CHECK expressions (created via Supabase dashboard
-- with empty conditions), which caused PostgreSQL to deny all access to authenticated users.

DROP POLICY IF EXISTS trade_requests_select_participant ON public.trade_requests;
DROP POLICY IF EXISTS trade_requests_insert_authenticated ON public.trade_requests;
DROP POLICY IF EXISTS trade_requests_update_participant ON public.trade_requests;

-- SELECT: only participants can see their own trades
CREATE POLICY trade_requests_select_participant
  ON public.trade_requests
  FOR SELECT
  TO authenticated
  USING (
    requester_id = auth.uid() OR provider_id = auth.uid()
  );

-- INSERT: authenticated user can create a trade as the requester
CREATE POLICY trade_requests_insert_authenticated
  ON public.trade_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
  );

-- UPDATE: only participants can update their own trade
CREATE POLICY trade_requests_update_participant
  ON public.trade_requests
  FOR UPDATE
  TO authenticated
  USING (
    requester_id = auth.uid() OR provider_id = auth.uid()
  )
  WITH CHECK (
    requester_id = auth.uid() OR provider_id = auth.uid()
  );
