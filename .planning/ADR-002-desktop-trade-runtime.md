---
id: ADR-002
title: Desktop Trade Runtime — Electron Architecture
date: 2026-03-31
status: accepted
deciders: [user, Claude, Codex]
supersedes: []
---

# ADR-002: Desktop Trade Runtime Architecture

## Context

Phase 14 established a full web P2P trade flow (lobby, preview, transfer) inside the Next.js app. Commit 096b3be removed the entire web P2P layer. This ADR captures the architectural decisions made in the subsequent Claude+Codex planning session that defines Phase 17: Desktop Trade Runtime.

The core constraint: vinyl audio trades (files up to 1GB+) must remain browser-to-browser (WebRTC) to maintain the "mere conduit" legal posture. Web browsers impose sandbox limits on filesystem writes, making received-file storage painful and fragile. A desktop app solves this cleanly while the web app retains its role as the discovery and social layer.

## Decisions

### D-01: Electron over Tauri

**Decision**: Use Electron as the desktop runtime, not Tauri.

**Rationale**:
- WebRTC runs natively in Chromium. Electron ships Chromium. Tauri uses the system webview (WebView2 on Windows, WebKit on macOS) — WebRTC behavior varies across OS-level webview versions.
- The existing web app is built in Next.js (React). Electron renderer is Chromium — same engine, zero new paradigm.
- Porting PeerJS/WebRTC to Tauri would require bridging Rust↔JS for the signaling layer or accepting webview WebRTC quirks.
- Electron's larger bundle size is acceptable for a desktop trade client (not a mobile app).
- No new language surface (Tauri core = Rust). Solo developer constraint favors staying in JS/TS.

**Tradeoff accepted**: Larger binary (~150MB vs ~10MB Tauri). Not a concern for a download-once desktop client.

### D-02: Monorepo with pnpm workspaces, no Turborepo day 1

**Decision**: Structure the repository as a pnpm workspace monorepo with apps/ and packages/ directories. Do not add Turborepo on day 1.

**Rationale**:
- pnpm workspaces provide workspace:* protocol for cross-package imports — sufficient for the immediate need.
- Turborepo adds caching and pipeline orchestration that provides real value only when the build graph becomes complex (3+ packages with interdependencies and CI build time matters).
- Solo developer principle: add tooling when the pain it solves is felt, not in anticipation.
- Turborepo can be added in a future phase if build times degrade.

**Structure**:
```
apps/
  web/          (existing Next.js app)
  desktop/      (new Electron app)
packages/
  trade-domain/ (shared types, enums, Zod schemas, protocol constants)
```

### D-03: packages/trade-domain boundary — pure business contracts only

**Decision**: packages/trade-domain contains only: enums, TypeScript types, Zod validation schemas, protocol constants, and pure business rules. It MUST NOT contain: Drizzle schema definitions, server actions, Supabase client imports, or Next.js imports.

**Rationale**:
- The Electron renderer and the web app both need the same trade types (TradeStatus, OfferLeg, ChunkMessage, etc.).
- If trade-domain imported Drizzle or Supabase, it would pull server-side infrastructure into the Electron renderer bundle — a hard dependency that defeats the separation.
- Pure packages are trivially testable, have no runtime side effects, and can be imported in any context (Node.js main process, browser renderer, web server action).

**What belongs in trade-domain**:
- `TradeStatus` enum and state machine transition rules
- `OfferLeg`, `ChunkMessage`, `AckMessage`, `DoneMessage` type definitions
- `TradeProtocolVersion` constant and compatibility gating logic
- Zod schemas for all wire messages
- `FileStore` path convention: `~/Music/DigSwap/Incoming/<counterparty>/<trade-id>_<filename>`

**What does NOT belong**:
- Database table definitions (Drizzle stays in apps/web)
- Server actions (Next.js-specific, stay in apps/web)
- Supabase client (infrastructure concern, not domain)

### D-04: Web = discovery/social, Desktop = lobby/transfer/filesystem

**Decision**: The web app handles all discovery, social, and matchmaking surfaces. The desktop app is the exclusive runtime for P2P trade execution (lobby join, file transfer, filesystem persistence).

**Rationale**:
- Separates concerns cleanly: web app serves SEO, social graph, Discogs integration; desktop app serves the high-trust, high-bandwidth file exchange.
- Legal posture: the "mere conduit" argument is cleaner when the transfer client is a dedicated desktop app with explicit filesystem access, not an embedded browser widget.
- UX: desktop apps have native file system access, persistent background connections, and OS-level notifications — all desirable for a long-running trade window.
- Web still shows trade inbox, history, and proposals — only the active transfer window lives in desktop.

### D-05: PKCE + browser external for OAuth, safeStorage for session persistence

**Decision**: Electron app uses `shell.openExternal()` to open the OAuth flow in the system browser (not an embedded webview). PKCE is mandatory. Sessions are stored via Electron's `safeStorage` API (OS keychain-backed encryption).

**Rationale**:
- Embedded webviews in Electron can be phished — opening OAuth in the system browser is the current security best practice per Electron security guidelines.
- PKCE prevents authorization code interception (relevant because the redirect lands on a custom protocol handler, not HTTPS).
- `safeStorage` encrypts the stored token with the OS keychain (Keychain on macOS, DPAPI on Windows, libsecret on Linux) — significantly more secure than `localStorage` or plain JSON files.

