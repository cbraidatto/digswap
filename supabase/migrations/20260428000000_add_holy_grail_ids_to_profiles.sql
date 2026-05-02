-- Schema drift fix: add holy_grail_ids to profiles
--
-- Background: Drizzle schema (apps/web/src/lib/db/schema/users.ts) defines
-- holyGrailIds as jsonb DEFAULT '[]', but no SQL migration was ever generated for
-- this column. The drift surfaced in production when /perfil page query failed
-- with "column holy_grail_ids does not exist" (Postgres ERROR captured in
-- Supabase logs 2026-04-28T15:03Z).
--
-- Already applied to prod via Supabase MCP `apply_migration` on 2026-04-28; this
-- file backfills the supabase/migrations/ trail so future env rebuilds (preview
-- branches, fresh dev installs) get the column too.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS holy_grail_ids jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.profiles.holy_grail_ids IS
  'Array of release IDs marked as personal holy grails (rare records hunted). Drift fix 2026-04-28.';
