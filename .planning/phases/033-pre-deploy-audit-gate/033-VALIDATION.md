---
phase: 33
slug: pre-deploy-audit-gate
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-21
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `033-RESEARCH.md` §Validation Architecture.

Phase 33 is unusual: **the validation architecture IS the phase's deliverable.** Each DEP-AUD-* requirement is itself a verification step producing committed evidence.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 (unit/integration) + Playwright 1.58.2 (E2E) + Biome 2.4.8 (lint) + tsc 5.x (typecheck) |
| **Config file** | `apps/web/vitest.config.ts`, `apps/web/playwright.config.ts`, `biome.json` at repo root |
| **Quick run command** | `pnpm --filter @digswap/web test` |
| **Full suite command** | `pnpm --filter @digswap/web typecheck && pnpm --filter @digswap/web lint && pnpm --filter @digswap/web test && pnpm --filter @digswap/web build && pnpm audit --prod --audit-level high` |
| **Estimated runtime** | ~180 seconds (quick ~15s; full suite ~3min) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @digswap/web test` (Nyquist fine-grain check)
- **After every plan wave:** Run `pnpm --filter @digswap/web typecheck && lint && test && build` (~3min — no regression gate)
- **Before `/gsd:verify-work`:** Full suite must be green AND `grep -c '| TBD |' AUDIT-REPORT.md` must return 0
- **Phase exit criterion:** `AUDIT-REPORT.md` shows 8 checked boxes; all 8 evidence files under `evidence/` exist; gitleaks JSON has empty finding array
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

> Task IDs finalized by planner; this table lists the requirement → observable → evidence shape used by every task.

| Req ID | Behavior | Test Type | Automated Command | Evidence File | File Exists |
|--------|----------|-----------|-------------------|---------------|-------------|
| DEP-AUD-01 | 4 CI gates + prod audit pass against main | unit + integration + shell | `pnpm --filter @digswap/web typecheck && lint && test && build && pnpm audit --prod --audit-level high` | `evidence/01*-*.txt` | ✅ infra exists |
| DEP-AUD-02 | `supabase db reset` applies all migrations end-to-end | integration (shell + Supabase CLI) | `pnpm dlx supabase db reset` (local) + `pnpm dlx supabase db reset --linked` (throwaway cloud) | `evidence/02a-*.txt`, `evidence/02b-*.txt` | ❌ W0+W1b |
| DEP-AUD-03 | Public routes return 200 in <3s after 15-min idle | smoke (shell + curl) | Multi-route curl loop (§Audit 3 of RESEARCH.md) | `evidence/03-*.txt` | ❌ W2 |
| DEP-AUD-04 | Logged-out JWT → 401 within 60s | E2E (Playwright) | `pnpm --filter @digswap/web exec playwright test audit/session-revocation.audit.spec.ts` | `evidence/04-*.txt` + test file | ❌ W2 (new test) |
| DEP-AUD-05 | Discogs tokens NOT in plaintext; Vault-wrapped only | SQL probe | psql queries against `public.discogs_tokens` + `vault.decrypted_secrets` | `evidence/05*-*.txt` | ❌ W3 |
| DEP-AUD-06 | CSP header present + zero violations on 5 routes | smoke (shell + DevTools) | curl for header + manual browser walk | `evidence/06*-*` | ❌ W3 |
| DEP-AUD-07 | Zero secrets in git history | git scan (Docker gitleaks) | `docker run --rm -v "$(pwd):/repo" ghcr.io/gitleaks/gitleaks:latest git --config /repo/.gitleaks.toml --log-opts="--all --full-history" --report-format json --report-path /repo/.planning/phases/033-pre-deploy-audit-gate/evidence/07-gitleaks.json` | `evidence/07-*.json` + `.gitleaks.toml` | ❌ W0 config; W3 scan |
| DEP-AUD-08 | Env inventory has zero TBD rows | doc review | `grep -c '\| TBD \|' AUDIT-REPORT.md` | `evidence/08*-*.txt` + §8 table | ❌ W4 |

*Status tracked per task by planner in PLAN.md: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Files that MUST exist before later waves run:

- [ ] `.gitleaks.toml` — 7 scoped rules + project-aware allowlist (template in RESEARCH.md §Audit 7)
- [ ] `scripts/drizzle-prod-guard.mjs` — DATABASE_URL prod-ref detection + abort (full source in RESEARCH.md §Wave 0)
- [ ] `.planning/ADR-003-drizzle-dev-only.md` — formalizes D-01..D-05 (template in RESEARCH.md §ADR-003)
- [ ] `package.json` scripts wired — `predb:push` and `predb:migrate` call the guard script
- [ ] `apps/web/tests/e2e/audit/session-revocation.audit.spec.ts` — new Playwright E2E spec (scaffolded W0, executed W2)
- [ ] `.planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md` — skeleton scaffolded W0, populated W1–W4
- [ ] `.planning/phases/033-pre-deploy-audit-gate/evidence/.gitignore` — excludes any sample token files (05c, 05d)
- [ ] `drizzle/0002_showcase_cards.sql` — DELETED (orphan per D-03)

*Framework install step: none — all tooling via existing `apps/web/devDependencies`, `pnpm dlx`, or `docker run`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSP violation inspection across 5 routes | DEP-AUD-06 | Browser DevTools console is the authoritative source for CSP reports; no headless tool matches the real-user signal for inline-script / unsafe-eval issues. | Open `/`, `/signin`, `/signup`, `/pricing`, `/perfil` in Chrome DevTools → Console. Record "zero violations" with a screenshot per route stored in `evidence/06b-*.png`. |
| 15-minute idle period before cold-start curl | DEP-AUD-03 | Idle timer cannot be automated without replicating Vercel's serverless lifecycle locally (out of scope per D-09). | Start `pnpm start`, note timestamp, wait 15 min (set a timer), then run the curl loop. Record start time + curl timestamp in evidence header. |
| Docker Desktop pre-flight | Wave 0 gate | Tool availability check before Audit 2a / Audit 7 can run. | Run `docker info` — must exit 0 with an OK daemon response. Halt wave if Docker is not running. |
| Throwaway Supabase project teardown confirmation | DEP-AUD-02 (D-06) | Billing/cleanup safety — user must visually confirm project deletion in the Supabase dashboard. | After `supabase projects delete <ref>`, visit dashboard → Projects list → confirm the throwaway ref is gone. Screenshot to `evidence/02b-teardown.png`. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify command OR Wave 0 dependency listed above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (8 Wave 0 files/deletes)
- [ ] No watch-mode flags (Vitest `--run`, Playwright non-UI mode mandatory)
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter once planner confirms every task has a verify or W0 dep

**Approval:** pending
