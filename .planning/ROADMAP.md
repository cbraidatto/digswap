# Roadmap: DigSwap

## Overview

DigSwap delivers a social network for vinyl diggers in 11 phases, moving from foundation (auth, database, design system) through Discogs integration (the cold-start hook), collection management, social features, discovery and matching, community and reviews, gamification, P2P audio trading (with DMCA compliance as a prerequisite), monetization, and a final security hardening pass. Each phase delivers a complete, verifiable capability that unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + Authentication** - Project scaffolding, Supabase auth, database schema, retro/analog design system (completed 2026-03-25)
- [x] **Phase 2: UI Shell + Navigation** - 4-tab navigation (Feed, Perfil, Explorar, Comunidade) with per-tab routing (completed 2026-03-25)
- [x] **Phase 3: Discogs Integration** - OAuth 1.0a connection, collection/wantlist import, async pipeline with progress (completed 2026-03-25)
- [x] **Phase 4: Collection Management** - Public collection profiles, rarity scoring, filtering, sorting, manual entry (completed 2026-03-25)
- [x] **Phase 4.5: Template Alignment** - Remove GitHub metaphors, align navigation language, clean placeholder content, wire empty states to product vision (INSERTED, completed 2026-03-25)
- [ ] **Phase 5: Social Layer** - Follow system, activity feed, collection comparison, public profiles
- [x] **Phase 6: Discovery + Notifications** - Cross-collection search, wantlist matching, in-app/email/push notifications (completed 2026-03-26)
- [x] **Phase 7: Community + Reviews** - Genre/era groups, group activity feeds, pressing and release reviews (completed 2026-03-26)
- [ ] **Phase 8: Gamification + Rankings** - Global/genre leaderboards, badges, titles, composite ranking formula
- [ ] **Phase 9: P2P Audio Trading** - DMCA compliance, WebRTC file transfer, trade reputation, TURN relay
- [x] **Phase 10: Positioning, Radar & Workspace Foundation** - Repositioned landing, The Radar as hero feature, public acquisition surfaces, Digger Memory primitives (completed 2026-03-28)
- [ ] **Phase 11: Security Hardening** - OWASP API coverage, security test suite, penetration testing

## Phase Details

### Phase 1: Foundation + Authentication
**Goal**: Users can create accounts and securely access the platform, backed by a production-ready database and design system
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, SEC-01
**Success Criteria** (what must be TRUE):
  1. User can sign up with email/password or Google/GitHub and land on a logged-in state
  2. User can log out, close the browser, return later, and still be logged in (session persistence)
  3. User can reset a forgotten password via email link and log in with the new password
  4. User can enable 2FA (TOTP), log out, and be required to enter a TOTP code on next login
  5. All auth surfaces pass OWASP Top 10 checks (rate limiting, input validation, secure headers)
**Plans**: 8 plans
Plans:
- [x] 01-PLAN-01.md -- Scaffold Next.js 15 project with dark-warm design system and security headers
- [x] 01-PLAN-02.md -- Define complete application database schema with Drizzle ORM and RLS policies
- [x] 01-PLAN-03.md -- Create Supabase auth infrastructure, validation schemas, and rate limiters
- [x] 01-PLAN-04.md -- Build sign-up, sign-in, and email verification pages with server actions
- [x] 01-PLAN-05.md -- Build OAuth callback, forgot password, and reset password flows
- [x] 01-PLAN-06.md -- Implement TOTP 2FA enrollment, challenge, and backup codes
- [x] 01-PLAN-07.md -- Build multi-step onboarding wizard
- [x] 01-PLAN-08.md -- Session management UI and security/auth test suite
**UI hint**: yes

### Phase 2: UI Shell + Navigation
**Goal**: Users navigate the app through a 4-tab layout with deep-link-friendly routing and the retro/analog visual identity
**Depends on**: Phase 1
**Requirements**: NAV-01, NAV-02, NAV-03
**Success Criteria** (what must be TRUE):
  1. App displays 4 primary tabs (Feed, Perfil, Explorar, Comunidade) visible on every authenticated page
  2. Active tab is visually distinct and does not reset when navigating within a tab
  3. User can deep-link to a page within any tab and the correct tab is highlighted
