# Architecture Research

**Domain:** Social network with P2P file transfer, external API sync, gamification, and real-time notifications
**Researched:** 2026-03-25
**Confidence:** HIGH (core patterns well-documented; WebRTC file transfer specifics MEDIUM)

## System Overview

```
                          ┌─────────────────────────────┐
                          │        CDN / Static Host     │
                          │   (Frontend SPA - React/Next)│
                          └──────────────┬──────────────┘
                                         │ HTTPS
                          ┌──────────────▼──────────────┐
                          │       API Gateway / Server   │
                          │   (Node.js + Express/Fastify)│
                          │                              │
                          │  ┌────────┐ ┌─────────────┐ │
                          │  │REST API│ │  WebSocket   │ │
                          │  │        │ │  (Signaling  │ │
                          │  │        │ │  + SSE/WS    │ │
                          │  │        │ │  Notifs)     │ │
                          │  └───┬────┘ └──────┬──────┘ │
                          └──────┼─────────────┼────────┘
                                 │             │
                ┌────────────────┼─────────────┼────────────────┐
                │                │             │                │
        ┌───────▼──────┐ ┌──────▼───┐ ┌───────▼──────┐ ┌──────▼──────┐
        │  PostgreSQL  │ │  Redis   │ │   BullMQ     │ │  Discogs    │
        │  (Primary DB)│ │  (Cache, │ │  (Job Queue) │ │  API        │
        │              │ │  Ranks,  │ │              │ │  (External) │
        │  Users       │ │  Sessions│ │  Import jobs │ │             │
        │  Collections │ │  Leaderb.│ │  Rank recalc │ │  OAuth 1.0a │
        │  Wantlists   │ │  Pub/Sub)│ │  Wantlist    │ │  60 req/min │
        │  Activities  │ │          │ │  matching    │ │             │
        │  Trades      │ │          │ │              │ │             │
        └──────────────┘ └──────────┘ └──────────────┘ └─────────────┘

                    ┌──────────────────────────────┐
                    │    P2P Layer (Browser-side)   │
                    │                              │
                    │  ┌────────┐    ┌────────┐    │
                    │  │Peer A  │◄──►│Peer B  │    │
                    │  │Browser │    │Browser │    │
                    │  └───┬────┘    └────┬───┘    │
                    │      │   WebRTC     │        │
                    │      │  DataChannel │        │
                    │      │  (encrypted) │        │
                    │      └──────────────┘        │
                    │              │                │
                    │     ┌───────▼───────┐        │
                    │     │ STUN / TURN   │        │
                    │     │ (NAT travers.)│        │
                    │     └───────────────┘        │
                    └──────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| **API Server** | REST endpoints, authentication, business logic, rate limiting | Node.js + Fastify (or Express). Single deployable process |
| **WebSocket Server** | WebRTC signaling relay, real-time notifications to connected clients | Socket.IO on same Node.js process (shared port, namespace separation) |
| **PostgreSQL** | Persistent storage: users, collections, wantlists, activities, trades, reviews, subscriptions | PostgreSQL 16+ with JSONB for flexible release metadata |
| **Redis** | Session store, leaderboard sorted sets, caching Discogs data, BullMQ backing store, pub/sub for notifications | Redis 7+ (single instance sufficient at launch) |
| **BullMQ** | Background job processing: Discogs imports, wantlist matching, rank recalculation, notification dispatch | BullMQ workers in same Node.js process or separate worker process |
| **Discogs API Client** | OAuth 1.0a authentication, collection/wantlist fetching, rate-limit-aware request queue | Custom client wrapping `node-fetch` with token bucket rate limiting |
| **P2P Module (Client)** | WebRTC peer connection, DataChannel file transfer with chunking, progress tracking | `simple-peer` library in browser, chunked file transfer over DataChannel |
| **STUN/TURN** | NAT traversal for WebRTC peers behind firewalls/symmetric NATs | Managed service (Metered.ca or Twilio) -- not self-hosted |
| **Feature Gate** | Freemium/premium entitlement checking, trade counting, feature access control | Middleware layer checking user subscription tier against action limits |

## Recommended Project Structure

```
vinyldig/
├── apps/
│   ├── web/                    # Frontend (Next.js or Vite + React)
│   │   ├── src/
│   │   │   ├── components/     # UI components (retro/analog design system)
│   │   │   ├── features/       # Feature modules (collection, trading, rankings)
│   │   │   ├── hooks/          # Custom hooks (useWebRTC, useNotifications)
│   │   │   ├── lib/            # Utilities, API client, WebRTC wrapper
│   │   │   ├── pages/          # Route pages
│   │   │   └── stores/         # Client state (Zustand or similar)
│   │   └── public/
│   └── server/                 # Backend (Node.js)
│       ├── src/
│       │   ├── routes/         # REST API route handlers
│       │   ├── services/       # Business logic (collection, matching, ranking)
│       │   ├── jobs/           # BullMQ job processors
│       │   ├── ws/             # WebSocket handlers (signaling, notifications)
│       │   ├── middleware/     # Auth, feature gates, rate limiting
│       │   ├── db/             # Database queries, migrations
│       │   │   ├── migrations/
│       │   │   └── queries/
│       │   ├── integrations/   # Discogs API client
│       │   └── lib/            # Shared utilities
│       └── tests/
├── packages/
│   └── shared/                 # Shared types, constants, validation schemas
├── docker-compose.yml          # Local dev: PostgreSQL + Redis
└── package.json                # Monorepo root (pnpm workspaces)
```

### Structure Rationale

- **Monorepo with `apps/` and `packages/`:** Keeps frontend and backend in one repo with shared types. pnpm workspaces for dependency management. Solo developer does not need separate repos -- one repo, one deploy pipeline.
- **`features/` in frontend:** Groups UI by domain (collection, trading, rankings) rather than by type (components, pages). Each feature is self-contained.
- **`services/` in backend:** Pure business logic separated from HTTP/WS transport. Services are testable without spinning up a server.
- **`jobs/` in backend:** BullMQ processors isolated from request handling. Can run in-process or as a separate worker when scaling is needed.
- **`integrations/`:** Discogs API client isolated behind an interface. If Discogs changes their API or rate limits, changes are contained here.

## Architectural Patterns

### Pattern 1: Monolith-First with Modular Boundaries

**What:** Single deployable Node.js process serving REST API, WebSocket signaling, and background jobs. Internally organized as distinct modules with clean interfaces between them.

**When to use:** Solo developer, pre-product-market-fit, under 10K users. Always start here.

**Trade-offs:** Simple deployment and debugging. No inter-service latency. Easy to refactor. Cannot independently scale components -- but that does not matter until thousands of concurrent users.

**Why this over microservices:** A solo developer maintaining multiple services, message brokers, and service meshes will spend more time on infrastructure than product. The modular monolith gives you the organizational benefits of services without the operational burden. Extract services only when a specific bottleneck demands it (the BullMQ worker is the first candidate for extraction).

```
// Server entry point -- everything in one process
import { createApp } from './app';
import { createSignalingServer } from './ws/signaling';
import { createNotificationServer } from './ws/notifications';
import { startWorkers } from './jobs/workers';

