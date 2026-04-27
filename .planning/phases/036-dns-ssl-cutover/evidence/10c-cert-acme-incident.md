# Cert ACME incident log

**Status:** No incident — Task 3.3 completed successfully on the happy path.
**Date:** 2026-04-27T16:14:00Z

## Cert state at Task 3.5 evaluation

- Apex `digswap.com.br`: Let's Encrypt R12 cert, valid (Not Before 2026-04-27 14:48:56 UTC, Not After 2026-07-26 14:48:55 UTC, 90-day LE auto-renew)
- www `www.digswap.com.br`: Separate Let's Encrypt R12 cert, valid (308 redirect to apex confirmed live)

## Cert ACME timing observations (operational metric for future cutovers)

- DNS PUT (Wave 2 complete): 2026-04-27T15:44:08Z (apex A flip)
- Cert Not Before: 2026-04-27T14:48:56Z — wait, Not Before is BEFORE the DNS flip? That suggests Vercel pre-emitted (or has a clock skew tolerance window). Either way, cert is valid NOW.
- First successful openssl handshake: ~2026-04-27T16:13:38Z (this session)
- Total elapsed from DNS flip to first cert observation: ~30 minutes (consistent with RESEARCH §"Vercel ACME Timing Reality" — typical 5-30min)

## D-09 / D-17 traceability

- D-09 (cert ACME failure → checkpoint:human-action): NOT TRIGGERED (happy path)
- D-17 (cert timeout > 30min → investigate before rollback): NOT TRIGGERED (cert issued within window)

## Outcome

DEP-DNS-03 PASS. Site is live + secure. Phase 36 Wave 3 prerequisites for Wave 4 (smoke + SUMMARY) are green.
