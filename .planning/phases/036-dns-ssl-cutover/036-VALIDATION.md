---
phase: 36
slug: dns-ssl-cutover
status: draft
nyquist_compliant: false
nyquist_acknowledged_undersample: true
wave_0_complete: false
created: 2026-04-27
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Mixed test framework: openssl + PowerShell `Resolve-DnsName` + curl + Playwright.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Mixed: openssl 3.5.5 (git-bash) + PowerShell `Resolve-DnsName` + curl 8.18.0 + Playwright (Phase 35) |
| **Config file** | `apps/web/playwright.config.ts` (already supports `PLAYWRIGHT_BASE_URL` env override — Phase 35 Plan 01) |
| **Quick run command** | `curl -fsSI https://digswap.com.br/api/health` (single request, returns 200 + database:ok body when probed; < 2s) |
| **Full suite command** | `cd apps/web && PLAYWRIGHT_BASE_URL=https://digswap.com.br pnpm test:e2e` |
| **Estimated runtime** | quick: ~2s · full: ~5 min (16 anon Playwright tests; same as Phase 35 baseline) |

---

## Sampling Rate

- **After every task commit:** `curl -fsSI https://digswap.com.br/api/health` (cheap one-shot HEAD probe)
- **After every plan wave:** 3-resolver matrix (`Resolve-DnsName -Server {1.1.1.1,8.8.8.8,9.9.9.9}`) + openssl s_client one-shot
- **Before `/gsd:verify-work`:** Full Playwright anon suite green + 5× `/api/health` over 1h soak
- **Max feedback latency:** quick ~2s · per-wave ~30s · phase gate ~1h+5min

