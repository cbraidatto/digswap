# DigSwap — Proposta de Produto

## O que é

DigSwap é uma rede social para colecionadores de vinil ("diggers") — pessoas que caçam discos ativamente. O problema central que resolve: **um digger abre o app e descobre imediatamente quem tem o disco que ele está procurando**, e consegue trocar um rip de áudio com essa pessoa.

Hoje isso não existe. O Discogs é transacional (compra e venda) e não tem camada social. Não há nenhuma plataforma onde colecionadores conectam suas bibliotecas, comparam coleções e trocam rips entre si.

---

## Arquitetura — dois produtos

### Web App (descoberta)

Hospedado na web, acessível pelo browser. Foco em descoberta e comunidade.

**Features:**
- Importar coleção via Discogs (OAuth)
- Buscar quem tem determinado disco/artista/label
- Wantlist — lista de discos que você procura, com alertas quando alguém com aquele disco aparece
- Perfis públicos de colecionadores
- Rankings de raridade de coleção e contribuição para a comunidade
- Feed social — atividade da comunidade
- Reviews de trades realizados

**Sem trade.** Nenhum arquivo de áudio passa pelo web app.

### Desktop App (troca)

App Electron distribuído diretamente pelo site (sem App Store, sem Google Play). Carrega o web app dentro do Electron e adiciona a camada de trade P2P por cima.

**Por que desktop e não web:**
- Trade de rips de vinil tem risco legal (copyright)
- P2P puro no browser exige os dois usuários online simultaneamente — experiência ruim
- App desktop roda em background (igual Soulseek), criando uma fila automática
- Distribuição fora de stores = perfil legal muito mais baixo
- Modelo validado: Soulseek existe desde 2000 com a mesma arquitetura e nunca foi derrubado

**Como funciona o trade:**
1. Usuário A descobre no web app que Usuário B tem o disco que procura
2. A manda proposta pelo web app — declara o que está oferecendo, qualidade, bitrate, formato
3. B recebe notificação, avalia a proposta e aceita
4. Ambos abrem o desktop app e sobem seus arquivos
5. O app gera um preview de ~60s de cada arquivo automaticamente
6. Cada um ouve o preview do outro e pode aceitar ou rejeitar (assíncrono — cada um faz na sua hora enquanto o app estiver aberto)
7. Quando os dois aceitam, a transferência completa acontece P2P automaticamente
8. Nenhum arquivo passa pelo servidor — transferência direta entre os dois computadores

---

## Modelo de negócio

### Free
- Importar até 500 discos da coleção
- Busca básica
- Wantlist (limitada)
- Limite de matches por mês
- Desktop app com trade incluso
- Pode **ver** rankings e leaderboard mas não aparece neles e não ganha pontos

### Premium (assinatura mensal)
- Coleção ilimitada
- Alertas automáticos de wantlist em tempo real
- Busca avançada (filtrar por qualidade declarada, bitrate, usuário ativo recentemente)
- Histórico completo de trades
- Matches ilimitados
- **Gamificação completa** — ganha pontos, acumula badges, aparece no ranking, histórico de contribuição visível

**Lógica de monetização:** o valor do produto está na **descoberta** (saber quem tem o que você procura), não na transferência. A transferência é gratuita para não criar barreiras de adoção. Cobra-se por descoberta avançada e por status social dentro da comunidade.

---

## Gamificação

Sistema de ranking que mede dois eixos:

**Raridade de coleção** — pontuação baseada em quão raros são os discos que você tem (baseado em dados do Discogs: tiragem, país, ano, demanda na comunidade).

**Contribuição** — pontuação por participação ativa: trades completados, reviews deixados, ajudar outros a encontrar discos.

**Mecânica premium (Opção B):**
- Free users veem o leaderboard e os perfis rankeados de outros — criam FOMO
- Só premium users ganham pontos, acumulam badges e aparecem no ranking
- Isso usa o sistema de gamificação como motor de conversão para o plano pago

---

## Stack técnico

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 15 + React 18 + Tailwind CSS v4 |
| Backend | Supabase (PostgreSQL + Auth + Realtime) |
| ORM | Drizzle |
| P2P | PeerJS (WebRTC DataChannel) |
| Cache/Rankings | Upstash Redis |
| Pagamentos | Stripe |
| Email | Resend |
| Desktop | Electron (a implementar) |
| Deploy | Vercel (web) + distribuição direta (desktop) |

---

## Estado atual

O web app está ~97% completo nas fases planejadas (12 fases). O sistema de trade foi construído para web mas será migrado para desktop. As fases restantes incluem monetização (Stripe freemium), hardening de segurança e o desktop app.

---

## Questões abertas — onde buscamos contribuição

1. **Electron vs Tauri** — Electron reaproveitaria todo o código existente mais facilmente. Tauri seria mais leve mas exige Rust no backend. Para um dev solo, qual a melhor escolha considerando manutenabilidade de longo prazo?

2. **Estratégia de fila no desktop** — Como estruturar a fila de transferência P2P no Electron? O arquivo fica disponível enquanto o app está aberto. Como lidar com estado persistente entre sessões (arquivo parcialmente transferido, etc.)?

3. **Gate de gamificação** — A melhor forma de implementar o gate premium para gamificação. Verificar no servidor a cada request, ou usar JWT claims para evitar round-trips?

4. **Onboarding do desktop** — Como fazer o usuário web entender que precisa baixar o desktop app para fazer trades? Qual o fluxo de conversão mais natural: mostrar o trade como feature bloqueada no web app com CTA para download, ou não mencionar até o usuário procurar ativamente?

5. **Precificação** — Qual faixa de preço faz sentido para uma comunidade de nicho como colecionadores de vinil? Referência: Discogs cobra $3.99–$9.99/mês para sellers. RateYourMusic (comunidade de música) tem plano de $3/mês.
