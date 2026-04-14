---
phase: 29
slug: local-index-folder-scanner
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 29 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x |
| **Config file** | Inherits from electron-vite (no separate vitest.config) |
| **Quick run command** | `cd apps/desktop && pnpm test` |
| **Full suite command** | `cd apps/desktop && pnpm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/desktop && pnpm test`
- **After every plan wave:** Run `cd apps/desktop && pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 29-01-01 | 01 | 1 | SCAN-01 | unit (mock dialog) | `pnpm test -- --run src/main/library/library-ipc.test.ts` | ❌ W0 | ⬜ pending |
| 29-02-01 | 02 | 1 | SCAN-02 | unit | `pnpm test -- --run src/main/library/scanner.test.ts` | ❌ W0 | ⬜ pending |
| 29-03-01 | 03 | 1 | SCAN-03 | unit (mock music-metadata) | `pnpm test -- --run src/main/library/metadata-parser.test.ts` | ❌ W0 | ⬜ pending |
| 29-04-01 | 04 | 1 | SCAN-04 | unit (pure function) | `pnpm test -- --run src/main/library/folder-inference.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/main/library/scanner.test.ts` — covers SCAN-02 (filesystem walk, progress throttle, error skip)
- [ ] `src/main/library/metadata-parser.test.ts` — covers SCAN-03 (tag extraction, format mapping)
- [ ] `src/main/library/folder-inference.test.ts` — covers SCAN-04 (all 5 regex patterns, edge cases)
- [ ] `src/main/library/db.test.ts` — covers schema creation, CRUD, incremental scan queries

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native folder picker dialog opens | SCAN-01 | Electron dialog requires real OS interaction | Launch app → My Library → Choose Folder → verify native dialog opens |
| Progress bar + ticker shows during scan | SCAN-02 | Visual rendering verification | Select folder with 10+ audio files → verify bar fills and paths scroll |
| Dual view toggle works | — | Visual rendering | After scan → click list/album icons → verify both views render |
| Inferred metadata color differentiation | SCAN-04 | Visual CSS verification | Scan folder with untagged WAV files → verify muted color on inferred fields |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
