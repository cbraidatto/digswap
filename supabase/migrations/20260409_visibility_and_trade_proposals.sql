-- Phase 25: Trade Schema + Collection Visibility (TRD-01, TRD-02, TRD-04)
-- Adds visibility column to collection_items, quality metadata columns,
-- trade_proposals and trade_proposal_items tables, and updates RLS policies.

-- =============================================================================
-- Section 1: collection_items — visibility + quality metadata columns
-- =============================================================================

-- Add visibility column (default not_trading for all existing rows)
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS visibility varchar(20) NOT NULL DEFAULT 'not_trading';

-- Quality metadata columns (all nullable)
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS audio_format varchar(50);
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS bitrate integer;
ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS sample_rate integer;

-- Partial index for finding tradeable items quickly
CREATE INDEX IF NOT EXISTS collection_items_visibility_idx
  ON public.collection_items (visibility)
  WHERE visibility = 'tradeable';

-- =============================================================================
-- Section 2: Migrate open_for_trade to visibility
-- =============================================================================

-- Migrate existing data: open_for_trade=1 -> 'tradeable', open_for_trade=0 -> 'not_trading'
UPDATE public.collection_items
  SET visibility = 'tradeable'
  WHERE open_for_trade = 1 AND visibility = 'not_trading';
-- (open_for_trade=0 already maps to default 'not_trading', no update needed)

-- =============================================================================
-- Section 3: Update collection_items RLS policies
-- =============================================================================

-- Drop old select policy (owner-only)
DROP POLICY IF EXISTS "collection_items_select_own" ON public.collection_items;

-- Owner sees all their items (including private)
CREATE POLICY "collection_items_select_own" ON public.collection_items
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Other users see non-private items (tradeable + not_trading)
CREATE POLICY "collection_items_select_public" ON public.collection_items
  FOR SELECT TO authenticated
  USING (visibility IN ('tradeable', 'not_trading'));

-- =============================================================================
-- Section 4: trade_proposals table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trade_proposals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id uuid NOT NULL REFERENCES public.trade_requests(id) ON DELETE CASCADE,
  proposer_id uuid NOT NULL,
  sequence_number integer NOT NULL DEFAULT 1,
  status varchar(20) NOT NULL DEFAULT 'pending',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_proposals_select_participant" ON public.trade_proposals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trade_requests tr
    WHERE tr.id = trade_id
      AND (tr.requester_id = auth.uid() OR tr.provider_id = auth.uid())
  ));

CREATE POLICY "trade_proposals_insert_participant" ON public.trade_proposals
  FOR INSERT TO authenticated
  WITH CHECK (
    proposer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM trade_requests tr
      WHERE tr.id = trade_id
        AND (tr.requester_id = auth.uid() OR tr.provider_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS trade_proposals_trade_id_idx
  ON public.trade_proposals (trade_id);

-- =============================================================================
-- Section 5: trade_proposal_items junction table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.trade_proposal_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  proposal_id uuid NOT NULL REFERENCES public.trade_proposals(id) ON DELETE CASCADE,
  side varchar(10) NOT NULL,
  collection_item_id uuid REFERENCES public.collection_items(id),
  release_id uuid REFERENCES public.releases(id),
  condition_notes text,
  declared_quality varchar(50),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trade_proposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trade_proposal_items_select_participant" ON public.trade_proposal_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM trade_proposals tp
    JOIN trade_requests tr ON tr.id = tp.trade_id
    WHERE tp.id = proposal_id
      AND (tr.requester_id = auth.uid() OR tr.provider_id = auth.uid())
  ));

CREATE POLICY "trade_proposal_items_insert_participant" ON public.trade_proposal_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM trade_proposals tp
    JOIN trade_requests tr ON tr.id = tp.trade_id
    WHERE tp.id = proposal_id
      AND tp.proposer_id = auth.uid()
      AND (tr.requester_id = auth.uid() OR tr.provider_id = auth.uid())
  ));

CREATE INDEX IF NOT EXISTS trade_proposal_items_proposal_id_idx
  ON public.trade_proposal_items (proposal_id);
