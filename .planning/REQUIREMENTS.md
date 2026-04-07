# Requirements: VinylDig

**Defined:** 2026-03-25
**Core Value:** A digger opens the app and immediately finds who has the record they've been hunting — and sees where they stand in the community.

## v1 Requirements

### Authentication

- [x] **AUTH-01**: User can sign up with email and password
- [x] **AUTH-02**: User can log in with email and password and stay logged in across sessions
- [x] **AUTH-03**: User can reset password via email link
- [x] **AUTH-04**: User can log in with Google or GitHub (OAuth social login)
- [x] **AUTH-05**: User can enable two-factor authentication (TOTP)
- [x] **AUTH-06**: User can disable 2FA and recover access via backup codes

### Navigation

- [x] **NAV-01**: App has 4 primary tabs: Feed, Perfil, Explorar, Comunidade
- [x] **NAV-02**: Active tab is visually indicated and persists on navigation
- [x] **NAV-03**: Each tab has its own navigation stack (deep links work within tabs)

### Discogs Integration

- [x] **DISC-01**: User can connect their Discogs account via OAuth 1.0a
- [x] **DISC-02**: User can import their full Discogs collection (all owned records)
- [x] **DISC-03**: User can import their Discogs wantlist
- [x] **DISC-04**: Import runs asynchronously with progress indicator (large collections take minutes)
- [x] **DISC-05**: User can trigger manual sync to pull latest Discogs changes
- [x] **DISC-06**: User can disconnect their Discogs account and remove imported data

### Collection Management

- [x] **COLL-01**: User has a public profile page showcasing their vinyl collection
- [x] **COLL-02**: Each record in the collection displays rarity score based on Discogs have/want ratio
- [x] **COLL-03**: User can add a record manually (not from Discogs) to their collection
- [x] **COLL-04**: User can filter their collection by genre, decade, country, and format
- [x] **COLL-05**: User can sort their collection by rarity score, date added, and alphabetically
- [x] **COLL-06**: User can mark the physical condition of a record (Mint, VG+, VG, G+, G, F, P)

### Social

- [x] **SOCL-01**: User can follow other diggers
- [x] **SOCL-02**: User can unfollow diggers
- [x] **SOCL-03**: User can view an activity feed showing what their followed diggers added, traded, and reviewed
- [x] **SOCL-04**: User can compare their collection with another user's — seeing overlap and unique records on each side
- [x] **SOCL-05**: User can view any public profile and their collection

### Groups & Community

- [x] **COMM-01**: User can create a community group (genre, era, region, style)
- [x] **COMM-02**: User can join and leave groups
- [x] **COMM-03**: User can post text updates inside a group
- [x] **COMM-04**: User can view a group's activity feed
- [x] **COMM-05**: Group creator can set group visibility (public / premium-only)

### Discovery

- [x] **DISC2-01**: User can search by record name/artist and see which platform users have it in their collection
- [x] **DISC2-02**: User can browse collections filtered by genre and decade
- [x] **DISC2-03**: User receives a notification when a platform user has a record from their wantlist
- [x] **DISC2-04**: Platform suggests records to the user based on their collection taste and similar diggers' collections (collaborative filtering)

### Reviews

- [x] **REV-01**: User can rate and write a review for a specific pressing of a record
- [x] **REV-02**: User can rate the general release (not pressing-specific)
- [x] **REV-03**: User can view all reviews for a pressing or release

### Gamification & Rankings

- [x] **GAME-01**: Each user has a global rank based on combined rarity score and community contribution
- [x] **GAME-02**: User can view the global leaderboard
- [x] **GAME-03**: User can view leaderboards segmented by genre (Jazz, Soul, Hip-Hop, etc.)
- [x] **GAME-04**: User earns badges for milestones (first import, 100 records, first trade, first review, etc.)
- [x] **GAME-05**: User has a visible title on their profile based on rank tier (e.g., "Crate Digger", "Wax Prophet", "Record Archaeologist")
- [x] **GAME-06**: Community contribution score tracks trades completed, reviews written, and activity in groups

### P2P Audio Trading

