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
- [ ] **DISC-03**: User can import their Discogs wantlist
- [ ] **DISC-04**: Import runs asynchronously with progress indicator (large collections take minutes)
- [ ] **DISC-05**: User can trigger manual sync to pull latest Discogs changes
- [ ] **DISC-06**: User can disconnect their Discogs account and remove imported data

### Collection Management

- [ ] **COLL-01**: User has a public profile page showcasing their vinyl collection
- [ ] **COLL-02**: Each record in the collection displays rarity score based on Discogs have/want ratio
- [ ] **COLL-03**: User can add a record manually (not from Discogs) to their collection
- [ ] **COLL-04**: User can filter their collection by genre, decade, country, and format
- [ ] **COLL-05**: User can sort their collection by rarity score, date added, and alphabetically
- [ ] **COLL-06**: User can mark the physical condition of a record (Mint, VG+, VG, G+, G, F, P)

### Social

- [ ] **SOCL-01**: User can follow other diggers
- [ ] **SOCL-02**: User can unfollow diggers
- [ ] **SOCL-03**: User can view an activity feed showing what their followed diggers added, traded, and reviewed
- [ ] **SOCL-04**: User can compare their collection with another user's — seeing overlap and unique records on each side
- [ ] **SOCL-05**: User can view any public profile and their collection

### Groups & Community

- [ ] **COMM-01**: User can create a community group (genre, era, region, style)
- [ ] **COMM-02**: User can join and leave groups
- [ ] **COMM-03**: User can post text updates inside a group
- [ ] **COMM-04**: User can view a group's activity feed
- [ ] **COMM-05**: Group creator can set group visibility (public / premium-only)

### Discovery

- [ ] **DISC2-01**: User can search by record name/artist and see which platform users have it in their collection
- [ ] **DISC2-02**: User can browse collections filtered by genre and decade
- [ ] **DISC2-03**: User receives a notification when a platform user has a record from their wantlist
- [ ] **DISC2-04**: Platform suggests records to the user based on their collection taste and similar diggers' collections (collaborative filtering)

### Reviews

- [ ] **REV-01**: User can rate and write a review for a specific pressing of a record
- [ ] **REV-02**: User can rate the general release (not pressing-specific)
- [ ] **REV-03**: User can view all reviews for a pressing or release

### Gamification & Rankings

- [ ] **GAME-01**: Each user has a global rank based on combined rarity score and community contribution
- [ ] **GAME-02**: User can view the global leaderboard
- [ ] **GAME-03**: User can view leaderboards segmented by genre (Jazz, Soul, Hip-Hop, etc.)
- [ ] **GAME-04**: User earns badges for milestones (first import, 100 records, first trade, first review, etc.)
- [ ] **GAME-05**: User has a visible title on their profile based on rank tier (e.g., "Crate Digger", "Wax Prophet", "Record Archaeologist")
- [ ] **GAME-06**: Community contribution score tracks trades completed, reviews written, and activity in groups

### P2P Audio Trading

- [ ] **P2P-01**: User can initiate a file transfer request to another user for a specific record
- [ ] **P2P-02**: File transfers occur directly browser-to-browser via WebRTC DataChannel — no file touches the server
- [ ] **P2P-03**: File transfer uses chunked transfer with progress indicator and resume on disconnect
- [ ] **P2P-04**: Both users must be online simultaneously for transfer to occur
- [ ] **P2P-05**: After transfer, recipient can rate the audio file quality (1-5 stars + comment)
- [ ] **P2P-06**: Sharer's reputation score is updated based on received quality reviews
- [ ] **P2P-07**: User's trade reputation is visible on their public profile

### Notifications

- [ ] **NOTF-01**: User receives in-app notifications for: wantlist match, trade request, trade completed, ranking movement, new badge earned
- [ ] **NOTF-02**: User receives email notifications for: wantlist match, trade request
- [ ] **NOTF-03**: User can enable browser push notifications
- [ ] **NOTF-04**: User can configure which notification types they want to receive

### Monetization (Freemium)

- [ ] **MON-01**: Free tier allows up to 5 P2P trades per month
- [ ] **MON-02**: Premium tier unlocks unlimited P2P trades
- [ ] **MON-03**: Premium tier unlocks collection analytics (estimated value, rarity history, insights)
- [ ] **MON-04**: Premium tier unlocks creating and joining premium-only groups
- [ ] **MON-05**: Premium tier gives priority wantlist matching (your request surfaces first to users who have the record)
- [ ] **MON-06**: User can subscribe to premium via Stripe (monthly/annual)
- [ ] **MON-07**: User can cancel premium subscription and retains access until end of billing period

### Security

