# Project Research Summary

**Project:** VinylDig
**Domain:** Social network for vinyl record collectors with P2P audio file sharing, Discogs integration, gamification, and freemium monetization
**Researched:** 2026-03-25
**Confidence:** MEDIUM-HIGH

## Executive Summary

VinylDig is a social network built on top of Discogs data, targeting the gap between Discogs (transactional, no social layer), Last.fm (streaming analytics, no physical collections), and RateYourMusic (ratings/discovery, no collection management or social matching). The research is clear: this product lives or dies on Discogs integration quality, single-player utility before social features, and disciplined scope management for a solo developer. The recommended approach is a Next.js 15 full-stack application backed by Supabase (PostgreSQL + Auth + Realtime) with Upstash Redis for leaderboards and caching, deployed on Vercel. This stack consolidates backend services into a single BaaS platform, minimizing operational overhead while providing auth, database, and real-time subscriptions out of the box.

The critical insight from cross-referencing all four research files is that the Discogs API rate limit (60 requests/minute per application, not per user) is the single most consequential technical constraint. It forces an architectural decision that must be made before any code is written: use monthly Discogs XML data dumps as the primary catalog/metadata source, and reserve live API calls exclusively for user-specific data (OAuth-authenticated collection and wantlist fetches). This decision cascades through every layer -- it determines the data pipeline architecture, cold-start mitigation strategy, rarity scoring approach, and import UX. Getting this wrong means rewriting the entire data layer later.

The biggest risks are threefold. First, the cold-start problem: the product's core value proposition (wantlist matching, social discovery) requires other users, but the only way to attract users is with standalone utility (collection analytics, rarity scores, shareable profile pages). The Discogs data dump strategy directly addresses this by pre-populating the platform with release data so searches return results and rarity scores work even with zero other users. Second, P2P audio sharing carries significant legal risk -- the "mere conduit" defense is necessary but not sufficient, and DMCA agent registration plus legal counsel are non-negotiable prerequisites before launching the P2P feature. P2P should be a v1.x feature, not MVP. Third, WebRTC connectivity fails silently for 15-30% of users without TURN relay infrastructure, and IP address leaks in WebRTC are a real privacy threat. These P2P concerns reinforce the decision to defer P2P to post-MVP.

## Key Findings

### Recommended Stack

The stack is optimized for solo-developer productivity and zero-cost runway. Supabase consolidates auth, database, real-time subscriptions, and edge functions into one platform with a generous free tier (500MB DB, 50K MAU auth, 1GB storage). Drizzle ORM over Prisma for serverless performance (7KB bundle, sub-500ms cold starts vs Prisma's 1-3s). Next.js 15 (not 16 -- ecosystem support for 16 is still immature) with App Router provides server-first rendering and Server Actions that reduce client-side JavaScript.

**Core technologies:**
- **Next.js 15 + React 18 + TypeScript:** Full-stack framework with server-first rendering. TypeScript is non-negotiable for a solo developer -- catches bugs at compile time and self-documents the codebase.
- **Supabase (PostgreSQL + Auth + Realtime):** Consolidates database, authentication, and real-time subscriptions. Row Level Security provides database-level authorization. Free tier supports MVP through early growth.
- **Drizzle ORM:** SQL-like syntax, 7KB bundle, zero dependencies. Critical for serverless/edge where Next.js API routes run. Generates TypeScript types from schema for end-to-end type safety.
- **Upstash Redis:** Serverless Redis for leaderboard sorted sets, caching, and rate limiting. Free tier: 500K commands/month.
- **Tailwind CSS 4 + shadcn/ui:** Tailwind v4 with 5x faster builds. shadcn/ui provides 40+ production-ready components copied into the project (not a dependency), fully customizable for the retro/analog aesthetic.
- **Socket.IO + simple-peer (for WebRTC):** Socket.IO handles signaling on the existing server (namespace separation, auto-reconnection, long-polling fallback). simple-peer provides a minimal WebRTC abstraction (~25KB) for the actual P2P data channel. See Conflict Resolution below for why this is recommended over PeerJS.
- **Stripe:** Industry-standard subscription billing. Vercel provides an official Next.js + Supabase + Stripe starter template.
- **Resend:** Transactional email with 3,000/month free tier and React Email templates.

**Conflict Resolution -- Socket.IO + simple-peer vs PeerJS:**
The Stack researcher recommended PeerJS for its built-in signaling server and developer convenience. The Architecture researcher recommended Socket.IO + simple-peer, arguing that PeerJS bundles a redundant signaling server (PeerServer) when the application already needs Socket.IO for real-time notifications and other WebSocket functionality. The Architecture researcher's argument is stronger: running two WebSocket systems (Socket.IO for notifications + PeerJS's signaling) adds unnecessary infrastructure and complexity. With Socket.IO already in the stack for Supabase Realtime augmentation and notifications, adding signaling as a Socket.IO namespace is approximately 50 lines of server code. simple-peer then handles the RTCPeerConnection/DataChannel work. This approach has one signaling system, not two, and simple-peer has ~400K weekly npm downloads vs PeerJS's ~34K. The trade-off: PeerJS provides a slightly simpler "getting started" experience, but the Architecture researcher correctly identified that it creates architectural debt for a project that will already have Socket.IO running.

