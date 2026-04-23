-- Phase 33 Plan 03 (Layer 3 fix, manually generated per user choice B):
-- 6 tables defined in apps/web/src/lib/db/schema/*.ts but never materialized
-- in the SQL trail. They exist only on the dev Supabase project (created via
-- ad-hoc drizzle-kit push). This migration adds them before any dated
-- migration that references them.
--
-- Order matters (FK dependencies):
--   crates → crate_items, sets → set_tracks
--   leads → profiles
--   handoff_tokens → trade_requests
--
-- RLS policies are intentionally OMITTED here; 20260328_leads_rls.sql and
-- 20260405_fix_all_rls_null_policies.sql create the policies for these tables.
-- We only ENABLE ROW LEVEL SECURITY so the subsequent policy-creation
-- migrations find the tables in the expected state.

-- =============================================================================
-- crates — named digging sessions / event prep lists
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.crates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name varchar(100) NOT NULL,
  date date DEFAULT CURRENT_DATE,
  session_type varchar(20) NOT NULL DEFAULT 'digging_trip',
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crates_session_type_check CHECK (session_type IN ('digging_trip','event_prep','wish_list','other'))
);

ALTER TABLE public.crates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS crates_user_id_idx ON public.crates (user_id);
CREATE INDEX IF NOT EXISTS crates_is_public_idx ON public.crates (is_public) WHERE is_public = true;

-- =============================================================================
-- crate_items — records added to a crate
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.crate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crate_id uuid NOT NULL REFERENCES public.crates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  release_id uuid REFERENCES public.releases(id),
  discogs_id integer,
  title varchar(255),
  artist varchar(255),
  cover_image_url text,
  status varchar(20) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crate_items_status_check CHECK (status IN ('active','found'))
);

ALTER TABLE public.crate_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS crate_items_crate_id_idx ON public.crate_items (crate_id);
CREATE INDEX IF NOT EXISTS crate_items_user_id_idx ON public.crate_items (user_id);
CREATE INDEX IF NOT EXISTS crate_items_release_id_idx ON public.crate_items (release_id);

-- =============================================================================
-- sets — played track sequence within a crate
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crate_id uuid NOT NULL REFERENCES public.crates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_date date,
  venue_name varchar(200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sets ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS sets_crate_id_idx ON public.sets (crate_id);
CREATE INDEX IF NOT EXISTS sets_user_id_idx ON public.sets (user_id);

-- =============================================================================
-- set_tracks — ordered tracks within a set
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.set_tracks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES public.sets(id) ON DELETE CASCADE,
  crate_item_id uuid NOT NULL REFERENCES public.crate_items(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.set_tracks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS set_tracks_set_id_idx ON public.set_tracks (set_id);
CREATE INDEX IF NOT EXISTS set_tracks_user_id_idx ON public.set_tracks (user_id);

-- =============================================================================
-- leads — digger's watching/contacted/dead_end/found list
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'watching',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT leads_user_target_unique UNIQUE (user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS leads_user_id_idx ON public.leads (user_id);

-- NOTE: RLS + policies for leads are enabled/created by 20260328_leads_rls.sql.

-- =============================================================================
-- handoff_tokens — desktop trade handoff HMAC tokens (no direct access)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.handoff_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL REFERENCES public.trade_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  token_hmac varchar(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.handoff_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS handoff_tokens_trade_id_idx ON public.handoff_tokens (trade_id);
CREATE INDEX IF NOT EXISTS handoff_tokens_token_hmac_idx ON public.handoff_tokens (token_hmac);
CREATE INDEX IF NOT EXISTS handoff_tokens_expires_at_idx ON public.handoff_tokens (expires_at);

-- NOTE: RLS policies for handoff_tokens are set by 20260411_security_audit_fixes.sql
-- (FORCE ROW LEVEL SECURITY + no-direct-access policy).

-- =============================================================================
-- discogs_tokens — Discogs OAuth access-token fallback (plaintext row when Vault unavailable)
-- Schema inferred from apps/web/src/lib/discogs/oauth.ts (never in TS schema or prior SQL)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.discogs_tokens (
  user_id uuid PRIMARY KEY,
  access_token text NOT NULL,
  access_token_secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discogs_tokens ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- RLS POLICIES — for the 7 drift tables above
-- 20260405_fix_all_rls_null_policies.sql was moved to deprecated-migrations
-- because it referenced non-existent columns (invited_by, groups.created_by).
-- The policies it defined for drizzle-owned tables are redundant (drizzle/0000
-- embeds them already). The policies below cover ONLY the drift tables.
-- =============================================================================

-- crates
CREATE POLICY "crates_select_own_or_public" ON public.crates
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public = true);
CREATE POLICY "crates_select_public_anon" ON public.crates
  FOR SELECT TO anon USING (is_public = true);
CREATE POLICY "crates_insert_own" ON public.crates
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "crates_update_own" ON public.crates
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "crates_delete_own" ON public.crates
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- crate_items
CREATE POLICY "crate_items_select_own" ON public.crate_items
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "crate_items_insert_own" ON public.crate_items
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "crate_items_update_own" ON public.crate_items
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "crate_items_delete_own" ON public.crate_items
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- sets
CREATE POLICY "sets_select_own" ON public.sets
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "sets_insert_own" ON public.sets
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "sets_update_own" ON public.sets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "sets_delete_own" ON public.sets
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- set_tracks
CREATE POLICY "set_tracks_select_own" ON public.set_tracks
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "set_tracks_insert_own" ON public.set_tracks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "set_tracks_update_own" ON public.set_tracks
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "set_tracks_delete_own" ON public.set_tracks
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- discogs_tokens
CREATE POLICY "discogs_tokens_select_own" ON public.discogs_tokens
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "discogs_tokens_insert_own" ON public.discogs_tokens
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "discogs_tokens_update_own" ON public.discogs_tokens
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "discogs_tokens_delete_own" ON public.discogs_tokens
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- handoff_tokens — no direct-client access; service-role only (policies set by 20260411)