const app = createApp();          // REST API
createSignalingServer(app.server); // WebSocket signaling (same HTTP server)
createNotificationServer(app.server); // SSE or WS notifications
startWorkers();                    // BullMQ job processors (in-process)
```

### Pattern 2: Queue-Driven Discogs Import Pipeline

**What:** Discogs collection/wantlist imports are never synchronous API calls. Every import request creates a BullMQ job. The job processor fetches paginated data from Discogs at a controlled rate, stores results incrementally, and emits progress events.

**When to use:** Always, for any external API integration with rate limits.

**Trade-offs:** More complex than direct API calls. But prevents: request timeouts on large collections (some users have 10K+ records), rate limit violations, and poor UX (user sees progress instead of spinner).

**Critical design detail -- Discogs rate limits:**
- Authenticated: 60 requests/minute (OAuth 1.0a)
- Unauthenticated: 25 requests/minute
- Collection endpoint returns max 100 items per page
- A user with 5,000 records = 50 pages = 50 API calls = ~50 seconds minimum
- A user with 20,000 records = 200 pages = 200 API calls = ~3.3 minutes minimum
- Multiple users importing simultaneously share the same rate limit if using app-level OAuth

**Implementation approach:**
```
User clicks "Import"
    → POST /api/import/collection
    → Create BullMQ job { userId, discogsUsername, type: 'collection' }
    → Return 202 Accepted + jobId
    → Client polls job status or receives SSE progress updates

BullMQ Worker processes job:
    → Fetch page 1 of collection (100 items)
    → Store/upsert releases into PostgreSQL
    → Check rate limit headers (X-Discogs-Ratelimit-Remaining)
    → If remaining < 5, delay next request
    → Emit progress event (page 3 of 50)
    → Repeat until all pages fetched
    → Run wantlist matching job on completion
    → Mark job complete
```

**Rate limiting strategy:** BullMQ has built-in rate limiting (`limiter: { max: 50, duration: 60000 }`). Configure the Discogs import queue to process at most 50 jobs per minute globally, leaving headroom below the 60 req/min ceiling. Use Discogs response headers to dynamically back off when approaching limits.

### Pattern 3: Event-Driven Activity Feed (Fan-Out on Read)

**What:** When a user performs an action (adds a record, completes a trade, earns a badge), write an immutable activity event to the `activities` table. When a user loads their feed, query activities from users they follow, sorted by timestamp. No pre-materialized feeds.

**When to use:** Under 100K users with reasonable follow counts. Fan-out on read is simpler to implement and maintain than fan-out on write.

**Trade-offs:**
- Simpler: No feed materialization pipeline, no stale feed problems, no complex fan-out logic.
- Slower reads: Feed query joins activities with the follow graph. With proper indexes and pagination (cursor-based, not offset), this performs well up to ~100K users.
- If performance degrades later: Add Redis-cached feed lists (fan-out on write) as an optimization, not a rewrite.

**Why NOT fan-out on write for VinylDig:**
Fan-out on write (push model) pre-computes feeds by copying each activity to every follower's feed list. This is what Twitter/X does at scale. For a solo developer at launch, this adds enormous complexity (write amplification, consistency problems, storage overhead) for zero benefit at low user counts. Start with fan-out on read. Optimize later with evidence.

```sql
-- Activity feed query (fan-out on read)
SELECT a.*, u.username, u.avatar_url
FROM activities a
JOIN follows f ON f.following_id = a.user_id
JOIN users u ON u.id = a.user_id
WHERE f.follower_id = $currentUserId
  AND a.created_at < $cursor
