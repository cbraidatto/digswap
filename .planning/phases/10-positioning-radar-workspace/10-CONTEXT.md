# Phase 10: Positioning, Radar & Workspace Foundation — Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Source:** PRD Express Path (.planning/research/MASTER-PLAN-PHASES-10-12.md)

<domain>
## Phase Boundary

Transform DigSwap from a generic social feed into a serious digger's active hunting tool. This phase covers Sprints 0–3 of the Master Plan:

- **Sprint 0**: P0 fixes — ungate public profile, enforce Discogs onboarding sync, rewrite landing page copy, remove inline P2P triggers, normalize English-first copy
- **Sprint 0.5**: Leads schema + primitive components — data layer and UI primitives that all subsequent phases depend on
- **Sprint 1**: The Radar home — RadarSection as home hero, /radar dedicated route, RadarEmptyState
- **Sprint 2**: Public identity + acquisition links — trust display, Bounty Link, Rarity Score Card
- **Sprint 3**: Wantlist-filtered crate browsing — WantlistMatchSection on other user profiles, CollectionGrid filter mode, trust display on profile headers

Surfaces in scope:
- `/` — landing page (rewrite copy)
- `/feed` — insert RadarSection above FeedContainer; rename to SIGNAL_BOARD
- `/radar` — new dedicated route (all matches + filters)
- `/perfil/[username]` — move to public route; add WantlistMatchSection, TrustStrip, QuickNotePopover on profile header
- `/perfil/page.tsx` (own profile) — add Holy Grail selection, SHARE_BOUNTY_LINK, GENERATE_RARITY_CARD
- `/u/[username]/bounty` — new public page
- `/api/og/rarity/[username]` — new OG image route
- All owners-list and early P2P surfaces — remove inline REQUEST_TRADE / REQUEST_AUDIO
- Onboarding — remove Discogs sync skip button

Out of scope for Phase 10:
- My Hunts page (/hunts) — Phase 11
- ContextTooltip global surfacing across all pages — Phase 11 (only Radar cards in Phase 10)
- Crate Drop Link — Phase 11
- Pressing Research tab — Phase 11
- Pro upgrade gate + analytics — Phase 12
- Stripe subscription implementation — Phase 12

</domain>

<decisions>
## Implementation Decisions

### D-01: Non-Negotiable Rules (apply to every plan in this phase)

- **P2P as mechanism, not message**: No surface in this phase shows REQUEST_TRADE or REQUEST_AUDIO before profile/collection context is established. This applies to owners-list, Radar cards, crate browsing results, and any new component. P2P entry point is always the profile action, never a search result action.
- **English-first**: All new copy is in English. No PT/EN mixing in any new or modified component.
- **Ghost Protocol aesthetic preserved**: All new components use existing design tokens from `src/app/globals.css`. No new colors, no new font families. Terminal labels in `[UPPERCASE]` with brackets. `font-mono` for metadata. Rarity tier accent colors (primary green / secondary blue / tertiary orange).

### D-02: Public Profile Route Architecture

- **Decision**: `src/app/(protected)/(profile)/perfil/[username]/page.tsx` moves to a public route outside `(protected)`. The new path is `src/app/(public)/perfil/[username]/page.tsx` or the existing route is restructured with middleware allowing public access.
- **Preferred approach**: Remove the `(protected)` group wrapper for this route only. Auth check happens inside the page — non-logged users see the full profile with CTAs; logged users see follow/note/trade actions. Use `createServerClient` with `getUser()` for optional auth, not `requireAuth()`.
- **Why**: Bounty Link, Radar Receipt, and Crate Drop all link to profiles. If profiles require login, none of these acquisition mechanics work. SEO is also blocked.
- **Personalization for logged-in users**: Follow button, QuickNotePopover (header), RequestAudio button on collection cards — all guarded by `user !== null` checks client-side.

### D-03: Discogs Onboarding Gate