**Important correction on Supabase Realtime vs Socket.IO:** Supabase Realtime provides WebSocket subscriptions for database change notifications (LISTEN/NOTIFY). It is sufficient for wantlist match notifications and activity feed updates. Socket.IO is needed specifically for WebRTC signaling (trade session room management, SDP/ICE relay), which is a different protocol concern that Supabase Realtime does not handle. In the MVP (no P2P), Supabase Realtime alone may suffice. Socket.IO is added when the P2P feature is built.

### Expected Features

**Must have (table stakes) -- MVP:**
- Discogs library import (collection + wantlist) -- the onboarding hook; without this, the product is dead on arrival
- User profiles with collection showcase -- identity and public presence
- Search across all user collections -- "find who has what you want"
- Follow system -- basic social graph (asymmetric, like Twitter)
- Activity feed -- social proof and engagement loop
- Basic wantlist matching with notifications -- the killer feature, even in simple form
- Rarity scoring (basic have/want ratio from Discogs data) -- unique visible value on profiles
- Collection comparison -- shareable, drives social engagement
- Authentication and security hardening -- non-negotiable

**Should have (competitive advantage) -- v1.x post-validation:**
- P2P audio file transfer (WebRTC) -- completely unique to VinylDig; deferred from MVP due to legal preparation requirements and technical complexity
- Post-trade review system + sharer reputation -- must launch alongside P2P
- Gamified ranking system (leagues, badges, titles) -- Duolingo-inspired retention mechanic; requires rarity scores and trade data to exist first
- Privilege-gated rewards -- higher ranks unlock more P2P trades, exclusive groups
- Reviews and ratings for pressings -- pressing-specific ratings are more granular than RYM
- Collection taste compatibility -- "you and @user are 87% compatible"
- Premium tier (freemium gating via Stripe) -- never gate core social features

**Defer (v2+):**
- Recommendation engine (collaborative filtering) -- needs data density that only exists post-traction
- Groups/communities by genre -- adds moderation burden; let organic social graph form first
- Collection analytics (value tracking, investment insights) -- premium feature
- Progressive Web App features (offline, push, home screen)
- Discogs auto-sync (scheduled background sync)

**Anti-features (deliberately not building):**
- Physical vinyl marketplace/escrow -- Discogs owns this; competing is suicide
- Music streaming -- fundamentally different product with prohibitive licensing
- Server-side file storage/caching -- destroys "mere conduit" defense
- Real-time chat/messaging -- impossibly complex for a solo dev; use structured trade requests instead
- AI-generated reviews -- undermines the authenticity the vinyl community values
- Native mobile app (v1) -- web-first; PWA later

### Architecture Approach

The architecture is a modular monolith deployed on Vercel (Next.js) with Supabase as the primary backend. The Architecture researcher proposed a separated Node.js + Express/Fastify backend with BullMQ job queues, but this conflicts with the Stack recommendation of Next.js full-stack with Supabase. The resolution: use Next.js App Router for the primary application (Server Components, Server Actions, API Routes), Supabase for database/auth/realtime, and Supabase Edge Functions (or pg_cron) for background jobs (Discogs imports, wantlist matching, rank recalculation) instead of BullMQ. This avoids running a separate Node.js server process, which is the right trade-off for a solo developer on Vercel. If background job complexity exceeds what Edge Functions can handle, a small worker process on Railway ($5/month) is the escape hatch.

