---
phase: 2
slug: ui-shell-navigation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 02 — Validation Strategy

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
| 02-01-01 | 01 | 1 | NAV-01 | unit | `npx vitest run src/components/nav` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | NAV-01 | unit | `npx vitest run src/components/nav` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | NAV-02 | unit | `npx vitest run src/components/nav` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | NAV-03 | unit | `npx vitest run src/app` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | NAV-02 | manual | — | n/a | ⬜ pending |
| 02-03-01 | 03 | 2 | NAV-01 | manual | — | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/nav/__tests__/bottom-nav.test.tsx` — stubs for NAV-01, NAV-02 (active tab rendering, label rendering)
- [ ] `src/components/nav/__tests__/app-header.test.tsx` — stubs for NAV-01 (header renders wordmark + avatar)
- [ ] `src/app/__tests__/routing.test.tsx` — stubs for NAV-03 (deep-link active tab detection)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Active tab does not reset when navigating within a tab | NAV-02 | Requires real browser navigation interaction | Open app, go to Feed tab, navigate to a sub-route, confirm Feed tab still highlighted |
| iOS safe-area inset renders correctly | NAV-01 | Requires real iOS device or Safari simulator | Open in iOS Safari, confirm bottom bar clears home bar indicator |
| Avatar dropdown opens and sign out works | NAV-01 | Requires authenticated session and server action | Log in, click avatar, click "Sign Out", confirm redirect to /login |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
