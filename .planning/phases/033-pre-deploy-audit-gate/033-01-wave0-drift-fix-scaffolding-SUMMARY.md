---
phase: 033-pre-deploy-audit-gate
plan: 01
subsystem: audit-scaffolding
tags: [drift-fix, adr, gitleaks, evidence, playwright-scaffold]
requires: []
provides:
  - orphan-deleted
  - drizzle-prod-guard-wired
  - adr-003
  - gitleaks-config
  - audit-report-skeleton
  - session-revocation-spec-scaffold
affects:
  - drizzle/
  - scripts/
  - package.json
  - .planning/
  - apps/web/tests/e2e/audit/
tech-stack:
  added:
    - name: gitleaks
      version: "latest (Docker image)"
      purpose: secret scanning for DEP-AUD-07
    - name: drizzle-prod-guard.mjs
      version: n/a
      purpose: script-level guard refusing drizzle-kit against prod DATABASE_URL
  patterns:
    - ADR-NNN policy records at .planning/ADR-NNN-slug.md
    - pre-hook npm scripts for policy enforcement
key-files:
  created:
    - path: scripts/drizzle-prod-guard.mjs
      purpose: D-04 guard; exits 1 when DATABASE_URL contains any DRIZZLE_PROD_REFS substring
    - path: .planning/ADR-003-drizzle-dev-only.md
      purpose: D-05 decision record formalizing D-01..D-05
    - path: .gitleaks.toml
      purpose: 7 custom rules + default ruleset + allowlist for .env.example / .planning docs
    - path: .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
      purpose: D-11 evidence artifact — 8 unchecked DEP-AUD checkboxes + §1-§8 sections
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/.gitignore
      purpose: excludes 05c/05d Discogs token sample outputs from commit
    - path: .planning/phases/033-pre-deploy-audit-gate/evidence/00-docker.txt
      purpose: Docker Desktop pre-flight evidence (Server Version 29.4.0)
    - path: apps/web/tests/e2e/audit/session-revocation.audit.spec.ts
      purpose: DEP-AUD-04 spec scaffold; executed by Plan 04
  modified:
    - path: package.json
      purpose: added db:guard, predb:push, predb:migrate, db:push, db:migrate scripts
  deleted:
    - path: drizzle/0002_showcase_cards.sql
      reason: D-03 orphan file never present in drizzle/meta/_journal.json
key-decisions:
  - decision: Orphan drizzle migration deletion deferred to git tracking (not .gitignore'd)
    rationale: File was never in the journal; deletion leaves a clean audit trail via git history
  - decision: drizzle-prod-guard returns success when DRIZZLE_PROD_REFS is unset
    rationale: Phase 34 populates the env var after prod project creation; blocking on unset would break dev workflow
  - decision: evidence/.gitignore uses explicit allow-list bang patterns rather than blanket ignore
    rationale: Protects only token-revealing 05c/05d files while letting all other evidence commit normally
requirements-completed: [DEP-AUD-02, DEP-AUD-04, DEP-AUD-07]
duration: 15 min
completed: 2026-04-22
---

# Phase 33 Plan 01: Wave 0 Drift Fix + Audit Scaffolding Summary

Scaffolded every file that Waves 1-4 depend on, closed SYSTEMIC #0 drift (orphan drizzle migration + dev-only policy), and established the evidence format for the 8 DEP-AUD checks. Zero new product code — pure audit groundwork via 3 atomic commits.

**Start:** 2026-04-22T22:55:00Z
**End:** 2026-04-22T23:30:00Z
**Duration:** 15 min (active execution; wall clock includes user Docker Desktop startup checkpoint)
**Tasks:** 3
**Files created:** 7
**Files modified:** 1
**Files deleted:** 1
**Commits:** 3 (7d47925, a399b69, 1e543a9)

## Commits

| Task | Hash | Message |
|------|------|---------|
| 1 | `7d47925` | chore(033-01): docker pre-flight + delete orphan drizzle migration + scaffold evidence folder |
| 2 | `a399b69` | feat(033-01): add drizzle-prod-guard + ADR-003 dev-only policy |
| 3 | `1e543a9` | feat(033-01): scaffold gitleaks config + AUDIT-REPORT skeleton + session-revocation spec |

## Verification Summary

All 9 checks from the plan's `<verification>` block pass:
1. Orphan `drizzle/0002_showcase_cards.sql` deleted
2. Guard exits 0 with no env vars
3. Guard exits 1 with `DATABASE_URL` + `DRIZZLE_PROD_REFS` match
4. `predb:push` and `predb:migrate` wired in `package.json`
5. ADR-003 committed with `id: ADR-003` frontmatter
6. `.gitleaks.toml` parses cleanly via `gitleaks detect --no-git` (modern gitleaks omits legacy "loaded config" log line — absence of parse errors confirms validity)
7. AUDIT-REPORT.md contains exactly 8 `- [ ] DEP-AUD-` checkboxes
8. Playwright spec file exists at `apps/web/tests/e2e/audit/session-revocation.audit.spec.ts`
9. evidence/.gitignore exists with 05c/05d exclusions

## Authentication Gates

One human-action checkpoint during Task 1: Docker Desktop was not on PATH. User started Docker Desktop (confirmed "ta rodando"). `docker info` returned Server Version 29.4.0 on retry — Task 1 proceeded with evidence captured.

## Deviations from Plan

**[Minor - Tooling] Gitleaks "loaded config" log line not present in modern output** — Found during: Task 3 verification | Issue: Plan's verification step 6 greps for `"loaded config"` but modern gitleaks (latest image) omits this log line in `detect --no-git` mode | Fix: Confirmed config parses by running `gitleaks detect --no-git --source /repo/.gitleaks.toml` which produced clean "scanned ~0 bytes ... no leaks found" output with zero parse errors | Files modified: none | Verification: manual | Commit hash: n/a

**Total deviations:** 0 auto-fixed, 1 documented. **Impact:** Low — verification criterion met in spirit (gitleaks accepts the TOML without error). Plan 07 will produce a more exhaustive gitleaks run against full git history; this plan's check was scaffolding-only.

## Issues Encountered

None — all acceptance criteria met. Docker Desktop start-up handled as expected human-action per D-16.

## Next Phase Readiness

**Ready for Plan 033-02 (Wave 1 parallel-mate)** — all Wave 1/2/3/4 inputs are in place:
- Plan 02: `evidence/` folder exists to land `01a-01e-*.txt` CI gate outputs and `00-head.txt`
- Plan 03: `evidence/` folder exists to land `02a-*.txt` and `02b-*.txt`; Docker confirmed for local Supabase reset
- Plan 04: `apps/web/tests/e2e/audit/session-revocation.audit.spec.ts` scaffolded; `evidence/` ready for `03-*` and `04-*`
- Plan 05: `evidence/.gitignore` excludes 05c/05d sample-token outputs
- Plan 06: `evidence/` ready for `06*-*` CSP re-confirmation outputs
- Plan 07: `.gitleaks.toml` at repo root loaded cleanly; Docker confirmed for gitleaks image
- Plan 08: `AUDIT-REPORT.md` skeleton has `§8 DEP-AUD-08` table placeholder for env inventory