**Major components:**
1. **Next.js App (Vercel)** -- Server Components for data-heavy pages, Server Actions for mutations, API Routes for webhook endpoints (Stripe, Discogs OAuth callback). Client Components for interactive features (WebRTC, search, real-time updates).
2. **Supabase (PostgreSQL + Auth + Realtime)** -- Primary data store with Row Level Security. Auth with OAuth 1.0a for Discogs integration. Realtime subscriptions for wantlist match notifications and activity feed updates.
3. **Upstash Redis** -- Leaderboard sorted sets (ZINCRBY/ZREVRANK), Discogs API rate limiting, hot data caching, session management.
4. **Discogs Data Pipeline** -- Monthly XML data dump import for catalog metadata (releases, have/want counts for rarity scoring). Live API reserved for user-specific collection/wantlist fetches via queued background jobs.
5. **WebRTC P2P Layer (v1.x)** -- Socket.IO signaling on a lightweight server (Railway or similar), simple-peer for browser-side DataChannel file transfer, managed TURN service (Metered.ca or Twilio) for NAT traversal. Added post-MVP.
6. **Stripe Integration** -- Subscription billing with webhook-driven state sync to Supabase. Freemium gating via middleware.

**Key architectural patterns:**
- Queue-driven Discogs imports with progress streaming (never synchronous API calls)
- Fan-out-on-read activity feed (simpler than fan-out-on-write, scales to ~100K users)
- Redis sorted sets for rankings with incremental updates + nightly full recalc
- Feature gating at workflow start, not mid-action
- Discogs data dumps as primary data source; live API only for user-specific data

### Critical Pitfalls

1. **Discogs API rate limit destruction** -- The 60 req/min limit is per-application, NOT per-user. Even 2-3 simultaneous imports can exhaust the budget. Prevention: use monthly XML data dumps as primary catalog source. Reserve live API for user-specific collection/wantlist fetches only. Queue imports with progress indicators. Target 40-45 req/min to avoid triggering Discogs's moving-average ban detection.

2. **Cold-start death** -- Empty feeds, zero wantlist matches, ghost-town feel kills new users instantly. Prevention: pre-populate platform with Discogs data dump release data so searches always return results. Build genuine single-player utility (rarity scores, collection analytics, shareable profile pages) that works with zero other users. Target hyper-local community launch (one vinyl community at a time) rather than broad launch.

3. **Copyright/DMCA exposure** -- "Mere conduit" is not a magic shield. The platform explicitly facilitates sharing copyrighted audio. Prevention: retain a copyright attorney before writing P2P code. Register DMCA agent with US Copyright Office. Implement notice-and-takedown and repeat infringer policy. Marketing language must never frame the platform as a way to "share music" or "get free records." This is why P2P is deferred to v1.x.

4. **WebRTC IP address leaks** -- WebRTC inherently exposes real IP addresses to peers. Malicious users can harvest IPs for DDoS, geolocation, or doxxing. Prevention: force TURN relay by default (hides IPs behind TURN server). Opt-in to direct P2P with clear warnings. Sanitize SDP offers server-side to strip local IP candidates.

5. **Gamification that rewards the wrong behaviors** -- Ranking by collection rarity alone rewards hoarders, not community contributors. Permanent global leaderboards demotivate 95% of users. Prevention: weight community contribution (trades, reviews, activity) at 40%+ of total score. Use time-windowed and genre-scoped leaderboards, not just global all-time. Implement anti-gaming detection for sham trades and low-effort reviews.

## Implications for Roadmap

Based on dependency analysis across all research files, the following phase structure is recommended. This differs from the Architecture researcher's 7-phase suggestion by consolidating around the Next.js/Supabase stack (eliminating separate backend setup phases) and correctly deferring P2P to post-MVP per Features research.