- **Decision**: Remove the skip/later button from the Discogs connect step in onboarding. The step is non-skippable.
- **Implementation**: In `src/app/(protected)/onboarding/page.tsx`, remove the step-skip logic for the Discogs step. In `src/components/onboarding/discogs-connect.tsx`, remove the skip button element.
- **Non-blocking behavior**: User can click "Connect Discogs" → OAuth → import starts → user is taken to home with import progress banner. They do NOT wait for import to finish. They must initiate the connection, but the import itself is async and non-blocking.
- **Edge case**: If user has previously connected but skipped (old accounts), they land on home normally. Gate applies only to new onboarding flows.

### D-04: Landing Page Copy

- **Decision**: Full copy rewrite. Remove all instances of "social network", "audio rips", "P2P".
- **New headline**: "Stop waiting for your Holy Grails to go on sale. Find the diggers who actually have them."
- **Subheadline**: Three monospace status lines:
  ```
  [RADAR_ACTIVE]    // wantlist matches across the network
  [COLLECTION_ID]   // your Discogs library, now discoverable
  [TRUST_LAYER]     // verified diggers, real trades, real reputation
  ```
- **CTAs**: Primary = "START_DIGGING" (links to /signup), Secondary = "SIGN_IN"
- **Metadata**: Update `<title>` and `<meta description>` in `src/app/layout.tsx` to match new positioning

### D-05: Leads Schema

- **Decision**: New `leads` table in Drizzle schema before any Radar UI is built (Sprint 0.5 ships before Sprint 1)
- **Schema**:
  ```typescript
  export const leads = pgTable('leads', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    targetType: text('target_type').notNull(), // 'release' | 'user' | 'radar_match'
    targetId: text('target_id').notNull(),
    note: text('note'),
    status: text('status').notNull().default('watching'), // 'watching' | 'contacted' | 'dead_end' | 'found'
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  });
  ```
- **RLS policies**: SELECT, INSERT, UPDATE, DELETE only where `user_id = auth.uid()`
- **Unique constraint**: `(user_id, target_type, target_id)` — one lead per entity per user (upsert pattern)

### D-06: Primitive Components (Sprint 0.5)

All four primitives must ship before Sprint 1 plans begin. They are shared dependencies.

- **`LeadAction`** (`src/components/digger-memory/lead-action.tsx`): Icon button that opens QuickNotePopover. Shows colored dot badge when lead exists for the entity (color = status: blue=watching, green=contacted, gray=dead_end, orange=found).
- **`QuickNotePopover`** (`src/components/digger-memory/quick-note-popover.tsx`): shadcn Popover with Textarea + status Select + save Button. Props: `entityType: 'release' | 'user' | 'radar_match'`, `entityId: string`. Auto-saves on blur. Shows existing note + status on open.
- **`ContextTooltip`** (`src/components/digger-memory/context-tooltip.tsx`): Small badge with status color dot. On hover: shows first 60 chars of note. Only renders when a lead exists for the entity. Used in Phase 10 only on Radar cards; Phase 11 injects it everywhere.
- **`TrustStrip`** (`src/components/trust/trust-strip.tsx`): Horizontal block showing 4 metrics. Props: `userId: string`. Fetches from `tradeReviews` aggregation (avg quality rating) and `tradeRequests` (completion rate, response rate, total count). Available in compact and full variants.
- **`ShareSurface`** (`src/components/share/share-surface.tsx`): Reusable copy-to-clipboard + optional Web Share API button. Props: `url: string`, `label: string`.
- **`useDiggerMemory`** (`src/hooks/use-digger-memory.ts`): Hook — `useDiggerMemory(type, id)` returns `{ lead, save, isLoading }`. Uses SWR for client-side caching. Cache key: `['lead', userId, type, id]`.

### D-07: The Radar Section

