# Phase 33: Pre-Deploy Audit Gate - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Independent verification that commit `35ed595`'s "all pre-deploy blockers fixed" claim actually holds end-to-end. Phase 33 runs 8 checks (DEP-AUD-01 through DEP-AUD-08), documents evidence, and fixes anything that fails inline. **Zero new product code.** Goal: a clean baseline that makes Phase 34 (Supabase prod setup) safe to start.

What IS in scope:
- Running CI gates and audits against `main`
- Testing `supabase db reset` on a fresh DB
- Proving the cold-start code path locally
- Verifying session revocation, Vault-wrapped Discogs tokens, CSP state
- Scanning git history for committed secrets
- Building the env var inventory
- Resolving the `drizzle/` vs `supabase/migrations/` drift (SYSTEMIC #0)

What is NOT in scope:
- Creating any prod Supabase/Vercel/external account (that's Phases 34+)
- Real cold-start validation on Vercel (that's Phase 38, DEP-UAT-03)
- Stripe Live activation (lives in Phase 37, but operational note: **user must initiate Stripe Live sign-up on Day 1 of v1.4 due to 1-3 business-day SLA** — parallel external dependency, not Phase 33 work)
- Any DNS or domain work

</domain>

<decisions>
## Implementation Decisions

### Drift `drizzle/` vs `supabase/migrations/` (SYSTEMIC #0 from 2026-04-03 audit)

- **D-01:** `supabase/migrations/` is the **sole authoritative trail** for prod. Prod migrations apply exclusively via `supabase db push` or equivalent CLI — never `drizzle-kit push`, never `drizzle-kit migrate`.
- **D-02:** `drizzle/` is kept in repo for **development use only** — schema authoring via TypeScript + type generation (`drizzle-kit generate`). It produces SQL snapshots that are NOT applied to prod automatically.
- **D-03:** Delete the orphan file `drizzle/0002_showcase_cards.sql` (present in `drizzle/` but not in `drizzle/meta/_journal.json` — confirmed during research).
- **D-04:** Add a hard block so `drizzle-kit push` cannot target prod. Implementation: `package.json` script wrapper that errors when `DATABASE_URL` points at the prod Supabase host (detect via project ref pattern), plus docs in `CONTRIBUTING.md` or equivalent.
- **D-05:** Write a short ADR (`.planning/ADR-003-drizzle-dev-only.md`) capturing the decision and rationale — permanent reference for future contributors.

### `supabase db reset` test environment (DEP-AUD-02)

- **D-06:** Run `supabase db reset` on **both** environments for maximum confidence on first deploy:
  1. **Local Supabase via Docker** — quick check, matches solo-dev workflow, reveals any local-tooling-specific issues
  2. **Throwaway hosted Supabase Cloud project** — 1:1 with prod environment (all extensions, pg_cron behavior, RLS under real auth context). Free tier; provisioned, tested, deleted within the phase.
- **D-07:** The hosted throwaway project is the "blocker" — if it fails, Phase 34 cannot start. Local is a fast-feedback step before the cloud test.

### Cold-start verification (DEP-AUD-03)

- **D-08:** Phase 33 does **local proof only** — `pnpm build && pnpm --filter @digswap/web start`, let server idle 15 min, then `curl -I http://localhost:3000/`, `/signin`, `/signup`, `/pricing`. Pass criterion: all return 200, no server-side exceptions in logs.
- **D-09:** **Real cold-start validation (Vercel serverless) is explicitly deferred to Phase 38** (DEP-UAT-03). Phase 33 cannot fully verify cold-start because Vercel doesn't exist yet in v1.4's sequence.
- **D-10:** If the local proof surfaces any crash on public routes, **fix inline** in Phase 33 before progressing to Phase 34 (per D-16 failing-gate rule).

### Evidence artifact (DEP-AUD-01 through DEP-AUD-08)

- **D-11:** Single committed artifact: `.planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md`. Structure: checkbox per requirement + evidence block (command run, output excerpt or screenshot link, timestamp, pass/fail verdict).
- **D-12:** For CI gate evidence (DEP-AUD-01), paste output of `pnpm --filter @digswap/web typecheck`, `build`, `lint`, `test` + `pnpm audit --prod --audit-level high` directly in the report.
- **D-13:** For session revocation E2E (DEP-AUD-04), capture curl output showing `200` before logout + `401` within 60s after logout with same bearer.
- **D-14:** For git history scan (DEP-AUD-07), use **gitleaks** (standard, maintained, docker-runnable) — output its JSON report with zero findings.
- **D-15:** For env inventory (DEP-AUD-08), generate a table in AUDIT-REPORT.md mapping every var in `.env.local.example` to its prod value source (Supabase dashboard / Stripe dashboard / `openssl rand -hex 32` / Upstash / Resend / Sentry / Discogs prod app) — zero `TBD` rows before exit.

### Failing-gate handling

- **D-16:** If any of the 8 checks fails, **fix inline** in Phase 33 scope. Phase stays open until all 8 pass or a fix is explicitly deemed too large (>2h of work) — only then open a decimal phase (33.1, 33.2, etc.) to isolate it.
- **D-17:** No partial promotions — Phase 34 does not start until AUDIT-REPORT.md shows all 8 checks green.

### Claude's Discretion

- Exact shell command syntax for reset tests, build commands, and curl payloads
- Format/style of AUDIT-REPORT.md sections beyond the checkbox + evidence skeleton
- ADR-003 wording and structure
- Whether to use a Makefile/justfile target or just shell scripts for the audit flow
- How to phrase the `package.json` drizzle-kit block (error message, detection logic)
- CSP verification approach for DEP-AUD-06 (likely just confirm existing memory note + a smoke test of DevTools console on localhost, unless something regressed)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### Project-level specs and decisions
- `.planning/PROJECT.md` — Core value, constraints, solo-dev posture
- `.planning/REQUIREMENTS.md` — The 8 DEP-AUD-* requirements this phase satisfies
- `.planning/ROADMAP.md` §Phase 33 — Goal, success criteria, P0 pitfalls
- `.planning/STATE.md` — Blockers list including "Stripe Live activation must start Day 1"

### Research outputs (read in full)
- `.planning/research/SUMMARY.md` — Milestone synthesis, Phase 33 rationale ("verification gate, not rubber stamp")
- `.planning/research/STACK.md` — Deploy-layer versions, 13-item REQUIRED checklist
- `.planning/research/FEATURES.md` — Deploy workflow shape, pre-deploy audit category table stakes
- `.planning/research/ARCHITECTURE.md` — Migration pipeline decision (`supabase/migrations/` is authoritative)
- `.planning/research/PITFALLS.md` — 11 P0 pitfalls, especially #1, #2, #3, #8, #10, #11

### Prior audits
- `.planning/quick/260406-aud-deploy-readiness-audit/260406-aud-SUMMARY.md` — Original 10+ blocker audit (2026-04-06)
- `.planning/quick/260406-aud-deploy-readiness-audit/260406-aud-PLAN.md` — Per-blocker fix plan

### User memory (outside repo, reference only)
- `~/.claude/projects/C--Users-INTEL-Desktop-Get-Shit-DOne/memory/project_security_posture.md` — 74-vuln audit results, SYSTEMIC #0 documented, "CSP nonce-based — fixed" note

### Code entry points for the audit checks
- `apps/web/package.json` — scripts for typecheck, build, test, lint
- `apps/web/.env.local.example` — 21 vars for DEP-AUD-08 inventory
- `apps/web/src/middleware.ts` — cold-start code path (DEP-AUD-03)
- `apps/web/src/lib/supabase/middleware.ts` — `getClaims`/`getUser` usage (cold-start root cause)
- `apps/web/src/app/api/health/route.ts` — health endpoint (exists; reuse for /api/health check in Phase 38)
- `apps/web/src/app/api/auth/callback/route.ts` — discogs OAuth token handling (Vault check, DEP-AUD-05)
- `drizzle/meta/_journal.json` vs `drizzle/` dir listing — to identify orphan file for D-03
- `supabase/migrations/` (28 files) — the authoritative trail to reset

### Referenced but not mandatory
- `.planning/ADR-001-strategic-direction.md` — prior ADR pattern for ADR-003 format
- `.planning/ADR-002-desktop-trade-runtime.md` — same

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`/api/health` endpoint already exists** (`apps/web/src/app/api/health/route.ts`) — Phase 33 just smokes it locally; Phase 38 owns the real DB/Redis/Discogs probe verification. No new endpoint needed.
- **Nonce-based CSP** (`apps/web/src/lib/security/csp.ts`, used in `apps/web/src/middleware.ts`) — per user memory, the unsafe-inline issue was resolved in Phase 11. DEP-AUD-06 is primarily a **re-confirmation** task, not a fix task.
- **Security test suite** (179+ tests per prior audit) — passing suite is part of DEP-AUD-01's test gate, provides coverage for session revocation and RLS scenarios.
- **CI workflow** (`.github/workflows/ci.yml`) — already runs typecheck/lint/test/build/e2e on main. DEP-AUD-01 confirms the gates are green, doesn't re-invent them.

### Established Patterns

- **Evidence/audit docs live under `.planning/quick/` or `.planning/phases/`** — format precedent is set by the 2026-04-06 audit SUMMARY.md. Phase 33's AUDIT-REPORT.md follows the same shape.
- **ADRs live at `.planning/ADR-NNN-slug.md`** — two exist (001, 002). ADR-003 for drizzle dev-only policy fits naturally.
- **Commits use `docs(NN):` and `fix(area):` conventional format** — phase 33 commits follow this, e.g. `fix(audit): remove orphan drizzle/0002_showcase_cards.sql`.

### Integration Points

- **`package.json` scripts** — the drizzle-kit block (D-04) wires into the existing scripts block; no new tooling.
- **Supabase CLI** — already in devDependencies; Phase 33 uses `supabase db reset`, `supabase link`, `supabase migration list` commands. No install step.
- **Docker Desktop** — local Supabase reset (D-06 part 1) requires Docker running on the dev machine. User runs Windows — confirm Docker Desktop available before executing.

### Creative Options Enabled

- The `AUDIT-REPORT.md` artifact (D-11) doubles as a **"what does v1.4 Phase 33 actually prove?"** document that future milestones can reference. If v1.5 opens, the v1.4 audit report becomes the starting baseline for a new audit.
- The `gitleaks` scan (D-14) can be wired into CI as a periodic job post-v1.4 — zero-effort addition once Phase 33 proves it useful.

</code_context>

<specifics>
## Specific Ideas

- User referenced being **new to deploy** and wanted maximum confidence — that's why D-06 runs `supabase db reset` on BOTH local and a throwaway cloud project instead of picking one.
- User delegated the drift-resolution choice to Claude ("não sei, decide você") — Claude picked the dev-only-pin approach (D-01 through D-05) to preserve TypeScript-authored schema DX without prod risk.
- User picked "maximum confidence" over speed on test env (D-06) and "ordered progression" over parallelism on cold-start (D-08/D-09) — signals consistency: slow and sure beats fast and risky for first deploy.

</specifics>

<deferred>
## Deferred Ideas

- **Wire gitleaks into CI as a recurring job** — Phase 33 runs it once. Adding it to `.github/workflows/ci.yml` is a ~5-line change that can ride with Phase 39 (Monitoring) or a post-v1.4 chore.
- **Automated env inventory drift detection** — after v1.4 ships, add a script that compares Vercel env vars to `.env.local.example` and flags drift. Future enhancement, not v1.4 scope.
- **`supabase db reset` in CI** — running the reset test on every PR would catch migration regressions immediately. Requires a CI-scoped throwaway project; defer to post-launch when budget allows.
- **ADR for `NEXT_PUBLIC_` prefix hygiene** — Phase 35 handles the scan mechanically, but a durable ADR capturing the rule ("only these 7 vars carry the prefix, ever") would prevent future leaks. Defer to post-v1.4 chore.

</deferred>

---

*Phase: 033-pre-deploy-audit-gate*
*Context gathered: 2026-04-21*
