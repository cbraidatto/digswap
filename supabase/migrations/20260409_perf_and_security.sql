-- ============================================================
-- Migration: performance + security fixes
-- ============================================================

-- 1. UNIQUE constraints para prevenir TOCTOU races
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS added_via varchar(20);

ALTER TABLE public.collection_items
  DROP CONSTRAINT IF EXISTS collection_items_user_release_unique;

ALTER TABLE public.collection_items
  ADD CONSTRAINT collection_items_user_release_unique
  UNIQUE (user_id, release_id);

ALTER TABLE public.wantlist_items
  DROP CONSTRAINT IF EXISTS wantlist_items_user_release_unique;

ALTER TABLE public.wantlist_items
  ADD CONSTRAINT wantlist_items_user_release_unique
  UNIQUE (user_id, release_id);

-- 2. GIN indexes for genre/style array queries
CREATE INDEX IF NOT EXISTS releases_genre_gin_idx
  ON public.releases USING gin(genre);

CREATE INDEX IF NOT EXISTS releases_style_gin_idx
  ON public.releases USING gin(style);

-- 3. Composite index for feed sort (rarity + time)
CREATE INDEX IF NOT EXISTS activity_feed_rarity_time_idx
  ON public.activity_feed (created_at DESC);

-- 4. Trigram index for username search
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS profiles_username_trgm_idx
  ON public.profiles USING gin(username gin_trgm_ops);

-- 5. RLS UPDATE policy on wantlist_items
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'wantlist_items' AND policyname = 'wantlist_items_update_own'
  ) THEN
    CREATE POLICY wantlist_items_update_own ON public.wantlist_items
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 6. unique constraint for collection_items discogs_instance_id (import worker dedup)
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS discogs_instance_id bigint;

ALTER TABLE public.collection_items
  DROP CONSTRAINT IF EXISTS collection_items_user_discogs_instance_unique;

-- Only add if discogs_instance_id column is populated
-- (partial unique: only when not null)
CREATE UNIQUE INDEX IF NOT EXISTS collection_items_user_discogs_instance_unique
  ON public.collection_items (user_id, discogs_instance_id)
  WHERE discogs_instance_id IS NOT NULL;
