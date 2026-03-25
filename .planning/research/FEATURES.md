# Feature Research

**Domain:** Vinyl digger social platform (collection management + social discovery + P2P audio sharing + gamification)
**Researched:** 2026-03-25
**Confidence:** MEDIUM-HIGH (strong competitor analysis from Discogs/Last.fm/RYM; gamification patterns well-documented; P2P audio sharing is novel territory with lower confidence)

## Competitive Landscape Context

Before defining features, it is critical to understand what already exists and where the gaps are:

**Discogs** dominates collection/wantlist management and marketplace. It has 15M+ users, the definitive music database, and an OAuth API for third-party integration. But it is cold, transactional, and has zero social layer beyond forums. Wantlists are all-or-nothing public/private. No activity feeds, no taste matching, no community gamification. Users have vocally complained about missing social features for years.

**Last.fm** owns listening analytics and scrobbling. It excels at taste compatibility scoring and recommendation algorithms. But it tracks streaming/playback data, not physical collections. No collection management. Declining relevance as streaming services absorbed its core features.

**RateYourMusic/Sonemic** owns deep cataloging, ratings, and lists. 1.3M users, 147M ratings, 819K user-created lists. Incredible for discovery through community curation. But UI is dated, no collection-management focus, no physical-format awareness, no social matching.

**Waxlog** is the closest competitor in vinyl-specific social features: Discogs sync, collection browsing, weekly challenges, curated lists, follower system. Premium tier. Smaller user base. No P2P sharing. No gamification/ranking system. No wantlist matching.

**Vinylfy** attempted to be "the social network for record collectors" in 2013. Launched with $200, won some startup funding, then appears to have faded. No evidence of active development or meaningful user base post-2014. A cautionary tale about cold-start failure in this exact niche.

**The gap VinylDig fills:** No existing platform combines (1) Discogs-powered collection data with (2) social discovery/matching with (3) gamified rankings with (4) P2P audio file sharing. Each of those exists somewhere, but never together. The combination is the product.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Discogs library import** (collection + wantlist) | This IS the onboarding hook. Collectors already have data in Discogs. Manual entry = dead on arrival. Discogs API supports OAuth + collection/wantlist endpoints. | MEDIUM | Rate limited to 240 req/min authenticated. Large collections (5000+ records) need background job with progress indicator. Paginated at 100 items max per page. Must handle API failures gracefully. |
| **User profiles with collection showcase** | Every social platform and collector app has profiles. Waxlog, Discogs, RYM all do this. Users expect to present their identity. | LOW | Profile = avatar, bio, collection stats, top records, badges. Keep simple at launch. |
| **Search across platform collections** | Core to the value prop ("find who has what you want"). Discogs search is catalog-only, not cross-user. This is table stakes because it is in the tagline. | MEDIUM-HIGH | Requires indexing all imported records. Full-text search + filtering by format, year, genre, condition. Needs to be fast even at scale. |
| **Public wantlist** (with privacy controls) | Discogs forces all-or-nothing public/private wantlists. Users have begged for granular control for years. Any collection platform must have wantlists. | LOW | Default public within platform, with option to hide specific items. This is a direct Discogs pain point to solve. |
| **Activity feed** | Standard social feature. Users expect to see what their network is doing. Waxlog has this. Instagram vinyl communities revolve around sharing activity. | MEDIUM | Feed of: new additions, trades completed, reviews posted, badges earned. Needs thoughtful algorithm -- chronological with highlights, not pure algorithmic ranking (anti-Facebook). |
| **Follow system** | Basic social graph. Waxlog has it. Every social app has it. Without follows, there is no network. | LOW | Asymmetric follow (like Twitter/Instagram), not mutual friendship (like Facebook). Lower friction to build the social graph. |
| **Basic collection stats** | Discogs shows have/want counts. Waxlog shows collection stats. Users expect to see their collection quantified. | LOW | Total records, genres breakdown, decades breakdown, estimated value (from Discogs median prices). |
| **Responsive web design** | Web-first constraint. Gen-Z vinyl collectors (now the driving force per Vinyl Alliance data) expect mobile-quality experiences in browser. | MEDIUM | Must work excellently on mobile browsers. Not just "responsive" but mobile-optimized interaction patterns. |
| **Authentication and account security** | Users importing their Discogs data expect professional-grade security. Discogs itself has had login/security complaints. | MEDIUM | OAuth 2.0 for Discogs integration. Standard auth for platform accounts. MFA option. Session management. |
| **Reviews and ratings** | RYM has 147M ratings. Discogs has none beyond marketplace seller ratings. Collectors want to rate pressings and share opinions. | MEDIUM | Rate individual pressings (not just master releases). Star/numeric rating + optional text review. Pressing-specific is a differentiator vs RYM which rates releases. |

