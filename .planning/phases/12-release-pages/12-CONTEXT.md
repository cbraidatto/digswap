# Phase 12: Release Pages - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Build public, SEO-indexable release pages at /release/[discogsId]. Each page is the canonical hub for a record in the DigSwap universe: Discogs link, YouTube embed (auto-searched + cached), list of platform users who own this release, and all reviews written for it on the platform. Entry points from collection cards, radar cards, and search results.

NAV-04 (trade icon) and NOTF-05 (notification badge reset) were completed in quick task 260328-tef and are already shipped — do NOT re-implement them.

</domain>

<decisions>
## Implementation Decisions

### YouTube Embed Strategy
- Lazy search + long cache: first visit to a release page triggers a YouTube Data API search (artist + title), result cached in DB indefinitely
- Quota only consumed once per release — subsequent visits serve from cache
- If no YouTube result found, section is hidden gracefully (no broken embed)

### Owners List Design
- Show profile cards: avatar + username + trust rating, top 12 by default
- "Ver todos" link opens full paginated owners list
- Same visual language as radar cards (consistent with existing design system)
- No inline REQUEST_TRADE button on release page — trade initiation stays on profile pages

### URL Structure
- Claude's discretion: /release/[discogsId] — matches Discogs's own URL pattern, easy to SEO-link

### Navigation Entry Points
- Claude's discretion: add "VIEW_RELEASE →" links from CollectionCard, RadarMatch card, and ExplorarRecord search result card

### Reviews on Release Page
- Claude's discretion: show all platform reviews for this release (existing review data from Phase 7), paginated if > 10

### NAV-04 + NOTF-05
- Already complete (quick task 260328-tef) — skip in planning

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope
- `.planning/ROADMAP.md` — Phase 12 goal and success criteria
- `.planning/REQUIREMENTS.md` — REL-01 through REL-05 definitions

### Existing Infrastructure
- `src/lib/db/schema/` — collection, reviews, trade_requests tables
- `src/app/perfil/[username]/` — existing public (non-protected) route pattern to follow
- `src/components/shell/` — AppHeader, NotificationBell, TradeBadge (already updated)
- `src/actions/trades.ts` — getActionableTradeCount (already added)

### Design System
- `CLAUDE.md` — Ghost Protocol visual identity, retro/analog aesthetic, Material Symbols icons

</canonical_refs>

<specifics>
## Specific Ideas

- Release page route must be outside `(protected)` group — same pattern as `/perfil/[username]` which was moved to `src/app/perfil/` for public access
- YouTube Data API v3 — `search.list` endpoint, `q = "${artist} ${title}"`, type=video, maxResults=1
- Cache YouTube result in a `release_youtube_cache` table or a `youtube_video_id` column on the existing releases/collection_items table
- Owners list should show only users with the release in their collection (collection_items join profiles)
- Open Graph meta tags on release page for SEO (title, description, image from Discogs cover art)

</specifics>

<deferred>
## Deferred Ideas

- Recommendations / related releases — v2 (needs data density)
- "Currently trading" indicator on owner cards — Phase 14 (Trade V2)
- Community group links on release page — future
- Discogs price history embed — out of scope (ToS concern)

</deferred>

---

*Phase: 12-release-pages*
*Context gathered: 2026-03-29*
