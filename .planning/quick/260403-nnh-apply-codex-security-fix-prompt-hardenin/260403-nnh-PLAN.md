---
type: quick
autonomous: true
files_modified:
  - apps/web/src/lib/db/schema/collections.ts
  - apps/web/src/lib/db/schema/social.ts
  - apps/web/src/lib/db/schema/groups.ts
  - apps/web/src/lib/db/schema/group-invites.ts
  - apps/web/src/lib/db/schema/wantlist.ts
  - apps/web/src/lib/db/schema/notifications.ts
  - apps/web/src/lib/db/schema/listening-logs.ts
  - apps/web/src/lib/db/schema/trades.ts
  - apps/web/src/actions/auth.ts
  - apps/web/src/actions/collection.ts
  - apps/web/src/actions/community.ts
  - apps/web/src/actions/discogs.ts
  - apps/web/src/actions/engagement.ts
  - apps/web/src/actions/leads.ts
  - apps/web/src/actions/notifications.ts
  - apps/web/src/actions/onboarding.ts
  - apps/web/src/actions/profile.ts
  - apps/web/src/actions/sessions.ts
  - apps/web/src/actions/social.ts
  - apps/web/src/actions/trades.ts
  - apps/web/src/actions/wantlist.ts
  - apps/web/src/lib/gamification/badge-awards.ts
  - apps/web/src/lib/rate-limit.ts
  - apps/web/src/lib/supabase/middleware.ts
---

<objective>
Apply the remaining hardening items from CODEX_SECURITY_FIX_PROMPT without touching Supabase migrations or creating new ones.

Scope:
- Align Drizzle schema policies to the production RLS truth in Supabase migrations.
- Close remaining race conditions around release inserts and session pruning.
- Make sensitive mutations fail closed when Redis is unavailable.
- Narrow middleware API exclusions and verify exported server actions still enforce auth.
</objective>

<context>
@C:/Users/INTEL/Desktop/CODEX_SECURITY_FIX_PROMPT.md
@apps/web/src/lib/db/schema/collections.ts
@apps/web/src/lib/db/schema/social.ts
@apps/web/src/lib/db/schema/groups.ts
@apps/web/src/lib/db/schema/group-invites.ts
@apps/web/src/lib/db/schema/wantlist.ts
@apps/web/src/lib/db/schema/notifications.ts
@apps/web/src/lib/db/schema/listening-logs.ts
@apps/web/src/lib/db/schema/trades.ts
@apps/web/src/actions/auth.ts
@apps/web/src/actions/collection.ts
@apps/web/src/actions/community.ts
@apps/web/src/actions/discogs.ts
@apps/web/src/actions/engagement.ts
@apps/web/src/actions/leads.ts
@apps/web/src/actions/notifications.ts
@apps/web/src/actions/onboarding.ts
@apps/web/src/actions/profile.ts
@apps/web/src/actions/sessions.ts
@apps/web/src/actions/social.ts
@apps/web/src/actions/trades.ts
@apps/web/src/actions/wantlist.ts
@apps/web/src/lib/gamification/badge-awards.ts
@apps/web/src/lib/rate-limit.ts
@apps/web/src/lib/supabase/middleware.ts
</context>

<tasks>
1. Update the affected schema files so policy names and predicates match production RLS, keeping the stricter trade review check and documenting the intentional drift.
2. Patch mutation actions to handle duplicate release creation safely, prune sessions atomically, and fail closed for sensitive mutation rate limits.
3. Sweep exported `"use server"` actions plus server-side logging for remaining auth or sensitive logging gaps, then run the requested verification commands as far as the dirty workspace allows.
</tasks>

<success_criteria>
- No schema file would revert the known production RLS fixes on a future Drizzle push.
- Sensitive mutation actions no longer fail open on Redis outages.
- Concurrent release creation and concurrent sign-ins are handled without duplicate or stale-state bugs.
- No new migration files are created and no file under `supabase/migrations/` is modified.
</success_criteria>