### Phase 1: Foundation + Data Pipeline
**Rationale:** Everything depends on auth, database schema, and the Discogs data pipeline. The data dump import is architectural -- it determines how all downstream features (search, rarity, matching) access data. Must be designed before any feature code.
**Delivers:** User authentication (Supabase Auth), database schema (Drizzle + Supabase PostgreSQL), Discogs monthly data dump import pipeline, basic project scaffolding with retro/analog design system (Tailwind v4 + shadcn/ui).
**Addresses features:** Authentication + security foundation, Discogs release data as platform foundation.
**Avoids pitfalls:** Discogs API rate limit destruction (data dumps as primary source from day one), cold-start death (pre-populated release data).

### Phase 2: Discogs Integration + Collection Management
**Rationale:** The product's onboarding hook. Without reliable Discogs import, profiles are empty, search returns nothing, and the platform has no data to work with. This is the "come for the tool" part of the cold-start strategy.
**Delivers:** Discogs OAuth 1.0a flow, queued collection/wantlist import with progress indicator, user profiles with collection showcase, basic collection stats, rarity scoring (have/want ratio from data dumps).
**Addresses features:** Discogs library import, user profiles with collection showcase, basic collection stats, rarity scoring.
**Avoids pitfalls:** Rate limit destruction (queued imports at 40 req/min with progress UX), cold-start (single-player utility: rarity scores and collection showcase work with zero other users).

### Phase 3: Social Layer + Discovery
**Rationale:** Once collections exist in the platform, make them discoverable. The social layer creates the network that makes matching and P2P valuable later. This is the "stay for the network" part.
**Delivers:** Follow system, activity feed (fan-out-on-read), search across all user collections, collection comparison, public wantlist with privacy controls.
**Addresses features:** Follow system, activity feed, search across collections, collection comparison, public wantlist.
**Avoids pitfalls:** Cold-start (search returns results against data dump even with few users; activity feed shows own imports initially).

### Phase 4: Wantlist Matching + Notifications
**Rationale:** This is the "magic moment" -- "someone on the platform has the record you've been hunting." Depends on Phase 2 (wantlists imported) and Phase 3 (social graph and profiles exist). This feature is what drives return visits and retention.
**Delivers:** Wantlist matching engine (background job triggered on collection changes), notification system (Supabase Realtime for in-app, Resend for email), match display UI.
**Addresses features:** Automatic wantlist matching, notification system.
**Avoids pitfalls:** Cold-start (even before matches exist, show "X Discogs users globally have this pressing" as proxy).

### Phase 5: Gamification + Rankings
**Rationale:** Gamification is a retention layer that amplifies existing behaviors. It must come after the behaviors exist (collections imported, social connections formed). Requires rarity scoring data from Phase 2 and contribution tracking from Phases 3-4.
**Delivers:** Redis leaderboards (Upstash sorted sets), composite ranking formula (rarity 60% + contribution 40%), badges/achievements system, time-windowed and genre-scoped leaderboards, ranking display on profiles.
**Addresses features:** Gamified ranking system, badges and titles, leaderboards/leagues.
**Avoids pitfalls:** Wrong-incentive gamification (contribution-weighted scoring, contextual leaderboards, anti-gaming measures designed in from start).

### Phase 6: P2P Audio File Transfer
**Rationale:** The most technically complex and legally sensitive feature. Deferred from MVP because (a) it requires legal preparation (DMCA agent registration, attorney review), (b) it requires the social layer to create the "who has what I want" discovery that drives trades, and (c) the WebRTC infrastructure is architecturally independent and can be developed as a distinct vertical. Launch only after legal counsel clears the architecture.
**Delivers:** Socket.IO signaling server, simple-peer WebRTC DataChannel integration, chunked file transfer with progress/resume, STUN/TURN configuration (managed service), trade flow (initiate, accept, transfer, review), post-trade quality reviews, sharer reputation system, TURN-by-default for IP privacy.
**Addresses features:** P2P audio file transfer, post-trade reviews, sharer reputation.
**Avoids pitfalls:** WebRTC connection failures (TURN from day one), IP address leaks (TURN-by-default), copyright/DMCA (legal prep completed before code), large file/Safari failures (chunking with checksum + resume + cross-browser testing).
**Pre-requisites:** DMCA agent registered, copyright attorney retained, ToS reviewed, repeat infringer policy published.

