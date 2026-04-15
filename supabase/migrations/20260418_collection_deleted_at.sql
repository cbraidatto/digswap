-- Phase 30: Add soft-delete column to collection_items
-- Items with deleted_at set are hidden from all queries
-- pg_cron purges rows where deleted_at > 7 days old

ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Partial index for efficient purge queries and filtering
CREATE INDEX IF NOT EXISTS collection_items_deleted_at_idx
  ON collection_items (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- Unique index for upsert support (sync engine uses ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS collection_items_user_release_unique
  ON collection_items (user_id, release_id);
