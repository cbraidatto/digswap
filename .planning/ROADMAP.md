# Roadmap: VinylDig

## Overview

VinylDig delivers a social network for vinyl diggers in 11 phases, moving from foundation (auth, database, design system) through Discogs integration (the cold-start hook), collection management, social features, discovery and matching, community and reviews, gamification, P2P audio trading (with DMCA compliance as a prerequisite), monetization, and a final security hardening pass. Each phase delivers a complete, verifiable capability that unblocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation + Authentication** - Project scaffolding, Supabase auth, database schema, retro/analog design system
- [ ] **Phase 2: UI Shell + Navigation** - 4-tab navigation (Feed, Perfil, Explorar, Comunidade) with per-tab routing
- [ ] **Phase 3: Discogs Integration** - OAuth 1.0a connection, collection/wantlist import, async pipeline with progress
- [ ] **Phase 4: Collection Management** - Public collection profiles, rarity scoring, filtering, sorting, manual entry
- [ ] **Phase 5: Social Layer** - Follow system, activity feed, collection comparison, public profiles
- [ ] **Phase 6: Discovery + Notifications** - Cross-collection search, wantlist matching, in-app/email/push notifications
- [ ] **Phase 7: Community + Reviews** - Genre/era groups, group activity feeds, pressing and release reviews
- [ ] **Phase 8: Gamification + Rankings** - Global/genre leaderboards, badges, titles, composite ranking formula
- [ ] **Phase 9: P2P Audio Trading** - DMCA compliance, WebRTC file transfer, trade reputation, TURN relay
- [ ] **Phase 10: Monetization** - Stripe subscription, freemium gating, premium tier features
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
- [ ] 01-PLAN-01.md -- Scaffold Next.js 15 project with dark-warm design system and security headers
- [ ] 01-PLAN-02.md -- Define complete application database schema with Drizzle ORM and RLS policies
- [ ] 01-PLAN-03.md -- Create Supabase auth infrastructure, validation schemas, and rate limiters
- [ ] 01-PLAN-04.md -- Build sign-up, sign-in, and email verification pages with server actions
- [ ] 01-PLAN-05.md -- Build OAuth callback, forgot password, and reset password flows
- [ ] 01-PLAN-06.md -- Implement TOTP 2FA enrollment, challenge, and backup codes
- [ ] 01-PLAN-07.md -- Build multi-step onboarding wizard
- [ ] 01-PLAN-08.md -- Session management UI and security/auth test suite
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
**Goal**: Users can connect their Discogs account and import their full collection and wantlist into VinylDig
**Depends on**: Phase 1
**Requirements**: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06
**Success Criteria** (what must be TRUE):
  1. User can connect their Discogs account via OAuth and see a confirmation of the linked account
  2. User can trigger an import and see a real-time progress indicator as their collection loads
  3. User can import their wantlist and see it reflected separately from their collection
  4. User can trigger a manual re-sync and see newly added Discogs records appear in VinylDig
  5. User can disconnect their Discogs account and all imported data is removed
**Plans**: 6 plans
Plans:
- [x] 03-01-PLAN.md -- Schema additions, dependency install, type contracts, Zustand store, and Wave 0 test scaffolds
- [x] 03-02-PLAN.md -- OAuth 1.0a flow: helpers, callback route, server action, onboarding button activation
- [x] 03-03-PLAN.md -- Background import pipeline: worker, API route, Realtime broadcast, self-invocation chain
- [x] 03-04-PLAN.md -- Import progress UI: progress page, sticky banner, shadcn components
- [x] 03-05-PLAN.md -- Settings Discogs section: sync, disconnect, re-import with confirmation dialogs
- [ ] 03-06-PLAN.md -- Test implementations and visual verification checkpoint
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
**Plans**: TBD
**UI hint**: yes

