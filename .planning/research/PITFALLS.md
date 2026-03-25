# Pitfalls Research

**Domain:** Social network for vinyl diggers with P2P audio file sharing, Discogs integration, gamification
**Researched:** 2026-03-25
**Confidence:** HIGH (multiple authoritative sources cross-referenced across all domains)

---

## Critical Pitfalls

### Pitfall 1: WebRTC P2P Connections Fail Silently for 15-30% of Users

**What goes wrong:**
WebRTC peer-to-peer connections require NAT traversal via STUN/TURN servers. Approximately 15-30% of internet users sit behind symmetric NATs, Carrier-Grade NAT (CGNAT), or corporate firewalls that prevent direct P2P connections entirely. STUN works with Full Cone, Address-Restricted, and Port-Restricted NATs, but fails with symmetric NATs where a different external port is assigned per destination. Without a TURN relay fallback, these users simply cannot transfer files -- and the failure is often silent (connection hangs indefinitely rather than erroring cleanly).

On mobile networks, CGNAT is nearly universal. Corporate and university networks often block UDP entirely. The connection appears to "try" but never completes, with no user-facing error.

**Why it happens:**
Developers test on their own networks (usually residential broadband with permissive NAT). Works fine locally, demo looks great, but real-world deployment hits the 15-30% failure wall. Many tutorials and examples skip TURN configuration because STUN is simpler and free.

**How to avoid:**
- Deploy TURN servers from day one -- not as a "later" optimization. Budget for TURN relay bandwidth at $0.05-$0.15 per GB.
- Use the ICE framework correctly: STUN for discovery, TURN as mandatory fallback, with ICE candidates gathered in order of preference (host > srflx > relay).
- Implement connection quality monitoring: track ICE candidate types used, connection establishment time, and relay percentage across the user base.
- Use a managed TURN service (Twilio NTS, Cloudflare TURN, or Metered TURN) rather than self-hosting initially. Self-hosted coturn is fine but adds operational burden for a solo developer.
- Budget assumption: if 20% of connections relay through TURN and a typical vinyl rip is 100-300MB (FLAC), each relayed transfer costs $0.005-$0.045 in bandwidth. At scale this matters.

**Warning signs:**
- File transfer success rate below 80% in production.
- Disproportionate failure reports from mobile users, users in Asia/Africa (higher CGNAT prevalence), or corporate/university networks.
- ICE connection state stuck in "checking" for extended periods.
- Users reporting "it just hangs" without error messages.

**Phase to address:**
Phase 1 (Foundation/Infrastructure). TURN must be part of the initial WebRTC architecture. Retrofitting is painful because it changes the entire connection flow.

---

### Pitfall 2: Discogs API Rate Limits Destroy the Import Experience

**What goes wrong:**
Discogs API allows 60 authenticated requests per minute (25 unauthenticated), tracked via a moving-average 60-second window. A serious collector with 2,000+ records in their collection needs 20+ paginated requests just to fetch their collection, plus additional requests per release for detailed metadata. A single user's initial import can consume 30-60 seconds of rate limit budget. If even 2-3 users import simultaneously, the entire app's API access is throttled or blocked. Large collections (5,000+ items, not unusual for serious diggers) become impossible to import in one session.

Worse: Discogs explicitly prohibits circumventing rate limits (e.g., multiple API keys), and violation risks permanent API access revocation.

**Why it happens:**
Developers design the import flow for their own modest test collection (50-100 records) and it works fine. They don't test with real-world power users who have thousands of records. The 60/min limit seems generous until you realize it is shared across ALL users of your application hitting from the same server.

**How to avoid:**
- Use the Discogs monthly data dumps (XML format, CC0 licensed) for the catalog/metadata layer. Import the full release database into your own PostgreSQL instance. This eliminates API calls for release metadata entirely.
- Reserve API calls exclusively for user-specific data: collection lists, wantlists, and OAuth-authenticated profile data.
- Implement a background job queue for collection imports. User clicks "import," gets a progress indicator, and the system processes at a respectful pace (40 requests/min to leave headroom). Notify via email/in-app when complete.
- Cache aggressively. Once a release's metadata is fetched, cache it locally for 30+ days. Have/want ratios for rarity scoring can be batch-updated weekly from the data dumps.
- Implement per-user rate tracking. Show users "Importing... 847 of 2,341 records" with realistic time estimates.
- Never hit the rate limit ceiling. Target 40-45 requests/min to avoid triggering Discogs' moving-average detection, which can result in temporary bans.

**Warning signs:**
- HTTP 429 (Too Many Requests) responses from Discogs API.
- `X-Discogs-Ratelimit-Remaining` header consistently hitting 0.
- User complaints about imports "taking forever" or failing.
- Emails from Discogs about API abuse.

**Phase to address:**
Phase 1 (Data Architecture). The Discogs data dump strategy must be designed into the data layer from the start. Building against the live API first and "optimizing later" means rewriting the entire data pipeline.

---

### Pitfall 3: Social Network Cold Start Death -- Empty Feed, No Matches, Ghost Town

