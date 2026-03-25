---
status: partial
phase: 01-foundation-authentication
source: [01-VERIFICATION.md]
started: 2026-03-25T00:00:00Z
updated: 2026-03-25T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Dark-warm theme visual rendering
expected: Dark background (#0D0B09), amber accents (#D4872C), grain texture overlay, Fraunces headings, DM Sans body text visible in browser
result: [pending]

### 2. Sign-up form inline validation
expected: Real-time validation feedback (weak password indicator, email format check), error messages appear without page reload
result: [pending]

### 3. Social login buttons + OAuth redirect
expected: Google and GitHub buttons present on /signin and /signup, clicking initiates OAuth redirect to provider
result: [pending]

### 4. TOTP 2FA enrollment with authenticator app
expected: QR code renders on 2FA setup screen, Google Authenticator/Authy can scan it, TOTP codes accepted for enrollment verification
result: [pending]

### 5. Backup code single-use login flow
expected: After enabling 2FA, backup codes can be used at /signin/2fa to authenticate, each code works only once
result: [pending]

### 6. Onboarding multi-step wizard with live session
expected: After signup + email verification, user lands on /onboarding, can complete all 3 steps (profile → security → discogs), step indicator advances correctly
result: [pending]

### 7. Session management page with multiple sessions
expected: /settings/sessions lists active sessions with device info, current session is badged, "Sign Out" terminates sessions
result: [pending]

### 8. Security headers confirmed at runtime
expected: `curl -I http://localhost:3000` returns Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options headers
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
