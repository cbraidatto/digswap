-- ============================================================================
-- P0 FIX: Enforce mutual-follow check on DM inserts at database level
-- ============================================================================
-- Previously, dm_insert_own only checked sender_id = auth.uid(), allowing any
-- authenticated user to DM anyone by bypassing the server action layer.
-- This migration adds a database function for the mutual-follow check and
-- upgrades the INSERT policy to require it.
--
-- Verification:
--   As user_a who does NOT mutually follow user_b:
--     INSERT INTO direct_messages (sender_id, receiver_id, body)
--     VALUES (user_a_id, user_b_id, 'test');
--   Expected: ERROR due to RLS policy violation
-- ============================================================================

-- 1. Create the mutual-follow check function
--    Returns true only if both users follow each other.
--    Uses EXISTS with two subqueries — lightweight with the unique index on follows.
CREATE OR REPLACE FUNCTION public.is_mutual_follow(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = user_a AND following_id = user_b
  )
  AND EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = user_b AND following_id = user_a
  );
$$;

-- 2. Drop the old permissive INSERT policy
DROP POLICY IF EXISTS "dm_insert_own" ON public.direct_messages;

-- 3. Create the new INSERT policy with mutual-follow enforcement
--    sender_id must be the authenticated user AND the receiver must be a mutual follow
CREATE POLICY "dm_insert_mutual_follow" ON public.direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND is_mutual_follow(auth.uid(), receiver_id)
  );