### D-06: Lease authority via Supabase RPC, not Realtime Presence

**Decision**: Trade lobby "who is the authority for this lease" is determined by a Supabase RPC call (`acquire_trade_lease`), not by Realtime Presence join order.

**Rationale**:
- Realtime Presence is eventually consistent and does not provide transactional guarantees. Two clients arriving within milliseconds of each other can both believe they joined first.
- A PostgreSQL function with `FOR UPDATE SKIP LOCKED` or a `lease_holder_id + acquired_at` pattern provides serializable authority assignment.
- Heartbeat (30s interval) + reconciliation receipts ensure stale leases are detected and reassigned within one heartbeat window.
- ICE telemetry (connection quality metrics) written to the lease row enables debugging of NAT traversal failures without a separate telemetry service.

### D-07: Managed TURN from day 1, no STUN-only shortcuts

**Decision**: The desktop app is configured with managed TURN relay credentials from launch. STUN-only fallback is not acceptable in production.

**Rationale**:
- Approximately 15-20% of real-world WebRTC connections fail without a TURN relay (symmetric NATs, corporate firewalls, mobile carriers).
- For a file transfer app, a 15-20% failure rate is unacceptable — users would blame the app, not their network.
- Managed TURN (Metered.ca or self-hosted coturn) adds ~$5-20/month at low traffic, which is worth the reliability guarantee.
- STUN-only may be used in development with Google's free STUN servers, but the production config requires TURN credentials via environment variables.

### D-08: Handoff via web page intermediary + protocol handler + short-TTL token

**Decision**: When a user clicks "Open in Desktop App" on the web app, the web app:
1. Creates a short-TTL (60s) handoff token in the database
2. Opens `digswap://open?token=<handoff_token>&trade_id=<id>` via a web page intermediary
3. The desktop app's protocol handler (`digswap://`) receives the token, exchanges it for a session, and opens the correct trade lobby

**Rationale**:
- The protocol handler URL cannot carry a full JWT (URLs are logged by OS, visible in process lists).
- A short-TTL token that is single-use and exchanges for a real session limits the exposure window to 60 seconds.
- The web page intermediary (a landing page that executes `window.location = 'digswap://...'`) allows graceful fallback: if the desktop app is not installed, show the download page instead.
- This pattern is used by Figma, Slack, and other web+desktop hybrid apps.

### D-09: Received file store path convention

**Decision**: Files received via trade are stored at:
`~/Music/DigSwap/Incoming/<counterparty-username>/<trade-id>_<original-filename>`

**Rationale**:
- `~/Music/` is the natural home for audio files on all three platforms (macOS, Windows, Linux).
- `DigSwap/Incoming/` scopes all received files to avoid polluting the user's existing music library.
- `<counterparty-username>/` allows users to browse by sender.
- `<trade-id>_<original-filename>` makes the origin traceable without requiring a separate metadata file.
- The `trade-domain` package exports this path-building function so both the Electron main process and any future surface use the same convention.

### D-10: trade_protocol_version for compatibility gating

**Decision**: Every wire message includes a `trade_protocol_version` field. Desktop app and web app both check this field before processing messages. Version mismatch triggers a user-visible error with an upgrade prompt.

**Rationale**:
- Desktop apps are not auto-updated in real time. A user on desktop v1.0 may attempt to trade with a counterparty on desktop v1.2 that has a different chunk format.
- Compatibility gating at the protocol level prevents silent data corruption or failed transfers.
- The version is a monotonic integer (not semver) to keep comparison trivial.
- Breaking changes increment the version; additive changes do not.

### D-11: Agent ownership split — Codex and Claude

**Decision**: Phase 17 work is split by agent capability:
- **Codex**: Foundation, contracts, desktop implementation (17-01, 17-02, 17-03, and the IPC/runtime half of 17-06)
  - Reason: Codex excels at structured scaffolding, boilerplate-heavy setup (monorepo config, Electron main process, IPC bridge), and protocol implementation.
- **Claude**: Renderer UI and web surfaces (17-04, 17-05, and the renderer/UX half of 17-06)
  - Reason: Claude excels at React component composition, design system application, and user-facing interaction patterns.
- **Both**: packages/trade-domain contracts (17-01 produces the package; both consume it)

**Rationale**: Matching agent strengths to task type maximizes execution quality. The IPC boundary between main process and renderer is the natural handoff line between agents.

## Consequences

- Phase 17 requires a monorepo restructure (apps/web, apps/desktop, packages/trade-domain) — existing CI/CD and Vercel config must be updated for monorepo root.
- The web app's "request trade" surface becomes a handoff point to the desktop app rather than a self-contained flow.
- Users must install the desktop app to participate in trades. This is a UX change that must be communicated clearly via the web download/update gate (17-05).
- The "mere conduit" legal argument is strengthened: file data flows Electron↔Electron via WebRTC, never through Vercel or Supabase servers.

## Status

Accepted 2026-03-31. Phase 17 planning begins after Phase 16 is planned (can proceed in parallel with Phase 16 execution).