- **`RadarSection`** (`src/app/(protected)/(feed)/feed/_components/radar-section.tsx`): Server component that calls existing wantlist match queries from Phase 6. Shows a max of 3–5 match cards inline on the home feed. Each card: avatar, username link, release title, rarity tier badge, overlap info ("also wants X record you own"), LeadAction button, status display.
- **Feed page change**: Title `ARCHIVE_FEED` → `SIGNAL_BOARD`. RadarSection inserted above FeedContainer. If `!progressState.discogsConnected`, render RadarEmptyState instead of RadarSection.
- **`/radar` route** (`src/app/(protected)/radar/page.tsx`): Full match list with filter chips (rarity tier, genre, era). Sort by overlap score. "VIEW_ALL_MATCHES" link from RadarSection leads here. Same card format as RadarSection but paginated.
- **`RadarEmptyState`** (`src/app/(protected)/(feed)/feed/_components/radar-empty-state.tsx`): Shown when Discogs not connected OR wantlist empty. Copy: `THE_RADAR // status: no signal — Connect your Discogs wantlist to activate the Radar.` CTA links to `/settings`.

### D-08: Trust Display Upgrade

- **Decision**: Replace the single-line `TRADES: 12 · AVG: 4.7★` in profile headers with `TrustStrip` component.
- **Applies to**: `perfil/_components/profile-header.tsx` (own profile), `perfil/[username]/_components/profile-header.tsx` (other user). On public (non-authed) view, TrustStrip is still visible.
- **Data source**: Computed server-side from existing `tradeReviews` and `tradeRequests` tables (Fase 9 schema). No new schema required for trust display.

### D-09: Bounty Link

- **Route**: `src/app/u/[username]/bounty/page.tsx` — outside `(protected)`, publicly accessible.
- **Content**: Up to 3 wantlist items marked as Holy Grail by the user. Each shown with cover art, rarity score, release title/artist. CTA: "I have this record → Connect" — for logged-in users leads to trade initiation; for non-users leads to `/signup?ref=bounty&from=[username]`.
- **Holy Grail selection**: Add `is_holy_grail: boolean` column to `wantlistItems` table OR store as a JSON array on `profiles.holy_grail_ids`. Prefer profiles column (simpler, max 3 items). User selects from wantlist in own profile settings.
- **Share surface**: `SHARE_BOUNTY_LINK` button on own profile copies `/u/[username]/bounty` to clipboard using `ShareSurface`.

### D-10: Rarity Score Card (OG Image)

