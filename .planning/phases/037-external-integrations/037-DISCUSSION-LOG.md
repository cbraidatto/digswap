# Phase 37: External Integrations - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 037-external-integrations
**Areas discussed:** Stripe Live activation, OAuth providers + Discogs prod app, Resend + Supabase Auth SMTP, Ordem de execução + paralelismo, Account ops

---

## Stripe Live Activation

### Q: Conta Stripe existente?
| Option | Description | Selected |
|--------|-------------|----------|
| Já tenho conta com sk_test_ funcionando | Mesmo account ID; ativar Live na MESMA conta (Test/Live coexistem) | ✓ |
| Não, preciso criar conta nova | Cria em stripe.com/br, ativa direto em Live | |
| Não sei — você me orienta | Verificar se existe ou começar do zero | |

### Q: Tipo de pessoa/empresa Stripe BR?
| Option | Description | Selected |
|--------|-------------|----------|
| Pessoa Física (CPF) - solo dev | Mais rápido; aceita CPF; limites menores | ✓ |
| Pessoa Jurídica (CNPJ) - tenho ou vou abrir | Mais formal; limites maiores; pode levar 2-30 dias | |
| Sócio entra como PJ | Decisões legais antes do Stripe | |

### Q: Webhook endpoint Live?
| Option | Description | Selected |
|--------|-------------|----------|
| Mesmo path /api/stripe/webhook que test | Single endpoint, env-var separation (whsec_live vs whsec_test) | ✓ |
| Path separado /api/stripe/webhook-live | Mais explícito mas overkill | |

### Q: Validar Live mode antes de Phase 37 close?
| Option | Description | Selected |
|--------|-------------|----------|
| Cobrar $1 real e dar refund | Maior confiança; comprova webhook + price + cartão | |
| Só sk_live_ + price_live_ + webhook ping (sem cobrança) | Menor escopo; transação real defere pra Phase 38 | |
| Você decide — plan-phase propõe | Plano deixa transação real como Phase 38 owns | ✓ |

**User's choice:** Defere transação real pra Phase 38 UAT.

---

## OAuth Providers + Discogs Prod App

### Q: Quais OAuth providers (multiSelect)?
| Option | Description | Selected |
|--------|-------------|----------|
| Google (Recomendado) | Maior cobertura BR; OAuth 2.0 Google Cloud | ✓ |
| GitHub | Comunidade dev/colecionadores técnicos | |
| Email + senha apenas | Defere OAuth POST-MVP | |

**User's choice:** Apenas Google nesta fase. GitHub fica POST-MVP.

### Q: Reusar OAuth dev clients ou criar prod separados?
| Option | Description | Selected |
|--------|-------------|----------|
| Criar prod separados (Recomendado) | Cleanup, audit, billing separados; Pitfall 7 evitado | ✓ |
| Reusar dev clients | Mais rápido mas mistura escopos | |

### Q: Discogs prod app?
| Option | Description | Selected |
|--------|-------------|----------|
| App prod separado (Recomendado) | Rate limit 60 req/min separado dev/prod | ✓ |
| Reusar dev app | Compartilha rate limit; sub-otimo | |

