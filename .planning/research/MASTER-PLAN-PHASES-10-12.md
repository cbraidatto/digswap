# DigSwap Master Plan — Phases 10, 11, 12

**Status:** Approved
**Date:** 2026-03-28
**Participants:** Claude, Codex, Gemini
**Parent:** ADR-001-strategic-direction.md

---

## Context

Product at Phase 9 complete. Ghost Protocol design system is solid. Core features (feed, profiles, trades, community, gamification) are functional. What is missing is the strategic repositioning and the three new feature layers defined in ADR-001: The Radar as hero, Digger Memory as workspace, and monetization of workflow depth.

---

## Four Non-Negotiable Implementation Adjustments

These apply to every sprint and every new component:

**1. Public profile is server-rendered public route**
`/perfil/[username]` must move out of `(protected)`. Server-rendered, SEO-indexable, accessible without login. Personalization (follow button, note popover, trade request) appears only when logged in. This is required for Bounty Link, Radar Receipt, Crate Drop, and SEO to work.

**2. Leads schema ships before Sprint 1**
The Radar in Sprint 1 requires inline note + status on each match card. Sprint 0.5 exists specifically to ship the `leads` schema, server actions, and primitive components before any Radar UI is built.

**3. Discogs sync gate is non-blocking but non-skippable**
Connect Discogs → start import → proceed to home with import status visible. Never a dead end. Never a blocker that prevents home from loading. But the "skip" button is removed permanently.

**4. P2P is a mechanism, never a message — transversal rule**
Every surface: owners-list, request-audio-button, Crate Drop, Radar cards, profile actions. The first read is always curation, collection, context. P2P appears as the action inside an established context, never as the invitation.

---

## Sprint Plan

### SPRINT 0 — P0 Unblocking + Repositioning

**Objective:** Fix what prevents new surfaces from working professionally for the outside world.

**Tickets:**

`[P0]` Ungate public profile
- Move `src/app/(protected)/(profile)/perfil/[username]/page.tsx` to a public route
- Server-rendered, no auth required to load
- Follow button, QuickNotePopover, Request Audio: shown only to logged-in users
- Non-logged visitors see full collection + wantlist + trust display + CTA "Create account to connect"
- Effort: M

`[P0]` Make Discogs sync mandatory in onboarding
- Remove skip button from `src/app/(protected)/onboarding/page.tsx` and `src/components/onboarding/discogs-connect.tsx`
- Replace with: "Connect Discogs to activate the Radar. Without Discogs, the Radar is blind."
- Only options: "Connect now" and "I'll do it later" (stays on screen, does not advance)
- Effort: S

`[P1]` Landing page full rewrite
- `src/app/page.tsx` and `src/app/layout.tsx`
- Remove all instances of "social network" and "audio rips"
- New headline: "Stop waiting for your Holy Grails to go on sale. Find the diggers who actually have them."
- Three status lines in monospace: `[RADAR_ACTIVE]`, `[COLLECTION_ID]`, `[TRUST_LAYER]`
- CTAs: "START_DIGGING" / "SIGN_IN"
- Effort: S

`[P1]` Remove inline REQUEST_TRADE from owners list
- `src/app/(protected)/(explore)/explorar/_components/owners-list.tsx`
- Replace "Request Trade" button with "View Profile →" link
- Trades always originate from profiles, never from search results
- Effort: XS

`[P1]` Remove REQUEST_AUDIO from early surfaces
- `src/app/(protected)/(profile)/perfil/[username]/_components/request-audio-button.tsx`
- Audit all surfaces where P2P appears before profile context is established
- Effort: XS

`[P1]` Normalize copy to English-first
- Remove all `picsum.photos` placeholder images
- Fix "Finded" and all other typos
- Standardize all labels to English throughout protected routes
- Effort: S

**Definition of Done:**
- `/perfil/[username]` loads without login, shows full profile with CTA
- Onboarding has no skip button on Discogs step
- Landing page shows new headline with zero mentions of "social network" or "audio rips"
- owners-list has no inline REQUEST_TRADE
- Zero `picsum.photos` references in codebase

---

### SPRINT 0.5 — Leads Schema + Memory Primitives

**Objective:** Ship the data layer and primitive components that Sprint 1 depends on.

**Tickets:**

`[NEW]` Schema: `leads` table
- `src/lib/db/schema/leads.ts`
```typescript
leads {
  id: uuid primary key,
  user_id: uuid references profiles(id),
  target_type: 'release' | 'user' | 'radar_match',
  target_id: text,
  note: text,
  status: 'watching' | 'contacted' | 'dead_end' | 'found',
  created_at: timestamp,
  updated_at: timestamp
}
```
- RLS: select/insert/update/delete by `user_id = auth.uid()` only
- Migration via Drizzle Kit
- Effort: S

