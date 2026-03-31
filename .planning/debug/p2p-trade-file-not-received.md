---
status: awaiting_human_verify
trigger: "p2p-trade-file-not-received — file uploaded, transfer confirmed success on both sides, but neither user has the file"
created: 2026-03-28T00:00:00Z
updated: 2026-03-28T02:30:00Z
---

## Current Focus

hypothesis: CONFIRMED — retry() destroyed peer then immediately recreated with same ID, causing "unavailable-id" PeerJS error. Fix: three-tier retry that avoids peer.destroy() in Cases 1+2, and handles "unavailable-id" with delay-based retry in Case 3.
test: TypeScript compilation passes, zero new errors in changed files
expecting: User verifies: disconnect mid-transfer, click RETRY_AND_RESUME, no "ID is taken" error, transfer reconnects and resumes
next_action: Await human verification of retry/reconnect flow

## Symptoms

expected: After a P2P WebRTC transfer completes, the recipient can download the audio file
actual: Transfer showed success (upload confirmed), but neither user has the file — it was not received
errors: No specific error shown to user — just silent failure (file never arrives)
reproduction: Initiate a trade, sender uploads file, transfer appears to complete, but recipient cannot download
started: Just happened now — first known occurrence

## Eliminated

## Evidence

- timestamp: 2026-03-28T00:01:00Z
  checked: usePeerConnection hook — where does receivedFile go?
  found: On receiver side, when "done" message arrives, reassembleChunks() creates a Blob and stores it in React useState (peerState.receivedFile). This is ephemeral browser memory only.
  implication: The file Blob exists only within the trade-lobby component's lifecycle

- timestamp: 2026-03-28T00:02:00Z
  checked: trade-lobby.tsx — what happens when transfer completes?
  found: When lobbyState becomes "complete", the useEffect at line 283 calls updateTradeStatus(tradeId, "completed") then router.push(`/trades/${tradeId}/complete`). The lobby component unmounts, destroying the peerState including receivedFile Blob.
  implication: Navigation away from lobby destroys the only copy of the received file

- timestamp: 2026-03-28T00:03:00Z
  checked: trade-lobby.tsx — does it ever call useReceivedFileStore.setFile() or trigger a download?
  found: NO. The lobby component never imports or calls useReceivedFileStore. It never triggers a file download (no anchor element with download attribute, no programmatic download). The receivedFile Blob is accessible via peerState but is never saved or forwarded anywhere.
  implication: The received file is completely lost when the lobby navigates away

- timestamp: 2026-03-28T00:04:00Z
  checked: spec-analysis.tsx (review page) — how does it expect to get the file?
  found: It reads from useReceivedFileStore Zustand store (line 76). But nothing ever calls setFile() on this store. The store is defined in spec-analysis.tsx itself. No other file imports or writes to it.
  implication: The review page's Zustand store mechanism is dead code — never populated

- timestamp: 2026-03-28T00:05:00Z
  checked: /trades/{id}/complete page — does it have any file access?
  found: The complete page is a SERVER component. It renders a trade summary with "[CONFIRMED]" hardcoded text and a TradeRatingForm. There is no file blob, no download button, no reference to any received file.
  implication: The complete page falsely claims "files transferred [CONFIRMED]" but has no mechanism to deliver the file

- timestamp: 2026-03-28T00:06:00Z
  checked: Full codebase grep for download/saveAs/blob URL in trades directory
  found: Only URL.createObjectURL usage is in spec-analysis.tsx (review page), for audio preview playback. No download link or save mechanism exists anywhere in the trade flow.
  implication: There is NO download mechanism in the entire trade system — the file is never made available to the user

- timestamp: 2026-03-28T00:07:00Z
  checked: Sender side — does the sender's file get lost too?
  found: The sender uploads from their local filesystem (File object from input). The sender already has the file. The symptom says "neither user has the file" — this likely means the RECEIVER doesn't have the file. The sender's original file is still on their machine.
  implication: The core issue is receiver-side: the received file is never persisted or downloadable

- timestamp: 2026-03-28T01:01:00Z
  checked: New scenario — connection drop mid-transfer
  found: User reports sender shows "complete" but receiver shows "waiting for peer" and file never arrives. This is a disconnect during transfer, not the happy-path issue already fixed.
  implication: The previous fix (auto-download on complete) only handles happy path. A new investigation is needed for mid-transfer disconnection.