- **Route**: `src/app/api/og/rarity/[username]/route.tsx` using Next.js `ImageResponse`.
- **Dimensions**: 1200×630 (standard OG).
- **Content**: Ghost Protocol aesthetic. Username, collection count, obscurity percentile vs. network, rarity average score, ultra rare count, site URL in footer. Dark background (#10141a), primary green (#6fdd78) for accent values.
- **Generation**: Computed server-side from existing `collectionItems` + `releases` data. No caching required for MVP (generates on demand).
- **Profile UI**: "GENERATE_RARITY_CARD" button on own profile opens a modal with `<img src="/api/og/rarity/[username]">` preview and `ShareSurface` component for copy + native share.

### D-11: Wantlist-Filtered Crate Browsing

- **`WantlistMatchSection`** (`src/app/(protected)/(profile)/perfil/_components/wantlist-match-section.tsx`): Rendered server-side in `/perfil/[username]`. Calls `getWantlistIntersections(currentUserId, targetUserId)`. Only renders if intersections > 0. Shows: count badge, horizontal scroll of matching release cards (max 6 visible), toggle buttons: `[SHOW_ONLY_MATCHES]` / `[VIEW_FULL_CRATE]`.
- **Position**: Above `CollectionGrid` in the other user's profile page.
- **CollectionGrid filter mode**: Add `filterToIds?: string[]` prop to `CollectionGrid`. When set, filters rendered records client-side (no re-fetch). Activated by `WantlistMatchSection` toggle.
- **Logged-in only**: WantlistMatchSection only renders when a logged-in user visits someone else's profile (requires `currentUserId`). Public (non-authed) visitors see the full collection only.

### D-12: P2P Surface Cleanup

All of the following must be resolved in Sprint 0:

- `owners-list.tsx` (line ~70): Replace "Request Trade" button with "View Profile →" link to `/perfil/[username]`
- `request-audio-button.tsx` (line ~18): Audit usage — this component is appropriate on public profiles (it's a contextual action after the user has already seen the collection), but must not appear in search results or owner lists without collection context
- `feed-showcase.tsx`: Remove `picsum.photos` placeholder images, replace with Ghost Protocol placeholder or empty states
- Any component with `picsum.photos`: Replace or remove
- Mixed PT/EN labels: Fix throughout (global sweep, not just these files)

### Claude's Discretion

- Exact query for wantlist intersection computation (`getWantlistIntersections`) — can reuse Phase 6 matching logic or write a direct SQL join
- Whether `is_holy_grail` lives on `profiles.holy_grail_ids` (JSON array, max 3) or as a column on `wantlist_items`
- Progress bar design for TrustStrip metrics (visual treatment of percentage bars)
- Whether `/radar` paginator uses infinite scroll (matching feed pattern) or explicit page controls
- OG image font rendering — use Google Fonts `JetBrains Mono` via `satori` or fall back to system monospace
- Exact copy for RadarSection match cards (short vs long format)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Strategy & Architecture
- `.planning/research/ADR-001-strategic-direction.md` — Non-negotiable decisions: P2P as mechanism, English-first, positioning rules, Digger Memory spec
- `.planning/research/MASTER-PLAN-PHASES-10-12.md` — Sprint 0–6 full plan with tickets, effort estimates, and definition of done per sprint
- `.planning/research/DIGGER_OS_STRATEGY.md` — Product framing reference

### Phase Foundations (read before modifying shared components)
- `.planning/phases/09-p2p-audio-trading/09-CONTEXT.md` — Trade system, trade reputation schema, P2P_ENABLED flag, TOS gate
- `.planning/phases/06-discovery-notifications/06-CONTEXT.md` — Wantlist matching queries, notification infrastructure, Supabase Realtime pattern
- `.planning/phases/05-social-layer/05-CONTEXT.md` — Ghost Protocol feed card language, profile route architecture
- `.planning/phases/04.5-template-alignment/04.5-CONTEXT.md` — Ghost Protocol visual tokens, terminal aesthetic decisions
- `.planning/phases/08-gamification-rankings/08-CONTEXT.md` — Badge system, rank/contribution scoring (trade = +15 pts)

### Schema (read before any migration)
- `src/lib/db/schema/users.ts` — profiles table (add holy_grail_ids column)
- `src/lib/db/schema/trades.ts` — tradeRequests + tradeReviews (source for TrustStrip data)
- `src/lib/db/schema/collections.ts` — collectionItems (source for wantlist intersection + rarity score card)
- `src/lib/db/schema/wantlist.ts` — wantlistItems (add is_holy_grail or reference profiles.holy_grail_ids)
- `src/lib/db/schema/index.ts` — schema barrel export

### Files to Read Before Implementing
- `src/app/globals.css` — Ghost Protocol design tokens (must not add new tokens)
- `src/app/(protected)/(feed)/feed/page.tsx` — Feed page to modify (insert RadarSection)
- `src/app/(protected)/(feed)/feed/_components/feed-container.tsx` — Feed container pattern
- `src/app/(protected)/(profile)/perfil/[username]/page.tsx` — Profile route to ungate
- `src/app/(protected)/(profile)/perfil/_components/collection-grid.tsx` — Grid to extend with filterToIds
- `src/app/(protected)/(explore)/explorar/_components/owners-list.tsx` — Remove REQUEST_TRADE
- `src/components/shell/notification-row.tsx` — NotificationRow pattern for Radar cards
- `src/lib/collection/queries.ts` — Existing query patterns (reuse for WantlistMatchSection)
- `src/lib/wantlist/` — Wantlist query patterns (reuse for intersection logic)
- `src/app/page.tsx` — Landing page to rewrite

</canonical_refs>

<code_context>
## Existing Code Insights

### What Exists and Can Be Reused
- Wantlist matching engine (Phase 6) — `src/lib/wantlist/` has the matching logic; RadarSection calls these queries
- Supabase Realtime pattern (Phase 6 NotificationBell) — same subscription pattern for live Radar updates
- Ghost Protocol card patterns (Phase 5 feed cards) — accent stripe, `[STATUS]` labels, monospace metadata
- Trade reputation data (Phase 9) — `tradeReviews.qualityRating` and `tradeRequests.status` exist; TrustStrip computes from these
- `awardBadge(userId, slug)` utility (Phase 8) — idempotent badge award; no changes needed
- Existing `/perfil/[username]` page — reuse CollectionGrid, FilterBar, Pagination; just ungate route and add new sections
- `createServerClient` pattern — used across server components for optional/required auth

### Integration Points
- RadarSection → Phase 6 wantlist matching queries → existing `wantlist_matches` or equivalent
- TrustStrip → `tradeReviews` + `tradeRequests` tables (Phase 9 schema)
- WantlistMatchSection → Phase 6 discovery queries + Phase 4 collection schema
- Bounty Link → `profiles.holy_grail_ids` (new column) + existing wantlist data
- OG Rarity Card → `collectionItems` + `releases.rarity_score` + network aggregate

### Established Patterns
- Server actions for all mutations (consistent across all phases)
- `font-mono` + `text-[10px]` for metadata labels
- `[UPPERCASE_STATUS]` terminal labels for states
- `surface-container-low` for card backgrounds
- Rarity tier accent: `text-primary` (green/common), `text-secondary` (blue/rare), `text-tertiary` (orange/ultra-rare)
- Drizzle ORM with admin client for cross-user writes
- No client-side routing state for filter/search — URL params or server-side

</code_context>

<specifics>
## Specific Notes

- **Sprint 0 ships first**: All P0 fixes must land before any Sprint 1 components are built. Specifically: public profile ungate and Discogs gate fix are prerequisites for any acquisition link to work.
- **Sprint 0.5 ships before Sprint 1 Radar**: The `leads` schema and primitive components (`LeadAction`, `QuickNotePopover`, `ContextTooltip`) must exist before RadarSection is built, because RadarSection cards include `LeadAction` inline.
- **OG image font**: Use `@vercel/og` / `satori` built into Next.js 15. For JetBrains Mono, fetch from Google Fonts CDN in the route handler. This avoids bundling fonts into the serverless function.
- **Bounty Link is always public**: No auth gate, no login wall. The full page renders server-side with cached profile + wantlist data. Login only activates the CTA (changes from "Create account" to "Connect").
- **WantlistMatchSection is logged-in only**: Non-authed profile visitors do not see the match section (they have no wantlist to match against). The section renders only when `currentUser !== null`.
- **Trust data computation**: TrustStrip reads `tradeReviews` (for avg quality rating) and `tradeRequests` (for completion rate = completed / (completed + declined + expired), response rate = responded / total_received). These are computed server-side per profile page load. No caching needed in Phase 10.
- **P2P_ENABLED flag**: The existing `P2P_ENABLED` env var from Phase 9 must remain respected in all new surfaces. The RequestAudio button on profiles already checks this; ensure new surfaces (Bounty Link CTA, Radar cards) also respect it.

</specifics>

<deferred>
## Deferred to Phase 11

- My Hunts page (`/hunts`)
- Global ContextTooltip injection across all app surfaces (feed cards, search results, community posts)
- Crate Drop Link (`/u/[username]/crate/[id]`)
- Pressing Research tab on releases
- Full profile hierarchy reorder (Phase 10 adds TrustStrip; full reorder happens when Digger Memory is complete)

## Deferred to Phase 12

- Pro upgrade gate components
- Stripe subscription implementation
- `/perfil/analytics` premium page
- CSP hardening and rate limiting (security hardening pass)
- Formal penetration test

</deferred>

---

*Phase: 10-positioning-radar-workspace*
*Context gathered: 2026-03-28 via PRD Express Path*
*Source PRD: .planning/research/MASTER-PLAN-PHASES-10-12.md*