- [x] **P2P-01**: User can initiate a file transfer request to another user for a specific record
- [x] **P2P-02**: File transfers occur directly browser-to-browser via WebRTC DataChannel — no file touches the server
- [x] **P2P-03**: File transfer uses chunked transfer with progress indicator and resume on disconnect
- [x] **P2P-04**: Both users must be online simultaneously for transfer to occur
- [x] **P2P-05**: After transfer, recipient can rate the audio file quality (1-5 stars + comment)
- [x] **P2P-06**: Sharer's reputation score is updated based on received quality reviews
- [x] **P2P-07**: User's trade reputation is visible on their public profile

### Notifications

- [x] **NOTF-01**: User receives in-app notifications for: wantlist match, trade request, trade completed, ranking movement, new badge earned
- [x] **NOTF-02**: User receives email notifications for: wantlist match, trade request
- [ ] **NOTF-03**: User can enable browser push notifications
- [x] **NOTF-04**: User can configure which notification types they want to receive
- [x] **NOTF-05**: Notification badge count resets to 0 after user reads all notifications (no stale count)

### Navigation

- [x] **NAV-04**: Trade inbox icon visible in navbar beside the notification bell with its own unread count badge

### Release Pages

- [x] **REL-01**: Each release/record has a dedicated public page at /release/[discogsId] (SEO-indexable, no login required)
- [x] **REL-02**: Release page shows a direct link to the corresponding Discogs release page
- [x] **REL-03**: Release page embeds a YouTube video (auto-searched by artist + title, cached in DB to avoid quota burn)
- [x] **REL-04**: Release page lists all platform users who have this release in their collection with links to their profiles
- [x] **REL-05**: Release page shows all reviews written for this release on the platform

### Crates & Sets

- [x] **CRATE-01**: User can create a named crate before a digging session (e.g., "Festa Sábado 05/04")
- [x] **CRATE-02**: From any search result, radar card, or release page, user can add a release to an existing crate
- [x] **CRATE-03**: Within a crate, user can move any item to their wantlist or collection
- [x] **CRATE-04**: User can create a set within a crate — an ordered list of tracks representing a played set
- [x] **CRATE-05**: Set stores track order (position) and optional event metadata (date, venue name)

### Trade V2

- [x] **TRADE2-01**: Trade proposal explicitly shows what each party is offering and requesting before acceptance
- [ ] **TRADE2-02**: Proposer can link an item directly from their Discogs collection as the offer (metadata auto-filled)
- [x] **TRADE2-03**: Proposer fills in audio quality metadata: format (FLAC/MP3/WAV), bitrate, and condition notes
- [x] **TRADE2-04**: Recipient sees full offer details (record, quality specs, notes) before accepting or declining
- [x] **TRADE2-05**: After both accept trade terms, a P2P audio preview phase is initiated before full transfer
- [x] **TRADE2-06**: Preview is a random 1-minute segment of the file at original quality, sent P2P via WebRTC — no server involvement
- [x] **TRADE2-07**: Files shorter than 1 minute are rejected at selection time with a clear validation message
- [x] **TRADE2-08**: Preview plays via Web Audio API in the receiver's browser with waveform visualization generated client-side
- [x] **TRADE2-09**: After both parties accept the preview, the full P2P file transfer proceeds
- [x] **TRADE2-10**: Trade lobby notifies both users with an in-app alert when both parties are simultaneously online

### Social V2

- [ ] **SOC2-01**: Trade participants can exchange messages within a trade-specific thread (no global chat)
- [ ] **SOC2-02**: Online presence indicator visible in trade lobby and on user profiles during active trade

### Monetization (Freemium)

- [x] **MON-01**: Free tier allows up to 5 P2P trades per month
- [x] **MON-02**: Premium tier unlocks unlimited P2P trades
- [x] **MON-03**: Premium tier unlocks collection analytics (estimated value, rarity history, insights)
- [x] **MON-04**: Premium tier unlocks creating and joining premium-only groups
- [x] **MON-05**: Premium tier gives priority wantlist matching (your request surfaces first to users who have the record)
- [x] **MON-06**: User can subscribe to premium via Stripe (monthly/annual)
- [x] **MON-07**: User can cancel premium subscription and retains access until end of billing period

### Security

