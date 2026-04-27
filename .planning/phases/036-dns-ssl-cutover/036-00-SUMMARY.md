---
phase: 036-dns-ssl-cutover
plan: 00
subsystem: infra
tags: [dns, hostinger, scaffolding, snapshot, dep-dns-07-na, wave-0]

requires:
  - phase: 035-vercel-environment-wiring
    provides: Vercel project digswap-web LIVE on https://digswap-web.vercel.app

provides:
  - Hostinger API token at ~/.hostinger-token (48 bytes ASCII no BOM/newline) — authorizes DNS API (HTTP 200 confirmed)
  - Pre-cutover zone snapshot (rollback baseline) — evidence/01-pre-cutover-zone.json
  - MAX_OLD_TTL_SECONDS=300 (www CNAME) — drives Wave 2 pre-lower wait window
  - DEP-DNS-07 N/A confirmed by construction (MX entries=0 in pre-cutover zone, D-04 honored)
  - Snapshot list endpoint live (HTTP 200, body []) — Hostinger auto-creates on first PUT (Wave 2)
  - Hostinger MCP registered at user scope (`hostinger-api-mcp@latest`) for future sessions

affects: [036-01-vercel-domain-add, 036-02-dns-flip, 036-04-summary]

tech-stack:
  added: []
  patterns:
    - "Hostinger DNS API: GET /api/dns/v1/zones/{domain} returns top-level array (NOT wrapped in {zone: [...]}) — list of {name, records[], ttl, type}"
    - "Hostinger snapshot list: GET /api/dns/v1/snapshots/{domain} returns 200 + [] for fresh zones; auto-creates snapshot on first mutating PUT"
    - "Token-on-disk via printf '%s' (no newline) in git-bash — avoids PowerShell 5.1 UTF-16 LE BOM issue (Phase 35 lesson)"

key-files:
  created:
    - .planning/phases/036-dns-ssl-cutover/evidence/00-token-handling.md (sanitized, zero token bytes)
    - .planning/phases/036-dns-ssl-cutover/evidence/01-pre-cutover-zone.json (HTTP 200, valid JSON)
    - .planning/phases/036-dns-ssl-cutover/evidence/01-pre-cutover-zone.http-code.txt
    - .planning/phases/036-dns-ssl-cutover/evidence/01b-mx-na-confirm.txt (DEP-DNS-07 N/A by construction)
    - .planning/phases/036-dns-ssl-cutover/evidence/01c-max-old-ttl.txt (MAX_OLD_TTL_SECONDS=300)
    - .planning/phases/036-dns-ssl-cutover/evidence/03-snapshot-list.json ([])
    - .planning/phases/036-dns-ssl-cutover/evidence/03-snapshot-list.http-code.txt
    - .planning/phases/036-dns-ssl-cutover/evidence/03b-snapshot-rollback-readme.txt
  modified: []

key-decisions:
  - "Hostinger DNS API top-level shape is array (NOT wrapped) — Wave 2 PUT body must match this shape"
  - "Apex A TTL=50s already (super low), www CNAME TTL=300s — Wave 2 may skip pre-lower entirely since TTLs already short"
  - "DEP-DNS-07 N/A confirmed by construction (MX=0); Wave 2 PUT body must NOT introduce MX entries"
  - "Hostinger MCP installed at user scope but session restart required to load tools — Phase 36 proceeds with curl path; MCP becomes available for Phase 37+"

patterns-established:
  - "Phase-36 evidence convention: numbered (00, 01, 01b, 01c, 03, 03b) + sanitized + sidecar HTTP code files"
  - "Hostinger API discovery: response shapes documented in evidence inline (not just in RESEARCH.md) so Wave 2 can read evidence directly"

requirements-completed: [DEP-DNS-07]

duration: ~10 min (token paste + 3 curl calls + evidence + commit)
completed: 2026-04-27
---

# Phase 36 Plan 00: Wave 0 Scaffolding + Pre-Cutover Snapshot

**Hostinger API token placed (48 bytes ASCII, GET zone returns 200), pre-cutover zone captured as rollback baseline (apex `@` A `2.57.91.91` Hostinger parking IP + www CNAME `digswap.com.br.`, MAX_OLD_TTL=300s), DEP-DNS-07 N/A confirmed by construction (MX entries=0 per D-04), Hostinger snapshot list endpoint verified live (HTTP 200 body `[]` — auto-creates on first mutating PUT). Wave 1 prerequisites all green; no external state mutated yet — safe to abort/retry idempotently.**

## Performance

- **Duration:** ~10 min (inline execution, no subagent spawn)
- **Tasks:** 4 (1 checkpoint:human-action + 3 auto)
- **Files created:** 8 evidence files

## Accomplishments

