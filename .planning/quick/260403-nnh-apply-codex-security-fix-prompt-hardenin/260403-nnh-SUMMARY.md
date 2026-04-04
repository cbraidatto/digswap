## Summary

Applied the security hardening from `C:\Users\INTEL\Desktop\CODEX_SECURITY_FIX_PROMPT.md` without touching `supabase/migrations/` or generating new migrations.

### What changed

- Aligned Drizzle RLS schemas with production for collections, social activity feed, groups, group invites, wantlist, notifications, listening logs, and trades.
- Hardened release creation flows against duplicate inserts in collection and wantlist actions by catching unique violations and refetching existing releases.
- Kept badge awards idempotent by documenting the unique-constraint safety around repeated awards.
- Replaced the session limit check-then-act flow in `signIn` with a single SQL delete statement that trims excess sessions atomically.
- Tightened rate-limit behavior so sensitive mutations fail closed, while reads remain fail open with production warning/error logs when Redis is unavailable.
- Narrowed middleware API exclusions so only the intended API routes bypass session revocation checks.
- Audited `"use server"` exports and server-side logging for the requested auth / validation / rate-limit concerns.
- Updated the affected Discogs integration test to mock the new rate-limit dependency because the hardened runtime behavior made that test fail in a no-Redis test environment.

### Validation

- `npx tsc --noEmit --project apps/web/tsconfig.json`
- `npx tsc --noEmit --project apps/desktop/tsconfig.json`
- `cd apps/web && npx vitest run`

All three completed successfully after the test adjustment.
