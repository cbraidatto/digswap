# Roadmap: DigSwap

## Overview

DigSwap delivers a social network for vinyl diggers in 17 phases, moving from foundation (auth, database, design system) through Discogs integration (the cold-start hook), collection management, social features, discovery and matching, community and reviews, gamification, positioning and radar, security hardening, release pages, crates, trade V2, social V2, monetization, and an Electron desktop trade runtime. Each phase delivers a complete, verifiable capability that unblocks the next.

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
- [x] **Phase 5: Social Layer** - Follow system, activity feed, collection comparison, public profiles (completed 2026-03-26)
- [x] **Phase 6: Discovery + Notifications** - Cross-collection search, wantlist matching, in-app/email/push notifications (completed 2026-03-26)
- [x] **Phase 7: Community + Reviews** - Genre/era groups, group activity feeds, pressing and release reviews (completed 2026-03-26)
- [x] **Phase 8: Gamification + Rankings** - Global/genre leaderboards, badges, titles, composite ranking formula (completed 2026-03-31)
- [ ] **Phase 9: P2P Audio Trading** - DMCA compliance, WebRTC file transfer, trade reputation, TURN relay
- [x] **Phase 10: Positioning, Radar & Workspace Foundation** - Repositioned landing, The Radar as hero feature, public acquisition surfaces, Digger Memory primitives (completed 2026-03-28)
- [x] **Phase 11: Security Hardening** - OWASP API coverage, security test suite, penetration testing (completed 2026-03-28)
- [x] **Phase 12: Release Pages** - Public SEO-indexable page per release: Discogs link, YouTube embed, owners list, reviews
 (completed 2026-03-29)
- [x] **Phase 13: Crates & Sets** - Pre-dig folder creation, add-to-crate from any surface, ordered sets with event metadata (completed 2026-03-29)
- [x] **Phase 14: Trade V2** - Explicit proposal with quality specs + collection linking, P2P 1-min preview, waveform visualization, full transfer after preview acceptance (completed 2026-04-02)
- [ ] **Phase 15: Social V2** - Trade-scoped messaging thread, online presence in trade context
- [ ] **Phase 20: Gem Economy** - Dynamic gem-based rarity system replacing static scores — 6 gem tiers (Quartzo→Diamante), market-like fluctuation, weighted scoring, visual effects
- [x] **Phase 16: Monetization** - Stripe freemium, trade quotas, premium features (completed 2026-03-31)


### v1.1 Deploy Readiness

- [x] **Phase 21: TypeScript Fix** - Fix all TypeScript errors blocking next build and tsc --noEmit (completed 2026-04-07)
- [x] **Phase 22: Dependency Security** - Update Vite and dependencies to resolve HIGH/CRITICAL audit vulnerabilities
 (completed 2026-04-07)
- [x] **Phase 23: Test Fix** - Fix failing unit tests so vitest run passes with 0 failures
 (completed 2026-04-07)
- [ ] **Phase 24: Lint Cleanup** - Normalize CRLF line endings to LF so lint passes cleanly

### v1.2 Trade Redesign (Desktop-Only)

- [x] **Phase 25: Trade Schema + Collection Visibility** - Extend DB schema for multi-item proposals, add collection visibility system (tradeable/not-trading/private), quality metadata on collection items (completed 2026-04-09)
- [x] **Phase 26: Trade Proposals + Counterproposals** - Side-by-side collection browser, multi-item proposal creation, counterproposal negotiation with history, enhanced trade inbox (completed 2026-04-09)
- [ ] **Phase 27: Desktop Audio Pipeline** - File upload with spec extraction via FFmpeg, SHA-256 hashing, 2min preview generation (raw cut, no transcoding), Supabase Storage upload, spectral visualizer
- [ ] **Phase 28: Trade Infrastructure + Coordinated Deploy** - Supabase Storage bucket + lifecycle, Edge Function preview validation, pg_cron cleanup, version gate, protocol version bump, E2E smoke test

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
- [x] 04.5-01-PLAN.md -- Shell alignment: rename sidebar labels, remove Popular Crews, collapse bottom bar to 4-tab, fix header nav
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
- [x] 08-02-PLAN.md -- Badge triggers in server actions + import worker, pg_cron ranking SQL function
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
- [x] 11-01-PLAN.md -- Wave 0 test stubs + Zod validation schemas + CSP nonce hardening + open redirect fix
- [x] 11-02-PLAN.md -- Rate limiting on all server actions + input validation + 5 security test implementations
- [x] 11-03-PLAN.md -- Auth bypass tests + RLS coverage tests + ZAP pen test prep + human verification

