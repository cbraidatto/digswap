# Phase 36: DNS + SSL Cutover - Context

**Gathered:** 2026-04-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Cutover do DNS de `digswap.com.br` (registrado no Hostinger) pra apontar no projeto Vercel `digswap-web`, com cert Let's Encrypt automático via Vercel ACME, redirect 308 de `www` pro apex, MX/email não configurado nesta fase (Phase 37 owns), zone snapshot capturado pra rollback rápido (TTL=300s na semana de cutover), Playwright anon smoke verde contra `https://digswap.com.br`. **Ponto de não-retorno** — depois que DNS resolve, todo problema é incidente live; mitigado por modo invite-only (só usuário + sócio) até Phase 38 UAT clean.

**Não inclui:**
- Anúncio público do site (gated em Phase 38 UAT clean — D-11)
- HSTS bump pra `max-age=31536000` (gated em D-18 da Phase 35: Phase 38 UAT + 1 semana soak)
- TTL bump 300s → 3600s (mesmo trigger do HSTS bump — D-10)
- MX/SPF/DMARC pra email transacional (Phase 37 com Resend)
- UptimeRobot probe + Sentry prod (Phase 39 — parallel track, DEPOIS do flip)
- Subdomains adicionais (app./api./status. — fora do escopo)

</domain>

<decisions>
## Implementation Decisions

### Domínio + Registrar (Area 1)
- **D-01:** Domínio canonical = `digswap.com.br` (já lockado em Phase 35 D-10 + project memory `project_mvp_launch_strategy.md`). ROADMAP/REQUIREMENTS referenciam `digswap.com` — doc-debt rastreada como POST-PHASE-36 QUICK (rename global em `.planning/`).
- **D-02:** Registrar = **Hostinger** (.com.br reseller). Painel próprio de DNS + API pública via token.
- **D-03:** Claude opera DNS programaticamente via Hostinger DNS API (preferred path); fallback pra checkpoint:human-action via UI se a API não cobrir o flow ou falhar.
- **D-04:** Email no domínio **não está em uso ainda**. DEP-DNS-07 (preservar MX) é **N/A** pra cutover atual — não há MX existente a preservar. Phase 37 owns SPF/DKIM/DMARC + MX para Resend.
- **D-05:** Subdomains nesta fase = **apenas apex + www** (`digswap.com.br` + `www.digswap.com.br`). `app.`, `api.`, `status.` etc. não estão no escopo.

### Estratégia de Cutover + www (Area 2)
- **D-06:** Ordem = **(a) adicionar `digswap.com.br` + `www.digswap.com.br` no Vercel primeiro** (Vercel emite TXT `_vercel` verification record + pre-emite cert ACME), **depois (b) flip DNS no Hostinger**. Zero janela de cert error pro usuário.
- **D-07:** **Apex `digswap.com.br` = canonical**; `www.digswap.com.br` redireciona via 308 pro apex (Vercel nativo via "Redirect to" config).
- **D-08:** Vercel domain config = **CLI + MCP** (`vercel domains add` ou MCP `add_domain` se existir; coerente com hybrid pattern Phase 35: CLI pra writes, MCP pra reads).
- **D-09:** Cert ACME falha = **checkpoint:human-action no plan**. Plan-phase apresenta as opções (rollback DNS imediato vs pause + root-cause via dig CAA/TXT) e usuário decide caso a caso no momento do incidente.

### TTL + Soak + Announcement (Area 3)
- **D-10:** TTL durante cutover = **300s** (LOCKED por DEP-DNS-06). Bump pra **3600s** = mesmo trigger do HSTS bump (Phase 35 D-18 = Phase 38 UAT clean + 1 semana soak). Sincronia: ambos hardenings na mesma janela.
- **D-11:** Site declarado "no ar" publicamente = **somente após Phase 38 UAT clean**. Phase 36 entrega modo **invite-only soak interno** (acessível pra usuário + sócio; não anunciado).
- **D-12:** UptimeRobot probe externo = **Phase 39 owns** (parallel track). Configura DEPOIS do flip + cert OK; Phase 36 não toca em monitoring.
- **D-13:** Soak window Phase 36 → PASS = **1 hora pós-cert válido** com smoke (3 resolvers dig + 5× curl `/api/health` + Playwright anon). Sem 24h soak — pragmático pra invite-only.