**Plans**: 2 plans
Plans:
- [x] 02-01-PLAN.md -- Shell infrastructure: components, protected layout, middleware, redirects
- [x] 02-02-PLAN.md -- Tab pages with empty states, profile placeholder, and navigation tests
**UI hint**: yes

### Phase 3: Discogs Integration
**Goal**: Users can connect their Discogs account and import their full collection and wantlist into DigSwap
**Depends on**: Phase 1
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06
**Success Criteria** (what must be TRUE):
  1. User can connect their Discogs account via OAuth and see a confirmation of the linked account
  2. User can trigger an import and see a real-time progress indicator as their collection loads
  3. User can import their wantlist and see it reflected separately from their collection
  4. User can trigger a manual re-sync and see newly added Discogs records appear in DigSwap
  5. User can disconnect their Discogs account and all imported data is removed
**Plans**: 6 plans
Plans:
- [x] 03-01-PLAN.md -- Schema additions, dependency install, type contracts, Zustand store, and Wave 0 test scaffolds
- [x] 03-02-PLAN.md -- OAuth 1.0a flow: helpers, callback route, server action, onboarding button activation
- [x] 03-03-PLAN.md -- Background import pipeline: worker, API route, Realtime broadcast, self-invocation chain
- [x] 03-04-PLAN.md -- Import progress UI: progress page, sticky banner, shadcn components
- [x] 03-05-PLAN.md -- Settings Discogs section: sync, disconnect, re-import with confirmation dialogs
- [x] 03-06-PLAN.md -- Test implementations and visual verification checkpoint
**UI hint**: yes

### Phase 4: Collection Management
**Goal**: Users can browse, organize, and showcase their vinyl collection with rarity context
**Depends on**: Phase 3
**Requirements**: COLL-01, COLL-02, COLL-03, COLL-04, COLL-05, COLL-06
**Success Criteria** (what must be TRUE):
  1. User has a public profile page displaying their collection that anyone can visit via URL
  2. Each record in the collection shows a rarity score derived from Discogs have/want data
  3. User can add a record manually (not from Discogs) and it appears in their collection
  4. User can filter their collection by genre, decade, country, and format, and sort by rarity, date added, or alphabetically
  5. User can set the physical condition grade (Mint through Poor) on any record in their collection
**Plans**: 4 plans
Plans:
- [x] 04-01-PLAN.md -- Schema migration (username column), rarity formula fix, utility library, server actions, Wave 0 test scaffolds
- [x] 04-02-PLAN.md -- Collection grid UI, public profile route, filter bar, pagination, own profile rewrite
- [x] 04-03-PLAN.md -- Add Record FAB, Discogs search dialog, condition grade editor
- [x] 04-04-PLAN.md -- Test implementations and human verification checkpoint
**UI hint**: yes

### Phase 4.5: Template Alignment (INSERTED)
**Goal**: Align every existing UI surface with the DigSwap product vision — remove GitHub metaphors, fix navigation language, clean placeholder content, and wire empty states correctly
**Depends on**: Phase 4
**Why now**: Phases 1-4 built working infrastructure with placeholder/GitHub-style UI language. Before building social features on top, the shell must reflect the actual product so future phases build on clean foundations.

**What to fix:**

| Surface | Current (broken) | Target |
|---------|-----------------|--------|
| Sidebar label "Repositories" | GitHub metaphor | "Collection" -> `/perfil` |
| Sidebar label "Organizations" | GitHub metaphor | "Community" -> `/comunidade` |
| Sidebar label "Recent Activity" | Generic | "Feed" -> `/feed` |
| Sidebar "Popular Crews" section | 3 hardcoded fake crews | Remove -- will be real data in Phase 7 |
| Feed items: "star", "fork", "comment" | GitHub metaphors | Digger-appropriate actions (like, repost discovery, comment) |
| Bottom bar FAB -> `/trades/new` | Trades don't exist yet (Phase 9) | Change to `/explorar` or remove until Phase 9 |
| Header nav label "Digger" | Confusing | "Explorar" or "Explore" |
| Comunidade tab: hardcoded swap/discussion/crew data | Fake placeholder | Clean empty states with "coming soon" context |
| Feed: hardcoded trending/system-log sidebars | GitHub UI | Remove or replace with digger-relevant empty states |
| `/perfil`: "ADD_RECORD" button links to `/settings` | Wrong destination | Opens add record modal (already exists as FAB) |

