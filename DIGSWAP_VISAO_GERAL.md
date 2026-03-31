# DigSwap — Visão Geral do Produto

**Versão:** 1.0 — Março 2026
**Para:** Uso interno / apresentação ao sócio

---

## O que é o DigSwap

DigSwap é a plataforma para colecionadores sérios de vinil encontrarem quem tem o disco que estão caçando.

O digger abre o app, conecta sua conta do Discogs, e em segundos sabe quais pessoas na rede têm discos da sua wantlist — com nome, perfil, raridade do disco, e histórico de reputação da pessoa. A partir daí, pode acompanhar o lead, entrar em contato, ou iniciar uma troca de áudio diretamente no browser.

**Proposta de valor em uma frase:**
> *"Stop waiting for your Holy Grails to go on sale. Find the diggers who actually have them."*

---

## O problema que resolve

Todo colecionador de vinil sério tem uma wantlist no Discogs. O problema é que o Discogs foi feito para comprar e vender — não para encontrar quem tem o disco e trocar experiências ou áudio.

O digger hoje usa:
- **Discogs** para catalogar e achar preços
- **Instagram** para mostrar achados
- **WhatsApp / Discord** para contato direto com outros colecionadores
- **Soulseek / círculos privados** para material mais difícil

DigSwap junta esses fluxos em um lugar: você encontra a pessoa, vê a coleção dela, avalia a confiança, e age — tudo dentro da plataforma.

---

## O Loop Central

```
1. IMPORTAR
   Conecta Discogs → importa coleção e wantlist automaticamente

2. DESCOBRIR
   O Radar cruza sua wantlist com as coleções de todos os outros usuários
   → "Hekkell tem 3 discos da sua wantlist"

3. AVALIAR
   Visita o perfil do Hekkell
   → vê a coleção, score de raridade dos discos, histórico de trades, trust rating

4. AGIR
   Adiciona como lead, anota contexto ("tem o Blue Note original, parece confiável")
   → inicia contato ou pedido de trade de áudio

5. TROCAR
   Trade de áudio acontece browser-to-browser via WebRTC
   → nenhum arquivo passa pelo servidor

6. REPUTAÇÃO
   Após a troca, ambos avaliam a qualidade
   → reputação do usuário sobe na plataforma

7. RANQUEAR
   Score de raridade da coleção + contribuição comunitária = ranking global
   → "Você está no top 12% de obscuridade da rede"
```

---

## Features Implementadas (v1 completo)

### Conta e Segurança
- Cadastro com email/senha ou Google/GitHub
- Login persistente com sessão segura
- Recuperação de senha por email
- Autenticação em dois fatores (TOTP — Google Authenticator, etc.)
- Backup codes para recuperação de 2FA
- Todos os endpoints protegidos contra injeção, IDOR, rate limiting, CSP nonce (OWASP Top 10 coberto)

---

### Discogs Integration
- Conexão via OAuth 1.0a com a conta Discogs do usuário
- Import assíncrono da coleção completa (coleções com 5.000+ discos levam ~80 minutos; o usuário vê progresso em tempo real)
- Import da wantlist separado da coleção
- Sync manual para puxar novos discos adicionados no Discogs
- Desconectar Discogs remove todos os dados importados

---

