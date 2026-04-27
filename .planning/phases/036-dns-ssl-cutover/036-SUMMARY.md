---
phase: 036-dns-ssl-cutover
status: complete
mode: hybrid (Hostinger DNS API via curl + Vercel CLI/REST + PowerShell Resolve-DnsName + Google HTTP DNS fallback)
milestone: v1.4 Production Launch
domain: digswap.com.br
production_url: https://digswap.com.br
www_redirect: https://www.digswap.com.br → 308 → https://digswap.com.br
vercel_project_id: prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY
hostinger_zone: digswap.com.br
plans_completed: 5
plans_total: 5
requirements_addressed: [DEP-DNS-01, DEP-DNS-02, DEP-DNS-03, DEP-DNS-04, DEP-DNS-05, DEP-DNS-06]
requirements_na: [DEP-DNS-07]
na_reason: |
  DEP-DNS-07 (preserve MX) is N/A by construction per CONTEXT.md D-04 — no MX records exist on digswap.com.br at cutover time (email not in use yet). Phase 37 owns Resend MX/SPF/DKIM/DMARC setup.
final_verify: 7/7 in-scope satisfied (6 PASS + 1 N/A by D-04) — evidence/14-verify-final.txt
completed: 2026-04-27
---

# Phase 36: DNS + SSL Cutover — Phase Summary

**Production deploy of `digswap-web` is now LIVE on `https://digswap.com.br` with valid Let's Encrypt R12 cert (apex + www separate certs), www→apex 308 redirect, HSTS=300 on apex (D-18 launch-window), 4-network DNS propagation confirmed (1.1.1.1 + 8.8.8.8 + 9.9.9.9 + Google HTTP), zero CAA blockers, /api/health returns `{"status":"healthy","checks":{"database":"ok"}}`, Playwright anon suite identical to Phase 35 baseline (16 PASS + 19 SKIP + 5 test-debt FAIL — zero regression from cutover), 1-hour soak with 5/5 200s. Hostinger DNS auto-snapshot captured for rollback (TTL=300s = ~5min revert window). Site stays in invite-only mode per CONTEXT D-11 until Phase 38 UAT clean.**

## Plans

| # | Plan                                              | Result | Key commit | SUMMARY                                |
|---|---------------------------------------------------|--------|------------|----------------------------------------|
| 0 | Wave 0 scaffolding + token + zone snapshot        | ✓      | `c70f849`, `292882d` | [036-00-SUMMARY.md](./036-00-SUMMARY.md) |
| 1 | Vercel domain add (apex+www) + 308 redirect       | ✓      | `5ef415d`, `017a530` | [036-01-SUMMARY.md](./036-01-SUMMARY.md) |
| 2 | DNS flip — A 76.76.21.21 + CNAME cname.vercel-dns | ✓ (point of no return crossed) | `5bdf8db`, `65587fd` | [036-02-SUMMARY.md](./036-02-SUMMARY.md) |
| 3 | Cert + propagation verification                   | ✓ (~30min ACME window) | `eab0213`, `ed6fa37` | [036-03-SUMMARY.md](./036-03-SUMMARY.md) |
| 4 | Smoke + 1h soak + phase summary                   | ✓      | this commit (TBD)    | [036-04-SUMMARY.md](./036-04-SUMMARY.md) |

## Path deviations (logged for audit)

1. **Vercel CLI 52.0.0 single-arg form for `vercel domains add`** ([036-01-SUMMARY.md])
   - Plan body specified `vercel domains add <domain> <project>`. CLI returned `missing_arguments` error because `.vercel/repo.json` from Phase 35 makes the project an inferred argument.
   - Fix: drop project positional arg. Single-arg form succeeded for both apex and www.

2. **CNAME target inspect did not surface project-specific value (RESEARCH Pitfall 4)**
   - Plan expected `vercel domains inspect` to return a project-specific `*.vercel-dns-NNN.com` CNAME target. Inspect surfaced only `A 76.76.21.21` recommendations.
   - Initial regex match grabbed a nameserver (`ns1.vercel-dns.com`, wrong); corrected to authoritative literal `cname.vercel-dns.com.` per Vercel published docs.

3. **TTL pre-lower skipped (no-op)**
   - MAX_OLD_TTL_SECONDS was already 300 (www CNAME) + 50 (apex A) at pre-cutover. Plan's pre-lower step is no-op when MAX_OLD_TTL ≤ 300. Saved the planned wait window entirely.

