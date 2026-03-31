---
status: investigating
trigger: "trade-preview-state-mismatch - tela de trade entra no preview, mas backend ainda exige estados/timestamps legados"
created: 2026-03-29T16:38:00Z
updated: 2026-03-29T16:38:00Z
---

## Current Focus

hypothesis: CONFIRMED - o cliente já usa o fluxo novo `pending -> accepted -> preview_selection -> previewing -> transferring`, mas as server actions ainda dependem de `lobby`, `terms_accepted_at` e `terms_accepted_by_recipient_at`.
test: reproduzir via leitura de código + testes focados do fluxo de trades
expecting: aceitar preview deve funcionar no fluxo novo e o trade deve avançar para `transferring` quando ambas as partes aceitarem o preview
next_action: alinhar status persistido e regras de aceitação de preview entre UI e backend

## Symptoms

expected: depois que os dois lados trocam previews, a tela entra em preview, aceitar o preview funciona e o trade avança para transferência
actual: a UI avança localmente, mas o backend continua esperando status/timestamps antigos, deixando o fluxo inconsistente
errors: risco de `Trade is not in preview phase` e impossibilidade de atingir `bothAccepted` no fluxo novo
reproduction: criar trade, aceitar request, trocar previews, tentar confirmar preview
started: detectado em 2026-03-29 durante revisão da tela de trade em desenvolvimento

## Evidence

- timestamp: 2026-03-29T16:31:00Z
  checked: `src/actions/trades.ts#createTrade`
  found: criação foi migrada para `status: "pending"` e não preenche mais `terms_accepted_at`
  implication: o fluxo novo já abandonou a fase de lobby/termos na criação

- timestamp: 2026-03-29T16:32:00Z
  checked: `src/app/(protected)/trades/[id]/page.tsx`
  found: provider aceita trade pendente e a rota passa a renderizar o lobby para trades em `accepted`
  implication: `accepted` agora é a porta de entrada do lobby novo

- timestamp: 2026-03-29T16:33:00Z
  checked: `src/app/(protected)/trades/[id]/_components/trade-lobby.tsx`
  found: a UI removeu negotiation/terms, avança localmente para `previewing`, mas não persiste isso no banco
  implication: a tela do usuário e o estado servidor podem divergir

- timestamp: 2026-03-29T16:34:00Z
  checked: `src/actions/trades.ts#acceptPreview`
  found: a action ainda exige `status === previewing` e só libera `bothAccepted` quando timestamps de terms antigos também existem
  implication: o fluxo novo não consegue concluir a transição de preview para transferência de forma confiável

- timestamp: 2026-03-29T16:35:00Z
  checked: `tests/unit/trades/trade-actions-v2.test.ts`
  found: os testes ainda esperam `status: "lobby"` e `terms_accepted_at` na criação
  implication: a suíte está validando o comportamento antigo e não protege o fluxo atual

## Resolution

root_cause: |
  Migração parcial do fluxo de trades. O cliente foi atualizado para o modelo novo sem negociação de termos,
  mas o backend e os testes ainda validam parte do contrato antigo.

fix: |
  1. Persistir a entrada em `previewing` no fluxo novo.
  2. Permitir que `acceptPreview`/`rejectPreview` operem sobre trades `accepted` ou `previewing`.
  3. Remover a dependência de `terms_accepted_at` e `terms_accepted_by_recipient_at` para liberar `transferring`.
  4. Atualizar testes focados para refletir o contrato novo.