- [x] **SEC-01**: All authentication surfaces comply with OWASP Top 10
- [x] **SEC-02**: All API endpoints are protected against injection, IDOR, broken access control, and rate limiting abuse
- [x] **SEC-03**: Security tests are written alongside feature development (not post-launch)
- [x] **SEC-04**: Formal penetration test conducted before public launch
- [x] **SEC-05**: Platform registers a DMCA agent and implements notice-and-takedown procedures before P2P feature goes live
- [x] **SEC-06**: Terms of Service explicitly place copyright responsibility on users for files they share via P2P
- [x] **SEC-07**: WebRTC TURN relay is configured by default to prevent user IP address exposure during P2P transfers

---

## v2 Requirements

### Discovery

- **DISC2-V2-01**: Real-time "currently online" indicator for users open to trading
- **DISC2-V2-02**: Scheduled trade requests for when both users are available

### Social

- **SOCL-V2-01**: Direct messaging between users
- **SOCL-V2-02**: Post photos of physical records (sleeve, label, condition shots)

### Collection

- **COLL-V2-01**: Collection value tracking over time (price history per record)
- **COLL-V2-02**: Export collection to CSV/PDF

### Gamification

- **GAME-V2-01**: Time-windowed leaderboards (monthly, weekly) to prevent permanent elite lock
- **GAME-V2-02**: Challenges/quests (e.g., "Find 3 Blue Note originals this month")

### Platform

- **PLAT-V2-01**: Native mobile app (iOS + Android)
- **PLAT-V2-02**: API for third-party integrations

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Vinyl marketplace / buy-sell | Discogs already dominates this; don't compete with the data source |
| Music streaming | Licensing cost and complexity; not the platform's value proposition |
| Server-side file storage of audio | Non-negotiable legal requirement — P2P only, files never stored on platform |
| Self-hosted TURN server (v1) | Operational burden too high for solo developer; use managed service (Metered.ca) |
| Discogs data re-hosting | Discogs ToS limits how data can be cached; use Discogs monthly XML dumps for catalog, live API for user-specific data only |
| Recommendation engine before PMF | Collaborative filtering needs data density — defer until after product-market fit |
| Multi-language support (v1) | English-first global launch; localization deferred |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1: Foundation + Authentication | Complete |
| AUTH-02 | Phase 1: Foundation + Authentication | Complete |
| AUTH-03 | Phase 1: Foundation + Authentication | Complete |
| AUTH-04 | Phase 1: Foundation + Authentication | Complete |
| AUTH-05 | Phase 1: Foundation + Authentication | Complete |
| AUTH-06 | Phase 1: Foundation + Authentication | Complete |
| SEC-01 | Phase 1: Foundation + Authentication | Complete |
| NAV-01 | Phase 2: UI Shell + Navigation | Complete |
| NAV-02 | Phase 2: UI Shell + Navigation | Complete |
| NAV-03 | Phase 2: UI Shell + Navigation | Complete |
| DISC-01 | Phase 3: Discogs Integration | Complete |
| DISC-02 | Phase 3: Discogs Integration | Complete |
| DISC-03 | Phase 3: Discogs Integration | Complete |
| DISC-04 | Phase 3: Discogs Integration | Complete |
| DISC-05 | Phase 3: Discogs Integration | Complete |
| DISC-06 | Phase 3: Discogs Integration | Complete |
| COLL-01 | Phase 4: Collection Management | Complete |
| COLL-02 | Phase 4: Collection Management | Complete |
| COLL-03 | Phase 4: Collection Management | Complete |
| COLL-04 | Phase 4: Collection Management | Complete |
| COLL-05 | Phase 4: Collection Management | Complete |
| COLL-06 | Phase 4: Collection Management | Complete |
| SOCL-01 | Phase 5: Social Layer | Complete |
| SOCL-02 | Phase 5: Social Layer | Complete |
| SOCL-03 | Phase 5: Social Layer | Complete |
| SOCL-04 | Phase 5: Social Layer | Complete |
| SOCL-05 | Phase 5: Social Layer | Complete |
| DISC2-01 | Phase 6: Discovery + Notifications | Complete |
| DISC2-02 | Phase 6: Discovery + Notifications | Complete |
| DISC2-03 | Phase 6: Discovery + Notifications | Complete |
| DISC2-04 | Phase 6: Discovery + Notifications | Complete |
| NOTF-01 | Phase 6: Discovery + Notifications | Complete |
| NOTF-02 | Phase 6: Discovery + Notifications | Complete |
| NOTF-03 | Phase 6: Discovery + Notifications | Pending |
| NOTF-04 | Phase 6: Discovery + Notifications | Complete |
| NOTF-05 | Phase 12: Release Pages | Complete |
| NAV-04 | Phase 12: Release Pages | Complete |
| COMM-01 | Phase 7: Community + Reviews | Complete |
| COMM-02 | Phase 7: Community + Reviews | Complete |
| COMM-03 | Phase 7: Community + Reviews | Complete |
| COMM-04 | Phase 7: Community + Reviews | Complete |
| COMM-05 | Phase 7: Community + Reviews | Complete |
| REV-01 | Phase 7: Community + Reviews | Complete |
| REV-02 | Phase 7: Community + Reviews | Complete |
| REV-03 | Phase 7: Community + Reviews | Complete |
| GAME-01 | Phase 8: Gamification + Rankings | Complete |
| GAME-02 | Phase 8: Gamification + Rankings | Complete |
| GAME-03 | Phase 8: Gamification + Rankings | Complete |
| GAME-04 | Phase 8: Gamification + Rankings | Complete |
| GAME-05 | Phase 8: Gamification + Rankings | Complete |
| GAME-06 | Phase 8: Gamification + Rankings | Complete |
| P2P-01 | Phase 9: P2P Audio Trading | Complete |
| P2P-02 | Phase 9: P2P Audio Trading | Complete |
| P2P-03 | Phase 9: P2P Audio Trading | Complete |
| P2P-04 | Phase 9: P2P Audio Trading | Complete |
| P2P-05 | Phase 9: P2P Audio Trading | Complete |
| P2P-06 | Phase 9: P2P Audio Trading | Complete |
| P2P-07 | Phase 9: P2P Audio Trading | Complete |
| SEC-05 | Phase 9: P2P Audio Trading | Complete |
| SEC-06 | Phase 9: P2P Audio Trading | Complete |
| SEC-07 | Phase 9: P2P Audio Trading | Complete |
| MON-01 | Phase 16: Monetization | Complete |
| MON-02 | Phase 16: Monetization | Complete |
| MON-03 | Phase 16: Monetization | Complete |
| MON-04 | Phase 16: Monetization | Complete |
| MON-05 | Phase 16: Monetization | Complete |
| MON-06 | Phase 16: Monetization | Complete |
| MON-07 | Phase 16: Monetization | Complete |
| SEC-02 | Phase 11: Security Hardening | Complete |
| SEC-03 | Phase 11: Security Hardening | Complete |
| SEC-04 | Phase 11: Security Hardening | Complete |

