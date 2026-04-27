# Phase 36: DNS + SSL Cutover - Research

**Researched:** 2026-04-27
**Domain:** DNS cutover (Hostinger registrar) + Vercel custom domain + Let's Encrypt ACME issuance + cert verification
**Confidence:** HIGH (Hostinger API endpoints verified via official MCP server source + PHP SDK schema; Vercel domain workflow verified via official docs; Let's Encrypt limits verified via letsencrypt.org)

## Summary

Phase 36 flips `digswap.com.br` from Hostinger's parking IP to the Vercel project `digswap-web` (prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY). Two-step cutover ordered by D-06: (a) Vercel domain add — emits TXT verification + pre-arms ACME — then (b) Hostinger DNS API flip — A record `@ → 76.76.21.21`, CNAME `www → cname.vercel-dns.com`, TTL=300s. Vercel uses **HTTP-01 ACME challenge by default** (NOT DNS-01) — meaning the cert can only issue *after* DNS resolves and traffic reaches Vercel, NOT before. The "pre-emit" framing in D-06 is partially incorrect: Vercel verifies *domain ownership* via TXT pre-flip but cannot issue the cert until DNS points at Vercel. This invalidates the "zero cert-error window" claim and reshapes the soak window.

The Hostinger DNS API is real, well-documented, and feature-complete for this flow: `GET /api/dns/v1/zones/{domain}` (read), `PUT /api/dns/v1/zones/{domain}` (write with overwrite flag), `POST /api/dns/v1/snapshots/{domain}/{snapshotId}/restore` (one-shot rollback). Bearer token auth via Account → API → Generate token. Hostinger publishes an official MCP server (`hostinger-api-mcp` npm package), but it's NOT yet in this project's `.mcp.json`; raw `curl` against the API is the simplest path and avoids adding an MCP dependency mid-cutover.

Local environment audit: `openssl 3.5.5`, `vercel 52.0.0`, `curl 8.18.0` PRESENT; **`dig` NOT installed** — must use PowerShell `Resolve-DnsName` (built-in via DnsClient module, confirmed available) plus the public `dns.google/resolve` JSON API for cross-resolver verification.

**Primary recommendation:** Use `curl + Bearer token` against the Hostinger DNS API (no MCP install, no UI clicks); use `vercel domains add` CLI for Vercel; use `Resolve-DnsName` (PowerShell) for DNS verification and `openssl s_client` (git-bash) for cert verification. UI fallback is a checkpoint:human-action evidence file with a screenshot — only invoked if API errors persist after one retry.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Domínio + Registrar (Area 1)**
- **D-01:** Domínio canonical = `digswap.com.br` (Phase 35 D-10 + project memory). ROADMAP/REQUIREMENTS reference `digswap.com` — doc-debt rastreada como POST-PHASE-36 QUICK.
- **D-02:** Registrar = **Hostinger** (.com.br reseller). Painel próprio de DNS + API pública via token.
- **D-03:** Claude opera DNS programaticamente via Hostinger DNS API (preferred path); fallback para checkpoint:human-action via UI se a API não cobrir o flow ou falhar.
- **D-04:** Email no domínio **não está em uso ainda**. DEP-DNS-07 (preservar MX) é **N/A** para cutover atual — não há MX existente a preservar. Phase 37 owns SPF/DKIM/DMARC + MX para Resend.
- **D-05:** Subdomains nesta fase = **apenas apex + www** (`digswap.com.br` + `www.digswap.com.br`). `app.`, `api.`, `status.` não estão no escopo.

**Estratégia de Cutover + www (Area 2)**
- **D-06:** Ordem = **(a) adicionar `digswap.com.br` + `www.digswap.com.br` no Vercel primeiro** (Vercel emite TXT `_vercel` verification record + pre-emite cert ACME), **depois (b) flip DNS no Hostinger**. Zero janela de cert error pro usuário.
  - **Research caveat (HIGH confidence, Vercel docs):** Vercel uses HTTP-01 ACME challenge for non-wildcard domains. ACME issuance only succeeds **after DNS resolves**, not before. The TXT `_vercel` record is for *domain ownership verification* (when domain is on another Vercel account) and is NOT always required. The "pre-emit cert" claim is partially incorrect — see §"Vercel ACME timing reality" below.
- **D-07:** **Apex `digswap.com.br` = canonical**; `www.digswap.com.br` redireciona via 308 pro apex (Vercel native via "Redirect to" config in Project Settings → Domains).
- **D-08:** Vercel domain config = **CLI + MCP** (`vercel domains add` para writes, MCP `mcp__vercel__*` para reads/inspect; coerente com hybrid pattern Phase 35).
- **D-09:** Cert ACME falha = **checkpoint:human-action no plan**. Plan-phase apresenta opções (rollback DNS imediato vs pause + root-cause).

**TTL + Soak + Announcement (Area 3)**
- **D-10:** TTL durante cutover = **300s** (LOCKED por DEP-DNS-06). Bump para **3600s** = mesmo trigger do HSTS bump (Phase 38 + 1 semana soak).
- **D-11:** Site declarado "no ar" publicamente = **somente após Phase 38 UAT clean**. Phase 36 entrega modo invite-only soak interno.
- **D-12:** UptimeRobot probe externo = **Phase 39 owns** (parallel track).
- **D-13:** Soak window Phase 36 → PASS = **1 hora pós-cert válido** com smoke (3 resolvers + 5× curl `/api/health` + Playwright anon).

**Verificação + Rollback (Area 4)**
- **D-14:** Resolvers para validar propagação = **3 redes independentes**: `1.1.1.1` (Cloudflare) + `8.8.8.8` (Google) + `9.9.9.9` (Quad9).
- **D-15:** Rollback strategy = **zone snapshot ANTES do flip** (salvo em evidence/), restaurado via Hostinger API se falhar. TTL=300s dá ~5min de revert. Backup manual via UI se API der problema.
- **D-16:** Smoke para Phase 36 PASS = **openssl s_client** + **curl /api/health** + **Playwright anon suite** (`PLAYWRIGHT_BASE_URL=https://digswap.com.br`).
- **D-17:** Cert ACME timeout > 30min após DNS flipar = **investigate primeiro** (CAA, _acme-challenge, runtime logs) ANTES de rollback.

**Hostinger API Discovery (Area 5)**
- **D-18:** Acesso programático ao Hostinger DNS = **research aqui**. Resolved: API existe, endpoints documentados em §"Hostinger DNS API" abaixo.
- **D-19:** Token Hostinger = `printf '%s' '<token>' > ~/.hostinger-token` (ASCII, sem BOM, sem newline).

### Claude's Discretion

- Vercel CLI vs MCP exact syntax para `vercel domains add` — research determinou: CLI `vercel domains add` exists and writes; MCP for inspect-only.
- Hostinger DNS API exact endpoints + auth scheme — research determinou: Bearer token + `/api/dns/v1/zones/{domain}` PUT with overwrite flag.
- Evidence file naming — siga padrão Phase 35 (`01-pre-cutover-zone.txt`, etc.).
- Wave structure — recommended: Wave 0 (snapshot + token) → Wave 1 (Vercel domain add + verify) → Wave 2 (DNS flip + propagation) → Wave 3 (cert + smoke + SUMMARY).

### Deferred Ideas (OUT OF SCOPE)

**Para Phase 37:** MX records, SPF/DKIM/DMARC, Stripe webhook URL, OAuth callbacks.
**Para Phase 38:** Public announcement, TTL 300→3600, HSTS 300→31536000, audit user provisioning, 5 Playwright locator fixes.
**Para Phase 39 (parallel):** UptimeRobot, Sentry prod DSN, Vercel Analytics.
**Para POST-PHASE-36 QUICK:** Rename `digswap.com` → `digswap.com.br` global em `.planning/` docs.
**Permanent out of scope:** Subdomains `app.`/`api.`/`status.`, IPv6 (AAAA), DNSSEC.

## Project Constraints (from CLAUDE.md)

- **Solo developer** — favor simplicity, single-step paths, managed services.
- **GSD workflow enforcement** — all file edits gated through GSD commands. This phase is mostly external API calls + DNS + Vercel; minimal repo edits expected (only evidence files).
- **Stack lock from CLAUDE.md** — Next.js 15.x, Vercel hosting, no Cloudflare proxy in front (out of scope per REQUIREMENTS.md). Phase 36 must NOT introduce a new edge layer.
- **Skill alignment** — touches `.pi/agent/skills/digswap-devops/` (Vercel deploy, env mgmt, DNS, SSL) and `.pi/agent/skills/digswap-sre/` (production readiness, incident response). Plan should respect their core rules: never share secrets across environments, monitor before debug, isolate environments completely.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEP-DNS-01 | Hostinger A record `@` → `76.76.21.21` (Vercel apex IP) | §"Vercel DNS targets" + §"Hostinger DNS API — write A record" — exact PUT body provided |
| DEP-DNS-02 | Hostinger CNAME `www` → `cname.vercel-dns.com` | §"Vercel DNS targets" — note: Vercel project-specific CNAME (e.g. `*.vercel-dns-NNN.com`) may be returned instead; `vercel domains inspect` reveals exact value; `cname.vercel-dns.com` is the legacy fallback that still works |
| DEP-DNS-03 | SSL cert issued by Let's Encrypt, verified via `openssl s_client -connect [domain]:443` | §"openssl cert validation" — exact command + parsing pattern + Issuer regex (`R3`/`R10`/`R11`/`E5`/`E6`) |
| DEP-DNS-04 | DNS propagation confirmed from 2+ independent networks (`@1.1.1.1` and `@8.8.8.8`) | §"DNS propagation verification" — 3 resolvers per D-14 (1.1.1.1 + 8.8.8.8 + 9.9.9.9) using PowerShell `Resolve-DnsName` (dig not installed) |
| DEP-DNS-05 | CAA records audited — if any exist, must include `letsencrypt.org` | §"CAA record audit" — `dig CAA` substitute via PowerShell + `dns.google/resolve?type=CAA`; if no CAA exists, default = wildcard allowed |
| DEP-DNS-06 | TTLs set to 300s during cutover week | §"Hostinger DNS API — TTL field" — `ttl: 300` in PUT body; phase-out trigger Phase 38 + 1 semana |
| DEP-DNS-07 | MX records preserved | **N/A per D-04** — no email currently configured. Verify pre-flip zone snapshot has zero MX entries; document in evidence/01-pre-cutover-zone.txt |

## Standard Stack

### Core (writes / state changes)
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| Vercel CLI | 52.x (verified installed) | Add custom domain to Vercel project; capture exact CNAME target + verification TXT | Single-line `vercel domains add` is canonical write surface. Phase 35 confirmed CLI is the write tool, MCP is read-only for project ops. |
| `curl` + Bearer token | curl 8.18.0 (verified installed) | Hostinger DNS API: snapshot, write zone, restore | Avoids adding `hostinger-api-mcp` to `.mcp.json` mid-cutover. Single binary, scriptable, idempotent via overwrite flag. |
| Hostinger DNS API | v1 | DNS zone read/write/snapshot/restore | Documented at developers.hostinger.com; PHP SDK schema confirms exact request body shape. |

### Read / Verify
| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| PowerShell `Resolve-DnsName` | DnsClient 1.0.0.0 (built-in) | DNS lookups against custom resolvers | **dig not installed**; this is the Windows-native substitute. Use `-Server 1.1.1.1` flag for resolver targeting. |
| `openssl s_client` | OpenSSL 3.5.5 (git-bash bundled) | TLS cert chain inspection | Standard. Required for DEP-DNS-03 evidence. |
| `curl -sI` | curl 8.18.0 | Quick HTTP/HSTS/redirect check | Already used Phase 35 (evidence/05); same pattern. |
| Vercel MCP (`mcp__vercel__*`) | (HTTP MCP at `https://mcp.vercel.com`) | Read project state, deploy logs, domain config | Phase 35 hybrid pattern; use for `mcp__vercel__list_projects`, `mcp__vercel__get_deployment`, runtime log inspection during ACME cert wait. |
| `dns.google/resolve?name=X&type=Y` | Public Google API (free) | Browser-free DNS check from independent network | Cross-verifies `Resolve-DnsName` results from a non-local network. Returns JSON with `Answer[]` array. |
| `https://letsdebug.net` (manual) | Public web tool | Diagnose Let's Encrypt issuance failures | Vercel docs explicitly recommend this when cert fails (HTTP-01 path probing, CAA, redirect chain). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hostinger API via curl | `hostinger-api-mcp` npm package + add to `.mcp.json` | Adds a dependency mid-cutover; requires Node 24+ (per MCP server docs) — current local env unverified for Node 24. curl path is portable and explicit. |
| Hostinger API via curl | Hostinger Dashboard UI manual | Slower, error-prone, evidence is screenshots only. Use ONLY as fallback per D-03. |
| `Resolve-DnsName` | Install `bind-tools` (chocolatey: `choco install bind-tools`) for `dig` | Adds install step + admin prompt. `Resolve-DnsName` is already installed and provides identical functionality. |
| `openssl s_client` | `curl -v https://digswap.com.br` (shows cert summary) | curl with Schannel doesn't expose full chain. openssl is canonical for cert evidence. |

**Installation (none required — all tools verified present)**
```bash
# Already installed on the worktree machine (verified 2026-04-27):
openssl version    # OpenSSL 3.5.5 (git-bash /mingw64/bin)
vercel --version   # Vercel CLI 52.0.0
curl --version     # curl 8.18.0

# PowerShell built-in (verified):
powershell -Command "Get-Command Resolve-DnsName"  # DnsClient 1.0.0.0
```

**Version verification:** Tools are local-stable; no `npm view` upgrade needed for this phase. Vercel CLI 52.0.0 was the version used Phase 35 — no upgrade until SUMMARY.

## Architecture Patterns

### Recommended Phase Layout (Wave structure per D-08 discretion)

```
.planning/phases/036-dns-ssl-cutover/
├── 036-CONTEXT.md                  # ✅ exists
├── 036-RESEARCH.md                 # this file
├── 036-01-wave-0-snapshot-and-vercel-domain-add-PLAN.md
├── 036-02-wave-1-flip-dns-and-propagate-PLAN.md
├── 036-03-wave-2-cert-issuance-and-smoke-PLAN.md
├── 036-04-wave-3-summary-and-handoff-PLAN.md
└── evidence/
    ├── 00-token-handling.md          # how the token was passed (sanitized)
    ├── 01-pre-cutover-zone.txt       # GET /api/dns/v1/zones/digswap.com.br BEFORE flip
    ├── 02-vercel-domain-add.log      # `vercel domains add digswap.com.br digswap-web` output
    ├── 02b-vercel-domain-add-www.log # `vercel domains add www.digswap.com.br digswap-web`
    ├── 02c-vercel-domain-inspect.log # `vercel domains inspect digswap.com.br` (exact A/CNAME targets)
    ├── 03-snapshot-list.json         # GET /api/dns/v1/snapshots/digswap.com.br (rollback handle)
    ├── 04-zone-flip-payload.json     # exact PUT body sent to Hostinger
    ├── 04-zone-flip-response.json    # API 200/4xx response
    ├── 05-post-flip-zone.txt         # GET /api/dns/v1/zones/digswap.com.br AFTER flip
    ├── 06-resolver-matrix.txt        # Resolve-DnsName + dns.google/resolve from 3 resolvers
    ├── 07-caa-audit.txt              # CAA record check (DEP-DNS-05)
    ├── 08-cert-openssl.txt           # openssl s_client output (DEP-DNS-03)
    ├── 09-health-curl.txt            # curl /api/health × 5 over 1 hour soak
    ├── 10-playwright-anon.txt        # Playwright suite output
    └── 11-verify-final.txt           # DEP-DNS-{01..07} aggregator (PASS/FAIL with evidence ref)
```

### Pattern 1: Hostinger DNS API via curl + Bearer token

**Auth scheme** (HIGH confidence — verified at developers.hostinger.com + hostinger/api-mcp-server README):
```bash
# Token generated at: hostinger.com → Account → API → Generate token
# Stored per Phase 35 leak-prevention pattern:
printf '%s' 'YOUR_TOKEN_HERE' > ~/.hostinger-token  # ASCII, no BOM, no newline

# Used inline (never echo'd to logs):
HOSTINGER_TOKEN=$(cat ~/.hostinger-token)
curl -sS -H "Authorization: Bearer $HOSTINGER_TOKEN" \
     -H "Accept: application/json" \
     "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br"
```

**Source:** https://developers.hostinger.com/ + https://github.com/hostinger/api-mcp-server (README enumerates exact paths)

### Pattern 2: Pre-cutover snapshot (Wave 0)

```bash
# Read current zone (BEFORE any change) — saves to evidence/01
HOSTINGER_TOKEN=$(cat ~/.hostinger-token)
curl -sS -H "Authorization: Bearer $HOSTINGER_TOKEN" \
     "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br" \
     > .planning/phases/036-dns-ssl-cutover/evidence/01-pre-cutover-zone.txt

# List existing Hostinger-managed snapshots (rollback safety net) — saves to evidence/03
curl -sS -H "Authorization: Bearer $HOSTINGER_TOKEN" \
     "https://developers.hostinger.com/api/dns/v1/snapshots/digswap.com.br" \
     > .planning/phases/036-dns-ssl-cutover/evidence/03-snapshot-list.json

# Note: Hostinger automatically creates snapshots on changes. The list call returns snapshotId values usable in
# POST /api/dns/v1/snapshots/{domain}/{snapshotId}/restore for rollback.
```

### Pattern 3: Hostinger zone PUT — exact request body (HIGH confidence)

Schema verified via `hostinger/api-php-sdk/docs/Model/DNSV1ZoneUpdateRequest.md` + `DNSV1ZoneUpdateRequestZoneInner.md`:

```json
{
  "overwrite": false,
  "zone": [
    {
      "name": "@",
      "type": "A",
      "ttl": 300,
      "records": [
        { "content": "76.76.21.21" }
      ]
    },
    {
      "name": "www",
      "type": "CNAME",
      "ttl": 300,
      "records": [
        { "content": "cname.vercel-dns.com." }
      ]
    }
  ]
}
```

**Field semantics (HIGH confidence, PHP SDK):**
- `overwrite` (bool): when `true`, matching `(name, type)` pairs are deleted and replaced; when `false` (default), existing TTLs are updated and new records appended. **Use `false` for the cutover** so we don't accidentally nuke records we haven't enumerated. Use `true` only if pre-cutover snapshot reveals a stale `@ A` pointing somewhere (e.g., Hostinger parking IP) that must be replaced.
- `zone[].name` (string, required): `@` for apex, subdomain prefix for everything else.
- `zone[].type` (string, required): `A`, `CNAME`, `TXT`, `MX`, etc.
- `zone[].ttl` (int, required): seconds. **Use `300` per DEP-DNS-06.**
- `zone[].records[].content` (string, required): the actual record value (IP for A, target FQDN for CNAME — Hostinger CNAMEs typically expect a trailing dot; verify in pre-cutover snapshot format).

**Send the PUT:**
```bash
curl -sS -X PUT \
     -H "Authorization: Bearer $HOSTINGER_TOKEN" \
     -H "Content-Type: application/json" \
     -d @.planning/phases/036-dns-ssl-cutover/evidence/04-zone-flip-payload.json \
     "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br" \
     -w "\nHTTP_CODE:%{http_code}\n" \
     -o .planning/phases/036-dns-ssl-cutover/evidence/04-zone-flip-response.json
```

### Pattern 4: Vercel domain add (CLI canonical)

```bash
cd apps/web  # or wherever .vercel/project.json is

# Add apex (Vercel will return: A record value to set + optional TXT verification)
vercel domains add digswap.com.br digswap-web 2>&1 | \
  tee .planning/phases/036-dns-ssl-cutover/evidence/02-vercel-domain-add.log

# Add www subdomain (Vercel will return: CNAME target — note: project-specific value, e.g. d1d4fc829fe7bc7c.vercel-dns-017.com)
vercel domains add www.digswap.com.br digswap-web 2>&1 | \
  tee .planning/phases/036-dns-ssl-cutover/evidence/02b-vercel-domain-add-www.log

# Inspect to capture the exact A IP + CNAME target Vercel wants for THIS project
vercel domains inspect digswap.com.br 2>&1 | \
  tee .planning/phases/036-dns-ssl-cutover/evidence/02c-vercel-domain-inspect.log

# IMPORTANT: Vercel docs (April 2026) note that newer Vercel projects get DYNAMIC CNAME values
# like `d1d4fc829fe7bc7c.vercel-dns-017.com` — the legacy `cname.vercel-dns.com` still works
# but the project-specific value is what `vercel domains inspect` reveals. The PLAN must use
# whatever value `inspect` returns, not the hard-coded literal in DEP-DNS-02 (audit drift OK).
```

**Source:** https://vercel.com/docs/domains/working-with-domains/add-a-domain + https://community.vercel.com/t/domain-cname-a-dns-records-in-vercel-rest-api-and-sdk/18783

### Pattern 5: www → apex 308 redirect (Vercel-native)

D-07 requires `www.digswap.com.br → digswap.com.br` 308 redirect. Vercel-native config (NOT DNS-level):

**Dashboard path (canonical for solo dev):** `Project Settings → Domains → www.digswap.com.br Edit → Redirect to: digswap.com.br → Status code: 308 Permanent → Save`

**No CLI for this** as of Vercel CLI 52.x; the Vercel REST API supports `redirect_status_code` on the domain PATCH endpoint but the CLI has not exposed it. **Recommendation:** Dashboard checkpoint:human-action with a screenshot in evidence/. Alternative: REST API call directly:

```bash
# Via Vercel REST API (untested in this phase, but documented):
VERCEL_TOKEN=$(cat ~/.vercel-token)  # from Phase 35
curl -sS -X PATCH \
     -H "Authorization: Bearer $VERCEL_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"redirect":"digswap.com.br","redirectStatusCode":308}' \
     "https://api.vercel.com/v9/projects/prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY/domains/www.digswap.com.br?teamId=team_WuQK7GkPndJ2xH9YKvZTMtB3"
```

**Source:** https://vercel.com/changelog/domains-can-now-be-redirected-with-a-custom-status-code + https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting

### Anti-Patterns to Avoid

- **Apex CNAME (RFC1034 violation):** Hostinger may *allow* a CNAME on `@` (some "ALIAS" or "flatten" features), but for an apex+MX+other-records zone, A record is mandatory. Vercel docs are explicit: apex requires A. **Use A record at `@`, never CNAME.** (Source: Vercel troubleshooting docs § "Working with Apex domain", citing RFC1034 §3.6.2.)
- **Setting TTL on a per-record basis to 1d during cutover:** Defeats the rollback window. **All cutover records get TTL=300.**
- **Changing TTL post-flip without waiting for old TTL to expire:** Old TTL governs revert speed; if pre-cutover TTL was 14400s, the first ~4h after the flip behave like 14400s TTL regardless of the new value. **Lower the TTL to 300 in advance, wait for the old TTL to expire, then flip records.** (Source: Vercel docs § "DNS record propagation times" — explicit recommendation.) **For Phase 36 this means a Wave 0 step that lowers existing record TTLs to 300 with overwrite=false, waits for old TTL to expire, THEN does the value flip in Wave 1.**
- **Using `cname.vercel-dns.com` literally without checking `vercel domains inspect`:** New projects get dynamic per-project CNAMEs (`*.vercel-dns-NNN.com`). The literal still works as a redirect target, but `inspect` is the source of truth.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cert issuance loop | Custom ACME client / certbot on Vercel | Vercel auto-issuance via HTTP-01 | Vercel intercepts `/.well-known/acme-challenge/*` automatically once DNS resolves. Hand-rolling = breaking the platform contract. |
| DNS rollback script with manual API calls per record | Custom JS to delete & re-add each record | Hostinger snapshot restore endpoint (`POST /api/dns/v1/snapshots/{domain}/{snapshotId}/restore`) | One-call atomic revert; the API tracks snapshots automatically per change. |
| Cross-resolver dig wrapper | Bash loop over `dig @1.1.1.1 / @8.8.8.8 / @9.9.9.9` (and dig isn't installed anyway) | PowerShell `Resolve-DnsName -Server X` × 3 + `dns.google/resolve` HTTP API | Native to Windows + zero install. JSON output is parseable. |
| Cert chain inspector | Custom TLS handshake in Node/Python | `openssl s_client -connect host:443 -servername host -showcerts </dev/null` | The verify-return-code line + Issuer/SAN regex is exactly the evidence format DEP-DNS-03 needs. |

**Key insight:** Phase 36 is 90% orchestration of platform APIs. The custom code surface should be *zero*; this is a CLI + curl + JSON evidence phase, not a build phase.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — this phase mutates external DNS records, not application data. No DB, ChromaDB, Mem0, etc. is touched. | None |
| Live service config | (1) **Hostinger DNS zone** for `digswap.com.br` — current state unknown until pre-cutover GET; will hold whatever Hostinger parking-IP A record + Hostinger nameserver NS records exist by default. (2) **Vercel project domains list** — currently has zero custom domains attached (Phase 35 SUMMARY confirms; only the auto-`digswap-web.vercel.app` alias). | Wave 0: GET zone, save snapshot. Wave 1: Vercel `domains add`. Wave 2: Hostinger PUT zone. |
| OS-registered state | None — no Windows Task Scheduler tasks, no pm2, no systemd related to DNS/cert. | None |
| Secrets/env vars | (1) `~/.hostinger-token` — created Wave 0, used Wave 0+1+2, NOT committed. (2) `~/.vercel-token` (from Phase 35) — reused. (3) `NEXT_PUBLIC_APP_URL=https://digswap.com.br` — already set in Vercel Production scope (Phase 35 D-10) and code reads it at runtime; once DNS resolves, app self-references correctly. | None — secrets stay local; env vars already correct. |
| Build artifacts / installed packages | None invalidated. The Next.js build does not embed the domain (it's a runtime env var). No reinstall needed post-cutover. | None |

**Canonical question check:** *After every file in the repo is updated, what runtime systems still have the old string cached, stored, or registered?*
Answer: **N/A — no string rename in this phase.** The only "old state" that matters is the pre-cutover Hostinger DNS zone, captured in `evidence/01-pre-cutover-zone.txt`. Browser/OS DNS caches will hold the old A record up to TTL_old seconds (mitigated by lowering TTL to 300 in advance).

## Vercel ACME Timing Reality (CORRECTION to D-06)

**HIGH confidence finding** — directly contradicts the "pre-emit cert" claim in CONTEXT.md D-06:

Per https://vercel.com/docs/domains/working-with-ssl:
> "For all non-wildcard domains, we use the [HTTP-01 challenge method] and providing the request can make it to Vercel, then our infrastructure will deal with it."

And per the issuance steps:
> "1. Vercel asks LetsEncrypt for a certificate ... 2. Let's Encrypt reviews the domain and issues Vercel with a challenge ... 3. Vercel creates that file with the code on the HTTP-01 ... validation path and tells LetsEncrypt it's done 4. LetsEncrypt then check to see if the file is there ..."

**Implication:** Let's Encrypt's HTTP-01 challenge requires Let's Encrypt's validation servers to fetch `http://digswap.com.br/.well-known/acme-challenge/<token>` and get the right response. **That fetch only succeeds AFTER `digswap.com.br` resolves to Vercel's IP**, i.e., after the DNS flip in Wave 1. Vercel cannot "pre-emit" the cert before DNS is flipped because Let's Encrypt won't see Vercel as the responding server.

**What the `_vercel` TXT record actually does:**
- It is for **domain *ownership* verification** when the same domain is currently registered to *another* Vercel team account, NOT for ACME cert issuance.
- For a fresh domain with no other Vercel association (which is digswap.com.br's situation), `vercel domains add` can succeed without TXT verification at all — it just records the domain as part of the project and waits for DNS to resolve so it can request the cert.
- Even when TXT verification IS required, it verifies *ownership of the domain* (a one-time step), distinct from the per-cert ACME HTTP-01 challenge that runs each issuance.

**Revised cutover model (planner should adopt):**
1. **Wave 0:** TTL pre-lowering (from 14400→300 if needed), zone snapshot, token setup.
2. **Wave 1:** `vercel domains add digswap.com.br + www.digswap.com.br` → records project ownership; Vercel queues a cert issuance attempt that will retry until DNS resolves. **No cert is issued in this wave.**
3. **Wave 2:** Hostinger PUT zone with new A + CNAME (TTL 300). Wait for DNS to propagate to 3 resolvers. **First few minutes after DNS resolves, the user may get connection errors / 526 / placeholder cert.** This is a brief but real window.
4. **Wave 3:** Within 5-30 minutes after DNS resolves at Vercel's edge, Vercel auto-issues the LE cert. Verify with `openssl s_client`. Run smoke + Playwright. SUMMARY.

**Mitigation for the brief cert-error window (since "zero cert error" is no longer achievable):**
- Phase 36 is invite-only soak (D-11) — only solo dev + sócio see the window. Acceptable.
- After DNS flips, **do not announce or share the URL** until openssl confirms cert valid.
- HSTS=300 (Phase 35 D-18) means even if a user hit the cert-error window and accepted/cached, the lockout window is ≤5 min. P13 (HSTS lock) already mitigated.

**Action item for plan-phase:** Plan-phase MUST adjust D-06 wording in the plan to reflect this reality. Suggest adding a new D-20 in the plan SUMMARY: *"Cert issuance only completes AFTER DNS resolves at Vercel; brief (5-30min worst-case) cert-error window exists post-flip; mitigated by invite-only soak."*

## Common Pitfalls

### Pitfall 1: Stale TTL governs the rollback window
**What goes wrong:** Existing Hostinger zone has TTL=14400 (4h, the Hostinger default). You flip the records to TTL=300, but resolvers worldwide still cache the old IP for up to 4h based on the *previous* TTL.
**Why it happens:** TTL is *advisory at lookup time* — the old record is cached with its old TTL value, not the new one.
**How to avoid:** **Wave 0 lowers TTLs to 300 with `overwrite=false` (TTL-only update on existing records); wait for previous TTL to expire (`max(existing_TTLs)` from snapshot — likely 14400s = 4h); THEN Wave 1 adds Vercel records.** This converts the cutover from 1 step to 2 steps over ~4h+, but the rollback window collapses from 4h to 5min.
**Warning signs:** Pre-cutover snapshot shows `ttl: 14400` on existing A/NS records.
**Source:** Vercel troubleshooting docs explicit recommendation; LACNIC TTL guidance.

### Pitfall 2: Cert ACME stuck — multiple causes
**What goes wrong:** DNS resolves fine, but no cert appears at port 443 after 30+ min.
**Why it happens (in priority order, per Vercel + Let's Encrypt docs):**
1. **CAA record blocking** — `dig CAA digswap.com.br` shows entries that don't include `letsencrypt.org`.
2. **Stale `_acme-challenge` TXT** — leftover from previous host; Let's Encrypt sees it, gets confused.
3. **Redirect/rewrite hijacking `/.well-known/`** — middleware or `vercel.json` `redirects` accidentally catches the ACME path. Phase 35's deployed code has no such middleware (HSTS only via headers, no path redirects), so this is unlikely.
4. **Rate limit hit** — Let's Encrypt allows 50 certs/registered-domain/week. For a fresh domain with no prior issuance, not a concern. For repeated issuance attempts after failures, *each duplicate issuance counts* — reach 5 within an hour and you hit the "Duplicate Certificate" sub-limit.
5. **Vercel cert queue lag** — rare; Vercel docs note "propagation delays usually resolved within a few hours."
**How to avoid (per D-17):** Investigate IN ORDER before rolling back:
   1. `Resolve-DnsName -Type CAA digswap.com.br -Server 1.1.1.1` (or `dns.google/resolve?name=digswap.com.br&type=CAA`)
   2. `Resolve-DnsName -Type TXT _acme-challenge.digswap.com.br -Server 1.1.1.1`
   3. Vercel runtime logs via MCP: `mcp__vercel__get_deployment_runtime_logs` for the prod deployment around the time of the DNS flip
   4. Test with https://letsdebug.net (free, official Vercel-recommended)
**Warning signs:** Browser shows "ERR_SSL_PROTOCOL_ERROR" or "NET::ERR_CERT_AUTHORITY_INVALID" 30+ min after DNS resolves; `openssl s_client` shows "no peer certificate available" or returns Vercel's fallback cert.
**Source:** https://vercel.com/docs/domains/troubleshooting + https://letsencrypt.org/docs/rate-limits/

### Pitfall 3: Apex CNAME impossible
**What goes wrong:** Tempted to use `@ CNAME cname.vercel-dns.com` (cleaner than hardcoding 76.76.21.21).
**Why it happens:** Some registrars expose "ALIAS" or "ANAME" as a flattening hack. Hostinger does NOT advertise this as of 2026.
**How to avoid:** Always use A record at `@`. The PUT body in Pattern 3 above is correct.
**Warning signs:** `vercel domains inspect digswap.com.br` showing a CNAME target instead of an A IP — that means you somehow added a subdomain not the apex.
**Source:** Vercel docs § "Working with Apex domain", RFC1034 §3.6.2.

### Pitfall 4: Vercel project-specific CNAME drift
**What goes wrong:** DEP-DNS-02 says "CNAME `www` → `cname.vercel-dns.com`", but Vercel may give this project a value like `d1d4fc829fe7bc7c.vercel-dns-017.com`.
**Why it happens:** Vercel rolled out per-project DNS in 2024-2025 for better steering. The legacy `cname.vercel-dns.com` is still honored as a redirect/proxy, but the project-specific value is the recommended one.
**How to avoid:** Run `vercel domains inspect digswap.com.br` (Wave 1) and use whichever target it returns. If it returns `cname.vercel-dns.com`, requirement is met literally. If it returns a project-specific subdomain, the requirement is met *in spirit* (still a Vercel-managed CNAME) — log in evidence as "DEP-DNS-02 PASS-with-drift, exact value: `<actual>`".
**Warning signs:** None — discovered at the moment of running `inspect`.
**Source:** https://community.vercel.com/t/domain-cname-a-dns-records-in-vercel-rest-api-and-sdk/18783

### Pitfall 5: openssl on Windows — git-bash bundles it; PowerShell does not
**What goes wrong:** Plan says `openssl s_client -connect digswap.com.br:443 ...` but agent runs it from cmd.exe / PowerShell where openssl isn't on PATH.
**Why it happens:** Windows has no native openssl. git-bash bundles 3.5.5 at `/mingw64/bin/openssl`; from cmd.exe / PowerShell, openssl is only available if explicitly installed (winget, chocolatey, etc.).
**How to avoid:** Verified `OpenSSL 3.5.5` is on PATH in this worktree's bash (`which openssl` → `/mingw64/bin/openssl`). All openssl commands MUST run from bash, NOT from PowerShell or cmd. Plan must wrap PowerShell-invoked steps separately from openssl-invoked steps.
**Warning signs:** "openssl: command not found" or "'openssl' is not recognized" in output.
**Source:** Local environment audit, 2026-04-27.

### Pitfall 6: `dig` unavailable — Resolve-DnsName as primary
**What goes wrong:** Plan uses `dig @1.1.1.1 digswap.com.br A +short`; `dig` is not installed locally.
**Why it happens:** BIND tools are not bundled with git-bash; not preinstalled on Windows.
**How to avoid:** Use PowerShell `Resolve-DnsName`:
   ```powershell
   Resolve-DnsName -Name digswap.com.br -Type A -Server 1.1.1.1
   Resolve-DnsName -Name digswap.com.br -Type A -Server 8.8.8.8
   Resolve-DnsName -Name digswap.com.br -Type A -Server 9.9.9.9
   Resolve-DnsName -Name www.digswap.com.br -Type CNAME -Server 1.1.1.1
   Resolve-DnsName -Name digswap.com.br -Type CAA -Server 1.1.1.1
   ```
   Cross-verify from independent network via `dns.google/resolve` HTTP API:
   ```bash
   curl -sS "https://dns.google/resolve?name=digswap.com.br&type=A"
   curl -sS "https://dns.google/resolve?name=digswap.com.br&type=CAA"
   ```
   The JSON `Answer[]` array shows resolved values from Google's resolver; gives a fourth independent network check.
**Warning signs:** "dig: command not found"; bash echoes literal "@1.1.1.1" as a string; "command not recognized."
**Source:** Local environment audit, 2026-04-27.

### Pitfall 7: Browser/OS DNS cache after flip
**What goes wrong:** Agent flips DNS, runs `Resolve-DnsName` from agent's machine, gets new IP, declares PASS. User opens browser on same machine, gets old IP because Chrome caches DNS independently.
**Why it happens:** Chrome's internal DNS cache, Windows DNS Client Service cache.
**How to avoid:**
   ```powershell
   # Windows DNS cache flush
   ipconfig /flushdns

   # Chrome's internal cache: navigate to chrome://net-internals/#dns → Clear host cache
   ```
**Warning signs:** PowerShell shows new IP; browser shows cert error or old content.
**Source:** Vercel troubleshooting docs § "Is the issue only local to you?".

## Code Examples

### Operation: Pre-flight CAA audit (DEP-DNS-05)
```powershell
# PowerShell — runs from any worktree shell
Resolve-DnsName -Name digswap.com.br -Type CAA -Server 1.1.1.1 -ErrorAction SilentlyContinue |
  Tee-Object -FilePath .\.planning\phases\036-dns-ssl-cutover\evidence\07-caa-audit.txt
```
**Pass criteria:**
- No CAA records returned → wildcard policy applies → Let's Encrypt allowed → PASS
- CAA records returned, ANY of them is `0 issue "letsencrypt.org"` or `0 issue ";"` → PASS
- CAA records returned, NONE include letsencrypt → FAIL — must add `0 issue "letsencrypt.org"` via Hostinger PUT before Wave 1.

**Source:** https://letsencrypt.org/docs/caa/ + Vercel troubleshooting § "Missing CAA records"

### Operation: TTL pre-lowering (Pitfall 1 mitigation, Wave 0)

This step is OPTIONAL but recommended. Skip ONLY if pre-cutover snapshot shows existing TTLs already ≤ 300.

```bash
# Hostinger PUT with overwrite=false to update TTL on existing @ A and any other records
# without changing values:
HOSTINGER_TOKEN=$(cat ~/.hostinger-token)

cat > /tmp/ttl-lowering-payload.json <<'EOF'
{
  "overwrite": false,
  "zone": [
    {
      "name": "@",
      "type": "A",
      "ttl": 300,
      "records": [ { "content": "<EXISTING_VALUE_FROM_SNAPSHOT>" } ]
    }
  ]
}
EOF

curl -sS -X PUT \
  -H "Authorization: Bearer $HOSTINGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/ttl-lowering-payload.json \
  "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br"

# Then WAIT max(old_TTLs) seconds before Wave 1. If old TTL=14400, that's 4 hours.
# Use Hostinger's existing snapshot timestamp as the wait floor.
```

### Operation: Cert validation post-flip (DEP-DNS-03)
```bash
# git-bash — openssl 3.5.5 verified on PATH

# Apex
openssl s_client -connect digswap.com.br:443 -servername digswap.com.br -showcerts </dev/null 2>&1 | \
  tee .planning/phases/036-dns-ssl-cutover/evidence/08-cert-openssl.txt

# Parse for required evidence:
grep -E "issuer=|subject=|verify return code" \
  .planning/phases/036-dns-ssl-cutover/evidence/08-cert-openssl.txt
```

**Pass criteria for DEP-DNS-03:**
- `verify return code: 0 (ok)` — chain validates against system trust store
- `issuer=` line contains `Let's Encrypt` AND one of `R3`, `R10`, `R11`, `E5`, `E6` (current LE intermediate CAs as of 2026)
- `subject=` line contains `CN = digswap.com.br`
- Output contains `DNS:digswap.com.br` AND ideally also `DNS:www.digswap.com.br` in the X509v3 SAN extension (one cert covering both names is the typical Vercel pattern). If www is on a separate cert (because of the redirect domain config), run a second `openssl s_client -connect www.digswap.com.br:443 -servername www.digswap.com.br` — it should also return a valid LE cert with `DNS:www.digswap.com.br`.

**Source:** OpenSSL 3.5.5 manpage `s_client(1)`, Let's Encrypt chain at https://letsencrypt.org/certificates/

### Operation: 3-resolver DNS matrix (DEP-DNS-04)
```powershell
# PowerShell — saves to evidence/06
$out = ".\.planning\phases\036-dns-ssl-cutover\evidence\06-resolver-matrix.txt"
"" | Out-File $out

foreach ($resolver in @("1.1.1.1","8.8.8.8","9.9.9.9")) {
  "=== Resolver $resolver — A digswap.com.br ===" | Add-Content $out
  Resolve-DnsName -Name digswap.com.br -Type A -Server $resolver -ErrorAction SilentlyContinue |
    Format-List Name, Type, IPAddress, TTL | Out-String | Add-Content $out

  "=== Resolver $resolver — CNAME www.digswap.com.br ===" | Add-Content $out
  Resolve-DnsName -Name www.digswap.com.br -Type CNAME -Server $resolver -ErrorAction SilentlyContinue |
    Format-List Name, Type, NameHost, TTL | Out-String | Add-Content $out
}

# Cross-check with Google's resolver via HTTP (independent network)
"=== dns.google/resolve A digswap.com.br ===" | Add-Content $out
(Invoke-WebRequest "https://dns.google/resolve?name=digswap.com.br&type=A").Content | Add-Content $out
```

**Pass criteria for DEP-DNS-04:**
- All 3 resolvers return `IPAddress: 76.76.21.21` for apex A
- All 3 resolvers return `NameHost: cname.vercel-dns.com.` (or the project-specific Vercel CNAME) for `www`
- Optionally: `dns.google/resolve` HTTP API confirms (4th independent check)
- Original ROADMAP says "2+ independent networks" — D-14 strengthens to 3, evidence shows 3 + Google HTTP = effectively 4.

### Operation: Hostinger snapshot restore (rollback)
```bash
# Step 1: Fetch latest snapshot (most recent should be the auto-snapshot Hostinger took just before the PUT)
HOSTINGER_TOKEN=$(cat ~/.hostinger-token)
SNAP_ID=$(curl -sS -H "Authorization: Bearer $HOSTINGER_TOKEN" \
  "https://developers.hostinger.com/api/dns/v1/snapshots/digswap.com.br" | \
  jq -r '.[] | select(.created_at | sort_by(.) | last) | .id')  # adjust based on actual response shape

# Step 2: Restore that snapshot
curl -sS -X POST \
  -H "Authorization: Bearer $HOSTINGER_TOKEN" \
  "https://developers.hostinger.com/api/dns/v1/snapshots/digswap.com.br/$SNAP_ID/restore"

# Step 3: Verify with Resolve-DnsName from at least one resolver — old IP should return within ~5 min (TTL=300)
```

**Note:** Exact response shape of the snapshot list endpoint not documented in the public PHP SDK summaries; the agent should parse the actual response shape from evidence/03-snapshot-list.json captured in Wave 0. The endpoint paths themselves (`GET /api/dns/v1/snapshots/{domain}`, `POST .../{snapshotId}/restore`) ARE confirmed via the official Hostinger MCP server source (https://github.com/hostinger/api-mcp-server).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual DNS clicks in Hostinger UI | Hostinger DNS API v1 (Bearer token) | Hostinger published developers.hostinger.com (~2024-2025) | Programmatic, scriptable, evidence-friendly. |
| `cname.vercel-dns.com` literal everywhere | Project-specific dynamic CNAMEs (`*.vercel-dns-NNN.com`) | Vercel rolled out per-project DNS 2024 | Use `vercel domains inspect` to discover; legacy literal still honored. |
| `dig` from Linux/macOS shell | `Resolve-DnsName` on Windows + `dns.google/resolve` HTTP | Windows-first stack | Same data, different syntax; planner must avoid dig invocations. |
| Pre-issuing certs via DNS-01 + nameserver delegation | HTTP-01 default for non-wildcards on Vercel | Vercel default since launch | Cert only issues AFTER DNS resolves at Vercel — invalidates "pre-emit" framing. |
| Long TTLs (14400+) for stability | TTL=300 during cutover, raise post-soak | Industry norm post-2010 | Faster rollback; LACNIC explicitly endorses ≥1800 baseline, 30s minimum. |

**Deprecated/outdated:**
- "DNS-01 only" cert workflow for Vercel non-wildcards — superseded by HTTP-01 auto.
- Manual `_vercel` TXT placement as a *required* step for cert — only required for cross-account ownership verification.
- TTL=86400 during a launch — defeats rollback, no longer industry standard during cutover.

## Open Questions

1. **Exact response shape of `GET /api/dns/v1/snapshots/{domain}`**
   - **What we know:** Endpoint exists and returns a list of snapshot IDs (per Hostinger MCP server tool definition `DNS_getDNSSnapshotListV1`).
   - **What's unclear:** Whether the JSON is `[{id, created_at, ...}]` or wrapped in `{data: [...]}` or something else.
   - **Recommendation:** Wave 0 captures the actual response in `evidence/03-snapshot-list.json`; planner parses it at execution time. No need to lock the shape now.

2. **Whether `vercel domains add` requires `_vercel` TXT for fresh domain on never-before-Vercel'd zone**
   - **What we know:** Vercel docs state TXT is for "domain in use by another Vercel account."
   - **What's unclear:** For a brand-new Vercel addition (digswap.com.br has never been on Vercel), TXT may not be required at all.
   - **Recommendation:** Wave 1 plan branches: if `vercel domains add` returns a TXT requirement, add it via Hostinger PUT BEFORE the A/CNAME flip; if not, skip directly to A/CNAME flip in Wave 2.

3. **Hostinger DNS API rate limits**
   - **What we know:** Domain availability check has 10 req/min limit (per MCP server README). DNS zone endpoints' limits not documented publicly.
   - **What's unclear:** Whether the PUT zone endpoint has its own per-minute throttle.
   - **Recommendation:** This phase makes ≤10 API calls total (1 GET pre, 1 PUT TTL-lower, 1 PUT flip, 1 GET post, 1 list-snapshots, optional 1 restore). Any reasonable rate limit will tolerate this. Move on; if 429 appears, retry after 60s.

4. **Whether Hostinger CNAME `content` field expects trailing dot**
   - **What we know:** RFC standard is FQDN with trailing dot (`cname.vercel-dns.com.`). Some providers normalize.
   - **What's unclear:** Hostinger's exact behavior — accepts both, or one only.
   - **Recommendation:** Wave 0 pre-cutover snapshot will show how Hostinger formats existing CNAMEs (if any). Default to trailing dot in PUT body; if API rejects, retry without.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| openssl | DEP-DNS-03 cert validation | ✓ | OpenSSL 3.5.5 (git-bash /mingw64/bin) | — |
| Vercel CLI | Vercel domain add (Wave 1) | ✓ | 52.0.0 | Vercel REST API + curl |
| curl | Hostinger DNS API (Waves 0/1/2/rollback) | ✓ | 8.18.0 | PowerShell `Invoke-WebRequest` |
| PowerShell `Resolve-DnsName` | DEP-DNS-04, DEP-DNS-05 verification | ✓ | DnsClient 1.0.0.0 | `dns.google/resolve` HTTP API + curl |
| `dig` (BIND) | Optional — would simplify some commands | ✗ | — | `Resolve-DnsName` (primary) + `dns.google/resolve` (cross-check) |
| `jq` | Pretty-print JSON evidence | (verify) | unknown | PowerShell `ConvertFrom-Json` or just save raw |
| Hostinger DNS API | Wave 0/1/2/rollback core | ✓ | v1 (`/api/dns/v1/*`) | Hostinger UI manual (D-03 fallback) |
| Vercel REST API | www→apex redirect config | ✓ | v9 (`/v9/projects/.../domains`) | Dashboard click-path (checkpoint:human-action) |
| Hostinger API token | Auth for all DNS API calls | ✗ (must be generated by user pre-Wave 0) | — | None; this is a hard prerequisite — D-19 covers handoff |
| Vercel API token | Auth for vercel CLI + REST | ✓ (Phase 35 reused) | — | — |

**Missing dependencies with no fallback:**
- **Hostinger API token** — user must generate before Wave 0 starts (Hostinger panel → Account → API → Generate token). This is a hard checkpoint; the plan must explicitly call it out as a prerequisite.

**Missing dependencies with fallback:**
- `dig` — fallback to `Resolve-DnsName` + `dns.google/resolve`. Functionally equivalent for this phase.
- `jq` — verify availability at execution time; if absent, fall back to raw save + PowerShell parse.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Mixed: openssl + PowerShell + curl + Playwright (Phase 35-installed) |
| Config file | `apps/web/playwright.config.ts` (already supports `PLAYWRIGHT_BASE_URL` env override per Phase 35) |
| Quick run command | `curl -fsSI https://digswap.com.br/api/health` (returns 200 → quick pass) |
| Full suite command | `cd apps/web && PLAYWRIGHT_BASE_URL=https://digswap.com.br pnpm test:e2e` (16 anon tests pass per Phase 35 baseline) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEP-DNS-01 | A record `@ → 76.76.21.21` reachable from 3 resolvers | smoke | `Resolve-DnsName -Name digswap.com.br -Type A -Server {1.1.1.1,8.8.8.8,9.9.9.9}` | ✅ (PowerShell built-in) |
| DEP-DNS-02 | CNAME `www → cname.vercel-dns.com` (or project-specific) reachable from 3 resolvers | smoke | `Resolve-DnsName -Name www.digswap.com.br -Type CNAME -Server {1.1.1.1,8.8.8.8,9.9.9.9}` | ✅ |
| DEP-DNS-03 | Valid LE cert on apex + www, verify return code 0 | smoke | `openssl s_client -connect digswap.com.br:443 -servername digswap.com.br -showcerts </dev/null` | ✅ |
| DEP-DNS-04 | DNS resolves consistently from ≥2 networks | smoke | combined matrix from DEP-DNS-01 + DEP-DNS-02 + `curl https://dns.google/resolve?name=digswap.com.br&type=A` | ✅ |
| DEP-DNS-05 | CAA records absent OR include letsencrypt.org | smoke | `Resolve-DnsName -Name digswap.com.br -Type CAA -Server 1.1.1.1` + `curl https://dns.google/resolve?name=digswap.com.br&type=CAA` | ✅ |
| DEP-DNS-06 | All cutover records have TTL=300 | smoke | parse evidence/05-post-flip-zone.txt for `"ttl": 300` | ✅ (Hostinger GET response) |
| DEP-DNS-07 | MX records preserved | N/A | confirm pre-cutover snapshot has zero MX entries (`grep -i "MX" evidence/01-pre-cutover-zone.txt`) | ✅ |
| (D-13 soak) | /api/health 200 × 5 over 1h | smoke | `for i in 1 2 3 4 5; do curl -fsS https://digswap.com.br/api/health \| jq .status; sleep 720; done` | ✅ |
| (Phase 35 carryover) | 16 Playwright anon tests pass against new BASE_URL | integration | `PLAYWRIGHT_BASE_URL=https://digswap.com.br pnpm --filter @digswap/web test:e2e` | ✅ |

### Sampling Rate

- **Per task commit:** `curl -fsSI https://digswap.com.br/api/health` (single request, < 2s)
- **Per wave merge:** Resolver matrix (3 resolvers × 2 record types = 6 queries; ~30s) + `openssl s_client` (1 query; ~3s)
- **Phase gate (D-13 soak):** 5× `/api/health` over 1 hour (12-min intervals) + Playwright suite (16 tests, ~5min) + final aggregator `evidence/11-verify-final.txt`

**Nyquist analysis (per CONTEXT.md spec):**
- Fastest variation we want to detect: TTL=300s record changes → 1/300 Hz variation. Nyquist requires ≥ 2/300 Hz = sample every 150s.
- D-13 schedule of 5 samples / 3600s = 1/720 Hz = ~one sample every 12 min. **Undersampled by factor 4-5x relative to TTL-bounded variations.**
- **Acceptable rationale:** invite-only soak (D-11), no public traffic, no SLO commitments yet, primary failure modes (cert revoked, DNS reverted) are step-functions rather than oscillations. Nyquist undersampling is a low-stakes tradeoff for solo-dev simplicity. Document in evidence/11 as: "Sampling rate undersampled per Nyquist for TTL=300s; accepted because: (1) no SLO yet, (2) failure modes are step-functions, (3) full Playwright suite + openssl one-shot detect step-function failures."

### Wave 0 Gaps

- [ ] No new test infrastructure required — Phase 35 already installed Playwright. Existing `apps/web/playwright.config.ts` supports `PLAYWRIGHT_BASE_URL` override.
- [ ] No new framework install needed.
- [ ] **One-time prerequisite:** user must generate Hostinger API token (D-19) and place at `~/.hostinger-token` before Wave 0 starts. This is a checkpoint:human-action, not test infra.

## Sources

### Primary (HIGH confidence)
- https://developers.hostinger.com/ — Hostinger API Reference (official)
- https://github.com/hostinger/api-mcp-server (README) — Exact endpoint paths + tool descriptions
- https://github.com/hostinger/api-php-sdk/blob/main/docs/Api/DNSZoneApi.md — DNS zone endpoint signatures
- https://github.com/hostinger/api-php-sdk/blob/main/docs/Model/DNSV1ZoneUpdateRequest.md — Update request schema
- https://github.com/hostinger/api-php-sdk/blob/main/docs/Model/DNSV1ZoneUpdateRequestZoneInner.md — Zone record fields (name, type, ttl, records)
- https://github.com/hostinger/api-php-sdk/blob/main/docs/Model/DNSV1ZoneUpdateRequestZoneInnerRecordsInner.md — Per-record `content` field
- https://vercel.com/docs/domains/working-with-domains/add-a-domain — Vercel custom domain workflow
- https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting — www↔apex redirects
- https://vercel.com/docs/domains/working-with-ssl — SSL/ACME mechanism (HTTP-01 default)
- https://vercel.com/docs/domains/troubleshooting — CAA, _acme-challenge, common SSL issues
- https://vercel.com/kb/guide/domain-not-generating-ssl-certificate — Diagnostic steps
- https://vercel.com/changelog/domains-can-now-be-redirected-with-a-custom-status-code — 308 redirect support
- https://letsencrypt.org/docs/rate-limits/ — 50 certs/registered domain/week
- https://letsencrypt.org/docs/challenge-types/ — HTTP-01 vs DNS-01
- Local environment audit (this worktree, 2026-04-27): `openssl 3.5.5`, `vercel 52.0.0`, `curl 8.18.0`, `Resolve-DnsName 1.0.0.0` PRESENT; `dig` ABSENT.

### Secondary (MEDIUM confidence)
- https://www.hostinger.com/tutorials/how-to-use-hostinger-dns-zone-editor — UI fallback path documentation
- https://community.vercel.com/t/domain-cname-a-dns-records-in-vercel-rest-api-and-sdk/18783 — Vercel REST API for domain config (community-confirmed)
- https://vercel.com/blog/automatic-ssl-with-vercel-lets-encrypt — Vercel SSL workflow narrative

### Tertiary (LOW confidence — needs validation at execution time)
- https://developers.hostinger.com/ DNS endpoint **rate limits** — only documented for domain availability (10 req/min); zone endpoints' limits inferred from general API guidance. Not load-bearing for ≤10 calls in this phase.
- Whether `_vercel` TXT verification is required for fresh-domain Vercel adds — to be discovered at Wave 1 execution.
- Hostinger CNAME `content` trailing-dot handling — to be discovered from pre-cutover snapshot or first PUT response.

## Metadata

**Confidence breakdown:**
- Hostinger DNS API endpoints + auth: **HIGH** (cross-verified: developers.hostinger.com + hostinger/api-mcp-server + hostinger/api-php-sdk)
- Hostinger PUT body schema: **HIGH** (PHP SDK docs are auto-generated from OpenAPI; structure verified)
- Vercel domain add CLI: **HIGH** (official docs + Phase 35 ecosystem familiarity)
- Vercel ACME timing (HTTP-01, no pre-emit): **HIGH** (explicit in Vercel SSL docs; corrects D-06 framing)
- Vercel project-specific CNAME drift: **MEDIUM** (community discussion-confirmed; legacy fallback documented; agent should run `vercel domains inspect` for source of truth)
- Local environment availability: **HIGH** (direct shell audit, this worktree, 2026-04-27)
- Let's Encrypt rate limits: **HIGH** (official letsencrypt.org page)
- CAA record requirements for Let's Encrypt: **HIGH** (Vercel docs + LE docs)
- Pitfalls (TTL inheritance, browser cache, openssl on Windows): **HIGH** (Vercel + LACNIC + local audit)
- Hostinger snapshot list response shape: **LOW** (endpoint confirmed; exact JSON shape not in public docs; capture at execution)
- Whether `_vercel` TXT is required for fresh domains: **MEDIUM** (Vercel docs imply not — only for cross-account; verify at Wave 1)

**Research date:** 2026-04-27
**Valid until:** 2026-05-27 (30 days; Hostinger API + Vercel docs are stable; revisit if Vercel rolls out new domain config or Hostinger publishes API v2)
