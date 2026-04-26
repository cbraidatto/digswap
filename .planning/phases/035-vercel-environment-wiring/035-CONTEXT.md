# Phase 35: Vercel + Environment Wiring - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Criar projeto Vercel `digswap-web` (linkado ao GitHub `cbraidatto/digswap`, Root Directory `apps/web`), popular as 21 env vars com **Production scope only** (jamais "All Environments"), scope Preview separado apontando pro Supabase dev (Pitfall #9), regenerar `HANDOFF_HMAC_SECRET` + `IMPORT_WORKER_SECRET` frescos pra prod (≠ valores dev), pinar Node.js 20 (matching CI), reduzir HSTS pra `max-age=300` no launch window, e rodar Playwright smoke completo no `*.vercel.app` preview URL — **tudo ANTES de qualquer DNS cutover** (que é Phase 36).

Post-build `grep -r "service_role|STRIPE_SECRET|HANDOFF_HMAC|IMPORT_WORKER_SECRET|DATABASE_URL" apps/web/.next/static/` deve retornar zero hits.

</domain>

<decisions>
## Implementation Decisions

### Vercel project setup
- **D-01:** Project name = **`digswap-web`** (espaço pra `digswap-desktop` no v1.5). GitHub repo: `cbraidatto/digswap` (já existe). Root Directory = `apps/web`. Production branch = `main`.
- **D-02:** Team: `thiagobraidatto-3732's projects` (`team_WuQK7GkPndJ2xH9YKvZTMtB3` — único team no account). Recon (2026-04-26) confirmou zero projetos existentes — `digswap-web` é create-from-scratch.
- **D-03:** Plano: **Vercel Hobby** (sem Pro). Carrying forward de Phase 34 D-02 (Free-Tier launch). Trade-off aceito: 10s function timeout (vs 60s Pro), non-commercial ToS (aceitável sem Stripe), no instant rollback. Pro upgrade deferido pra quando primeiro paying user aparecer.
- **D-04:** Node.js runtime pinado a **20** em Project Settings → General (matches CI).

### Env var fill strategy (DEVIATION da disciplina mantida em Phase 34)
- **D-05:** **Tudo via MCP/CLI executado por Claude** — usuário escolheu esse caminho explicitamente após confirmação. Ciente que DB password + service_role key passam pelo contexto do AI temporariamente. Mitigações:
  - Secrets nunca commitados a arquivo (sem evidence file com valor real, sem SUMMARY.md com valor real)
  - HANDOFF_HMAC_SECRET + IMPORT_WORKER_SECRET gerados localmente via `openssl rand -hex 32` — **nunca passam pelo usuário**
  - Vercel CLI (não MCP — MCP oficial não tem env-write tools) é o vehicle primário, com `vercel env add KEY production` per env var
  - Se houver leak suspeitada, user revoga via Supabase Dashboard (service_role key) + Vercel Dashboard (regen project DB) + Phase 35.1 gap closure plan re-popula
- **D-06:** **Production scope only** em cada `vercel env add` — NUNCA "All Environments". Preview/Development scopes populados separadamente apontando pro Supabase **dev** (`mrkgoucqcbqjhrdjcnpw`).

### Deferred env vars (Stripe + Sentry + Discogs prod app)
- **D-07:** Stripe vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`, `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL`) → user pediu "deixar vazio". MAS `apps/web/src/lib/env.ts` linhas 23-30 exigem `min(10)` em production pra `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` quando NODE_ENV=production. Solução: **dummy strings com prefixo `DEFERRED_PHASE_37_*`** (>=10 chars) que passam validation mas falham se invocados. Phase 37 ativa Stripe Live e troca pelos valores reais. Os `NEXT_PUBLIC_STRIPE_PRICE_*` ficam genuinamente empty (default "" em env.ts) sem afetar build.
- **D-08:** Sentry vars (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`) → genuinamente empty. Phase 39 (Monitoring) ativa Sentry e popula valores reais.
- **D-09:** Discogs prod app (`DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET`) → hard `.min(1)` em env.ts. Solução: dummy `DEFERRED_PHASE_37` (passa min 1). Phase 37 owns Discogs prod app registration + swap.

