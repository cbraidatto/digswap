# Phase 9: P2P Audio Trading - Research

**Researched:** 2026-03-27
**Domain:** WebRTC peer-to-peer file transfer, audio analysis, trade lifecycle, DMCA compliance gating
**Confidence:** HIGH

## Summary

Phase 9 delivers browser-to-browser audio file trading via WebRTC, gated behind DMCA compliance infrastructure and per-user ToS acceptance. The core technical challenge is a multi-state trade lifecycle (request, accept, live lobby, WebRTC connection, chunked file transfer, review) that requires coordinating Supabase Realtime for lobby state with PeerJS for peer-to-peer data channels -- two independent real-time systems with different failure modes.

The existing codebase provides strong foundations: the `tradeRequests` and `tradeReviews` tables are already defined with RLS policies, three UI stubs exist at `/trades/new`, `/trades/[id]/review`, and `/trades/[id]/complete` matching the Ghost Protocol aesthetic, and the gamification system (`awardBadge`, `CONTRIBUTION_POINTS.trade_completed = 15`, `CONNECTOR` badge) is ready to wire up. The notification infrastructure from Phase 6 already supports `trade_request` and `trade_completed` notification types with both in-app and email channels.

**Primary recommendation:** Build the trade lifecycle server actions and database migrations first (schema additions, status transitions, trade counter enforcement), then layer the WebRTC connection logic on top as a client-side module, keeping the PeerJS/DataChannel code isolated in a custom React hook (`usePeerConnection`) that the lobby component consumes. This separation ensures the complex WebRTC state machine is testable independently of the trade lifecycle.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Two-layer compliance gate: admin flag (P2P_ENABLED env var) + per-user ToS modal gate
- D-02: `trades_tos_accepted_at` column on `profiles` table via migration
- D-03: Admin flag check happens server-side (middleware or server component)
- D-04: Three entry points: public profile "Request Audio", explorar "Request Trade", wantlist match notification CTA
- D-05: All entry points navigate to `/trades/new?to=[userId]&release=[releaseId]`
- D-06: "Request Audio" only shown when P2P_ENABLED is true and viewer is not profile owner
- D-07: PeerJS Cloud (peerjs.com) for signaling -- zero ops
- D-08: Metered.ca managed TURN from day one
- D-09: TURN credentials fetched via server action, not hardcoded client-side
- D-10: 64KB chunk size via PeerJS DataChannel, protocol: `{ type: 'chunk', index, total, data }` + `{ type: 'done' }`
- D-11: Async request model -- recipient can be offline when request is sent
- D-12: Trade lifecycle: pending -> accepted -> transferring -> completed (plus declined/cancelled/expired branches)
- D-13: Lobby state machine: WAITING -> CONNECTING -> TRANSFERRING -> COMPLETE -> FAILED
- D-14: Both users must be online simultaneously enforced by PeerJS connection
- D-15: `/trades` inbox with PENDING / ACTIVE / COMPLETED tabs
- D-16: `/trades` accessible via notification bell, profile page, direct URL
- D-17: Trade row format: `[STATUS] . COUNTERPARTY . RECORD_TITLE . DATE . RATING`
- D-18: `subscriptions.tradesThisMonth` incremented on trade completion via server action
- D-19: Free users blocked at 5 trades/month with upgrade CTA
- D-20: `tradesMonthReset` timestamp for counter reset (pg_cron or check-on-read)
- D-21: Web Audio API (AnalyserNode -> FFT -> canvas) for spectrum analysis, client-side only
- D-22: Free users get 1 spectrum analysis per trade; premium unlimited
- D-23: Trade reputation on profile: `TRADES: N . AVG: N.N star`
- D-24: CONNECTOR badge awarded on first completed trade via `awardBadge(userId, 'connector')`

### Claude's Discretion
- Visual treatment for P2P_DISABLED compliance notice (terminal error-style banner consistent with Ghost Protocol)
- Expiry window for pending trade requests (proposed: 48h)
- Whether P2P_ENABLED is read from env var or Supabase config table (env var preferred for simplicity)
- pg_cron vs check-on-read for monthly trade counter reset
- Exact ToS copy (placeholder draft acceptable, legal review before launch)

