---
phase: 035-vercel-environment-wiring
plan: 01
subsystem: infra
tags: [playwright, hsts, vercel-cli, scaffolding]

requires:
  - phase: 034-supabase-production-setup
    provides: Phase 34 SUMMARY + path-deviation patterns to inherit

provides:
  - Playwright config supports remote *.vercel.app target via PLAYWRIGHT_BASE_URL override (D-17 prerequisite)
  - HSTS reduced to launch-window value `max-age=300` in next.config.ts (DEP-VCL-09 prep)
  - evidence/ directory scaffolded for Phase 35 artifacts (paralleling Phase 34)
  - $HOME/.vercel-token populated (60-char ASCII, no BOM) — VERCEL_TOKEN env var enables CLI auth without device-code prompt (D-20 mitigation verified)

affects: [035-02-vercel-project-create, 035-03-env-vars-prod, 035-04-env-vars-preview, 035-05-deploy-verify, 035-06-playwright-summary]

tech-stack:
  added: []
  patterns:
    - "PLAYWRIGHT_BASE_URL conditional webServer pattern — local dev unchanged, remote target skips dev server auto-start"
    - "VERCEL_TOKEN sourced from $HOME/.vercel-token (printf %s, no BOM, no newline) — bypasses device-code prompt in Bash sandbox"

key-files:
  created:
    - .planning/phases/035-vercel-environment-wiring/evidence/.gitkeep
    - .planning/phases/035-vercel-environment-wiring/evidence/00-path-deviation.md
    - $HOME/.vercel-token (user-owned, 60 bytes, gitignored by location)
  modified:
    - apps/web/playwright.config.ts (PLAYWRIGHT_BASE_URL override + conditional webServer)
    - apps/web/next.config.ts (HSTS max-age=300, removed includeSubDomains + preload)

key-decisions:
  - "HSTS at launch window: max-age=300 only, NO includeSubDomains, NO preload (per D-18 + RESEARCH §7 rationale)"
  - "Playwright config preserves local dev workflow when PLAYWRIGHT_BASE_URL unset (zero behavior change for non-Phase-35 work)"
  - "Vercel token leaked in screenshot during user setup — user explicitly accepted risk, deferred rotation to post-Phase-35 (token is team-scoped, 30-day expiry, low blast radius)"

patterns-established:
  - "Token-leak handling: when credentials accidentally appear in screenshots/chat, document the leak + create a rotation TODO with specific revoke URL + accept the trade-off in writing (not silently)"
  - "ASCII-encoding-via-printf pattern for Windows token files: avoids PowerShell 5.1 UTF-16 BOM default that breaks Unix-tool readers"

requirements-completed: [DEP-VCL-09]

duration: ~10min (4 file edits + checkpoint + token leak handling)
completed: 2026-04-26
---

# Phase 35 Plan 01: Wave 0 Scaffolding + Config Edits

**Playwright config now accepts remote `*.vercel.app` targets via `PLAYWRIGHT_BASE_URL`, HSTS reduced to launch-window `max-age=300`, evidence/ directory scaffolded for Phase 35 artifacts, and `$HOME/.vercel-token` populated as ASCII (no BOM) so `VERCEL_TOKEN` env var enables CLI auth without device-code prompts in subsequent Bash calls.**

## Performance

- **Duration:** ~10 min (would have been ~3min without the token-leak detour)
- **Tasks:** 4 (3 auto + 1 user-checkpoint)
- **Files modified:** 4 (2 source edits + 2 evidence scaffolds)

## Accomplishments

- `apps/web/playwright.config.ts` rewritten: `PLAYWRIGHT_BASE_URL` env override + conditional `webServer` block (skips dev-server auto-start when target starts with `https://`)
- `apps/web/next.config.ts:11` HSTS reduced from `max-age=63072000; includeSubDomains; preload` → `max-age=300` (launch window value per DEP-VCL-09 + D-18)
- `.planning/phases/035-vercel-environment-wiring/evidence/.gitkeep` + `00-path-deviation.md` (2591 bytes) — paralleling Phase 34 structure
- `$HOME/.vercel-token` populated via `printf '%s' 'vcp_...' > ~/.vercel-token` (60 bytes, ASCII, no BOM, no newline). Verified: `VERCEL_TOKEN=$(cat ~/.vercel-token); vercel whoami` returns `thiagobraidatto-3732` with NO device-code prompt — D-20 mitigation works

## Task Commits

1. **Tasks 1+2+3 (config edits + evidence scaffold)** — `ecf8d77` (feat(035-01): Wave 0 scaffolding — playwright BASE_URL override + HSTS=300 + evidence/ scaffolding)
2. **Task 4 (user checkpoint)** — no commit (file lives at `$HOME/.vercel-token`, NOT in repo)