- timestamp: 2026-03-28T01:02:00Z
  checked: use-peer-connection.ts conn.on("close") handler (line 152-159)
  found: When connection closes, if status is NOT "complete", it sets status to "failed" with error "Connection closed unexpectedly". This is the ONLY handling for mid-transfer disconnection. There is no attempt to track how many chunks were received, no reconnect logic, no resume protocol.
  implication: On disconnect, receiver goes to "failed" state — but the user reported seeing "waiting for peer", which means something different may be happening

- timestamp: 2026-03-28T01:03:00Z
  checked: Sender sendFile() flow (line 258-341) — what happens when connection drops mid-send?
  found: The sender's for-loop calls conn.send(message) for each chunk. PeerJS conn.send() is fire-and-forget — it queues data into the RTCDataChannel buffer. The sender has NO way to know if the receiver actually received a chunk. After the loop, it sends a "done" message and immediately sets its own status to "complete". If the connection drops AFTER the sender's loop finishes but BEFORE the receiver gets all chunks, the sender sees "complete" but the receiver is missing chunks.
  implication: The sender's "complete" status is based on "I finished sending" not "receiver confirmed receipt". This is the core race condition.

- timestamp: 2026-03-28T01:04:00Z
  checked: RTCDataChannel reliability semantics
  found: PeerJS connects with { reliable: true } (line 210), which maps to RTCDataChannel ordered + reliable mode. This means the browser's SCTP layer retransmits lost packets. HOWEVER, "reliable" only applies while the connection is alive. If the underlying ICE connection drops (network change, timeout, NAT rebinding), ALL buffered but un-ACKed SCTP data is LOST. The sender's bufferedAmount going to 0 does NOT mean the receiver got the data — it means the local SCTP stack accepted it.
  implication: Even with reliable data channels, a connection drop loses in-flight data. The sender's local send completion is NOT a guarantee of receiver delivery.

- timestamp: 2026-03-28T01:05:00Z
  checked: Does any ACK protocol exist? (grep for "ack", "acknowledge", "confirm" in webrtc/)
  found: NO. There is zero application-level acknowledgment. The receiver never sends anything back to the sender. The transfer protocol is fully one-directional: sender -> chunks -> done. No "I received chunk N" messages flow from receiver to sender.
  implication: Without ACKs, there is no way to know the transfer actually succeeded at the application level, and no way to resume from a known-good checkpoint.

- timestamp: 2026-03-28T01:06:00Z
  checked: Retry mechanism in trade-lobby.tsx (handleRetry, line 429-433)
  found: handleRetry calls setLobbyState("waiting") and retry() from usePeerConnection. The retry() function (line 348-360) destroys the peer entirely and calls initPeer() — a complete restart. chunksRef.current is reset to []. This means on retry, ALL previously received chunks are thrown away and the transfer starts from scratch.
  implication: Even the existing retry is a full restart, not a resume. Any partially received data is lost.

- timestamp: 2026-03-28T01:07:00Z
  checked: P2P-03 requirement status vs actual implementation
  found: REQUIREMENTS.md marks P2P-03 as [x] complete. VERIFICATION.md says "SATISFIED" with evidence "64KB chunks, calculateTransferStats, TransferProgress component". But the requirement text is "File transfer uses chunked transfer with progress indicator and RESUME ON DISCONNECT". The verification only validated chunked transfer + progress. Resume on disconnect was NEVER implemented — it was noted in 09-RESEARCH.md line 823-826 as a recommendation ("retry from last checkpoint") but never built.
  implication: P2P-03 is only partially satisfied. The "resume on disconnect" part was dropped during implementation.

- timestamp: 2026-03-28T01:08:00Z
  checked: Why receiver shows "waiting for peer" instead of "failed"
  found: The user reported receiver shows "waiting for peer" — this corresponds to lobbyState "waiting" in trade-lobby.tsx (line 452). The conn.on("close") handler sets peerState.status to "failed", which should propagate to lobbyState "failed" via the useEffect at line 147-167. BUT — if the Peer object itself is destroyed (not just the DataConnection), the "close" event on the DataConnection may not fire. PeerJS destroys connections when the signaling server drops the peer. In that case, the peer.on("error") at line 235 fires instead. If the error type IS "peer-unavailable" (line 237), it's silently ignored and status is never set to "failed".
  implication: There may be a code path where connection loss is silently swallowed, leaving the receiver stuck in "waiting" state forever