### Deferred Ideas (OUT OF SCOPE)
- Stripe subscription / premium upgrade UI -- Phase 10
- Browser push notifications (NOTF-03) -- deferred per REQUIREMENTS.md
- Real-time "currently online" indicator -- DISC2-V2-01 (v2)
- Scheduled trade requests -- DISC2-V2-02 (v2)
- Direct messaging -- SOCL-V2-01 (v2)
- Redis sorted sets for ranking -- deferred until user volume justifies
- Self-hosted TURN -- explicitly out of scope v1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| P2P-01 | User can initiate a file transfer request to another user for a specific record | Trade form wiring, three entry points (D-04/D-05), `tradeRequests` table with schema additions for file metadata, expiry |
| P2P-02 | File transfers occur directly browser-to-browser via WebRTC DataChannel -- no file touches the server | PeerJS 1.5.5 with DataChannel, Metered.ca TURN relay, chunk protocol (D-10), usePeerConnection hook pattern |
| P2P-03 | File transfer uses chunked transfer with progress indicator and resume on disconnect | 64KB chunks, `bufferedAmountLowThreshold` flow control, chunk index tracking for resume, TransferProgress component |
| P2P-04 | Both users must be online simultaneously for transfer to occur | PeerJS connection enforcement (D-14), Supabase Realtime lobby presence, state machine (D-13) |
| P2P-05 | After transfer, recipient can rate the audio file quality (1-5 stars + comment) | `tradeReviews` table already defined, TradeRatingForm wiring on `/trades/[id]/complete` stub |
| P2P-06 | Sharer's reputation score updated based on quality reviews | Computed from `tradeReviews` avg `qualityRating` where `reviewedId = userId` |
| P2P-07 | User's trade reputation visible on public profile | Profile stat line: `TRADES: N . AVG: N.N star`, shown when tradesTotal > 0 |
| SEC-05 | DMCA agent registered and notice-and-takedown procedure operational before P2P goes live | Admin flag P2P_ENABLED (D-01), P2PDisabledBanner component, server-side enforcement (D-03) |
| SEC-06 | Terms of Service place copyright responsibility on users, accepted before first trade | ToS modal (D-01/D-02), `trades_tos_accepted_at` column, blocking acceptance flow |
| SEC-07 | WebRTC TURN relay configured by default to prevent user IP exposure | Metered.ca TURN from day one (D-08), credentials via server action (D-09), PeerJS config.iceServers |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **P2P**: WebRTC only -- no server-side file storage, ever. Non-negotiable for legal posture
- **Stack**: Next.js 15.x, React 19.1.0, TypeScript 5.x, Supabase, Drizzle ORM, Tailwind CSS 4.x, shadcn/ui
- **Framework patterns**: Server actions for all mutations, Drizzle ORM with admin client for cross-user writes, Supabase Realtime for subscriptions
- **Testing**: Vitest for unit/integration, Playwright for E2E
- **Linting**: Biome (not ESLint)
- **WebRTC stack**: PeerJS 1.5.x, PeerJS Cloud signaling, Metered.ca managed TURN
- **Avoid**: Socket.IO (use Supabase Realtime), simple-peer-files (use PeerJS), WebTorrent (overkill for 1:1)

## Standard Stack

### Core (New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| peerjs | 1.5.5 | WebRTC DataChannel abstraction | Wraps RTCPeerConnection + RTCDataChannel, built-in signaling via PeerJS Cloud, handles ICE negotiation, 13K+ GitHub stars. Locked by CLAUDE.md and CONTEXT.md D-07 |

### Already Installed (No New Install)

| Library | Version | Purpose | Phase 9 Role |
|---------|---------|---------|--------------|
| @supabase/supabase-js | 2.100.0 | Backend client | Realtime subscription for lobby state, admin client for cross-user writes |
| drizzle-orm | 0.45.1 | ORM | Schema migration for new columns, trade queries |
| zustand | 5.0.12 | Client state | WebRTC connection state, transfer progress state |
| sonner | 2.0.7 | Toast notifications | Transfer complete/error toasts |
| zod | 4.3.6 | Validation | Trade request form validation |
| resend | 6.9.4 | Transactional email | Trade request email notifications |
| react-hook-form | 7.72.0 | Forms | Trade initiation form |

### New shadcn Component

| Component | Installation |
|-----------|-------------|
| tabs | `npx shadcn@latest add tabs` |

All other shadcn components used (dialog, alert-dialog, progress, button, input, badge, skeleton, separator, card, star-rating) are already installed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PeerJS | simple-peer | Lower-level, no built-in signaling server. Requires wiring signaling from scratch. PeerJS saves significant time for a solo dev. |
| PeerJS Cloud | Self-hosted PeerJS Server | More control but requires a separate deployment (e.g., Railway). PeerJS Cloud is free and zero-ops. Acceptable for MVP. |
| Zustand (WebRTC state) | React useState | Zustand provides selector-based re-renders critical for the transfer progress bar (updating at 60Hz without re-rendering the entire lobby). |

**Installation:**
```bash
npm install peerjs
npx shadcn@latest add tabs
```

## Architecture Patterns

### Recommended Project Structure

```
src/
  actions/
    trades.ts                    # Server actions: createTrade, acceptTrade, declineTrade, completeTrade, cancelTrade, getTurnCredentials
  lib/
    trades/
      queries.ts                 # Drizzle queries: trade inbox, trade by id, trade reputation stats
      constants.ts               # Trade status enum, expiry durations, chunk size
    webrtc/
      use-peer-connection.ts     # React hook: PeerJS lifecycle, DataChannel management
      chunked-transfer.ts        # File chunking utilities: slice, reassemble, progress tracking
      turn-config.ts             # Metered.ca ICE server config fetcher
    audio/
      spectrum-analyzer.ts       # Web Audio API: AudioContext, AnalyserNode, FFT data extraction
      file-metadata.ts           # Extract audio metadata from File object (format, duration, channels)
    notifications/
      email.ts                   # Add sendTradeRequestEmail alongside existing sendWantlistMatchEmail
  app/(protected)/
    trades/
      page.tsx                   # NEW: Trade inbox page (server component)
      layout.tsx                 # NEW: Trades layout with ToS gate check
      _components/
        trade-inbox.tsx          # Client: PENDING/ACTIVE/COMPLETED tabs
        trade-row.tsx            # Client: single trade row display
        tos-modal.tsx            # Client: ToS acceptance modal
        p2p-disabled-banner.tsx  # Server: compliance notice when P2P_ENABLED=false
        trade-quota-counter.tsx  # Client: N/5 trades this month display
      new/
        page.tsx                 # MODIFY: wire up existing stub with TradeForm
        _components/
          trade-form.tsx         # Client: file upload, metadata, expiry, send
      [id]/
        page.tsx                 # NEW: Trade lobby (server + client)
        _components/
          trade-lobby.tsx        # Client: WebRTC state machine UI
          transfer-progress.tsx  # Client: chunked progress bar
        review/
          page.tsx               # MODIFY: wire up existing SPEC_CHECK stub
          _components/
            spec-analysis.tsx    # Client: Web Audio API spectrogram
            spectrogram-canvas.tsx # Client: canvas FFT rendering
        complete/
          page.tsx               # MODIFY: wire up existing stub with real data
          _components/
            trade-rating-form.tsx # Client: star rating + comment
```

