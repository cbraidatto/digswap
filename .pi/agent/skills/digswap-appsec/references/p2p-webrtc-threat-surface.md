# P2P And WebRTC Threat Surface

Use this file for PeerJS, signaling, TURN or STUN setup, handoff tokens, trade sessions, file transfer, and desktop handoff behavior.

## Core Risks

- Peer spoofing or unauthorized peer attachment
- Replay of handoff tokens or stale leases
- Tampered metadata such as filename, size, content type, or chunk count
- Resource exhaustion through oversized files, too many chunks, or too many concurrent sessions
- Confused ownership where one trade session can affect another
- Sensitive metadata leakage through logs, analytics, or relay infrastructure

## Secure Design Rules

- Bind every transfer to an authenticated trade context.
- Use short-lived, one-time tokens for peer handoff.
- Expire leases aggressively and reject replay.
- Validate all transfer metadata before any local write or UI trust.
- Normalize filenames and reject path separators or unsafe extensions.
- Cap file size, chunk size, session duration, and concurrent transfers.
- Separate signaling trust from file-transfer trust; successful signaling is not authorization.

## PeerJS And Signaling Checks

- Do not expose predictable peer identifiers without server-side authorization context.
- Treat signaling messages as attacker-controlled.
- Prefer server-issued metadata over peer-asserted metadata.
- Record enough telemetry to investigate abuse without logging sensitive content.

## Verification

- Test stale token replay.
- Test cross-trade token reuse.
- Test chunk reordering, duplication, truncation, and oversized metadata.
- Test malicious filenames and MIME spoofing.
- Test denial-of-service limits and timeout recovery.