**Success Criteria**:
  1. No GitHub metaphors remain anywhere in the UI (no stars, forks, repositories, organizations)
  2. All navigation labels match product language (Feed, Explorar, Comunidade, Perfil)
  3. Sidebar shows only real navigation -- no hardcoded fake data
  4. Bottom bar FAB makes sense for current phase
  5. Empty states on Feed and Comunidade are clean and honest (not fake placeholder content)
  6. All routes and buttons point to correct destinations
**Plans**: 2 plans
Plans:
- [ ] 04.5-01-PLAN.md -- Shell alignment: rename sidebar labels, remove Popular Crews, collapse bottom bar to 4-tab, fix header nav
- [x] 04.5-02-PLAN.md -- Page alignment: feed empty state, comunidade empty states, remove broken perfil ADD_RECORD link
**UI hint**: yes

### Phase 5: Social Layer
**Goal**: Users can build a social graph, see what fellow diggers are doing, and compare collections
**Depends on**: Phase 4.5
**Requirements**: SOCL-01, SOCL-02, SOCL-03, SOCL-04, SOCL-05
**Success Criteria** (what must be TRUE):
  1. User can follow another digger and see them in their following list
  2. User can unfollow a digger and that digger disappears from their following list
  3. User sees an activity feed showing recent actions (adds, trades, reviews) from diggers they follow
  4. User can compare their collection with another user and see overlap, unique-to-me, and unique-to-them
  5. User can visit any public profile and browse that user's full collection
  6. New user first-day experience: global feed visible before import + 3-step onboarding progress bar (Connect Discogs -> Follow 3 diggers -> Join a group)
**Plans**: 4 plans
Plans:
- [x] 05-01-PLAN.md -- Data layer: test scaffolds, server actions (follow/unfollow/logActivity/loadMoreFeed/searchUsers), query functions, comparison logic, wire logActivity into addRecord
- [x] 05-02-PLAN.md -- Feed page: FeedCard, FollowEventCard, FeedContainer with infinite scroll, ProgressBanner, /feed rewrite
- [x] 05-03-PLAN.md -- Public profiles + Explorar: /perfil/[username] with ProfileHeader and FollowButton, FollowList on own profile, username search on /explorar
- [x] 05-04-PLAN.md -- Collection comparison: /perfil/[username]/compare with 3-column layout, human verification checkpoint
**UI hint**: yes

### Phase 6: Discovery + Notifications
**Goal**: Users can find who has the records they want and get notified when matches appear
**Depends on**: Phase 5
**Requirements**: DISC2-01, DISC2-02, DISC2-03, DISC2-04, NOTF-01, NOTF-02, NOTF-03, NOTF-04
**Success Criteria** (what must be TRUE):
  1. User can search by record name or artist and see which platform users own that record
  2. User can browse collections filtered by genre and decade on the Explorar tab
  3. User receives an in-app notification when a platform user has a record from their wantlist
  4. User receives email notifications for wantlist matches and trade requests
  5. User can configure which notification types they receive (in-app, email, push) per event type
**Plans**: 5 plans
Plans:
- [x] 06-01-PLAN.md -- Data layer: discovery queries (search, browse, suggestions), notification infrastructure (match, email, queries), server actions, test scaffolds
- [x] 06-02-PLAN.md -- Explorar page rewrite: DIGGERS/RECORDS tab bar, record search, genre/decade browse, suggested section
- [x] 06-03-PLAN.md -- NotificationBell component with Realtime subscription, NotificationRow, /notifications page, AppHeader wiring
- [x] 06-04-PLAN.md -- Wantlist match triggers in addRecord and import pipeline, notification preferences UI in settings
- [x] 06-05-PLAN.md -- NotificationBell component tests, full test suite, human verification checkpoint
**UI hint**: yes

