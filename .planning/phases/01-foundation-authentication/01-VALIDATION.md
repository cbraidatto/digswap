---
phase: 1
slug: foundation-authentication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (unit/integration) + Playwright (e2e auth flows) |
| **Config file** | `vitest.config.ts` / `playwright.config.ts` — Wave 0 installs |
| **Quick run command** | `npm run test` |
| **Full suite command** | `npm run test && npm run test:e2e` |
| **Estimated runtime** | ~30 seconds (unit) / ~60 seconds (e2e) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test`
- **After every plan wave:** Run `npm run test && npm run test:e2e`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | AUTH-01 | unit | `npm run test -- auth/signup` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | AUTH-01 | e2e | `npm run test:e2e -- signup` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | AUTH-02 | e2e | `npm run test:e2e -- signin` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | AUTH-03 | e2e | `npm run test:e2e -- password-reset` | ❌ W0 | ⬜ pending |
| 1-01-05 | 01 | 1 | AUTH-04 | e2e | `npm run test:e2e -- oauth` | ❌ W0 | ⬜ pending |
| 1-01-06 | 01 | 2 | AUTH-05 | e2e | `npm run test:e2e -- 2fa` | ❌ W0 | ⬜ pending |
| 1-01-07 | 01 | 2 | AUTH-06 | unit | `npm run test -- auth/backup-codes` | ❌ W0 | ⬜ pending |
| 1-01-08 | 01 | 2 | SEC-01 | unit | `npm run test -- security/owasp` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/auth/signup.test.ts` — stubs for AUTH-01 (email/password signup validation)
- [ ] `tests/auth/signin.test.ts` — stubs for AUTH-02 (session persistence)
- [ ] `tests/auth/password-reset.test.ts` — stubs for AUTH-03 (reset flow)
- [ ] `tests/auth/backup-codes.test.ts` — stubs for AUTH-06 (backup code generation + validation)
- [ ] `tests/security/owasp.test.ts` — stubs for SEC-01 (rate limiting, secure headers, input validation)
- [ ] `tests/setup.ts` — shared fixtures (Supabase test client, mock users)
- [ ] `e2e/auth/` — Playwright stubs for e2e auth flows
- [ ] `npm install -D vitest @vitest/coverage-v8 playwright @playwright/test` — framework install

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Email verification email delivered to inbox | AUTH-01 | Requires real email delivery (Supabase SMTP) | Sign up → check inbox → click link → verify activated |
| Google OAuth full redirect flow | AUTH-04 | OAuth provider redirect can't be fully mocked | Test in browser with real Google account |
| GitHub OAuth full redirect flow | AUTH-04 | OAuth provider redirect can't be fully mocked | Test in browser with real GitHub account |
| 2FA TOTP code from authenticator app | AUTH-05 | Requires real TOTP app (Google Authenticator, Authy) | Enable 2FA → scan QR → enter live code → verify |
| CSS grain texture renders on dark background | UI | Visual check only | Load app → inspect backgrounds for grain texture |
| Onboarding 3-step flow completion | AUTH-01 | Multi-step UX flow | Sign up → complete all 3 onboarding steps → verify redirect to feed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