### Pattern 1: WebRTC Connection Hook (usePeerConnection)

**What:** Encapsulates PeerJS lifecycle (init, connect, send chunks, receive chunks, cleanup) in a React hook.
**When to use:** Only in the TradeLobby client component.

```typescript
// src/lib/webrtc/use-peer-connection.ts
import { useEffect, useRef, useCallback, useState } from "react";
import Peer from "peerjs";
import type { DataConnection } from "peerjs";

interface PeerState {
  status: "idle" | "waiting" | "connecting" | "transferring" | "complete" | "failed";
  progress: number; // 0-100
  bytesTransferred: number;
  totalBytes: number;
  speed: number; // bytes/sec
  error: string | null;
}

export function usePeerConnection(
  tradeId: string,
  userId: string,
  role: "sender" | "receiver",
  iceServers: RTCIceServer[],
  file?: File,
) {
  // Manages Peer instance, DataConnection, chunk sending/receiving
  // Returns: state, sendFile, retry, cleanup
}
```

**Key design decisions:**
- Peer ID format: `digswap-trade-{tradeId}-{role}` -- deterministic so the other party can connect by knowing the trade ID and their counterpart's role
- The hook handles PeerJS cleanup on unmount (destroy peer, close connections)
- Transfer progress computed from `chunksReceived / totalChunks`
- Uses `bufferedAmountLowThreshold` for flow control to prevent buffer overflow on fast machines

### Pattern 2: Chunked File Transfer Protocol

**What:** Custom chunk protocol over PeerJS DataChannel.
**When to use:** Inside `usePeerConnection` hook for all file transfers.

```typescript
// src/lib/webrtc/chunked-transfer.ts
const CHUNK_SIZE = 64 * 1024; // 64KB per D-10

interface ChunkMessage {
  type: "chunk";
  index: number;
  total: number;
  data: ArrayBuffer;
}

interface DoneMessage {
  type: "done";
  fileName: string;
  fileSize: number;
  md5?: string;
}

// Sender: slice file into chunks, send with flow control
export async function sendFileChunked(
  conn: DataConnection,
  file: File,
  onProgress: (sent: number, total: number) => void,
): Promise<void> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const slice = file.slice(start, end);
    const buffer = await slice.arrayBuffer();

    conn.send({ type: "chunk", index: i, total: totalChunks, data: buffer });
    onProgress(end, file.size);

    // Flow control: wait if buffer is full
    // PeerJS wraps the underlying RTCDataChannel
    // Check bufferedAmount and wait for drain if needed
  }

  conn.send({ type: "done", fileName: file.name, fileSize: file.size });
}

// Receiver: collect chunks, reassemble, trigger download
export function receiveFileChunked(
  conn: DataConnection,
  onProgress: (received: number, total: number) => void,
  onComplete: (file: Blob, fileName: string) => void,
): void {
  const chunks: ArrayBuffer[] = [];
  let fileName = "";

  conn.on("data", (data: ChunkMessage | DoneMessage) => {
    if (data.type === "chunk") {
      chunks[data.index] = data.data;
      onProgress(chunks.filter(Boolean).length, data.total);
    } else if (data.type === "done") {
      fileName = data.fileName;
      const blob = new Blob(chunks, { type: "application/octet-stream" });
      onComplete(blob, fileName);
    }
  });
}
```

### Pattern 3: TURN Credential Fetch (Server Action)

**What:** Server action that calls Metered.ca REST API and returns ICE servers for PeerJS config.
**When to use:** Called from the lobby page before PeerJS initialization (D-09).

```typescript
// In src/actions/trades.ts
"use server";

export async function getTurnCredentials(): Promise<RTCIceServer[]> {
  const apiKey = process.env.METERED_API_KEY;
  const appName = process.env.METERED_APP_NAME;

  if (!apiKey || !appName) {
    // Fallback to STUN-only (development)
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }

  const response = await fetch(
    `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
  );

  if (!response.ok) {
    throw new Error("Failed to fetch TURN credentials");
  }

  return response.json();
}
```

### Pattern 4: Supabase Realtime Lobby Presence

**What:** Subscribe to trade request row changes to detect when counterpart joins lobby.
**When to use:** In TradeLobby component to transition from WAITING to CONNECTING.

```typescript
// Pattern matches existing NotificationBell Realtime subscription
const supabase = createClient();
const channel = supabase
  .channel(`trade-lobby-${tradeId}`)
  .on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "trade_requests",
      filter: `id=eq.${tradeId}`,
    },
    (payload) => {
      const newStatus = payload.new.status;
      // Transition lobby state based on DB status changes
    },
  )
  .subscribe();