### Phase 7: Community + Reviews
**Goal**: Users can form communities around shared interests and review specific pressings and releases
**Depends on**: Phase 5
**Requirements**: COMM-01, COMM-02, COMM-03, COMM-04, COMM-05, REV-01, REV-02, REV-03
**Success Criteria** (what must be TRUE):
  1. Auto-generated genre groups exist from day 1 (Electronic, Jazz, Hip Hop, Rock, Latin, etc.) -- always have content, never empty
  2. User can create a custom group (free-form theme, e.g. "Blue Note Originals SP") and set it as public or private (invite-only)
  3. User can join and leave groups; membership is reflected on their profile
  4. User can post in a group (text + optional linked record) and browse the group feed
  5. User can write a review for a specific pressing or release with a star rating, linked to the group
  6. User can browse all reviews for any pressing or release
**Plans**: 5 plans
Plans:
- [x] 07-01-PLAN.md -- Schema migration (slug, release_id, review_id, group_invites), slugify utility, query functions, server actions, Wave 0 test scaffolds
- [x] 07-02-PLAN.md -- /comunidade group discovery hub (genre groups, member groups, filter chips) + /comunidade/new group creation form
- [x] 07-03-PLAN.md -- /comunidade/[slug] group detail page (header, join/leave, composer, post feed, invite controls) + /join/[token] invite landing
- [x] 07-04-PLAN.md -- Reviews panel on RecordSearchCard (/explorar) + GroupFeedCard in /feed for group_post events
- [x] 07-05-PLAN.md -- Test implementations and human verification checkpoint
**UI hint**: yes

### Phase 8: Gamification + Rankings
**Goal**: Users can see where they stand in the community through rankings, badges, and titles
**Depends on**: Phase 6
**Requirements**: GAME-01, GAME-02, GAME-03, GAME-04, GAME-05, GAME-06
**Success Criteria** (what must be TRUE):
  1. User has a global rank combining rarity score and community contribution visible on their profile
  2. User can view a global leaderboard and leaderboards segmented by genre
  3. User earns badges for milestones (first import, 100 records, first trade, first review) that appear on their profile
  4. User has a visible title on their profile based on rank tier (e.g., "Crate Digger", "Wax Prophet")
  5. Community contribution score visibly tracks trades, reviews, and group activity
**Plans**: 5 plans
Plans:
- [x] 08-01-PLAN.md -- Data layer: gamification constants, badge utility, leaderboard queries, server actions, schema migration, badge seed
- [ ] 08-02-PLAN.md -- Badge triggers in server actions + import worker, pg_cron ranking SQL function
- [x] 08-03-PLAN.md -- RANKINGS tab on /explorar: LeaderboardRow, GenreFilter, RankingsTab components
- [x] 08-04-PLAN.md -- Profile rewrite: RankCard + BadgeRow replacing XP/level, public profile rank + badges
- [x] 08-05-PLAN.md -- Unit test suite (4 test files) and human verification checkpoint
**UI hint**: yes

### Phase 9: P2P Audio Trading
**Goal**: Users can securely transfer audio files directly between browsers with reputation tracking, backed by DMCA compliance infrastructure
**Depends on**: Phase 8
**Requirements**: P2P-01, P2P-02, P2P-03, P2P-04, P2P-05, P2P-06, P2P-07, SEC-05, SEC-06, SEC-07
**Success Criteria** (what must be TRUE):
  1. DMCA agent is registered and notice-and-takedown procedure is operational before any file transfer is possible
  2. Terms of Service explicitly place copyright responsibility on users and are accepted before first trade
  3. Trade is linked to an audio file the user owns -- not required to match a physical record in collection
  4. User can initiate a file transfer request and the recipient can accept or decline
  5. File transfers occur directly browser-to-browser via WebRTC -- no file data touches the server
  6. Audio spectrum analysis available during trade review: free users get 1 analysis per trade, premium users get unlimited
  7. After transfer completes, recipient rates audio quality -> updates sharer's reputation score on profile
  8. Free users limited to 5 trades/month with visible counter; premium users have no limit
**Plans**: TBD

