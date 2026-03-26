---
status: partial
phase: 06-discovery-notifications
source: [06-VERIFICATION.md]
started: 2026-03-26T05:27:23Z
updated: 2026-03-26T05:27:23Z
---

## Current Test

Human checkpoint approved 2026-03-26 — core features verified via dev server.
3 items require live external services (Resend + Supabase Realtime publication).

## Tests

### 1. Wantlist match email delivery (NOTF-02)
expected: When User B adds a record that User A has on wantlist, User A receives an email via Resend with record details and a link to their wantlist
result: [pending — requires RESEND_API_KEY and two test accounts]

### 2. Real-time notification bell delivery (NOTF-01 live)
expected: New notifications appear in NotificationBell dropdown without page refresh, via Supabase Realtime postgres_changes subscription
result: [pending — requires `ALTER PUBLICATION supabase_realtime ADD TABLE notifications;` in Supabase SQL Editor]

### 3. NOTF-02 partial scope acceptance (trade request email deferred)
expected: Confirm that NOTF-02 (email notifications) is acceptable at Phase 6 with only wantlist_match emails implemented. Trade request email is deferred to Phase 9 per locked decision D-11.
result: [pending — policy decision]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
