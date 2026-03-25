---
phase: 01-foundation-authentication
plan: 02
subsystem: database
tags: [drizzle-orm, postgresql, supabase, rls, schema, drizzle-kit]

# Dependency graph
requires:
  - phase: 01-foundation-authentication/01
    provides: "Next.js project scaffold with TypeScript, Tailwind, shadcn/ui"
provides:
  - "Complete Drizzle ORM schema covering all 12 application domains (20 tables)"
  - "RLS policies for every table using Supabase authenticatedRole and authUid"
  - "Custom user_sessions table for session tracking (D-13)"
  - "Custom backup_codes table for 2FA recovery (AUTH-06)"
  - "Drizzle client configured with prepare: false for Supabase connection pooler"
  - "Drizzle Kit migration configuration"
affects: [01-foundation-authentication, 02-discogs-integration, 03-collection-management, 04-wantlist-matching, 05-social-features, 06-gamification, 07-groups-reviews, 08-notifications, 09-p2p-trading, 10-subscriptions]

# Tech tracking
tech-stack:
  added: [drizzle-orm, drizzle-kit, postgres]
  patterns: [drizzle-supabase-rls, prepare-false-pooler, schema-barrel-export]

key-files:
  created:
    - src/lib/db/index.ts
    - src/lib/db/schema/users.ts
    - src/lib/db/schema/sessions.ts
    - src/lib/db/schema/collections.ts
    - src/lib/db/schema/releases.ts
    - src/lib/db/schema/social.ts
    - src/lib/db/schema/trades.ts
    - src/lib/db/schema/notifications.ts
    - src/lib/db/schema/gamification.ts
    - src/lib/db/schema/subscriptions.ts
    - src/lib/db/schema/wantlist.ts
    - src/lib/db/schema/reviews.ts
    - src/lib/db/schema/groups.ts
    - src/lib/db/schema/index.ts
    - drizzle.config.ts
  modified: []

key-decisions:
  - "Used supabaseAuthAdminRole for service-only tables (releases, subscriptions, user_badges) instead of authenticated role"
  - "Backup codes use code_hash field with no DELETE policy -- codes are invalidated not deleted, per security best practice"
  - "All tables use uuid defaultRandom() PK pattern except profiles which uses plain uuid PK (references auth.users.id)"

patterns-established:
  - "Schema file pattern: imports from drizzle-orm/pg-core + drizzle-orm/supabase, exports pgTable with pgPolicy array"
  - "RLS pattern: authenticatedRole for user-facing tables, supabaseAuthAdminRole for system-managed tables"
  - "Schema barrel: src/lib/db/schema/index.ts re-exports all domain modules"
  - "Drizzle client: prepare: false mandatory for Supabase connection pooler"

requirements-completed: [AUTH-01, AUTH-02, AUTH-05, AUTH-06, SEC-01]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 01 Plan 02: Database Schema Summary

**Complete Drizzle ORM schema with 20 tables, 59 RLS policies, and custom session/backup-code tables for Supabase PostgreSQL**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T05:58:02Z
- **Completed:** 2026-03-25T06:02:02Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Defined 20 database tables across 12 domain schema files covering every v1 feature domain
- Applied 59 RLS policies using Supabase helpers (authenticatedRole, authUid, supabaseAuthAdminRole) ensuring database-level authorization from day one (D-12)
- Created custom user_sessions table for the 3-session limit feature (D-13) and backup_codes table for 2FA recovery (AUTH-06)
- Configured Drizzle client with prepare: false for Supabase connection pooler compatibility and Drizzle Kit for migration generation

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Drizzle client and configuration** - `47dcc12` (feat)
2. **Task 2: Define complete application schema with RLS policies** - `5565686` (feat)

## Files Created/Modified

- `src/lib/db/index.ts` - Drizzle client instance with prepare: false for Supabase pooler
- `drizzle.config.ts` - Drizzle Kit migration configuration pointing to schema directory
- `src/lib/db/schema/users.ts` - Profiles table with public read, own-row write RLS
- `src/lib/db/schema/sessions.ts` - user_sessions (D-13) and backup_codes (AUTH-06) tables
- `src/lib/db/schema/collections.ts` - Collection items with public read, own-row CRUD RLS
- `src/lib/db/schema/releases.ts` - Release catalog with public read, service-role-only write
- `src/lib/db/schema/social.ts` - Follows (unique pair constraint) and activity feed tables
- `src/lib/db/schema/trades.ts` - Trade requests (participant-only access) and trade reviews
- `src/lib/db/schema/notifications.ts` - Notifications and notification preferences (own-row only)
- `src/lib/db/schema/gamification.ts` - User rankings, badges, and user_badges (service-role insert)
- `src/lib/db/schema/subscriptions.ts` - Stripe subscription tracking (service-role managed)
- `src/lib/db/schema/wantlist.ts` - Wantlist items with public read, own-row insert/delete
- `src/lib/db/schema/reviews.ts` - Record reviews with public read, own-row CRUD
- `src/lib/db/schema/groups.ts` - Groups, group members, and group posts with creator/member RLS
- `src/lib/db/schema/index.ts` - Barrel export re-exporting all 12 schema modules

## Decisions Made

- Used `supabaseAuthAdminRole` for tables managed by backend systems (releases, subscriptions, user_badges) rather than `authenticatedRole` -- these tables are populated by import pipelines, Stripe webhooks, and gamification systems
- Backup codes table has no DELETE policy -- codes are marked as used (invalidated) rather than deleted, which provides an audit trail and prevents timing-based attacks
- Profiles table uses `uuid("id").primaryKey()` without `defaultRandom()` because it must match the `auth.users.id` from Supabase Auth (set during user creation, not auto-generated)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None - all tables are fully defined with correct column types, defaults, and RLS policies. No placeholder data or TODO markers.

## User Setup Required

None - no external service configuration required for schema definition. Database connection (DATABASE_URL) will be needed when running migrations in a later plan.

## Next Phase Readiness

- Complete schema ready for Supabase Auth integration and middleware setup (Plans 03-08)
- Drizzle Kit configured for migration generation when database is connected
- All RLS policies defined, ready for enforcement upon table creation in Supabase
- Custom session and backup code tables ready for auth flow implementation

## Self-Check: PASSED

- All 15 created files verified present on disk
- Both task commits (47dcc12, 5565686) verified in git history
- TypeScript compilation: 0 errors

---
*Phase: 01-foundation-authentication*
*Completed: 2026-03-25*
