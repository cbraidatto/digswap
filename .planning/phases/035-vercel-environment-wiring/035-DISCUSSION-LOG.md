# Phase 35: Vercel + Environment Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 035-vercel-environment-wiring
**Areas discussed:** Vercel ecosystem setup, Deferred env var handling, Env var fill strategy, HSTS lifecycle, Project naming, NEXT_PUBLIC_APP_URL, Preview scope, Build smoke depth

---

## Pre-discussion: Vercel ecosystem research + install

User asked me to research the Vercel MCP before continuing the discussion. I found:
- Official Vercel MCP at `https://mcp.vercel.com` exists (Beta, OAuth) — read-mostly + deploy + logs, **NO** project create or env var write tools
- Vercel Plugin for Claude Code (`vercel/vercel-plugin`) — 47+ skills, 5 slash commands (`/env`, `/deploy`, `/status`)
- Vercel CLI v52.0.0 — full write capabilities

User chose installation of all 3 (MCP + Plugin + CLI). After install, the Vercel CLI itself recommended swapping the plugin for the newer `vercel@claude-plugins-official` from the official Claude marketplace. User approved that swap. Final state:
- `.mcp.json` has `vercel` server (OAuth-authenticated as `thiagobraidatto-3732`)
- `~/.claude/plugins/cache/vercel/vercel-plugin` (newer, official marketplace version)
- `vercel` CLI globally installed

Recon results (post-install):
- Username: `thiagobraidatto-3732`
- Team: `thiagobraidatto-3732's projects` (`team_WuQK7GkPndJ2xH9YKvZTMtB3`)
- Existing projects: 0 (clean slate — `digswap-web` will be CREATE-from-scratch)

## Q1: Deferred env var handling (Stripe + Sentry)

| Option | Description | Selected |
|--------|-------------|----------|
| Deixar vazio/unset | Não adiciono no Vercel. Code recebe undefined. Phase 37/39 populam. Build pode quebrar se hard import | ✓ |
| Adicionar vazio (string vazia) | Defensivo contra undefined errors | |
| Adicionar valores dev/test | Test-mode keys no preview e prod (blur de ambientes) | |

**User's choice:** Deixar vazio/unset (recommended)
**Notes:** Code-side investigation revealed Stripe vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) ARE actually validated as `min(10)` in production by `apps/web/src/lib/env.ts`. So "deixar vazio" doesn't work as-is. Resolution: dummy strings with prefix `DEFERRED_PHASE_37_*` (>=10 chars) — captured as D-21 in CONTEXT.md. Same applies to `DISCOGS_CONSUMER_KEY/SECRET` (hard `.min(1)`).

---

## Q2: Env var fill strategy (who types what)

| Option | Description | Selected |
|--------|-------------|----------|
| MCP/CLI pras públicas + Dashboard pras secretas (Híbrido) | Eu adiciono via CLI as 7 NEXT_PUBLIC_*; user cola as 14 secretas no Dashboard. Discipline de Phase 34 mantida | |
| Tudo via Dashboard guiado | Zero credencial passa pelo AI. Mais lento (~25min cliques) | |
| Tudo via MCP/CLI (Claude faz tudo) | Eu populo as 21. DB password + service_role passam pelo contexto. **Não recomendado** | ✓ |

**User's choice:** Tudo via MCP/CLI (Claude faz tudo)
**Notes:** Explicit deviation from Phase 34 discipline of "secrets never enter AI context". User chose convenience. Mitigations captured in CONTEXT.md D-05: secrets never committed to evidence files or SUMMARY.md, HMAC + IMPORT_WORKER generated locally without user involvement, revocation path documented if leak suspected.

---

## Q3: HSTS lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Bump após Phase 38 UAT verde + 1 semana soak | max-age=300 durante launch window, 31536000 depois (DEP-VCL-09) | ✓ |
| Bump direto em Phase 35 | max-age=31536000 desde início — mais rígido mas se SSL break, users locked-out | |
| Sem HSTS até post-soak | Strict-Transport-Security removido — desnecessário com Vercel auto SSL | |

**User's choice:** Bump após Phase 38 + 1 semana soak (recommended)
**Notes:** Aligned with DEP-VCL-09 from REQUIREMENTS.md. Captured as D-18.

---

## Q4: Vercel project name

| Option | Description | Selected |
|--------|-------------|----------|
| `digswap` (sem sufixo) | Simples e direto | |
| `digswap-web` (espaço pra `digswap-desktop` futuro) | Consistente com pnpm workspace, futuro-proof | ✓ |
| Outro nome | User-defined | |

