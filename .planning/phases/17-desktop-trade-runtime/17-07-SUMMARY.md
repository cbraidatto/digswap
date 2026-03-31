# 17-07 Summary: Transport Swap - Local Runtime -> WebRTC DataChannel

## Outcome
- Replaced the desktop-local transfer loop with a real PeerJS/WebRTC DataChannel transport in the desktop main runtime.
- Kept the renderer IPC contract frozen: no `DesktopBridgeTradeRuntime` changes were required.
- Preserved the existing lease heartbeat, receipt queue, reconciliation, and completion flow while swapping only the transport engine.

## Delivered
- Added `peerjs` to [apps/desktop/package.json](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/apps/desktop/package.json) and updated [pnpm-lock.yaml](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/pnpm-lock.yaml).
- Added TURN/STUN credential resolution in [turn-credentials.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/apps/desktop/src/main/webrtc/turn-credentials.ts).
- Added a `PeerSession` bridge in [peer-session.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/apps/desktop/src/main/webrtc/peer-session.ts) with:
  - deterministic peer IDs (`${tradeId}-s` / `${tradeId}-r`)
  - expected-peer validation
  - ICE candidate telemetry forwarding
  - backpressure-aware binary/json send support
  - failure propagation so connection bootstrap does not hang silently
- Added chunked transfer helpers in [chunked-transfer.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/apps/desktop/src/main/webrtc/chunked-transfer.ts) with:
  - header -> chunks -> eof protocol
  - 64 KB chunks
  - receiver-side SHA-256 verification
  - `.part` write then final rename
- Swapped [trade-runtime.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/apps/desktop/src/main/trade-runtime.ts) to:
  - hydrate real trade context from Supabase
  - determine sender/receiver role
  - create/destroy active `PeerSession`s
  - stream real progress events from DataChannel transfer
  - queue receiver receipts with ICE telemetry unchanged
  - remove the previous local progress shim
- Updated the protocol payload compatibility path in [protocol.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/apps/desktop/src/main/protocol.ts) and [ipc-types.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/apps/desktop/src/shared/ipc-types.ts) so handoffs accept `token` while remaining compatible with `handoffToken`.

## Verification
- `pnpm install`
- `pnpm --dir apps/desktop exec tsc --noEmit`
- `pnpm --dir apps/desktop build`

## Notes
- Electron main does not expose `RTCPeerConnection`, so `PeerSession` uses a hidden Chromium `BrowserWindow` as the WebRTC bridge while the orchestration stays in main. This keeps the current phase unblocked without pulling in native `wrtc` bindings.
- The sender path currently materializes a deterministic synthetic source file under `downloadPath/.digswap-outgoing/` if no real local file-selection UX exists yet. The transport is real WebRTC; the source asset is still a v1 placeholder.
- The receiver path is the real one that matters for `17-03`/`17-06` continuity: `.part` file, SHA-256 verification, receipt queue, reconciliation retry, and completion event all remain end-to-end.
- `PendingTrade.handoffToken` remains a compatibility shim for the current renderer contract.

## Deferred / Follow-Up
- Replace the synthetic sender source file with an actual desktop file-selection or rip-export source when the product flow is ready for it.
- Harden the hidden-peer bridge into a more isolated utility/preload surface if we later want stricter security than `nodeIntegration: true` inside the off-screen bridge window.
- Manual two-instance verification still needs a real desktop-to-desktop run after integration because this plan validated by typecheck/build, not by signing into two live app instances in this turn.