### Phase 12: Release Pages
**Goal**: Every record in the Discogs universe gets a public SEO-indexable page on DigSwap, turning every release into an acquisition surface
**Depends on**: Phase 11
**Requirements**: REL-01, REL-02, REL-03, REL-04, REL-05, NOTF-05, NAV-04
**Success Criteria** (what must be TRUE):
  1. /release/[discogsId] loads without authentication and is crawlable by search engines
  2. Page shows Discogs link, YouTube embed (cached), owners list with profile links, and all platform reviews
  3. Notification badge resets to 0 after user reads notifications — no stale count (COMPLETE — quick task 260328-tef)
  4. Trade icon appears in navbar beside notification bell with its own unread count (COMPLETE — quick task 260328-tef)
**Plans**: 3 plans
Plans:
- [x] 12-01-PLAN.md — Data layer: release queries, YouTube server action, CSP frame-src, SearchResult/RadarMatch discogsId fix
- [ ] 12-02-PLAN.md — Public /release/[discogsId] route: layout, page with generateMetadata, hero, YouTube embed, owners section, reviews section
- [x] 12-03-PLAN.md — VIEW_RELEASE entry points (CollectionCard, RecordSearchCard, RadarSection) + unit test suite
**UI hint**: yes

### Phase 13: Crates & Sets
**Goal**: Diggers can organize digging sessions into named crates and document played sets with track order
**Depends on**: Phase 12
**Requirements**: CRATE-01, CRATE-02, CRATE-03, CRATE-04, CRATE-05
**Success Criteria** (what must be TRUE):
  1. User can create a crate and see it in their workspace
  2. From any release card (search, radar, release page), user can add the release to a crate
  3. User can move a crate item to their wantlist or collection
  4. User can create a set inside a crate with draggable track order and optional event metadata (date, venue)
**Plans**: 4 plans
Plans:
- [x] 13-01-PLAN.md -- Schema + data layer: crates/crate_items/sets/set_tracks tables, RLS, server actions, query functions, Zod validation
- [x] 13-02-PLAN.md -- Crates routes: /crates list page, /crates/[id] detail, CrateCard, SetBuilderPanel (@dnd-kit), SetsSection, [MY_CRATES →] on /perfil
- [x] 13-03-PLAN.md -- AddToCratePopover + AddToCrateButton: injection into CollectionCard, RecordSearchCard, and release page
- [x] 13-04-PLAN.md -- Unit tests (server actions + component), human verification checkpoint

### Phase 14: Trade V2
**Goal**: Trade flow becomes a 3-phase negotiation: explicit proposal → P2P audio preview → full transfer
**Depends on**: Phase 13
**Requirements**: TRADE2-01, TRADE2-02, TRADE2-03, TRADE2-04, TRADE2-05, TRADE2-06, TRADE2-07, TRADE2-08, TRADE2-09, TRADE2-10
**Success Criteria** (what must be TRUE):
  1. Trade proposal shows what each party offers and requests explicitly, with quality metadata
  2. Proposer can link a collection item directly (metadata auto-filled) or fill manually
  3. Files under 1 minute are rejected at selection with a clear validation message
  4. After both accept terms, a 1-minute random P2P preview plays in both browsers via Web Audio API
  5. Waveform visualization generated client-side from the preview — no audio touches the server
  6. Full P2P transfer only begins after both parties accept the preview
  7. Both users receive an in-app alert when both are simultaneously online during the transfer window