`[NEW]` Server actions for leads
- `src/actions/leads.ts`
- `saveLead(targetType, targetId, note, status)` — upsert
- `getLead(targetType, targetId)` — fetch for current user
- `getLeads(filters?)` — fetch all leads for current user (for My Hunts)
- Effort: S

`[NEW]` `LeadAction` primitive
- `src/components/digger-memory/lead-action.tsx`
- Compact button that opens QuickNotePopover
- Shows colored dot when lead exists for this entity (color = status)
- Effort: S

`[NEW]` `QuickNotePopover` component
- `src/components/digger-memory/quick-note-popover.tsx`
- shadcn Popover + Textarea + status dropdown + save button
- Accepts `entityType` and `entityId`
- Auto-save on blur, fetches existing note on open
- Effort: M

`[NEW]` `ContextTooltip` component
- `src/components/digger-memory/context-tooltip.tsx`
- Small badge showing status color + first 60 chars of note on hover
- Rendered next to any release or user where a lead exists
- Effort: S

`[NEW]` `TrustStrip` component
- `src/components/trust/trust-strip.tsx`
- Compact horizontal strip showing: RESPONSE_RATE, COMPLETION, AVG_QUALITY, TRADES
- Used in profile headers and anywhere trust context is needed
- Data sourced from existing Phase 9 trade_reviews and trade_requests tables
- Effort: S

`[NEW]` `ShareSurface` component
- `src/components/share/share-surface.tsx`
- Reusable copy-to-clipboard + share button with icon
- Used by Bounty Link and Rarity Card
- Effort: XS

`[NEW]` `useDiggerMemory` hook
- `src/hooks/use-digger-memory.ts`
- `useDiggerMemory(type, id)` → returns `{ note, status, save, isLoading }`
- SWR-based with local cache
- Effort: S

**Definition of Done:**
- `leads` table migrated in Supabase
- All server actions tested with RLS (no cross-user leaks)
- QuickNotePopover saves and reloads without page refresh
- ContextTooltip renders correctly given a lead with note + status

---

### SPRINT 1 — The Radar Home

**Objective:** The first thing a logged-in user sees is the Radar, not a generic feed.

**Tickets:**

`[NEW]` `RadarSection` component
- `src/app/(protected)/(feed)/feed/_components/radar-section.tsx`
- Queries wantlist matching data from Phase 6 (existing queries)
- Shows: "X diggers have records from your wantlist / Y of them want records you own"
- Card per match: avatar, username, release title, rarity tier, overlap info
- Each card has `<LeadAction />` and `<ContextTooltip />` inline (from Sprint 0.5)
- "VIEW_ALL_MATCHES →" link to `/radar`
- Effort: L

`[MODIFY]` Feed page — insert RadarSection at top
- `src/app/(protected)/(feed)/feed/page.tsx`
- Rename title from "ARCHIVE_FEED" to "SIGNAL_BOARD"
- Insert `<RadarSection />` above `<FeedContainer />`
- If `progressState.discogsConnected === false`: show `<RadarEmptyState />` instead of RadarSection
- Effort: S

`[NEW]` `RadarEmptyState` component
- `src/app/(protected)/(feed)/feed/_components/radar-empty-state.tsx`
- Activation prompt when Discogs not connected or wantlist is empty
- Copy: "THE_RADAR // status: no signal — Connect your Discogs wantlist to activate the Radar."
- CTA links to `/settings` Discogs section
- Effort: XS

`[NEW]` `/radar` — dedicated Radar route
- `src/app/(protected)/radar/page.tsx`
- Full match list with filters: rarity tier, genre, era
- Sort by overlap score (users who want the most records you own, first)
- Each result has `<LeadAction />`, `<ContextTooltip />`, and "View Profile" action
- Effort: M

**Definition of Done:**
- Home shows RadarSection with real matches above the feed
- If no Discogs, RadarEmptyState shows with working CTA
- `/radar` loads with filters functional
- Each Radar card has LeadAction + ContextTooltip from Sprint 0.5
- No existing features broken

---

### SPRINT 2 — Public Identity + Acquisition Links

**Objective:** Public profile becomes the serious collector's calling card. External links work without login.

**Tickets:**

`[MODIFY]` Trust display upgrade
- `src/app/(protected)/(profile)/perfil/[username]/_components/profile-header.tsx`
- Replace single-line trust text with `<TrustStrip />` component (from Sprint 0.5)
- Add progress bars per metric
- Effort: S