**What goes wrong:**
A new user imports their Discogs collection (the hook works), but then sees: zero wantlist matches, an empty activity feed, no communities with activity, and rankings where they are alone. The core value proposition ("find who has the record you're hunting") requires other users to already be on the platform. Without critical mass, the social features feel broken rather than "new." Users leave within the first session and never return.

Research from Andrew Chen's cold start analysis shows the key metric is not total users but connection density. 100,000 users with 2 connections each is worse than 1,000 users with 30 connections each.

**Why it happens:**
The product's value depends on network effects, but network effects require existing users. Classic chicken-and-egg. Teams often launch broadly ("post it on Reddit!") which generates dispersed signups with no local density -- everyone joins, sees nobody they know or care about, and churns.

**How to avoid:**
- **"Come for the tool, stay for the network" strategy.** The single-player mode must be genuinely useful without other users. For VinylDig this means: collection analytics (rarity scores, collection value tracking, pressing quality data from Discogs data dumps), personal collection showcase pages (shareable externally), and wantlist management -- all functional with zero other users.
- **Seed with Discogs data dumps.** Pre-populate the platform with release data so searches always return results (even if no user "has" it yet). Show "X people on Discogs have this" as a proxy until platform density catches up.
- **Hyper-local community targeting.** Launch in 1-2 specific vinyl communities first (a particular record fair community, a specific genre subreddit, a Discord server). Saturate one niche before expanding. Dense small networks beat sparse large ones.
- **Wantlist matching against Discogs data.** Even before users join, you can show "Based on Discogs data, approximately 47 people globally have this pressing." This creates anticipation rather than disappointment.
- **Invite mechanics.** When a wantlist match is detected against a Discogs user who is NOT on the platform yet, show the current user "Someone on Discogs has this -- invite them to VinylDig to connect."

**Warning signs:**
- Day-1 retention below 20% (users who return the next day after signup).
- Average session length under 2 minutes after initial import.
- Zero wantlist matches for most new users.
- Activity feed is empty or only shows the user's own imports.

**Phase to address:**
Phase 1-2. Single-player utility must be rock-solid before social features launch. The Discogs data dump integration is both a data architecture decision AND the cold start mitigation -- they are the same work.

---

### Pitfall 4: Copyright and DMCA Exposure -- "Mere Conduit" Is Not a Magic Shield

**What goes wrong:**
The platform enables sharing audio rips of copyrighted vinyl records. While the "mere conduit" legal posture (no files on servers, WebRTC only, users responsible) has legal precedent, it is NOT bulletproof. Key risks:

1. **Ripping vinyl for personal backup is legally gray in the US.** The RIAA has stated they consider it technically illegal but have chosen not to pursue it. Sharing rips with others is unambiguously copyright infringement under US law. The platform is facilitating this.
2. **DMCA Section 512(a) "mere conduit" safe harbor requires specific conditions**: the transmission must be initiated by someone other than the provider, the transmission/routing/connections must be carried out by an automatic technical process, the provider must not select the recipients, and no copy may be maintained on the provider's system. The signaling server that connects peers could be argued as "selecting recipients."
3. **Knowledge destroys safe harbor.** If the platform has "actual knowledge" or "red flag knowledge" of specific infringement and does not act, safe harbor evaporates. A platform explicitly designed around sharing copyrighted audio has an inherent knowledge problem.
4. **The "repeat infringer" requirement.** All DMCA safe harbor categories require the platform to adopt and reasonably implement a policy to terminate repeat infringers. You must actually enforce this.
5. **International exposure.** The EU's Copyright Directive (Article 17) imposes stricter obligations than US DMCA. Users outside the US face different legal regimes.

**Why it happens:**
Developers focus on technical architecture ("files never touch our servers") and assume the legal posture follows automatically. But legal liability is fact-specific and depends on implementation details, marketing language, and how the platform presents itself.

**How to avoid:**
- **Retain a copyright/internet law attorney before launch.** Not optional. The legal structure needs professional review, not developer legal reasoning.
- **DMCA agent registration.** Register a designated DMCA agent with the US Copyright Office. Display agent contact information publicly. This is a hard requirement for safe harbor.
- **Notice-and-takedown implementation.** Even though files are not stored, implement a system to receive DMCA notices, disable specific user-to-user connections, and document compliance. Respond expeditiously.
- **Repeat infringer policy.** Define, publish, and enforce a repeat infringer termination policy. Track DMCA notices per user. Terminate accounts that accumulate strikes.
- **Terms of service language.** Explicitly state that users are responsible for ensuring they have the right to share files. Prohibit sharing of copyrighted material without authorization. This does not eliminate liability but supports the safe harbor posture.
- **Marketing language discipline.** Never market the platform as a way to "share music" or "get free records." Frame it as a collector community tool. The way you describe the product in marketing materials becomes legal evidence.
- **Consider limiting P2P to verified scenarios.** Allow sharing of out-of-print recordings, personal recordings, public domain material. This is harder to enforce but demonstrates good faith.
- **Metadata logging without content.** Log that User A connected to User B at timestamp T, without logging what was transferred. This supports compliance without creating a content surveillance infrastructure.

