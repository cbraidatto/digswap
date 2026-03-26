---
phase: 6
slug: discovery-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 6 — Validation Strategy

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
| 6-01-01 | 01 | 0 | DISC2-01 | unit stub | `npx vitest run tests/unit/discovery/record-search.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 0 | DISC2-02 | unit stub | `npx vitest run tests/unit/discovery/genre-browse.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 0 | DISC2-03 | unit stub | `npx vitest run tests/unit/notifications/wantlist-match.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-04 | 01 | 0 | DISC2-04 | unit stub | `npx vitest run tests/unit/discovery/taste-match.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-05 | 01 | 0 | NOTF-01 | unit stub | `npx vitest run tests/unit/notifications/delivery.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-06 | 01 | 0 | NOTF-04 | unit stub | `npx vitest run tests/unit/notifications/preferences.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/discovery/record-search.test.ts` — stubs for DISC2-01 (search by title/artist, returns owners)
- [ ] `tests/unit/discovery/genre-browse.test.ts` — stubs for DISC2-02 (browse by genre/decade, all-user grid)
- [ ] `tests/unit/notifications/wantlist-match.test.ts` — stubs for DISC2-03 (match detection, admin insert, email trigger)
- [ ] `tests/unit/discovery/taste-match.test.ts` — stubs for DISC2-04 (top-genre records + followers' records)
- [ ] `tests/unit/notifications/delivery.test.ts` — stubs for NOTF-01 (in-app notification insert, Realtime broadcast)
- [ ] `tests/unit/notifications/preferences.test.ts` — stubs for NOTF-04 (preference read/write, lazy-create defaults)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supabase Realtime bell badge increments on new notification | NOTF-01 | Requires live WebSocket + DB insert | Open /feed, trigger wantlist match from another session, verify bell badge appears without page refresh |
| Record search debounce fires at 300ms | DISC2-01 | Requires browser timing | Type in record search, verify no request before 300ms, request fires after pause |
| Email received in inbox for wantlist match | NOTF-02 | Requires real Resend delivery | Add a record matching own wantlist in test, verify email arrives |
| Notification preferences toggles persist across page refresh | NOTF-04 | Requires DB round-trip verification | Toggle preferences, refresh page, verify state preserved |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
