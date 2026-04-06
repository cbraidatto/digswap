-- Add tracklist JSONB column to releases table.
-- Stores array of {position, title, duration} objects from Discogs API.
-- Nullable — populated on import or lazy-loaded on release page visit.

ALTER TABLE public.releases ADD COLUMN IF NOT EXISTS tracklist jsonb;
