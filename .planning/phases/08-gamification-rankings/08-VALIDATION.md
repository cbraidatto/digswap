---
phase: 08
slug: gamification-rankings
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-27
updated: 2026-03-27
---

# Phase 08 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Wave 0 Requirements

Wave 0 test scaffold is created in **Plan 01, Task 1** (first task of the phase). This ensures behavioral unit test coverage from the very first implementation task.

- [x] `tests/unit/gamification/ranking-computation.test.ts` -- pure function tests for `getRankTitleFromScore()`, `CONTRIBUTION_POINTS`, `RANK_TITLES`, `BADGE_DEFINITIONS`, globalScore formula, contribution aggregation pipeline (GAME-01, GAME-06)

Wave 0 covers pure functions only (no mocking needed). The remaining 3 test files are created in Plan 05 (Wave 4) with full vi.mock() patterns:

- [ ] `tests/unit/gamification/badge-awards.test.ts` -- idempotency + trigger tests for `awardBadge()` (GAME-04)
- [ ] `tests/unit/gamification/leaderboard-queries.test.ts` -- global + genre leaderboard query tests (GAME-02, GAME-03)
- [ ] `tests/unit/gamification/profile-ranking.test.ts` -- profile ranking display + fallback tests (GAME-05)

*Existing vitest infrastructure covers base setup.*

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 08-01-01 | 01 | 1 | GAME-01, GAME-06 | unit (Wave 0) | `npx vitest run tests/unit/gamification/ranking-computation.test.ts --reporter=verbose` | pending |
| 08-01-02 | 01 | 1 | GAME-01, GAME-02, GAME-03, GAME-04 | type-check + unit | `npx tsc --noEmit && npx vitest run tests/unit/gamification/ranking-computation.test.ts --reporter=verbose` | pending |
| 08-02-01 | 02 | 2 | GAME-04 | type-check + unit | `npx tsc --noEmit && npx vitest run tests/unit/gamification/ranking-computation.test.ts --reporter=verbose` | pending |
| 08-02-02 | 02 | 2 | GAME-01, GAME-06 | sql-grep | `grep -q 'SECURITY DEFINER' supabase/migrations/20260327_ranking_function.sql && grep -q 'cron.schedule' supabase/migrations/20260327_ranking_function.sql && echo PASS` | pending |
| 08-03-01 | 03 | 2 | GAME-02, GAME-03 | type-check + unit | `npx tsc --noEmit && npx vitest run tests/unit/gamification/ranking-computation.test.ts --reporter=verbose` | pending |
| 08-03-02 | 03 | 2 | GAME-02, GAME-03 | type-check | `npx tsc --noEmit` | pending |
| 08-04-01 | 04 | 3 | GAME-01, GAME-05 | type-check + unit | `npx tsc --noEmit && npx vitest run tests/unit/gamification/ranking-computation.test.ts --reporter=verbose` | pending |
| 08-04-02 | 04 | 3 | GAME-01, GAME-05 | type-check | `npx tsc --noEmit` | pending |
| 08-04-03 | 04 | 3 | GAME-05 | type-check | `npx tsc --noEmit` | pending |
| 08-05-01 | 05 | 4 | GAME-04, GAME-06 | unit | `npx vitest run tests/unit/gamification/badge-awards.test.ts tests/unit/gamification/ranking-computation.test.ts --reporter=verbose` | pending |
| 08-05-02 | 05 | 4 | GAME-02, GAME-03, GAME-05 | unit (full) | `npx vitest run tests/unit/gamification/ --reporter=verbose` | pending |
| 08-05-03 | 05 | 4 | ALL | checkpoint | `npx vitest run --reporter=verbose` (full suite) | pending |

*Status: pending | green | red | flaky*

---

## Nyquist Sampling Continuity Check

In any 3-consecutive-task window, at least 1 task MUST run a behavioral unit test (not just `npx tsc --noEmit`).

| Window | Tasks | Unit Test Coverage |
|--------|-------|-------------------|
| W1 | 08-01-01, 08-01-02, 08-02-01 | 08-01-01 runs ranking-computation.test.ts (Wave 0) |
| W2 | 08-01-02, 08-02-01, 08-02-02 | 08-01-02 and 08-02-01 both run ranking-computation.test.ts |
| W3 | 08-02-01, 08-02-02, 08-03-01 | 08-02-01 and 08-03-01 both run ranking-computation.test.ts |
| W4 | 08-02-02, 08-03-01, 08-03-02 | 08-03-01 runs ranking-computation.test.ts |
| W5 | 08-03-01, 08-03-02, 08-04-01 | 08-03-01 and 08-04-01 both run ranking-computation.test.ts |
| W6 | 08-03-02, 08-04-01, 08-04-02 | 08-04-01 runs ranking-computation.test.ts |
| W7 | 08-04-01, 08-04-02, 08-04-03 | 08-04-01 runs ranking-computation.test.ts |
| W8 | 08-04-02, 08-04-03, 08-05-01 | 08-05-01 runs badge-awards + ranking-computation tests |
| W9 | 08-04-03, 08-05-01, 08-05-02 | 08-05-01 and 08-05-02 run full gamification test suites |
| W10 | 08-05-01, 08-05-02, 08-05-03 | All three run vitest |

**Result:** Every 3-task window has at least 1 unit test run. Nyquist criterion satisfied.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| pg_cron job runs every 15 min and updates user_rankings | GAME-01 | Requires live Supabase DB with pg_cron extension | Check cron.job table in Supabase dashboard; verify updated_at timestamps on user_rankings rows after 15 min |
| Badge awarded correctly on first Discogs import | GAME-04 | Requires live import flow | Trigger import on test account; verify FIRST_DIG badge appears on profile |
| Genre leaderboard shows correct users for a genre | GAME-03 | Requires seeded multi-genre collection data | Add records of a specific genre; verify user appears in that genre leaderboard |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (created in Plan 01 Task 1)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
