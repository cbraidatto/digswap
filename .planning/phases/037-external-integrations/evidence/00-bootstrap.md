# Phase 37 Wave 0 Task 0.1 — Bootstrap Evidence

**Date:** 2026-04-27
**Phase:** 037-external-integrations Plan 00 Task 0.1

## Actions taken

1. Created `evidence/` directory at `.planning/phases/037-external-integrations/evidence/`
2. Edited `apps/web/src/lib/env.ts`:
   - Added `NEXT_PUBLIC_BILLING_ENABLED: z.string().optional().default("false")` to `publicSchema` (after `NEXT_PUBLIC_MIN_DESKTOP_VERSION`)
   - Added `NEXT_PUBLIC_BILLING_ENABLED: process.env.NEXT_PUBLIC_BILLING_ENABLED` to `validatePublicEnv()` parse object
3. Edited `apps/web/.env.local.example`:
   - Added `NEXT_PUBLIC_BILLING_ENABLED=false` after Stripe Price IDs with comment explaining Wave 4 flip

## Verification

- `pnpm --filter @digswap/web typecheck` → exit 0 (clean)
- `pnpm --filter @digswap/web build` → exit 0 (build successful, 50+ routes prerendered + dynamic, middleware 142kB, shared 176kB)
- `grep -c 'NEXT_PUBLIC_BILLING_ENABLED' apps/web/src/lib/env.ts` → 2 (publicSchema + validatePublicEnv)
- `grep '^NEXT_PUBLIC_BILLING_ENABLED' apps/web/.env.local.example` → `NEXT_PUBLIC_BILLING_ENABLED=false`

## Decision rationale

Per CONTEXT D-14: feature flag defaults to `"false"` (string, not boolean — matches existing publicEnv string-only pattern); flips to `"true"` in Wave 4 atomic swap after Stripe Live activates. Consumers of `publicEnv.NEXT_PUBLIC_BILLING_ENABLED` should compare with `=== "true"` for the gate.

## Pre-existing bug noticed (Plan 03 owns fix)

`env.ts` line 22: `RESEND_FROM_EMAIL: z.string().optional().default("noreply@digswap.com")` — default is missing `.br`. Wave 3 Task 3.4 step 1 corrects this in Vercel Production scope (overrides default at runtime); the source-code default stays as-is until next coordinated cleanup phase.

## Wave 0 prerequisites status

- [x] `evidence/` directory created
- [x] `NEXT_PUBLIC_BILLING_ENABLED` Zod entry added (publicSchema + validatePublicEnv + .env.local.example)
- [x] typecheck + build pass
- [ ] `NEXT_PUBLIC_BILLING_ENABLED=false` in Vercel Production scope (Task 0.2)
- [ ] `~/.resend-token` with Resend API key (Task 0.3)
- [ ] `~/.supabase-token` with Supabase Management token (Task 0.4)
- [ ] User submitted Stripe Live activation form (Task 0.5)
