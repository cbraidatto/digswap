# Phase 9: P2P Audio Trading — Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver browser-to-browser audio file trading via WebRTC, gated behind DMCA compliance infrastructure and a per-user ToS acceptance step. Includes the full async trade lifecycle (request → accept → live lobby → transfer → review), a trade inbox, reputation scoring, and freemium enforcement (5 trades/month free, unlimited premium).

Surfaces in scope:
- `/trades` — inbox with PENDING / ACTIVE / COMPLETED tabs (new)
- `/trades/new` — wire up the existing stub to actual form logic
- `/trades/[id]` — live lobby page: waiting state + WebRTC connection + transfer progress (new)
- `/trades/[id]/review` — wire up the existing SPEC_CHECK stub to actual review submission
- `/trades/[id]/complete` — wire up the existing stub to completion action
- `/perfil/[username]` — add "Request Audio" action on collection cards
- `/explorar` — add "Request Trade" action from record search results
- Notification bell — add "Request Trade" quick action on wantlist match notifications
- Profile page — trade reputation stat line

Out of scope for Phase 9:
- Stripe subscription / premium upgrade flow (Phase 10)
- Browser push notifications (deferred per REQUIREMENTS.md)
- TURN server self-hosting (out of scope v1 — use Metered.ca)
- Scheduled / async offline transfers (P2P-04: both users must be online during transfer)

</domain>

<decisions>
## Implementation Decisions

### DMCA & ToS Gate

- **D-01:** Two-layer compliance gate:
  1. **Admin flag** — `P2P_ENABLED` env var (or Supabase `app_config` row). When `false`, the entire `/trades` section renders a static compliance notice: `[P2P_DISABLED] DMCA registration pending — trading will be enabled once compliance infrastructure is operational.` No trade requests can be sent or accepted.
  2. **Per-user ToS modal** — On first trade attempt, user sees a mandatory Terms of Service modal placing copyright responsibility on them (SEC-06). Acceptance timestamp stored as `trades_tos_accepted_at` on `profiles` table. Cannot proceed without acceptance.

- **D-02:** `trades_tos_accepted_at` column added to `profiles` table via migration. If null, ToS modal is shown before any trade action. If set, user bypasses the modal on all future trades.

- **D-03:** The admin flag check happens server-side (middleware or server component) — not client-only. Cannot be bypassed by inspecting the page.

### Trade Initiation Entry Points

- **D-04:** Three entry points for initiating a trade request:
  1. **Public profile** (`/perfil/[username]`) — "Request Audio" button on collection cards (alongside existing condition display)
  2. **Explorar search results** — "Request Trade" action on `RecordSearchCard` when the owner is not the current user
  3. **Wantlist match notifications** — Quick "Request Trade" CTA directly on the notification row/detail for `wantlist_match` type notifications

- **D-05:** All three entry points navigate to `/trades/new?to=[userId]&release=[releaseId]` — the existing stub page — with pre-filled recipient and record context. The user selects the audio file they're offering and confirms.

- **D-06:** "Request Audio" is only shown when `P2P_ENABLED` is true and the viewer is not the profile owner.

### WebRTC / Signaling

- **D-07:** **PeerJS Cloud** (`peerjs.com`) for WebRTC signaling — zero ops, free tier, peer IDs brokered through their server but no file data passes through it.

- **D-08:** **Metered.ca managed TURN** relay from day one. Self-hosted TURN is out of scope for v1 (per REQUIREMENTS.md). TURN relay prevents ~15-20% of failed connections and satisfies SEC-07 (no raw user IP exposure during transfer).

- **D-09:** TURN credentials (Metered.ca API key) stored as server-side env var. Credentials fetched via a server action called from the trade lobby page before PeerJS initialization — not hardcoded client-side.

- **D-10:** File transfer protocol: chunk files into 64KB segments via PeerJS DataChannel. Sender emits `{ type: 'chunk', index, total, data }` + `{ type: 'done' }`. Receiver reassembles and triggers download. Progress tracked client-side by counting received chunks.

### Trade Lobby (async + live)

- **D-11:** **Async request model** — recipient can be offline when request is sent. Both parties get notifications (in-app via Phase 6 system; email via Resend for trade requests per NOTF-02).

- **D-12:** Trade request lifecycle via `trade_requests.status`:
  ```
  pending → accepted (recipient accepts) → transferring (WebRTC active) → completed
                      ↘ declined
                      ↘ cancelled (requester withdraws)
                      ↘ expired (after expiry window, e.g., 48h)
  ```