**Plan summary commit:** TBD (this file)

## Files Created/Modified

- `apps/web/playwright.config.ts` — drop-in replacement (54 lines vs original 39): adds `BASE_URL` constant, `isRemote` flag, conditional `webServer` spread
- `apps/web/next.config.ts` — single-line edit on line 11 (HSTS value), removes `includeSubDomains` + `preload` keywords
- `.planning/phases/035-vercel-environment-wiring/evidence/.gitkeep` — empty (directory marker)
- `.planning/phases/035-vercel-environment-wiring/evidence/00-path-deviation.md` — MCP-first/CLI-for-writes pattern doc, D-05 secret-isolation deviation acknowledgement, VERCEL_TOKEN strategy explanation

## Decisions Made

- **HSTS without `includeSubDomains` and `preload`:** per RESEARCH §7, the launch-window value must give an escape hatch if SSL breaks during Phase 36 cutover. `includeSubDomains` would propagate to `*.digswap.com.br` subdomains that don't exist with valid certs yet. `preload` is permanent (6-12 weeks to remove from Chrome HSTS preload list). Both restored after Phase 38 + 1-week soak per D-18.
- **Vercel token leak accepted, rotation deferred:** during Task 4 setup, user pasted token via screenshot which leaked the value. User explicitly accepted the trade-off (low blast radius: team-scoped, 30-day expiry, no billing access) and deferred rotation to post-Phase-35. POST-PHASE-35 TODO recorded.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule: PowerShell 5.1 UTF-16 BOM default] User initially saved token via `echo "..." > ~/.vercel-token` which wrote UTF-16 LE with BOM**
- **Found during:** Task 4 verification (Bash `xxd -l 4` showed `fffe 7600` = UTF-16 LE BOM + "v" with null byte = UTF-16 encoding)
- **Issue:** Vercel CLI reading `VERCEL_TOKEN` env var sourced from a UTF-16 BOM file would receive garbage characters; auth would fail.
- **Fix:** Deleted bad file. User re-pasted token in chat (already exposed via screenshot). I wrote via `printf '%s' 'TOKEN' > ~/.vercel-token` from Bash — produces 60-byte ASCII, no BOM, no newline.
- **Files modified:** `~/.vercel-token` (deleted + recreated)
- **Verification:** `xxd -l 4` shows `7663 705f` = ASCII "vcp_". `vercel whoami` succeeds without device-code prompt.
- **Committed in:** No commit (file is user-owned at `$HOME`, NOT tracked in git)

**2. [Rule: token leak handling] Token value visible in user-provided screenshot**
- **Found during:** Task 4 user check-in (user shared PowerShell screenshot showing the token literal)
- **Issue:** Token now in: (a) my AI context, (b) Anthropic image processing pipeline, (c) PowerShell history file (`PSReadLine`)
- **Fix:** User accepted risk + deferred rotation. POST-PHASE-35 TODO created. Token will be rotated when Phase 35 closes (within 30 days expiry anyway).
- **Files modified:** `.planning/phases/035-vercel-environment-wiring/evidence/00-path-deviation.md` (D-05 secret-isolation block already existed; this incident is a real-world example of the pattern's accepted risks)
- **Verification:** Documented in this SUMMARY + TodoWrite tracking

---

**Total deviations:** 2 (1 encoding fix, 1 leak acceptance — both with explicit user consent)
**Impact on plan:** None — Plan 01 acceptance criteria all met. Subsequent plans (02-06) can rely on `VERCEL_TOKEN` from `~/.vercel-token` without re-auth concerns.

## Issues Encountered

- **Windows PowerShell 5.1 silent BOM bug:** caught at Task 4 verification before any subsequent Bash call would have failed mysteriously. Saved hours of debugging downstream. Pattern documented for future Windows users.

## User Setup Required

None for next plans. Plans 02-06 read `VERCEL_TOKEN` from `~/.vercel-token` automatically.

## Next Phase Readiness

- **Plan 02 unblocked:** can run `vercel project add` + `vercel link --repo` with `VERCEL_TOKEN` env var. Zero device-code prompts expected.
- **Plan 06 (Playwright) unblocked:** `apps/web/playwright.config.ts` accepts `PLAYWRIGHT_BASE_URL` override.
- **Plan 05 (HSTS verify) unblocked:** `apps/web/next.config.ts` will emit `max-age=300` on first deploy.

---
*Phase: 035-vercel-environment-wiring*
*Completed: 2026-04-26*
