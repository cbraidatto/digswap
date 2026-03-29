# Phase 14: Trade V2 — Context

**Gathered:** 2026-03-29
**Status:** Ready for planning
**Cross-AI Review:** Gemini + Codex/GPT input incorporated

<domain>
## Phase Boundary

Upgrade the trade flow from Phase 9's single-step transfer into a 3-phase negotiation:

```
Proposal (metadata) → Bilateral Preview (1 min P2P) → Full Transfer
```

Surfaces in scope:
- `/trades/new` — extend proposal form with quality metadata + collection linking
- `/trades/[id]` — lobby redesigned for 3-phase state machine (negotiation → preview → transfer)
- `/trades/[id]` preview phase — file selection, 1-min P2P preview, waveform player, bilateral accept
- Schema migration — new status enum values + bilateral acceptance timestamp columns

Out of scope for this phase:
- Proof thumbnail (vinyl photo) — cool idea from Gemini, deferred
- Community anti-piracy via hash matching — Phase 16+ (hash saved now, enforcement later)
- Offline/async transfer relay — P2P-04: both users must be online simultaneously, no relay
- Bidirectional full transfer (A sends to B AND B sends to A) — preview is bilateral but full transfer remains one-way (proposer's file to recipient) unless TRADE2 requirements expand this

</domain>

<decisions>
## Implementation Decisions

### D-01: Proposal Structure — Asymmetric Proposal, Bilateral Preview

- **Proposal** (`/trades/new`) is asymmetric: the proposer specifies:
  1. The record they want (from the other party)
  2. The record they're offering in return (metadata only — no file uploaded here)
  3. Quality metadata for their offering: format, declared quality, condition notes

- **Lobby** is bilateral: once both parties are present, BOTH select their files. Both previews play. Both must accept the preview before full transfer begins.

- **Why:** This aligns with how Phase 9 already works (trade-lobby.tsx and use-peer-connection.ts are already bilateral in the transfer). The Codex audit confirmed: "the lobby already presumes both choose files." Phase 14 makes this explicit in the proposal terms and enforces it in the preview phase.

- **Critical alignment fix:** Before Phase 14, `completeTrade` and `skipReview` still accept trades in `accepted` status (trades.ts lines 403 and 518). These must be gated to require `previewing` or `transferring` status. Plan 14-01 must fix this.

### D-02: File is Ephemeral — Selected in Lobby, Not in Proposal

- The `File` object chosen in a browser tab cannot be persisted server-side (P2P constraint — no server-side storage ever). A file selected in `/trades/new` will not survive navigation to `/trades/[id]`.
- **Decision:** The proposal form (`/trades/new`) captures **metadata only**: format, declared quality, condition notes, and the release the proposer is offering. No file selection in the proposal.
- File selection happens at the start of the preview phase in the lobby. The proposer (and recipient) each select their file at that point.
- This also means there is no `preview_offset_seconds` saved in the proposal — the preview is generated live in the lobby from the file selected there.

### D-03: Preview Generation — First 60 Seconds, Blob.slice()

- **Do NOT seek in raw compressed bytes.** Seeking by byte offset into MP3/FLAC/M4A breaks audio headers and will cause `AudioContext.decodeAudioData` to reject the buffer on the receiver side. VBR MP3 makes byte-to-time mapping non-linear.
- **Decision:** Preview = the **first 60 seconds** of the file, delivered as the raw file bytes from `Blob.slice(0, previewByteLength)`.
- `previewByteLength` is estimated as `Math.min(file.size, declaredBitrateKbps * 125 * 65)` — a safe overestimate for 65 seconds at declared bitrate. If declared bitrate is unknown, fall back to `Math.min(file.size, 12_000_000)` (12MB cap).
- The receiver's `AudioContext.decodeAudioData` handles the partial file gracefully for standard formats (FLAC, WAV, MP3 CBR). For VBR MP3, decoding from byte 0 always works.
- **Why not random segment?** Gemini's point: "if the sender picks, they always pick the best 30 seconds." Agreed. But seeking in compressed bytes is unreliable. Solution: first 60 seconds is still honest (the sender can't strategically move bad audio to after the first minute), simpler, and technically sound.
- **The random segment trade-off is accepted:** First 60s is slightly less random than a true arbitrary seek, but is technically reliable. If both parties know it's always the first 60s, it's still an honest preview — the sender cannot know in advance which records the buyer will look for.

### D-04: Waveform — Amplitude Bars + Optional Spectrogram

- **Primary UI:** Amplitude bars rendered on a `<canvas>` element.
  - After preview arrives, pass raw bytes through `AudioContext.decodeAudioData()`
  - Reduce signal to 150 amplitude buckets: `max(abs(samples))` per bucket interval
  - Render as vertical bars with playback cursor advancing in real time via `AudioBufferSourceNode`
