---
phase: 3
slug: discogs-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 + Playwright 1.58.2 |
| **Config file** | `vitest.config.ts` (unit/integration), `playwright.config.ts` (E2E) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npm test && npm run test:e2e` |
| **Estimated runtime** | ~30 seconds (unit), ~120 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npm test && npm run test:e2e`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds (unit), 120 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | DISC-01 | unit | `npx vitest run tests/unit/lib/discogs/oauth.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | DISC-01 | integration | `npx vitest run tests/integration/discogs/callback.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 0 | DISC-02 | unit | `npx vitest run tests/unit/lib/discogs/import-worker.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 0 | DISC-02 | integration | `npx vitest run tests/integration/discogs/import.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 0 | DISC-03 | unit | `npx vitest run tests/unit/lib/discogs/import-worker.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 0 | DISC-04 | unit | `npx vitest run tests/unit/lib/discogs/import-worker.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 0 | DISC-04 | unit (component) | `npx vitest run tests/unit/components/discogs/import-progress.test.tsx -x` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 0 | DISC-05 | unit | `npx vitest run tests/unit/lib/discogs/sync.test.ts -x` | ❌ W0 | ⬜ pending |
| 03-05-01 | 05 | 0 | DISC-06 | integration | `npx vitest run tests/integration/discogs/disconnect.test.ts -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/lib/discogs/oauth.test.ts` — stubs for DISC-01 (OAuth flow helpers)
- [ ] `tests/unit/lib/discogs/import-worker.test.ts` — stubs for DISC-02, DISC-03, DISC-04 (page processing, upsert logic, progress broadcast)
- [ ] `tests/unit/lib/discogs/sync.test.ts` — stubs for DISC-05 (delta sync logic)
- [ ] `tests/integration/discogs/callback.test.ts` — stubs for DISC-01 (callback route)
- [ ] `tests/integration/discogs/import.test.ts` — stubs for DISC-02 (DB writes)
- [ ] `tests/integration/discogs/disconnect.test.ts` — stubs for DISC-06 (cleanup)
- [ ] `tests/unit/components/discogs/import-progress.test.tsx` — stubs for DISC-04 (progress UI)
- [ ] Mock factory for `@lionralfs/discogs-client` responses (shared fixture in `tests/__mocks__/discogs.ts`)
- [ ] Install `@lionralfs/discogs-client` — required before any Discogs tests can run

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OAuth redirect flow (browser) | DISC-01 | Requires live Discogs OAuth app + browser redirect | Log in, click Connect Discogs, authorize in Discogs, confirm redirect back |
| Real-time progress bar during import | DISC-04 | Requires live Discogs account with collection | Trigger import, observe progress bar updates in real time |
| Import survives tab close | DISC-02 | Background behavior, no browser automation hook | Start import, close tab, reopen → progress continues or completes |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
