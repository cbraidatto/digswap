# Phase 36: DNS + SSL Cutover - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-27
**Phase:** 036-dns-ssl-cutover
**Areas discussed:** Registrar + acesso DNS, Estratégia de cutover + www, TTL + soak + announcement, Verificação + rollback, Hostinger API (extra)

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Registrar + acesso DNS | Onde está registrado, quem altera, MX existentes | ✓ |
| Estratégia de cutover + www | Ordem das operações, apex/www canonical, Vercel config method, cert failure handling | ✓ |
| TTL + soak + announcement | TTL bump trigger, announce gate, UptimeRobot timing, soak window | ✓ |
| Verificação + rollback | Resolvers, rollback plan, smoke matrix, ACME timeout handling | ✓ |

**User's choice:** ALL 4 selected.

---

## Area 1: Registrar + acesso DNS

### Q1.1: Onde digswap.com.br está registrado?
| Option | Description | Selected |
|--------|-------------|----------|
| Registro.br (oficial pra .com.br) | Painel próprio; sem API pública fácil | |
| Hostinger (reseller .com.br) | API pública via token (ROADMAP) | ✓ |
| Cloudflare (DNS delegado) | API muito boa | |
| Outro / não sei | Discover via WHOIS/dig | |

**User's choice:** Hostinger (reseller .com.br)

### Q1.2: Como Claude vai operar nas alterações de DNS?
| Option | Description | Selected |
|--------|-------------|----------|
| Manual via UI (checkpoint:human-action) | Plan gera passos, usuário aplica | |
| Claude via API/CLI do registrar | Token na sessão | ✓ |
| Misto: usuário altera + Claude verifica | Live coordination | |

**User's choice:** Claude via API/CLI do registrar

### Q1.3: Existe MX/TXT/SPF a preservar?
| Option | Description | Selected |
|--------|-------------|----------|
| Não uso email no domínio ainda | DEP-DNS-07 vira N/A | ✓ |
| Sim, tenho email ativo | Capturar zone via dig ANY antes do flip | |
| Não sei — descobre por dig | Claude valida via dig | |

**User's choice:** Não uso email no domínio ainda

### Q1.4: Subdomain extra além de apex + www?
| Option | Description | Selected |
|--------|-------------|----------|
| Só apex + www (escopo Phase 36) | Outros ficam pra futuro | ✓ |
| Adicionar app./api./status. agora | Cada um precisa de cert ACME próprio | |

**User's choice:** Só apex + www

---

## Area 2: Estratégia de cutover + www

### Q2.1: Ordem de operações no cutover?
| Option | Description | Selected |
|--------|-------------|----------|
| Adicionar domínio no Vercel primeiro, depois flip DNS | Pre-emite cert; zero janela de erro (Recomendado Vercel docs) | ✓ |
| Flip DNS primeiro, Vercel auto-detecta + emite cert | Mais simples mas janela 30s-2min de cert error | |
| Simultâneo (add + flip) | TXT verification ainda atrasa cert | |

**User's choice:** Adicionar domínio no Vercel primeiro, depois flip DNS

### Q2.2: Apex ou www canonical?
| Option | Description | Selected |
|--------|-------------|----------|
| Apex digswap.com.br canonical, www → 308 redirect | Padrão moderno; URL curta (Recomendado) | ✓ |
| www canonical, apex redirect | Padrão legacy | |
| Ambos com cert próprio sem redirect | SEO duplicado | |

**User's choice:** Apex digswap.com.br canonical, www → redirect 308 pra apex

### Q2.3: Como configurar domínio no Vercel?
| Option | Description | Selected |
|--------|-------------|----------|
| Vercel CLI + MCP | Programatic, evidence trail | ✓ |
| Dashboard | Mais simples se CLI/MCP não cobrir | |
| Você decide | Plan-phase descobre via research | |

**User's choice:** Vercel CLI + MCP

### Q2.4: Cert ACME falha — como lidar?
| Option | Description | Selected |
|--------|-------------|----------|
| Pause cutover, root-cause, retomar | Mais conservador | |
| Rollback DNS imediato (TTL=300) | Volta pra *.vercel.app | |
| Você decide caso a caso | Branch points no plan + checkpoint | ✓ |

**User's choice:** Você decide caso a caso

---

## Area 3: TTL + soak + announcement

### Q3.1: Quando subir TTL de 300s pra 3600s?
| Option | Description | Selected |
|--------|-------------|----------|
| Após Phase 38 UAT clean + 1 semana soak | Sincroniza com HSTS bump (D-18) (Recomendado) | ✓ |
| Após 24h soak | Mais rápido mas reduz rollback window | |
| Manter 300s permanentemente | Sem bump | |
| Você decide depois | TTL=300 lockado pra Phase 36 | |

**User's choice:** Após Phase 38 UAT clean + 1 semana soak