**Plans**: 5 plans
Plans:
- [x] 14-01-PLAN.md -- Schema migration + constants + status gate fixes + backpressure thresholds
- [x] 14-02-PLAN.md -- Proposal form redesign: collection offering picker, quality metadata, no file upload
- [x] 14-03-PLAN.md -- Lobby state machine, Supabase Presence, bilateral negotiation phase
- [x] 14-04-PLAN.md -- Preview subsystem: SHA-256, Blob.slice preview, P2P transfer, amplitude bars player, bilateral accept
- [x] 14-05-PLAN.md -- Unit tests + human verification checkpoint
**UI hint**: yes

### Phase 15: Social V2
**Goal**: Trade participants can communicate within the trade context; presence is visible during active trades
**Depends on**: Phase 14
**Requirements**: SOC2-01, SOC2-02
**Success Criteria** (what must be TRUE):
  1. Each trade has a message thread visible to both participants within the trade page
  2. Online presence indicator shows in trade lobby when both parties are connected
Plans:
- [x] 15-01-PLAN.md — Data layer: trade_messages schema + RLS + query helpers + server actions (Codex)
- [x] 15-02-PLAN.md — Web trade surfaces: /trades inbox + /trades/[id] detail + message thread + composer (Claude)
- [x] 15-03-PLAN.md — Presence + live sync: derive from trade_runtime_sessions, Supabase Realtime on messages (split)
- [x] 15-04-PLAN.md — Verification + polish: data layer tests + human checkpoint (split)
**UI hint**: yes

### Phase 16: Monetization
**Goal**: Freemium model with Stripe — free tier trade limits, premium unlocks, subscription management
**Depends on**: Phase 15
**Requirements**: MON-01, MON-02, MON-03, MON-04, MON-05, MON-06, MON-07
**Success Criteria** (what must be TRUE):
  1. Free users see a trade counter and are blocked after 5 trades/month with an upgrade prompt
  2. Premium users have no trade limit and access collection analytics, premium groups, priority matching
  3. User can subscribe to premium via Stripe (monthly or annual) and cancel anytime
  4. Subscription state syncs to the database via Stripe webhooks
**Plans**: 5 plans
Plans:
- [x] 16-01-PLAN.md — Stripe webhook handler + checkout/portal server actions (Codex)
- [x] 16-02-PLAN.md — Entitlement layer: quota gate, canInitiateTrade, incrementTradeCount (Codex)
- [x] 16-03-PLAN.md — Pricing page + /settings/billing subscription management UI (Claude)
- [x] 16-04-PLAN.md — Premium surface gates: quota banner, trade block modal, premium badges (Claude)
- [x] 16-05-PLAN.md — Tests + human verification checkpoint (split)

### Phase 17: Desktop Trade Runtime
**Goal**: Electron desktop app as trade runtime — monorepo bootstrap, shared trade-domain package, auth handoff from web, IPC bridge, WebRTC transfer, filesystem, and desktop UI
**Depends on**: Phase 16 (can be developed in parallel with 16 completing)
**Requirements**: DESK-01, DESK-02, DESK-03, DESK-04, DESK-05, DESK-06
**Success Criteria** (what must be TRUE):
  1. Monorepo with pnpm workspaces contains packages/trade-domain with enums, types, Zod schemas, and protocol constants — no Drizzle schema, no server actions
  2. Electron app launches, handles oauth-callback protocol, stores tokens via safeStorage, and shows correct screen based on auth state
  3. Desktop app joins a trade lobby via Supabase RPC lease, sends heartbeats, and reconciles receipts — no Realtime Presence for authority
  4. Renderer shell renders login, inbox, and settings using shared trade-domain types
  5. Web app shows download/update gate with CTA pointing to desktop app when user initiates a trade
  6. Full lobby + file transfer flow works end-to-end: web handoff -> desktop auth -> lobby join -> WebRTC transfer -> file saved to ~/Music/DigSwap/Incoming/<counterparty>/<trade-id>_<filename>
