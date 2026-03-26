---
phase: 5
slug: social-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.x + @testing-library/react |
| **Config file** | `vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 01 | 0 | SOCL-01 | unit stub | `npx vitest run tests/unit/social/follow.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-02 | 01 | 0 | SOCL-02 | unit stub | `npx vitest run tests/unit/social/unfollow.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-03 | 01 | 0 | SOCL-03 | unit stub | `npx vitest run tests/unit/social/feed.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-04 | 01 | 0 | SOCL-04 | unit stub | `npx vitest run tests/unit/social/compare.test.ts` | ❌ W0 | ⬜ pending |
| 5-01-05 | 01 | 0 | SOCL-05 | unit stub | `npx vitest run tests/unit/social/public-profile.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/social/follow.test.ts` — stubs for SOCL-01 (follow action, following list)
- [ ] `tests/unit/social/unfollow.test.ts` — stubs for SOCL-02 (unfollow action, list update)
- [ ] `tests/unit/social/feed.test.ts` — stubs for SOCL-03 (feed queries, global vs personal)
- [ ] `tests/unit/social/compare.test.ts` — stubs for SOCL-04 (comparison logic: in-common, unique sets)
- [ ] `tests/unit/social/public-profile.test.ts` — stubs for SOCL-05 (public profile data access)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Infinite scroll loads next page on viewport entry | SOCL-03 | Requires browser IntersectionObserver | Scroll to bottom of /feed, verify new items load |
| Progress bar step 1 marks complete after Discogs connect | SOCL-06 | Requires real OAuth flow | Connect Discogs in /settings, return to /feed, verify step 1 checked |
| Progress bar step 2 marks complete after 3 follows | SOCL-06 | Requires follow actions | Follow 3 users, verify step 2 checks off |
| Collection comparison 3-column layout on mobile | SOCL-04 | Responsive layout | Open /perfil/[username]/compare on mobile viewport |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
