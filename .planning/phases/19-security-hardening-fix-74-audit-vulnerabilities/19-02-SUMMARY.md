---
phase: 19-security-hardening-fix-74-audit-vulnerabilities
plan: 02
subsystem: security
tags: [webrtc, sha256, rpc, rate-limiting, ttl, handoff-token, trade-runtime]

# Dependency graph
requires:
  - phase: 17-desktop-trade-runtime
    provides: Desktop trade runtime with WebRTC chunked transfer, lease RPC calls, and handoff token infrastructure
provides:
  - Hash validation hardening that rejects null expectedSha256 (no sender fallback)
  - In-memory RPC throttle for trade lease operations (5s per function per trade)
  - Aligned handoff token TTL to 30s across trade-domain, web handoff-token, and web handoff-store
affects: [desktop-trade-runtime, webrtc-transfers, handoff-protocol]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level in-memory throttle map for SECURITY DEFINER RPC rate limiting"
    - "Non-nullable function parameter to enforce caller-side null checks via TypeScript"

key-files:
  created: []
  modified:
    - apps/desktop/src/main/webrtc/chunked-transfer.ts
    - apps/desktop/src/main/trade-runtime.ts
    - packages/trade-domain/src/constants.ts
    - apps/web/src/lib/desktop/handoff-token.ts

key-decisions:
  - "expectedSha256 changed from string|null to string in receiveFile — TypeScript enforces non-null at all call sites"
  - "RPC throttle is module-scoped (not class field) so it persists across DesktopTradeRuntime lifecycle"
  - "Release throttle still runs local cleanup even when RPC is skipped — only network call is gated"

patterns-established:
  - "Module-level Map throttle pattern for rate-limiting Supabase RPC calls in Electron main process"

requirements-completed: [SEC-AUDIT-02, SEC-AUDIT-03, SEC-AUDIT-04]

# Metrics
duration: 4min
completed: 2026-04-04
---

# Phase 19 Plan 02: Security Audit Fixes Summary

**Hash validation hardening (no sender fallback), RPC lease throttle (5s/fn/trade), and TTL alignment (30s everywhere)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-04T17:58:54Z
- **Completed:** 2026-04-04T18:02:46Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- receiveFile now rejects transfer when expectedSha256 is null, closing the sender hash forgery vector
- Three trade lease RPC calls (acquire, heartbeat, release) throttled to 1 call per 5 seconds per function per trade
- Handoff token TTL aligned at 30_000ms in trade-domain constants and web handoff-token.ts, matching the 30s in handoff-store.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Reject transfer when DB hash is null** - `f1c3e4c` (fix)
2. **Task 2: Add in-memory RPC throttle for trade lease operations** - `292206e` (fix)
3. **Task 3: Align handoff token TTL to 30 seconds** - `68d88b9` (fix)

## Files Created/Modified
- `apps/desktop/src/main/webrtc/chunked-transfer.ts` - Removed sender hash fallback, added early null check, changed type to non-nullable
- `apps/desktop/src/main/trade-runtime.ts` - Added module-level RPC throttle map, applied to 3 RPC call sites, added null guard for senderDeclaredHash at receiveFile call site
- `packages/trade-domain/src/constants.ts` - Changed TRADE_HANDOFF_TOKEN_TTL_MS from 60_000 to 30_000
- `apps/web/src/lib/desktop/handoff-token.ts` - Changed TOKEN_TTL_MS from 60_000 to 30_000, updated JSDoc

## Decisions Made
- expectedSha256 parameter type changed from `string | null` to `string` -- TypeScript now enforces non-null at compile time, making the security invariant a type-level guarantee
- RPC throttle placed at module scope (not class field) -- persists across DesktopTradeRuntime lifecycle, shared across any instances
- Release throttle skips only the network call when throttled, local cleanup (clearInterval, activeLeases.delete, emitLobbyState) still executes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all changes are complete security fixes with no placeholder code.

## Next Phase Readiness
- All three security audit findings from plan 02 are resolved
- Changes are backward-compatible with existing trade flow
- No migration or environment variable changes needed

---
*Phase: 19-security-hardening-fix-74-audit-vulnerabilities*
*Completed: 2026-04-04*

## Self-Check: PASSED
