# Phase 32: AI Metadata Enrichment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-15
**Phase:** 032-ai-metadata-enrichment
**Areas discussed:** Trigger de inferencia, Modelo de confianca, Protecao de correcoes, UX de review

---

## Trigger de inferencia

| Option | Description | Selected |
|--------|-------------|----------|
| Automatico no scan | Apos cada scan, arquivos com campos faltando vao para fila de inferencia automatica | |
| Sob demanda | Botao 'Enriquecer metadados' na library view. Usuario decide quando rodar | ✓ |
| Hibrido | Automatico no primeiro scan, depois so sob demanda para novos arquivos | |

**User's choice:** Sob demanda
**Notes:** Usuario quer controle sobre quando o AI roda e quando quota da API e consumida

---

## Threshold de poorly-tagged

| Option | Description | Selected |
|--------|-------------|----------|
| Faltando artist OU title | Qualquer arquivo sem artist ou title vai para inferencia | |
| Qualquer campo vazio | Se artist, album, title OU year esta null, dispara inferencia | ✓ |
| Confidence low | Qualquer campo com confidence 'low' dispara re-inferencia via AI | |

**User's choice:** Qualquer campo vazio
**Notes:** Threshold amplo — qualquer null em artist, album, title ou year qualifica

---

## Modelo de confianca

| Option | Description | Selected |
|--------|-------------|----------|
| Adicionar 'ai' como terceiro nivel | MetadataConfidence vira 'high' / 'low' / 'ai'. Simples, compativel com UI existente | ✓ |
| Score numerico 0.0-1.0 | Gemini retorna score numerico. Mais granular mas precisa mudar schema e UI | |
| Manter high/low, AI e 'low' | Trata inferencia AI igual folder-inference. Sem mudanca de schema | |

**User's choice:** Adicionar 'ai' como terceiro nivel
**Notes:** Mantém simplicidade do tipo string, compativel com UI existente de confidence

---

## Protecao de correcoes

| Option | Description | Selected |
|--------|-------------|----------|
| Flag 'userEdited' por campo | Colunas artistUserEdited, albumUserEdited etc no SQLite. Granular por campo | ✓ |
| Flag unica por track | Uma coluna 'userEdited' boolean. Simples mas tudo-ou-nada | |
| Confidence 'manual' como protecao | Quando usuario edita, confidence vira 'manual'. AI so sobrescreve 'low' e 'ai' | |

**User's choice:** Flag 'userEdited' por campo
**Notes:** Granularidade por campo permite editar artist mas deixar AI re-inferir album

---

## UX de review

| Option | Description | Selected |
|--------|-------------|----------|
| Inline na library view | Campos inferidos com badge AI. Click abre edicao inline. Sem tela separada | ✓ |
| Tela dedicada de review | Pagina '/library/review' lista so tracks com inferencia AI. Batch approve/edit/reject | |
| Dialog por track | Click numa track com AI metadata abre dialog mostrando original vs inferido | |

**User's choice:** Inline na library view
**Notes:** Mantem fluxo simples dentro da library existente, badge visual indica campos AI

---

## Claude's Discretion

- Gemini Flash model version e API config
- Batch size para inference requests
- Progress UI pattern
- Inline edit component implementation
- Rate limiting / retry strategy

## Deferred Ideas

None