### Q3.2: Quando declarar 'site no ar'?
| Option | Description | Selected |
|--------|-------------|----------|
| Imediatamente após cert + dig OK | Phase 36 success criteria | |
| Após 24h DNS soak | Mais conservador | |
| Após Phase 38 UAT clean | Phase 36 fica em 'invite-only soak' | ✓ |

**User's choice:** Após Phase 38 UAT clean

### Q3.3: UptimeRobot probe — antes ou depois do flip?
| Option | Description | Selected |
|--------|-------------|----------|
| Depois do flip + cert OK | Phase 39 (parallel track) configura (Recomendado) | ✓ |
| Antes do flip, contra *.vercel.app | 2 steps | |
| Phase 39 owns inteiramente | Limpo de escopo | |

**User's choice:** Depois do flip + cert OK

### Q3.4: Soak window pra Phase 36 PASS?
| Option | Description | Selected |
|--------|-------------|----------|
| 1 hora (smoke + dig 3 resolvers + 5x curl /api/health) | Pragmático | ✓ |
| 24 horas | Mais conservador | |
| Marcar PASS imediato, observar via Phase 38 | Phase 36 = site servindo | |

**User's choice:** 1 hora

---

## Area 4: Verificação + rollback

### Q4.1: Quais resolvers?
| Option | Description | Selected |
|--------|-------------|----------|
| 1.1.1.1 + 8.8.8.8 + 9.9.9.9 (3 resolvers) | Cloudflare + Google + Quad9 (Recomendado) | ✓ |
| Apenas 1.1.1.1 + 8.8.8.8 (ROADMAP min) | Mínimo DEP-DNS-04 | |
| Add NIC.br 200.160.0.10 | Cobre AS BR melhor | |

**User's choice:** 1.1.1.1 + 8.8.8.8 + 9.9.9.9

### Q4.2: Plano de rollback?
| Option | Description | Selected |
|--------|-------------|----------|
| Reverter A/CNAME via API Hostinger (zone snapshot) | TTL=300 ~5min revert (Recomendado) | ✓ |
| Apex CNAME flatten | Hostinger pode não suportar | |
| Manual UI Hostinger | Backup se API der problema | |

**User's choice:** Reverter A/CNAME pros valores anteriores via API Hostinger

### Q4.3: Smoke pra Phase 36 PASS?
| Option | Description | Selected |
|--------|-------------|----------|
| openssl + curl + Playwright anon | Suite Phase 35 com BASE_URL=https://digswap.com.br (Recomendado) | ✓ |
| openssl + curl (sem Playwright) | Mais rápido | |
| openssl + curl + browser visual | Você valida visualmente | |

**User's choice:** openssl s_client + curl /api/health + Playwright anon smoke

### Q4.4: Cert ACME timeout > 30min?
| Option | Description | Selected |
|--------|-------------|----------|
| Investigate (dig CAA, TXT, runtime logs) | ACME falhas comuns (Recomendado) | ✓ |
| Rollback imediato | Mais conservador | |
| Mantém esperando | Janela longa de erro | |

**User's choice:** Investigate primeiro

---

## Area 5 (extra): Hostinger API

### Q5.1: Hostinger DNS API token?
| Option | Description | Selected |
|--------|-------------|----------|
| Tenho/sei como gerar — checkpoint Phase 35 style | Token via printf ASCII | |
| Não sei se Hostinger tem API — Claude pesquisa | RESEARCH.md cobre discovery | ✓ |
| Prefiro UI manual | Reverte D-03 | |

**User's choice:** Não sei se Hostinger tem API — Claude pesquisa no research

### Q5.2: Pronto pra gerar contexto?
| Option | Description | Selected |
|--------|-------------|----------|
| Gera o contexto agora | Decisões lockadas | ✓ |
| Discutir mais alguma área | Mais 2-3 gray areas | |

**User's choice:** Gera o contexto agora

---

## Claude's Discretion

- Vercel CLI vs MCP exact syntax pra `vercel domains add` (research determina)
- Hostinger API exact endpoints + auth scheme (research determina)
- Evidence file naming (siga convention Phase 35)
- Wave structure (provavelmente 4 waves: scaffolding → vercel domain add → DNS flip → verify)

## Deferred Ideas

- MX/SPF/DKIM/DMARC → Phase 37
- Stripe webhook URL on prod domain → Phase 37
- OAuth callbacks pra prod → Phase 37
- TTL bump 300→3600 + HSTS bump → Phase 38 + 1 semana soak
- UptimeRobot probe + Sentry prod → Phase 39
- Public announcement → Phase 38 UAT clean
- Subdomains adicionais (app./api./status.) → out of scope milestone
- Rename `digswap.com` → `digswap.com.br` em `.planning/` docs → POST-PHASE-36 QUICK
- IPv6 (AAAA), DNSSEC → out of scope MVP