**Nyquist undersample acknowledgment** (per RESEARCH.md §"Validation Architecture" + D-13):
- Fastest variation in scope: TTL=300s record changes → 1/300 Hz. Nyquist requires sampling at ≥ 2/300 Hz (every 150s).
- D-13 schedule = 5 samples / 3600s = 1/720 Hz (one sample every 12 min). **Undersampled by ~4-5x.**
- **Acceptable rationale:** invite-only soak (D-11), no SLO commitments, primary failure modes are step-functions (cert revoked, DNS reverted, app crashes) rather than oscillations. The full Playwright suite + openssl one-shot detect step-function failures regardless of sampling rate. Documented in evidence/11-verify-final.txt at phase close.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 36-00-01 | 00 | 0 | (prereq) | manual checkpoint | user pastes Hostinger token to `~/.hostinger-token` via `printf '%s' '<token>'` | N/A | ⬜ pending |
| 36-00-02 | 00 | 0 | (snapshot) | smoke | `curl -H "Authorization: Bearer $(cat ~/.hostinger-token)" https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br > evidence/01-pre-cutover-zone.json` | ✅ curl | ⬜ pending |
| 36-00-03 | 00 | 0 | DEP-DNS-07 (N/A confirm) | smoke | `grep -i '"type"\s*:\s*"MX"' evidence/01-pre-cutover-zone.json \|\| echo "no MX records — DEP-DNS-07 N/A confirmed"` | ✅ | ⬜ pending |
| 36-01-01 | 01 | 1 | DEP-VCL ext (Vercel domain add) | smoke | `vercel domains add digswap.com.br --token $(cat ~/.vercel-token) > evidence/02-vercel-domain-add.log 2>&1` | ✅ vercel CLI 52 | ⬜ pending |
| 36-01-02 | 01 | 1 | (www add) | smoke | `vercel domains add www.digswap.com.br --token $(cat ~/.vercel-token) >> evidence/02-vercel-domain-add.log 2>&1` | ✅ | ⬜ pending |
| 36-01-03 | 01 | 1 | (www → apex 308 redirect) | smoke | Vercel API PATCH `/v9/projects/digswap-web/domains/www.digswap.com.br` with `redirect=digswap.com.br` + `redirectStatusCode=308` → save response in evidence/03-www-redirect-config.json | ✅ curl | ⬜ pending |
| 36-01-04 | 01 | 1 | (CNAME target discover) | smoke | `vercel domains inspect digswap.com.br --token $(cat ~/.vercel-token) > evidence/04-vercel-domain-inspect.log` (extract CNAME target Vercel expects) | ✅ | ⬜ pending |
| 36-02-01 | 02 | 2 | (TTL pre-lower) | smoke | Hostinger PUT `/zones/digswap.com.br` with existing values + ttl=300, overwrite=true → evidence/05-pre-lower-ttl.json + wait `max(old_TTL)` seconds | ✅ curl | ⬜ pending |
| 36-02-02 | 02 | 2 | DEP-DNS-01 | smoke | Hostinger PUT with A `@ → 76.76.21.21` ttl=300 → evidence/06-flip-a-record.json | ✅ curl | ⬜ pending |
| 36-02-03 | 02 | 2 | DEP-DNS-02 | smoke | Hostinger PUT with CNAME `www → <vercel-cname-target-from-evidence/04>` ttl=300 → evidence/07-flip-www-cname.json | ✅ curl | ⬜ pending |
| 36-02-04 | 02 | 2 | DEP-DNS-06 | smoke | parse evidence/06 + 07 for `"ttl": 300` on every changed record | ✅ jq | ⬜ pending |
| 36-03-01 | 03 | 3 | DEP-DNS-04 | smoke | `Resolve-DnsName digswap.com.br -Type A -Server {1.1.1.1,8.8.8.8,9.9.9.9}` × 3 must all return 76.76.21.21 → evidence/08-3-resolver-matrix.txt | ✅ PS | ⬜ pending |
| 36-03-02 | 03 | 3 | DEP-DNS-05 | smoke | `Resolve-DnsName digswap.com.br -Type CAA -Server 1.1.1.1` + `curl https://dns.google/resolve?name=digswap.com.br&type=CAA` → evidence/09-caa-audit.txt; PASS if empty OR contains letsencrypt.org | ✅ | ⬜ pending |
| 36-03-03 | 03 | 3 | DEP-DNS-03 | smoke | `openssl s_client -connect digswap.com.br:443 -servername digswap.com.br -showcerts </dev/null 2>&1 \| grep -E "issuer=\|subject=\|verify return code"` → evidence/10-openssl-cert.txt; PASS = "verify return code: 0" + issuer Let's Encrypt | ✅ git-bash openssl | ⬜ pending |
| 36-03-04 | 03 | 3 | (cert ACME timeout > 30min handling) | manual checkpoint | if 30min elapsed without cert: dig CAA + `_acme-challenge` TXT + Vercel runtime logs → checkpoint:human-action per D-09/D-17 | manual | ⬜ pending |
| 36-04-01 | 04 | 4 | (D-16 smoke) | smoke | `curl -fsS https://digswap.com.br/api/health \| jq .` returns 200 + database:ok → evidence/11-health-probe.txt | ✅ | ⬜ pending |
| 36-04-02 | 04 | 4 | (D-16 Playwright) | integration | `cd apps/web && PLAYWRIGHT_BASE_URL=https://digswap.com.br pnpm test:e2e` → 16 anon PASS expected (5 known test-debt FAIL same as Phase 35) → evidence/12-playwright-smoke.txt | ✅ | ⬜ pending |
| 36-04-03 | 04 | 4 | (D-13 soak) | smoke loop | 5× curl `/api/health` over 1h (12-min intervals) → evidence/13-soak-1h.txt | ✅ | ⬜ pending |
| 36-04-04 | 04 | 4 | (final verify aggregator) | smoke | combine evidence/01-13 into evidence/14-verify-final.txt with 7-row DEP-DNS-{01..07} status table | manual aggregation | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] User generates Hostinger API token at https://hpanel.hostinger.com → API tokens, places at `~/.hostinger-token` via `printf '%s' '<token>' > ~/.hostinger-token` (ASCII, no BOM, no trailing newline — same pattern as Phase 35 Vercel token)
- [ ] Pre-cutover zone snapshot captured via `GET /api/dns/v1/zones/digswap.com.br` → `evidence/01-pre-cutover-zone.json`
- [ ] DEP-DNS-07 N/A confirmation (no MX records present in pre-snapshot)
- [ ] No new framework install (Playwright, openssl, curl, vercel CLI all present from Phase 35)

*All other test infrastructure exists from Phase 35. No new dependencies needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hostinger API token generation | (prereq for D-03) | Web UI only; Hostinger doesn't expose token-creation via API | User logs into hpanel.hostinger.com → API → Generate token → paste via printf one-shot |
| Cert ACME timeout > 30min | DEP-DNS-03 (failure path) | Diagnostic requires human judgment on root cause | If openssl fails after 30min: run dig CAA + `_acme-challenge` + Vercel runtime logs; user decides rollback vs continue per D-09 |
| Visual browser check (optional) | (D-16 backup) | Confirms padlock + page render in real browser | User opens https://digswap.com.br in fresh browser profile; padlock green + landing page loads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (✓ — every task has a smoke check)
- [ ] Wave 0 covers all MISSING references (Hostinger token = manual checkpoint, not test infra)
- [ ] No watch-mode flags (Playwright runs one-shot, no `--watch`)
- [ ] Feedback latency < 5min for full suite (~5min Playwright + ~30s resolver matrix)
- [ ] `nyquist_compliant: false` set in frontmatter — undersample acknowledged + rationale documented (invite-only, no SLO, step-function failure modes)

**Approval:** pending (will flip to `nyquist_compliant: false, nyquist_acknowledged: true` at phase close — solo-dev pragmatism documented in evidence/14)