**Warning signs:**
- Receiving DMCA takedown notices (even one matters -- it means rights holders are watching).
- Platform being discussed on music industry forums/blogs as a piracy tool.
- Marketing materials or user-facing copy that implies copyright infringement is the intended use.
- No DMCA agent registered, no takedown procedure documented.

**Phase to address:**
Pre-launch (legal preparation) and Phase 1 (core infrastructure must include DMCA compliance mechanisms). Legal review should happen before any code is written for the P2P feature.

---

### Pitfall 5: WebRTC IP Address Leaks Expose Users to Harassment and Targeting

**What goes wrong:**
WebRTC inherently requires IP address discovery and exchange between peers. When User A initiates a file transfer with User B, both users' real IP addresses are exposed through the ICE candidate exchange. This means:

1. Any user can discover another user's real IP address simply by initiating a trade.
2. Users behind VPNs may have their real IP leaked through WebRTC's STUN requests (a well-documented class of vulnerability).
3. Malicious users can use harvested IPs for DDoS attacks, geolocation, or doxxing.
4. In a platform dealing with rare/valuable records, motivated bad actors have financial incentive to target specific users.

Additionally, the signaling server (which handles WebRTC session negotiation) becomes a high-value target. If compromised, an attacker can intercept or manipulate all connection negotiations across the platform.

**Why it happens:**
WebRTC was designed for real-time communication where IP exchange is a feature, not a bug. File sharing platforms inherit this design but face different threat models -- users do not necessarily trust each other the way video call participants do.

**How to avoid:**
- **Force all connections through TURN relay by default.** This hides both users' real IPs behind the TURN server's IP. Yes, this costs more bandwidth. It is the only way to prevent IP leaks in a WebRTC context. Allow power users to opt into direct P2P (with clear warnings about IP exposure) as a performance optimization.
- **Implement relay-by-default with opt-out, not opt-in.** Users who care about privacy (most will not understand the technical implications) are protected by default.
- **Signaling server hardening:** WSS (WebSocket Secure) only, never WS. Authenticate every signaling message. Rate-limit connection requests. Implement CSRF protection on signaling endpoints.
- **Never expose ICE candidates to the client-side JavaScript directly.** Filter SDP offers/answers server-side to strip local IP candidates before forwarding.
- **Session tokens for signaling:** Use short-lived, non-guessable tokens for WebRTC session negotiation. Store in HttpOnly cookies, never localStorage (XSS vulnerable).
- **Audit WebRTC configuration to prevent VPN bypass leaks.** Set `iceTransportPolicy: 'relay'` in RTCPeerConnection config to force TURN-only connections when privacy mode is enabled.

**Warning signs:**
- Users reporting that someone "found their location" after a trade.
- Security audit revealing local IP addresses in SDP offers sent to peers.
- Signaling server accessible without authentication.
- No rate limiting on connection initiation (enables IP harvesting at scale).

**Phase to address:**
Phase 1 (Security Architecture). The TURN-by-default decision shapes the entire WebRTC implementation and cost model. Must be decided at architecture time, not bolted on later.

---

### Pitfall 6: Gamification That Rewards Collection Size Over Community Value

**What goes wrong:**
The ranking system incentivizes the wrong behaviors. Common failure modes:

1. **Rarity score based solely on Discogs have/want ratio rewards hoarders, not diggers.** Users who happen to own obscure records they never listen to rank higher than active community contributors who trade, review, and share. The "rarest collection" metric rewards luck and wealth, not engagement.
2. **Leaderboards create a permanent elite.** Early adopters lock in top positions. New users see they can never catch up and disengage. Research shows leaderboards demotivate users who are "perpetually in the middle."
3. **Badge inflation.** Too many badges devalue all badges. If everything earns a badge, nothing feels meaningful.
4. **Gaming the system.** If trades increase rank, users create sham trades with friends. If reviews increase rank, users post low-effort reviews. TikTok's creator leaderboard is a cautionary tale: creators gamed it with clickbait and bought engagement, decreasing overall content quality.
5. **Overjustification effect.** External rewards (points, badges) replace intrinsic motivation (the joy of digging). When the rewards stop feeling novel, engagement collapses because the intrinsic motivation was already extinguished.

**Why it happens:**
Gamification is easy to add superficially (slap on points and a leaderboard) and difficult to design well. The "points, badges, leaderboards" (PBL) triad is the default because it is simple to implement, but research consistently shows it produces shallow, short-lived engagement. Deep gamification requires understanding user motivations first, then designing mechanics -- most teams do it backwards.

**How to avoid:**
- **Design the ranking formula to reward behaviors you actually want.** Weight community contribution (quality reviews, successful trades with positive feedback, helping new users) higher than passive collection rarity. A 60/40 split (contribution/rarity) is a starting point.
- **Use relative/contextual leaderboards, not global.** "Top diggers in Jazz this month" is motivating. "All-time global leaderboard" is demoralizing for 99% of users. Time-windowed and genre-scoped leaderboards keep competition fresh.
- **Implement anti-gaming measures.** Detect reciprocal sham trades (A trades to B, B trades back to A). Require minimum review length and apply duplicate/low-effort detection. Rate-limit rank-affecting actions per day.
- **Privilege rewards over vanity rewards.** The project spec already includes this (more P2P trades, exclusive groups at higher ranks). This is the right approach. Make sure the privileges are genuinely useful, not artificial scarcity.
- **Badge scarcity.** Fewer badges, harder to earn, more meaningful. 10-15 well-designed badges beat 100 trivial ones.
- **Playtest the ranking system with edge cases.** Simulate: a user with 10,000 common records vs. a user with 50 rare records who trades actively. Which one should rank higher? If your formula produces the wrong answer, fix it before launch.

