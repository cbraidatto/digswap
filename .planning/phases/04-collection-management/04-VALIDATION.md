---
phase: 4
slug: collection-management
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x + @testing-library/react 16.3.x |
| **Config file** | `vitest.config.ts` (exists, configured with jsdom + react plugin) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run && npx playwright test` |
| **Estimated runtime** | ~30 seconds (unit), ~90 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 0 | COLL-02 | unit | `npx vitest run tests/unit/lib/collection/rarity.test.ts` | ❌ W0 | ⬜ pending |
| 4-01-02 | 01 | 0 | COLL-04 | unit | `npx vitest run tests/unit/lib/collection/filters.test.ts` | ❌ W0 | ⬜ pending |
| 4-02-01 | 02 | 1 | COLL-01 | unit | `npx vitest run tests/unit/components/collection/collection-grid.test.tsx` | ❌ W0 | ⬜ pending |
| 4-02-02 | 02 | 1 | COLL-01 | integration | `npx vitest run tests/integration/collection/public-profile.test.ts -t "unauthenticated"` | ❌ W0 | ⬜ pending |
| 4-03-01 | 03 | 1 | COLL-03 | unit | `npx vitest run tests/unit/components/collection/add-record-dialog.test.tsx` | ❌ W0 | ⬜ pending |
| 4-03-02 | 03 | 1 | COLL-03 | integration | `npx vitest run tests/integration/collection/add-record.test.ts` | ❌ W0 | ⬜ pending |
| 4-04-01 | 04 | 2 | COLL-05 | integration | `npx vitest run tests/integration/collection/sort.test.ts` | ❌ W0 | ⬜ pending |
| 4-04-02 | 04 | 2 | COLL-06 | integration | `npx vitest run tests/integration/collection/condition.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/lib/collection/rarity.test.ts` — stubs for COLL-02 (rarity tier mapping: Ultra Rare ≥2.0, Rare ≥0.5, Common <0.5, null = no badge)
- [ ] `tests/unit/lib/collection/filters.test.ts` — stubs for COLL-04 (decade mapping 80s=1980-1989, genre array parsing, format matching)
- [ ] `tests/unit/components/collection/collection-grid.test.tsx` — stubs for COLL-01 (grid renders cards, empty state, loading skeleton)
- [ ] `tests/unit/components/collection/add-record-dialog.test.tsx` — stubs for COLL-03 (search input, results list, select action)
- [ ] `tests/integration/collection/add-record.test.ts` — stubs for COLL-03 (server action: Discogs search + insert collection_item)
- [ ] `tests/integration/collection/condition.test.ts` — stubs for COLL-06 (condition grade update server action)
- [ ] `tests/integration/collection/public-profile.test.ts` — stubs for COLL-01 (unauthenticated access to /perfil/[username])
- [ ] `tests/integration/collection/sort.test.ts` — stubs for COLL-05 (sort by rarity/date/alpha ordering)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cover art images load correctly from Discogs CDN | COLL-01 | External image URL, no mock available | Browse collection, verify images render (not broken) |
| FAB floats above bottom nav on mobile viewport | COLL-03 | CSS z-index / positioning visual check | Resize to 375px width, verify FAB visible above nav bar |
| Condition grade hover tooltip appears on card hover | COLL-06 | CSS :hover state, not testable in jsdom | Hover over a collection card, verify grade tooltip appears |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