ORDER BY a.created_at DESC
LIMIT 20;
```

### Pattern 4: Redis Sorted Sets for Rankings

**What:** Maintain leaderboard scores in Redis sorted sets. When a user's score changes (new rare record added, trade completed, review written), update their score in Redis with `ZINCRBY` or `ZADD`. Query rankings with `ZREVRANGE` (top N) or `ZREVRANK` (user's position).

**When to use:** Any time you need ranked lists with real-time updates.

**Trade-offs:** Extremely fast reads (O(log N) for rank lookup). Requires Redis. Scores must be numeric. For composite scores (rarity + contribution), compute a single weighted numeric score.

**Ranking computation model for VinylDig:**

```
Total Score = (Rarity Score * 0.6) + (Contribution Score * 0.4)

Rarity Score = SUM over collection of: want_count / have_count for each release
  (normalized to 0-1000 range)

Contribution Score = (trades_completed * 10)
                   + (reviews_written * 5)
                   + (quality_rating_avg * 20)  // reputation from trade partners
                   + (days_active * 0.5)

Redis keys:
  leaderboard:global        → ZSET of userId:totalScore
  leaderboard:genre:{id}    → ZSET of userId:genreScore (optional, later)
```

**Recalculation strategy:** Do NOT recalculate all scores on every action. Instead:
1. **Incremental updates:** When a user adds a record, compute only that record's rarity contribution and `ZINCRBY` the delta.
2. **Periodic full recalc:** BullMQ scheduled job runs nightly to recalculate all scores from source data (PostgreSQL). This corrects drift from Discogs want/have ratio changes. This is the authoritative recalc; incremental updates provide real-time responsiveness.
3. **Rarity cache:** Cache Discogs want/have ratios in PostgreSQL (refreshed during periodic sync). Do not hit Discogs API for every rarity lookup.

## Data Flow

### Flow 1: Discogs Import Pipeline

```
User (Browser)
    │ POST /api/import/collection { discogsUsername }
    ▼
API Server
    │ Validate auth, check subscription tier (free: 1 import/day)
    │ Create BullMQ job
    │ Return 202 + jobId
    ▼
BullMQ Queue: "discogs-import"
    │
    ▼
BullMQ Worker
    │ ┌─────────────────────────────────────────┐
    │ │ FOR each page of Discogs collection:    │
    │ │   1. GET /users/{name}/collection/...   │
    │ │   2. Check X-Discogs-Ratelimit-Remaining│
    │ │   3. Upsert releases into PostgreSQL    │
    │ │   4. Emit progress via Redis pub/sub    │
    │ │   5. If rate limit low, delay next page │
    │ └─────────────────────────────────────────┘
    │ On complete:
    │   1. Trigger wantlist-matching job
    │   2. Trigger rarity-score-recalc job
    │   3. Create activity event: "imported N records"
    ▼
PostgreSQL
    │ releases, user_collections, user_wantlists updated
    ▼
Redis pub/sub → SSE/WebSocket → User sees progress bar + completion
```

### Flow 2: WebRTC P2P File Transfer

```
User A (Wants to send file) ──────────────────── User B (Wants to receive)
    │                                                    │
    │ 1. POST /api/trades/initiate { targetUserId }      │
    │    → Server creates trade record, returns tradeId  │
    │    → Server notifies User B via WebSocket          │
    │                                                    │
    │ 2. User B accepts trade (via WebSocket)            │
    │                                                    │
    │ 3. SIGNALING PHASE (via WebSocket server):         │
    │    A creates RTCPeerConnection                     │
    │    A creates offer (SDP) ──→ Server ──→ B          │
    │    B creates answer (SDP) ──→ Server ──→ A         │
    │    ICE candidates exchanged via Server             │
    │    (STUN resolves public IPs)                      │
    │    (TURN relays if direct fails)                   │
    │                                                    │
    │ 4. P2P DATACHANNEL ESTABLISHED                     │
    │    ◄═══════════════════════════════════════►       │
    │    Encrypted DTLS connection, no server relay      │
    │                                                    │
    │ 5. FILE TRANSFER:                                  │
    │    A reads file via File API                       │
    │    A chunks file into 64KB segments                │
    │    A sends chunks via DataChannel                  │
    │    A monitors bufferedAmount for backpressure      │
    │    B reassembles chunks into Blob                  │
    │    B triggers download via URL.createObjectURL     │
    │                                                    │
    │ 6. POST-TRANSFER:                                  │
    │    Both peers notify server: transfer complete     │
    │    Server updates trade record                     │
    │    Server prompts quality review                   │
    │    Score updates: ZINCRBY leaderboard:global       │
    │    Activity event created                          │
    ▼                                                    ▼
   Server NEVER touches the file. "Mere conduit" preserved.
```

### Flow 3: Wantlist Matching + Notification

```
Trigger: User A imports collection (or adds a record manually)
    │
    ▼
