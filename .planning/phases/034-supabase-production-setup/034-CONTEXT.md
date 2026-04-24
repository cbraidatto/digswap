# Phase 34: Supabase Production Setup - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Provisionar o projeto `digswap-prod` do Supabase como projeto isolado de dev: criar o projeto, aplicar todas as migrations via `supabase db push --linked` (nunca `drizzle-kit`), validar RLS via Security Advisor, fazer deploy das 2 Edge Functions (`cleanup-trade-previews`, `validate-preview`), confirmar pg_cron com 3+ jobs ativos, popular o Vault com os secrets que o pg_cron precisa, criar o bucket `trade-previews` com CORS + 48h TTL + Public=off, e pinnar o `DATABASE_URL` no PgBouncer transaction pooler (porta 6543 + `prepare: false`).

**Escopo reduzido nesta discussão** (decisão "Lançamento Free-Tier, sem monetização"):
- DEP-SB-08 (Supabase Pro + auto-pause off) → **deferido pós-MVP**
- DEP-SB-09 (PITR + rehearsed restore) → **deferido pós-MVP**
- Backup diário automático do Supabase Free substitui PITR para o MVP

**Não é Phase 34:**
- Wiring do app (Vercel env vars, build) — Phase 35
- DNS + SSL cutover — Phase 36
- OAuth callbacks / Stripe / Resend — Phase 37
- Smoke tests contra produção — Phase 38
- Monitoring prod (Sentry, UptimeRobot, Vercel Analytics) — Phase 39

</domain>

<decisions>
## Implementation Decisions

### Região do projeto prod
- **D-01:** Projeto `digswap-prod` criado em **`us-east-1`** (US East, N. Virginia). Razão: alinha com Vercel `iad1` (default Hobby/Pro) minimizando RTT DB↔API serverless. Global-neutral para a base de diggers internacional (US/EU/JP/BR). Diverge do dev (us-west-2) — aceito porque prod é a região que importa para latência real de usuário.

### Pricing / tier strategy (decisão estratégica do milestone)
- **D-02:** Lançamento em **Free-Tier, sem monetização**. Supabase Free + Vercel Hobby. Stripe Live fica **deferido pós-MVP** — não há assinaturas no v1.4.
- **D-03:** `DEP-SB-08` (Supabase Pro active, auto-pause off) → **deferido**. Aceito auto-pause de 7 dias (ver D-04).
- **D-04:** **Aceitar auto-pause** do free-tier. Se projeto ficar 7 dias sem tráfego, ele pausa; primeiro request após pausa tem ~1s de cold wake-up. Em lançamento ativo isso é irrelevante. **Consequência aceita:** pg_cron jobs não executam durante pausa (mas permanecem `active` — DEP-SB-05 ainda satisfeito).
- **D-05:** `DEP-SB-09` (PITR + rehearsed restore) → **deferido**. Backup diário automático do Supabase Free cobre 95% dos cenários de recovery para MVP. Rehearsal de restore sobe para milestone pós-MVP quando Pro for ativado.

### Domain correction (descoberta durante discussão)
- **D-06:** Domínio real comprado pelo usuário é **`digswap.com.br`**, não `digswap.com`. ROADMAP.md, REQUIREMENTS.md e PROJECT.md têm `digswap.com` em vários lugares — é **doc debt** que Phase 34 planning deve limpar antes de executar (ou registrar como QUICK pós-execução). Toda URL de produção daqui em diante usa `.com.br`.