### Differentiators (Competitive Advantage)

Features that set VinylDig apart. The combination of these is the moat.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Automatic wantlist matching** | The killer feature. "Open app, see that someone on the platform has the record you've been hunting." No existing platform does this socially. Discogs matches wantlists to marketplace listings (sellers), not to other collectors' collections. | MEDIUM-HIGH | Cross-reference all user wantlists against all user collections. Notify on match. Must handle scale: N users x M wantlist items x K collection items. Needs efficient indexing strategy (not brute force). Background job that runs on collection changes. |
| **P2P audio file transfer (WebRTC)** | Completely unique. No vinyl social platform offers this. Collectors currently use Discord, Dropbox, or Soulseek. VinylDig makes it native and reputation-backed. Legal "mere conduit" posture. | HIGH | WebRTC DataChannel for browser-to-browser transfer. Signaling server only. Chrome limits ~2GB per transfer, needs chunking at 64KB. Both users must be online simultaneously. File never touches server. Post-transfer review system for quality. Requires STUN/TURN infrastructure. |
| **Rarity scoring system** | Discogs has have/want data but NO official rarity scoring. Users have requested it for years. Third-party tools like VinylRank exist but are disconnected from social context. VinylDig makes rarity a first-class social feature. | MEDIUM | Base: Discogs have/want ratio. Enhanced: factor in marketplace sale frequency, platform collection frequency, pressing details. Display as score (0-100) with tier labels. Note: small sample sizes on obscure releases create noise -- need minimum thresholds. |
| **Gamified ranking system** | Duolingo proves gamification drives 60%+ engagement. Spotify is adding competitive features. No vinyl platform has meaningful gamification. Waxlog has "weekly challenges" but no persistent ranking. | MEDIUM-HIGH | Composite score: rarity of collection + community contribution (trades, reviews, activity). Tiered leagues (a la Duolingo). Weekly resets for active engagement. Badges for milestones. Title system visible on profiles. Must avoid pay-to-win: ranking based on activity and taste, not money spent. |
| **Collection taste compatibility** | Last.fm pioneered this with listening data. Musictaste.space does it for Spotify. Nobody does it for physical vinyl collections. "You and @user are 87% compatible" is inherently shareable and drives social connection. | MEDIUM | Compare genre distributions, artist overlap, era preferences. Generate compatibility percentage. Recommend users with high compatibility. This creates organic social connections beyond just wantlist matching. |
| **Privilege-gated rewards** | Beyond cosmetic badges: higher ranks unlock more P2P trades, exclusive groups, priority wantlist notifications. Duolingo's power-ups model. Creates aspirational loop. | MEDIUM | Ties into gamification. Free users get X trades/month, rank progression unlocks more. Not a paywall -- earned through contribution. Premium can also unlock, creating two paths (earn or pay). |
| **Recommendation engine** | "Diggers who have records like yours also have these." Collaborative filtering based on collection overlap, not listening data. Physical collection data is richer signal than streaming -- collectors are intentional about what they own. | HIGH | Collaborative filtering: users with similar collections -> recommend items in their collection not in yours. Cold start: use genre/artist preferences from Discogs import. This is the hardest feature to get right but highest long-term value for retention. |
| **Collection comparison** | "Compare your collection with any user." See overlap, unique items, compatible taste. Social and competitive. | LOW-MEDIUM | Side-by-side view: shared records, records only you have, records only they have. Stats comparison. Genre Venn diagram. Fun and shareable. |

### Anti-Features (Deliberately NOT Building)

