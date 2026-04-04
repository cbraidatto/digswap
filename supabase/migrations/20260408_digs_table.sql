-- ============================================================
-- Migration: digs table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.digs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  feed_item_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT digs_user_feed_item UNIQUE (user_id, feed_item_id)
);

ALTER TABLE public.digs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'digs' AND policyname = 'digs_select_all'
  ) THEN
    CREATE POLICY digs_select_all ON public.digs
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'digs' AND policyname = 'digs_insert_own'
  ) THEN
    CREATE POLICY digs_insert_own ON public.digs
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'digs' AND policyname = 'digs_delete_own'
  ) THEN
    CREATE POLICY digs_delete_own ON public.digs
      FOR DELETE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS digs_user_id_idx ON public.digs (user_id);
CREATE INDEX IF NOT EXISTS digs_feed_item_id_idx ON public.digs (feed_item_id);
