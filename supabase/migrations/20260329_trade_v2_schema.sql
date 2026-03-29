-- Phase 14 Plan 01: Add new columns to trade_requests for bilateral acceptance and quality metadata
-- Implements D-07 (bilateral timestamps), D-05 (quality metadata), D-09 (file hash), D-01 (offering release)

ALTER TABLE trade_requests
  ADD COLUMN IF NOT EXISTS offering_release_id uuid REFERENCES releases(id),
  ADD COLUMN IF NOT EXISTS condition_notes text,
  ADD COLUMN IF NOT EXISTS declared_quality varchar(50),
  ADD COLUMN IF NOT EXISTS file_hash varchar(64),
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_accepted_by_recipient_at timestamptz,
  ADD COLUMN IF NOT EXISTS preview_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS preview_accepted_by_recipient_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_joined_lobby_at timestamptz;

-- No CHECK constraint on status — the column is varchar(20), not an enum type.
-- New values 'lobby' and 'previewing' are valid strings handled by application code.
-- Existing rows with 'pending'/'accepted'/etc. are unaffected.