```

### Pattern 5: Web Audio API Spectrum Analysis

**What:** Analyze received audio file and render FFT spectrogram on canvas.
**When to use:** On the review page (`/trades/[id]/review`) after file receipt.

```typescript
// src/lib/audio/spectrum-analyzer.ts
export async function analyzeAudioFile(file: Blob): Promise<{
  format: string;
  duration: number;
  channels: number;
  sampleRate: number;
}> {
  const audioContext = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  return {
    format: file.type || "unknown",
    duration: audioBuffer.duration,
    channels: audioBuffer.numberOfChannels,
    sampleRate: audioBuffer.sampleRate,
  };
}

// For spectrogram rendering:
// 1. Create AudioContext + AnalyserNode (fftSize: 2048)
// 2. Create MediaElementSource from <audio> element
// 3. Connect source -> analyser -> destination
// 4. requestAnimationFrame loop: getByteFrequencyData -> draw to canvas
// 5. Color gradient from --surface-container-lowest to --primary
```

### Pattern 6: Check-on-Read Trade Counter Reset

**Recommendation for Claude's discretion:** Use check-on-read rather than pg_cron.

**Rationale:** pg_cron requires Supabase Pro plan ($25/mo) and adds infrastructure complexity. Check-on-read is simpler -- when reading `tradesThisMonth`, compare `tradesMonthReset` to current date. If a full calendar month has passed, reset to 0 and update `tradesMonthReset`. This is a single conditional in the server action, requires no cron setup, and is guaranteed consistent (no race between cron and read).

```typescript
// In trade initiation server action:
async function getTradesRemaining(userId: string): Promise<number> {
  const admin = createAdminClient();
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan, trades_this_month, trades_month_reset")
    .eq("user_id", userId)
    .single();

  if (!sub || sub.plan !== "free") return Infinity;

  const now = new Date();
  const resetDate = sub.trades_month_reset ? new Date(sub.trades_month_reset) : null;

  // Reset if month has rolled over
  if (!resetDate || now.getMonth() !== resetDate.getMonth() || now.getFullYear() !== resetDate.getFullYear()) {
    await admin
      .from("subscriptions")
      .update({ trades_this_month: 0, trades_month_reset: now.toISOString() })
      .eq("user_id", userId);
    return 5;
  }

  return Math.max(0, 5 - sub.trades_this_month);
}
```

### Anti-Patterns to Avoid

- **Storing file data on server:** Non-negotiable constraint. No Supabase Storage, no API route buffers, no temporary server-side file handling. Files go directly browser-to-browser via DataChannel.
- **Hardcoding TURN credentials client-side:** TURN API key must stay server-side (D-09). Fetch via server action, pass to PeerJS config in the client.
- **Using PeerJS built-in chunking for large files:** PeerJS reads the entire file into memory before chunking. Manual chunking with `File.slice()` is required for files >100MB to avoid memory exhaustion.
- **Polling for lobby state:** Use Supabase Realtime subscription (postgres_changes), not `setInterval` polling. Consistent with NotificationBell pattern from Phase 6.
- **Mixing server and client state for WebRTC:** WebRTC state lives entirely client-side in Zustand/hook state. The database only tracks the trade lifecycle status (pending/accepted/transferring/completed), not PeerJS connection state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebRTC signaling | Custom WebSocket signaling server | PeerJS Cloud (free, managed) | Signaling requires NAT traversal, keep-alive, reconnection logic. PeerJS Cloud handles all of this. |
| NAT traversal / TURN relay | coturn self-hosted | Metered.ca managed TURN | Self-hosting TURN requires VPS, SSL certs, monitoring, bandwidth management. Metered.ca free tier (500MB/mo) is sufficient for MVP. |
| ICE server configuration | Hardcoded STUN list | Metered.ca REST API dynamic credentials | Credentials can expire and rotate. The API returns geo-optimized servers nearest to user. |
| File chunking protocol | From scratch on RTCDataChannel | PeerJS DataChannel + manual File.slice | PeerJS provides the reliable ordered channel; just slice the file and send chunks with metadata envelope. |
| Audio format detection | Custom file header parsing | Web Audio API `decodeAudioData` | AudioContext.decodeAudioData handles FLAC, WAV, MP3, OGG, AAC natively in all modern browsers. |
| Spectrogram visualization | Third-party charting library | AnalyserNode + canvas 2D | ~30 lines of code with requestAnimationFrame. No library dependency needed. Built-in browser API. |
| Real-time lobby sync | Socket.IO / custom WebSocket | Supabase Realtime (postgres_changes) | Already in the stack, same pattern as NotificationBell. No additional server. |
| Star rating component | Custom star rating | shadcn star-rating (already installed) | `src/components/ui/star-rating.tsx` already exists from prior phases. |

## Common Pitfalls

### Pitfall 1: PeerJS Connection Failures Without TURN

**What goes wrong:** 15-20% of WebRTC connections fail behind symmetric NATs and corporate firewalls when using STUN-only. Users report "CONNECTION_FAILED" with no clear error.
**Why it happens:** STUN servers can only assist with simple NAT traversal. Symmetric NATs (common on mobile carriers, enterprise networks) require a TURN relay.
**How to avoid:** Metered.ca TURN is configured from day one (D-08). Always include both STUN and TURN servers in the ICE configuration. The Metered.ca API returns both.
**Warning signs:** Users reporting consistent failures from specific networks.

### Pitfall 2: Memory Exhaustion on Large File Transfers

**What goes wrong:** Sending a 500MB FLAC file causes the browser tab to crash or become unresponsive.
**Why it happens:** If you pass the entire File to PeerJS's `send()`, it reads the whole file into memory before chunking. Additionally, the receiver stores all chunks in a JS array in memory.
**How to avoid:** Use `File.slice()` to read one 64KB chunk at a time. On the receiver side, consider writing chunks to an IndexedDB or assembling them incrementally. Monitor `bufferedAmount` on the DataChannel to implement flow control -- pause sending when `bufferedAmount > 1MB`, resume on `bufferedamountlow` event.
**Warning signs:** Chrome DevTools showing memory usage climbing linearly with file size.

### Pitfall 3: PeerJS Peer ID Collisions

**What goes wrong:** If two users try to register the same peer ID on PeerJS Cloud, the second one gets an `unavailable-id` error.
**Why it happens:** PeerJS Cloud maintains a global peer ID registry. Random IDs can collide; predictable IDs can conflict if a user has two tabs open.
**How to avoid:** Use a deterministic but unique peer ID format: `digswap-{tradeId}-{userId.substring(0,8)}`. This is unique per trade per user and predictable so the counterpart can connect.
**Warning signs:** `PeerError` with type `unavailable-id` in console.

### Pitfall 4: Supabase Realtime Channel Conflicts

**What goes wrong:** Lobby Realtime subscription interferes with the existing NotificationBell subscription.
**Why it happens:** If channel names collide or too many channels are opened per client.
**How to avoid:** Use unique channel names with trade ID suffix: `trade-lobby-{tradeId}`. Clean up channels on component unmount (same pattern as NotificationBell). Supabase free tier supports 200 concurrent connections -- each lobby page opens 1 channel, well within limits.
**Warning signs:** Missing Realtime events, "channel already joined" warnings.

### Pitfall 5: Trade Status Race Conditions

**What goes wrong:** Both users try to transition the trade status simultaneously (e.g., both clicking "accept" or status update during transfer), leading to inconsistent states.
**Why it happens:** Optimistic client-side state updates without server-side guards.
**How to avoid:** All status transitions go through server actions with conditional updates: `UPDATE trade_requests SET status = 'accepted' WHERE id = $1 AND status = 'pending'`. The `WHERE` clause ensures only valid transitions succeed. Return the updated row to confirm the transition happened.
**Warning signs:** Trade stuck in wrong status, multiple status change notifications.

### Pitfall 6: Web Audio API Context Restrictions

**What goes wrong:** `AudioContext` creation fails or stays in "suspended" state on the review page.
**Why it happens:** Browsers require a user gesture (click/tap) before creating or resuming an AudioContext to prevent autoplay abuse.
**How to avoid:** Create the AudioContext inside an `onClick` handler (e.g., when user clicks "Analyze" or "Play"). Call `audioContext.resume()` if the state is "suspended". The review page already has an explicit play button and analyze action, which satisfy this requirement.
**Warning signs:** Spectrogram canvas stays blank, no audio playback.

### Pitfall 7: Missing Schema Columns on tradeRequests

**What goes wrong:** The existing `tradeRequests` table is missing columns required by D-10/D-12: `expiresAt`, `fileName`, `fileFormat`, `declaredBitrate`, `fileSizeBytes`.
**Why it happens:** The schema was created as a minimal stub in Phase 1. Phase 9 requirements add file metadata and expiry.
**How to avoid:** Migration must add these columns before any trade logic runs. Also add `transferring` and `expired` as valid status values (current schema only comments `pending/accepted/declined/completed/cancelled`).
**Warning signs:** Drizzle schema mismatch errors, null values in trade rows.

## Code Examples

### PeerJS Initialization with Metered.ca TURN

```typescript
// Source: PeerJS docs + Metered.ca REST API docs
// https://peerjs.com/docs/
// https://www.metered.ca/docs/turn-rest-api/get-credential/

