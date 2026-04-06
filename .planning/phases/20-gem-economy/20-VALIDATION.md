---
phase: 20
slug: gem-economy
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-06
updated: 2026-04-06
---

# Phase 20 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/web && npx vitest run tests/unit/gems --reporter=verbose` |
| **Full suite command** | `cd apps/web && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx vitest run tests/unit/gems --reporter=verbose`
- **After every plan wave:** Run `cd apps/web && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Test File | Status |
|---------|------|------|-------------|-----------|-------------------|-----------|--------|
| 20-01-T1 | 01 | 1 | GEM-01, GEM-02, GEM-07 | unit | `vitest run tests/unit/gems` | `apps/web/tests/unit/gems/gem-tiers.test.ts` | Covered by Plan 01 |
| 20-01-T1 | 01 | 1 | GEM-07 | unit | `vitest run tests/unit/gems` | `apps/web/tests/unit/gems/gem-badge.test.tsx` | Covered by Plan 01 |
| 20-01-T1 | 01 | 1 | GEM-04 | unit | `vitest run tests/unit/gems` | `apps/web/tests/unit/gems/gem-distribution.test.ts` | Covered by Plan 01 |
| 20-02-T1 | 02 | 1 | GEM-03, GEM-06 | unit | `vitest run tests/unit/gamification` | `apps/web/tests/unit/gamification/ranking-computation.test.ts` | Covered by Plan 02 (update existing) |
| 20-03-T1 | 03 | 2 | GEM-01 | tsc | `npx tsc --noEmit` | N/A (type check only) | Covered by Plan 03 |
| 20-04-T1 | 04 | 3 | GEM-04 | manual | Visual inspection | N/A | Covered by Plan 04 + Plan 05 checkpoint |
| 20-04-T2 | 04 | 3 | GEM-05 | unit | `vitest run tests/unit/gems/gem-notifications` | `apps/web/tests/unit/gems/gem-notifications.test.ts` | Covered by Plan 04 |
| 20-05-T1 | 05 | 4 | GEM-03, GEM-07 | unit | `vitest run --reporter=verbose` | Full suite | Covered by Plan 05 |
| 20-05-T2 | 05 | 4 | GEM-07 | manual | Visual inspection | N/A | Checkpoint in Plan 05 |

*Status: Covered by Plan = Wave 0 stub covered by plan task*

---

## Wave 0 Requirements

All Wave 0 test stubs are covered by plan tasks:

- [x] `apps/web/tests/unit/gems/gem-tiers.test.ts` -- covers GEM-01, GEM-02 (getGemTier, getGemWeight, GEM_TIERS constants) -- **Plan 01 Task 1**
- [x] `apps/web/tests/unit/gems/gem-distribution.test.ts` -- covers GEM-04 (gem count aggregation logic) -- **Plan 01 Task 1**
- [x] `apps/web/tests/unit/gems/gem-badge.test.tsx` -- covers GEM-07 (component renders correct classes) -- **Plan 01 Task 1**
- [x] `apps/web/tests/unit/gems/gem-notifications.test.ts` -- covers GEM-05 (tier change detection logic) -- **Plan 04 Task 2**
- [x] `apps/web/tests/unit/gamification/ranking-computation.test.ts` -- covers GEM-03, GEM-06 (updated constants and formula) -- **Plan 02 Task 2** (update existing file)

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Gem badge visual effects (sparkle, glow, prismatic) | GEM-07 | CSS animations require visual inspection | Open collection view, verify each gem tier has correct visual effect on hover; Diamante should have always-active prismatic animation |
| Gem Vault profile display | GEM-04 | Layout/distribution chart is visual | Navigate to /perfil, verify gem distribution chart shows correct counts and total gem score |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
