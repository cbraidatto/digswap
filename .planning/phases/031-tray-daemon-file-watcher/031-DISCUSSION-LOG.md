# Phase 31: Tray Daemon + File Watcher - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 031-tray-daemon-file-watcher
**Areas discussed:** Tray behavior, Watch strategy, Auto-start + boot, Diff scan on startup

---

## Tray Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Sempre minimiza pro tray | Clicar no X nunca fecha o app — sempre vai pro tray. Quit só pelo menu do tray. | ✓ |
| Pergunta na primeira vez | Primeira vez mostra dialog: 'Minimizar para tray ou fechar?'. Salva a preferência. | |
| Configurável em Settings | Setting 'Minimize to tray on close' (default: on). Usuário pode mudar a qualquer momento. | |

**User's choice:** Sempre minimiza pro tray
**Notes:** Nenhuma

| Option | Description | Selected |
|--------|-------------|----------|
| Mínimo: Open + Quit | Só o essencial: abrir a janela e sair do app. | ✓ |
| Open + Pause/Resume + Quit | Adiciona toggle de watching: pausar/retomar monitoramento de arquivos. | |
| Open + Pause + Sync Now + Quit | Inclui botão de sync manual direto do tray, sem precisar abrir a janela. | |

**User's choice:** Mínimo: Open + Quit
**Notes:** Nenhuma

---

## Watch Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Re-scan incremental só | Detecta mudança → atualiza o índice SQLite local. Sync com Supabase fica manual. | |
| Re-scan + auto-sync | Detecta mudança → atualiza índice local → automaticamente faz sync com Supabase (com debounce). | ✓ |
| Você decide | Claude decide a melhor estratégia | |

**User's choice:** Re-scan + auto-sync

| Option | Description | Selected |
|--------|-------------|----------|
| 5 segundos | Rápido — pode gerar muitos scans durante operações em batch | |
| 30 segundos | Equilibrado — espera o usuário terminar de copiar/mover arquivos | |
| 2 minutos | Conservador — menos I/O, melhor para pastas grandes | ✓ |

**User's choice:** 2 minutos debounce

| Option | Description | Selected |
|--------|-------------|----------|
| Sem limite | Monitora tudo independente do tamanho | |
| Warning acima de 10K | Avisa o usuário que pastas grandes podem consumir mais recursos | ✓ |
| Você decide | Claude decide | |

**User's choice:** Warning acima de 10K

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, recursivo total | Monitora a pasta raiz e todas as subpastas | ✓ |
| Só primeiro nível | Monitora só a pasta raiz, sem subpastas | |
| Configurável | Setting para escolher profundidade de monitoramento | |

**User's choice:** Sim, recursivo total

| Option | Description | Selected |
|--------|-------------|----------|
| Mesmas do scanner | Usar a mesma lista de extensões que o scanner da Phase 29 | ✓ |
| Custom list | Permitir configuração de quais extensões monitorar | |
| Você decide | Claude decide | |

**User's choice:** Mesmas do scanner

| Option | Description | Selected |
|--------|-------------|----------|
| Sim, com lista fixa | Ignora .tmp, .part, .crdownload, thumbs.db, .DS_Store — lista hardcoded | ✓ |
| Você decide | Claude decide o melhor filtro | |

**User's choice:** Sim, com lista fixa

---

## Auto-start + Boot

| Option | Description | Selected |
|--------|-------------|----------|
| electron-auto-launch (Recommended) | Pacote npm popular, cross-platform. Adiciona ao registro do Windows automaticamente. | ✓ |
| Windows Registry direto | Escrever diretamente no HKCU Run. Mais controle, só Windows. | |
| Você decide | Claude escolhe | |

**User's choice:** electron-auto-launch

| Option | Description | Selected |
|--------|-------------|----------|
| Direto pro tray (sem janela) | Boot silencioso — só ícone no tray, watcher ativo. | ✓ |
| Janela minimizada | Abre a janela mas já minimizada. Aparece na taskbar. | |
| Você decide | Claude escolhe | |

**User's choice:** Direto pro tray (sem janela)

---

## Diff Scan on Startup

| Option | Description | Selected |
|--------|-------------|----------|
| Comparar modifiedAt (Recommended) | Compara stat.mtimeMs vs SQLite. Rápido, sem I/O extra. | ✓ |
| Hash completo | Recalcula SHA256 de cada arquivo. Preciso mas lento. | |
| Você decide | Claude escolhe | |

**User's choice:** Comparar modifiedAt

| Option | Description | Selected |
|--------|-------------|----------|
| Automático e silencioso | Roda em background, sem feedback. | |
| Automático com notificação | Roda em background, mostra toast: 'Found 5 new files, 2 removed'. | ✓ |
| Pedir confirmação | Pergunta ao usuário se quer escanear. | |

**User's choice:** Automático com notificação

---

## Claude's Discretion

- chokidar configuration (polling interval, awaitWriteFinish)
- Toast/notification UI implementation
- Tray icon design
- electron-auto-launch vs app.setLoginItemSettings()
- Debounce implementation details

## Deferred Ideas

- Pause/Resume watching from tray
- Sync Now from tray
- Tray icon status indicator
- Multiple library roots
- macOS/Linux auto-start testing
