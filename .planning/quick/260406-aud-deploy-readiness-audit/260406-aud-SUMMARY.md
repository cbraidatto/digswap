# Deploy Readiness Audit Handoff

**Date:** 2026-04-06

## Status

O checkout atual **nao esta pronto para deploy**.

Os principais problemas nao estao concentrados em uma area so. Hoje existe combinacao de:

- blocker de build
- drift real de schema/migration
- fluxo funcional quebrado em convites
- revogacao de sessao sem garantia suficiente
- gate E2E instavel e incompleto
- bootstrap limpo sem caminho reproduzivel

## O que ja foi validado

### Comandos com problema

- `pnpm --filter @digswap/web typecheck` -> falha
- `pnpm --filter @digswap/web build` -> falha
- `pnpm --filter @digswap/web lint` -> falha com alto volume de erros e warnings
- `pnpm --filter @digswap/web test` -> falha em `tests/unit/gems/gem-badge.test.tsx`
- `pnpm --filter @digswap/web test:e2e` -> falha antes de rodar os testes por conflito na porta `3000`

### Comandos que passaram

- `pnpm audit --prod --audit-level high` -> sem vulnerabilidades conhecidas
- `pnpm --filter @digswap/web exec vitest run tests/security tests/integration/security/headers.test.ts` -> 179 testes passaram
- `pnpm --filter @digswap/web exec vitest run tests/integration/auth tests/integration/discogs tests/unit/desktop/handoff-token.test.ts tests/unit/lib/rate-limit.test.ts` -> 38 testes passaram, 4 skip
- `pnpm --filter @digswap/web exec vitest run tests/unit/community/visibility.test.ts` -> 6 testes passaram

### Observacoes de confianca

- O worktree esta muito sujo: `185` entradas (`46` modificadas e `139` nao rastreadas).
- Mesmo assim, os arquivos que sustentam os findings mais graves aparecem limpos no `git status --short -- <arquivos criticos>`.
- Existe um workflow local em `.github/workflows/ci.yml`, mas ele esta **nao rastreado** no momento, entao ainda nao vale como gate de baseline.

## Ordem sugerida de correcao

1. Fechar blockers de build e cold start publico
2. Reconciliar schema, migrations e bootstrap de banco
3. Corrigir fluxos criticos de convite e sessao
4. Tornar validacao de ambiente e rate limiting previsiveis
5. Corrigir lacunas de integridade e segredos em repouso
6. Reforcar E2E, CI e documentacao de setup

## Itens para corrigir

### P0 - Build blocker em `gems/queries.ts`

**Problema**

`typecheck` e `build` quebram em casts manuais de `db.execute()` em:

- `apps/web/src/lib/gems/queries.ts:44`
- `apps/web/src/lib/gems/queries.ts:78`

**Impacto**

- deploy de producao bloqueado
- qualquer gate de CI serio deve falhar aqui

**O que corrigir**

- tipar corretamente o retorno de `db.execute()` ou reescrever a consulta para um formato que o TypeScript aceite sem cast inseguro
- validar se o parse de `count` e `gem_score` continua correto depois da mudanca

**Done when**

- `pnpm --filter @digswap/web typecheck` passa
- `pnpm --filter @digswap/web build` passa dessa etapa sem erro de tipos

### P0 - Drift entre `drizzle/`, `supabase/migrations/` e schema

**Problema**

Ha inconsistencias reais no estado do banco:

- `drizzle/meta/_journal.json` registra `0002_aberrant_pyro`
- `drizzle/0002_showcase_cards.sql` existe fora do journal e repete colunas ja criadas
- `supabase/migrations/20260405_fix_all_rls_null_policies.sql` usa `invited_by` e `invitee_id`
- `apps/web/src/lib/db/schema/group-invites.ts` modela `created_by` e documenta ausencia de `invitee_id`

**Impacto**

- ambiente novo pode falhar ao aplicar migrations
- banco pode divergir silenciosamente entre dev, staging e producao
- `drizzle-kit check` nao pega isso porque ele nao valida o trilho `supabase/migrations/`

**O que corrigir**

- escolher uma fonte de verdade clara para schema de producao
- eliminar migration duplicada ou atualizar journal de forma consistente
- alinhar `group_invites` entre Drizzle schema, SQL migrations e politicas RLS
- rodar bootstrap em banco limpo depois da reconciliacao

**Done when**

- um banco vazio sobe do zero sem drift manual
- `group_invites` tem o mesmo shape em schema e SQL
- existe documentacao clara de qual trilho gera/provisiona producao

### P0 - Cold start e rotas publicas nao estao confiaveis

**Problema**

Durante a auditoria:

- o servidor existente em `3000` retornou `500` para `/`, `/signup`, `/signin` e `/pricing`
- um servidor isolado em `3100` abriu a porta, mas nao respondeu a essas rotas por mais de 60 segundos

Ha acoplamento forte de auth/session em rotas que deveriam sobreviver a degradacao:

- middleware chama `supabase.auth.getUser()` em `apps/web/src/lib/supabase/middleware.ts`
- pricing publica tambem chama `getUser()` em `apps/web/src/app/pricing/page.tsx`