### Phase 7: Monetization + Hardening
**Rationale:** Freemium gating requires all gated features to exist. Stripe integration and paywall placement should be informed by user behavior data collected in Phases 1-6. Security hardening is a pass over the complete system.
**Delivers:** Stripe subscription integration, freemium gating middleware, premium tier features (unlimited P2P, analytics, priority matching), OWASP Top 10 security audit, penetration testing, rate limiting on all endpoints.
**Addresses features:** Premium tier (freemium), security hardening.
**Avoids pitfalls:** Paywall that kills the core loop (gate at workflow start, never gate the social graph, measure "aha moment" before placing paywall), freemium conversion below 1%.

### Phase Ordering Rationale

- **Data dumps before API integration:** The Architecture and Pitfalls research both independently identified Discogs API rate limits as the dominant technical constraint. By making data dumps the primary data source in Phase 1, all downstream phases (search, rarity, matching) query local data instead of hitting the API.
- **Social before P2P:** Features research is clear that P2P is v1.x, not MVP. The social layer (Phases 3-4) creates the discovery mechanism ("who has what I want") that gives P2P a reason to exist. Launching P2P without social discovery means users have no one to trade with.
- **Gamification before monetization:** Gamification creates the engagement patterns that premium should enhance, not replace. If premium unlocks "more trades" and "priority matching," those features must be experienced in their free-tier form first.
- **Legal prep woven through Phases 5-6:** DMCA agent registration, attorney engagement, and ToS review should begin during Phase 5 development so everything is in place before Phase 6 P2P code ships.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1 (Data Pipeline):** Discogs XML data dump processing is multi-gigabyte. Streaming XML parser selection, incremental diff strategy, and PostgreSQL bulk insert optimization need investigation. The dumps are CC0-licensed but processing them on modest hardware needs benchmarking.
- **Phase 6 (P2P):** WebRTC file transfer with chunking, resume, backpressure, and cross-browser compatibility (especially Safari/iOS) is novel territory. Socket.IO signaling architecture and TURN credential rotation need detailed design. Cross-browser testing infrastructure must be established.
- **Phase 6 (Legal):** Copyright/DMCA compliance is not a code problem -- it requires legal counsel. The "mere conduit" defense needs professional validation for VinylDig's specific architecture.

Phases with standard patterns (skip deep research):
- **Phase 2 (Discogs Integration):** OAuth 1.0a flow and paginated API fetching are well-documented. @lionralfs/discogs-client handles the heavy lifting.
- **Phase 3 (Social Layer):** Follow systems, activity feeds (fan-out-on-read), and collection search are textbook patterns with extensive documentation.
- **Phase 5 (Gamification):** Redis sorted sets for leaderboards and badge systems are well-documented. The design challenge is formula tuning, not technical novelty.
- **Phase 7 (Monetization):** Stripe + Next.js + Supabase has an official Vercel starter template. Freemium gating is middleware-level logic.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core stack (Next.js, Supabase, Drizzle, Tailwind) verified against official docs and established patterns. The WebRTC library choice (simple-peer vs PeerJS) is MEDIUM confidence but the trade-off is well-reasoned. |
| Features | MEDIUM-HIGH | Table stakes and differentiators backed by strong competitor analysis (Discogs, Last.fm, RYM, Waxlog). P2P audio sharing is novel territory with lower confidence on user demand and legal viability. |
| Architecture | HIGH (core), MEDIUM (P2P) | Core patterns (queue-driven import, fan-out-on-read, Redis sorted sets) are battle-tested. The Architecture researcher's monorepo/BullMQ proposal conflicts with the Supabase/Vercel stack but the patterns translate. P2P signaling architecture is sound but untested at this specific application scale. |
| Pitfalls | HIGH | Cross-referenced across multiple authoritative sources. The Discogs rate limit, cold-start, and DMCA pitfalls are well-documented. WebRTC failure modes backed by WebRTC.ventures, MDN, and practitioner reports. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Discogs data dump processing benchmarks:** No research quantified how long it takes to process multi-GB XML dumps on Vercel/Supabase infrastructure. This needs benchmarking in Phase 1 -- may require a separate worker process on Railway.
- **Supabase Edge Functions for background jobs:** The Architecture researcher proposed BullMQ (which requires a Node.js server). Supabase Edge Functions + pg_cron are the Supabase-native equivalent, but their reliability for long-running import jobs (potentially thousands of API calls) needs validation. Escape hatch: Railway worker.
- **Safari/iOS WebRTC DataChannel reliability in 2026:** The Pitfalls research flags historical Safari issues. Current (2026) Safari support needs hands-on testing before committing to the P2P architecture.
- **Discogs OAuth 1.0a (not 2.0):** The Features research mistakenly references OAuth 2.0 in one place. Discogs uses OAuth 1.0a, which is more complex. The @lionralfs/discogs-client handles this but it is a notable integration detail.
- **TURN cost modeling:** At scale, TURN relay costs depend on how many connections fail STUN (15-30%) and file sizes (100-500MB FLAC). No cost model was produced. Need to model: if 20% of transfers relay through TURN at 300MB average, what does this cost at 100/1K/10K monthly transfers?
- **Legal counsel engagement timeline:** Research identifies legal prep as non-negotiable before P2P launch but does not estimate timeline. DMCA agent registration takes 1-2 weeks; attorney engagement should begin 2-3 months before planned P2P launch.

