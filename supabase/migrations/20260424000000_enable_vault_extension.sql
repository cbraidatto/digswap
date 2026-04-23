-- Phase 33.1 / DEP-AUD-05 remediation
-- =====================================================================
-- Closes Pitfall #11: app calls admin.rpc('vault_create_secret', ...)
-- but no public.vault_create_secret wrapper exists, so PostgREST returns
-- a 404 error object that the silent try/catch in
-- apps/web/src/lib/discogs/oauth.ts:84-130 swallowed, falling through to
-- plaintext upsert into public.discogs_tokens.
--
-- Investigation evidence (.planning/phases/033.1-audit-gate-closure/evidence/):
--   01a — supabase_vault extension IS installed on dev (v0.3.1)
--   01b — service_role HAS USAGE on vault schema; vault.create_secret has
--         a 4-arg signature (text, text, text, uuid), NOT 3-arg
--   01c — Hypothesis C confirmed: public.vault_create_secret does NOT exist
--
-- Strategy: keep the extension idempotent (covers fresh prod), then add
-- the missing PostgREST wrappers in public schema. service_role already
-- has the underlying privileges in dev; we GRANT defensively on prod.
--
-- This migration is idempotent: re-running has no side effects.
-- Phase 34 will apply this to prod via `supabase db push --linked`.

-- ---------------------------------------------------------------------
-- 1. Ensure extension exists (no-op on dev where it's already installed)
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault CASCADE;

-- ---------------------------------------------------------------------
-- 2. Defensive grants — Supabase auto-grants these on hosted projects,
--    but a fresh self-hosted instance might not. Idempotent.
-- ---------------------------------------------------------------------
GRANT USAGE ON SCHEMA vault TO service_role;
GRANT SELECT, DELETE ON vault.secrets TO service_role;
GRANT SELECT ON vault.decrypted_secrets TO service_role;

-- Grant EXECUTE on the actual 4-arg signature (verified by 01c probe).
-- The vault extension owner is supabase_admin; service_role needs EXECUTE.
DO $$
BEGIN
  -- vault.create_secret(text, text, text, uuid) — actual signature on v0.3.1
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'vault' AND p.proname = 'create_secret'
      AND pg_get_function_identity_arguments(p.oid) = 'new_secret text, new_name text, new_description text, new_key_id uuid'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION vault.create_secret(text, text, text, uuid) TO service_role';
  END IF;

  -- vault.update_secret(uuid, text, text, text, uuid) — actual signature on v0.3.1
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'vault' AND p.proname = 'update_secret'
      AND pg_get_function_identity_arguments(p.oid) = 'secret_id uuid, new_secret text, new_name text, new_description text, new_key_id uuid'
  ) THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION vault.update_secret(uuid, text, text, text, uuid) TO service_role';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 3. PostgREST wrappers in public schema — root cause of Pitfall #11.
--    The app calls admin.rpc('vault_create_secret', ...). PostgREST
--    routes RPC names to the public schema by default; vault.create_secret
--    is in the vault schema and is NOT auto-exposed by PostgREST.
--    These SECURITY DEFINER wrappers bridge the gap.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vault_create_secret(
  secret text,
  name   text DEFAULT NULL,
  description text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, pg_temp
AS $$
DECLARE
  v_secret_id uuid;
BEGIN
  -- Call the 4-arg vault.create_secret with NULL key_id (default key)
  v_secret_id := vault.create_secret(secret, name, description, NULL::uuid);
  RETURN v_secret_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.vault_delete_secret(name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, pg_temp
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE vault.secrets.name = vault_delete_secret.name;
END;
$$;

-- Lock down: only service_role may invoke (PostgREST exposes by default to
-- whatever role accesses the rpc endpoint; the app uses service_role).
REVOKE ALL ON FUNCTION public.vault_create_secret(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vault_delete_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vault_create_secret(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vault_delete_secret(text) TO service_role;

-- Notify PostgREST to reload its schema cache so the new functions are
-- visible immediately (otherwise rpc('vault_create_secret') would 404
-- for up to ~10 minutes).
NOTIFY pgrst, 'reload schema';
