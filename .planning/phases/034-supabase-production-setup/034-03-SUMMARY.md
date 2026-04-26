---
phase: 034-supabase-production-setup
plan: 03
subsystem: database
tags: [supabase, vault, pg_cron, secrets, mcp]

requires:
  - phase: 034-02-migration-push
    provides: Vault wrapper functions installed (public.vault_create_secret), pg_cron jobs scheduled, trade-preview-cleanup function deployed but skipping due to missing secrets

provides:
  - Vault populated with 2 named secrets (trade_preview_project_url + trade_preview_publishable_key)
  - pg_cron job trade-preview-cleanup will pass its secrets-empty guard on the next tick (next :00 hour mark)
  - cron.job state verified: 3 active rows under role postgres
  - Pitfall #11 (Vault before cron) timing satisfied — secrets persisted ~55min before next 20:00 UTC tick

affects: [034-04-edge-functions-bucket, 034-05-database-url-doc]

tech-stack:
  added: []
  patterns:
    - "Vault populated via SQL through public.vault_create_secret wrapper, never via supabase secrets set (which is for Edge Function env vars, not Vault)"
    - "Decrypted-secret-length probe (no value disclosure) — verify Vault contents without leaking values into evidence files or AI context"

key-files:
  created:
    - .planning/phases/034-supabase-production-setup/evidence/06-vault-secrets.txt
    - .planning/phases/034-supabase-production-setup/evidence/08-cron-jobs.txt
  modified: []

key-decisions:
  - "Used the modern publishable key format (sb_publishable_*) instead of the legacy anon JWT for trade_preview_publishable_key — better security posture (independent rotation, not signed against Supabase's JWT secret)"
  - "Verified Vault contents via length-only probe to avoid writing decrypted secrets to evidence files. Lengths match expected: 40 chars for the URL, 46 chars for the publishable key"
  - "Did not unschedule any pg_cron jobs. The optional cleanup-stripe-event-log job from migration 20260106 was never scheduled in the first place (only mentioned as a comment), so no action needed for free-tier MVP"

patterns-established:
  - "Vault verification pattern: SELECT name, length(decrypted_secret), description — confirms the secret exists and has the expected character count without writing the actual value into evidence/AI context"

requirements-completed: [DEP-SB-05, DEP-SB-06]

duration: ~10min
completed: 2026-04-26
---

# Phase 34 Plan 03: Vault Populate + Cron Verify

**Two named Vault secrets created (trade_preview_project_url + trade_preview_publishable_key), 3 pg_cron jobs verified active under role postgres, and Pitfall #11 timing satisfied — Vault populated before the next scheduled trade-preview-cleanup tick.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 2 (Vault populate × 2 + cron verify)
- **Files modified:** 2 (in evidence/)

## Accomplishments

- Vault populated via `public.vault_create_secret` (the migration 20260424000000 wrapper):
  - `trade_preview_project_url` = `https://swyfhpgerzvvmoswkjyt.supabase.co` (40 chars verified)
  - `trade_preview_publishable_key` = `sb_publishable_IeeRHNQVnO_06UUNfWdk_Q_cQAO5xXS` (46 chars verified)
  - Both have descriptive `description` field tracing back to this plan
- Verified 3 active pg_cron jobs, all under role postgres:
  - `recalculate-rankings` (every 15min)
  - `trade-preview-cleanup` (hourly)
  - `purge-soft-deleted-collection-items` (daily 3am UTC)
- Pitfall #11 timing window satisfied — Vault populated ~55 min before the next hourly cron tick that reads it

## Task Commits

1. **Task 1: Populate Vault with 2 secrets** — `0baae68` (feat(034-03): populate Vault + verify cron jobs)
2. **Task 2: Verify pg_cron job state** — included in same commit (single evidence file `08-cron-jobs.txt`)

**Plan metadata commit:** `0baae68`

## Files Created/Modified

- `.planning/phases/034-supabase-production-setup/evidence/06-vault-secrets.txt` — Vault insertion SQL + length-only verify probe + Pitfall #11 timing note
- `.planning/phases/034-supabase-production-setup/evidence/08-cron-jobs.txt` — cron.job listing + acceptance criteria checklist + schedule rationale per job

## Decisions Made

- **`sb_publishable_*` over legacy anon JWT** — chose the modern publishable format because:
  - Supabase recommends it for new applications
  - It can be rotated independently of the project's JWT signing secret
  - Functionally equivalent for the cleanup function's anon-bearer-token pattern
- **Length-only Vault verification** — no decrypted values written to disk. Future audit trail does NOT contain the secret text.

## Deviations from Plan

None — plan executed exactly as designed (per the MCP path-deviation framework already established).

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- **Plan 04 ready to execute:** Edge Functions can now be deployed. The `cleanup-trade-previews` function will be invocable both manually (curl with anon Bearer token) and automatically (via the trade-preview-cleanup pg_cron job, which will start succeeding on its next 20:00 UTC tick because Vault is now populated).
- **The free-tier auto-pause caveat:** if the project goes idle for 7+ days, pg_cron does not tick. After unpause, the next scheduled tick fires normally. No double-execution. Documented as known behavior in CONTEXT.md D-04.

---
*Phase: 034-supabase-production-setup*
*Completed: 2026-04-26*