### Verificação + Rollback (Area 4)
- **D-14:** Resolvers pra validar propagação DNS = **3 redes independentes**: `1.1.1.1` (Cloudflare) + `8.8.8.8` (Google) + `9.9.9.9` (Quad9). Resolução consistente em 3 = DEP-DNS-04 PASS.
- **D-15:** Rollback strategy = **zone snapshot ANTES do flip** (`dig digswap.com.br ANY +noall +answer` pré-cutover salvo em evidence/), restaurado via Hostinger API se falhar. TTL=300s dá ~5min de revert. Backup manual via UI do Hostinger se API der problema durante o incidente.
- **D-16:** Smoke pra Phase 36 PASS = **openssl s_client** (cert válido + chain LE + apex covers www via SAN ou redirect) + **curl /api/health** (200 + database:ok) + **Playwright anon suite** (`PLAYWRIGHT_BASE_URL=https://digswap.com.br`, mesma matriz de 16 testes que passaram na Phase 35 contra `*.vercel.app`).
- **D-17:** Cert ACME timeout > 30min após DNS flipar = **investigate primeiro** (dig CAA `digswap.com.br`, dig TXT `_acme-challenge.digswap.com.br`, Vercel runtime logs via MCP) ANTES de considerar rollback. Causas comuns: CAA bloqueando, `_vercel` TXT verification ainda não propagou, rate limit do Let's Encrypt.

### Hostinger API Discovery (Area 5)
- **D-18:** Acesso programático ao Hostinger DNS = **research na phase-research**. RESEARCH.md cobre:
  1. Hostinger DNS API existe? (provavelmente sim — Hostinger tem API REST geral)
  2. Endpoints relevantes (list DNS records, create record, update record, delete record)
  3. Como gerar token (provavelmente Settings → API Tokens no painel)
  4. Capabilities cover all needed operations? (A, CNAME, TXT add/update/remove)
  5. Rate limits + idempotency
  6. Fallback pra UI manual se a API não cobrir o flow (Plan-phase emite passo-a-passo + Claude verifica via dig)
- **D-19:** Token Hostinger será passado pelo usuário no momento via padrão da Phase 35: `printf '%s' '<token>' > ~/.hostinger-token` (ASCII, sem BOM, sem newline). Mesmo `--sensitive` handling.

### Pitfalls aplicáveis (LOCKED de fases anteriores)
- **P12** (DNS set but SSL not ready): mitigado por D-06 (Vercel domain add primeiro pre-emite cert)
- **P13** (HSTS locks users in): mitigado por Phase 35 D-18 (HSTS=300 launch-window; bump diferido)
- **Cert ACME race**: mitigado por D-17 (investigate antes de rollback) + D-09 (checkpoint:human-action)

### Claude's Discretion
- Vercel CLI vs Vercel MCP exata syntax pra `vercel domains add` (research determina)
- Hostinger DNS API exact endpoints + auth scheme (research determina)
- Evidence file naming (siga padrão Phase 35: `01-pre-cutover-zone.txt`, `02-vercel-domain-add.log`, etc.)
- Wave structure: provavelmente Wave 0 (scaffolding + pre-cutover snapshot) → Wave 1 (Vercel domain add + verify) → Wave 2 (DNS flip + propagation wait) → Wave 3 (cert verify + smoke + SUMMARY)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### ROADMAP + REQUIREMENTS
- `.planning/ROADMAP.md` §"Phase 36: DNS + SSL Cutover" (linha 641) — goal, depends-on, success criteria, pitfalls flagged
- `.planning/REQUIREMENTS.md` linhas 58-64 — DEP-DNS-01 a DEP-DNS-07 (acceptance bullets)

### Phase 35 outputs (LOCKED dependencies)
- `.planning/phases/035-vercel-environment-wiring/035-SUMMARY.md` — Vercel project ID, prod URL, env vars, HSTS=300, deploy state
- `.planning/phases/035-vercel-environment-wiring/035-CONTEXT.md` D-10 — `NEXT_PUBLIC_APP_URL=https://digswap.com.br`
- `.planning/phases/035-vercel-environment-wiring/035-CONTEXT.md` D-18 — HSTS bump trigger (Phase 38 + 1 semana soak)
- `.planning/phases/035-vercel-environment-wiring/evidence/06a-project-settings.txt` — Vercel project config snapshot

### Project memory (Brazilian launch)
- `C:\Users\INTEL\.claude\projects\C--Users-INTEL-Desktop-Get-Shit-DOne\memory\project_mvp_launch_strategy.md` — domínio real `digswap.com.br`, MVP v1.4 free-tier launch strategy

### CLAUDE.md project guidelines
- `CLAUDE.md` (root) — solo developer constraints, simplicity-first, GSD workflow enforcement