**Warning signs:**
- Top-ranked users are inactive/disengaged (they ranked high via collection alone).
- New users not progressing beyond lowest rank tier after 30 days.
- Spike in low-quality reviews or suspicious trading patterns.
- Users explicitly discussing how to "game" the ranking system on external forums.

**Phase to address:**
Phase 2-3 (Gamification). But the data model for tracking contributions must be designed in Phase 1 so that contribution history exists when the ranking system launches. Retrofitting contribution tracking is a data migration nightmare.

---

### Pitfall 7: Freemium Paywall That Kills the Core Loop

**What goes wrong:**
Industry data shows freemium-to-paid conversion rates average 2-5%. For a social platform (not a productivity SaaS), expect the lower end: 1-3%. Common freemium mistakes that push even that low:

1. **Gating the core value proposition.** If wantlist matching or collection discovery requires premium, free users never experience the "aha moment" and never convert. The free tier must deliver the core value.
2. **P2P trade limits set too low.** If free users get 1-2 trades/month, they cannot experience enough value to justify upgrading. If free users get unlimited trades, there is no reason to upgrade. The sweet spot matters enormously and must be discovered through experimentation.
3. **Paywall too early.** Users who encounter a paywall before understanding the platform's value (before the "aha moment") churn permanently. Research shows users who understand the value proposition before encountering a paywall are 30% more likely to convert.
4. **Premium features that feel like hostage-taking.** "We disabled this feature you were using for free" feels punitive. Premium should add new capabilities, not restrict previously-available ones.
5. **No free-to-paid gradient.** The jump from free to premium should not be a cliff. Progressive disclosure of premium value (show what premium would unlock in context) converts better than a pricing page.

**Why it happens:**
Monetization is designed by developers thinking about revenue, not by users thinking about value. The paywall placement is chosen based on what the developer thinks is "fair" rather than data on where users experience maximum value and would pay to get more.

**How to avoid:**
- **Free tier must include:** Full collection import, full wantlist matching and notifications, public profile and social features, activity feed, collection comparison, basic rarity scores, limited P2P trades (3-5/month is a reasonable starting point).
- **Premium tier adds:** Unlimited P2P trades, detailed collection analytics (value trends, pressing comparisons, rarity deep-dives), priority wantlist matching, exclusive genre communities, advanced search filters, export capabilities.
- **Measure "aha moment" timing.** Track when free users first experience core value (first wantlist match, first successful trade). Place paywall after that moment, never before.
- **A/B test trade limits.** Start generous (5/month) and adjust based on conversion data. It is easier to reduce limits later than to explain why you increased them.
- **Show premium value in context.** When a free user views their rarity score, show "Premium members see detailed rarity breakdowns" with a preview. Do not hide the existence of premium features -- tease them.
- **Annual pricing option from day one.** Monthly churn is high for social platforms. Annual pricing with a discount (2 months free) locks in commitment.

**Warning signs:**
- Free-to-paid conversion rate below 1% after 3 months.
- High churn rate in the first month of premium subscriptions.
- User complaints about paywall placement on forums/reviews.
- Free users hitting trade limits and churning rather than upgrading.
- Very few users ever completing a P2P trade (the feature meant to drive conversion).

**Phase to address:**
Phase 3-4 (Monetization). But the data tracking for conversion funnel analysis must be built from Phase 1. Every user interaction that could inform paywall placement should be tracked from day one.

---

### Pitfall 8: WebRTC Data Channel File Transfer Breaks on Large Files and Safari/iOS

**What goes wrong:**
Two compounding problems:

1. **Large file transfers.** Vinyl rips in FLAC format are typically 100-500MB. WebRTC data channels require chunking files (16KB-64KB chunks for cross-browser compatibility). At 16KB chunks, a 300MB file requires ~19,200 chunks. Backpressure management is critical: the browser's default buffer threshold is 256KB, and exceeding it causes silent data loss or connection drops. If either peer's network hiccups during a 10-minute transfer, the entire transfer fails with no resume capability (WebRTC data channels have no built-in resume).

2. **Safari/iOS compatibility.** Safari's WebRTC data channel support has historically been partial and buggy. On iOS, all browsers are forced to use WebKit, meaning Chrome-on-iOS has the same limitations as Safari. Data channel file transfer on iOS has been unreliable through iOS 11-15, with improvements in later versions but still not at parity with Chrome/Firefox on desktop. Since the project is web-first, iOS Safari users are a significant portion of the audience.

**Why it happens:**
Developers build and test on Chrome desktop where WebRTC data channels work reliably. The Safari/iOS testing gap is the most common WebRTC development mistake. Large file testing is skipped because small test files work fine.

