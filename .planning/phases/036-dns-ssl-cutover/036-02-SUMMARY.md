---
phase: 036-dns-ssl-cutover
plan: 02
subsystem: infra
tags: [dns-flip, hostinger-put, point-of-no-return, dep-dns-01, dep-dns-02, dep-dns-06, wave-2]

requires:
  - phase: 036-01-vercel-domain-add
    provides: Vercel owns digswap.com.br + www; 308 redirect; CNAME target on disk

provides:
  - DEP-DNS-01 satisfied at registrar layer: A `@` = 76.76.21.21 ttl=300
  - DEP-DNS-02 satisfied at registrar layer: CNAME `www` = cname.vercel-dns.com. ttl=300
  - DEP-DNS-06 verified: both flipped records confirmed at ttl=300
  - DEP-DNS-04 essentially pre-satisfied: 3 resolvers (1.1.1.1, 8.8.8.8, 9.9.9.9) already return new A within seconds (apex was at ttl=50, no stale cache)

affects: [036-03-cert-verify, 036-04-smoke-summary]

tech-stack:
  added: []
  patterns:
    - "Hostinger PUT zone API: response is `{\"message\":\"Request accepted\"}` (async ack, NOT echo of new state) — must follow with GET to verify"
    - "Hostinger overwrite=true semantics: replaces matching (name,type) entries; required to swap apex parking IP without leaving duplicates"
    - "Pre-lower TTL skip rule: if MAX_OLD_TTL ≤ 300, skip the wait window — already-low TTLs serve as natural pre-lower"

key-files:
  created:
    - .planning/phases/036-dns-ssl-cutover/evidence/05a-txt-vercel-record.json (`[skip]` marker)
    - .planning/phases/036-dns-ssl-cutover/evidence/05-pre-lower-ttl.json (`{skipped:true}`)
    - .planning/phases/036-dns-ssl-cutover/evidence/05b-ttl-wait-log.txt (skip reasoning)
    - .planning/phases/036-dns-ssl-cutover/evidence/06-flip-a-payload.json (apex PUT body)
    - .planning/phases/036-dns-ssl-cutover/evidence/06-flip-a-record.json (HTTP 200 ack)
    - .planning/phases/036-dns-ssl-cutover/evidence/06-flip-a-record.http-code.txt (HTTP_CODE:200)
    - .planning/phases/036-dns-ssl-cutover/evidence/07-flip-www-payload.json (www PUT body)
    - .planning/phases/036-dns-ssl-cutover/evidence/07-flip-www-cname.json (HTTP 200 ack)
    - .planning/phases/036-dns-ssl-cutover/evidence/07-flip-www-cname.http-code.txt
    - .planning/phases/036-dns-ssl-cutover/evidence/07b-post-flip-zone.json (post-flip authoritative state)
    - .planning/phases/036-dns-ssl-cutover/evidence/07b-post-flip-zone.http-code.txt
    - .planning/phases/036-dns-ssl-cutover/evidence/07c-ttl-300-verify.txt (DEP-DNS-06 PASS, 2/2)
  modified: []

key-decisions:
  - "TTL pre-lower skipped: MAX_OLD_TTL=300 already at threshold (CONTEXT D-10 lower bound); no wait window needed"
  - "TXT-NOT-REQUIRED branch active: Wave 1 confirmed Vercel domain add succeeded without TXT verification request"
  - "Hostinger PUT response is async ack (`message:Request accepted`) — verification done via separate GET (Task 2.4) not response body"

patterns-established:
  - "Hostinger PUT body: `{overwrite: bool, zone: [{name, type, ttl, records:[{content}]}]}` — single zone[] entry per (name,type) pair"
  - "Wave 2 self-verification flow: PUT ack → GET zone → python validator on JSON → exit code drives next task"

requirements-completed: [DEP-DNS-01, DEP-DNS-02, DEP-DNS-06]

duration: ~2min (skip-skip-PUT-PUT-verify; no TTL wait, no TXT step)
completed: 2026-04-27
---

