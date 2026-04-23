-- pg_cron purge job: delete collection items soft-deleted > 7 days ago
-- Runs daily at 3:00 AM UTC (per D-03 locked decision)
-- Requires pg_cron extension to be enabled in Supabase dashboard

-- Add deletedAt column to collection_items
ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Partial index for efficient purge queries
CREATE INDEX IF NOT EXISTS collection_items_deleted_at_idx
  ON collection_items (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Schedule the purge job
SELECT cron.schedule(
  'purge-soft-deleted-collection-items',
  '0 3 * * *',
  $$DELETE FROM collection_items WHERE deleted_at < now() - interval '7 days'$$
);