**Plans**: 6 plans
Plans:
- [x] 17-01-PLAN.md — Monorepo workspaces bootstrap + packages/trade-domain skeleton (Codex)
- [x] 17-02-PLAN.md — Electron shell + auth callback + secure token storage + protocol handler (Codex)
- [ ] 17-03-PLAN.md — Lease RPC + heartbeat + reconciliation receipts + ICE telemetry (Codex)
- [x] 17-04-PLAN.md — Desktop renderer shell: login, inbox, settings (Claude)
- [x] 17-05-PLAN.md — Web handoff/download/update gate + CTA integration (Claude)
- [x] 17-06-PLAN.md — Lobby/transfer integration: Codex=runtime/IPC, Claude=renderer/UX (split)
- [x] 17-07-PLAN.md — Transport swap: replace local shim with real WebRTC/DataChannel via PeerJS (Codex)
- [x] 17-08-PLAN.md — Real file picker for sender: replace synthetic source with dialog.showOpenDialog (Codex)
**UI hint**: yes

### Phase 18: Desktop Shell Refactor
**Goal**: Replace the standalone mini-app renderer with a native Electron shell that loads the real web app in the main window, while keeping the trade runtime isolated in a separate privileged local window
**Depends on**: Phase 17
**Requirements**: DESK-07, DESK-08, DESK-09
**Success Criteria** (what must be TRUE):
  1. Main window loads localhost:3000 (dev) / production URL (prod) — full web app visible, no standalone renderer
  2. Main window uses a minimal preload (isDesktop, openTradeWindow, getAppVersion only) — no privileged bridge exposed to remote content
  3. Trade window opens as a separate local BrowserWindow (~600×700) when digswap://trade-handoff fires
  4. Trade window has the full privileged bridge (startTransfer, selectDownloadPath, openFileInExplorer, etc.)
  5. Session sync: web app notifies main process on auth change via minimal bridge; trade runtime uses persisted session
  6. No XSS in web app can reach native trade/filesystem APIs
**Plans**: 3 plans
Plans:
- [x] 18-01-PLAN.md — Main process: split windows + dual preloads + origin allowlist + IPC routing (Codex)
- [x] 18-02-PLAN.md — renderer-trade: second Vite entry + trade UI (LobbyScreen, TransferScreen, CompletionScreen) wired to privileged bridge (Claude)
- [x] 18-03-PLAN.md — Session sync: web app minimal bridge contract + desktopAuth.setSession flow + cleanup of standalone screens (Codex)
**UI hint**: yes

### Phase 21: TypeScript Fix
**Goal**: Production build completes without TypeScript errors
**Depends on**: Nothing (independent fix)
**Requirements**: BUILD-01, BUILD-02
**Success Criteria** (what must be TRUE):
  1. `next build` completes successfully with zero TypeScript errors
  2. `tsc --noEmit` passes with zero errors across the entire codebase
**Plans**: 1 plan
Plans:
- [x] 21-01-PLAN.md — Fix unsafe type casts in gem queries (double-cast through unknown)

### Phase 22: Dependency Security
**Goal**: Zero HIGH/CRITICAL vulnerabilities in dependency audit
**Depends on**: Nothing (independent fix)
**Requirements**: SEC-08
**Success Criteria** (what must be TRUE):
  1. `pnpm audit` reports zero HIGH and zero CRITICAL vulnerabilities
  2. All Vite-related packages are updated to patched versions
**Plans**: 1 plan
Plans:
- [x] 22-01-PLAN.md — Update vite/vitest/@vitejs/plugin-react to resolve 9 audit vulnerabilities