- [x] **SEC-01**: All authentication surfaces comply with OWASP Top 10
- [ ] **SEC-02**: All API endpoints are protected against injection, IDOR, broken access control, and rate limiting abuse
- [ ] **SEC-03**: Security tests are written alongside feature development (not post-launch)
- [ ] **SEC-04**: Formal penetration test conducted before public launch
- [ ] **SEC-05**: Platform registers a DMCA agent and implements notice-and-takedown procedures before P2P feature goes live
- [ ] **SEC-06**: Terms of Service explicitly place copyright responsibility on users for files they share via P2P
- [ ] **SEC-07**: WebRTC TURN relay is configured by default to prevent user IP address exposure during P2P transfers

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
| DISC-03 | Phase 3: Discogs Integration | Pending |
| DISC-04 | Phase 3: Discogs Integration | Pending |
| DISC-05 | Phase 3: Discogs Integration | Pending |
| DISC-06 | Phase 3: Discogs Integration | Pending |
| COLL-01 | Phase 4: Collection Management | Pending |
| COLL-02 | Phase 4: Collection Management | Pending |
| COLL-03 | Phase 4: Collection Management | Pending |
| COLL-04 | Phase 4: Collection Management | Pending |
| COLL-05 | Phase 4: Collection Management | Pending |
| COLL-06 | Phase 4: Collection Management | Pending |
| SOCL-01 | Phase 5: Social Layer | Pending |
| SOCL-02 | Phase 5: Social Layer | Pending |
| SOCL-03 | Phase 5: Social Layer | Pending |
| SOCL-04 | Phase 5: Social Layer | Pending |
| SOCL-05 | Phase 5: Social Layer | Pending |
| DISC2-01 | Phase 6: Discovery + Notifications | Pending |
| DISC2-02 | Phase 6: Discovery + Notifications | Pending |
| DISC2-03 | Phase 6: Discovery + Notifications | Pending |
| DISC2-04 | Phase 6: Discovery + Notifications | Pending |
| NOTF-01 | Phase 6: Discovery + Notifications | Pending |
| NOTF-02 | Phase 6: Discovery + Notifications | Pending |
| NOTF-03 | Phase 6: Discovery + Notifications | Pending |
| NOTF-04 | Phase 6: Discovery + Notifications | Pending |
| COMM-01 | Phase 7: Community + Reviews | Pending |
| COMM-02 | Phase 7: Community + Reviews | Pending |
| COMM-03 | Phase 7: Community + Reviews | Pending |
| COMM-04 | Phase 7: Community + Reviews | Pending |
| COMM-05 | Phase 7: Community + Reviews | Pending |
| REV-01 | Phase 7: Community + Reviews | Pending |
| REV-02 | Phase 7: Community + Reviews | Pending |
| REV-03 | Phase 7: Community + Reviews | Pending |
| GAME-01 | Phase 8: Gamification + Rankings | Pending |
| GAME-02 | Phase 8: Gamification + Rankings | Pending |
| GAME-03 | Phase 8: Gamification + Rankings | Pending |
| GAME-04 | Phase 8: Gamification + Rankings | Pending |
| GAME-05 | Phase 8: Gamification + Rankings | Pending |
| GAME-06 | Phase 8: Gamification + Rankings | Pending |
| P2P-01 | Phase 9: P2P Audio Trading | Pending |
| P2P-02 | Phase 9: P2P Audio Trading | Pending |
| P2P-03 | Phase 9: P2P Audio Trading | Pending |
| P2P-04 | Phase 9: P2P Audio Trading | Pending |
| P2P-05 | Phase 9: P2P Audio Trading | Pending |
| P2P-06 | Phase 9: P2P Audio Trading | Pending |
| P2P-07 | Phase 9: P2P Audio Trading | Pending |
| SEC-05 | Phase 9: P2P Audio Trading | Pending |
| SEC-06 | Phase 9: P2P Audio Trading | Pending |
| SEC-07 | Phase 9: P2P Audio Trading | Pending |
| MON-01 | Phase 10: Monetization | Pending |
| MON-02 | Phase 10: Monetization | Pending |
| MON-03 | Phase 10: Monetization | Pending |
| MON-04 | Phase 10: Monetization | Pending |
| MON-05 | Phase 10: Monetization | Pending |
| MON-06 | Phase 10: Monetization | Pending |
| MON-07 | Phase 10: Monetization | Pending |
| SEC-02 | Phase 11: Security Hardening | Pending |
| SEC-03 | Phase 11: Security Hardening | Pending |
| SEC-04 | Phase 11: Security Hardening | Pending |

**Coverage:**
- v1 requirements: 69 total (corrected from prior count of 57)
- Mapped to phases: 69
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation*
