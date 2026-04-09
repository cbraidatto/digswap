# Quick Task: deploy readiness audit handoff

**Date:** 2026-04-06

## Objective

Consolidar a auditoria de deploy readiness em um arquivo novo, separado do app, para servir como handoff de execucao para os fixes em andamento.

## Scope

- Build, typecheck, test e lint gates
- Drift entre `drizzle/`, `supabase/migrations/` e schema atual
- Fluxos criticos de convite, sessao, rate limiting e tokens Discogs
- Cobertura E2E, cold start e bootstrap limpo
- Riscos operacionais do worktree sujo

## Deliverable

- `.planning/quick/260406-aud-deploy-readiness-audit/260406-aud-SUMMARY.md`

## Constraints

- Nao editar arquivos do app
- Nao interferir no trabalho concorrente do Claude
- Registrar apenas evidencias observadas no checkout atual