**Impacto**

- smoke de deploy pode falhar em rotas publicas
- Playwright nao consegue servir como gate
- usuario anonimo pode sofrer erro ou timeout por dependencia de auth/session

**O que corrigir**

- identificar a causa do `500`/timeout em cold start
- reduzir dependencia obrigatoria de Supabase em rotas publicas quando possivel
- garantir que falha transiente de sessao nao derruba paginas publicas

**Done when**

- em ambiente limpo, `/`, `/signup`, `/signin` e `/pricing` respondem `200`
- o app sobe sem timeout prolongado nessas rotas
- existe smoke test automatizado para isso

### P0 - Gate Playwright/E2E nao e confiavel ainda

**Problema**

- `apps/web/playwright.config.ts` fixa `localhost:3000`
- `test:e2e` caiu por `EADDRINUSE`
- a cobertura atual tem `24` casos declarados, sendo `15` ativos, `4` skip e `5` fixme

Lacunas mais importantes:

- sessao persistente apos reload -> `skip`
- pagina de sessoes -> `skip`
- terminar sessao via UI -> `skip`
- shell autenticado inteiro -> `fixme`
- nao ha E2E para convite por token, desktop handoff, trades, Discogs import ou checkout

**Impacto**

- o gate E2E nao protege os fluxos que mais importam para deploy
- bugs de integracao podem passar com facilidade

**O que corrigir**

- tornar a config robusta para porta ocupada e/ou usar porta isolada por teste
- criar fixture autenticada (`storageState`) e remover `skip/fixme` dos fluxos criticos
- adicionar smoke de convite por token, sessoes, trades e pricing

**Done when**

- `pnpm --filter @digswap/web test:e2e` executa de forma previsivel
- nao existe `skip`/`fixme` em fluxos criticos de auth/session/navigation
- ao menos 1 fluxo feliz e 1 fluxo de falha por area critica estao cobertos

### P1 - Convite privado quebra na entrega e no consumo

**Problema**

O fluxo atual de convite esta incoerente:

- notificacao grava link para `/comunidade/${group.slug}` em `apps/web/src/actions/community.ts`
- a aceitacao real depende do token em `/join/[token]` em `apps/web/src/app/(protected)/(community)/join/[token]/page.tsx`
- essa pagina ainda redireciona anonimo para `/login`, mas o app usa `/signin`

**Impacto**

- usuario convidado pode receber notificacao inutil
- convite privado nao leva ao fluxo certo
- anomalo pode ser mandado para rota inexistente

**O que corrigir**

- inserir na notificacao um link que preserve o token real de convite
- alinhar o redirect de anonimo para a rota certa de auth
- validar se ha deduplicacao correta de notificacoes para esse fluxo

**Done when**

- convite privado chega com URL consumivel
- usuario anonimo cai em auth valida e retorna ao fluxo
- existe teste unitario/integracao cobrindo o `link` gerado
- existe E2E cobrindo abrir notificacao e aceitar convite

### P1 - Revogacao de sessao precisa ser comprovadamente correta

**Problema**

`apps/web/src/actions/sessions.ts` passa `session.sessionId` para `admin.auth.admin.signOut(...)`, mas os tipos do SDK indicam que o metodo espera um JWT valido, nao um session id.

Ao mesmo tempo, o consume do desktop handoff aceita bearer token e valida com `admin.auth.getUser(accessToken)` em `apps/web/src/app/api/desktop/handoff/consume/route.ts`.

**Impacto**

- "encerrar sessao" pode nao revogar de verdade o token
- endpoints que aceitam bearer podem continuar funcionando ate expiracao

**O que corrigir**

- confirmar o caminho suportado pelo SDK para revogacao por sessao
- se necessario, trocar a estrategia de revogacao
- validar toda a cadeia: middleware, user_sessions, desktop consume e UI de sessoes

**Done when**

- sessao encerrada deixa de acessar rotas protegidas
- token anterior falha nos endpoints bearer relevantes
- existem testes integrados reais para terminacao propria e tentativa de IDOR
- existe E2E da pagina de sessoes

### P1 - Validacao de ambiente e rate limiting ainda estao perigosos operacionalmente

**Problema**

- `apps/web/src/lib/rate-limit.ts` entra em fail-closed em fluxos criticos quando Redis nao existe
- `apps/web/src/lib/env.ts` trata `UPSTASH_REDIS_*` como opcional
- a validacao central de env nao esta plugada de forma consistente no app

**Impacto**

- app pode "subir" e quebrar login/cadastro/callback em runtime
- problema aparece tarde, em vez de falhar cedo no boot

**O que corrigir**

- decidir se Redis e obrigatorio em producao ou se ha degradacao segura
- plugar a validacao de env no startup/server path de forma central
- alinhar os fluxos que usam `failClosed=true` com essa decisao

**Done when**

- deploy invalido falha no boot, nao no primeiro usuario
- comportamento sem Redis e explicito e testado
- docs de env refletem a realidade de producao

### P1 - Integridade de dados em trades e social esta fraca

**Problema**

