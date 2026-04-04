# Phase 19: Security Hardening — Fix Remaining Audit Vulnerabilities - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Close out ALL remaining vulnerabilities from the April 3 white-box security audit (DigSwap_SECURITY_AUDIT.md). The audit found 74 total — 67 are already fixed via Codex hardening patch (commit 525a307) and prior security migrations. This phase addresses the final ~7 open items.

**This phase does NOT:**
- Add new features or capabilities
- Create new SQL migrations for already-deployed RLS fixes
- Restructure the trade system architecture
- Touch business logic beyond security hardening

</domain>

<decisions>
## Implementation Decisions

### Scope Reduction
- **D-01:** Phase scope reduced from 74 to ~7 items. The Codex patch + security migrations (20260411, 20260412) resolved the bulk. This phase is a focused cleanup sprint.
- **D-02:** No new Supabase migrations for RLS — migrations 20260411_security_audit_fixes.sql and 20260412_security_audit_phase2.sql already deployed and cover all RLS fixes. Drizzle schemas were aligned in commit 525a307.

### Desktop / Electron Fixes
- **D-03:** BridgeWindow nodeIntegration:true in peer-session.ts — migrate PeerJS bridge window to Electron utilityProcess. This eliminates the need for nodeIntegration:true entirely. The current mitigation (about:blank, no web content loaded) is documented but architecturally weak.
- **D-04:** Hash fallback in chunked-transfer.ts — when expectedSha256 from DB is null, currently falls back to sender-provided hash (trusting the sender). Fix: reject transfer entirely when DB hash is null — no transfer without server-verified hash.

### Rate Limiting
- **D-05:** Trade RPC rate limits (acquire_trade_lease, heartbeat_trade_lease, release_trade_lease) — add application-level rate limiting in the desktop trade-runtime.ts before calling RPCs. These are SECURITY DEFINER functions; abuse = DB DoS. Use a simple in-memory throttle (1 call per 5s per function per trade).

### Configuration Alignment
- **D-06:** Handoff token TTL mismatch — align to 30s everywhere. Web's handoff-store.ts uses 30s (Redis TTL), trade-domain/constants.ts says 60s. The 30s value is correct (shorter = more secure). Update trade-domain constant to match.

### Verification
- **D-07:** Spot-check Drizzle schema alignment against production migrations for all 8 tables (collections, social, groups, group-invites, wantlist, notifications, listening-logs, trades). Verify no policy drift.
- **D-08:** Run full test suite (vitest + tsc) as final gate. All 563+ tests must pass.

### Claude's Discretion
- Implementation details for utilityProcess migration (IPC channel design, process lifecycle)
- In-memory throttle implementation pattern for RPC rate limits
- Test coverage for new fixes (unit tests for TTL alignment, integration tests for hash rejection)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Security Audit
- `C:\Users\INTEL\Desktop\DigSwap_SECURITY_AUDIT.md` — Full 74-vulnerability audit report with severity ratings and fix plan
- `C:\Users\INTEL\Desktop\CODEX_SECURITY_FIX_PROMPT.md` — Tasks 1-4 that were executed by Codex (already applied)

### Applied Migrations (DO NOT MODIFY)
- `supabase/migrations/20260411_security_audit_fixes.sql` — Phase 1 fixes: discogs_tokens RLS, handoffTokens RLS, finalize_trade_transfer validation, trade_requests UPDATE drop, recalculate_rankings REVOKE
- `supabase/migrations/20260412_security_audit_phase2.sql` — Phase 2 fixes: wantlist_items RLS, notifications INSERT block, listening_logs dual policy fix, search_signals unique constraint, acquire_trade_lease terminal check

### Desktop Architecture
- `.planning/phases/17-desktop-trade-runtime/` — Desktop trade runtime context and plans
- `apps/desktop/src/main/webrtc/peer-session.ts` — BridgeWindow with nodeIntegration:true (line 270)
- `apps/desktop/src/main/webrtc/chunked-transfer.ts` — Hash fallback logic (lines 185-190)
- `apps/desktop/src/main/trade-runtime.ts` — RPC call sites for lease/heartbeat

### Configuration
- `apps/web/src/lib/desktop/handoff-store.ts` — HANDOFF_TTL_SECONDS = 30
- `packages/trade-domain/src/constants.ts` — TRADE_HANDOFF_TOKEN_TTL_MS = 60_000 (needs update to 30_000)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web/src/lib/rate-limit.ts` — safeLimit pattern with failClosed parameter; reuse for any new rate limiting
- `apps/desktop/src/main/trade-runtime.ts` — existing RPC call sites for acquire/heartbeat/release lease
- Electron utilityProcess API — available in Electron 22+; used for running Node.js scripts in separate processes

### Established Patterns
- Security migrations use CREATE OR REPLACE FUNCTION for RPC fixes
- Rate limiting uses Upstash Redis with safeLimit wrapper
- Desktop IPC uses typed DesktopBridge interface

### Integration Points
- peer-session.ts BridgeWindow → needs replacement with utilityProcess IPC
- trade-runtime.ts → RPC calls need throttle wrapper before Supabase admin calls
- chunked-transfer.ts → hash validation gate before transfer acceptance

</code_context>

<specifics>
## Specific Ideas

- The BridgeWindow mitigation (about:blank, no web content) is currently documented as "known risk" — the utilityProcess migration is the proper fix
- TTL alignment is a 1-line change but prevents coordination bugs between web handoff and desktop pickup
- Hash rejection (no null fallback) is a security posture improvement — if the server doesn't have a hash, the transfer shouldn't proceed

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 19-security-hardening-fix-74-audit-vulnerabilities*
*Context gathered: 2026-04-04*