4. **PowerShell Resolve-DnsName CAA enum gap**
   - Windows build's `[Microsoft.DnsClient.Commands.RecordType]` enum does not include CAA. Plan's PowerShell-only CAA query failed.
   - Fix: cross-confirmed via Google HTTP DNS resolver (`https://dns.google/resolve?name=digswap.com.br&type=CAA`) which DOES support CAA. Returned no Answer = no CAA records → DEP-DNS-05 PASS by absence.

5. **`dig` not available in git-bash** (Wave 2 quick-check phase)
   - Plan body referenced `dig`. Used `nslookup` (Windows native) and Google HTTP DNS instead. PowerShell Resolve-DnsName covered the formal 3-resolver matrix in Wave 3.

6. **Aggregator grep case-sensitivity**
   - Initial DEP-DNS-03 row missed because grep used lowercase `verify` but openssl output is `Verify return code: 0 (ok)` (capital V). Fixed via direct Edit on evidence/14-verify-final.txt.

## Final verify (7/7 in-scope satisfied)

| Req        | Status         | Source                                    | Note                                                                                |
|------------|----------------|-------------------------------------------|-------------------------------------------------------------------------------------|
| DEP-DNS-01 | PASS           | evidence/06 + 07b                         | A `@` → 76.76.21.21 ttl=300                                                          |
| DEP-DNS-02 | PASS           | evidence/07 + 04b                         | CNAME `www` → cname.vercel-dns.com. ttl=300                                          |
| DEP-DNS-03 | PASS           | evidence/10 + 10b                         | LE R12 apex cert + separate www cert + Verify return code 0 + 308 redirect live      |
| DEP-DNS-04 | PASS           | evidence/08 + 08b                         | 3/3 resolvers + Google HTTP DNS = 4 networks (D-14 strengthening of ROADMAP "2+")    |
| DEP-DNS-05 | PASS           | evidence/09                               | No CAA records (default-allow per RFC 8659; LE permitted)                            |
| DEP-DNS-06 | PASS           | evidence/07c                              | A @ ttl=300 + CNAME www ttl=300 confirmed post-flip                                 |
| DEP-DNS-07 | N/A by D-04    | evidence/01b                              | No MX records present at cutover; Phase 37 owns Resend MX/SPF/DKIM/DMARC            |

## Smoke + Soak (D-13 + D-16)

