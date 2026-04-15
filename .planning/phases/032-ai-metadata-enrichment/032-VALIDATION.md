---
phase: 32
slug: ai-metadata-enrichment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-15
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | apps/desktop/vitest.config.ts |
| **Quick run command** | `cd apps/desktop && pnpm test` |
| **Full suite command** | `cd apps/desktop && pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/desktop && pnpm test`
- **After every plan wave:** Run `cd apps/desktop && pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 032-01-01 | 01 | 1 | AI-01 | unit | `cd apps/desktop && pnpm vitest run src/main/library/ai-enrichment.test.ts -x` | ❌ W0 | ⬜ pending |
| 032-01-02 | 01 | 1 | AI-02 | unit | `cd apps/desktop && pnpm vitest run src/main/library/ai-enrichment.test.ts -x` | ❌ W0 | ⬜ pending |
| 032-01-03 | 01 | 1 | AI-03 | unit | `cd apps/desktop && pnpm vitest run src/main/library/ai-enrichment.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/desktop/src/main/library/ai-enrichment.test.ts` — stubs for AI-01, AI-02, AI-03 (mock @google/genai)
- [ ] Install `@google/genai` in desktop package
- [ ] Restore missing library types in `apps/desktop/src/shared/ipc-types.ts` (TypeScript prerequisite from Phase 31 regression)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI badge icon visible on enriched fields | AI-02 | Visual rendering | Open library view, enrich tracks, verify sparkle icon on AI fields |
| Inline edit updates field and removes badge | AI-03 | UI interaction | Click AI-badged field, edit value, verify badge gone + userEdited flag set |
| Progress feedback during batch inference | AI-01 | UX timing | Trigger enrich on 20+ tracks, verify progress indicator updates |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
