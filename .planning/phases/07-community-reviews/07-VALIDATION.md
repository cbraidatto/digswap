---
phase: 7
slug: community-reviews
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (jsdom environment) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/unit/community/ --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/unit/community/ --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 | 1 | COMM-01, COMM-02 | unit | `npx vitest run tests/unit/community/create-group.test.ts tests/unit/community/membership.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 7-01-02 | 01 | 1 | COMM-03, COMM-04 | unit | `npx vitest run tests/unit/community/group-post.test.ts tests/unit/community/group-feed.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 7-01-03 | 01 | 1 | COMM-05 | unit | `npx vitest run tests/unit/community/visibility.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 7-01-04 | 01 | 1 | REV-01, REV-02, REV-03 | unit | `npx vitest run tests/unit/community/review.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 | 2 | COMM-01, COMM-02, COMM-05 | tsc | `npx tsc --noEmit --project tsconfig.json 2>&1 \| head -30` | ✅ exists | ⬜ pending |
| 7-03-01 | 03 | 2 | COMM-03, COMM-04, COMM-06 | tsc | `npx tsc --noEmit --project tsconfig.json 2>&1 \| head -30` | ✅ exists | ⬜ pending |
| 7-04-01 | 04 | 3 | REV-01, REV-02, REV-03 | tsc | `npx tsc --noEmit --project tsconfig.json 2>&1 \| head -30` | ✅ exists | ⬜ pending |
| 7-05-01 | 05 | 4 | All | unit+tsc | `npx vitest run --reporter=verbose` | ❌ W0 | ⬜ pending |
| 7-05-02 | 05 | 4 | All | checkpoint | human-verify | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/community/create-group.test.ts` — group creation, slug generation, validation (COMM-01)
- [ ] `tests/unit/community/membership.test.ts` — join, leave, member count updates (COMM-02)
- [ ] `tests/unit/community/group-post.test.ts` — post creation, linked record attachment (COMM-03)
- [ ] `tests/unit/community/group-feed.test.ts` — feed pagination, group_post feed integration (COMM-04)
- [ ] `tests/unit/community/visibility.test.ts` — public vs private, invite mechanism (COMM-05)
- [ ] `tests/unit/community/review.test.ts` — review CRUD, 1-5 rating validation, query by release (REV-01, REV-02, REV-03)
- [ ] `tests/unit/community/slugify.test.ts` — slug generation edge cases (Claude's Discretion)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Group posts appear in main feed for eligible followers | COMM-04 | Requires two live user sessions | User A joins Electronic group, User B follows User A, User A posts → verify User B sees it in /feed |
| Private group invite via shareable link | COMM-05 | Requires live token generation and redemption | Admin generates link → copy to new session → verify join succeeds |
| Group invite notification received in bell | COMM-05 | Requires Supabase Realtime publication configured | Admin invites User B by username → User B sees bell notification |
| Review inline expand on RecordSearchCard | REV-03 | Requires live search results with reviews | Search for a record with reviews on /explorar → click "reviews: N" → verify inline panel opens |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