**How to avoid:**
- **Implement chunked transfer with checksum verification.** Each chunk gets a sequence number and CRC32 checksum. The receiver verifies and requests retransmission of corrupted/missing chunks.
- **Implement transfer resume.** Track which chunks have been successfully received. On reconnection, resume from the last confirmed chunk rather than restarting. This requires a lightweight transfer state protocol on top of the data channel.
- **Backpressure management.** Monitor `bufferedAmount` on the RTCDataChannel. Pause sending when buffer exceeds 128KB (conservative threshold below the 256KB default limit). Resume when `onbufferedamountlow` fires.
- **Cross-browser testing matrix from day one.** Test on: Chrome (desktop), Firefox (desktop), Safari (desktop), Safari (iOS), Chrome (Android). Use BrowserStack or similar for automated cross-browser testing.
- **Fallback for Safari/iOS.** If data channel transfer fails, offer a TURN-relayed HTTP-like fallback where the TURN server temporarily bridges the transfer. This is architecturally complex but may be necessary for iOS support.
- **File size limits.** Consider a maximum transfer size (e.g., 500MB) with clear user communication. Reject files that would take more than 15-20 minutes to transfer.
- **Compression negotiation.** Offer FLAC, ALAC, and high-bitrate MP3/AAC options. Not everyone needs lossless, and smaller files transfer more reliably.

**Warning signs:**
- Transfer success rate significantly lower on Safari/iOS than Chrome.
- Transfers failing partway through with no error message.
- Users reporting transfers "stuck at 80%" (backpressure stall).
- High percentage of transfers that take >10 minutes failing.