BullMQ Job: "wantlist-match"
    │
    │ Query: Find all users whose wantlist contains
    │        any release that User A just added to their collection
    │
    │ SQL:
    │   SELECT uw.user_id, uw.release_id, r.title
    │   FROM user_wantlists uw
    │   JOIN user_collections uc ON uc.release_id = uw.release_id
    │   JOIN releases r ON r.id = uw.release_id
    │   WHERE uc.user_id = $importingUserId
    │     AND uc.release_id = ANY($newlyAddedReleaseIds)
    │     AND uw.user_id != $importingUserId
    │
    ▼
For each match:
    │ 1. Create notification record in PostgreSQL
    │ 2. Publish to Redis channel: notifications:{matchedUserId}
    │ 3. If user is online (has active SSE/WS connection):
    │       → Push real-time notification
    │    Else:
    │       → Notification waits in DB, shown on next login
    │       → (Optional: email digest via separate job)
    ▼
Matched User sees: "UserA has [Record Title] from your wantlist!"
```

### Flow 4: Ranking Score Update

```
Trigger: Any score-affecting action
    │ (record added, trade completed, review written, quality rating received)
    ▼
Action Handler (in service layer)
    │ 1. Persist action to PostgreSQL
    │ 2. Compute score delta
    │ 3. ZINCRBY leaderboard:global userId scoreDelta
    │ 4. (Optional) Create activity event
    ▼
Redis Sorted Set updated in real-time
    │
    ▼
Nightly BullMQ Cron Job: "recalc-all-scores"
    │ 1. For each user: recalculate total score from PostgreSQL
    │ 2. ZADD leaderboard:global userId newTotalScore (overwrite)
    │ 3. Refresh rarity scores from cached Discogs data
    │ This corrects any drift between incremental and true scores
```

## WebRTC Signaling Architecture (Detailed)

### Signaling Server Design

The signaling server is NOT a separate service. It is a Socket.IO namespace on the same Node.js server, using a dedicated namespace (`/signaling`) to isolate signaling traffic from other WebSocket uses (notifications use `/notifications` namespace or SSE).

**Why Socket.IO over raw WebSocket for signaling:**
- Auto-reconnection with exponential backoff (critical when peers drop mid-negotiation)
- Room/namespace support out of the box (each trade session = a room)
- Fallback to long-polling if WebSocket fails (rare but handles corporate proxies)
- The performance overhead is negligible for signaling (small, infrequent messages)
- Solo developer: Socket.IO saves significant boilerplate

**Signaling message flow:**

```
Namespace: /signaling
Rooms: trade:{tradeId}

Events:
  Client → Server:
    "join-trade"    { tradeId }           // Join signaling room
    "offer"         { tradeId, sdp }      // SDP offer
    "answer"        { tradeId, sdp }      // SDP answer
    "ice-candidate" { tradeId, candidate} // ICE candidate
    "transfer-done" { tradeId, status }   // Transfer completion

  Server → Client:
    "peer-joined"   { peerId }            // Other peer joined room
    "offer"         { sdp }               // Relay SDP offer
    "answer"        { sdp }               // Relay SDP answer
    "ice-candidate" { candidate }         // Relay ICE candidate
    "peer-left"     { peerId }            // Peer disconnected
```

**Server-side signaling handler (conceptual):**

```typescript
io.of('/signaling').on('connection', (socket) => {
  socket.on('join-trade', async ({ tradeId }) => {
    // Verify user is participant of this trade
    // Verify trade is in 'accepted' state
    // Verify user subscription allows P2P (check trade count)
    socket.join(`trade:${tradeId}`);
    socket.to(`trade:${tradeId}`).emit('peer-joined', { peerId: socket.userId });
  });

  socket.on('offer', ({ tradeId, sdp }) => {
    socket.to(`trade:${tradeId}`).emit('offer', { sdp });
  });

  socket.on('answer', ({ tradeId, sdp }) => {
    socket.to(`trade:${tradeId}`).emit('answer', { sdp });
  });

  socket.on('ice-candidate', ({ tradeId, candidate }) => {
    socket.to(`trade:${tradeId}`).emit('ice-candidate', { candidate });
  });
});
```

### STUN/TURN Strategy

**Use a managed TURN service. Do not self-host coturn.**

Rationale for solo developer:
- Self-hosted coturn requires: server provisioning, TLS cert management, UDP/TCP port management, security patching, DDoS mitigation, monitoring, capacity planning.
- Managed services handle all of this for $0.40-$0.60/GB (Twilio) or ~$99/mo flat (Metered.ca).
- At launch with low traffic, costs are minimal. STUN (free, via Google's public servers) resolves ~80% of connections. TURN only activates for symmetric NATs (~15-20% of connections).

**Recommended setup:**

```typescript
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },           // Free STUN
  { urls: 'stun:stun1.l.google.com:19302' },          // Free STUN backup
  {
    urls: 'turn:turn.metered.ca:443?transport=tcp',    // Managed TURN
    username: process.env.TURN_USERNAME,                // Time-limited credentials
    credential: process.env.TURN_CREDENTIAL,           // rotated server-side
  },
];
```

**TURN credential security:** Generate time-limited TURN credentials server-side using HMAC-based authentication. Client requests credentials from API before initiating WebRTC. Credentials expire after the trade session. This prevents abuse of TURN bandwidth.

### Client-Side WebRTC Implementation

**Use `simple-peer` over PeerJS.**

Rationale:
- simple-peer: ~25KB, minimal abstraction over RTCPeerConnection. You provide your own signaling (which you already have with Socket.IO). ~400K weekly npm downloads. Well-suited for 1:1 file transfer.
- PeerJS: Bundles its own signaling server (PeerServer). Since VinylDig already has signaling via Socket.IO, PeerJS's bundled signaling is redundant complexity. PeerJS is better for prototypes where you want zero-config signaling.

**File transfer implementation (client-side):**

```typescript
// Sender side (conceptual)
const CHUNK_SIZE = 64 * 1024; // 64KB chunks

