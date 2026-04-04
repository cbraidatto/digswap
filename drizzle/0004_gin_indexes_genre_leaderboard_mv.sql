-- Migration: P6 + P7 — GIN indexes on releases arrays + materialized view for genre leaderboard
-- Run with: drizzle-kit migrate (or apply manually via Supabase dashboard SQL editor)

-- ─────────────────────────────────────────────────────────────────────────────
-- P6: GIN indexes on releases.genre and releases.style
-- These replace sequential scans on the @> and && array operators used in:
--   • getGenreLeaderboard (WHERE r.genre @> ARRAY[genre]::text[])
--   • getExploreFeed     (WHERE releases.genre && ARRAY[...] OR releases.style && ARRAY[...])
--   • getCollectionPage  (WHERE releases.genre @> ARRAY[genre]::text[])
-- CONCURRENTLY means no table lock — safe to run on a live database.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX CONCURRENTLY IF NOT EXISTS releases_genre_gin_idx
  ON releases USING gin (genre);--> statement-breakpoint

CREATE INDEX CONCURRENTLY IF NOT EXISTS releases_style_gin_idx
  ON releases USING gin (style);--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- P7: Materialized view for genre leaderboard
-- Pre-computes per-user, per-genre scores so getGenreLeaderboard hits a
-- pre-aggregated table instead of scanning collection_items × releases every time.
--
-- Refresh strategy: call pg_cron or a Supabase Edge Function to run
--   REFRESH MATERIALIZED VIEW CONCURRENTLY genre_leaderboard_mv;
-- on a schedule (e.g. every 15 min). The CONCURRENTLY keyword requires a
-- unique index (created below) and avoids a full table lock during refresh.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS genre_leaderboard_mv AS
SELECT
  ci.user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  unnest(r.genre) AS genre,
  SUM(LN(1 + COALESCE(r.rarity_score, 0))) AS genre_score,
  ur.title
FROM collection_items ci
INNER JOIN releases r ON r.id = ci.release_id
INNER JOIN profiles p ON p.id = ci.user_id
LEFT JOIN user_rankings ur ON ur.user_id = ci.user_id
GROUP BY ci.user_id, p.username, p.display_name, p.avatar_url, unnest(r.genre), ur.title;--> statement-breakpoint

-- Required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS genre_leaderboard_mv_user_genre_uidx
  ON genre_leaderboard_mv (user_id, genre);--> statement-breakpoint

-- Index for fast genre lookups with ORDER BY genre_score DESC
CREATE INDEX IF NOT EXISTS genre_leaderboard_mv_genre_score_idx
  ON genre_leaderboard_mv (genre, genre_score DESC);--> statement-breakpoint

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS note: materialized views do not inherit RLS policies from their source
-- tables. The genre leaderboard is intentionally public (it shows rankings,
-- not private data), so no RLS policy is needed. If you add sensitive columns
-- in the future, create a security-definer view wrapping this MV instead of
-- querying it directly.
-- ─────────────────────────────────────────────────────────────────────────────
