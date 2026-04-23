-- ============================================================================
-- P0 FIX: Upgrade trade_reviews INSERT policy to match Drizzle schema
-- ============================================================================
-- Migration 20260405 created a weak policy: just reviewer_id = auth.uid().
-- This allows anyone to review any trade. The Drizzle schema has the correct
-- stricter policy that validates:
--   1. reviewer_id = auth.uid()
--   2. Trade exists and is completed
--   3. Reviewer is a participant in the trade
--   4. reviewed_id is the OTHER participant
--
-- Verification:
--   As user_a who is NOT a participant in trade_x:
--     INSERT INTO trade_reviews (trade_id, reviewer_id, reviewed_id, quality_rating)
--     VALUES (trade_x_id, user_a_id, user_b_id, 5);
--   Expected: ERROR due to RLS policy violation
-- ============================================================================

-- 1. Drop the weak policy from 20260405
DROP POLICY IF EXISTS "trade_reviews_insert_own" ON public.trade_reviews;

-- 2. Create the upgraded policy matching the Drizzle schema
CREATE POLICY "trade_reviews_insert_own" ON public.trade_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM trade_requests tr
      WHERE tr.id = trade_id
        AND tr.status = 'completed'
        AND (tr.requester_id = auth.uid() OR tr.provider_id = auth.uid())
        AND reviewed_id = CASE
          WHEN tr.requester_id = auth.uid() THEN tr.provider_id
          ELSE tr.requester_id
        END
    )
  );