### URLs canonical (NEXT_PUBLIC_*_URL)
- **D-10:** `NEXT_PUBLIC_APP_URL` = `https://digswap.com.br` (Production scope) **desde Phase 35**, mesmo o domínio só resolvendo após Phase 36 cutover. Trade-off aceito: previews em `*.vercel.app` que façam redirect absoluto pra digswap.com.br quebram entre Phase 35 e Phase 36. SEO/canonical headers ficam corretos desde dia 1.
- **D-11:** `NEXT_PUBLIC_SITE_URL` = idem (`https://digswap.com.br`).
- **D-12:** Preview scope dos `NEXT_PUBLIC_*_URL` → Vercel-assigned `$VERCEL_URL` (auto-injected, sempre `*.vercel.app`).

### Preview scope strategy (Pitfall #9 — preview NEVER touches prod)
- **D-13:** Preview env vars apontam **100% pro Supabase dev**:
  - `NEXT_PUBLIC_SUPABASE_URL` (Preview) = `https://mrkgoucqcbqjhrdjcnpw.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Preview) = anon key do dev (já no `.env.local` atual)
  - `SUPABASE_SERVICE_ROLE_KEY` (Preview) = service role do dev
  - `DATABASE_URL` (Preview) = pooler URL do dev
  - Stripe Preview = mesmo dummy do Production (Stripe deferido em ambos)

### Secrets regeneration (Pitfall #29 — fresh secrets, never reuse dev)
- **D-14:** `HANDOFF_HMAC_SECRET` (Production) gerado via `openssl rand -hex 32` (32 hex bytes = 64 char string >=32 char min). Valor jamais passa pelo usuário; Bash gera, MCP/CLI injeta direto no Vercel.
- **D-15:** `IMPORT_WORKER_SECRET` (Production) idem.
- **D-16:** Dev secrets em `apps/web/.env.local` permanecem inalterados — Phase 35 só toca Vercel.

### Build verification
- **D-17:** Após primeiro build verde no `*.vercel.app`, rodar **Playwright smoke completo** apontando `BASE_URL` pra Vercel-assigned URL. Tests existentes em `apps/web/tests/` (Phase 33.1 já provisionou Playwright). Cobertura: signup → email confirm → login → /perfil → /api/health (200 com `{db:ok}`). Cold-start verification incluída (Pitfall #8 — 35ed595 fix).

### Security headers
- **D-18:** HSTS = `max-age=300` durante launch window (Phase 35 → 38). Bump pra `max-age=31536000; includeSubDomains; preload` SOMENTE após Phase 38 UAT verde + 1 semana de soak limpo. Aderente a DEP-VCL-09.
- **D-19:** Outros security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) já existem em `apps/web/next.config.js` ou middleware — Phase 35 verifica que estão ligados em prod, não cria novos.

### Vercel CLI auth quirk
- **D-20:** O Bash sandbox do Claude Code NÃO persiste auth do `vercel` CLI entre calls. Cada `vercel <command>` pode triggerar device-code login fresh. Mitigação durante Phase 35 execute: usar **MCP Vercel** pra read/observability (zero re-auth) e minimizar Bash CLI a operações estritamente write (env add, link, deploy). Se múltiplos Bash CLI calls são necessários em sequência, batch eles num single Bash heredoc.

### Build-blocker dummy placeholder convention
- **D-21:** Sempre que um env var é "deferred mas validation rejeita empty", usar dummy com prefixo `DEFERRED_PHASE_NN_<note>` (Phase 37 ou 39 conforme apropriado). Padrão facilita find-and-replace na phase que ativa a integração. Exemplos:
  - `STRIPE_SECRET_KEY = sk_live_DEFERRED_PHASE_37_NOT_FOR_USE`
  - `STRIPE_WEBHOOK_SECRET = whsec_DEFERRED_PHASE_37_NOT_FOR_USE`
  - `DISCOGS_CONSUMER_KEY = DEFERRED_PHASE_37`
  - `DISCOGS_CONSUMER_SECRET = DEFERRED_PHASE_37`

### Claude's Discretion
- Vercel CLI command-line flag selection (e.g., `--yes` em link)
- Ordering das 21 env vars no `vercel env add` loop
- Como capturar evidence files (per-env-var log vs single dump)
- Halt-on-fail protocol se algum `vercel env add` falhar (provavelmente fix-forward inline + re-run)
- Quando exatamente trigger primeiro deploy production vs deixar Vercel auto-build no primeiro push

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 35 specs
- `.planning/ROADMAP.md` §"Phase 35: Vercel + Environment Wiring" (line ~620) — Goal + 6 success criteria + P0 pitfalls
- `.planning/REQUIREMENTS.md` §"Vercel + Environment Wiring" — DEP-VCL-01 through DEP-VCL-10 (10 requirements, all in-scope this phase)

### Phase 34 outputs (inputs to Phase 35)
- `.planning/phases/034-supabase-production-setup/034-SUMMARY.md` — Phase 34 SUMMARY incluindo "Inputs ready for Phase 35" table com URL prod, anon JWT, DATABASE_URL template, project_ref
- `.planning/phases/034-supabase-production-setup/evidence/14-database-url-template.txt` — Pooler URL template (3 tokens: aws-0-us-east-1.pooler.supabase.com:6543, ?pgbouncer=true, prepare:false)
- `.planning/phases/034-supabase-production-setup/evidence/06-vault-secrets.txt` — Confirmação que `trade_preview_publishable_key` Vault contém o legacy anon JWT (mesma key que vai pra `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` no Vercel)
- `.planning/phases/034-supabase-production-setup/evidence/00-path-deviation.md` — Pattern de path deviation (CLI→MCP) que se aplica também aqui (MCP+CLI híbrido)

### App env-var schema (CRITICAL for downstream)
- `apps/web/src/lib/env.ts` — **Source of truth do schema Zod**. Linhas 9-36 (server) e 38-55 (public). Documenta quais vars são hard-required, quais são `.min(N)`, quais têm defaults
- `apps/web/.env.local.example` — Inventory completo das 25 env vars (deduplica pra 21 in-scope após Stripe-deferred + Sentry-deferred classification)

### Pitfalls (P0 flagged for this phase)
- `.planning/research/PITFALLS.md` §1 — NEXT_PUBLIC_ misprefix (post-build secret grep)
- `.planning/research/PITFALLS.md` §9 — Preview deploys writing to prod Supabase (Production scope only)
- `.planning/research/PITFALLS.md` §22 — Vercel Hobby non-commercial (Pro before Stripe; here OK because no Stripe)
- `.planning/research/PITFALLS.md` §25 — Bandwidth overages (tighten middleware matcher)
- `.planning/research/PITFALLS.md` §29 — Dev HANDOFF_HMAC_SECRET in prod (regen fresh)
- `.planning/research/PITFALLS.md` §8 — Cold-start 500s (35ed595 fix verification — Phase 38 owns but Phase 35 build smoke can spot regressions early)

### Architecture
- `.planning/research/ARCHITECTURE.md` — Vercel iad1 region recommendation (matches Supabase us-east-1 from Phase 34 D-01)
- `.planning/research/STACK.md` §"Deploy infrastructure" — Vercel + Supabase + Hostinger topology

### Project conventions
- `pnpm-workspace.yaml` — `apps/*` + `packages/*` monorepo structure (Vercel Root Directory must be `apps/web`)
- `apps/web/package.json` — Build/lint/test scripts; engines absent (Vercel will pin via Project Settings)
- `package.json` (root) — `packageManager: pnpm@10.30.3` — Vercel must use pnpm 10
- `./CLAUDE.md` — Solo dev posture, GSD enforced, MCP-first patterns

### Vercel ecosystem (just installed)
- `.mcp.json` — Vercel MCP at `https://mcp.vercel.com` (project-scope, OAuth-authenticated as `thiagobraidatto-3732`)
- `~/.claude/plugins/cache/vercel/` — Vercel Plugin (`vercel@claude-plugins-official`) com slash commands `/env`, `/deploy`, `/status`, `/bootstrap`, `/marketplace`
- Vercel CLI v52.0.0 globally installed at `/c/Users/INTEL/AppData/Roaming/npm/vercel`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`apps/web/src/lib/env.ts`** — Zod schema centralizado. Build-blocking validation já exists; Phase 35 só popula valores que respeitem o schema.
- **Playwright tests existentes** em `apps/web/tests/` — Phase 33.1 instalou Playwright + chromium. Phase 35 reutiliza pra smoke contra `*.vercel.app`.
- **`apps/web/src/middleware.ts`** — Security headers config (HSTS reside aqui ou em next.config.js — verify durante execute).

### Established Patterns
- **MCP-first prod operations** (estabelecido em Phase 34) — usa MCP onde possível; CLI quando necessário; Dashboard só pra coisas que MCP+CLI não cobrem.
- **Path-deviation logging** (estabelecido em Phase 34 evidence/00) — quando execute desvia do plano por feature-doesn't-exist ou método melhor, registrar em `evidence/00-path-deviation.md`.
- **Per-env-var atomic operations** — cada `vercel env add` é uma operação independente; failure de uma não bloqueia outras.

### Integration Points
- **Vercel project ↔ GitHub `cbraidatto/digswap`** — `vercel link` ou Dashboard wizard.
- **Vercel build ↔ pnpm workspace** — Root Directory `apps/web`, build command `pnpm --filter @digswap/web build`, install command `pnpm install --frozen-lockfile`.
- **Vercel runtime ↔ Supabase prod** — DATABASE_URL pooler + NEXT_PUBLIC_SUPABASE_URL + service_role key (3 vectors de connectivity, todos via env vars).

### Creative Options Enabled
- **Vercel CLI hot-reload** — quando algum env var é trocado, Vercel auto-redeploy. Phase 35 pode populate em ordem (URLs primeiro, secrets depois) e ver build progressivo via MCP `get_deployment_build_logs`.
- **`/env` slash command** do plugin Vercel — pode automatizar bulk add. Vale testar durante Phase 35 execute.

</code_context>

<specifics>
## Specific Ideas

- **Vercel CLI re-auth quirk:** durante recon (2026-04-26), 2 chamadas Bash `vercel teams ls` + `vercel projects ls` triggeraram 2 device codes separados. O auth file da CLI não persiste bem entre Bash sub-shells dentro do Claude Code sandbox. Phase 35 execute deve batch CLI calls ou usar MCP onde possível pra evitar 21x device code prompts.
- **`thiagobraidatto-3732`** é o GitHub username do usuário. Já refletido em `git remote -v` (`origin https://github.com/cbraidatto/digswap.git`).
- **Plano Vercel atual** = Hobby Free (default em accounts novos). Sem cartão de crédito necessário pra Phase 35.

</specifics>

<deferred>
## Deferred Ideas

### Vercel Pro upgrade
- Trigger: primeiro paying user (futuro post-Stripe activation, presumivelmente milestone v1.5+)
- Benefits: 60s function timeout, instant rollback, commercial ToS, deploy retention
- Migration path: in-place upgrade no Vercel Dashboard, zero downtime

### Stripe activation (Phase 37 owns)
- Swap dummies `DEFERRED_PHASE_37_*` por valores reais Live mode
- Webhook setup com `whsec_live_*`
- Price IDs LIVE em `NEXT_PUBLIC_STRIPE_PRICE_*`

### Sentry activation (Phase 39 owns)
- Popular `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`
- Source map upload no build process
- `beforeSend` filter pra CSP noise + PII strip
- Spike protection enable

### Discogs prod app (Phase 37 owns)
- Registrar segundo Discogs app (digswap-prod, com callback `https://digswap.com.br/api/discogs/callback`)
- Swap `DEFERRED_PHASE_37` por `DISCOGS_CONSUMER_KEY` + `DISCOGS_CONSUMER_SECRET` reais

### HSTS 2-year bump
- Trigger: Phase 38 UAT verde + 1 semana de soak sem incident
- Comando: atualizar `max-age=300` → `max-age=31536000; includeSubDomains; preload` em `next.config.js` ou middleware
- Submeter pra HSTS preload list (chrome) opcionalmente

### Resend email setup (Phase 37 owns)
- Domain verification em Hostinger DNS (DKIM/SPF/DMARC)
- Popular `RESEND_API_KEY`, `RESEND_FROM_EMAIL = noreply@digswap.com.br`

### UPSTASH_REDIS setup (post-MVP)
- Phase 35 deixa empty — graceful degradation no `/api/discogs/import` route
- Post-MVP: criar Upstash Redis, popular `UPSTASH_REDIS_REST_URL/TOKEN` no Vercel
- Sem isso: Discogs library imports rodam sem caching/rate-limiting (mais lento mas funcional)

### YOUTUBE_API_KEY (post-MVP, optional)
- Phase 35 deixa empty — graceful degradation em release pages (sem YouTube embed)
- Post-MVP: criar Google Cloud project + YouTube Data API v3 + popular env var

### Doc-debt sweep ainda pendente
- Phase 34 flaggou: `digswap.com` → `digswap.com.br` rename em ROADMAP.md, REQUIREMENTS.md, PROJECT.md, research/*.md
- Recomendado QUICK pós-Phase 35 antes de Phase 36 DNS cutover (pra docs ficarem consistentes)
- Comando sugerido: `/gsd:quick "rename digswap.com → digswap.com.br across .planning/ docs"`

</deferred>

---

*Phase: 035-vercel-environment-wiring*
*Context gathered: 2026-04-26*
*Discussion mode: hybrid (4 + 3 gray areas, with code-driven validation finds)*