`[MODIFY]` Profile hierarchy reorder
- Both `perfil/page.tsx` and `perfil/[username]` header components
- Order: identity (name/avatar/username) → what I hunt (wantlist highlights) → why trust me (TrustStrip + badges) → collection
- Effort: M

`[NEW]` Bounty Link — public page
- `src/app/u/[username]/bounty/page.tsx` (outside `(protected)`)
- Shows up to 3 Holy Grails selected by user
- Cover art, rarity score, "I have this record → Connect" CTA
- Non-logged visitor sees "Create account to connect"
- Uses `<ShareSurface />` component
- Effort: M

`[MODIFY]` Holy Grail selection in profile
- `src/app/(protected)/(profile)/perfil/page.tsx`
- Add control to mark up to 3 wantlist items as "Holy Grail"
- "SHARE_BOUNTY_LINK" button copies `/u/username/bounty` to clipboard
- Effort: S

`[NEW]` Rarity Score Card — image generation
- `src/app/api/og/rarity/[username]/route.tsx`
- Next.js `ImageResponse` at 1200x630
- Content: username, collection count, obscurity percentile, rarity avg, ultra rare count, site URL
- "GENERATE_RARITY_CARD" button on profile opens modal with preview and share options
- Effort: M

**Definition of Done:**
- `/u/[username]/bounty` loads without login with Holy Grails displayed
- TrustStrip shows 4 metrics on all profiles
- `/api/og/rarity/[username]` returns valid 1200x630 image
- Bounty Link button copies correct URL to clipboard
- Public profile (no login) shows account creation CTA prominently

---

### SPRINT 3 — Wantlist-Filtered Crate Browsing

**Objective:** When you visit someone's collection, the app knows what you want.

**Tickets:**

`[NEW]` `WantlistMatchSection` component
- `src/app/(protected)/(profile)/perfil/_components/wantlist-match-section.tsx`
- Appears at top of another user's collection only if intersections > 0
- Shows: "RADAR_MATCH // X records in this crate match your wantlist"
- Horizontal scroll of matching release cards
- Toggle buttons: "SHOW_ONLY_MATCHES" / "VIEW_FULL_CRATE"
- Effort: M

`[MODIFY]` Other user profile — integrate WantlistMatchSection
- `src/app/(protected)/(profile)/perfil/[username]/page.tsx`
- Add `getWantlistIntersections(currentUserId, targetUserId)` server-side fetch
- Pass intersection IDs to `WantlistMatchSection`
- Render above `CollectionGrid`
- Effort: S

`[MODIFY]` CollectionGrid — add matches-only filter mode
- `src/app/(protected)/(profile)/perfil/_components/collection-grid.tsx`
- Accept `filterToIds?: string[]` prop
- When active, show only records whose IDs are in the list
- Client-side filter, no re-fetch
- Effort: S

**Definition of Done:**
- Visiting a profile where matches exist shows WantlistMatchSection at top
- "SHOW_ONLY_MATCHES" filters grid to only matches
- Section is invisible when there are no matches (zero regression)
- Intersection calculated server-side for performance

---

### SPRINT 4 — Digger Memory Complete + My Hunts

**Objective:** The workspace is complete. Context surfaces everywhere.

**Tickets:**

`[MODIFY]` Inject LeadAction + ContextTooltip into all critical surfaces
- `record-search-card.tsx` — Explorar results
- `owners-list.tsx` — release owner list
- `radar-section.tsx` — Radar cards (already has it from Sprint 1, confirm complete)
- `collection-card.tsx` — other user's collection cards
- `perfil/[username]/_components/profile-header.tsx` — other user profile header
- Each: add `useDiggerMemory` + render `<ContextTooltip />` and `<LeadAction />`
- Effort: M

`[NEW]` `/hunts` — My Hunts page
- `src/app/(protected)/hunts/page.tsx`
- List all leads ordered by `updated_at DESC`
- Status filter chips at top (all / watching / contacted / dead_end / found)
- Each item: type icon (release/user), title/username, note preview, status color, timestamp
- Click leads to the entity (release page or user profile)
- Effort: M

`[MODIFY]` Add Hunts to navigation
- `src/components/shell/bottom-bar.tsx`
- `src/components/shell/app-header.tsx`
- Add "Hunts" tab (can replace or augment — decide based on 5-tab mobile tolerance)
- Effort: XS