Features that seem appealing but create scope creep, legal risk, or misaligned incentives.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Physical vinyl marketplace / escrow** | Collectors want to buy/sell. Natural extension of "I see you have what I want." | Discogs marketplace has 15M+ users and is deeply entrenched. Competing here is suicide. Marketplace requires payment processing, dispute resolution, shipping logistics, fraud prevention, seller verification. Massive liability and complexity for a solo developer. | Deep-link to Discogs marketplace listings. "Buy this on Discogs" button. Let Discogs handle transactions. |
| **Music streaming / full playback** | Users might want to preview records before trading. Streaming is the obvious adjacent feature. | Licensing is prohibitively expensive and legally complex. Streaming requires content delivery infrastructure. Fundamentally different product. Apple Ping failed partly because it restricted playback to 90-second previews. Samsung Milk Music burned out trying to compete with Spotify. | P2P sharing IS the audio feature. For discovery, link to Spotify/Apple Music/YouTube previews. Embed players, don't host audio. |
| **Server-side file storage / caching** | Faster transfers, offline availability, async sharing (don't need both users online). | Destroys the legal "mere conduit" defense. Platform becomes liable for stored content. Hosting user-uploaded audio files = immediate DMCA exposure. Storage costs scale linearly with user growth. | WebRTC-only is non-negotiable. If both users must be online, that is the tradeoff. Schedule transfer sessions. Consider async as v2+ only if legal counsel approves a specific architecture. |
| **Real-time chat / messaging** | Social platforms have messaging. Users will want to communicate about trades. | Building good chat is extremely complex: presence, delivery guarantees, media attachments, moderation, abuse prevention, encryption. Solo developer cannot maintain this alongside core features. Chat becomes the product (see: every social app eventually). | Structured trade request system with pre-built messages. Link to user's external contact (Discord handle, email). Keep communication lightweight and purpose-driven. |
| **AI-generated reviews / descriptions** | AI could auto-generate record descriptions or review summaries. Trendy feature. | Undermines authenticity that vinyl community values deeply. Collectors are opinionated humans; AI-generated content feels antithetical to the culture. RYM's value is 147M human ratings. | Human-only reviews. AI can assist with tagging/categorization behind the scenes, but never generate user-facing content that pretends to be human opinion. |
| **Label/distributor partnerships** | Revenue opportunity. Labels could promote new releases on the platform. | Changes platform from community-driven to commercially influenced. Vinyl collectors are allergic to marketing disguised as community. Apple Ping's integration of iTunes Store promotion contributed to its failure. | Community-curated "new release" feeds. Users post about new acquisitions organically. No sponsored content. |
| **Native mobile app (v1)** | Better mobile experience. Push notifications. App store presence. | Two codebases for a solo developer. App store review cycles. Platform-specific bugs. PWA can handle most mobile needs. | Progressive Web App with push notifications, offline collection browsing, home screen install. Evaluate native app only after PMF with web. |
| **Blockchain / NFT integration for provenance** | "Prove you own this pressing." Hype-adjacent. | Vinyl collectors largely rejected NFT culture. Blockchain adds complexity without solving a real problem. Discogs data is the de facto provenance system. Alienates core audience. | Trust Discogs import as provenance signal. Community reputation system handles trust. |
| **Subscription-only model (v1)** | Guaranteed revenue per user. Simpler than freemium. | Kills network effects. Community apps need maximum free users to build the social graph. Hard paywalls prevent the "aha moment." Strava's model: free tier builds the social graph that makes premium valuable. | Freemium: core social features free, premium unlocks analytics, unlimited P2P, priority matching. Never gate the social graph. |

---

## Feature Dependencies

```
[Discogs Library Import]
    |
    +---> [User Profile with Collection Showcase]
    |         |
    |         +---> [Follow System]
    |         |         |
    |         |         +---> [Activity Feed]
    |         |         +---> [Collection Taste Compatibility]
    |         |
    |         +---> [Collection Stats]
    |         +---> [Reviews & Ratings]
    |
    +---> [Search Across Collections]
    |         |
    |         +---> [Wantlist Matching] (requires collections indexed + wantlists imported)
    |                   |
    |                   +---> [Notification System] (wantlist match alerts)
    |
    +---> [Rarity Scoring] (requires Discogs have/want data)
              |
              +---> [Gamified Ranking System] (rarity score is input)
                        |
                        +---> [Badges & Titles]
                        +---> [Privilege-Gated Rewards]
                        +---> [Leaderboards / Leagues]

[P2P Audio Transfer] (independent track, requires auth + profiles)
    |
    +---> [Post-Trade Review System]
    |         |
    |         +---> [Sharer Reputation Score]
    |
    +---> [Transfer Session Scheduling] (v1.x -- needed once user base grows)

[Recommendation Engine] (requires sufficient collection data across users)
    |
    +---> [Taste-Based User Discovery]

[Collection Comparison] (requires two users with imported collections)
    +---> [Compatibility Score Display]
```

### Dependency Notes

- **Everything depends on Discogs Import:** It is the foundation. Without imported data, profiles are empty, search returns nothing, wantlist matching has nothing to match, and rarity scores have no basis. This must be rock-solid before any social feature matters.
- **Wantlist Matching requires Search infrastructure:** The matching engine is essentially a specialized search query run against the collection index whenever a collection or wantlist changes.
- **Gamification requires Rarity Scoring:** The ranking system's "collection quality" component depends on rarity scores being calculated. Rarity scoring must come first.
- **P2P Audio is architecturally independent:** WebRTC infrastructure is separate from the social/collection stack. Can be developed in parallel or as a distinct phase. But it requires user profiles and auth to exist.
- **Recommendation Engine needs data density:** Collaborative filtering requires enough users with enough collection overlap to generate meaningful signals. This is a post-traction feature, not a launch feature. Pre-traction: use Discogs genre/artist data for basic "similar collectors" matching.
- **Activity Feed requires Follow System:** No feed without a social graph to populate it.

---

## MVP Definition

### Launch With (v1)

Minimum viable product -- what validates "vinyl diggers want a social home."

- [x] **Discogs library import** (collection + wantlist) -- the onboarding hook and data foundation
- [x] **User profiles with collection showcase** -- identity and public presence
- [x] **Search across platform collections** -- "find who has what you want"
- [x] **Follow system** -- basic social graph
- [x] **Activity feed** -- social proof and engagement loop
- [x] **Basic wantlist matching with notifications** -- the killer feature, even in simple form
- [x] **Rarity scoring** (basic have/want ratio) -- unique value visible immediately on profile
- [x] **Collection comparison** -- fun, shareable, drives social engagement
- [x] **Authentication + security hardening** -- non-negotiable given project constraints

**Rationale:** This MVP validates whether vinyl diggers will adopt a social platform layered on their Discogs data. It answers: "Do people care about seeing who has what they want? Do they want to compare collections? Does rarity scoring drive engagement?" P2P and gamification are withheld to keep scope manageable.

### Add After Validation (v1.x)

Features to add once core social loop is working and users are retained.

- [ ] **P2P audio file transfer** -- add when user base is large enough that matches exist and users request sharing. Trigger: users messaging each other asking "can you rip this for me?"
- [ ] **Post-trade review system + reputation** -- add alongside P2P launch
- [ ] **Gamified ranking system** (leagues, badges, titles) -- add when daily active usage establishes that people care about their rarity scores. Trigger: users screenshotting their rarity scores
- [ ] **Privilege-gated rewards** -- add alongside gamification
- [ ] **Reviews and ratings for pressings** -- add when users have established profiles and social connections. Trigger: organic discussions about pressing quality in the community
- [ ] **Collection taste compatibility** -- add when social graph has enough connections. Trigger: users following 10+ people on average
- [ ] **Premium tier (freemium)** -- add once free users are engaged and the "what would you pay for?" signal is clear. Never gate core social features.

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Recommendation engine** (collaborative filtering) -- needs data density. Pre-PMF: basic "similar collectors" using genre overlap. Post-PMF: full collaborative filtering.
- [ ] **Groups/communities by genre** -- adds moderation burden. Let organic social graph form first. Trigger: users requesting genre-specific spaces.
- [ ] **Collection analytics** (value tracking, trends, investment insights) -- premium feature. Needs Discogs marketplace price data integration.
- [ ] **Transfer session scheduling** -- for P2P when both-online requirement becomes friction. Calendar integration.
- [ ] **Progressive Web App features** (offline, push, home screen) -- after web experience is proven.
- [ ] **Discogs auto-sync** (periodic background sync vs. manual) -- after manual sync is validated as useful.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority | Phase |
|---------|------------|---------------------|----------|-------|
| Discogs library import | HIGH | MEDIUM | P1 | v1 |
| User profiles | HIGH | LOW | P1 | v1 |
| Search across collections | HIGH | MEDIUM-HIGH | P1 | v1 |
| Follow system | HIGH | LOW | P1 | v1 |
| Activity feed | MEDIUM-HIGH | MEDIUM | P1 | v1 |
| Wantlist matching + notifications | HIGH | MEDIUM-HIGH | P1 | v1 |
| Rarity scoring (basic) | HIGH | MEDIUM | P1 | v1 |
| Collection comparison | MEDIUM-HIGH | LOW-MEDIUM | P1 | v1 |
| Auth + security | HIGH (non-negotiable) | MEDIUM | P1 | v1 |
| P2P audio transfer (WebRTC) | HIGH | HIGH | P2 | v1.x |
| Post-trade reviews + reputation | MEDIUM-HIGH | MEDIUM | P2 | v1.x |
| Gamified ranking (leagues/badges) | HIGH | MEDIUM-HIGH | P2 | v1.x |
| Privilege-gated rewards | MEDIUM | MEDIUM | P2 | v1.x |
| Reviews and ratings | MEDIUM | MEDIUM | P2 | v1.x |
| Taste compatibility | MEDIUM-HIGH | MEDIUM | P2 | v1.x |
| Premium/freemium tier | MEDIUM (revenue) | MEDIUM | P2 | v1.x |
| Recommendation engine | HIGH (long-term) | HIGH | P3 | v2+ |
| Groups/communities | MEDIUM | MEDIUM-HIGH | P3 | v2+ |
| Collection analytics | MEDIUM | MEDIUM | P3 | v2+ |
| PWA features | MEDIUM | LOW-MEDIUM | P3 | v2+ |

**Priority key:**
- P1: Must have for launch -- validates core value proposition
- P2: Should have, add once core loop is validated
- P3: Nice to have, future consideration after PMF

---

## Competitor Feature Analysis

| Feature | Discogs | Last.fm | RYM/Sonemic | Waxlog | VinylDig Approach |
|---------|---------|---------|-------------|--------|-------------------|
| Collection management | Excellent (definitive database) | None (streaming only) | Basic cataloging | Good (Discogs sync) | Import from Discogs, don't rebuild the database |
| Wantlist | Yes (marketplace-focused) | None | None | None | Social wantlist with cross-user matching |
| Social graph (follows) | None | Friends + compatibility | None | Follow system | Asymmetric follows with taste compatibility |
| Activity feed | None | Scrobble feed | None | Basic | Rich feed: additions, trades, reviews, badges |
| Music discovery | Search/explore catalog | Algorithmic recommendations | Charts, lists, ratings | Weekly challenges | Wantlist matching + collection-based recs |
| Ratings/reviews | Marketplace seller ratings only | None | 147M ratings (releases) | None | Pressing-specific ratings (more granular than RYM) |
| Rarity/scoring | Have/want data exists, no scoring | None | Aggregate ratings | None | First-class rarity score from Discogs data |
| Gamification | None | None | None | Weekly challenges (light) | Full system: leagues, badges, titles, privileges |
| Audio sharing | None | None | None | None | P2P WebRTC (unique to VinylDig) |
| Taste matching | None | Compatibility % (listening) | Compatibility (ratings) | None | Collection-based compatibility (physical ownership) |
| Collection comparison | None | None | None | None | Side-by-side with overlap/unique analysis |
| Marketplace | Full marketplace | None | None | None | NO marketplace -- link to Discogs instead |
| Mobile | New app (2025) | Web + basic app | Web only | App | Web-first, PWA later |

---

## Discogs Ecosystem Integration Notes

VinylDig is explicitly NOT competing with Discogs. It is building on top of it.

**What Discogs does well (do not replicate):**
- Music database / catalog (6.6M+ releases community-maintained)
- Marketplace (buying/selling with payment and shipping)
- Release-level metadata (credits, tracklists, images, barcodes)
- Community database editing/contribution

**What Discogs does poorly (the opportunity):**
- Social features (zero social graph, no follows, no feeds)
- Wantlist visibility (all-or-nothing public/private, no cross-user matching)
- Collection discovery (search your own collection or the catalog, but not "who else has this?")
- Community engagement (forums exist but feel disconnected from collection data)
- Gamification (none -- no incentive beyond the marketplace)
- Audio sharing (completely absent, users resort to Discord/Soulseek)

**API integration strategy:**
- OAuth 1.0a for user authorization (Discogs uses OAuth 1.0a, not 2.0)
- Collection and wantlist endpoints for import
- Release data for rarity scoring (have/want counts)
- 240 requests/minute authenticated rate limit (must implement queuing and backoff)
- Pagination at 100 items/page max
- Respect Discogs ToS -- do not cache aggressively or scrape beyond API

---

## Freemium Gating Strategy

Based on research into freemium community apps (Strava, Duolingo, Discord):

**Never gate (keep free forever):**
- Profile creation and collection showcase
- Discogs import (manual sync)
- Search across collections
- Follow system and activity feed
- Basic wantlist matching (X matches shown per day/week)
- Basic rarity score
- Collection comparison
- Limited P2P trades per month (e.g., 3/month)

**Gate behind premium:**
- Unlimited P2P trades
- Full wantlist matching (all matches, priority notifications)
- Advanced collection analytics (value trends, rarity trends)
- Automatic Discogs sync (scheduled background sync)
- Exclusive groups/communities
- Advanced stats and insights
- Custom profile themes/badges

**Rationale:** The social graph must be free. Network effects require maximum participation. Premium enhances power users' experience without degrading free users' core experience. Strava model: free builds the graph, premium adds analytics and power features.

---

## Sources

- [Discogs API Documentation](https://www.discogs.com/developers) -- API capabilities, rate limits, OAuth
- [Discogs Collection Features](https://www.discogs.com/about/features/collection/) -- current collection management
- [Discogs Wantlist Features](https://www.discogs.com/about/features/wantlist/) -- wantlist capabilities and Shop My Wants
- [Discogs Forum: Wantlist Privacy](https://www.discogs.com/forum/thread/395883) -- user complaints about all-or-nothing privacy
- [Discogs Forum: Rarity Index Request](https://www.discogs.com/forum/thread/233011) -- community demand for rarity scoring
- [Discogs New App 2025](https://www.discogs.com/about/news/discogs-new-app-launch-2025/) -- latest app updates
- [Vinyl Rank](https://vinylrank.com/) -- third-party rarity scoring tool
- [RateYourMusic Wikipedia](https://en.wikipedia.org/wiki/Rate_Your_Music) -- RYM stats and features
- [Sonemic FAQ](https://rateyourmusic.com/wiki/RYM:Sonemic+FAQ) -- Sonemic/RYM feature details
- [Waxlog](https://www.waxlog.com/) -- competitor features and premium model
- [Last.fm](https://www.last.fm/) -- social music features, scrobbling, compatibility
- [Musictaste.space](https://musictaste.space/) -- taste compatibility implementation
- [Vinylfy / The Vinyl Factory](https://www.thevinylfactory.com/features/vinyl-records-stimulate-most-of-your-senses-qa-with-vinylfy-the-social-network-for-record-collectors) -- failed predecessor in this exact niche
- [Duolingo Gamification Analysis (StriveCloud)](https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo) -- gamification mechanics
- [Duolingo Growth Analysis (Deconstructor of Fun)](https://www.deconstructoroffun.com/blog/2025/4/14/duolingo-how-the-15b-app-uses-gaming-principles-to-supercharge-dau-growth) -- leagues and progression systems
- [Spotify Gamification (Smartico)](https://www.smartico.ai/blog-post/how-spotify-uses-gamification-to-boost-sales) -- music-specific gamification
- [WebRTC DataChannel Guide](https://webrtc.link/en/articles/rtcdatachannel-usage-and-message-size-limits/) -- file transfer limitations
- [WebRTC 2GB+ File Transfer](https://medium.com/@hotrockxonotic/sending-more-than-2gb-with-p2p-webrtc-22032a86b783) -- large file workarounds
- [Apple Ping Failure Analysis](https://appleinsider.com/articles/18/09/01/apples-failed-ping-showed-how-hard-it-is-to-create-a-music-service) -- lessons from failed music social network
- [Why Music Apps Fail (JPLoft)](https://www.jploft.com/blog/why-music-apps-fail) -- common music app pitfalls
- [Cold Start Problem (Andrew Chen)](https://andrewchen.com/how-to-solve-the-cold-start-problem-for-social-products/) -- social product bootstrapping
- [RevenueCat Freemium Guide](https://www.revenuecat.com/docs/playbooks/guides/freemium) -- freemium gating strategies
- [Vinyl Alliance Gen-Z Report](https://www.musicweek.com/labels/read/vinyl-alliance-says-gen-z-is-now-the-driving-force-behind-the-format-s-popularity/091294) -- Gen-Z driving vinyl growth
- [Stereogum: The Discontent at Discogs](https://stereogum.com/2241158/the-discontent-at-discogs/columns/sounding-board) -- Discogs community frustrations

---
*Feature research for: VinylDig -- vinyl digger social platform*
*Researched: 2026-03-25*
