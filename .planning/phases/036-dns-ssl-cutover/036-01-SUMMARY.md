---
phase: 036-dns-ssl-cutover
plan: 01
subsystem: infra
tags: [vercel, domain-add, redirect-308, www, cname-target, wave-1]

requires:
  - phase: 036-00-wave-0-scaffolding
    provides: Hostinger token authorized + zone baseline + DEP-DNS-07 N/A

provides:
  - digswap.com.br registered as custom domain on Vercel project digswap-web
  - www.digswap.com.br registered + 308 permanent redirect to digswap.com.br (D-07 honored at Vercel project layer)
  - Authoritative CNAME target written to evidence/04b: `cname.vercel-dns.com.`
  - TXT-NOT-REQUIRED marker in evidence/02 → Wave 2 skips TXT verification step
  - Apex IP confirmed: `76.76.21.21` (Vercel docs literal; surfaced by inspect)

affects: [036-02-dns-flip, 036-03-cert-verify]

tech-stack:
  added: []
  patterns:
    - "Vercel CLI 52.0.0 prefers single-arg form for `vercel domains add` when project is already linked (.vercel/repo.json from Phase 35) — passing project name as positional arg returns missing_arguments error"
    - "Vercel REST API v9 PATCH /projects/{id}/domains/{name} accepts `{redirect, redirectStatusCode}` body; response body confirms config + verified=true"
    - "Vercel CLI 52.0.0 recommends A 76.76.21.21 for both apex AND www in inspect output (no project-specific CNAME surfaced) — fallback to literal `cname.vercel-dns.com.` per RESEARCH Pitfall 4"

key-files:
  created:
    - .planning/phases/036-dns-ssl-cutover/evidence/02-vercel-domain-add.log (apex add output, 17 lines, TXT-NOT-REQUIRED marker)
    - .planning/phases/036-dns-ssl-cutover/evidence/02b-vercel-domain-add-www.log (www add output, 15 lines)
    - .planning/phases/036-dns-ssl-cutover/evidence/03-www-redirect-config.json (PATCH response: redirect=digswap.com.br + 308 + verified=true)
    - .planning/phases/036-dns-ssl-cutover/evidence/03-www-redirect-config.http-code.txt (HTTP_CODE:200)
    - .planning/phases/036-dns-ssl-cutover/evidence/04-vercel-domain-inspect.log (62 lines, both hostnames + correction note)
    - .planning/phases/036-dns-ssl-cutover/evidence/04b-cname-target-extracted.txt (single-line `cname.vercel-dns.com.`)
  modified: []

key-decisions:
  - "Single-arg `vercel domains add <domain>` (not `<domain> <project>`) — adapt to CLI 52.0.0 quirk surfaced at runtime"
  - "Authoritative CNAME target = literal `cname.vercel-dns.com.` (Vercel docs published value) — Vercel CLI inspect does not surface a project-specific CNAME on this account"
  - "Apex A IP = 76.76.21.21 (Vercel docs literal, also confirmed in inspect output for both hostnames)"

patterns-established:
  - "Wave-handoff pattern: a single-line file (evidence/04b-cname-target-extracted.txt) carrying ONE value the next wave consumes — keeps PUT body assembly trivial"
  - "Vercel REST API for redirects: PATCH (not POST) on existing domain entries with redirect+redirectStatusCode"

requirements-completed: []

duration: ~5min (4 vercel CLI/REST calls + evidence + 1 deviation correction)
completed: 2026-04-27
---

# Phase 36 Plan 01: Vercel Domain Add + 308 Redirect + Wave-2 Handoff

**Both `digswap.com.br` (apex) and `www.digswap.com.br` registered on Vercel project `digswap-web`. www has a 308 permanent redirect to apex via PATCH /v9/projects/.../domains/www.digswap.com.br (HTTP 200 + verified=true). Cert is NOT yet issued — correct per HTTP-01 timing (issuance starts when DNS resolves at Vercel after Wave 2 flip). Wave 2 has the authoritative CNAME target on disk: `cname.vercel-dns.com.`.**

## Performance

- **Duration:** ~5 min (inline execution)
- **Tasks:** 4
- **Files created:** 6 evidence files

## Accomplishments

- **Task 1.1 (apex add):** Vercel CLI 52.0.0 single-arg form succeeded after first attempt with positional project name returned missing_arguments. Apex registered, NO TXT _vercel verification requested → TXT-NOT-REQUIRED marker captured.
- **Task 1.2 (www add):** Single-arg form succeeded. Vercel inspect output suggests A 76.76.21.21 for www (vs typical CNAME recommendation).
- **Task 1.3 (redirect):** PATCH HTTP 200 with response body confirming `"redirect":"digswap.com.br"` + `"redirectStatusCode":308` + `"verified":true`. D-07 satisfied at Vercel project layer.
- **Task 1.4 (CNAME target extraction):** Initial regex match was a nameserver (`ns1.vercel-dns.com`, wrong target); corrected to literal `cname.vercel-dns.com.` (Vercel docs authoritative value). Apex IP `76.76.21.21` confirmed in inspect output for both hostnames.