### Coleção
- Perfil público mostrando a coleção completa
- **Score de raridade** calculado automaticamente pela razão have/want do Discogs (quanto mais pessoas querem e menos têm, mais raro)
- Adicionar discos manualmente (sem precisar do Discogs)
- Filtros por gênero, década, país, formato (LP, 7", EP, etc.)
- Ordenação por raridade, data de adição, título
- Registrar condição física do disco (Mint, VG+, VG, G+, G, F, P)

---

### O Radar (feature central)
- Cruza sua wantlist com as coleções de todos os usuários da rede em tempo real
- Aparece na home como seção principal (`SIGNAL_BOARD`)
- Cada match mostra: quem tem o disco, score de raridade do disco específico, nível de confiança da pessoa
- Filtros por raridade (ultra-raro, raro, comum)
- Rota dedicada `/radar` para explorar matches com mais detalhe

---

### Perfil Público e Identidade
- Perfil público acessível sem login (`/perfil/[username]`)
- SEO-indexável — aparece em buscas do Google
- Seção `RADAR_MATCH`: quando você visita o perfil de alguém e tem intersecções com sua wantlist, aparece uma seção no topo mostrando quais discos da sua lista estão na coleção deles
- Toggle `[SHOW_ONLY_MATCHES]` filtra a coleção para mostrar só os discos que te interessam
- TrustStrip: 4 métricas visíveis no perfil (taxa de resposta, taxa de conclusão de trades, nota média de qualidade, total de trades)
- Badges visíveis no perfil (milestones conquistados)
- Título baseado em rank (ex: "Crate Digger", "Wax Prophet", "Record Archaeologist")
- Rarity Score Card: imagem gerada para compartilhar no Instagram/Stories — "Sua coleção é mais obscura que 94% da rede"

---

### Digger Memory (ferramenta de trabalho)
- Salvar qualquer usuário, disco ou match como "lead"
- Status do lead: `watching` / `contacted` / `dead_end` / `found`
- Notas privadas por lead ("tem o pressing original, respondeu rápido")
- Disponível em todos os cards do Radar

---

### Bounty Link
- URL pública por usuário: `/u/[username]/bounty`
- Mostra até 3 "Holy Grails" do colecionador (discos que ele mais quer)
- Qualquer visitante não-logado vê e pode criar conta para ajudar
- CTA de conversão para novos usuários

---

### Explorar / Descoberta
- Busca por nome de disco ou artista → mostra quais usuários da plataforma têm na coleção
- Navegar coleções por gênero e década
- Cada resultado mostra o dono com link direto para o perfil (`VIEW_PROFILE →`)

---

### Social
- Seguir e deixar de seguir outros diggers
- Feed de atividade dos usuários que você segue (novos discos adicionados, trades concluídos, reviews)
- Comparar coleção com outro usuário — vê overlap e discos únicos de cada lado

---

### Comunidade e Reviews
- Criar grupos por gênero, era, região ou estilo (ex: "Jazz Brasileiro", "UK Punk 77")
- Entrar e sair de grupos
- Postar texto dentro dos grupos
- Feed de atividade do grupo
- Escrever review de uma prensagem específica (pressing) ou da release geral
- Notas de 1-5 + texto
- Ver todas as reviews de uma prensagem

---

### Notificações
- In-app: match na wantlist, pedido de trade, trade concluído, movimento no ranking, novo badge
- Email: match na wantlist, pedido de trade
- Configurável pelo usuário (quais tipos receber)

---

### Gamificação e Rankings
- **Score global:** combinação de raridade da coleção + contribuição comunitária (trades, reviews, atividade em grupos)
- **Leaderboard global** — ranking de todos os usuários
- **Leaderboards por gênero** (Jazz, Soul, Hip-Hop, etc.)
- **Badges** por milestones: primeiro import, 100 discos, primeiro trade, primeira review, etc.
- **Títulos** no perfil baseados em tier de ranking

---

### P2P Audio Trading
- Iniciar pedido de trade para um disco específico de outro usuário
- Transferência acontece **diretamente browser-to-browser via WebRTC DataChannel** — nenhum arquivo passa pelo servidor (requisito legal não-negociável)
- Transfer em chunks com barra de progresso
- Ambos os usuários precisam estar online simultaneamente
- Após o trade, o receptor avalia a qualidade do áudio (1-5 + comentário)
- Reputação do enviador atualizada com base nas avaliações
- Reputação visível no perfil público (TrustStrip)
- DMCA agent registrado + ToS que coloca responsabilidade de copyright no usuário
- TURN relay configurado para não expor IP do usuário durante transferências

---

## Modelo de Monetização (planejado, não implementado ainda)

| Plano | O que inclui |
|-------|-------------|
| **Free** | Até 5 trades de áudio por mês, todas as features de descoberta e social |
| **Premium** | Trades ilimitados, analytics de coleção (valor estimado, histórico de raridade), grupos premium exclusivos, prioridade no matching de wantlist |

Pagamento via Stripe (mensal ou anual).

---

## Viral Funnel

```
Rarity Score Card  →  chama atenção    (vaidade + identidade)
                       "Minha coleção é mais obscura que 94% da rede"
                       → compartilha no Instagram

The Radar Receipt  →  vende a utilidade  (momento mágico)
                       "DigSwap encontrou 3 pessoas com discos da minha wantlist"
                       → link vai para o perfil público do usuário

Bounty Link        →  converte ação    (utilidade bidirecional)
                       "Esses são os discos que estou caçando"
                       → visitante não-logado vê e cria conta
```

---

## O que está fora do escopo (e por quê)

| Feature | Por quê não |
|---------|-------------|
| Marketplace de compra/venda | O Discogs já domina isso — não tem sentido competir com a fonte de dados |
| Streaming de música | Licenciamento e custo inviáveis |
| Armazenamento de áudio no servidor | Requisito legal não-negociável — P2P puro |
| App nativo (iOS/Android) | Web primeiro; mobile nativo é v2 |
| Multi-idioma | Lançamento global em inglês primeiro |

---

## Stack Técnico (resumo)

| Camada | Tecnologia |
|--------|-----------|
| Frontend + Backend | Next.js 15 (React 18, TypeScript) |
| Banco de dados | PostgreSQL via Supabase (com Row Level Security) |
| Auth | Supabase Auth (OAuth, 2FA, sessões) |
| ORM | Drizzle ORM |
| Cache + Rate Limiting | Upstash Redis |
| P2P | WebRTC via PeerJS |
| Email | Resend |
| Pagamentos | Stripe (planejado) |
| Hosting | Vercel |
| Design | Ghost Protocol (identidade visual retro/analógica, verde terminal, tipografia mono) |

---

## Status Atual

| Fase | Status |
|------|--------|
| Fundação + Auth | ✅ Completo |
| UI Shell + Navegação | ✅ Completo |
| Integração Discogs | ✅ Completo |
| Gerenciamento de Coleção | ✅ Completo |
| Layer Social (follows, feed, comparação) | ✅ Completo |
| Discovery + Notificações | ✅ Completo |
| Comunidade + Reviews | ✅ Completo |
| Gamificação + Rankings | ✅ Completo (planejado) |
| P2P Audio Trading | ✅ Completo (planejado) |
| Posicionamento + Radar + Workspace | ✅ Completo |
| Security Hardening (OWASP, pen test) | ✅ Completo |
| **Monetização (Stripe + planos)** | 🔲 Pendente |

---

*Documento interno — DigSwap, Março 2026*