### External docs (research-time)
- Vercel custom domain docs (research will fetch via Context7 / web)
- Vercel ACME / Let's Encrypt cert docs
- Hostinger DNS API docs (presence + auth pending research)
- ICP-Brasil / Registro.br policies for `.com.br` (DNS delegation requirements)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`apps/web/playwright.config.ts`**: já suporta `PLAYWRIGHT_BASE_URL` override (Phase 35 Plan 01) — Phase 36 smoke usa o mesmo flag com `https://digswap.com.br`
- **`apps/web/src/app/api/health/route.ts`**: endpoint `/api/health` retorna 200 + database:ok (validado em Phase 35 evidence/07) — usado como smoke probe pós-cutover
- **`.planning/phases/035-vercel-environment-wiring/evidence/`**: padrão de evidence files (numbered, log/txt, sanitized) — seguir mesmo convention

### Established Patterns
- **Hybrid CLI + MCP + Dashboard** (Phase 35): CLI pra writes, MCP pra reads/inspect/logs, Dashboard pra OAuth one-time. Phase 36 estende com Hostinger API.
- **Zone snapshot evidence** (novo pra Phase 36): `dig +noall +answer ANY` pré e pós-flip salvos pra audit + rollback
- **Token via printf ASCII** (Phase 35 token leak lessons): `printf '%s' '<token>' > ~/.hostinger-token` (sem BOM, sem newline)
- **GitHub auto-deploy via main push**: não usado nesta fase (sem code change esperada — só DNS + Vercel domain config)

### Integration Points
- **Vercel projeto `digswap-web`** (LOCKED Phase 35): receber `digswap.com.br` + `www.digswap.com.br` como custom domains
- **NEXT_PUBLIC_APP_URL** (LOCKED Phase 35): já é `https://digswap.com.br`; código já redireciona corretamente uma vez que DNS resolve
- **Hostinger painel DNS** (externo): API token gerado pelo usuário durante execução

</code_context>

<specifics>
## Specific Ideas

- **Vercel domain add output**: capturar TXT `_vercel` verification record que Vercel pede + tempo até pre-emit cert (logs em evidence)
- **Pre-cutover zone snapshot**: `dig digswap.com.br ANY +noall +answer @1.1.1.1` salvo como `evidence/01-pre-cutover-zone.txt` ANTES de tocar em qualquer coisa
- **Post-cert openssl run**: `openssl s_client -connect digswap.com.br:443 -servername digswap.com.br </dev/null 2>&1 | grep -E "issuer=|subject=|verify return code"` salvo como evidence
- **3-resolver dig matrix**: script bash que roda `dig @{1.1.1.1,8.8.8.8,9.9.9.9} digswap.com.br A +short` e compara — DEP-DNS-04 PASS quando todos retornam `76.76.21.21`
- **Playwright base URL flip**: rerun da mesma suite Phase 35 (`apps/web/tests/e2e/`) com novo BASE_URL — espera-se 16 PASS + 19 SKIP + 5 test-debt FAIL (mesmas que Phase 35; tracked POST-PHASE-35)
- **Invite-only mode**: nenhum mecanismo técnico de gating (não há feature flag); compromisso é não anunciar publicamente até Phase 38 UAT clean

</specifics>

<deferred>
## Deferred Ideas

### Para Phase 37 (External Integrations)
- MX records pra Resend (transactional email)
- SPF/DKIM/DMARC pra `noreply@digswap.com.br`
- Stripe webhook URL on `https://digswap.com.br/api/stripe/webhook`
- OAuth callbacks (Google/GitHub) pra prod URL

### Para Phase 38 (UAT)
- Trigger pra anúncio público = "site no ar"
- Bump TTL 300s → 3600s (após 1 semana soak)
- Bump HSTS max-age=300 → 31536000 (após 1 semana soak)
- Provisionar audit user pra `session-revocation.audit.spec.ts`
- Fix dos 5 Playwright locator bugs (carry-over POST-PHASE-35)

### Para Phase 39 (Monitoring — parallel track)
- UptimeRobot probe contra `https://digswap.com.br/api/health`
- Sentry prod DSN + beforeSend filter
- Vercel Analytics + Speed Insights

### Para POST-PHASE-36 QUICK
- Rename global `digswap.com` → `digswap.com.br` em todos `.planning/` docs (já flagged em Phase 34 SUMMARY; persiste pendente)

### Out of scope permanente nesta milestone
- Subdomains adicionais (`app.`, `api.`, `status.`)
- IPv6 (AAAA records) — não requirement; Vercel suporta nativamente quando ativado
- DNSSEC — overkill pra invite-only soak

</deferred>

---

*Phase: 036-dns-ssl-cutover*
*Context gathered: 2026-04-27*