**Coverage:**
- v1 requirements: 69 total (corrected from prior count of 57)
- Mapped to phases: 69
- Unmapped: 0

---

## v1.1 Requirements — Deploy Readiness

### Build

- [x] **BUILD-01**: Build (`next build`) completa sem erros TypeScript
- [x] **BUILD-02**: Typecheck (`tsc --noEmit`) passa com zero erros

### Security

- [ ] **SEC-08**: Zero vulnerabilidades HIGH/CRITICAL em `pnpm audit`

### Tests

- [ ] **TEST-01**: Todos os testes unitários passam (`vitest run` — 0 failures)

### Quality

- [ ] **QUAL-01**: Lint passa sem erros de formatação CRLF (line endings normalizados para LF)

### Future Requirements

None — this is a focused fix milestone.

### Out of Scope

- Feature development (belongs to v1.0 remaining phases or v2.0)
- E2E test coverage (Playwright tests not in CI yet)
- Analytics/monitoring setup
- vercel.json configuration (defaults are sufficient for first deploy)
- OG tags / metadata completion (cosmetic, not blocking)

## v1.1 Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUILD-01 | Phase 21: TypeScript Fix | Complete |
| BUILD-02 | Phase 21: TypeScript Fix | Complete |
| SEC-08 | Phase 22: Dependency Security | Pending |
| TEST-01 | Phase 23: Test Fix | Pending |
| QUAL-01 | Phase 24: Lint Cleanup | Pending |

**Coverage:**
- v1.1 requirements: 5 total
- Mapped to phases: 5
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-04-06 — v1.1 Deploy Readiness requirements added*