### Phase 23: Test Fix
**Goal**: All unit tests pass with zero failures
**Depends on**: Nothing (independent fix)
**Requirements**: TEST-01
**Success Criteria** (what must be TRUE):
  1. `vitest run` completes with 0 test failures
  2. Previously failing gem-badge.test.tsx passes
**Plans**: TBD

### Phase 24: Lint Cleanup
**Goal**: Lint passes cleanly with no CRLF formatting errors
**Depends on**: Nothing (independent fix)
**Requirements**: QUAL-01
**Success Criteria** (what must be TRUE):
  1. All source files use LF line endings (no CRLF)
  2. Lint (`biome check`) passes with zero formatting errors related to line endings
**Plans**: 2 plans
Plans:
- [x] 24-01-PLAN.md -- Normalize line endings to LF and auto-fix formatting/import/lint issues
- [x] 24-02-PLAN.md -- Fix manual a11y lint errors and add biome-ignore for safe patterns

### Phase 25: Trade Schema + Collection Visibility
**Goal**: Extend the database to support multi-item trade proposals and give users control over which collection items are visible/tradeable
**Depends on**: Phase 24
**Requirements**: TRD-01, TRD-02, TRD-04
**Success Criteria** (what must be TRUE):
  1. `collection_items` has `visibility` column (tradeable/not-trading/private) replacing `open_for_trade`
  2. Other users can see tradeable and not-trading items but NOT private items (RLS enforced)
  3. `trade_proposals` and `trade_proposal_items` tables exist with proper foreign keys
  4. Quality metadata columns (audio_format, bitrate, sample_rate) exist on collection_items
  5. Existing `open_for_trade` values correctly migrated to visibility enum
  6. Visibility toggle UI works on /perfil collection management
**Plans**: 3 plans
Plans:
- [x] 25-01-PLAN.md -- Schema migration: visibility column, quality metadata, trade proposal tables, RLS, data migration
- [x] 25-02-PLAN.md -- Server actions and queries: setVisibility, updateQualityMetadata, updated CollectionItem type
- [ ] 25-03-PLAN.md -- Visibility UI: VisibilitySelector component, collection card badges, trading tab update

### Phase 26: Trade Proposals + Counterproposals
**Goal**: Users can create multi-item trade proposals via side-by-side collection browser and negotiate via counterproposals
**Depends on**: Phase 25
**Requirements**: TRD-03, TRD-05, TRD-06
**Success Criteria** (what must be TRUE):
  1. Side-by-side view shows both users' tradeable collections
  2. Multi-item proposals create correct trade_proposal_items rows (1:1 free, 3:3 premium)
  3. Quality declaration is mandatory at proposal time
  4. Counterproposal creates linked proposal with incrementing sequence_number
  5. Max 10 counterproposal rounds enforced
  6. Trade inbox shows counterproposal notifications
  7. Existing 1:1 trade flow still works (backward compatible)
**Plans**: 4 plans
Plans:
- [x] 26-01-PLAN.md -- Proposal server actions + query layer + unit tests (createProposalAction, createCounterproposalAction, acceptProposalAction, declineProposalAction)
- [x] 26-02-PLAN.md -- Side-by-side proposal creator UI at /trades/new/[userId] with quality declaration
- [ ] 26-03-PLAN.md -- Trade detail page: ProposalHistoryThread + ProposalActionBar (accept/decline/counter)
- [ ] 26-04-PLAN.md -- Counter mode wiring + trade inbox counter badge