### Phase 10: Positioning, Radar & Workspace Foundation
**Goal**: Transform DigSwap from a generic social feed into a serious digger's active hunting tool — repositioned landing, The Radar as named hero feature, public identity surfaces for viral acquisition, and the minimum workspace layer (Digger Memory primitives + wantlist-filtered crate browsing)
**Depends on**: Phase 9
**Requirements**: ADR-001, RADAR-01, RADAR-02, IDENTITY-01, IDENTITY-02, IDENTITY-03, IDENTITY-04, WORKSPACE-01, WORKSPACE-02, WORKSPACE-03
**Success Criteria** (what must be TRUE):
  1. Landing page contains no instance of "social network" or "audio rip" — uses new ADR-001 positioning
  2. Logged-in home shows RadarSection above the feed with real wantlist matches from the network
  3. /perfil/[username] loads without authentication (public, server-rendered, SEO-indexable)
  4. Onboarding has no Discogs skip button — sync is mandatory with non-blocking progress flow
  5. /u/[username]/bounty is publicly accessible, shows up to 3 Holy Grails, and has account-creation CTA for non-users
  6. Rarity Score Card OG image generates at /api/og/rarity/[username] and is shareable from profile
  7. Visiting another user's collection shows a wantlist intersection section above the CollectionGrid when matches exist
  8. Trust display block (response rate, completion rate, avg quality, trade count) appears on all profiles
  9. No surface shows REQUEST_TRADE or REQUEST_AUDIO before profile context is established (P2P = mechanism not message)
  10. Radar match cards have QuickNotePopover + status dropdown (watching/contacted) — Digger Memory minimum
**Plans**: 5 plans
Plans:
- [x] 10-01-PLAN.md -- Sprint 0: P0 unblocking — landing page rewrite, remove REQUEST_TRADE from owners-list, ungate public profile, lock Discogs onboarding step, copy sweep
- [x] 10-02-PLAN.md -- Sprint 0.5: leads schema migration + all 6 primitive components (LeadAction, QuickNotePopover, ContextTooltip, TrustStrip, ShareSurface, useDiggerMemory hook) + server actions
- [x] 10-03-PLAN.md -- Sprint 1: RadarSection + RadarEmptyState + feed page modification (SIGNAL_BOARD) + /radar route with rarity filters
- [x] 10-04-PLAN.md -- Sprint 2: TrustStrip injection into profile headers + holy_grail_ids schema + Bounty Link public page + Rarity Score Card OG image + own profile sharing controls
- [x] 10-05-PLAN.md -- Sprint 3: WantlistMatchSection + CollectionGrid filterToIds prop + other user profile integration + P2P surface cleanup audit
**UI hint**: yes

### Phase 11: Security Hardening
**Goal**: The entire platform passes professional security review with all API surfaces hardened and a formal penetration test completed
**Depends on**: Phase 10
**Requirements**: SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. All API endpoints are protected against injection, IDOR, broken access control, and rate limiting abuse
  2. Security tests exist for every feature developed in Phases 1-10 (written alongside features, not after)
  3. A formal penetration test has been conducted and all critical/high findings are resolved before public launch
**Plans**: 3 plans
Plans:
- [ ] 11-01-PLAN.md -- Wave 0 test stubs + Zod validation schemas + CSP nonce hardening + open redirect fix
- [ ] 11-02-PLAN.md -- Rate limiting on all server actions + input validation + 5 security test implementations
- [ ] 11-03-PLAN.md -- Auth bypass tests + RLS coverage tests + ZAP pen test prep + human verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Authentication | 8/8 | Complete | 2026-03-25 |
| 2. UI Shell + Navigation | 2/2 | Complete | 2026-03-25 |
| 3. Discogs Integration | 6/6 | Complete   | 2026-03-25 |
| 4. Collection Management | 4/4 | Complete | 2026-03-25 |
| 4.5. Template Alignment | 2/2 | Complete | 2026-03-25 |
| 5. Social Layer | 0/4 | Planned | - |
| 6. Discovery + Notifications | 5/5 | Complete   | 2026-03-26 |
| 7. Community + Reviews | 5/5 | Complete   | 2026-03-26 |
| 8. Gamification + Rankings | 0/5 | Planned | - |
| 9. P2P Audio Trading | 2/6 | In Progress | - |
| 10. Positioning, Radar & Workspace Foundation | 5/5 | Complete   | 2026-03-28 |
| 11. Security Hardening | 0/3 | Not started | - |