# Phase 36 Plan 02: DNS Flip + TTL Pre-Lower (skipped) + Verify

**Apex A `@` flipped to `76.76.21.21` and www CNAME flipped to `cname.vercel-dns.com.` via Hostinger DNS API PUT (HTTP 200 + `Request accepted` async ack on each). Post-flip GET confirms both records at ttl=300 — DEP-DNS-06 PASS. TXT-NOT-REQUIRED + TTL pre-lower both skipped (no-op branches). Quick post-flip nslookup from 3 resolvers (1.1.1.1/8.8.8.8/9.9.9.9) already returns the new A record, suggesting global propagation is essentially complete in seconds. Cert ACME issuance kicks off automatically on Vercel side; Wave 3 verifies.**

## Performance

- **Duration:** ~2 min (no TTL wait, no TXT step, 2 PUTs + 1 GET + 1 verify)
- **Tasks:** 5
- **Files created:** 12 evidence files

## Accomplishments

- **Task 2.0:** TXT-NOT-REQUIRED skip branch — `[skip]` marker in evidence/05a (Wave 1 confirmed no TXT _vercel record needed).
- **Task 2.1:** TTL pre-lower SKIPPED — `{"skipped":true,"reason":"max_old_ttl=300 <= 300"}`. Pre-cutover zone already had TTL=50 (apex) + TTL=300 (www), so no wait window needed.
- **Task 2.2:** PUT apex A `@` → `76.76.21.21` ttl=300. HTTP 200 with body `{"message":"Request accepted"}` (Hostinger async ack pattern). DEP-DNS-01 satisfied at registrar.
- **Task 2.3:** PUT www CNAME → `cname.vercel-dns.com.` ttl=300. HTTP 200 + `Request accepted`. DEP-DNS-02 satisfied at registrar.
- **Task 2.4:** GET post-flip zone HTTP 200; python verifier confirms `[ok] CNAME www ttl=300` + `[ok] A @ ttl=300`; DEP-DNS-06 status: PASS (2/2 hits, 0 fails).

**Bonus early-check:** nslookup from 1.1.1.1, 8.8.8.8, 9.9.9.9 all return 76.76.21.21 immediately post-flip — DEP-DNS-04 effectively pre-satisfied. (Wave 3 captures formal evidence files.)

## Task Commits

1. **All 5 tasks bundled** (inline, point-of-no-return discipline) — commit `5bdf8db`

## Files Created

See key-files.created above (12 files).

## Decisions Made

- **Skip TTL pre-lower:** MAX_OLD_TTL=300 already matches the cutover-week target (CONTEXT D-10). No pre-lower needed — Pitfall 1 mitigated by zone's existing low TTLs.
- **Skip TXT verification:** Wave 1 confirmed Vercel did not request a TXT _vercel record (TXT-NOT-REQUIRED marker). Skip branch active.
- **Async ack interpretation:** Hostinger PUT returns `{"message":"Request accepted"}` not the new zone state. Verification via separate GET zone (Task 2.4) — design choice mirrors Hostinger API contract.

## Deviations from Plan

**None.** All 5 tasks executed cleanly per plan body.

## Issues Encountered

- **`dig` not available** in Windows git-bash. Switched to `nslookup` for the early propagation check (Wave 3 plan body uses `dig`; will need same `nslookup` substitution there).

## User Setup Required

None for Wave 3.

## Next Phase Readiness

- **Wave 3 prereqs all green:** zone is flipped, both records confirmed at the registrar, resolvers already see new A. Wave 3 starts the cert + global-propagation + smoke verification.
- **Vercel ACME:** HTTP-01 challenge will succeed any time now (resolvers see Vercel's IP → Vercel's edge serves the .well-known/acme-challenge response → Let's Encrypt issues cert).
- **Rollback handle:** Hostinger auto-snapshot was created on this PUT — Wave 3 can fetch the snapshot list fresh if rollback needed.

---
*Phase: 036-dns-ssl-cutover*
*Completed: 2026-04-27*