async function sendFile(peer: SimplePeer, file: File) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // Send metadata first
  peer.send(JSON.stringify({
    type: 'file-meta',
    name: file.name,
    size: file.size,
    totalChunks
  }));

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const chunk = file.slice(start, start + CHUNK_SIZE);
    const buffer = await chunk.arrayBuffer();

    // Backpressure: wait if buffer is full
    while (peer._channel.bufferedAmount > CHUNK_SIZE * 4) {
      await new Promise(resolve => {
        peer._channel.onbufferedamountlow = resolve;
        peer._channel.bufferedAmountLowThreshold = CHUNK_SIZE * 2;
      });
    }

    peer.send(new Uint8Array(buffer));
    onProgress(i / totalChunks); // Update progress bar
  }

  peer.send(JSON.stringify({ type: 'file-complete' }));
}
```

## Database Schema Considerations

### Core Tables

```sql
-- Users and authentication
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  discogs_username VARCHAR(100),
  discogs_oauth_token TEXT,          -- Encrypted at rest
  discogs_oauth_secret TEXT,         -- Encrypted at rest
  avatar_url TEXT,
  bio TEXT,
  subscription_tier VARCHAR(20) DEFAULT 'free', -- 'free' | 'premium'
  subscription_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Releases (cached from Discogs, source of truth for display)
CREATE TABLE releases (
  id BIGINT PRIMARY KEY,             -- Discogs release ID (their primary key)
  title VARCHAR(500) NOT NULL,
  artist VARCHAR(500),
  year SMALLINT,
  genres TEXT[],                      -- PostgreSQL array
  styles TEXT[],                      -- PostgreSQL array
  thumb_url TEXT,
  discogs_url TEXT,
  have_count INT DEFAULT 0,          -- From Discogs (refreshed periodically)
  want_count INT DEFAULT 0,          -- From Discogs (refreshed periodically)
  rarity_score NUMERIC(10,4),        -- Computed: want_count / NULLIF(have_count, 0)
  data JSONB,                        -- Full Discogs metadata (flexible storage)
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_releases_rarity ON releases (rarity_score DESC);
CREATE INDEX idx_releases_genres ON releases USING GIN (genres);

-- User collections (junction table)
CREATE TABLE user_collections (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  release_id BIGINT REFERENCES releases(id),
  date_added TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  condition VARCHAR(20),             -- Mint, NM, VG+, etc.
  PRIMARY KEY (user_id, release_id)
);
CREATE INDEX idx_user_collections_release ON user_collections (release_id);

-- User wantlists (junction table)
CREATE TABLE user_wantlists (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  release_id BIGINT REFERENCES releases(id),
  date_added TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  priority SMALLINT DEFAULT 3,       -- 1=highest, 5=lowest
  PRIMARY KEY (user_id, release_id)
);
CREATE INDEX idx_user_wantlists_release ON user_wantlists (release_id);

-- Social graph
CREATE TABLE follows (
  follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id)
);
CREATE INDEX idx_follows_following ON follows (following_id);

-- Activity events (immutable log)
CREATE TABLE activities (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,         -- 'collection_add', 'trade_complete',
                                      -- 'review_written', 'badge_earned', etc.
  data JSONB NOT NULL,               -- Flexible payload per activity type
  release_id BIGINT REFERENCES releases(id), -- Optional, for release-related activities
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_activities_user_time ON activities (user_id, created_at DESC);
CREATE INDEX idx_activities_time ON activities (created_at DESC);

-- Trades
CREATE TABLE trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  initiator_id UUID REFERENCES users(id),
  recipient_id UUID REFERENCES users(id),
  release_id BIGINT REFERENCES releases(id),
  status VARCHAR(20) DEFAULT 'pending',  -- pending, accepted, active, completed, cancelled
  initiator_review JSONB,            -- { quality: 1-5, comment: "..." }
  recipient_review JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX idx_trades_users ON trades (initiator_id, recipient_id);
CREATE INDEX idx_trades_status ON trades (status) WHERE status IN ('pending', 'active');

-- Reviews (for releases/pressings)
CREATE TABLE reviews (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  release_id BIGINT REFERENCES releases(id),
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  content TEXT,
  pressing_notes TEXT,               -- Specific to vinyl pressing quality
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, release_id)
);