- `createTradeRequestAction` aceita UUID arbitrario como `providerId`
- a modelagem em `apps/web/src/lib/db/schema/trades.ts` nao mostra FK explicita para usuario nesses campos
- follows repetem o mesmo padrao em `apps/web/src/actions/social.ts` e `apps/web/src/lib/db/schema/social.ts`
- a cota de trade e consumida antes do insert terminar

**Impacto**

- risco de linhas orfas
- abuso por chamada server-side maliciosa ou malformada
- usuario pode perder cota sem trade criado

**O que corrigir**

- validar existencia do alvo antes do insert
- adicionar FKs/constraints quando a modelagem permitir
- mover decremento/consumo de quota para depois do sucesso, ou tornar atomico

**Done when**

- nao e possivel criar follow/trade request para UUID inexistente
- falha de insert nao consome cota
- testes cobrem caminho feliz e caminho de alvo inexistente

### P1 - Tokens Discogs ainda podem ficar em texto puro

**Problema**

No fallback sem Vault, `apps/web/src/lib/discogs/oauth.ts` grava `access_token` e `access_token_secret` diretamente em `discogs_tokens`.

**Impacto**

- gap de segredo em repouso
- RLS ajuda, mas nao resolve exposicao em caso de acesso administrativo ou comprometimento do banco

**O que corrigir**

- preferir armazenamento protegido de verdade
- se o fallback continuar, documentar o risco e aplicar criptografia no app ou em recurso seguro equivalente

**Done when**

- tokens nao ficam legiveis em texto puro no caminho de producao
- a estrategia de fallback esta documentada e testada

### P2 - Suite principal ainda nao esta verde

**Problema**

- `apps/web/tests/unit/gems/gem-badge.test.tsx` falha porque o componente atual usa glifos Unicode em vez do shape esperado pelos testes
- `lint` continua muito ruidoso

**Impacto**

- o baseline de qualidade continua vermelho
- dificulta isolar regressao real de ruido

**O que corrigir**

- alinhar `GemBadge` e seus testes
- reduzir o backlog de lint, priorizando erros reais antes de formatacao

**Done when**

- `pnpm --filter @digswap/web test` passa
- `pnpm --filter @digswap/web lint` fica usavel como gate

### P2 - Bootstrap e setup local/produtivo precisam existir de forma versionada

**Problema**

- `README.md` ainda e generico e nao ensina a subir DigSwap
- `.env.example` manda olhar o README, mas ele nao cobre setup real
- seeds existem, mas nao estao acoplados a um fluxo claro
- nao ha `supabase/config.toml` no repo

**Impacto**

- onboarding lento
- alto risco de ambiente "quase igual" em vez de reproduzivel

**O que corrigir**

- documentar setup real: Supabase, Drizzle, Upstash, Stripe, Discogs, seeds e smoke checks
- decidir se seeds entram em script ou etapa manual explicita
- documentar ordem correta de provisionamento

**Done when**

- uma pessoa nova sobe o projeto seguindo apenas docs versionadas
- existe checklist de pre-deploy e bootstrap limpo

### P2 - Artefatos locais precisam ser contidos

**Problema**

Ha muitos arquivos nao rastreados de screenshot, Playwright MCP e auditoria visual no root.

**Impacto**

- ruido alto no worktree
- revisao e diffs ficam piores

**O que corrigir**

- limpar artefatos temporarios
- mover para pasta apropriada ou ajustar `.gitignore` se fizer sentido

**Done when**

- `git status` volta a ser legivel
- artefato temporario nao polui o root

## Gaps de cobertura que ainda precisam existir como testes reais

### Auth e sessao

- terminar sessao propria com revogacao efetiva
- bloquear tentativa de encerrar sessao de outro usuario
- persistencia de sessao apos reload
- cold start anonimo em rotas publicas

### Comunidade

- notificacao de convite contem link/token correto
- usuario anonimo entra no fluxo correto de auth antes de aceitar
- aceitar convite pela UI ate virar membro

### Billing/Pricing

- pricing publica nao quebra sem sessao
- CTA anonimo segue correta
- smoke autenticado para plano atual

### Deploy/Infra

- bootstrap de banco do zero
- seed de grupos e badges
- smoke de build + start + requests publicas

## Checklist minima para chamar de deployavel

- `typecheck`, `build`, `test`, `lint` verdes no web
- banco novo sobe sem drift manual
- rotas publicas basicas respondem `200` em cold start
- Playwright roda sem conflito de porta
- auth/session/convite possuem cobertura real, nao apenas stub
- env obrigatorio falha cedo
- caminho de sessao revogada e comprovado

## Nota final para quem for executar os fixes

Os findings acima foram montados para evitar conflito com trabalho paralelo. O relatorio foi escrito sem editar arquivos do app.

Como o Claude ja esta mexendo no codigo, a melhor estrategia e atacar em camadas:

1. fechar build
2. fechar banco/bootstrap
3. fechar fluxos criticos
4. fortalecer testes/gates

Se algum item ja tiver sido corrigido por ele, revalidar o comando correspondente antes de marcar como resolvido.