- **D-13:** `/trades/[id]` lobby page state machine:
  - **WAITING** — One party has arrived, waiting for other. Shows animated terminal cursor. Supabase Realtime subscription on the `trade_requests` row for status changes.
  - **CONNECTING** — Both parties present, PeerJS attempting connection. Shows `[ESTABLISHING_CONNECTION...]`
  - **TRANSFERRING** — Active DataChannel. Shows file name, progress bar (`████░░░░ 42%`), bytes transferred, estimated time.
  - **COMPLETE** — Transfer confirmed. Redirects to `/trades/[id]/complete` for review.
  - **FAILED** — Connection dropped mid-transfer. Shows retry option and error code.

- **D-14:** "Both users must be online simultaneously" (P2P-04) is enforced by the PeerJS connection — if one party closes the lobby, the DataChannel drops. No server-side file relay ever happens.

### Trade Inbox

- **D-15:** `/trades` index page with three tabs: **PENDING** / **ACTIVE** / **COMPLETED**
  - PENDING — trade requests awaiting response (sent by me or received, unresolved)
  - ACTIVE — currently in lobby or transferring
  - COMPLETED — historical trades with outcome + rating

- **D-16:** `/trades` is accessible via:
  - Notification bell → trade request notification → link to `/trades`
  - Own profile page (`/perfil`) — a `TRADES` stat or link in the profile header area
  - Direct URL

- **D-17:** Trade row display format (terminal aesthetic, matching leaderboard row pattern from Phase 8):
  ```
  [STATUS] · COUNTERPARTY · RECORD_TITLE · DATE · RATING (if complete)
  ```

### Trade Counter / Freemium

- **D-18:** `subscriptions.tradesThisMonth` (already in schema) is incremented on trade completion via server action. Checked before allowing a new trade initiation.

- **D-19:** Trade limit enforcement: free users (plan = 'free') are blocked from initiating a new trade when `tradesThisMonth >= 5`. UI shows: `TRADE_QUOTA_REACHED: 5/5 this month. Resets [date]. [UPGRADE_TO_PREMIUM]` — links to Phase 10 premium upgrade (shown as stub in Phase 9).

- **D-20:** `tradesMonthReset` timestamp already in schema. pg_cron job (or check-on-read logic) resets `tradesThisMonth` to 0 when current date passes `tradesMonthReset`. Claude's discretion on reset approach.

### Audio Spectrum Analysis

- **D-21:** Client-side implementation using **Web Audio API** (AnalyserNode → FFT → canvas rendering). Runs entirely in the browser after the file arrives — no server processing, no cost, no latency from server roundtrip. Matches the SPEC_CHECK UI stub already in place.

- **D-22:** Freemium gate: free users get 1 spectrum analysis per trade (triggered once automatically on receive). Premium users can retrigger analysis. Gate enforced client-side via subscription plan check from server-rendered props.

### Trade Reputation

- **D-23:** Reputation surfaced on public profile as a stat line in the profile header area:
  ```
  TRADES: 12 · AVG: 4.7★
  ```
  Computed from `tradeReviews` table (average of `qualityRating` where `reviewedId = userId`).

- **D-24:** CONNECTOR badge (Phase 8 stub) awarded on first completed trade via the `completeTrade` server action, using the existing `awardBadge(userId, 'connector')` utility.

### Claude's Discretion

- Visual treatment for `[P2P_DISABLED]` compliance notice — terminal error-style banner consistent with Ghost Protocol
- Expiry window for pending trade requests (proposed: 48h matching the stub UI)
- Whether `P2P_ENABLED` is read from env var or a Supabase config table (env var preferred for simplicity)
- pg_cron vs check-on-read for monthly trade counter reset
- Exact ToS copy — placeholder draft acceptable, legal review before launch

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schema (existing — read before any migration)
- `src/lib/db/schema/trades.ts` — `tradeRequests` + `tradeReviews` tables + RLS policies
- `src/lib/db/schema/subscriptions.ts` — `tradesThisMonth`, `tradesMonthReset`, `plan` fields
- `src/lib/db/schema/users.ts` — `profiles` table (needs `trades_tos_accepted_at` column added)
- `src/lib/db/schema/notifications.ts` — notification types (wantlist_match, trade_request)
- `src/lib/db/schema/index.ts` — schema barrel export

### Existing UI stubs (wire up, don't recreate)
- `src/app/(protected)/trades/new/page.tsx` — trade initiation stub
- `src/app/(protected)/trades/[id]/review/page.tsx` — SPEC_CHECK stub with WebAudio placeholder
- `src/app/(protected)/trades/[id]/complete/page.tsx` — completion + rating stub

### Existing components / patterns to reuse
- `src/app/(protected)/(profile)/perfil/page.tsx` — own profile (add trades stat)
- `src/app/(protected)/(profile)/perfil/[username]/page.tsx` — public profile (add Request Audio)
- `src/app/(protected)/(explore)/explorar/_components/` — RecordSearchCard (add Request Trade)
- `src/components/shell/notification-row.tsx` — notification row (add Request Trade CTA)
- `src/app/globals.css` — Ghost Protocol design tokens
- `src/lib/gamification/` — badge award utilities (awardBadge)
- `src/lib/gamification/constants.ts` — CONNECTOR badge slug

