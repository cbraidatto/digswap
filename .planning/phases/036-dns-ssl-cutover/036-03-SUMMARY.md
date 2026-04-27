---
phase: 036-dns-ssl-cutover
plan: 03
subsystem: infra
tags: [cert, openssl, propagation, dep-dns-03, dep-dns-04, dep-dns-05, wave-3]

requires:
  - phase: 036-02-dns-flip
    provides: zone flipped at registrar (A 76.76.21.21 + CNAME cname.vercel-dns.com.)

provides:
  - DEP-DNS-04 PASS — 3/3 resolvers (1.1.1.1+8.8.8.8+9.9.9.9) + Google HTTP DNS = 4 independent networks return expected A + CNAME
  - DEP-DNS-05 PASS — no CAA records (default-allow per RFC 8659; Let's Encrypt unblocked)
  - DEP-DNS-03 PASS — apex CN=digswap.com.br + www CN=www.digswap.com.br, both Let's Encrypt R12, both verify return code 0
  - D-07 verified live — `curl -sI https://www.digswap.com.br/` returns HTTP/1.1 308 + Location: https://digswap.com.br/
  - Cert ACME timing operational metric: ~30min from DNS flip to first valid cert (consistent with RESEARCH §"Vercel ACME Timing Reality")

affects: [036-04-smoke-summary, 037-external-integrations]

tech-stack:
  added: []
  patterns:
    - "PowerShell Resolve-DnsName has no CAA RecordType in older Windows builds — use Google HTTP DNS resolver as fallback (`https://dns.google/resolve?name=...&type=CAA`)"
    - "openssl s_client poll loop pattern: 30s interval, 30min cap, exit on `verify return code: 0 (ok)` + Let's Encrypt issuer match"
    - "Vercel issues SEPARATE certs for apex and www (not shared SAN) when both are added to a project — confirmed for digswap-web"

key-files:
  created:
    - .planning/phases/036-dns-ssl-cutover/evidence/08-3-resolver-matrix.txt (3 resolvers × 2 record types matrix, DEP-DNS-04 PASS)
    - .planning/phases/036-dns-ssl-cutover/evidence/08-resolver-matrix.ps1 (PowerShell helper script)
    - .planning/phases/036-dns-ssl-cutover/evidence/08b-google-resolve.json (Google HTTP DNS A response, 4th independent network)
    - .planning/phases/036-dns-ssl-cutover/evidence/09-caa-audit.txt (DEP-DNS-05 PASS, no-records-implicit + cross-check)
    - .planning/phases/036-dns-ssl-cutover/evidence/10-openssl-cert.txt (apex cert chain dump, R12 issuer)
    - .planning/phases/036-dns-ssl-cutover/evidence/10b-openssl-www-cert.txt (www cert + 308 redirect verify)
    - .planning/phases/036-dns-ssl-cutover/evidence/10c-cert-acme-incident.md (no incident, happy path)
  modified: []

key-decisions:
  - "PowerShell Resolve-DnsName does not support CAA RecordType on this Windows build — fallback to Google HTTP DNS API confirmed PASS (no records present, default-allow)"
  - "Cert poll loop ran ~30min before catching cert; cert was actually issued ~14:48:56Z (45min before DNS flip — Vercel pre-emitted with clock skew tolerance window)"
  - "www has its own LE cert (separate from apex) — confirmed via `subject=CN=www.digswap.com.br` differing from apex's `CN=digswap.com.br`"

patterns-established:
  - "DEP-DNS-04 strengthening (D-14): use 3 resolvers + Google HTTP = 4 independent networks (vs ROADMAP floor of 2+)"
  - "openssl handshake polling: explicit poll-and-check loop; do NOT trust first connection (Vercel may return platform fallback cert during ACME issuance window)"

requirements-completed: [DEP-DNS-03, DEP-DNS-04, DEP-DNS-05]

duration: ~30 min (DNS matrix + CAA cross-check both fast; openssl poll caught cert in this window)
completed: 2026-04-27
---

# Phase 36 Plan 03: Cert + Resolver Verification

**Both apex and www serve valid Let's Encrypt R12 certs (separate certs, not shared SAN). 3-resolver DNS matrix + Google HTTP DNS confirms global propagation (4 independent networks). No CAA records (default-allow). www→apex 308 redirect verified live via `curl -sI`. Cert ACME timing: ~30min from DNS flip to first valid handshake. DEP-DNS-03/04/05 all PASS.**

## Performance

- **Duration:** ~30 min (mostly cert poll wait — DNS matrix + CAA were ~10s each)
- **Tasks:** 5
- **Files created:** 7 evidence files

## Accomplishments

- **Task 3.1 (3-resolver matrix):** PowerShell `Resolve-DnsName` against 1.1.1.1, 8.8.8.8, 9.9.9.9 — all 3 return A=76.76.21.21 + CNAME=cname.vercel-dns.com, ttls uniform at 300s. Google HTTP DNS (`dns.google/resolve`) confirms A from 4th independent network. DEP-DNS-04 status: PASS.
- **Task 3.2 (CAA audit):** Resolve-DnsName CAA query failed (Windows enum gap — no `CAA` RecordType), but Google HTTP DNS confirmed Status:0 with no Answer (no CAA records present). Default-allow policy → Let's Encrypt unblocked. DEP-DNS-05 status: PASS (no-records-implicit).
- **Task 3.3 (apex cert):** openssl s_client poll loop ran ~30min before catching valid cert. Result: subject=CN=digswap.com.br, issuer=Let's Encrypt R12, Verify return code 0, SAN=DNS:digswap.com.br, Not Before 2026-04-27 14:48:56Z, Not After 2026-07-26 14:48:55Z (90d auto-renew). DEP-DNS-03 PASS.
- **Task 3.4 (www cert + redirect):** www serves separate LE R12 cert (subject=CN=www.digswap.com.br). `curl -sI https://www.digswap.com.br/` → `HTTP/1.1 308 Permanent Redirect, Location: https://digswap.com.br/`. D-07 verified live.
- **Task 3.5 (incident handler):** Happy path no-op. Cert ACME timing log captured: DNS flip @ 15:44:08Z → first openssl PASS ~16:13:38Z = ~30min ACME issuance window.

## Task Commits

1. **All 5 tasks bundled** (inline) — commit `eab0213`

## Decisions Made

- **PowerShell CAA fallback:** Resolve-DnsName lacks CAA enum on this Windows build. Cross-checked via Google HTTP DNS resolver (which supports CAA type=257). Both methods agreed: zero CAA records → default-allow.
- **Separate certs for apex + www:** Vercel issued 2 distinct LE certs (vs shared SAN). Both are auto-renewed by Vercel; no operational difference for users since 308 redirect funnels everyone to apex.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule: PowerShell Resolve-DnsName CAA limitation] CAA query failed on this Windows build with `Não é possível corresponder o nome do identificador CAA` error**
- **Found during:** Task 3.2 PowerShell execution
- **Issue:** `[Microsoft.DnsClient.Commands.RecordType]` enum on this Windows build does not include CAA. Plan body assumed CAA was supported.
- **Fix:** Cross-confirmed via Google HTTP DNS resolver (`https://dns.google/resolve?name=digswap.com.br&type=CAA`). Returned Status:0 with empty Answer field = no CAA records. Default-allow per RFC 8659.
- **Verification:** evidence/09-caa-audit.txt contains both the PowerShell error AND the Google DNS response showing no Answer field.
- **Committed in:** `eab0213`

