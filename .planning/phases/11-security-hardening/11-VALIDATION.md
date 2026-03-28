---
phase: 11
slug: security-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.1 + Playwright 1.58.2 |
| **Config file** | vitest.config.ts, playwright.config.ts |
| **Quick run command** | `npx vitest run tests/security/` |
| **Full suite command** | `npx vitest run && npx playwright test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/security/ -x`
- **After every plan wave:** Run `npx vitest run && npx playwright test`
- **Before `/gsd:verify-work`:** Full suite green + ZAP baseline clean
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 0 | SEC-02a | unit | `npx vitest run tests/security/rate-limiting.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 0 | SEC-02b | unit | `npx vitest run tests/security/input-validation.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 0 | SEC-02c | unit | `npx vitest run tests/security/idor.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-01-04 | 01 | 0 | SEC-02d | unit | `npx vitest run tests/security/csp.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-01-05 | 01 | 0 | SEC-02e | unit | `npx vitest run tests/security/open-redirect.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | SEC-03a | unit | `npx vitest run tests/security/auth-bypass.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-02-02 | 02 | 1 | SEC-03b | unit | `npx vitest run tests/security/rls-coverage.test.ts -x` | ❌ W0 | ⬜ pending |
| 11-03-01 | 03 | 2 | SEC-04a | automated | `docker run ... zap-baseline.py` | ❌ W0 | ⬜ pending |
| 11-03-02 | 03 | 2 | SEC-04b | manual | Manual server action audit checklist | -- | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/security/rate-limiting.test.ts` — stubs for SEC-02a
- [ ] `tests/security/input-validation.test.ts` — stubs for SEC-02b
- [ ] `tests/security/idor.test.ts` — stubs for SEC-02c
- [ ] `tests/security/csp.test.ts` — stubs for SEC-02d
- [ ] `tests/security/open-redirect.test.ts` — stubs for SEC-02e
- [ ] `tests/security/auth-bypass.test.ts` — stubs for SEC-03a
- [ ] `tests/security/rls-coverage.test.ts` — stubs for SEC-03b
- [ ] `src/lib/validations/community.ts` — Zod schemas for community actions
- [ ] `src/lib/validations/trade.ts` — Zod schemas for trade actions
- [ ] `src/lib/validations/profile.ts` — Zod schemas for profile actions
- [ ] `src/lib/validations/common.ts` — shared UUID, pagination, sanitization schemas

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pen test — Server Action audit | SEC-04b | ZAP cannot scan Next.js Flight protocol | Review all 15 server action files against checklist: auth check, rate limit, Zod validation, IDOR guard |
| ZAP baseline scan | SEC-04a | Requires Docker + running app | `docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://localhost:3000` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