### Phase 27: Desktop Audio Pipeline
**Goal**: Desktop app handles file upload, spec extraction, preview generation, and multi-item P2P transfer
**Depends on**: Phase 26
**Requirements**: TRD-07, TRD-08, TRD-09, TRD-10, TRD-11, TRD-13, TRD-14
**Success Criteria** (what must be TRUE):
  1. FFmpeg bundled in Electron extracts specs and generates 2min raw preview (no transcoding)
  2. SHA-256 computed via Node.js crypto, stored immutably in DB
  3. Preview uploaded to Supabase Storage bucket `trade-previews`
  4. Spectral visualizer renders Spek-style display for preview clips
  5. Multi-item P2P transfer completes for 1:1, 2:2, and 3:3 trades
  6. Trade only completes when ALL items have verified receipts
  7. Files shorter than 2 minutes rejected at selection time
**Plans**: 4 plans
Plans:
- [ ] 27-01-PLAN.md -- FFmpeg pipeline: spec extraction, SHA-256, 2min raw preview generation (TDD)
- [ ] 27-02-PLAN.md -- Supabase Storage upload + IPC selectAndPrepareAudio handler
- [ ] 27-03-PLAN.md -- Multi-item batch transfer: sequential per-item, resume from failure (TDD)
- [ ] 27-04-PLAN.md -- Renderer: SpectralVisualizer + AudioPrepScreen + AppShell integration

### Phase 28: Trade Infrastructure + Coordinated Deploy
**Goal**: Infrastructure for preview lifecycle, server-side validation, version gating, and coordinated web+desktop deploy
**Depends on**: Phase 27
**Requirements**: TRD-10, TRD-12, TRD-15
**Success Criteria** (what must be TRUE):
  1. Supabase Storage bucket `trade-previews` with 48h object lifecycle policy
  2. Edge Function validates preview specs (duration, format) against declared quality
  3. pg_cron cleanup job runs hourly for expired previews
  4. Web blocks handoff to desktop versions below MIN_DESKTOP_VERSION
  5. TRADE_PROTOCOL_VERSION bumped to 2
  6. Full E2E: multi-item proposal (web) → accept → handoff → preview (desktop) → transfer → review
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 20 (v1.0), then 21 → 24 (v1.1 Deploy Readiness), then 25 → 28 (v1.2 Trade Redesign)

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Authentication | 8/8 | Complete | 2026-03-25 |
| 2. UI Shell + Navigation | 2/2 | Complete | 2026-03-25 |
| 3. Discogs Integration | 6/6 | Complete   | 2026-03-25 |
| 4. Collection Management | 4/4 | Complete | 2026-03-25 |
| 4.5. Template Alignment | 2/2 | Complete | 2026-03-25 |
| 5. Social Layer | 4/4 | Complete | 2026-03-26 |
| 6. Discovery + Notifications | 5/5 | Complete   | 2026-03-26 |
| 7. Community + Reviews | 5/5 | Complete   | 2026-03-26 |
| 8. Gamification + Rankings | 5/5 | Complete   | 2026-03-31 |
| 9. P2P Audio Trading | - | Superseded — P2P moved to Desktop (Phase 17) | - |
| 10. Positioning, Radar & Workspace Foundation | 5/5 | Complete   | 2026-03-28 |
| 11. Security Hardening | 3/3 | Complete | 2026-03-28 |
| 12. Release Pages | 3/3 | Complete | 2026-03-29 |
| 13. Crates & Sets | 4/4 | Complete | 2026-03-29 |
| 14. Trade V2 | 5/5 | Complete | 2026-04-02 |
| 15. Social V2 | 4/4 | Complete | 2026-03-31 |
| 16. Monetization | 5/5 | Complete ✓ | 2026-03-31 |
| 17. Desktop Trade Runtime | 8/8 | Complete | 2026-03-31 |
| 18. Desktop Shell Refactor | 3/3 | Complete ✓ | 2026-04-02 |
| 19. Security Audit Closure | 3/3 | Complete   | 2026-04-04 |
| 20. Gem Economy | 4/5 | In Progress|  |