## Sources

### Primary (HIGH confidence)
- [Next.js 15 App Router Documentation](https://nextjs.org/docs/app/getting-started) -- framework capabilities, Server Components, Server Actions
- [Supabase Documentation](https://supabase.com/docs) -- Auth, Realtime, Edge Functions, Row Level Security
- [Discogs API Documentation](https://www.discogs.com/developers) -- API capabilities, rate limits, OAuth 1.0a, pagination
- [Discogs Data Dumps](https://data.discogs.com/) -- CC0 monthly XML exports
- [Drizzle ORM Documentation](https://orm.drizzle.team/) -- schema definitions, migration tooling, serverless compatibility
- [Stripe Subscription Docs](https://docs.stripe.com/billing/subscriptions/build-subscriptions) -- billing integration patterns
- [DMCA Safe Harbor Provisions](https://www.congress.gov/crs-product/IF11478) -- Section 512(a) "mere conduit" requirements
- [U.S. Copyright Office Section 512](https://www.copyright.gov/512/) -- DMCA agent registration requirements
- [MDN WebRTC Protocols](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols) -- STUN/TURN/ICE specification
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/) -- security coverage requirements

### Secondary (MEDIUM confidence)
- [Andrew Chen: Cold Start Problem](https://andrewchen.com/how-to-solve-the-cold-start-problem-for-social-products/) -- social product bootstrapping strategies
- [PkgPulse: simple-peer vs PeerJS 2026](https://www.pkgpulse.com/blog/simple-peer-vs-peerjs-vs-mediasoup-webrtc-libraries-nodejs-2026) -- WebRTC library comparison
- [Redis Leaderboards Solution](https://redis.io/solutions/leaderboards/) -- sorted set patterns for rankings
- [Discogs Forum: API Rate Limits](https://www.discogs.com/forum/thread/1104957) -- per-application rate limit confirmation
- [WebRTC.ventures: Security 2025](https://webrtc.ventures/2025/07/webrtc-security-in-2025-protocols-vulnerabilities-and-best-practices/) -- IP leak prevention strategies
- [VideoSDK: WebRTC Safari 2025](https://www.videosdk.live/developer-hub/webrtc/webrtc-safari) -- Safari DataChannel compatibility status
- [StriveCloud: Duolingo Gamification Analysis](https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo) -- gamification mechanics
- [First Page Sage: Freemium Conversion Rates 2026](https://firstpagesage.com/seo-blog/saas-freemium-conversion-rates/) -- 2-5% industry benchmarks

### Tertiary (LOW confidence -- needs validation)
- [Vinylfy / The Vinyl Factory](https://www.thevinylfactory.com/features/vinyl-records-stimulate-most-of-your-senses-qa-with-vinylfy-the-social-network-for-record-collectors) -- failed predecessor; limited information on why it failed beyond cold-start issues
- TURN cost projections at scale -- based on Metered.ca/Twilio published rates but no real-world VinylDig usage data exists
- Safari/iOS WebRTC DataChannel reliability in 2026 -- improving but needs hands-on validation

---
*Research completed: 2026-03-25*
*Ready for roadmap: yes*