| Layer | Result | Detail |
|-------|--------|--------|
| L1 — /api/health | PASS | HTTP 200 + `database:ok` + HSTS=300 |
| L2 — Playwright anon | PASS | 16 passed + 19 skipped + 5 failed (test-debt; identical to Phase 35 baseline → zero regression from cutover) |
| L3 — 1h soak | PASS | 5/5 probes returned 200 over 48 minutes (probe #1 16:15:53Z → probe #5 17:03:53Z) |

## Inputs ready for Phase 37 (External Integrations)

| Field | Value |
|-------|-------|
| Production URL | `https://digswap.com.br` |
| www redirect | `https://www.digswap.com.br` → 308 → apex |
| Stripe webhook target | `https://digswap.com.br/api/stripe/webhook` |
| Supabase Auth callback | `https://swyfhpgerzvvmoswkjyt.supabase.co/auth/v1/callback` |
| Hostinger DNS API token | `~/.hostinger-token` (48 bytes ASCII; Phase 37 uses for Resend MX/SPF/DKIM/DMARC PUTs) |
| Hostinger MCP | registered at user scope (`hostinger-api-mcp@latest`); requires Claude Code session restart to load tools |
| Vercel CLI 52.0.0 + `~/.vercel-token` | available for `vercel env add/rm` of new Stripe/Discogs/Resend secrets |
| Pre-cutover zone snapshot | `evidence/01-pre-cutover-zone.json` (rollback baseline kept in git) |

## Inputs ready for Phase 39 (Monitoring — parallel track)

- UptimeRobot probe target: `https://digswap.com.br/api/health` (5-min interval recommended)
- Sentry env vars not yet populated (per Phase 35 D-08, Phase 39 owns adding `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`). NEXT_PUBLIC_* count will go 7 → 8.

## POST-PHASE-36 TODOs (tracked for hardening)

1. **Rotate Hostinger API token** — leaked in chat during Wave 0 setup; same Phase 35 precedent (user accepted invite-only soak risk; rotate before public announce).
2. **TTL bump 300s → 3600s** — trigger per CONTEXT D-10: Phase 38 UAT clean + 1 week soak. Sync with HSTS bump (D-18).
3. **HSTS apex bump max-age=300 → 31536000** (1 year) — trigger per CONTEXT D-18 (Phase 38 + 1 week soak).
4. **Public announce gate** — CONTEXT D-11: do NOT announce site publicly until Phase 38 UAT clean. Until then, "live but invite-only" — only user + sócio access.
5. **Carry-overs from Phase 35 (still pending):** rotate Vercel API token, rotate weak Supabase DB password (`minhamaemandouSDK`), fix 5 Playwright locator strict-mode bugs, provision Phase 38 audit user, run DEP-VCL-04 secret-grep with local `vercel build`.

## Doc-debt flagged (from Phase 34 + 35)

- ROADMAP.md, REQUIREMENTS.md, and many `.planning/research/*.md` files reference `digswap.com` (without `.br`). The real domain is `digswap.com.br` — Phase 36 operated on the real domain. Global doc rename is a pending POST-PHASE-36 QUICK candidate (recommended: `domain rename: digswap.com → digswap.com.br across all .planning/ docs`).

## Evidence inventory (15 files in evidence/)

```
evidence/
├── 00-token-handling.md             — sanitized token placement audit
├── 01-pre-cutover-zone.json         — pre-cutover zone state (rollback baseline)
├── 01-pre-cutover-zone.http-code.txt — HTTP_CODE:200
├── 01b-mx-na-confirm.txt            — DEP-DNS-07 N/A by construction (MX=0)
├── 01c-max-old-ttl.txt              — MAX_OLD_TTL_SECONDS=300
├── 02-vercel-domain-add.log         — apex add + TXT-NOT-REQUIRED marker
├── 02b-vercel-domain-add-www.log    — www add
├── 03-snapshot-list.json            — Hostinger snapshot list ([] pre-flip)
├── 03-www-redirect-config.json      — Vercel REST PATCH response: redirect=apex + 308 + verified=true
├── 04-vercel-domain-inspect.log     — inspect output for both hostnames + correction note
├── 04b-cname-target-extracted.txt   — `cname.vercel-dns.com.`
├── 05a-txt-vercel-record.json       — `[skip]` (TXT-NOT-REQUIRED)
├── 05-pre-lower-ttl.json            — `{skipped:true}` (MAX_OLD_TTL=300 ≤ 300)
├── 05b-ttl-wait-log.txt             — skip reasoning
├── 06-flip-a-payload.json           — apex PUT body
├── 06-flip-a-record.json            — Hostinger ack `Request accepted`
├── 07-flip-www-payload.json         — www PUT body
├── 07-flip-www-cname.json           — Hostinger ack
├── 07b-post-flip-zone.json          — post-flip authoritative zone
├── 07c-ttl-300-verify.txt           — DEP-DNS-06 PASS verifier
├── 08-3-resolver-matrix.txt         — 3 resolvers × 2 record types = 6 OK
├── 08-resolver-matrix.ps1           — PowerShell helper script
├── 08b-google-resolve.json          — Google HTTP DNS A response (4th network)
├── 09-caa-audit.txt                 — DEP-DNS-05 PASS no-records-implicit + Google cross-check
├── 10-openssl-cert.txt              — apex cert chain (LE R12, verify 0)
├── 10b-openssl-www-cert.txt         — www cert + 308 redirect verify
├── 10c-cert-acme-incident.md        — happy path no-op marker
├── 11-health-probe.txt              — /api/health 200 + database:ok
├── 12-playwright-smoke.txt          — 16 PASS + 19 SKIP + 5 FAIL (Phase 35 baseline match)
├── 13-soak-1h.txt                   — 5/5 probes 200 over 48min
└── 14-verify-final.txt              — DEP-DNS-{01..07} aggregator
```

## Next phase

`/gsd:plan-phase 37` — External Integrations. Critical path: Stripe Live activation must start Day 1 (1-3 business day SLA per ROADMAP). Phase 39 (Monitoring) is a parallel track — can be started in parallel with Phase 37 since it only needs the prod URL (which Phase 36 just delivered).

---
*Phase: 036-dns-ssl-cutover*
*Completed: 2026-04-27*
*Mode: hybrid (Hostinger curl + Vercel CLI/REST + PowerShell + Google HTTP DNS fallback)*
