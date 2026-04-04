-- ============================================================
-- Migration: missing tables and columns
-- listening_logs, digger_dna, search_signals, crates.is_public,
-- trade_requests read-at columns
-- ============================================================

-- ── listening_logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listening_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  release_id uuid NOT NULL REFERENCES public.releases(id) ON DELETE CASCADE,
  caption text,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  listened_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.listening_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'listening_logs' AND policyname = 'listening_logs_select_all'
  ) THEN
    CREATE POLICY listening_logs_select_all ON public.listening_logs
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'listening_logs' AND policyname = 'listening_logs_insert_own'
  ) THEN
    CREATE POLICY listening_logs_insert_own ON public.listening_logs
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS listening_logs_user_id_idx ON public.listening_logs (user_id);
CREATE INDEX IF NOT EXISTS listening_logs_listened_at_idx ON public.listening_logs (listened_at);

-- ── digger_dna ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.digger_dna (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  top_genres jsonb NOT NULL DEFAULT '[]',
  top_decades jsonb NOT NULL DEFAULT '[]',
  top_countries jsonb NOT NULL DEFAULT '[]',
  rarity_profile varchar(50) NOT NULL DEFAULT 'balanced_digger',
  avg_rarity real NOT NULL DEFAULT 0,
  total_records integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.digger_dna ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'digger_dna' AND policyname = 'digger_dna_select_all'
  ) THEN
    CREATE POLICY digger_dna_select_all ON public.digger_dna
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'digger_dna' AND policyname = 'digger_dna_upsert_own'
  ) THEN
    CREATE POLICY digger_dna_upsert_own ON public.digger_dna
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'digger_dna' AND policyname = 'digger_dna_update_own'
  ) THEN
    CREATE POLICY digger_dna_update_own ON public.digger_dna
      FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

-- ── search_signals ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.search_signals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  terms text[] NOT NULL DEFAULT '{}',
  genres text[] NOT NULL DEFAULT '{}',
  strength real NOT NULL DEFAULT 0.1,
  last_reinforced_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.search_signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'search_signals' AND policyname = 'search_signals_select_own'
  ) THEN
    CREATE POLICY search_signals_select_own ON public.search_signals
      FOR SELECT TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'search_signals' AND policyname = 'search_signals_insert_own'
  ) THEN
    CREATE POLICY search_signals_insert_own ON public.search_signals
      FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'search_signals' AND policyname = 'search_signals_update_own'
  ) THEN
    CREATE POLICY search_signals_update_own ON public.search_signals
      FOR UPDATE TO authenticated USING (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS search_signals_user_id_idx ON public.search_signals (user_id);

-- ── crates.is_public ─────────────────────────────────────────
ALTER TABLE public.crates
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- ── trade_requests read-at columns ──────────────────────────
ALTER TABLE public.trade_requests
  ADD COLUMN IF NOT EXISTS requester_last_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_last_read_at timestamptz;