import Peer from "peerjs";

// Server action (src/actions/trades.ts)
export async function getTurnCredentials(): Promise<RTCIceServer[]> {
  const apiKey = process.env.METERED_API_KEY;
  const appName = process.env.METERED_APP_NAME;

  if (!apiKey || !appName) {
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }

  const res = await fetch(
    `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`,
  );
  if (!res.ok) throw new Error("TURN credential fetch failed");
  return res.json();
}

// Client usage (inside usePeerConnection hook)
const iceServers = await getTurnCredentials(); // server action call
const peer = new Peer(`digswap-${tradeId}-${userId.substring(0, 8)}`, {
  config: { iceServers },
  debug: 0, // Disable PeerJS debug logging in production
});

peer.on("open", (id) => {
  // Peer registered with PeerJS Cloud, ready to connect
});

peer.on("error", (err) => {
  if (err.type === "unavailable-id") {
    // Handle peer ID collision
  }
});
```

### Metered.ca API Response Format

```json
[
  { "urls": "stun:global.relay.metered.ca:80" },
  {
    "urls": "turn:global.relay.metered.ca:80",
    "username": "<dynamic-username>",
    "credential": "<dynamic-password>"
  },
  {
    "urls": "turn:global.relay.metered.ca:80?transport=tcp",
    "username": "<dynamic-username>",
    "credential": "<dynamic-password>"
  },
  {
    "urls": "turn:global.relay.metered.ca:443",
    "username": "<dynamic-username>",
    "credential": "<dynamic-password>"
  }
]
```

### DataChannel Flow Control

```typescript
// Source: MDN RTCDataChannel.bufferedAmountLowThreshold
// https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/bufferedAmountLowThreshold

