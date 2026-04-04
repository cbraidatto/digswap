-- ============================================================
-- Migration: trade_messages, challenges, challenge_entries
-- ============================================================

-- ── trade_messages ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.trade_requests(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  kind varchar(16) NOT NULL DEFAULT 'user',
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_messages_kind_check CHECK (kind IN ('user', 'system')),
  CONSTRAINT trade_messages_body_length_check CHECK (char_length(body) BETWEEN 1 AND 2000)
);

ALTER TABLE public.trade_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS trade_messages_trade_id_created_at_idx
  ON public.trade_messages (trade_id, created_at DESC);

CREATE INDEX IF NOT EXISTS trade_messages_sender_trade_created_at_idx
  ON public.trade_messages (sender_id, trade_id, created_at DESC);

CREATE INDEX IF NOT EXISTS trade_messages_trade_id_idx
  ON public.trade_messages (trade_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trade_messages' AND policyname = 'trade_messages_select_participants'
  ) THEN
    CREATE POLICY trade_messages_select_participants ON public.trade_messages
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.trade_requests tr
          WHERE tr.id = trade_id
            AND (tr.requester_id = auth.uid() OR tr.provider_id = auth.uid())
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'trade_messages' AND policyname = 'trade_messages_insert_participants'
  ) THEN
    CREATE POLICY trade_messages_insert_participants ON public.trade_messages
      FOR INSERT TO authenticated
      WITH CHECK (
        sender_id = auth.uid()
        AND kind = 'user'
        AND EXISTS (
          SELECT 1 FROM public.trade_requests tr
          WHERE tr.id = trade_id
            AND (tr.requester_id = auth.uid() OR tr.provider_id = auth.uid())
        )
      );
  END IF;
END $$;

-- ── challenges ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(200) NOT NULL,
  description text,
  type varchar(50) NOT NULL,
  criteria jsonb NOT NULL DEFAULT '{}',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'challenges' AND policyname = 'challenges_select_all'
  ) THEN
    CREATE POLICY challenges_select_all ON public.challenges
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ── challenge_entries ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.challenge_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL,
  user_id uuid NOT NULL,
  progress integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT challenge_entries_user_challenge UNIQUE (user_id, challenge_id)
);

ALTER TABLE public.challenge_entries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS challenge_entries_challenge_id_idx
  ON public.challenge_entries (challenge_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'challenge_entries' AND policyname = 'challenge_entries_select_all'
  ) THEN
    CREATE POLICY challenge_entries_select_all ON public.challenge_entries
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'challenge_entries' AND policyname = 'challenge_entries_insert_own'
  ) THEN
    CREATE POLICY challenge_entries_insert_own ON public.challenge_entries
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'challenge_entries' AND policyname = 'challenge_entries_update_own'
  ) THEN
    CREATE POLICY challenge_entries_update_own ON public.challenge_entries
      FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;
