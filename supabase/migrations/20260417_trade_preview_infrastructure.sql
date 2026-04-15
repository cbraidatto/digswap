-- Phase 28: Trade preview infrastructure + coordinated deploy
-- Adds preview metadata columns, private storage bucket + RLS, and an hourly
-- pg_cron job that invokes the cleanup edge function.
--
-- Deployment note:
--   The cron helper expects these Vault secrets to exist:
--   - trade_preview_project_url        (for example https://<project-ref>.supabase.co)
--   - trade_preview_publishable_key    (the project's publishable / anon key)
--   Until they are populated, the hourly job exits without side effects.

-- ---------------------------------------------------------------------------
-- Section 1: proposal item preview metadata
-- ---------------------------------------------------------------------------

ALTER TABLE public.trade_proposal_items
  ADD COLUMN IF NOT EXISTS file_hash varchar(64);

ALTER TABLE public.trade_proposal_items
  ADD COLUMN IF NOT EXISTS preview_storage_path text;

ALTER TABLE public.trade_proposal_items
  ADD COLUMN IF NOT EXISTS preview_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS trade_proposal_items_preview_expires_at_idx
  ON public.trade_proposal_items (preview_expires_at)
  WHERE preview_storage_path IS NOT NULL;

-- Keep the runtime tables aligned with protocol v2 defaults.
ALTER TABLE public.trade_runtime_sessions
  ALTER COLUMN trade_protocol_version SET DEFAULT 2;

ALTER TABLE public.trade_transfer_receipts
  ALTER COLUMN trade_protocol_version SET DEFAULT 2;

-- ---------------------------------------------------------------------------
-- Section 2: storage bucket
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'trade-previews',
  'trade-previews',
  false,
  536870912,
  ARRAY[
    'audio/flac',
    'audio/x-flac',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/aiff',
    'audio/x-aiff',
    'audio/ogg',
    'application/ogg'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "trade_previews_insert_owner" ON storage.objects;
DROP POLICY IF EXISTS "trade_previews_select_participant" ON storage.objects;

CREATE POLICY "trade_previews_insert_owner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'trade-previews'
    AND array_length(storage.foldername(name), 1) = 2
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND lower(split_part(storage.filename(name), '.', 2)) IN ('flac', 'mp3', 'wav', 'aiff', 'ogg')
    AND EXISTS (
      SELECT 1
      FROM public.trade_proposal_items tpi
      JOIN public.trade_proposals tp
        ON tp.id = tpi.proposal_id
      JOIN public.collection_items ci
        ON ci.id = tpi.collection_item_id
      WHERE tp.trade_id::text = (storage.foldername(name))[1]
        AND tpi.id::text = split_part(storage.filename(name), '.', 1)
        AND ci.user_id = auth.uid()
        AND ci.user_id::text = (storage.foldername(name))[2]
    )
  );

CREATE POLICY "trade_previews_select_participant" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'trade-previews'
    AND array_length(storage.foldername(name), 1) = 2
    AND lower(split_part(storage.filename(name), '.', 2)) IN ('flac', 'mp3', 'wav', 'aiff', 'ogg')
    AND EXISTS (
      SELECT 1
      FROM public.trade_proposal_items tpi
      JOIN public.trade_proposals tp
        ON tp.id = tpi.proposal_id
      JOIN public.trade_requests tr
        ON tr.id = tp.trade_id
      JOIN public.collection_items ci
        ON ci.id = tpi.collection_item_id
      WHERE tp.trade_id::text = (storage.foldername(name))[1]
        AND tpi.id::text = split_part(storage.filename(name), '.', 1)
        AND ci.user_id::text = (storage.foldername(name))[2]
        AND (tr.requester_id = auth.uid() OR tr.provider_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Section 3: hourly cleanup trigger
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

GRANT USAGE ON SCHEMA cron TO postgres;

CREATE OR REPLACE FUNCTION public.invoke_trade_preview_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_url text;
  publishable_key text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'vault') THEN
    EXECUTE $sql$
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'trade_preview_project_url'
      LIMIT 1
    $sql$ INTO project_url;

    EXECUTE $sql$
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE name = 'trade_preview_publishable_key'
      LIMIT 1
    $sql$ INTO publishable_key;
  END IF;

  IF coalesce(trim(project_url), '') = '' OR coalesce(trim(publishable_key), '') = '' THEN
    RAISE NOTICE
      'Skipping trade preview cleanup: Vault secrets trade_preview_project_url and/or trade_preview_publishable_key are not configured.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := project_url || '/functions/v1/cleanup-trade-previews',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || publishable_key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'source', 'pg_cron',
      'bucket', 'trade-previews'
    )
  );
END;
$$;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'trade-preview-cleanup'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'trade-preview-cleanup',
  '0 * * * *',
  $$SELECT public.invoke_trade_preview_cleanup();$$
);
