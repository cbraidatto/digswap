# Phase 34: Supabase Production Setup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 034-supabase-production-setup
**Areas discussed:** Região do projeto prod, Pricing/tier strategy, Auto-pause handling, CORS do bucket trade-previews

---

## Região do projeto prod

| Option | Description | Selected |
|--------|-------------|----------|
| us-east-1 | Alinha com Vercel iad1 (default Hobby/Pro), latência DB↔API mínima; default global-neutral do ARCHITECTURE.md. Diverge do dev (us-west-2). | ✓ |
| us-west-2 (igual dev) | Paridade total dev↔prod, elimina diferenças de extensões/pooler. Vercel iad1 custa +70ms RTT. | |
| sa-east-1 (São Paulo) | Só faz sentido com base LATAM-pesada; péssimo para US/EU/JP. Vercel não tem região LATAM. | |

**User's choice:** us-east-1
**Notes:** Divergência dev(us-west-2)↔prod(us-east-1) aceita. Prod é a região que importa para latência de usuário real.

---

## Pricing / Tier strategy (escalation question)

Esta pergunta substituiu "Timing da ativação Pro" quando o usuário explicitou "quero lançar o app sem gastar nada". A decisão cascateia para outras fases do milestone.

| Option | Description | Selected |
|--------|-------------|----------|
| A — Free-tier, sem monetização | Supabase Free + Vercel Hobby. Stripe desligado no MVP. Aceita auto-pause e sem PITR. Reescrevo DEP-SB-08, DEP-SB-09, DEP-VCL-02/04, DEP-INT-01/02 como "deferido pós-MVP". Custo real: $0/mês. | ✓ |
| B — Pro só no cutover | Free durante setup (34-37), ativa Supabase Pro + Vercel Pro só na véspera do cutover. $45/mês a partir do lançamento; $0 até lá. | |
| C — Só Vercel Pro no lançamento | Supabase Free até sinal de dor. Vercel Pro obrigatório por causa do Stripe. $20/mês. | |
| D — Reconsiderar | Ver mais opções ou voltar depois. | |

**User's choice:** A — Free-tier, sem monetização
**Notes:** Decisão estratégica do milestone, não só da fase. Impacto em cascata: Stripe Live fora, Vercel fica em Hobby, Phase 16 Monetization volta ao backlog, Phase 37 scope reduzido.

---

## Auto-pause handling (substituiu "Alvo do ensaio PITR")

PITR ficou fora de escopo após decisão A. Em vez disso, precisávamos decidir como lidar com o auto-pause de 7 dias do Free-tier.

| Option | Description | Selected |
|--------|-------------|----------|
| UptimeRobot keep-alive | Ping a /api/health a cada 5 min (50 monitores gratuitos). Mantém projeto ativo. Já é requirement em Phase 39 (DEP-MON-03). | |
| Aceitar auto-pause | 7 dias sem tráfego → pausa. Primeiro hit depois tem ~1s de cold wake-up. Em lançamento ativo o tráfego natural mantém ativo. | ✓ |
| Cron externo (cron-job.org) | Serviço cron gratuito disparando request a cada 3 dias. Mais simples mas menos observável. | |

**User's choice:** Aceitar auto-pause
**Notes:** Pragmatismo — sem keep-alive artificial. Consequência aceita: pg_cron jobs não executam durante pausa (mas permanecem `active`, então DEP-SB-05 ainda é satisfeito).

---

## CORS do bucket trade-previews

| Option | Description | Selected |
|--------|-------------|----------|
| digswap.com desde já | Configura domínio real no CORS já na Phase 34. Qualquer teste *.vercel.app falha CORS (intencional). | ✓* |
| *.vercel.app primeiro, trocar depois | Temporário até Phase 36; requer task de update em Phase 36. Mais etapas, mais risco de esquecer. | |
| Ambas origins durante transição | Lista ambas até fim do soak de 1 semana. Zero fricção no cutover. | |

**User's choice:** digswap.com desde já — **com correção crítica:** domínio real é `digswap.com.br`, não `digswap.com`
**Notes:** Revelação durante discussão. CORS vai ser `https://digswap.com.br` + `https://www.digswap.com.br`. ROADMAP/REQUIREMENTS têm `digswap.com` hard-coded em vários lugares — registrado como doc debt em deferred.

---

## Claude's Discretion

Áreas onde o usuário deixou decisão para o planner/Claude durante planning:
- Flags de `supabase db push` (ex.: `--dry-run` como safety step)
- Formato exato dos evidence snippets (screenshots vs psql output)
- Ordem interna da fase (criar→link→push vs criar→push direto)
- Protocolo de halt-on-fail (fix-forward inline vs abrir Phase 34.1)
- Timing da criação de audit user em prod (Phase 34 agora vs Phase 38 depois)

## Deferred Ideas

- Ativação do Supabase Pro (quando 500MB apertar ou monetização virar scope)
- PITR + rehearsal (vai junto com Pro)
- Stripe Live activation (Phase 37 reescrito sem ele)
- Vercel Pro upgrade (Phases 35/38 precisam revisitar)
- UptimeRobot keep-alive (Phase 39 original cobre)
- **Doc sync debt: `digswap.com` → `digswap.com.br`** em ROADMAP/REQUIREMENTS/PROJECT
- pg_cron behavior sob auto-pause (validar em staging)
- Audit user em prod (planner decide timing)
- Protocolo de halt-on-fail (planner decide)
- Stripe event log cron ativo-mas-dormente (deixar rodando vs unschedule)

## Areas não discutidas (saltadas explicitamente)

- **Alvo do ensaio PITR** — salto porque PITR saiu de escopo após decisão A
- **Timing da ativação Pro original** — salto pelo mesmo motivo; virou "Pricing strategy"
