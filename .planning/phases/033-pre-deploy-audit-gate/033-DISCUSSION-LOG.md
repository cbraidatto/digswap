# Phase 33: Pre-Deploy Audit Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-21
**Phase:** 033-pre-deploy-audit-gate
**Areas discussed:** Drift `drizzle/` vs `supabase/migrations/`, `supabase db reset` test environment, Cold-start verification strategy, Audit artifacts + failing-gate handling

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Drift `drizzle/` vs `supabase/migrations/` | Deletar drizzle/ entirely? Sincronizar? Ou pinar drizzle como dev-only? Afeta DEP-AUD-02 + SYSTEMIC #0 do audit. | ✓ |
| Onde rodar `supabase db reset` | Supabase local via Docker ou projeto hostado throwaway? | ✓ |
| Cold-start: possível na Phase 33? | Aceitar local-smoke agora e validação real na Phase 38? Ou subir preview Vercel já? | ✓ |
| Artefatos e failing-gate handling | Que formato pra evidências? E se alguma check falhar, fix inline ou decimal phase? | ✓ |

**All four areas were selected for discussion.**

---

## Area 1: Drift `drizzle/` vs `supabase/migrations/`

### Initial question: "Como resolver o drift do drizzle/ em prod?"

| Option | Description | Selected |
|--------|-------------|----------|
| Pinar drizzle dev-only + remover órfão (Recomendado) | Mantém drizzle/ só para type-gen em dev, remove `drizzle/0002_showcase_cards.sql`, documenta em ADR que `supabase db push` é o único caminho para prod. drizzle-kit push bloqueado via script. | |
| Deletar drizzle/ inteiro | Remove toda a pasta drizzle/. Supabase migrations vira fonte única absoluta. Perde autoria de schema via TypeScript — toda alteração de schema vira SQL na mão. | |
| Sincronizar drizzle/ com supabase/migrations/ | Regenerar drizzle/ para refletir exatamente o estado atual das 28 migrations. Muito trabalho, pouco ganho. | |

**User's first response:** "oq é isso?" — indicated confusion with jargon. Claude reformulated with simpler explanation (what migrations are, why the dual-track is a problem, what each option means in plain terms, effort estimate per option).

### Follow-up question: "Faz sentido agora? Qual prefere?"

| Option | Description | Selected |
|--------|-------------|----------|
| Pinar dev-only (Recomendado) | Mantenho drizzle/ só pra desenho de schema em dev, bloqueio em prod, removo órfão. Melhor custo/benefício. | |
| Deletar drizzle/ | Mata a pasta de vez. Mais seguro e mais trabalho manual depois. | |
| Não sei, decide você | Claude escolhe o caminho recomendado (opção 1) e documenta o motivo. | ✓ |

**User's choice:** Delegated the decision to Claude. Claude picked **"Pinar dev-only"** — captured as D-01 through D-05 in CONTEXT.md.
**Notes:** User signaled they are new to deploy and prefer Claude pick safe defaults on low-level infra choices.

---

## Area 2: Onde rodar `supabase db reset`

| Option | Description | Selected |
|--------|-------------|----------|
| Supabase Cloud throwaway (Recomendado) | Cria projeto descartável grátis no Supabase Cloud, roda reset, confere, deleta. Mais confiança pra primeira deploy de prod. ~5min de setup. | |
| Supabase local (Docker) | Roda localmente via Supabase CLI + Docker. Mais rápido, mas cobre 95% do que prod faz (não 100%). | |
| Ambos | Roda nas duas. Máximo de confiança, ~10min a mais. | ✓ |

**User's choice:** Ambos — captured as D-06, D-07 in CONTEXT.md.
**Notes:** User is prioritizing confidence on first deploy. The extra ~10min runtime is worth the belt-and-suspenders coverage.

---

## Area 3: Cold-start verification

| Option | Description | Selected |
|--------|-------------|----------|
| Prova local agora, validação real na Phase 38 (Recomendado) | Phase 33 confirma que o código não quebra. Phase 38 faz o teste real com Vercel cold-start (já previsto no DEP-UAT-03). Respeita a ordem das phases. | ✓ |
| Subir preview Vercel já agora | Antecipa parte da Phase 35 pra conseguir testar cold-start real. Mais confiança antecipada, mas viola a sequência e pode criar retrabalho. | |

**User's choice:** Prova local agora — captured as D-08, D-09, D-10 in CONTEXT.md.
**Notes:** Cold-start is inherently a Vercel serverless behavior. Phase 33 proves the code path; Phase 38 proves the infrastructure behavior. Split cleanly honors the milestone's sequential design.

---

## Area 4: Artefatos e failing-gate handling

### Question A: "Formato de evidência dos 8 checks?"

| Option | Description | Selected |
|--------|-------------|----------|
| AUDIT-REPORT.md comitado (Recomendado) | Um markdown com checkbox + evidência por check. Commitado no git, paper trail pra compliance. ~30min pra escrever no final. | ✓ |
| Só CONTEXT.md + commit messages | Sem artefato dedicado. Resultados ficam no CONTEXT.md e nos commits. Mais leve, menos rastreável. | |

**User's choice:** AUDIT-REPORT.md — captured as D-11 through D-15 in CONTEXT.md.

### Question B: "Se um check falhar, fix inline ou decimal phase?"

| Option | Description | Selected |
|--------|-------------|----------|
| Fix inline na 33 (Recomendado) | Se falhar, a phase cresce um pouquinho pra incluir o fix. Mais simples pra solo dev, sem bagunça de numeração. Só abre decimal se o fix for grande (>2h de trabalho). | ✓ |
| Sempre decimal phase 33.x | Qualquer fail abre phase separada. Melhor pra audit trail, mas mais cerimônia. | |

**User's choice:** Fix inline — captured as D-16, D-17 in CONTEXT.md.

---

## Claude's Discretion

Delegated by user explicitly:
- **Drift resolution approach** (Area 1) — user picked "não sei, decide você"; Claude chose the dev-only-pin with orphan removal + ADR.

Claude discretion noted in CONTEXT.md:
- Shell command syntax for reset tests, builds, curl payloads
- AUDIT-REPORT.md section formatting
- ADR-003 wording
- `package.json` drizzle-kit block implementation details
- CSP verification exact steps (memory says it's fixed; Phase 33 re-confirms)

---

## Deferred Ideas

Captured in CONTEXT.md `<deferred>`:
- Wire gitleaks into CI as a recurring job (post-v1.4 chore)
- Automated env inventory drift detection (post-launch)
- `supabase db reset` in CI (requires budget for CI-scoped throwaway project)
- ADR for `NEXT_PUBLIC_` prefix hygiene (post-v1.4 chore)

No scope creep occurred during discussion — all raised ideas were cleanly pushed to deferred section.
