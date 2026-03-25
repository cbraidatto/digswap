# Phase 3: Discogs Integration - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Connect a user's Discogs account via OAuth 1.0a, import their full collection and wantlist into VinylDig asynchronously with real-time progress feedback, support delta re-sync for keeping data fresh, and allow disconnecting with full data removal. No collection browsing UI (that's Phase 4) — this phase delivers the import pipeline and the progress/status surfaces that wrap it.

</domain>

<decisions>
## Implementation Decisions

### OAuth Connect Placement

- **D-01:** Activate the existing disabled "Connect Discogs" button in the onboarding wizard (Phase 1 placeholder at `src/components/onboarding/discogs-connect.tsx`). This is the primary entry point.
- **D-02:** Also add a Discogs section to the Settings page (`/settings`) as a secondary entry point for users who skipped onboarding. Shows: connected account username, last synced timestamp, "Sync Now" button, and "Disconnect" option.
- **D-03:** OAuth callback triggers import immediately — no confirmation screen. Flow: OAuth success → import starts server-side → user sees import progress screen. Zero extra taps.

### Import Progress UX

- **D-04:** Real-time progress via Supabase Realtime subscription. Progress screen shows: progress bar, "342 / 1,247 records" count, and "Currently importing: [title] — [artist]" beneath it. Updates live as records are written to DB.
- **D-05:** Import runs server-side (Edge Functions + pg_cron) — user can safely close the tab and the import continues. Progress screen is navigable back to from Settings if user leaves.
- **D-06:** On import complete: 2-second success state on the progress screen ("Import complete! 1,247 records added") → auto-redirect to `/perfil`. First experience of their collection.
- **D-07:** Import order: collection first, wantlist second (sequential). Wantlist import starts automatically after collection completes — no user action needed.

### Partial Data During Import

- **D-08:** Records appear in the Perfil tab as they are imported — no lock. Users can start browsing partial collection immediately (Phase 4 will build the full collection UI; this phase just ensures the data streams in).
- **D-09:** While import is running, a sticky banner is shown at the top of the Perfil tab: "Importing… 342/1,247". Tapping the banner navigates to the full import progress screen. Banner disappears when import finishes.
- **D-10:** Same sticky banner appears during manual re-sync.

### Manual Sync

- **D-11:** Delta sync strategy — stores `last_synced_at` timestamp on the user's profile. Re-sync only fetches Discogs collection items added or modified since that timestamp. Fast for frequent syncs.
- **D-12:** Full re-import option available as a separate "Reset and re-import" action in Settings > Discogs (secondary, destructive-styled button). Useful if the user suspects data is out of sync.
- **D-13:** Sync button lives in Settings > Discogs section. During sync: button shows "Syncing…" (disabled). Last synced timestamp updates when complete.

### Disconnect

- **D-14:** Hard delete on disconnect. Removing a Discogs connection deletes: all `collection_items` rows with `added_via = 'discogs'` for that user, and all wantlist items sourced from Discogs. The shared `releases` table is NOT purged (other users may reference the same releases). `profiles.discogs_connected` set to false, `discogs_username` cleared.
- **D-15:** Disconnect is confirmed with a single confirmation dialog ("Disconnect Discogs? Your imported collection and wantlist will be removed from VinylDig.") before executing.

### Claude's Discretion

- Exact OAuth 1.0a request token → authorize URL → access token flow implementation details (using `@lionralfs/discogs-client`)
- Rate limit backoff implementation (exponential backoff on 429s, respect Retry-After header)
- pg_cron job schedule and Edge Function chunking strategy for the import queue
- Import job state storage schema (how progress is persisted so Realtime subscription can read it)
- Exact Supabase Realtime channel name and event shape for progress updates
- Error handling for partial import failures (network timeout mid-import)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Discogs API
- `CLAUDE.md` §"Discogs Integration" — `@lionralfs/discogs-client` 4.1.x usage, rate limit strategy, OAuth 1.0a flow, server-side only constraint
- `CLAUDE.md` §"Stack Patterns by Variant" — Background sync queue pattern: Supabase Edge Functions + pg_cron, incremental sync approach

### Existing Schema
- `src/lib/db/schema/users.ts` — `profiles` table: `discogsUsername`, `discogsConnected`, `updatedAt` fields that this phase activates
- `src/lib/db/schema/collections.ts` — `collectionItems` table: `discogsInstanceId`, `addedVia` fields designed for this import
- `src/lib/db/schema/releases.ts` — `releases` table: `discogsId` unique key, `discogsHave`, `discogsWant`, `rarityScore` fields imported from Discogs

### Existing Components
- `src/components/onboarding/discogs-connect.tsx` — Onboarding placeholder (disabled button). Phase 3 activates this button and implements the OAuth flow.
- `src/app/(protected)/settings/` — Settings page. Phase 3 adds a Discogs section here.

### Project Requirements
- `.planning/REQUIREMENTS.md` §"Discogs Integration" — DISC-01 through DISC-06 acceptance criteria

### Auth Patterns (established in Phase 1)
- `src/actions/auth.ts` — Server action patterns. Discogs OAuth tokens must be stored server-side following the same security posture.
- `src/lib/supabase/middleware.ts` — Route protection pattern. Import progress route must be protected.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/shell/empty-state.tsx` — Can be used for "Discogs not connected" empty states in Perfil/Settings
- `src/components/ui/` — `button`, `card`, `separator`, `badge` all available for the Settings Discogs section and progress screen
- `src/lib/supabase/server.ts` + `src/lib/supabase/middleware.ts` — Auth patterns established; use same `createClient()` calls in Discogs actions
- `src/lib/db/schema/` — `releases`, `collectionItems` tables already defined with correct columns for Discogs data

### Established Patterns
- Server actions (`src/actions/auth.ts`, `src/actions/onboarding.ts`): all Discogs OAuth token handling must use server actions (never expose tokens to client)
- `getClaims()` not `getSession()` for all server-side auth validation (Phase 1 convention)
- Drizzle ORM with Supabase postgres driver — `prepare: false` in connection config (PgBouncer compatibility)
- Biome for linting (no ESLint), Vitest for tests

### Integration Points
- `src/components/onboarding/discogs-connect.tsx` — Remove `disabled` attribute, wire up OAuth flow
- `src/app/(protected)/settings/` — Add `discogs/` subsection or Discogs card to existing settings page
- `src/app/(protected)/layout.tsx` — Import status banner hooks into the protected layout (or Perfil-specific layout)
- `src/lib/supabase/middleware.ts` — Add import progress route to protected paths if needed
- `src/lib/db/schema/users.ts` — `profiles.last_synced_at` timestamp column will need to be added (currently missing from schema)

</code_context>

<specifics>
## Specific Ideas

- The progress screen should feel alive and personal — showing "Currently importing: Kind of Blue — Miles Davis" makes it feel like YOUR collection is loading, not just a number ticking up
- The sticky "Importing… 342/1,247" banner in Perfil should be dismissible but re-appear if user navigates away and back
- Settings > Discogs section: show the connected Discogs username prominently so users can confirm it's the right account
- The "Reset and re-import" action in Settings should be visually subdued (destructive-style, smaller) — it's an escape hatch, not a primary action

</specifics>

<deferred>
## Deferred Ideas

- None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-discogs-integration*
*Context gathered: 2026-03-25*
