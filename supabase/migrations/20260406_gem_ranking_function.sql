-- Phase 20: Gem Economy — Replace ln(1 + rarity_score) ranking with gem weight CASE expression
-- Per GEM-03 (ranking replacement), GEM-06 (leaderboard ranking)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Recreate recalculate_rankings() with gem-weighted scoring
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recalculate_rankings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  threshold_rookie FLOAT := 500;
  threshold_digger FLOAT := 2000;
  threshold_prophet FLOAT := 5000;
BEGIN
  WITH rarity AS (
    SELECT ci.user_id,
           COALESCE(SUM(
             CASE
               WHEN COALESCE(r.rarity_score, 0) >= 6.0 THEN 100
               WHEN COALESCE(r.rarity_score, 0) >= 3.0 THEN 35
               WHEN COALESCE(r.rarity_score, 0) >= 1.5 THEN 20
               WHEN COALESCE(r.rarity_score, 0) >= 0.8 THEN 8
               WHEN COALESCE(r.rarity_score, 0) >= 0.3 THEN 3
               ELSE 1
             END
           ), 0) AS rarity_score
    FROM collection_items ci
    JOIN releases r ON r.id = ci.release_id
    GROUP BY ci.user_id
  ),
  contribution AS (
    SELECT p.id AS user_id,
           COALESCE(rev.cnt, 0) * 10 +
           COALESCE(gp.cnt, 0) * 3 +
           COALESCE(fg.cnt, 0) * 1 +
           COALESCE(fr.cnt, 0) * 2
           AS contribution_score
    FROM profiles p
    LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM reviews GROUP BY user_id) rev ON rev.user_id = p.id
    LEFT JOIN (SELECT user_id, COUNT(*) AS cnt FROM group_posts GROUP BY user_id) gp ON gp.user_id = p.id
    LEFT JOIN (SELECT follower_id AS user_id, COUNT(*) AS cnt FROM follows GROUP BY follower_id) fg ON fg.user_id = p.id
    LEFT JOIN (SELECT following_id AS user_id, COUNT(*) AS cnt FROM follows GROUP BY following_id) fr ON fr.user_id = p.id
  ),
  scores AS (
    SELECT
      COALESCE(r.user_id, c.user_id) AS user_id,
      COALESCE(r.rarity_score, 0) AS rarity_score,
      COALESCE(c.contribution_score, 0) AS contribution_score,
      COALESCE(r.rarity_score, 0) * 0.7 + COALESCE(c.contribution_score, 0) * 0.3 AS global_score
    FROM rarity r
    FULL OUTER JOIN contribution c ON r.user_id = c.user_id
  ),
  ranked AS (
    SELECT
      user_id, rarity_score, contribution_score, global_score,
      ROW_NUMBER() OVER (ORDER BY global_score DESC) AS global_rank,
      CASE
        WHEN global_score > threshold_prophet THEN 'Record Archaeologist'
        WHEN global_score > threshold_digger THEN 'Wax Prophet'
        WHEN global_score > threshold_rookie THEN 'Crate Digger'
        ELSE 'Vinyl Rookie'
      END AS title
    FROM scores
  )
  INSERT INTO user_rankings (user_id, rarity_score, contribution_score, global_rank, title, updated_at)
  SELECT user_id, rarity_score, contribution_score, global_rank, title, NOW()
  FROM ranked
  ON CONFLICT (user_id)
  DO UPDATE SET
    rarity_score = EXCLUDED.rarity_score,
    contribution_score = EXCLUDED.contribution_score,
    global_rank = EXCLUDED.global_rank,
    title = EXCLUDED.title,
    updated_at = NOW();
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Recreate genre_leaderboard_mv with gem-weighted scoring
-- ─────────────────────────────────────────────────────────────────────────────

DROP MATERIALIZED VIEW IF EXISTS genre_leaderboard_mv;

CREATE MATERIALIZED VIEW genre_leaderboard_mv AS
SELECT
  ci.user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  unnest(r.genre) AS genre,
  SUM(
    CASE
      WHEN COALESCE(r.rarity_score, 0) >= 6.0 THEN 100
      WHEN COALESCE(r.rarity_score, 0) >= 3.0 THEN 35
      WHEN COALESCE(r.rarity_score, 0) >= 1.5 THEN 20
      WHEN COALESCE(r.rarity_score, 0) >= 0.8 THEN 8
      WHEN COALESCE(r.rarity_score, 0) >= 0.3 THEN 3
      ELSE 1
    END
  ) AS genre_score,
  ur.title
FROM collection_items ci
INNER JOIN releases r ON r.id = ci.release_id
INNER JOIN profiles p ON p.id = ci.user_id
LEFT JOIN user_rankings ur ON ur.user_id = ci.user_id
GROUP BY ci.user_id, p.username, p.display_name, p.avatar_url, unnest(r.genre), ur.title;

CREATE UNIQUE INDEX genre_leaderboard_mv_user_genre_uidx
  ON genre_leaderboard_mv (user_id, genre);

CREATE INDEX genre_leaderboard_mv_genre_score_idx
  ON genre_leaderboard_mv (genre, genre_score DESC);