**v1.1 Deploy Readiness:**

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|----------|
| 21. TypeScript Fix | 1/1 | Complete    | 2026-04-07 |
| 22. Dependency Security | 1/1 | Complete    | 2026-04-07 |
| 23. Test Fix | 1/1 | Complete    | 2026-04-07 |
| 24. Lint Cleanup | 2/2 | Complete | 2026-04-09 |

**v1.2 Trade Redesign:**

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|----------|
| 25. Trade Schema + Collection Visibility | 2/3 | Complete    | 2026-04-09 |
| 26. Trade Proposals + Counterproposals | 2/4 | Complete    | 2026-04-09 |
| 27. Desktop Audio Pipeline | 0/0 | Not Started |  |
| 28. Trade Infrastructure + Coordinated Deploy | 0/0 | Not Started |  |

### Phase 19: Security Hardening — Fix 74 audit vulnerabilities

**Goal:** Close all remaining security audit vulnerabilities — eliminate nodeIntegration:true from Electron, harden hash validation, add RPC rate limits, align configuration, and verify schema/test coverage
**Requirements**: SEC-AUDIT-01, SEC-AUDIT-02, SEC-AUDIT-03, SEC-AUDIT-04, SEC-AUDIT-05, SEC-AUDIT-06
**Depends on:** Phase 18
**Success Criteria** (what must be TRUE):
  1. PeerJS bridge runs in Electron utilityProcess (no BrowserWindow with nodeIntegration:true)
  2. File transfer is rejected when expectedSha256 from DB is null (no sender hash fallback)
  3. Trade RPC calls are rate-limited (1 call per 5s per function per trade)
  4. Handoff token TTL is aligned to 30s across web and desktop
  5. All 8 Drizzle schema files verified against production security migrations
  6. Full test suite (563+ tests) passes, TypeScript compiles cleanly
**Plans**: 3 plans
Plans:
- [x] 19-01-PLAN.md -- utilityProcess migration: replace BrowserWindow nodeIntegration:true with Electron utilityProcess for PeerJS bridge
- [x] 19-02-PLAN.md -- Hash rejection + RPC rate limits + TTL alignment (3 focused security fixes)
- [x] 19-03-PLAN.md -- Schema spot-check + full test suite gate (verification)

### Phase 20: Gem Economy
**Goal**: Replace the static rarity scoring system with a dynamic gem-based economy — 6 gem tiers that fluctuate like a stock market based on Discogs supply/demand, replacing the current ranking system entirely
**Depends on**: Phase 19
**Requirements**: GEM-01, GEM-02, GEM-03, GEM-04, GEM-05, GEM-06, GEM-07
**Success Criteria** (what must be TRUE):
  1. Every record displays a gem badge (Quartzo/Ametista/Esmeralda/Rubi/Safira/Diamante) instead of the old rarity pill
  2. Gem tier is dynamically computed from current Discogs have/want ratio — changes when ratio changes on re-sync
  3. Gem Score (weighted sum of all gems in collection) replaces rarity_score in global ranking formula
  4. Profile shows gem distribution (vault/portfolio view) with total gem value
  5. Gem tier changes trigger notifications ("Your record X upgraded from Rubi to Safira!")
  6. Leaderboard ranks by Gem Score instead of raw rarity
  7. Higher-tier gems have visual effects (sparkle, glow, prismatic animations on Diamante)
**Plans**: 5 plans
Plans:
- [x] 20-01-PLAN.md -- Gem constants, GemBadge component, CSS animations, and unit tests
- [x] 20-02-PLAN.md -- Ranking SQL migration, gamification constants, leaderboard queries
- [x] 20-03-PLAN.md -- Replace RarityPill with GemBadge across all consumer files + RankCard + LeaderboardRow
- [x] 20-04-PLAN.md -- GemVault profile component, gem distribution queries, tier change notifications, OG image update
- [ ] 20-05-PLAN.md -- Badge awards, Digger DNA labels, RarityCardModal, visual verification checkpoint
**UI hint**: yes

