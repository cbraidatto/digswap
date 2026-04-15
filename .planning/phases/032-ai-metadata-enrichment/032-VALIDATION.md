---
phase: 32
slug: ai-metadata-enrichment
status: draft
nyquist_compliant: true
wave_0_complete: true
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
| 032-01-01 | 01 | 1 | AI-01 | tsc | `cd apps/desktop && npx tsc --noEmit` | n/a | ⬜ pending |
| 032-01-02 | 01 | 1 | AI-01, AI-02, AI-03 | unit (TDD) | `cd apps/desktop && pnpm vitest run src/main/library/ai-enrichment.test.ts -x` | co-located (tdd=true) | ⬜ pending |
| 032-02-01 | 02 | 2 | AI-01 | tsc | `cd apps/desktop && npx tsc --noEmit` | n/a | ⬜ pending |
| 032-02-02 | 02 | 2 | AI-02, AI-03 | tsc | `cd apps/desktop && npx tsc --noEmit` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Nyquist note:** Plan 01 Task 2 declares `tdd="true"` — the test file (ai-enrichment.test.ts) is created within the same task as the implementation, following co-located TDD (RED-GREEN-REFACTOR within a single task). This satisfies Nyquist because the test is written BEFORE the implementation code within the task execution, not after. No separate Wave 0 task is needed for TDD-typed tasks.

---

## Wave 0 Requirements

- [x] Test file `apps/desktop/src/main/library/ai-enrichment.test.ts` — created co-located with implementation in Plan 01 Task 2 (tdd=true)
- [ ] Install `@google/genai` in desktop package
- [ ] Restore missing library types in `apps/desktop/src/shared/ipc-types.ts` (TypeScript prerequisite from Phase 31 regression)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI badge icon visible on enriched fields | AI-02 | Visual rendering | Open library view, enrich tracks, verify sparkle icon on AI fields |
| Inline edit updates field and removes badge (list view) | AI-03 | UI interaction | Click AI-badged field in list view, edit value, verify badge gone + userEdited flag set |
| Album view shows tooltip not inline edit | AI-03 | UI interaction | Hover AI-badged field in album view, verify tooltip says "editar na vista de lista" |
| Progress feedback during batch inference | AI-01 | UX timing | Trigger enrich on 20+ tracks, verify progress indicator updates |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (co-located TDD satisfies this)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (revision pass)
