---
phase: 9
slug: p2p-audio-trading
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/unit/trades/ --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/trades/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 0 | P2P-01, P2P-05, P2P-06, SEC-05, SEC-06, SEC-07 | unit | `npx vitest run tests/unit/trades/ -x` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 1 | SEC-05, SEC-06 | unit | `npx vitest run tests/unit/trades/p2p-gate.test.ts tests/unit/trades/tos-gate.test.ts -x` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 1 | P2P-01 | unit | `npx vitest run tests/unit/trades/create-trade.test.ts -x` | ❌ W0 | ⬜ pending |
| 09-03-01 | 03 | 1 | P2P-03 | unit | `npx vitest run tests/unit/trades/chunked-transfer.test.ts -x` | ❌ W0 | ⬜ pending |
| 09-03-02 | 03 | 1 | SEC-07 | unit | `npx vitest run tests/unit/trades/turn-credentials.test.ts -x` | ❌ W0 | ⬜ pending |
| 09-04-01 | 04 | 2 | P2P-02, P2P-04 | manual | Browser test: two tabs, initiate transfer | N/A | ⬜ pending |
| 09-04-02 | 04 | 2 | P2P-05, P2P-06 | unit | `npx vitest run tests/unit/trades/trade-review.test.ts tests/unit/trades/trade-reputation.test.ts -x` | ❌ W0 | ⬜ pending |
| 09-05-01 | 05 | 2 | P2P-07 | unit | `npx vitest run tests/unit/trades/trade-counter.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/trades/create-trade.test.ts` — P2P-01 trade creation server action
- [ ] `tests/unit/trades/trade-review.test.ts` — P2P-05, P2P-06 review submission + reputation update
- [ ] `tests/unit/trades/trade-reputation.test.ts` — P2P-06 average rating computation
- [ ] `tests/unit/trades/p2p-gate.test.ts` — SEC-05 P2P_ENABLED check
- [ ] `tests/unit/trades/tos-gate.test.ts` — SEC-06 ToS acceptance flow
- [ ] `tests/unit/trades/turn-credentials.test.ts` — SEC-07 TURN credentials fetched server-side only
- [ ] `tests/unit/trades/chunked-transfer.test.ts` — P2P-03 chunk/reassemble logic (pure function, no WebRTC)
- [ ] `tests/unit/trades/trade-counter.test.ts` — freemium enforcement (5/month limit, reset logic)

Test pattern: `vi.mock()` for full module isolation — no real DB or API calls. Mock Supabase admin client chain, mock Drizzle db thenable chain, mock PeerJS Peer class. Follows existing project convention from Phase 7-8 tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| File transfer via WebRTC DataChannel (no server relay of file data) | P2P-02 | WebRTC requires real browser; jsdom/vitest cannot emulate RTCPeerConnection | Open two browser windows logged in as different users. Initiate trade. Verify file arrives in second window. Check network tab — no upload to server domain should appear. |
| Both users must be online simultaneously | P2P-04 | WebRTC connection drop is network-level behavior | Start trade lobby with two users. Close one browser tab. Verify the transfer fails / lobby shows FAILED state. Reopen tab, verify reconnect prompts correctly. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