- timestamp: 2026-03-28T02:01:00Z
  checked: User reports "ID is taken" error on retry/reconnect
  found: retry() at line 612-634 calls peerRef.current.destroy() then initPeer(). initPeer() creates new Peer(buildPeerId(tradeId, userId)) with the SAME deterministic ID. PeerJS signaling server has a TTL on peer IDs — destroy() notifies the server but the ID may not be immediately available for re-registration. This causes "ID is taken" error.
  implication: The retry mechanism breaks because it destroys and recreates with the same ID. Need to either (a) avoid destroying, (b) add delay, or (c) use unique IDs on retry.

- timestamp: 2026-03-28T02:02:00Z
  checked: PeerJS reconnect() vs destroy()+new Peer()
  found: PeerJS Peer has a reconnect() method that reconnects to the signaling server using the SAME peer ID without creating a new instance. The existing code already uses it at line 469 for non-transfer signaling disconnects. The retry() function should prefer reconnect() over destroy()+recreate. However, reconnect() only works if the peer is disconnected (not destroyed). If the peer IS destroyed, we need a new Peer — but with a DIFFERENT ID to avoid "ID is taken".
  implication: Two-tier retry strategy: (1) try peer.reconnect() if peer is not destroyed, (2) if that fails or peer is destroyed, create new Peer with unique ID suffix. For case (2), need to broadcast new peer ID to counterparty.

## Resolution

root_cause: |
  ISSUE 1 (previous, fixed): Received file Blob was never persisted/downloaded before lobby navigation destroyed it.

  ISSUE 2 (previous, fixed): Connection drop mid-transfer leaves receiver stuck and file lost (ACK protocol, disconnect detection, resume, receiver-confirmed completion).

  ISSUE 3 (current, NEW): "ID is taken" error on retry/reconnect. The old retry() called peer.destroy() then immediately created new Peer(samePeerId). PeerJS signaling server retains the old peer ID registration for a TTL period after destroy(). The new Peer tries to register the same ID before the server has released it, causing PeerJS error type "unavailable-id" with message "ID is taken".

fix: |
  Previous fixes (ISSUE 1 + 2) remain intact.

  ISSUE 3 fix — Three-tier retry strategy that avoids destroying the Peer whenever possible:

  (1) CASE 1 — Peer still alive and connected to signaling: Only close the DataConnection (not the Peer). Sender re-initiates peer.connect() to receiver's same deterministic ID. Receiver just waits for incoming connection. No ID conflict possible because the Peer is never destroyed/recreated.

  (2) CASE 2 — Peer disconnected from signaling but not destroyed: Call peer.reconnect() which re-registers the same ID with the signaling server. This is PeerJS's built-in mechanism for this exact scenario. No "ID is taken" because reconnect() tells the server "I'm the same peer."

  (3) CASE 3 — Peer fully destroyed (rare, only if PeerJS itself destroyed it due to fatal error): Create new Peer with same deterministic ID. Added "unavailable-id" error handler in initPeer() that catches the "ID is taken" error, waits 2 seconds, and retries (up to 5 times / 10 seconds). This gives the signaling server time to release the old ID.

  Key change: retry() NO LONGER calls peer.destroy(). It only closes the DataConnection. This eliminates the "ID is taken" error in the common case (Cases 1 and 2). Case 3 is a safety net with delay-based retry.

verification: TypeScript compilation passes with zero new errors in any changed file. All pre-existing errors (15, in unrelated test files) unchanged. Fix is targeted to use-peer-connection.ts only.
files_changed:
  - src/lib/webrtc/chunked-transfer.ts (added ACK/resume/receiver-complete message types, highestContiguousChunk + countReceivedChunks helpers)
  - src/lib/webrtc/use-peer-connection.ts (ACK protocol, disconnect vs failed state, resume on reconnect, receiver-confirmed completion, readyToSend handshake, three-tier retry without peer destroy, unavailable-id error handling)
  - src/app/(protected)/trades/[id]/_components/trade-lobby.tsx (disconnected lobby state, RETRY_AND_RESUME UI, readyToSend-based auto-send)