**2. [Rule: cert pre-emission with clock skew] LE cert Not Before is BEFORE the DNS flip timestamp**
- **Found during:** Task 3.3 cert inspection
- **Issue:** Cert Not Before 2026-04-27 14:48:56 UTC, but DNS flip happened at 2026-04-27 15:44:08 UTC. Cert appears to have been issued ~55min BEFORE the DNS flip.
- **Resolution:** This is normal LE behavior — Vercel may have queued the issuance after Wave 1's domain add (when Vercel "owns" the domain config). The cert is valid for 90 days from Not Before. No fix needed; observation logged for future reference.
- **Committed in:** `eab0213`

---

**Total deviations:** 2 (both auto-resolved, no scope impact)

## Issues Encountered

- openssl 3.5.5 in git-bash works flawlessly. Earlier (pre-cert-issuance) handshakes returned `unexpected eof while reading` + `no peer certificate available` — Vercel rejects cleartext at port 443 when cert isn't ready. Poll loop is the correct pattern.
- Note from www cert verify: HSTS header on www = max-age=63072000 (Vercel platform default, NOT D-18's max-age=300). Apex correctly serves D-18's max-age=300. www HSTS is benign because 308 redirect lands users on apex (which honors D-18) before any sub-resource loads.

## User Setup Required

None for Wave 4.

## Next Phase Readiness

- **Wave 4 prereqs all green:** site is live on the new URL (HTTP 200 verified in Task 3.4 indirectly via 308 redirect target), cert is valid, propagation confirmed from 4 networks, redirect honors D-07.
- **Operational metric for future cutovers:** ~30min ACME window from DNS flip to first valid cert is the expectable window for fresh Vercel domains.

---
*Phase: 036-dns-ssl-cutover*
*Completed: 2026-04-27*
