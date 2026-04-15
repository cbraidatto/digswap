---
phase: 30
slug: sync-engine
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-14
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `apps/web/vitest.config.ts` / `apps/desktop/vitest.config.ts` |
| **Quick run command** | `pnpm --filter web test -- --run` |
| **Full suite command** | `pnpm --filter web test -- --run && pnpm --filter desktop test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test -- --run`
- **After every plan wave:** Run `pnpm --filter web test -- --run && pnpm --filter desktop test -- --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 30-01-01 | 01 | 1 | SYNC-02 | unit | `cd apps/web && npx vitest run src/lib/sync/normalize.test.ts -x` | Created inline (TDD) | ⬜ pending |
| 30-01-02 | 01 | 1 | SYNC-01, SYNC-02, SYNC-03 | unit | `cd apps/web && npx vitest run src/lib/sync/process-sync-batch.test.ts -x` | Created inline (TDD) | ⬜ pending |
| 30-02-01 | 02 | 1 | SYNC-01, SYNC-03, SYNC-04 | unit | `cd apps/desktop && npx vitest run src/main/library/sync-manager.test.ts -x` | Created inline (TDD) | ⬜ pending |
| 30-02-02 | 02 | 1 | SYNC-01 | typecheck | `cd apps/desktop && npx tsc --noEmit --pretty 2>&1 \| head -30` | N/A | ⬜ pending |
| 30-03-01 | 03 | 2 | SYNC-03, SYNC-02 | regression | `cd apps/web && npx vitest run --reporter=verbose 2>&1 \| tail -20` | Existing suite | ⬜ pending |
| 30-03-02 | 03 | 2 | ALL | manual | Human checkpoint: desktop-to-web sync flow | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All test files are created inline by TDD tasks (tests written FIRST, then implementation):
- `apps/web/src/lib/sync/normalize.test.ts` — created by Plan 01 Task 1 (covers SYNC-02 normalization)
- `apps/web/src/lib/sync/process-sync-batch.test.ts` — created by Plan 01 Task 2 (covers SYNC-01, SYNC-02, SYNC-03)
- `apps/desktop/src/main/library/sync-manager.test.ts` — created by Plan 02 Task 1 (covers SYNC-01, SYNC-03, SYNC-04)

No separate Wave 0 task needed — TDD plans create tests as their first step.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Desktop→Web full sync flow | SYNC-01 | Requires running Electron + Supabase | 1. Scan folder with test audio 2. Trigger sync 3. Check web profile shows items |
| Discogs dedup match | SYNC-02 | Requires live Discogs API | 1. Import a Discogs collection 2. Scan local folder with matching artist+album 3. Verify single release, not duplicate |
| Deletion propagation | SYNC-03 | Requires file system + sync cycle | 1. Delete a scanned file 2. Trigger sync 3. Verify item hidden on web, purged after 7 days |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (tests created inline by TDD)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
