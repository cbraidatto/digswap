-- ============================================================================
-- Direct Messages table for mutual-follower chat
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,

  -- Prevent self-messages at the DB level
  CONSTRAINT dm_no_self_message CHECK (sender_id != receiver_id)
);

-- Indexes for efficient conversation lookups
CREATE INDEX IF NOT EXISTS dm_sender_receiver_idx ON public.direct_messages (sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS dm_receiver_sender_idx ON public.direct_messages (receiver_id, sender_id);
CREATE INDEX IF NOT EXISTS dm_created_at_idx ON public.direct_messages (created_at);

-- Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages FORCE ROW LEVEL SECURITY;

-- Participants can view their own messages
CREATE POLICY "dm_select_participant" ON public.direct_messages
  FOR SELECT TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Users can only insert messages as themselves
CREATE POLICY "dm_insert_own" ON public.direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- No UPDATE or DELETE — messages are immutable once sent

-- Enable realtime for direct_messages so Supabase Realtime can push INSERT events
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