**Definition of Done:**
- ContextTooltip appears on all 5 critical surfaces for existing leads
- `/hunts` loads with all leads, filters work correctly
- No lead data leaks to other users (RLS verified)
- Navigation updated and working

---

### SPRINT 5 — Crate Drop + Pressing Research

**Objective:** Package P2P as curation reward. Complete the discovery workspace.

**Tickets:**

`[NEW]` Crate Drop — public page
- `src/app/u/[username]/crate/[id]/page.tsx` (outside `(protected)`)
- Shows up to 10 user-selected records with cover art, rarity scores, collection context
- "Request Trade" appears only inside each card, never in the hero/title
- Copy: "Explore this crate" — never "download" or "files"
- Effort: M

`[MODIFY]` Crate selection in profile
- `src/app/(protected)/(profile)/perfil/page.tsx`
- "SHARE_CRATE" button opens modal to select up to 10 records
- Generates `/u/nome/crate/[id]` link, copyable via `<ShareSurface />`
- Effort: S

`[NEW]` Pressing Research tab in Explorar
- `src/app/(protected)/(explore)/explorar/_components/pressing-research-tab.tsx`
- New tab on each release: pressing variants (country, year, format), community ratings per pressing, who in the network has which version (link to profile)
- Extension of Phase 7 reviews
- Effort: L

**Definition of Done:**
- `/u/nome/crate/[id]` loads without login
- Crate Drop contains zero mentions of "rips", "files", or "download"
- Pressing Research tab appears on releases with at least 1 review
- Crate generation and sharing works end-to-end

---

### SPRINT 6 — Pro Gate + Security Hardening

**Objective:** Monetize workflow depth. Technical hardening.

**Tickets:**

`[NEW]` `ProUpgradeGate` component
- `src/components/pro/pro-upgrade-gate.tsx`
- Inline nudge, does not block the page — appears when limit is hit
- Shows specific limit context: "Unlimited saved hunts (you have 10/10)" / "Real-time Radar alerts"
- CTAs: "UPGRADE_NOW" / "Not now"
- Effort: S

`[MODIFY]` Apply gate at correct points
- `/hunts`: gate when user tries to save 11th lead (free limit: 10)
- `/radar`: gate on real-time alerts (free = daily digest only)
- `/perfil/analytics`: gate entire route for free users
- Effort: S

`[NEW]` `/perfil/analytics` — Pro only
- `src/app/(protected)/(profile)/perfil/analytics/page.tsx`
- Rarity trends, relative collection value history, scene intelligence (most hunted genres in network)
- Gated: redirects to upgrade if `plan === 'free'`
- Effort: L

`[SECURITY]` CSP + Rate limiting + Pen testing prep
- Remove `unsafe-inline` from CSP headers on P2P views
- Add rate limiting on critical endpoints (trade initiation, search, lead saves)
- Document all surfaces for external pen testing
- Effort: M

**Definition of Done:**
- Free user sees ProUpgradeGate at lead limit and radar real-time limit
- `/perfil/analytics` redirects to upgrade for free users
- CSP headers contain no `unsafe-inline` in production
- Rate limiting active on documented endpoints

---

## Build Dependency Map

```
Sprint 0    ← no dependencies (fixes only)
Sprint 0.5  ← depends on Sprint 0 (schema on clean codebase)
Sprint 1    ← depends on Sprint 0.5 (RadarSection needs LeadAction/ContextTooltip)
Sprint 2    ← depends on Sprint 0 (public profile ungate required for Bounty Link)
Sprint 3    ← depends on Sprint 1 (wantlist context makes sense after Radar exists)
Sprint 4    ← depends on Sprint 0.5 (leads schema) + Sprint 1 (Radar surfaces)
Sprint 5    ← depends on Sprint 4 (Crate Drop needs lead context established)
Sprint 6    ← depends on Sprint 10 Stripe (Phase 10 Monetization) for plan checks
```

---

## Phase Mapping

| Sprint | Phase |
|--------|-------|
| 0, 0.5 | Phase 10 pre-conditions |
| 1, 2, 3 | Phase 10 core |
| 4, 5 | Phase 11 |
| 6 | Phase 12 |

---

## What to Preserve from Current Frontend

- Ghost Protocol design system (`globals.css`) — reuse all tokens unchanged
- Collection comparison page — production-quality, no changes needed
- Collection grid and filter bar components — reuse as-is
- Profile rank/badge display — solid, just reorder in hierarchy
- Trade lobby and spectrogram — complete, no changes needed
- Feed card design language — keep, just add RadarSection above it

---

*Master Plan approved. Ready for Sprint 0 execution.*
*Reference: ADR-001-strategic-direction.md*
