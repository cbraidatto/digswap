-- Phase 34 RLS probe — verifies that role 'authenticated' with an arbitrary
-- user-uuid sees ZERO rows on tables that should be RLS-locked.
-- Source: 034-RESEARCH.md §4 Step B (L259-L304).
-- Run via: psql "$PROD_DIRECT_URL" -At -f scripts/rls-probe.sql
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated","aud":"authenticated"}';
SELECT 'visible_profiles|' || COUNT(*) FROM public.profiles;
SELECT 'visible_dms|' || COUNT(*) FROM public.direct_messages;
SELECT 'visible_trades|' || COUNT(*) FROM public.trade_requests;
SELECT 'visible_tokens|' || COUNT(*) FROM public.discogs_tokens;
RESET ROLE;