### Prior phase decisions (read relevant sections)
- `.planning/phases/08-gamification-rankings/08-CONTEXT.md` — badge system (D-09, D-10, D-24), rank/contribution scoring (D-03: trade = +15 pts)
- `.planning/phases/06-discovery-notifications/06-CONTEXT.md` — notification infrastructure, Resend email, Supabase Realtime pattern
- `.planning/phases/05-social-layer/05-CONTEXT.md` — Ghost Protocol feed card design language
- `.planning/phases/04.5-template-alignment/04.5-CONTEXT.md` — Ghost Protocol visual language decisions

### Stack documentation
- `CLAUDE.md` §WebRTC — PeerJS 1.5.x, PeerJS Server 1.0.x, Metered.ca TURN rationale
- `CLAUDE.md` §What NOT to Use — confirms no server-side file storage, no WebTorrent, no Socket.IO

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tradeRequests` table — fully defined with RLS (select: participant only, insert: requester only, update: participant)
- `tradeReviews` table — fully defined with RLS (select: all authenticated, insert: reviewer only)
- `subscriptions.tradesThisMonth` — counter field ready; `tradesMonthReset` for reset tracking
- Three trade UI stubs at `/trades/new`, `/trades/[id]/review`, `/trades/[id]/complete` — design matches Ghost Protocol; just need wiring
- `awardBadge(userId, slug)` utility from Phase 8 — idempotent, call with `'connector'` on first trade
- Notification infrastructure from Phase 6 — already supports `trade_request` and `trade_completed` notification types per NOTF-01
- Supabase Realtime pattern from Phase 6 (NotificationBell) — same pattern for `/trades/[id]` lobby polling

### Established Patterns
- Server actions for all mutations (consistent across all phases)
- Drizzle ORM with admin client for badge awards and cross-user writes
- Supabase Realtime subscription in client components (see `feed-container.tsx`, `notification-bell.tsx`)
- Ghost Protocol terminal aesthetic: `font-mono`, surface-container-low cards, `[STATUS]` labels, uppercase headers
- No real-time feed on page until user action — consistent with Phase 5 decision

### Integration Points
- `/perfil/[username]` collection cards → "Request Audio" button (links to `/trades/new?to=[userId]&release=[releaseId]`)
- `/explorar` RecordSearchCard → "Request Trade" action (same query params)
- Notification row for `wantlist_match` → "Request Trade" CTA
- `completeTrade` server action → triggers `awardBadge('connector')` + increments `tradesThisMonth` + creates `tradeReviews` record + `activity_feed` entry (`completed_trade` event type)
- Phase 10 Stripe subscription check — premium plan check already available via `subscriptions.plan`

</code_context>

<specifics>
## Specific Notes

- Trade-linked audio file (success criterion 3): "Trade is linked to an audio file the user owns — not required to match a physical record in collection." This means `releaseId` on `tradeRequests` can be null or reference a release they don't own in DigSwap. The user declares what they're offering (metadata: format, declared bitrate, title) at request time. The actual file transfers via DataChannel at lobby time.
- The SPEC_CHECK page (`/trades/[id]/review`) already has hardcoded spec rows (FORMAT, BITRATE, DURATION, CHANNELS, MD5_HASH). In Phase 9, these are populated from declared metadata (request form) vs detected metadata (Web Audio API analysis of received file).
- The trade complete page stub says `XP_EARNED: +150 XP` — this should be replaced with the real contribution score from Phase 8 (D-03: trade = +15 pts to contributionScore, not XP).
- `subscriptions` table uses `plan: 'free' | 'premium_monthly' | 'premium_annual'` — free plan check is `plan === 'free'`.
- TURN credentials endpoint: Metered.ca provides a REST endpoint to fetch ephemeral ICE server credentials. Fetch server-side (Next.js server action or API route) and pass to PeerJS config to avoid exposing API key client-side.

</specifics>

<deferred>
## Deferred Ideas

- Stripe subscription / premium upgrade UI — Phase 10
- Browser push notifications (NOTF-03) — deferred per REQUIREMENTS.md
- Real-time "currently online" indicator for trading availability — DISC2-V2-01 (v2)
- Scheduled trade requests for async-compatible time windows — DISC2-V2-02 (v2)
- Direct messaging — SOCL-V2-01 (v2)
- Redis sorted sets for ranking (trade contribution score) — deferred until user volume justifies (D-13 from Phase 8)
- Self-hosted TURN — explicitly out of scope v1 per REQUIREMENTS.md

</deferred>

---

*Phase: 09-p2p-audio-trading*
*Context gathered: 2026-03-27*