- **Task 0.1 (token):** User pasted token (50 chars, formato `Af...58`). printf one-shot wrote 48 bytes (encoding strips trailing chars to ASCII). `wc -c` = 48; `file` = "ASCII text, with no line terminators". GET /api/dns/v1/zones/digswap.com.br returned HTTP 200 with zone JSON — token authorizes.
- **Task 0.2 (snapshot):** Captured zone state. JSON shape is **top-level array** (not `{zone: [...]}`); 2 records: `www` CNAME `digswap.com.br.` (ttl=300) + `@` A `2.57.91.91` (ttl=50). MAX_OLD_TTL_SECONDS=300 written for Wave 2 wait-window calc.
- **Task 0.3 (DEP-DNS-07):** MX count = 0 → N/A by construction. Reasoning aligned with CONTEXT D-04 (no email at cutover; Phase 37 owns Resend MX).
- **Task 0.4 (snapshot list):** GET endpoint live, returned `[]` (no prior snapshots). Wave 2's first PUT will trigger auto-snapshot creation. Rollback API contract documented.
- **Bonus:** Hostinger MCP (`hostinger-api-mcp@latest`) installed at user scope — `claude mcp list` shows ✓ Connected. Tools require session restart to load; Phase 36 proceeds with curl per plan.

## Task Commits

1. **All 4 tasks bundled** (inline execution, point-of-no-return discipline) — commit `c70f849`

## Files Created

- `evidence/00-token-handling.md` — token placement audit (28 lines, zero token bytes)
- `evidence/01-pre-cutover-zone.json` — full pre-cutover zone state
- `evidence/01-pre-cutover-zone.http-code.txt` — `HTTP_CODE:200`
- `evidence/01b-mx-na-confirm.txt` — DEP-DNS-07 N/A confirmation (12 lines)
- `evidence/01c-max-old-ttl.txt` — `MAX_OLD_TTL_SECONDS= 300`
- `evidence/03-snapshot-list.json` — `[]`
- `evidence/03-snapshot-list.http-code.txt` — `HTTP_CODE:200`
- `evidence/03b-snapshot-rollback-readme.txt` — Wave 2 rollback contract

## Decisions Made

- **Inline execution over subagent spawn:** Wave 0 has 1 checkpoint:human-action (token) followed by 3 trivial auto tasks (3 curl calls). Spawning a gsd-executor would add overhead without benefit; orchestrator inline is cheaper and gives clearer checkpoint-handling surface.
- **Hostinger MCP install (bonus):** registered for Phase 37+ but NOT used in Phase 36 (would require session restart, costing the fresh Phase 35→36 context). Trade-off accepted by user.

## Deviations from Plan

### Auto-classified Issues

**1. [Rule: token-shape variance] User pasted token in chat (50 chars), printf wrote 48 bytes**
- **Found during:** Task 0.1 byte count verification
- **Issue:** Token displayed had 50 visible chars; `wc -c ~/.hostinger-token` reported 48. Difference likely due to whitespace stripping by `printf '%s'` or bash arg-parsing of the raw string.
- **Resolution:** Verified via functional test — GET zone returned HTTP 200 with valid JSON. Token authorizes regardless of edge-of-string ambiguity.
- **Verification:** evidence/01-pre-cutover-zone.json (HTTP 200) end-to-end proves token works.
- **Committed in:** `c70f849`

**2. [Rule: token leak per Phase 35 lesson] User pasted token in chat literal (vs the printf-direct-from-clipboard pattern)**
- **Found during:** Task 0.1 setup
- **Issue:** Phase 35 D-19 pattern says "do NOT paste into chat — paste directly to printf". User pasted the token text in chat (twice, in JSON config snippets) before running printf locally.
- **Resolution:** Same risk-acceptance pattern as Phase 35 Vercel token (user explicit "rlxa ninguém vai ter acesso ao site ainda, só eu e meu sócio"). Logged as POST-PHASE-36 TODO: rotate token before public announce.
- **Committed in:** `c70f849` (todo logged in evidence/00 + global TodoWrite)

---

**Total deviations:** 2 (1 cosmetic byte-count, 1 token leak with explicit risk acceptance per Phase 35 precedent)
**Impact on plan:** None — DEP-DNS-07 fully resolved; functional probe proves token authorizes API.

## Issues Encountered

- Hostinger DNS API is undocumented in places (response shape for snapshot list per RESEARCH §Open Questions #1) — empirically confirmed array shape via fresh-zone GET. Pattern logged for Wave 2.

## User Setup Required

None for Wave 1.

## Next Phase Readiness

- **Wave 1 (Vercel domain add) UNBLOCKED:** zone baseline + rollback contract captured; safe to add `digswap.com.br` + `www.digswap.com.br` to Vercel project `digswap-web` (prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY) and let Vercel emit `_vercel` TXT verification record.
- **TTL pre-lower analysis:** apex A already at TTL=50 (no need to pre-lower); www CNAME at TTL=300 (5min wait) — Wave 2 may proceed without explicit pre-lower since current zone is already at low TTL. Decision deferred to Wave 2 plan reading.

---
*Phase: 036-dns-ssl-cutover*
*Completed: 2026-04-27*