-- Notifications (persistent store)
CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,         -- 'wantlist_match', 'trade_request', 'badge_earned'
  data JSONB NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, created_at DESC) WHERE read = FALSE;

-- Badges (definition table)
CREATE TABLE badges (
  id SERIAL PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url TEXT,
  criteria JSONB                     -- Machine-readable unlock criteria
);

-- User badges (junction)
CREATE TABLE user_badges (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  badge_id INT REFERENCES badges(id),
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);
```

### Schema Design Rationale

**Why PostgreSQL over MongoDB/NoSQL:**
- Collections and wantlists are inherently relational (user HAS many releases, release IN many collections). Junction tables with foreign keys enforce data integrity.
- Wantlist matching is a JOIN operation across two junction tables. This is what relational databases are built for.
- PostgreSQL JSONB gives NoSQL flexibility where needed (release metadata, activity payloads, badge criteria) without sacrificing relational integrity.
- PostgreSQL GIN indexes on arrays enable efficient genre-based queries.
- Solo developer: one database technology to learn, operate, and backup. PostgreSQL handles all data patterns in this application.

**Why releases use Discogs IDs as primary keys:**
- Discogs release IDs are globally unique integers. Using them directly avoids a mapping table and simplifies the import pipeline.
- When two users import the same release, it resolves to the same row. Collection/wantlist matching becomes a simple integer comparison.

**Why JSONB `data` column on releases:**
- Discogs release metadata is rich and variable (tracklist, labels, formats, credits). Modeling all of this in columns would create dozens of rarely-queried columns.
- Store the full Discogs response in JSONB. Query it when needed. Index specific JSONB paths if query patterns emerge.

**Why activities use JSONB `data`:**
- Each activity type has different payload requirements. A `collection_add` includes release info, a `trade_complete` includes both users and quality ratings, a `badge_earned` includes the badge details.
- JSONB avoids a polymorphic table structure or multiple nullable columns.

## Freemium Gating Architecture

### Implementation Pattern: Middleware + Entitlements Table

Feature gating lives in middleware, not in business logic. Features stay pure; billing logic is centralized.

```typescript
// Entitlements definition (config, not database)
const TIER_LIMITS = {
  free: {
    trades_per_month: 3,
    imports_per_day: 1,
    collection_analytics: false,
    priority_matching: false,
    exclusive_groups: false,
  },
  premium: {
    trades_per_month: Infinity,
    imports_per_day: Infinity,
    collection_analytics: true,
    priority_matching: true,
    exclusive_groups: true,
  },
};

// Middleware (applied to routes that need gating)
async function requireEntitlement(entitlement: string) {
  return async (req, res, next) => {
    const user = req.user;
    const limits = TIER_LIMITS[user.subscription_tier];

    if (entitlement === 'trade') {
      const monthlyCount = await getTradeCountThisMonth(user.id);
      if (monthlyCount >= limits.trades_per_month) {
        return res.status(403).json({
          error: 'trade_limit_reached',
          limit: limits.trades_per_month,
          upgrade_url: '/pricing',
        });
      }
    }

    next();
  };
}