### CORS do bucket trade-previews (DEP-SB-07)
- **D-07:** CORS do bucket `trade-previews` configurado em Phase 34 com `https://digswap.com.br` + `https://www.digswap.com.br`. Origem hard-coded para o domínio real desde a criação do bucket. **Consequência aceita:** qualquer teste pré-cutover vindo de `*.vercel.app` vai falhar CORS — intencional, força todo fluxo de upload a passar pelo domínio oficial.
- **D-08:** Bucket permanece `Public = off`, TTL de 48h via Storage lifecycle rule (per DEP-SB-07 + Pitfall #20).

### Migrations / database strategy
- **D-09:** Migrations aplicadas exclusivamente via `supabase link --project-ref <prod-ref>` + `supabase db push --linked`. **Nunca** `drizzle-kit push` ou `drizzle-kit migrate` contra prod (herdado de Phase 33 D-01/D-04 — trilha `supabase/migrations/` é autoritativa).
- **D-10:** Antes de cada comando destrutivo (push, reset), confirmar manualmente que `supabase link` aponta para o project ref de prod. Pitfall #4 (wrong-DB migration) é eliminado por disciplina de verificação, não por ferramental.
- **D-11:** Security Advisor rodado após o push — bloqueio da fase se qualquer tabela sem RLS ou policy quebrada aparecer. Teste sob role `authenticated` com JWT real, não só service_role (Pitfall #5).

### Vault + pg_cron setup
- **D-12:** Vault populado **antes** de qualquer função agendada rodar. Secrets obrigatórios: `trade_preview_project_url` + `trade_preview_publishable_key` (DEP-SB-06). Extensão do Vault já está coberta pela migration `20260424000000_enable_vault_extension.sql` (Phase 33.1).
- **D-13:** pg_cron jobs rodam sob role `postgres` via `cron.schedule()` (Pitfall #18). Os 3+ jobs ativos esperados: `ranking_recompute`, `cleanup_trade_previews`, `purge_soft_deleted` (stripe-event-log é opcional e deferido porque Stripe está fora do MVP).

### Connection pooler (DEP-SB-10)
- **D-14:** `DATABASE_URL` de prod usa o pooler transaction-mode: `aws-0-us-east-1.pooler.supabase.com:6543` com query string `?pgbouncer=true`. Drizzle config usa `prepare: false` para compatibilidade com PgBouncer transaction mode (Pitfall #17). Essa string **não** é escrita no Vercel nesta fase — só aqui fica documentado o formato para Phase 35 consumir.

### Claude's Discretion
- Escolha exata de quais flags passar para `supabase db push` (ex.: `--dry-run` como step de safety antes do apply)
- Formato/nomenclatura dos evidence snippets capturados (screenshots do dashboard vs psql output)
- Ordem de execução dentro da fase (criar projeto → link → push vs criar projeto → push direto)
- Protocolo de halt se algum passo falhar (fix-forward inline vs abrir Phase 34.1) — a critério do planner durante planning
- Como tratar a criação de audit user no prod (agora vs deferir para Phase 38)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### Project-level specs e decisões
- `.planning/PROJECT.md` — Core value, constraints, solo-dev posture
- `.planning/REQUIREMENTS.md` §"Supabase Production Setup" — 10 DEP-SB-* requirements (note: DEP-SB-08 e DEP-SB-09 marcados como deferidos por esta fase)
- `.planning/ROADMAP.md` §"Phase 34" — Goal, success criteria, P0 pitfalls
- `.planning/STATE.md` — Progresso, blockers (inclui "Region selection decision owed")

### Phase 33 / 33.1 — baseline herdada
- `.planning/phases/033-pre-deploy-audit-gate/033-CONTEXT.md` — Decisões D-01 (migrations authoritative) e D-04 (drizzle-kit block)
- `.planning/phases/033-pre-deploy-audit-gate/033-VERIFICATION.md` — Evidence de que migrations resetam clean
- `.planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md` — Baseline AMBER → GREEN flip
- `.planning/phases/033.1-audit-gate-closure/RUNBOOK.md` — Gotcha `.env.local NEXT_PUBLIC_APP_URL`
- `.planning/phases/033.1-audit-gate-closure/033.1-VERIFICATION.md` — Vault instalado no dev + oauth.ts hardened
- `.planning/ADR-003-drizzle-dev-only.md` — Política trilha autoritativa + Historical Note

### Research outputs (ler completos)
- `.planning/research/SUMMARY.md` — Synthesis do milestone v1.4
- `.planning/research/STACK.md` — Deploy-layer versions
- `.planning/research/ARCHITECTURE.md` — Migration pipeline decision, region recommendation (us-east-1 default)
- `.planning/research/PITFALLS.md` §3, §4, §5, §11, §17, §18, §20, §26 — pitfalls flagged no ROADMAP

### Código relevante para Phase 34
- `supabase/migrations/` (35 arquivos) — trilha completa a aplicar em prod
- `supabase/migrations/20260424000000_enable_vault_extension.sql` — Vault + wrappers, deve ser aplicada antes de qualquer Discogs OAuth flow
- `supabase/functions/cleanup-trade-previews/index.ts` — Edge Function #1 (DEP-SB-04)
- `supabase/functions/validate-preview/index.ts` — Edge Function #2 (DEP-SB-04)
- `supabase/migrations/20260327_ranking_function.sql` L85-86 — `cron.schedule()` para ranking recompute
- `supabase/migrations/20260417_trade_preview_infrastructure.sql` L187 — `cron.schedule()` para cleanup
- `supabase/migrations/20260419_purge_soft_deleted.sql` L14 — `cron.schedule()` para purge
- `apps/web/src/lib/discogs/oauth.ts` — storeTokens() depende de Vault wrapper em prod (Phase 33.1 hardened)

### Memory (outside repo)
- `~/.claude/projects/C--Users-INTEL-Desktop-Get-Shit-DOne/memory/project_vinyldig.md` — Core context VinylDig
- `~/.claude/projects/C--Users-INTEL-Desktop-Get-Shit-DOne/memory/project_security_posture.md` — Security baseline

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Migration trail autoritativa** — `supabase/migrations/` com 35 arquivos. Phase 33 provou que resetam limpo em throwaway Cloud. Phase 34 aplica exatamente a mesma trilha em `digswap-prod`.
- **Edge Functions implementadas** — `cleanup-trade-previews` e `validate-preview` já existem em `supabase/functions/` com `index.ts` prontos para `supabase functions deploy`.
- **Vault wrappers** — `public.vault_create_secret` e grants idempotentes já estão na migration `20260424000000_enable_vault_extension.sql` (Phase 33.1). Nenhum código novo precisa ser escrito.
- **Pattern de audit user via Admin API** — Phase 33.1 estabeleceu que usuários de teste são criados via `POST /auth/v1/admin/users` com `email_confirm=true`. Mesma técnica disponível para Phase 38 criar audit user em prod.

### Established Patterns
- **`supabase/migrations/` é a única trilha que prod aceita** — ADR-003 documenta; Phase 33 verificou; Phase 34 aplica.
- **pg_cron jobs sob role `postgres`** — todos os 3 jobs já existentes (ranking, cleanup, purge) usam `cron.schedule(...)` padrão. Nada específico de prod a alterar.
- **`prepare: false` em drizzle config com pooler transaction mode** — já aplicado em `apps/web/scripts/sim-upload.ts`; mesmo pattern vai para a config de prod em Phase 35.

### Integration Points
- **Supabase CLI** — `supabase link`, `supabase db push --linked`, `supabase functions deploy`, `supabase secrets set` são os comandos primários desta fase. Já está em devDependencies.
- **Supabase Dashboard** — criação do projeto, Security Advisor, bucket CORS, e verificação do billing plan são steps manuais via dashboard (não há API pública para criação de projeto).
- **Vercel env vars** — **não tocadas nesta fase** (Phase 35 owns). Phase 34 só documenta o formato do `DATABASE_URL` para Phase 35 consumir.

### Creative Options Enabled
- **UptimeRobot keep-alive ficou disponível mas não selecionado** — se usuário mudar de ideia sobre aceitar auto-pause, DEP-MON-03 (Phase 39) já planeja ping a /api/health a cada 5 min, o que mataria o problema de graça.
- **Stripe event log migration (`20260106_drizzle_0005_stripe_event_log.sql`) fica aplicada mas não usada** — tabela existe em prod, nenhum webhook escreve nela até Phase 37. Zero harm.

</code_context>

<specifics>
## Specific Ideas

- **"Quero lançar o app sem gastar nada"** — decisão explícita do usuário em 2026-04-24 que reescreve o escopo de Phase 34 (remove DEP-SB-08/09) e do milestone inteiro (Stripe, Vercel Pro, monetização ficam pós-MVP). É uma decisão estratégica, não só técnica.
- **Auto-pause aceito como compromisso pragmático** — usuário optou por não orquestrar keep-alive. Em lançamento ativo o tráfego natural mantém ativo; se morrer por invisibilidade, o cold wake-up é aceitável.
- **Domínio `digswap.com.br` revelado durante discussão** — informação nova; planner precisa tratar como fonte única da verdade para URLs de produção em todas as fases seguintes.

</specifics>

<deferred>
## Deferred Ideas

### Deferidos por decisão "Free-Tier Launch"
- **Ativação do Supabase Pro** — momento: quando 500MB DB começar a pressionar OU quando primeiro usuário pagante aparecer (se decisão futura de ligar Stripe mudar). Migration path: Supabase Pro é upgrade in-place, zero downtime.
- **PITR + rehearsal de restore** — adiado junto com Pro; backup diário automático cobre MVP. Post-MVP, rodar rehearsal em um throwaway Pro project.
- **Stripe Live activation** — remove-se toda Phase 37 scope de Stripe (DEP-INT-01/02). Phase 37 fica com Discogs prod app + OAuth + Resend apenas. Phase 16 (Monetization) volta ao backlog.
- **Vercel Pro upgrade** — Phases 35/38 precisam revisitar (Hobby impõe non-commercial ToS + 10s function timeout + no rollback). Sem Stripe no MVP, o non-commercial ToS técnicamente é satisfeito, mas 10s timeout pode apertar em queries de ranking.
- **UptimeRobot keep-alive** — deferido para Phase 39 per roadmap original; se auto-pause virar problema antes, antecipa trivialmente.

### Descobertos durante discussão
- **Doc sync debt — `digswap.com` → `digswap.com.br`** — ROADMAP.md, REQUIREMENTS.md, PROJECT.md e potencialmente .planning/research/*.md têm `digswap.com` hard-coded. Phase 34 planning deve listar todas ocorrências e decidir: corrigir em bulk durante Phase 34 (mais trabalho) ou abrir QUICK pós-Phase 34 para limpeza atômica.
- **pg_cron behavior sob auto-pause** — worth ADR: confirmar que `cron.schedule()` retoma automaticamente após unpause sem duplicar execuções missed. Validar em staging antes de prod via teste curto (pausa forçada + observação do schedule).
- **Audit user em prod para Phase 38** — criar via Admin API agora (Phase 34) vs diferir para Phase 38. A critério do planner. Vantagem de agora: Phase 38 só consome; vantagem de diferir: prod fica "limpo" até o último momento.
- **Protocolo de halt-on-fail durante execução** — se `supabase db push` falhar no meio, drop+recreate project vs fix-forward inline vs abrir Phase 34.1. Plan owner decide; default razoável é fix-forward para pequenos (migration ordering) e drop+recreate para catastróficos.

### Stripe event log tabela aplicada-mas-dormente
- Migration `20260106_drizzle_0005_stripe_event_log.sql` cria `stripe_event_log` table + cron job `cleanup-stripe-event-log`. No MVP sem Stripe, esse cron pode ser deixado ativo (zero impacto — tabela sempre vazia) ou desativado explicitamente via `cron.unschedule()`. Decisão durante planning.

</deferred>

---

*Phase: 034-supabase-production-setup*
*Context gathered: 2026-04-24*