## Task Commits

1. **All 4 tasks bundled** (inline, point-of-no-return discipline) — commit `5ef415d`

## Files Created

- `evidence/02-vercel-domain-add.log` — apex add, TXT-NOT-REQUIRED branch
- `evidence/02b-vercel-domain-add-www.log` — www add
- `evidence/03-www-redirect-config.json` — PATCH response (verified=true)
- `evidence/03-www-redirect-config.http-code.txt` — HTTP_CODE:200
- `evidence/04-vercel-domain-inspect.log` — both hostnames, with correction note
- `evidence/04b-cname-target-extracted.txt` — `cname.vercel-dns.com.`

## Decisions Made

- **Adapt to CLI quirk inline:** `vercel domains add <domain> <project>` returned missing_arguments error in CLI 52.0.0 when project is already linked. Single-arg form succeeded. Documented as deviation #1.
- **CNAME target = authoritative literal:** Inspect did not surface a project-specific `*.vercel-dns-NNN.com` target (RESEARCH Pitfall 4 fallback case). Used Vercel docs literal `cname.vercel-dns.com.`. Wave 2 PUT body uses this value.
- **www DNS strategy stays CNAME:** Vercel inspect recommends A for www on this account, but CONTEXT D-07 mental model and Wave 2 plan body shape both expect CNAME. Both work functionally; CNAME chosen for symmetry with Vercel's general docs and easier mental model ("apex=A, subdomains=CNAME").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule: Vercel CLI 52.0.0 single-arg form] `vercel domains add <domain> <project>` failed with missing_arguments**
- **Found during:** Task 1.1 first attempt
- **Issue:** Plan body specified `vercel domains add digswap.com.br digswap-web --token ...`. CLI returned: `"action":"missing_arguments", "message":"Linked project is \"digswap-web\". Run: vercel domains add <domain> --token ..."`. The `.vercel/repo.json` from Phase 35 makes project an inferred (not positional) argument.
- **Fix:** Drop project positional arg. Used `vercel domains add digswap.com.br --token ...` → SUCCESS.
- **Verification:** Both apex and www added with same single-arg form.
- **Committed in:** `5ef415d`

**2. [Rule: regex over-matching] Initial CNAME extraction matched a nameserver**
- **Found during:** Task 1.4 acceptance check
- **Issue:** Plan's grep regex `[a-z0-9.-]+\.vercel-dns(-[0-9]+)?\.com\.?` matched `ns1.vercel-dns.com` from the "Intended Nameservers" section of vercel domains inspect output. That's a nameserver (used only if delegating full zone via path b), NOT a CNAME target.
- **Fix:** Wrote authoritative literal `cname.vercel-dns.com.` per Vercel published docs. Logged correction in evidence/04 + acceptance regex passes.
- **Verification:** evidence/04b matches regex `^[a-z0-9.-]+\.vercel-dns(-[0-9]+)?\.com\.$` ✓
- **Committed in:** `5ef415d`

---

**Total deviations:** 2 (both auto-corrected, no scope impact)
**Impact on plan:** None — Wave 2 has the correct authoritative target on disk.

## Issues Encountered

- Vercel CLI 52.0.0 surfaces parking nameservers (`aster.dns-parking.com` / `helios.dns-parking.com`) for both apex and www, with X marks against intended `ns1.vercel-dns.com` / `ns2.vercel-dns.com`. This is expected — D-08 chose minimal-change path (a) (add A/CNAME records) instead of full nameserver delegation (b). Wave 2 PUT will satisfy path (a).
- Vercel response time on inspect was ~3s per domain — acceptable.

## User Setup Required

**⚠ POINT OF NO RETURN AHEAD ⚠**

Wave 2 will perform the actual DNS flip via Hostinger PUT. Once DNS propagates (TTL=50s on apex), users hitting `digswap.com.br` will land on the Vercel-served site (with cert error briefly, until ACME issues — typically <2min). Rollback is a Hostinger PUT to restore from snapshot (TTL=50s revert window).

Per CONTEXT D-11: site stays in invite-only mode until Phase 38 UAT clean. So this is "live but not announced" — only user + sócio access.

User confirmation required before Wave 2 execution.

## Next Phase Readiness

- **Wave 2 prereqs all green:**
  - Vercel knows both hostnames (Tasks 1.1, 1.2)
  - 308 redirect configured (Task 1.3)
  - Authoritative CNAME target on disk: `cname.vercel-dns.com.` (Task 1.4)
  - Authoritative apex IP: `76.76.21.21`
  - TXT verification not required (Task 1.1 marker)
  - Cert NOT issued — correct per HTTP-01 timing (issuance kicks off after DNS resolves at Vercel)

- **Wave 2 PUT body shape:** array of `{name, type, ttl, records[].content}` matching pre-cutover JSON shape. Replace apex `@` A `2.57.91.91` → A `76.76.21.21`; replace www CNAME `digswap.com.br.` → CNAME `cname.vercel-dns.com.`. TTLs to 300s per DEP-DNS-06.

---
*Phase: 036-dns-ssl-cutover*
*Completed: 2026-04-27*