**Phase to address:**
Phase 2 (P2P Implementation). The chunking/resume protocol must be designed before building the file transfer UI. Cross-browser testing infrastructure must be established in Phase 1.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip TURN server deployment | Saves infrastructure cost, simpler setup | 15-30% of users cannot connect; impossible to add IP privacy later without rearchitecting | Never -- deploy TURN from day one |
| Use Discogs live API for all metadata | No need to manage local database of releases | Hits rate limits at scale, slow imports, dependent on Discogs uptime | MVP only (first 50 users), must migrate to data dumps before any growth |
| Store WebRTC signaling tokens in localStorage | Simpler implementation, persists across tabs | XSS vulnerability exposes signaling tokens; attackers can hijack WebRTC sessions | Never -- use HttpOnly cookies or memory storage |
| Global all-time leaderboard only | Simple to implement, single ranking query | Demotivates 95% of users; early adopters permanently dominate | Never -- implement contextual/time-windowed leaderboards from launch |
| Skip DMCA agent registration | Saves time and $6 filing fee | Forfeits DMCA safe harbor entirely; no legal protection | Never |
| Import entire Discogs collection synchronously | Simpler UX flow (user waits, sees results) | Blocks the UI, times out for large collections, hammers rate limits | Acceptable only for collections under 100 items; async queue for larger |
| Single TURN server region | Lower cost, simpler deployment | High latency for international users (vinyl community is global), single point of failure | Acceptable for beta launch targeting a single geographic market |
| Skip file transfer resume capability | Simpler data channel protocol | Every failed large-file transfer restarts from zero; user frustration compounds | MVP only -- must add before public launch |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Discogs OAuth | Storing OAuth tokens without encryption; not handling token expiry/revocation | Encrypt tokens at rest. Implement token refresh flow. Handle 401 responses gracefully with re-authentication prompt. |
| Discogs API | Per-user rate limiting (thinking each user gets 60 req/min) | Rate limit is per application (by IP or key), NOT per user. Implement a global request queue shared across all user operations. |
| Discogs API | Caching release data indefinitely | Discogs ToS prohibits caching data longer than necessary. Implement 30-day cache TTL for release metadata. Use data dumps for static catalog data instead. |
| Discogs API | Using API for rarity (have/want) calculations in real-time | Have/want ratios change slowly. Batch-update from data dumps weekly. Real-time API calls for this are wasteful and rate-limit-hungry. |
| Discogs Data Dumps | Assuming dumps are small/fast to process | Monthly dumps are multi-gigabyte XML files. Processing requires streaming XML parsers, not DOM parsers. Budget 30-60 minutes for a full import on modest hardware. |
| WebRTC TURN | Using free/public TURN servers | Free TURN servers have no SLA, no bandwidth guarantees, and may log traffic. Use a paid service or self-host coturn with proper TLS. |
| WebRTC Signaling | Using unencrypted WebSocket (ws://) for signaling | Always use WSS. Signaling messages contain SDP offers with IP addresses and session metadata. Unencrypted signaling is equivalent to broadcasting user IPs. |
| Stripe/Payment | Implementing payment without webhook verification | Always verify payment events via webhooks, not client-side callbacks. Client-side payment confirmation can be spoofed. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries on collection display | Collection pages load slowly, database CPU spikes | Eager-load release metadata with collection queries. Use database views or materialized views for collection displays. | 500+ items in a collection |
| Real-time wantlist matching on every new import | Import completion takes exponentially longer as user base grows | Pre-compute match indexes. When a user imports, check their items against a pre-built wantlist index, not every other user's wantlist individually. | 1,000+ users with active wantlists |
| Full-text search on release database without indexing | Search becomes unusably slow | Use PostgreSQL full-text search (tsvector/tsquery) or a dedicated search engine (Meilisearch for solo dev simplicity). Index on import, not on query. | 1M+ releases in database |
| TURN server bandwidth without geographic distribution | High latency transfers, transfer failures for international users | Deploy TURN in at least 2 regions (US + EU). Route users to nearest TURN server via GeoDNS or anycast. | Users spanning 3+ continents |
| Unoptimized Discogs data dump processing | Weekly data refresh takes 24+ hours, blocking the server | Stream-process XML dumps. Use COPY for bulk PostgreSQL inserts. Process incrementally (diff against previous dump) rather than full replace. | Growing beyond 15M releases in the database |
| Activity feed as a fan-out-on-write | Each user action generates write operations for every follower | Use fan-out-on-read for the activity feed (query at read time, not pre-compute at write time). For a solo dev, this is simpler and scales further before needing optimization. | 10,000+ users with 50+ followers each |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing Discogs API keys/secrets in client-side JavaScript | Attackers can use your API credentials, exhaust your rate limits, or impersonate your application to Discogs | All Discogs API calls must route through your backend. Never send API keys to the browser. Use server-side proxy endpoints. |
| No rate limiting on signaling server endpoints | Attackers can enumerate users, harvest IP addresses, or DDoS the signaling infrastructure | Rate-limit WebSocket connections per IP (max 10/min). Rate-limit room creation per authenticated user (max 5/min). Implement connection throttling. |
| WebRTC SDP offers forwarded without sanitization | SDP contains private IP addresses, network topology information, and supported codecs. Forwarding raw SDP enables reconnaissance. | Parse and sanitize SDP before forwarding. Strip private IP candidates (mDNS candidates only). Remove unnecessary metadata. |
| No Content Security Policy (CSP) headers | XSS attacks can inject malicious JavaScript that hijacks WebRTC sessions, exfiltrates signaling tokens, or redirects peer connections to attacker-controlled endpoints | Implement strict CSP: `default-src 'self'; connect-src 'self' wss://signal.yourdomain.com; script-src 'self'`. No `unsafe-inline` or `unsafe-eval`. |
| TURN server credentials with long/no expiry | Compromised TURN credentials allow indefinite free relay bandwidth consumption (a direct cost attack on your infrastructure) | Generate time-limited TURN credentials (5-minute TTL) via TURN REST API. Rotate credentials on each new transfer session. |
| User-uploaded profile content without sanitization | Stored XSS via profile bio, collection notes, or review text. In a platform with WebRTC sessions, XSS leads to session hijacking. | Sanitize all user input server-side with a strict allowlist (not blocklist). Use a battle-tested library (DOMPurify for display, server-side validation for storage). |
| JWT tokens with weak/no expiry for API authentication | Stolen tokens grant indefinite API access. Combined with WebRTC signaling access, this enables persistent impersonation. | Short-lived access tokens (15 min). Refresh tokens with rotation and revocation. HttpOnly secure cookies for web clients. |
| No abuse detection on P2P connection patterns | Malicious users can systematically connect to every user to harvest IP addresses (if not using TURN-by-default) or enumerate the user base | Monitor connection request patterns. Flag users who initiate >20 unique connections/day. Require mutual consent (both users must accept) before WebRTC negotiation begins. |
| Discogs OAuth token storage without encryption | Database breach exposes all users' Discogs OAuth tokens, enabling mass impersonation on Discogs | Encrypt OAuth tokens at rest using application-level encryption (not just database-level). Use a separate encryption key stored in environment variables, not in the database. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Showing "0 matches" on first login | User immediately feels the platform has no value; 70%+ will not return | Show potential matches from Discogs data ("47 Discogs users have this pressing -- be the first to connect on VinylDig") rather than actual zero platform matches. |
| Requiring account creation before showing any value | Users bounce before experiencing the product | Allow browsing release data, rarity scores, and collection search without an account. Gate social features and P2P behind auth. |
| File transfer with no progress indication | User does not know if transfer is working, stalled, or failed; closes tab and kills transfer | Show: percentage complete, transfer speed, estimated time remaining, chunk-level progress. Warn before tab close during active transfer. |
| Forcing full collection import before any features unlock | Large collections take minutes; user stares at loading screen | Allow partial import (first 100 items) with immediate access to features. Continue importing in background. Show "Your collection is still importing -- some features will improve as more records load." |
| Ranking/score with no explanation | Users do not understand why their score is what it is; feels arbitrary | Show score breakdown: "Your Rarity Score: 847 (collection rarity: 520 + community contribution: 327). Top contributions: 12 quality reviews, 8 successful trades." |
| Generic notification spam | Users disable notifications; miss important wantlist matches | Categorize notifications by priority. Wantlist matches = high priority (push). Weekly digest for activity feed. Let users configure per-category. Never batch wantlist matches into a weekly email -- they are time-sensitive. |
| No offline/degraded mode for mobile web | User opens app on subway (no connection), sees blank screen | Cache last-viewed collection data in service worker. Show cached data with "Last updated X minutes ago" indicator. Queue actions for sync when online. |

## "Looks Done But Isn't" Checklist

- [ ] **Discogs Import:** Often missing pagination handling for large collections -- verify import works for collections with 5,000+ items and correctly handles API pagination (per_page=100 max, requiring 50+ sequential requests)
- [ ] **WebRTC Connection:** Often missing TURN fallback -- verify file transfer works when both peers are behind symmetric NAT (test with simulated restrictive NAT using Docker + iptables)
- [ ] **WebRTC Connection:** Often missing Safari/iOS testing -- verify data channel transfer works on Safari 17+ (macOS) and Safari (iOS 17+) with a real 100MB+ file
- [ ] **File Transfer:** Often missing resume capability -- verify that a network interruption mid-transfer does not require restarting from zero (simulate by toggling network on mobile)
- [ ] **Rarity Score:** Often missing edge case handling -- verify scoring works correctly for: releases with no Discogs data, releases with 0 "want" count, users with empty collections, users with only wantlist items
- [ ] **DMCA Compliance:** Often missing the actual DMCA agent registration -- verify agent is registered at copyright.gov AND contact information is published on the platform's website
- [ ] **Rate Limiting:** Often missing global API rate tracking -- verify that 10 simultaneous Discogs imports do not trigger 429 responses (test with concurrent import load)
- [ ] **Signaling Security:** Often missing authentication on WebSocket upgrade -- verify that unauthenticated clients cannot connect to the signaling server or initiate WebRTC negotiations
- [ ] **Freemium Limits:** Often missing enforcement on the server side -- verify that a technically savvy free-tier user cannot bypass trade limits by manipulating client-side code or API calls directly
- [ ] **Leaderboard:** Often missing anti-gaming checks -- verify that two users cannot boost each other's rank by repeatedly trading the same file back and forth

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| No TURN server (15-30% users cannot connect) | MEDIUM | Deploy TURN infrastructure (coturn or managed service). Update ICE configuration in WebRTC client. Requires client-side code update but no architectural change if ICE was properly abstracted. |
| Discogs API rate limit exceeded / account flagged | HIGH | Switch to data dump strategy (requires new data pipeline). Contact Discogs developer support to explain situation and request unflagging. May require temporary feature degradation during transition. |
| Cold start death (users churning before network effect) | HIGH | Pivot to single-player utility mode. Remove or de-emphasize social features. Double down on collection analytics as standalone value. Rebuilding lost trust (getting churned users back) is harder than acquiring new users. |
| DMCA notice received with no compliance infrastructure | HIGH | Immediately comply with takedown. Retain copyright attorney. Register DMCA agent (takes 1-2 weeks to process). Build notice-and-takedown workflow. Risk: operating without safe harbor during the gap exposes personal liability. |
| IP addresses leaked via WebRTC | HIGH | Switch to TURN-by-default (immediate infrastructure cost increase). Notify affected users. Implement SDP sanitization. Reputation damage may be permanent in privacy-conscious communities. |
| Gamification gaming detected (sham trades, fake reviews) | MEDIUM | Reset affected rankings. Implement detection algorithms. Add rate limits on rank-affecting actions. Communicate transparently: "We detected gaming and have reset affected scores." Silence is worse than admitting the problem. |
| Freemium paywall killing conversion | LOW | Adjust limits (more generous free tier). A/B test paywall placement. This is one of the easier problems to iterate on because it is primarily a configuration change, not an architectural one. |
| Large file transfers failing on Safari/iOS | MEDIUM | Implement HTTP-based fallback for Safari. Detect browser and route to appropriate transfer mechanism. Adds code complexity but does not require architectural changes if the transfer layer was properly abstracted. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| WebRTC P2P connection failures (NAT/firewall) | Phase 1: Infrastructure | Connection success rate >85% across test matrix (Chrome, Firefox, Safari, iOS, restrictive NAT simulator) |
| Discogs API rate limit destruction | Phase 1: Data Architecture | Successful concurrent import of 10 users with 1,000+ item collections without triggering 429 responses |
| Cold start death | Phase 1-2: Single-player utility first | Day-1 retention >20%; average first session >5 minutes; single-player features usable with zero other users |
| Copyright/DMCA exposure | Pre-launch: Legal preparation | DMCA agent registered; takedown procedure documented and tested; ToS reviewed by attorney; repeat infringer policy published |
| WebRTC IP address leaks | Phase 1: Security Architecture | Penetration test confirms no IP leakage in TURN-by-default mode; SDP sanitization verified; signaling server requires authentication |
| Gamification wrong incentives | Phase 2-3: Gamification design | Simulated ranking with edge-case user profiles produces expected/desired ranking order; anti-gaming detection catches reciprocal sham trades |
| Freemium paywall misplacement | Phase 3-4: Monetization | Free-to-paid conversion rate >2% within 3 months of launch; free users completing core loop (import + match + trade) before hitting paywall |
| Large file / Safari transfer failures | Phase 2: P2P Implementation | 300MB FLAC transfer completes successfully on Chrome, Firefox, Safari (macOS), and Safari (iOS) with <5% failure rate; resume works after simulated disconnect |
| Signaling server security | Phase 1: Security Architecture | OWASP ZAP or similar scanner finds zero high/critical issues on signaling endpoints; unauthenticated WebSocket connections rejected |
| Sybil attacks on reputation system | Phase 2-3: Anti-abuse | Multi-account detection in place (device fingerprinting + behavioral analysis); reputation weight increases with account age; new accounts have limited reputation impact |

## Sources

- [WebRTC NAT Traversal - STUN/TURN Complete Guide](https://webrtc.link/en/articles/stun-turn-servers-webrtc-nat-traversal/)
- [How NAT Traversal Works - Tailscale](https://tailscale.com/blog/how-nat-traversal-works)
- [NAT Traversal and Firewalls - Stream](https://getstream.io/resources/projects/webrtc/fundamentals/nat-traversal-and-dealing-with-firewalls/)
- [TURN Server Costs Complete Guide - DEV Community](https://dev.to/alakkadshaw/turn-server-costs-a-complete-guide-1c4b)
- [How Much Does WebRTC Cost? - WebRTC.ventures](https://webrtc.ventures/2025/10/how-much-does-it-really-cost-to-build-and-run-a-webrtc-application/)
- [Discogs API Terms of Use](https://support.discogs.com/hc/en-us/articles/360009334593-API-Terms-of-Use)
- [Discogs API Documentation](https://www.discogs.com/developers)
- [Discogs Data Dumps](https://data.discogs.com/)
- [Discogs Forum - API Rate Limits Discussion](https://www.discogs.com/forum/thread/1104957)
- [Cold Start Problem for Social Products - Andrew Chen](https://andrewchen.com/how-to-solve-the-cold-start-problem-for-social-products/)
- [Dark Side of Gamification - Growth Engineering](https://www.growthengineering.co.uk/dark-side-of-gamification/)
- [Gamification Design Pitfalls - Sententia](https://www.sententiagamification.com/blog/the-updated-guide-to-gamification-design-4-common-pitfalls-to-avoid)
- [Gamification is Not Working - SAGE Journals (2025)](https://journals.sagepub.com/doi/abs/10.1177/15554120241228125)
- [Even Good Leaderboards Are Gamed - Ehud Reiter (2025)](https://ehudreiter.com/2025/05/05/good-leaderboards-gamed/)
- [WebRTC Security 2025 - WebRTC.ventures](https://webrtc.ventures/2025/07/webrtc-security-in-2025-protocols-vulnerabilities-and-best-practices/)
- [WebRTC IP Leak Prevention Guide - VideoSDK](https://www.videosdk.live/developer-hub/webrtc/webrtc-ip-leaks)
- [WebRTC Security Study](https://webrtc-security.github.io/)
- [DMCA Safe Harbor Provisions - Congress.gov](https://www.congress.gov/crs-product/IF11478)
- [DMCA Safe Harbor - Copyright Alliance](https://copyrightalliance.org/education/copyright-law-explained/the-digital-millennium-copyright-act-dmca/dmca-safe-harbor/)
- [Section 512 Resources - U.S. Copyright Office](https://www.copyright.gov/512/)
- [Capitol Records v. Vimeo (2025) - Second Circuit DMCA Ruling](https://ipandmedialaw.fkks.com/post/102jxo0/second-circuit-clarifies-when-content-moderation-risks-dmca-safe-harbor)
- [Legal Aspects of File Sharing - Wikipedia](https://en.wikipedia.org/wiki/Legal_aspects_of_file_sharing)
- [Vinyl Rip Sharing Legality Discussion - Vinyl Engine Forum](https://www.vinylengine.com/turntable_forum/viewtopic.php?t=93749)
- [SaaS Freemium Conversion Rates 2026 Report - First Page Sage](https://firstpagesage.com/seo-blog/saas-freemium-conversion-rates/)
- [Improving Freemium Conversion Rate - Userpilot](https://userpilot.com/blog/freemium-conversion-rate/)
- [Mastering Freemium Paywalls - Monetizely](https://www.getmonetizely.com/articles/mastering-freemium-paywalls-strategic-timing-for-saas-success)
- [RTCDataChannel Guide - WebRTC.link](https://webrtc.link/en/articles/rtcdatachannel-usage-and-message-size-limits/)
- [WebRTC Safari 2025 Developer Guide - VideoSDK](https://www.videosdk.live/developer-hub/webrtc/webrtc-safari)
- [WebRTC Browser Support 2026 - Ant Media](https://antmedia.io/webrtc-browser-support/)
- [Sybil Attacks Detection and Prevention - Rapid7](https://www.rapid7.com/blog/post/2017/03/10/sybil-attacks-detection-and-prevention/)
- [OWASP Top 10:2025](https://owasp.org/Top10/2025/)
- [OWASP API Security Top 10](https://owasp.org/API-Security/)
- [WebRTC Security Best Practices - Digital Samba](https://www.digitalsamba.com/blog/webrtc-security)

---
*Pitfalls research for: VinylDig -- Social network for vinyl diggers with P2P audio file sharing*
*Researched: 2026-03-25*
