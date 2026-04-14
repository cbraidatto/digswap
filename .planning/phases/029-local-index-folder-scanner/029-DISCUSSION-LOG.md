# Phase 29: Local Index + Folder Scanner - Discussion Log

**Date:** 2026-04-14
**Mode:** Advisor (standard calibration)
**Areas discussed:** 11 (4 original + 4 additional + 3 gap analysis)

---

## Round 1: Core Gray Areas (Advisor-researched)

### 1. Storage do Índice
- **Options presented:** SQLite (better-sqlite3), electron-store (JSON), JSON file, LevelDB/LMDB
- **Selected:** SQLite (better-sqlite3)
- **Rationale:** Phase 30 sync queries require SQL capability. JSON degrades at 5000+ entries.

### 2. UX de Progresso do Scan
- **Options presented:** Bar + counters, live file ticker, scrolling log, indeterminate spinner
- **Selected:** Bar + ticker combined
- **Rationale:** Bar gives quantitative progress, ticker gives qualitative liveness. Follows TransferScreen pattern.

### 3. Inferência de Metadados
- **Options presented:** Tag-only, filename only, folder-hierarchy (5 patterns), full heuristic engine
- **Selected:** Folder-hierarchy with 5 patterns + confidence flags
- **Rationale:** Covers real digger folder conventions. Confidence flags create clean Phase 32 handoff.

### 4. Formatos Suportados
- **Options presented:** Conservative (trade whitelist), Inclusive Core (+m4a/ape/wma), Broad +DSD, Fully permissive
- **User clarification:** Wants DJ-focused, fewer formats
- **Selected:** FLAC, WAV, AIFF only (lossless)
- **Follow-up:** Asked about MP3 inclusion → rejected. Strictly lossless.

## Round 2: Additional Areas

### 5. Library UI (Tela do Scanner)
- **Options presented:** Lista simples, agrupado por album, dual view
- **Selected:** Dual view (list + album-grouped), no search/filter

### 6. Re-scan e Atualização
- **Options presented:** Incremental only, full always, incremental + full button
- **Selected:** Incremental + botão de full re-scan

### 7. Múltiplas Pastas
- **Options presented:** Uma pasta, múltiplas pastas
- **Selected:** Uma pasta root

### 8. Tratamento de Erros
- **Options presented:** Pular e logar, pular silenciosamente, parar e avisar
- **Selected initially:** Parar e avisar
- **Revised in gap analysis to:** Pular e mostrar resumo (see Round 3)

## Round 3: Gap Analysis

User requested: "procure gaps de logica, arquitetura e front end"

10 gaps identified across logic (3), architecture (2), and frontend (5).

### 9. Erro revisado
- **Gap:** "Parar e avisar" conflicts with large collections (frustrating loop)
- **Options presented:** Pular e resumo, manter parar, threshold de erros
- **Selected:** Pular e mostrar resumo no final

### 10. Incremental — detecção de mudanças
- **Options presented:** mtime + hash se mudou, só mtime, hash sempre
- **Selected:** mtime primeiro, hash se mudou

### 11. Inferência parcial (mixing tags + inference)
- **User asked for clarification:** "me explica direito isso"
- **Explained with concrete example:** Madlib/Shades of Blue/03 - Scarface.flac with partial tags
- **Options presented:** Preencher faltantes (mix), tudo ou nada
- **Selected:** Preencher campos faltantes, marcar como low confidence

### 12. Threading do scan
- **Options presented:** Worker thread, main process async, Claude decide
- **Selected:** Claude decide

### 13. Empty state / primeiro uso
- **Options presented:** Tela com botão central, wizard, Claude decide
- **Selected:** Tela com botão central "Choose Folder"

### 14. Scan progress — onde aparece
- **Options presented:** Substitui library view, modal/overlay, Claude decide
- **Selected:** Substitui a library view

### 15. View toggle (dual view)
- **Options presented:** Ícones toggle, tabs, Claude decide
- **Selected:** Ícones toggle (grid/list) no canto superior

### 16. Confidence na UI
- **Options presented:** Itálico + tooltip, badge/ícone, cor diferente, Claude decide
- **Selected:** Cor diferente para campos inferidos

## Round 4: Extended Schema & Architecture

### 17. Schema do SQLite — campos extras
- **Options presented (multiSelect):** fileSize, sampleRate+bitDepth, confidence flags, mínimo
- **Selected:** All — fileSize, sampleRate, bitDepth, confidence flags included

### 18. Handoff para Phase 30
- **Options presented:** syncedAt column, Phase 30 decide, syncedAt + syncHash
- **Selected:** syncedAt + syncHash

### 19. Navegação desktop
- **Options presented:** Nova tela no AppShell, tela inicial, tab lateral
- **Selected:** Nova tela "My Library" no AppShell

---

*Phase: 029-local-index-folder-scanner*
*Discussion log generated: 2026-04-14*
