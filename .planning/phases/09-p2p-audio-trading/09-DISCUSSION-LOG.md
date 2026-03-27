# Phase 9: P2P Audio Trading — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 09-p2p-audio-trading
**Areas discussed:** DMCA & ToS gate, Trade initiation entry points, WebRTC / signaling, Trade lobby UI, Trade inbox

---

## DMCA & ToS Gate

| Option | Description | Selected |
|--------|-------------|----------|
| Admin flag + ToS modal | P2P_ENABLED env var disables trading at system level; per-user ToS modal gates individual use | ✓ |
| ToS modal only | Assume DMCA handled offline; only per-user ToS gate | |
| Admin flag only | System-level flag, no per-user ToS step | |

**User's choice:** Admin flag + ToS modal (Recommended)
**Notes:** Two-layer protection — system flag for DMCA readiness, per-user acceptance for individual legal coverage (SEC-06).

---

## Trade Initiation Entry Points

| Option | Description | Selected |
|--------|-------------|----------|
| Profile + /explorar | Request Audio from public profile and /explorar search results | |
| Profile only | Single entry point via public profile only | |
| All three + notifications | Profile, /explorar, AND quick Request Trade from wantlist match notifications | ✓ |

**User's choice:** All three + notifications
**Notes:** Maximum discoverability — surfaces trade action wherever users encounter someone with a record they want.

---

## WebRTC / Signaling

| Option | Description | Selected |
|--------|-------------|----------|
| PeerJS Cloud + Metered TURN | PeerJS Cloud signaling + Metered.ca managed TURN from day one | ✓ |
| PeerJS Cloud, STUN only | PeerJS Cloud + Google STUN only (SEC-07 not fully met) | |
| Self-hosted PeerServer + Metered TURN | Self-hosted signaling + managed TURN (more ops overhead) | |

**User's choice:** PeerJS Cloud + Metered TURN (Recommended)
**Notes:** Zero ops for signaling; Metered.ca TURN satisfies SEC-07 (no user IP exposure) and addresses the ~15-20% connection failure rate with symmetric NATs.

---

## Trade Lobby UI

| Option | Description | Selected |
|--------|-------------|----------|
| Async request + live lobby | Async trade request (recipient can be offline) + real-time /trades/[id] lobby once both accept | ✓ |
| Synchronous only | Both users must be online to send — simpler state machine | |
| Async request, simple redirect | Async request + form page, no live lobby | |

**User's choice:** Async request + live lobby (Recommended)
**Notes:** Balances async UX (don't require both online at request time) with the P2P-04 requirement (both must be online during transfer). Supabase Realtime + PeerJS events drive the lobby state machine.

---

## Trade Inbox

| Option | Description | Selected |
|--------|-------------|----------|
| /trades inbox page | Dedicated /trades index with PENDING/ACTIVE/COMPLETED tabs | ✓ |
| Notifications only | No inbox — each notification links directly to /trades/[id] | |
| Profile section | Inbox as a TRADES tab inside /perfil page | |

**User's choice:** /trades inbox page (Recommended)
**Notes:** Clean dedicated space for trade management; consistent with the scope of Phase 9 introducing trades as a first-class feature.

---

## Claude's Discretion

- Visual treatment for [P2P_DISABLED] compliance notice
- Trade request expiry window (proposed: 48h)
- P2P_ENABLED: env var vs Supabase config table
- Monthly trade counter reset: pg_cron vs check-on-read
- ToS placeholder copy (legal review before launch)
- Audio spectrum analysis: Web Audio API (AnalyserNode → FFT) — not discussed with user, Claude's call
- Trade reputation display on profile: simple stat line — not discussed with user, Claude's call

## Deferred Ideas

- Stripe upgrade flow — Phase 10
- Browser push notifications — deferred per REQUIREMENTS.md
- Real-time online indicator for trading — v2 (DISC2-V2-01)
- Scheduled / async trade requests — v2 (DISC2-V2-02)
