---
phase: 2
slug: ui-shell-navigation
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-25
---

# Phase 02 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | NAV-01, NAV-02 | lint | `npx biome check src/components/shell/ src/actions/auth.ts --skip-errors` | n/a | pending |
| 02-01-02 | 01 | 1 | NAV-01, NAV-03 | lint | `npx biome check src/app/\(protected\)/layout.tsx src/lib/supabase/middleware.ts --skip-errors` | n/a | pending |
| 02-02-01 | 02 | 2 | NAV-01, NAV-03 | lint | `npx biome check src/app/\(protected\)/\(feed\)/feed/page.tsx --skip-errors` | n/a | pending |
| 02-02-02 | 02 | 2 | NAV-01, NAV-02, NAV-03 | unit | `npx vitest run tests/unit/components/shell/ --reporter=verbose` | Wave 0 (created in 02-02 Task 2) | pending |

*Status: pending -- green -- red -- flaky*

---

## Wave 0 Requirements

- [x] `tests/unit/components/shell/bottom-bar.test.tsx` -- tests for NAV-01 (4 tabs rendered, labels, hrefs), NAV-02 (active tab styling, aria-current), NAV-03 (deep link startsWith detection)
- [x] `tests/unit/components/shell/app-header.test.tsx` -- tests for NAV-01 (header renders VinylDig wordmark with font-heading class)
- [x] `tests/unit/components/shell/empty-state.test.tsx` -- tests for empty state rendering (heading, body, icon SVG)
- [x] `tests/e2e/navigation.spec.ts` -- E2E scaffolds using test.fixme() pending authenticated storageState fixture

Wave 0 test files are created by Plan 02-02 Task 2 (type: tdd). Unit tests run immediately; E2E tests are scaffolded but deferred until auth fixture exists.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Active tab does not reset when navigating within a tab | NAV-02 | Requires real browser navigation interaction | Open app, go to Feed tab, navigate to a sub-route, confirm Feed tab still highlighted |
| iOS safe-area inset renders correctly | NAV-01 | Requires real iOS device or Safari simulator | Open in iOS Safari, confirm bottom bar clears home bar indicator |
| Avatar dropdown opens and sign out works | NAV-01 | Requires authenticated session and server action | Log in, click avatar, click "Sign Out", confirm redirect to /signin |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