### Phase 5: Social Layer
**Goal**: Users can build a social graph, see what fellow diggers are doing, and compare collections
**Depends on**: Phase 4
**Requirements**: SOCL-01, SOCL-02, SOCL-03, SOCL-04, SOCL-05
**Success Criteria** (what must be TRUE):
  1. User can follow another digger and see them in their following list
  2. User can unfollow a digger and that digger disappears from their following list
  3. User sees an activity feed showing recent actions (adds, trades, reviews) from diggers they follow
  4. User can compare their collection with another user and see overlap, unique-to-me, and unique-to-them
  5. User can visit any public profile and browse that user's full collection
**Plans**: TBD
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
**Plans**: TBD
**UI hint**: yes

### Phase 7: Community + Reviews
**Goal**: Users can form communities around shared interests and review specific pressings and releases
**Depends on**: Phase 5
**Requirements**: COMM-01, COMM-02, COMM-03, COMM-04, COMM-05, REV-01, REV-02, REV-03
**Success Criteria** (what must be TRUE):
  1. User can create a group for a genre, era, or style and it appears in the Comunidade tab
  2. User can join and leave groups, and group membership is reflected on their profile
  3. User can post text updates inside a group and view the group's activity feed
  4. User can write a review for a specific pressing or a general release, with a star rating
  5. User can browse all reviews for any pressing or release
**Plans**: TBD
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
**Plans**: TBD
**UI hint**: yes

### Phase 9: P2P Audio Trading
**Goal**: Users can securely transfer audio files directly between browsers with reputation tracking, backed by DMCA compliance infrastructure
**Depends on**: Phase 8
**Requirements**: P2P-01, P2P-02, P2P-03, P2P-04, P2P-05, P2P-06, P2P-07, SEC-05, SEC-06, SEC-07
**Success Criteria** (what must be TRUE):
  1. DMCA agent is registered and notice-and-takedown procedure is operational before any file transfer is possible
  2. Terms of Service explicitly place copyright responsibility on users and are accepted before first trade
  3. User can initiate a file transfer request for a specific record and the recipient can accept or decline
  4. File transfers occur directly browser-to-browser via WebRTC with a progress indicator -- no file data touches the server
  5. After a transfer completes, the recipient can rate the audio quality and that rating updates the sharer's reputation score visible on their profile
**Plans**: TBD

### Phase 10: Monetization
**Goal**: Users can subscribe to a premium tier that unlocks enhanced features while free-tier users retain full social functionality
**Depends on**: Phase 9
**Requirements**: MON-01, MON-02, MON-03, MON-04, MON-05, MON-06, MON-07
**Success Criteria** (what must be TRUE):
  1. Free-tier user is limited to 5 P2P trades per month and sees their remaining count
  2. User can subscribe to premium via Stripe (monthly or annual) and immediately access premium features
  3. Premium user can access collection analytics, create/join premium-only groups, and get priority wantlist matching
  4. User can cancel their premium subscription and retains access until the end of the billing period
**Plans**: TBD
**UI hint**: yes

### Phase 11: Security Hardening
**Goal**: The entire platform passes professional security review with all API surfaces hardened and a formal penetration test completed
**Depends on**: Phase 10
**Requirements**: SEC-02, SEC-03, SEC-04
**Success Criteria** (what must be TRUE):
  1. All API endpoints are protected against injection, IDOR, broken access control, and rate limiting abuse
  2. Security tests exist for every feature developed in Phases 1-10 (written alongside features, not after)
  3. A formal penetration test has been conducted and all critical/high findings are resolved before public launch
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 11

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + Authentication | 0/8 | Planning complete | - |
| 2. UI Shell + Navigation | 0/2 | Planning complete | - |
| 3. Discogs Integration | 5/6 | In Progress|  |
| 4. Collection Management | 0/TBD | Not started | - |
| 5. Social Layer | 0/TBD | Not started | - |
| 6. Discovery + Notifications | 0/TBD | Not started | - |
| 7. Community + Reviews | 0/TBD | Not started | - |
| 8. Gamification + Rankings | 0/TBD | Not started | - |
| 9. P2P Audio Trading | 0/TBD | Not started | - |
| 10. Monetization | 0/TBD | Not started | - |
| 11. Security Hardening | 0/TBD | Not started | - |