### Q: Supabase Auth allow-list?
| Option | Description | Selected |
|--------|-------------|----------|
| Só prod: digswap.com.br/** (Recomendado) | Sem localhost; protege contra open redirect | ✓ |
| Também localhost:3000 | Permite hibridizar dev/prod testing; risco de leak | |

---

## Resend + Supabase Auth SMTP

### Q: From email Resend?
| Option | Description | Selected |
|--------|-------------|----------|
| noreply@digswap.com.br (Recomendado) | Padrão transacional; placeholder já no env | ✓ |
| hello@ ou support@digswap.com.br | Mais friendly mas requer caixa de entrada | |
| Outro customizado | User-defined | |

### Q: Reply-to?
| Option | Description | Selected |
|--------|-------------|----------|
| Sem reply-to (default = noreply@) | Bounces para void | ✓ |
| Reply-to no Gmail pessoal | User recebe respostas | |
| Reply-to em digswap.com.br novo | Defere caixa de entrada | |

### Q: Aplicar DKIM/SPF/DMARC?
| Option | Description | Selected |
|--------|-------------|----------|
| Claude via Hostinger API (Recomendado) | Reusa Phase 36 token; PUTs com TTL=300 | ✓ |
| Manualmente via UI | User aplica passo-a-passo | |

### Q: Free tier Resend?
| Option | Description | Selected |
|--------|-------------|----------|
| Free 3K emails/mo (Recomendado) | Suficiente pra 500-1K usuários ativos | ✓ |
| Pro $20/mo (50K emails) | Mais espaço POST-MVP | |

---

## Ordem de Execução + Paralelismo

### Q: Estratégia execução com Stripe SLA assíncrono?
| Option | Description | Selected |
|--------|-------------|----------|
| Wave 0 user-action Stripe + waves paralelas + Wave final swap (Recomendado) | Stripe SLA não bloqueia; OAuth/Resend/Discogs em paralelo | ✓ |
| Série estrita | Mais simples mas atrasa | |
| Eu decido caso a caso | Plan estrutura, user revisa | |

### Q: Stripe não aprovado após 3 dias?
| Option | Description | Selected |
|--------|-------------|----------|
| Feature flag NEXT_PUBLIC_BILLING_ENABLED (Recomendado) | UAT pode rodar sem billing live | ✓ |
| Bloquear Phase 38 até Stripe aprovar | Atrasa milestone | |
| Free-tier launch (descartar Stripe) | Phase 35 D-03 já era free-tier; Stripe vira POST-MVP | |

### Q: Phase 38 UAT gating?
| Option | Description | Selected |
|--------|-------------|----------|
| OAuth + Resend + Discogs (Stripe pode estar deferred) | UAT testa core flow; Stripe é nice-to-have | |
| TUDO incluindo Stripe Live | Mais conservador; full flow UAT | ✓ |

**Note:** User escolheu path conservador (TUDO operacional pra UAT). Tensão com D-14 (feature flag): flag existe mas Wave 4 obrigatoriamente conclui antes de Phase 38 começar. Se Stripe SLA passar 3 dias, milestone slips.

### Q: Phase 36 carry-overs (CSP + OAuth silent-fail)?
| Option | Description | Selected |
|--------|-------------|----------|
| Phase 38 UAT (Recomendado) | Já está nas POST-PHASE TODOs | ✓ |
| Phase 37 inclui se trivial | Scope creep; OAuth silent-fail talvez seja só toast | |

---

## Account Ops (extra)

### Q: Quem gerencia contas externas?
| Option | Description | Selected |
|--------|-------------|----------|
| Tudo na minha conta pessoal (Recomendado) | Owner único; rotation simples | ✓ |
| Misturado com sócio | Plan precisa saber qual conta tem qual | |
| Decide caso a caso | Checkpoint a cada credencial | |

---

## Claude's Discretion

- Stripe webhook event subscription list (`checkout.session.completed`, `customer.subscription.updated`, etc.) — research determines
- Stripe BR onboarding form exact fields — user fills real-time during Wave 0
- Resend "From Name" string — research recommends
- DMARC policy strictness — research recommends `p=none` (most common starter), escalate post-30d
- Wave structure exact (provisionally 5 waves)

## Deferred Ideas

### Phase 38 (UAT)
- Real $1 Stripe transaction
- CSP inline-style violation in chunk 1952-*
- OAuth silent-fail UX (toast)
- Provision audit user
- Fix 5 Playwright locator bugs
- Public announce gate

### Phase 39 (Monitoring)
- Sentry prod DSN + beforeSend filter
- UptimeRobot
- Vercel Analytics

### POST-MVP
- GitHub OAuth
- CNPJ Stripe migration
- Stripe Customer Portal
- Reply-to caixa de entrada
- DMARC `p=quarantine` / `p=reject`
- Resend Pro upgrade
- HSTS + TTL bumps