- **Why not Soundcloud waveform?** Phase 9 already has `spectrogram-canvas.tsx` for post-transfer analysis. Duplicate complex waveform work is not justified.
- **Optional advanced analysis:** A `[ADVANCED SPECTRUM]` button below the player reuses `spectrogram-canvas.tsx` for FFT visualization. This lets diggers check for frequency cutoffs (classic sign of upscaled lossy audio). Free users get 1 spectrum render; premium users get unlimited (preserving Phase 9's D-22 freemium gate).
- **Why spectrogram matters for vinyl:** Gemini's point confirmed — amplitude bars don't catch a 128kbps upscale to FLAC. Frequency cutoff above ~16kHz is the tell. Spectrogram reveals this; amplitude bars do not. Both are provided.

### D-05: Quality Metadata — Declared Quality, Estimated Bitrate

- **Format:** Auto-detected from file MIME type / extension. `audio/flac` → FLAC, `audio/mpeg` → MP3, `audio/wav` → WAV.
- **Bitrate estimate:** Computed as `(file.size * 8) / duration_seconds` using duration from `<audio>` element's `loadedmetadata` event. Displayed as "est. [N] kbps". User can override.
  - **Why this formula?** Gemini's recommendation — gives VBR average, not decode-time PCM rate. `AudioBuffer.sampleRate × channels × bit_depth` reflects the decoded PCM (always high), not the source file's compression rate. The size/duration formula is the correct approach.
- **Field name:** "Declared quality" (not "bitrate") — following Codex's suggestion. The seller is declaring the quality; the buyer verifies via spectrogram.
- **Condition notes:** Free text, required. Minimum 10 characters. Describes the pressing, condition, any known artifacts.

### D-06: Online Presence — Supabase Realtime Presence Channels

- **`beforeunload` is rejected.** Fails on iOS Safari suspension, browser crash, mobile background. Would leave stale "online" states in the database.
- **Decision:** Use **Supabase Realtime Presence** channels for lobby presence.
  - Each user joining `/trades/[id]` calls `channel.track({ userId, joinedAt })` on the trade's Realtime channel
  - The lobby subscribes to `presence.on('sync', ...)` — receives `join` and `leave` events
  - UI: toast `[PARTNER_ONLINE]` on join, banner `[BOTH_ONLINE — READY TO CONNECT]` when both present
  - Heartbeat is managed by Supabase WebSocket infrastructure — no TTL management needed
- **Audit column only:** `last_joined_lobby_at` timestamp column on `trade_requests` for debugging. This is NOT used for real-time presence decisions — only Supabase Presence is authoritative.

### D-07: State Schema — Single Progressive Enum + Bilateral Timestamp Columns

- **Rejected:** Separate `phase` + `status` columns. Creates combinatorially invalid states (phase=transfer, status=waiting). Two FSMs in one row are a maintenance hazard for a solo developer.
- **Decision:** Single `status` enum (expanded from Phase 9):
  ```
  pending → lobby → previewing → transferring → completed
            ↘ declined (by recipient)
            ↘ cancelled (by proposer)
            ↘ expired (48h no action)
  ```
- **Bilateral acceptance tracked via timestamp columns** (Codex's recommendation):
  - `terms_accepted_at` — proposer accepts their own terms (implicit on proposal creation, or explicit confirm button)
  - `terms_accepted_by_recipient_at` — recipient accepts terms
  - `preview_accepted_at` — proposer accepts the recipient's preview
  - `preview_accepted_by_recipient_at` — recipient accepts the proposer's preview
  - Status advances to `transferring` when all 4 columns are non-null
- **Why timestamps vs boolean flags?** Timestamps give an audit trail of who accepted when. Useful for dispute resolution and community trust.

### D-08: Backpressure in WebRTC DataChannels

- **Problem identified by Gemini:** Sending chunks in a tight loop without pausing will overflow the browser's WebRTC heap buffer, causing crashes or corrupt transfers on large files.
- **Decision:** Implement backpressure monitoring in `use-peer-connection.ts`:
  - Check `dataChannel.bufferedAmount` before each chunk send
  - If `bufferedAmount > 1_048_576` (1MB): pause sending, set `dataChannel.onbufferedamountlow` handler
  - `dataChannel.bufferedAmountLowThreshold = 262_144` (256KB)
  - Resume sending in the `onbufferedamountlow` callback
- This replaces the current tight-loop chunk pattern and prevents heap overflow on any file size.

### D-09: File Fingerprint — SHA-256 via SubtleCrypto

- **Decision:** When a user selects their file in the lobby, compute `SHA-256` hash via `crypto.subtle.digest('SHA-256', await file.arrayBuffer())` and save as `file_hash` on the `trade_requests` row.
- **Phase 14 scope:** Save the hash only. No enforcement logic, no de-duplication, no community matching.
- **Future use (Phase 16+):** Hash enables community anti-piracy tracking — duplicate hashes across trades reveal when the same rip is being circulated. Pair with gamification for rare/verified rips.
- **Performance note:** SHA-256 on a 100MB FLAC takes ~500ms in browser. Run in a Web Worker to avoid blocking UI during lobby file selection.

### D-10: Pre-Phase-14 Fixes Required (Codex Audit)

These two issues in the Phase 9 codebase must be fixed in Plan 14-01 before any new lobby logic is added:

1. **`completeTrade` / `skipReview` accept trades in `accepted` status** (trades.ts ~lines 403, 518). These must check for `previewing` or `transferring` status — trades should not be completable without going through the preview phase.
2. **Peer/chunk validation in `use-peer-connection.ts`** (~line 221): validate chunk index continuity and total count. Missing chunks silently produce corrupted files.

### Claude's Discretion

- Exact UI layout of the bilateral proposal review screen (recipient sees proposer's terms before accepting)
- Whether the lobby shows both parties' quality cards side-by-side or stacked
- Loading/error states for SHA-256 hashing in Web Worker
- Whether `terms_accepted_at` is set on proposal creation or requires an explicit "I confirm my offer" step
- Animation/transition between lobby phases (negotiation → preview → transfer)
- How the 60s preview progress bar integrates with the amplitude bars canvas

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Trade Infrastructure (Phase 9)
- `src/app/(protected)/trades/new/page.tsx` + `_components/trade-form.tsx` — extend, don't replace
- `src/app/(protected)/trades/[id]/page.tsx` + `_components/trade-lobby.tsx` — primary modification target
- `src/app/(protected)/trades/[id]/review/_components/spectrogram-canvas.tsx` — reuse for advanced spectrum
- `src/lib/webrtc/use-peer-connection.ts` — backpressure fix + chunk validation fix required here
- `src/actions/trades.ts` — completeTrade/skipReview status gate fix required here
- `src/lib/db/schema/trades.ts` — schema migration target (new status values + timestamp columns)

### Design Patterns
- `src/components/digger-memory/quick-note-popover.tsx` — @base-ui/react Popover (same pattern for collection-link picker)
- `src/app/globals.css` — Ghost Protocol design tokens
- `src/app/(protected)/trades/[id]/_components/transfer-progress.tsx` — progress bar pattern to reuse for preview progress

### Supabase Realtime Presence
- Phase 6 established Realtime pattern: `src/lib/supabase/client.ts` — use same pattern for Presence channel in lobby

</canonical_refs>

<specifics>
## Specific Notes

- The `status` enum in `trade_requests` currently has values from Phase 9: `pending | accepted | transferring | completed | declined | cancelled | expired`. Phase 14 adds `lobby` and `previewing`. Migration must add these without breaking existing rows.
- Preview byte slice estimation formula: `previewByteLength = Math.min(file.size, declaredBitrateKbps * 125 * 65)`. If declared bitrate unknown: `Math.min(file.size, 12_000_000)`.
- SHA-256 in Web Worker: use `new Worker` with inline script via `URL.createObjectURL(new Blob([workerScript]))` pattern — no separate worker file needed.
- `dataChannel.bufferedAmountLowThreshold` is a standard WebRTC API — check browser compatibility (Chrome 57+, Firefox 44+, Safari 15.4+).
- Supabase Realtime Presence docs: https://supabase.com/docs/guides/realtime/presence — channel name should be `trade:${tradeId}`.
- The bilateral timestamp columns (`terms_accepted_at`, `preview_accepted_by_recipient_at`, etc.) drive the status advancement via server actions — never client-side. The status transition logic lives entirely in server actions.

</specifics>

<deferred>
## Deferred Ideas

- **Drop-Visual-Proof (vinyl photo)** — Gemini's idea: optional camera thumbnail of the record on the pickup. Immersive, on-brand. Defer to Phase 15 or a quick task after launch.
- **Community hash matching** — Phase 16+: identify duplicate rips circulating the platform using saved `file_hash` values.
- **Bidirectional full transfer** — Both parties send files to each other. Phase 14 preview is bilateral but full transfer remains one-way. If users want true swap, defer.
- **Random seek preview** — More trustless than first-60s. Requires reliable audio container parsing in browser (music-metadata-browser). Defer until viable without compromising reliability.
- **Degraded preview (mono/downsampled)** — Codex's suggestion for legal posture: send preview at lower quality to limit capture value. Adds re-encoding complexity. Defer.
- **Peer/chunk integrity via hash** — Hash each 64KB chunk server-side for integrity verification. Currently only end-to-end SHA-256. Defer.

</deferred>

---

*Phase: 14-trade-v2*
*Context gathered: 2026-03-29*
*Cross-AI review: Gemini + Codex/GPT*