**User's choice:** `digswap-web`
**Notes:** Captured as D-01.

---

## Q5: NEXT_PUBLIC_APP_URL pre-DNS

| Option | Description | Selected |
|--------|-------------|----------|
| `https://digswap.com.br` desde Phase 35 | SEO/canonical correto dia 1; previews com redirects absolutos quebram entre 35→36 | ✓ |
| Vercel-assigned `*.vercel.app` até Phase 36 | Build smoke 100% funcional; mais env-flips | |
| Production = digswap.com.br + Preview = vercel.app | Prod URL não resolve até Phase 36 | |

**User's choice:** `https://digswap.com.br` desde Phase 35 (recommended)
**Notes:** Captured as D-10/D-11/D-12. Trade-off explícito que previews em vercel.app com redirects absolutos podem quebrar entre Phase 35 e 36.

---

## Q6: Preview scope env values

| Option | Description | Selected |
|--------|-------------|----------|
| Tudo Supabase dev + Stripe vazio | Preview deploys 100% no dev project (Pitfall #9 protection) | ✓ |
| Supabase dev + Stripe test mode | Stripe test no preview (contradiz deferred decision) | |
| Mesmo prod | **CRITICAL ERROR** — listed pra registrar nunca-essa-opção | |

**User's choice:** Tudo Supabase dev + Stripe vazio (recommended)
**Notes:** Captured as D-13. Aderente a DEP-VCL-03.

---

## Q7: Build smoke depth

| Option | Description | Selected |
|--------|-------------|----------|
| Mínimo — só /api/health 200 (recommended) | Phase 38 owns smoke completo | |
| Médio — /api/health + curl em /signin /signup /pricing (cold start) | Inclui Pitfall #8 verification | |
| Pesado — Playwright smoke completo contra vercel.app | Phase 38 duplication mas mais confiança early | ✓ |

**User's choice:** Pesado — Playwright smoke completo (NOT recommended, mas user picked)
**Notes:** Captured as D-17. Implications: Phase 35 plan precisa incluir step de rodar Playwright contra `BASE_URL=$VERCEL_URL`. Phase 33.1 já provisionou Playwright + chromium; tests existentes em `apps/web/tests/` reusable.

---

## Claude's Discretion (areas where user said "you decide")

- Vercel CLI command-line flag selection (e.g., `--yes` em link)
- Ordering das 21 env vars no `vercel env add` loop (provavelmente: NEXT_PUBLIC_* primeiro, secrets depois)
- Como capturar evidence files (per-env-var log vs single dump)
- Halt-on-fail protocol se algum `vercel env add` falhar
- Quando exatamente trigger primeiro deploy production vs deixar Vercel auto-build no primeiro push

## Deferred Ideas (preserved for future phases)

- **Vercel Pro upgrade** — trigger: primeiro paying user
- **Stripe activation** — Phase 37 swap dummies por valores Live
- **Sentry activation** — Phase 39 popular DSN + auth token + filters
- **Discogs prod app registration** — Phase 37
- **HSTS 2-year bump** — pós-Phase 38 + 1 semana soak
- **Resend email setup** — Phase 37 (DKIM/SPF/DMARC + RESEND_API_KEY)
- **UPSTASH_REDIS** — post-MVP (Discogs imports degrade gracefully sem)
- **YOUTUBE_API_KEY** — post-MVP (release pages degrade gracefully sem)
- **Doc-debt sweep `digswap.com` → `digswap.com.br`** — recomendado QUICK pós-Phase 35

## Code-driven findings (during discussion)

Reading `apps/web/src/lib/env.ts` revealed validation that affects Stripe/Discogs deferral plan:

- `STRIPE_SECRET_KEY`: `process.env.NODE_ENV === "production" ? z.string().min(10) : ...optional`
- `STRIPE_WEBHOOK_SECRET`: same pattern
- `DISCOGS_CONSUMER_KEY/SECRET`: hard `.min(1)` regardless of env
- `HANDOFF_HMAC_SECRET`: `process.env.NODE_ENV === "production" || process.env.VERCEL ? z.string().min(32) : ...default`
- `IMPORT_WORKER_SECRET`: hard `.min(1)`

These findings were folded into D-07/D-09/D-21 (dummy convention with `DEFERRED_PHASE_NN` prefix).