const BUFFER_THRESHOLD = 256 * 1024; // 256KB
const CHUNK_SIZE = 64 * 1024; // 64KB

async function sendWithFlowControl(
  conn: DataConnection,
  file: File,
  onProgress: (sent: number, total: number) => void,
): Promise<void> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const buffer = await file.slice(start, end).arrayBuffer();

    // Flow control: wait if buffer exceeds threshold
    const dc = (conn as any)._dc as RTCDataChannel;
    if (dc && dc.bufferedAmount > BUFFER_THRESHOLD) {
      await new Promise<void>((resolve) => {
        dc.bufferedAmountLowThreshold = BUFFER_THRESHOLD / 2;
        dc.onbufferedamountlow = () => resolve();
      });
    }

    conn.send({ type: "chunk", index: i, total: totalChunks, data: buffer });
    onProgress(end, file.size);
  }

  conn.send({ type: "done", fileName: file.name, fileSize: file.size });
}
```

### Web Audio Spectrogram Rendering

```typescript
// Source: MDN AnalyserNode + Canvas 2D
// https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode
// https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API

export function renderSpectrogram(
  canvas: HTMLCanvasElement,
  audioElement: HTMLAudioElement,
) {
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaElementSource(audioElement);
  const analyser = audioCtx.createAnalyser();

  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);
  analyser.connect(audioCtx.destination);

  const bufferLength = analyser.frequencyBinCount; // 1024
  const dataArray = new Uint8Array(bufferLength);
  const ctx = canvas.getContext("2d")!;

  function draw() {
    requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    // Scroll spectrogram left
    const imageData = ctx.getImageData(1, 0, canvas.width - 1, canvas.height);
    ctx.putImageData(imageData, 0, 0);

    // Draw new column on right edge
    for (let i = 0; i < bufferLength; i++) {
      const value = dataArray[i]; // 0-255
      const percent = value / 255;
      // Map to Ghost Protocol green gradient
      const r = Math.floor(111 * percent); // --primary R component
      const g = Math.floor(221 * percent); // --primary G component
      const b = Math.floor(120 * percent); // --primary B component
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      const y = canvas.height - Math.floor((i / bufferLength) * canvas.height);
      ctx.fillRect(canvas.width - 1, y, 1, 1);
    }
  }

  draw();
  return { audioCtx, analyser };
}
```

### Trade Status Transition (Server Action Pattern)

```typescript
// Follows existing server action patterns from actions/community.ts, actions/social.ts

"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/actions/social";
import { awardBadge } from "@/lib/gamification/badge-awards";
import { CONTRIBUTION_POINTS } from "@/lib/gamification/constants";

export async function acceptTrade(tradeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();

  // Conditional update: only transition from 'pending' to 'accepted'
  const { data, error } = await admin
    .from("trade_requests")
    .update({ status: "accepted", updated_at: new Date().toISOString() })
    .eq("id", tradeId)
    .eq("provider_id", user.id) // Only the recipient can accept
    .eq("status", "pending")   // Only pending trades can be accepted
    .select()
    .single();

  if (error || !data) {
    return { error: "Could not accept trade. It may have been cancelled or already accepted." };
  }

  // Notify requester
  await admin.from("notifications").insert({
    user_id: data.requester_id,
    type: "trade_request",
    title: "Trade request accepted",
    body: "Your trade request has been accepted. Join the lobby to start the transfer.",
    link: `/trades/${tradeId}`,
  });

  return { success: true, trade: data };
}

export async function completeTrade(
  tradeId: string,
  qualityRating: number,
  comment: string | null,
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const admin = createAdminClient();

  // Transition to completed
  const { data: trade, error } = await admin
    .from("trade_requests")
    .update({ status: "completed", updated_at: new Date().toISOString() })
    .eq("id", tradeId)
    .in("status", ["transferring", "accepted"]) // Valid source states
    .select()
    .single();

  if (error || !trade) {
    return { error: "Could not complete trade." };
  }

  // Determine reviewed user (the counterpart)
  const reviewedId = trade.requester_id === user.id
    ? trade.provider_id
    : trade.requester_id;

  // Insert review
  await admin.from("trade_reviews").insert({
    trade_id: tradeId,
    reviewer_id: user.id,
    reviewed_id: reviewedId,
    quality_rating: qualityRating,
    comment,
  });

  // Increment trade counter for both parties
  await admin.rpc("increment_trades_this_month", { user_id_param: trade.requester_id });
  await admin.rpc("increment_trades_this_month", { user_id_param: trade.provider_id });

  // Award CONNECTOR badge (idempotent)
  await awardBadge(user.id, "connector");
  await awardBadge(reviewedId, "connector");

  // Increment contribution scores
  // +15 for trade_completed per CONTRIBUTION_POINTS constant
  await admin.rpc("increment_contribution_score", {
    user_id_param: user.id,
    points_param: CONTRIBUTION_POINTS.trade_completed,
  });
  await admin.rpc("increment_contribution_score", {
    user_id_param: reviewedId,
    points_param: CONTRIBUTION_POINTS.trade_completed,
  });

  // Log activity
  await logActivity(user.id, "completed_trade", "trade", tradeId, {
    counterpartyId: reviewedId,
    qualityRating,
  });

  // Notification
  await admin.from("notifications").insert({
    user_id: reviewedId,
    type: "trade_completed",
    title: "Trade completed",
    body: `Your trade has been completed and rated ${qualityRating}/5 stars.`,
    link: `/trades/${tradeId}/complete`,
  });

  return { success: true };
}
```

### Schema Migration: New Columns Needed

```typescript
// The existing tradeRequests table needs these additional columns:

