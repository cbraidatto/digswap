-- Add open_for_trade flag and personal_rating to collection_items.
-- Both columns have safe defaults (0/null) so existing rows are unaffected.

ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS open_for_trade integer NOT NULL DEFAULT 0;

ALTER TABLE public.collection_items
  ADD COLUMN IF NOT EXISTS personal_rating integer;

-- Index for finding tradeable records quickly (e.g., "show me all records open for trade")
CREATE INDEX IF NOT EXISTS collection_items_open_for_trade_idx
  ON public.collection_items (open_for_trade)
  WHERE open_for_trade = 1;