// Route usage
app.post('/api/trades/initiate',
  requireAuth,
  requireEntitlement('trade'),
  tradeController.initiate
);
```

### Gating Points

| Feature | Free | Premium | Gate Location |
|---------|------|---------|---------------|
| P2P trades | 3/month | Unlimited | API middleware on trade initiation |
| Discogs imports | 1/day | Unlimited | API middleware on import trigger |
| Collection analytics | Hidden | Visible | Frontend conditional render + API guard |
| Priority wantlist matching | Standard queue | Priority queue | BullMQ job priority setting |
| Exclusive groups | Cannot join | Can join | API middleware on group join |

### Key Principle: Gate at Workflow Start

Do not let a free user start a trade and then block them mid-transfer. Check entitlements when the user initiates the action. Show upgrade prompts before the gate, not after hitting it. Display remaining quota ("2 of 3 trades used this month") to create natural upgrade pressure.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1K users | Monolith on a single VPS (4GB RAM). PostgreSQL + Redis on same machine. BullMQ workers in-process. Managed TURN service. This handles everything comfortably. |
| 1K-10K users | Separate PostgreSQL to a managed database (e.g., Supabase, Neon, or managed Postgres). Add read replicas if feed queries slow down. Move BullMQ workers to a separate process. Consider CDN for static assets. |
| 10K-100K users | Separate Redis to managed instance. Add connection pooling (PgBouncer). Introduce feed caching (Redis-backed materialized feeds). Consider horizontal scaling of API server behind a load balancer (Socket.IO with Redis adapter for sticky sessions). |
| 100K+ users | Re-evaluate. This is a good problem to have. Consider extracting the import pipeline and ranking service into separate services. Shard leaderboards by genre/region. This scale is far from day-one concerns. |

### Scaling Priorities (What Breaks First)

1. **Discogs import pipeline:** First bottleneck. Shared rate limit across all users. At 100+ users importing simultaneously, the queue grows. Mitigation: per-user import cooldown, batch scheduling, potentially multiple Discogs API keys (if ToS allows).

2. **Activity feed reads:** Second bottleneck. Fan-out-on-read joins slow as follow graphs grow. Mitigation: cursor-based pagination (already recommended), Redis-cached hot feeds.

3. **WebRTC signaling:** Unlikely bottleneck. Signaling messages are small and infrequent (handful per trade session). Socket.IO handles thousands of concurrent connections on a single Node.js process.

4. **TURN bandwidth costs:** As P2P usage grows, TURN relay costs increase. Mitigation: monitor TURN usage metrics, ensure STUN resolves most connections, set bandwidth quotas per user.

## Anti-Patterns

### Anti-Pattern 1: Storing Files on Server "Temporarily"

**What people do:** Cache transferred files on the server for "reliability" or "resume support."
**Why it is wrong:** Destroys the legal "mere conduit" defense. Even temporary storage creates liability. Also creates storage costs, security surface, and DMCA exposure.
**Do this instead:** Files exist only in browser memory during transfer. If transfer fails, users reinitiate. The WebRTC DataChannel is reliable (ordered, retransmitted). For resume support, implement chunk acknowledgment at the application layer -- the sender tracks which chunks were ACKed and resumes from the last ACKed chunk on reconnection.

### Anti-Pattern 2: Synchronous Discogs API Calls in Request Handlers

**What people do:** User clicks "Import" and the server makes 50+ Discogs API calls within the HTTP request, returning the result when done.
**Why it is wrong:** Request times out (30-60 seconds). Blocks the Node.js event loop. Hits rate limits. Poor UX (no progress feedback). If the connection drops, the entire import is lost.
**Do this instead:** Queue-driven pipeline (Pattern 2 above). Return 202 immediately. Process asynchronously. Stream progress via SSE/WebSocket.

### Anti-Pattern 3: Realtime Score Recalculation from Scratch

**What people do:** Every time any user's score changes, recalculate scores for all users from scratch.
**Why it is wrong:** O(users * collection_size) computation on every action. At 10K users with average 500 records each, this is 5 million rows to scan per score-affecting action.
**Do this instead:** Incremental updates (Pattern 4). Compute only the delta. Full recalc runs nightly as a background job to correct drift.

### Anti-Pattern 4: Self-Hosting STUN/TURN as a Solo Developer

**What people do:** Deploy coturn on a VPS to save money.
**Why it is wrong:** Operational burden is enormous: firewall rules for UDP ranges, TLS certificate rotation, DDoS protection, monitoring, OS patching, capacity planning. One misconfiguration and WebRTC connections silently fail (hard to debug). Cost savings are minimal at low scale ($5-20/month for managed vs. $150+/month for a capable self-hosted instance).
**Do this instead:** Use Google's free STUN servers + Metered.ca or Twilio for TURN. Budget $0-100/month at launch. Self-host only if monthly TURN bandwidth exceeds $500+.

### Anti-Pattern 5: Premature Microservices

**What people do:** Create separate services for auth, collections, trading, notifications, rankings from day one.
**Why it is wrong:** Solo developer now maintains 5+ deployment pipelines, inter-service communication, service discovery, distributed tracing, and eventual consistency problems. Productivity drops to near zero.
**Do this instead:** Modular monolith. Clean module boundaries within a single process. Extract services only when a specific scaling bottleneck demands it (and you have evidence, not speculation).

## Integration Points

### External Services

| Service | Integration Pattern | Gotchas |
|---------|---------------------|---------|
| **Discogs API** | OAuth 1.0a, rate-limited queue via BullMQ, paginated collection fetch (100/page) | 60 req/min authenticated. OAuth 1.0a (not 2.0). Some endpoints return sparse data -- need additional per-release fetches for full metadata. Large collections (20K+) take minutes to import. |
| **STUN (Google)** | Static ICE server config, no auth needed | Free, no SLA. Occasionally slow. Include multiple STUN servers for redundancy. |
| **TURN (Metered/Twilio)** | Time-limited HMAC credentials generated server-side, credential API endpoint | Costs per GB relayed. Monitor usage. Rotate credentials per session. |
| **Payment processor (Stripe)** | Stripe Checkout for subscription, webhooks for status changes | Webhook signature verification critical. Handle failed payments gracefully (grace period before downgrade). |
| **Email (optional)** | Transactional email for auth, digest notifications | Defer email until after core features work. Use SendGrid/Resend free tier. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| API routes <-> Services | Direct function calls | Services are imported, not called over network. Type-safe interfaces. |
| Services <-> Database | Query builder (Kysely or Drizzle) | No raw SQL strings in services. Migrations managed separately. |
| Services <-> BullMQ | Job creation via queue.add() | Services create jobs; workers process them. Shared job type definitions in `packages/shared`. |
| API <-> WebSocket | Shared Socket.IO instance | Same HTTP server, different namespaces. Auth middleware shared. |
| Frontend <-> Backend | REST API + SSE/WebSocket | REST for CRUD, WebSocket for signaling, SSE for notifications and live updates. |
| Frontend <-> WebRTC | simple-peer library | Wrapper hook (`useWebRTC`) encapsulates connection lifecycle, chunking, progress. |

## Suggested Build Order

Based on architectural dependencies, the following build order minimizes blocked work and delivers value incrementally:

### Phase 1: Foundation (No External Dependencies)
- Database schema + migrations
- User authentication (register, login, sessions)
- Core API scaffolding
- Basic frontend shell with retro/analog design system

**Rationale:** Everything else depends on auth and data storage.

### Phase 2: Discogs Integration
- Discogs OAuth 1.0a flow
- BullMQ setup + import pipeline
- Collection and wantlist import
- Release data caching in PostgreSQL

**Rationale:** The entire product value proposition starts with "import your Discogs library." This is the cold-start hook and must work reliably before anything else.

### Phase 3: Social Layer
- User profiles with collection display
- Follow system
- Activity feed (fan-out on read)
- Collection search across all users
- Collection comparison

**Rationale:** Once data exists (from Phase 2), the social layer makes it visible and discoverable. Activity feed and follows create the social loop.

### Phase 4: Wantlist Matching + Notifications
- Wantlist matching engine (BullMQ job)
- Notification system (database + SSE/WebSocket delivery)
- Real-time "someone has your want" alerts

**Rationale:** Depends on Phase 2 (wantlists must be imported) and Phase 3 (user profiles must exist for "who has it"). This is the core "magic moment" -- the reason users return.

### Phase 5: P2P Trading
- WebRTC signaling server (Socket.IO namespace)
- simple-peer integration + file chunking
- STUN/TURN configuration
- Trade flow (initiate, accept, transfer, review)
- Post-trade quality reviews

**Rationale:** Depends on Phase 3 (discovery of who has what) and Phase 4 (matching drives trade initiation). This is the most technically complex feature and should be built on a solid foundation.

### Phase 6: Gamification
- Rarity score computation
- Redis leaderboards
- Badges and achievements
- Ranking display on profiles
- Nightly recalculation job

**Rationale:** Depends on Phase 2 (collection data for rarity), Phase 5 (trade data for contribution scores). Gamification is a retention layer that amplifies existing behaviors -- it must come after the behaviors exist.

### Phase 7: Monetization + Hardening
- Freemium gating middleware
- Stripe integration for premium subscriptions
- Security hardening (OWASP Top 10)
- Penetration testing
- Rate limiting on all public endpoints

**Rationale:** Gating requires all gated features to exist first. Security hardening is a pass over the entire system, best done when the system is feature-complete.

## Sources

- [MDN WebRTC Signaling and Video Calling](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Signaling_and_video_calling)
- [MDN WebRTC Protocols (STUN/TURN/ICE)](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols)
- [WebRTC.ventures: Self-Hosted STUN/TURN Servers](https://webrtc.ventures/2025/01/how-to-set-up-self-hosted-stun-turn-servers-for-webrtc-applications/)
- [VideoSDK: TURN Server Guide 2025](https://www.videosdk.live/developer-hub/webrtc/turn-server-for-webrtc)
- [TURN Server Costs Guide](https://dev.to/alakkadshaw/turn-server-costs-a-complete-guide-1c4b)
- [PkgPulse: simple-peer vs PeerJS vs mediasoup 2026](https://www.pkgpulse.com/blog/simple-peer-vs-peerjs-vs-mediasoup-webrtc-libraries-nodejs-2026)
- [web.dev: WebRTC Data Channels](https://web.dev/articles/webrtc-datachannels)
- [Mozilla: Large Data Channel Messages](https://blog.mozilla.org/webrtc/large-data-channel-messages/)
- [MDN: RTCDataChannel bufferedAmount](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/bufferedAmount)
- [Discogs API Documentation](https://www.discogs.com/developers)
- [Discogs Forum: API Rate Limits](https://www.discogs.com/forum/thread/1104957)
- [Redis Leaderboards Solution](https://redis.io/solutions/leaderboards/)
- [SystemDesign.one: Leaderboard System Design](https://systemdesign.one/leaderboard-system-design/)
- [OneUpTime: Gaming Leaderboards with Redis Sorted Sets](https://oneuptime.com/blog/post/2026-01-27-gaming-leaderboards-redis-sorted-sets/view)
- [BullMQ Rate Limiting Documentation](https://docs.bullmq.io/guide/rate-limiting)
- [BullMQ Rate Limit Recipes](https://blog.taskforce.sh/rate-limit-recipes-in-nodejs-using-bullmq/)
- [GetStream: Scalable Activity Feed Architecture](https://getstream.io/blog/scalable-activity-feed-architecture/)
- [Java Tech Online: Social Media Feed System Design](https://javatechonline.com/social-media-feed-system-design/)
- [MDN: Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events)
- [Shopify Engineering: SSE for Data Streaming](https://shopify.engineering/server-sent-events-data-streaming)
- [DEV Community: Feature Gating for Freemium SaaS](https://dev.to/aniefon_umanah_ac5f21311c/feature-gating-how-we-built-a-freemium-saas-without-duplicating-components-1lo6)
- [Ably: Socket.IO vs WebSocket](https://ably.com/topic/socketio-vs-websocket)
- [RFC 8831: WebRTC Data Channels](https://datatracker.ietf.org/doc/html/rfc8831)
- [LogRocket: WebRTC Signaling with WebSocket and Node.js](https://blog.logrocket.com/webrtc-signaling-websocket-node-js/)

---
*Architecture research for: VinylDig -- vinyl digger social network*
*Researched: 2026-03-25*