// On tradeRequests:
expiresAt: timestamp("expires_at", { withTimezone: true }),
fileName: varchar("file_name", { length: 255 }),
fileFormat: varchar("file_format", { length: 50 }),
declaredBitrate: varchar("declared_bitrate", { length: 50 }),
fileSizeBytes: integer("file_size_bytes"),

// On profiles:
tradesTosAcceptedAt: timestamp("trades_tos_accepted_at", { withTimezone: true }),

// Status enum needs: "transferring", "expired" added to valid values
// (varchar column, so no migration needed -- just expand application logic)
```

### P2P_ENABLED Environment Variable Check

```typescript
// Recommendation: use env var (Claude's discretion, env var preferred for simplicity)
// Read in server component or layout

export function isP2PEnabled(): boolean {
  return process.env.P2P_ENABLED === "true";
}

// In trades layout.tsx (server component):
import { isP2PEnabled } from "@/lib/trades/constants";

export default function TradesLayout({ children }) {
  if (!isP2PEnabled()) {
    return <P2PDisabledBanner />;
  }
  return <>{children}</>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PeerJS built-in serialization (JSON) | CBOR/MsgPack serialization in PeerJS 1.5 | PeerJS 1.5 (2024) | ~2x faster data serialization for binary transfers |
| Manual ICE server lists | Metered.ca REST API with geo-optimized servers | 2024-2025 | Dynamic credential rotation, automatic nearest-server selection |
| `navigator.mediaDevices.getUserMedia` for audio | `AudioContext.decodeAudioData` for file analysis | Stable since 2020 | File analysis doesn't need microphone permissions, works offline |
| Socket.IO for signaling | PeerJS Cloud free signaling | PeerJS 1.0+ | Zero-ops signaling for small-to-medium projects |

**Deprecated/outdated:**
- `webkitAudioContext` prefix: Not needed in any current browser. Use `AudioContext` directly.
- `createMediaElementSource` gotcha: The audio element must have `crossOrigin` set if loading from a different origin. For local blob URLs (our case), this is not an issue.

## Open Questions

1. **PeerJS Cloud production limits**
   - What we know: PeerJS Cloud is free, handles signaling only, no documented hard limits
   - What's unclear: Whether there are undocumented concurrent connection limits or rate limits that would affect a production app
   - Recommendation: Use PeerJS Cloud for MVP. If connection issues emerge at scale, migrate to self-hosted PeerJS Server on Railway (the `peer` npm package, version 0.2.9). The migration is a config change (set `host`, `port`, `path` in Peer constructor).

2. **Resume on disconnect (P2P-03)**
   - What we know: The chunk protocol includes index numbers, so the receiver knows which chunks arrived. PeerJS DataChannel is reliable and ordered by default.
   - What's unclear: Whether "resume" means re-establishing the PeerJS connection and continuing from the last received chunk, or starting over. WebRTC connections are ephemeral -- a new ICE negotiation is needed after disconnect.
   - Recommendation: Implement "retry from last checkpoint" -- on reconnect, the receiver sends its last received chunk index, and the sender resumes from there. This requires both users to stay on the lobby page. If either navigates away, the transfer must restart. Document this clearly as "resume on reconnect" not "background resume."

3. **Supabase RPC functions for counter increment**
   - What we know: The `completeTrade` server action needs to atomically increment `tradesThisMonth` and `contributionScore`. Supabase admin client can do `update` with raw SQL, or we need Postgres RPC functions.
   - What's unclear: Whether the project already has RPC functions defined for these operations.
   - Recommendation: Create simple Postgres functions (`increment_trades_this_month`, `increment_contribution_score`) via Drizzle migration or Supabase SQL editor. These are simple `UPDATE ... SET col = col + $1 WHERE user_id = $2` operations. Alternatively, use the admin client with a raw SQL increment: `.update({ trades_this_month: sql\`trades_this_month + 1\` })`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PeerJS Cloud (peerjs.com) | WebRTC signaling | External service | Free tier | Self-hosted PeerJS Server on Railway |
| Metered.ca TURN | NAT traversal | External service | Free: 500MB/mo | STUN-only (15-20% failure rate) |
| Web Audio API | Spectrum analysis | Browser API | All modern browsers | None needed -- native API |
| WebRTC DataChannel | File transfer | Browser API | All modern browsers | None needed -- native API |
| Supabase Realtime | Lobby sync | Already configured | Bundled | N/A -- already in use |
| Resend | Trade request email | Already configured | 6.9.4 | Silent fail (per existing pattern) |

**Missing dependencies with no fallback:**
- None. PeerJS (npm package) needs to be installed. Metered.ca requires account creation and API key in env vars.

**Missing dependencies with fallback:**
- Metered.ca TURN: In development, STUN-only works on localhost/same-network. TURN is required for production cross-network transfers.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| P2P-01 | Trade initiation creates tradeRequests row | unit | `npx vitest run tests/unit/trades/create-trade.test.ts -x` | Wave 0 |
| P2P-02 | File transfer occurs via DataChannel (no server) | manual | Manual: open two browser tabs, initiate transfer | N/A (WebRTC requires browser) |
| P2P-03 | Chunked transfer with progress tracking | unit | `npx vitest run tests/unit/trades/chunked-transfer.test.ts -x` | Wave 0 |
| P2P-04 | Both users must be online (PeerJS enforced) | manual | Manual: disconnect one user, verify transfer fails | N/A |
| P2P-05 | Recipient rates audio quality (1-5 stars + comment) | unit | `npx vitest run tests/unit/trades/trade-review.test.ts -x` | Wave 0 |
| P2P-06 | Sharer reputation updated from reviews | unit | `npx vitest run tests/unit/trades/trade-reputation.test.ts -x` | Wave 0 |
| P2P-07 | Trade reputation visible on profile | integration | `npx vitest run tests/integration/trades/profile-reputation.test.ts -x` | Wave 0 |
| SEC-05 | P2P_ENABLED gate blocks all trading when false | unit | `npx vitest run tests/unit/trades/p2p-gate.test.ts -x` | Wave 0 |
| SEC-06 | ToS acceptance required before first trade | unit | `npx vitest run tests/unit/trades/tos-gate.test.ts -x` | Wave 0 |
| SEC-07 | TURN credentials fetched server-side | unit | `npx vitest run tests/unit/trades/turn-credentials.test.ts -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/unit/trades/ --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/unit/trades/create-trade.test.ts` -- covers P2P-01 (trade creation server action)
- [ ] `tests/unit/trades/trade-review.test.ts` -- covers P2P-05, P2P-06 (review submission, reputation)
- [ ] `tests/unit/trades/trade-reputation.test.ts` -- covers P2P-06 (avg rating computation)
- [ ] `tests/unit/trades/p2p-gate.test.ts` -- covers SEC-05 (P2P_ENABLED check)
- [ ] `tests/unit/trades/tos-gate.test.ts` -- covers SEC-06 (ToS acceptance flow)
- [ ] `tests/unit/trades/turn-credentials.test.ts` -- covers SEC-07 (TURN fetch server-side)
- [ ] `tests/unit/trades/chunked-transfer.test.ts` -- covers P2P-03 (chunk/reassemble logic, testable without WebRTC)
- [ ] `tests/unit/trades/trade-counter.test.ts` -- covers freemium enforcement (5/month limit, reset logic)

Test pattern: follows existing project convention of `vi.mock()` for full module isolation (no real DB or API calls). Mock Supabase admin client chain, mock Drizzle db, mock PeerJS Peer class for unit tests.

## Sources

### Primary (HIGH confidence)
- [PeerJS Official Docs](https://peerjs.com/docs/) -- API reference, DataConnection events, Peer constructor
- [PeerJS npm](https://www.npmjs.com/package/peerjs) -- Version 1.5.5 verified via `npm view`
- [PeerJS jsDocs](https://www.jsdocs.io/package/peerjs) -- Full TypeScript interface documentation
- [PeerJS GitHub](https://github.com/peers/peerjs) -- Issue tracker, maintenance status
- [MDN AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode) -- FFT properties, getByteFrequencyData
- [MDN Web Audio Visualizations](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API) -- Spectrogram pattern
- [MDN RTCDataChannel.bufferedAmountLowThreshold](https://developer.mozilla.org/en-US/docs/Web/API/RTCDataChannel/bufferedAmountLowThreshold) -- Flow control
- [Metered.ca TURN REST API](https://www.metered.ca/docs/turn-rest-api/get-credential/) -- Credential fetch endpoint
- [Metered.ca Expiring Credentials](https://www.metered.ca/docs/turnserver-guides/expiring-turn-credentials/) -- Security pattern
- [Metered.ca Pricing](https://www.metered.ca/stun-turn) -- Free tier: 500MB/mo TURN relay
- [WebRTC File Transfer Sample](https://webrtc.github.io/samples/src/content/datachannel/filetransfer/) -- Official reference implementation

### Secondary (MEDIUM confidence)
- [PeerJS + TURN Integration Guide](https://dev.to/alakkadshaw/how-to-use-turn-server-with-peerjs-6eb) -- Metered.ca + PeerJS config pattern
- [Real-Time Spectrogram with Web Audio](https://dev.to/hexshift/real-time-audio-spectrograms-in-the-browser-using-web-audio-api-and-canvas-4b2d) -- Canvas + AnalyserNode implementation
- [React WebRTC File Transfer](https://www.fullstack.com/labs/resources/blog/creating-a-simple-file-transfer-webrtc-react-web-application) -- Buffer management, flow control
- [PeerJS Cloud Limitations Discussion](https://github.com/peers/peerjs/issues/997) -- No documented hard limits

### Tertiary (LOW confidence)
- PeerJS Cloud free tier limits: No official documentation found. Production suitability unknown at scale. Needs validation if concurrent users exceed ~100 simultaneous trades.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- PeerJS 1.5.5 verified on npm, Metered.ca API documented, Web Audio API is a stable browser standard
- Architecture: HIGH -- Patterns follow established project conventions (server actions, admin client, Supabase Realtime, Drizzle ORM)
- Pitfalls: HIGH -- WebRTC failure modes are well-documented, PeerJS issues tracked on GitHub, flow control patterns from MDN
- Schema gaps: HIGH -- Verified by reading existing `trades.ts` schema, confirmed missing columns
- PeerJS Cloud limits: LOW -- No official documentation on production limits

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (30 days -- WebRTC and Web Audio APIs are stable)
