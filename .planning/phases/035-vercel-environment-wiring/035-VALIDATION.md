---
phase: 35
slug: vercel-environment-wiring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `.planning/phases/035-vercel-environment-wiring/035-RESEARCH.md` §14 "Validation Architecture (Nyquist Gate — MANDATORY)".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frameworks** | Playwright `^1.58.2` (E2E smoke) + Vitest `^4.1.2` (unit/integration optional) |
| **Config files** | `apps/web/playwright.config.ts` (NEEDS Wave 0 EDIT — currently hardcodes `localhost:3000`), `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/web && PLAYWRIGHT_BASE_URL="$URL" pnpm test:e2e --grep "@smoke"` (after Wave 0 tags tests) |
| **Full suite command** | `cd apps/web && PLAYWRIGHT_BASE_URL="$URL" pnpm test:e2e` |
| **Manual `/api/health` probe** | `curl -sf "$URL/api/health" \| jq -e '.status == "healthy"'` |
| **Estimated runtime** | Playwright anon suite ~3-5 min on `*.vercel.app`; CLI verifies ~30s total |

---

## Sampling Rate

- **After every task commit:** Run the relevant verification command for the requirement(s) the task addresses (e.g., env var add → `vercel env ls production | grep -q "^${KEY}"`; HSTS edit → post-deploy `curl -sI $URL`).
- **After every plan wave:** Re-run all 9 in-scope DEP-VCL-* checks via the `evidence/09-verify-final.txt` aggregator.
- **Before `/gsd:verify-work`:** Full suite must be green AND every mandatory `evidence/` artifact present (10 files per RESEARCH.md §14 inventory).
- **Max feedback latency:** ~30s for CLI/curl probes; ~3-5 min for Playwright suite.

---

## Per-Task Verification Map

> Plan/wave/task IDs are TBD — populated by gsd-planner. Requirement-level checks below are immutable from RESEARCH.md §14.

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| **DEP-VCL-01** | Project linked to GitHub `cbraidatto/digswap`, Root Directory = `apps/web`, build succeeds | smoke | `vercel inspect $URL --logs` returns `state: READY` + framework=Next.js + Node 20.x | ❌ Wave 0 — `evidence/01` + `evidence/06` | ⬜ pending |
| **DEP-VCL-02** | All 21 prod env vars set in Production scope only (never "All Environments") | smoke | `vercel env ls production \| grep -v '^Vercel CLI\|^>' \| grep -c '^[A-Z_]\+ ' ` returns 21+; pulled audit confirms each expected key | ❌ Wave 0 — `evidence/02` + `evidence/03` | ⬜ pending |
| **DEP-VCL-03** | Preview env vars point at dev Supabase (`mrkgoucqcbqjhrdjcnpw`) NOT prod | smoke | `vercel env pull --environment=preview <tmp> && grep -q 'mrkgoucqcbqjhrdjcnpw' <tmp>` returns 0 (match found) | ❌ Wave 0 — `evidence/02b` + `evidence/03b` | ⬜ pending |
| **DEP-VCL-04** | Post-build `.next/static/` zero secret hits | smoke | `vercel pull --environment=production && vercel build --prod && grep -r "service_role\|SUPABASE_SERVICE_ROLE\|STRIPE_SECRET\|HANDOFF_HMAC\|IMPORT_WORKER_SECRET\|RESEND_API_KEY\|DISCOGS_CONSUMER_SECRET\|UPSTASH_REDIS_REST_TOKEN\|DATABASE_URL" apps/web/.vercel/output/static/ apps/web/.next/static/` → empty stdout | ❌ Wave 0 — `evidence/04` | ⬜ pending |
| **DEP-VCL-05** | Exactly 7 NEXT_PUBLIC_ vars (matches `publicSchema` in env.ts; Sentry DSN stays out per D-08) | smoke | `vercel env ls production \| grep -c '^NEXT_PUBLIC_'` returns 7 | ❌ Wave 0 — `evidence/03` | ⬜ pending |
| **DEP-VCL-06** | HANDOFF_HMAC_SECRET + IMPORT_WORKER_SECRET freshly generated, ≠ dev values, ≥32 chars | smoke | length check via `vercel env pull` + `grep \| cut \| wc -c` (length-only, never value); compare against dev `.env.local` values to confirm difference | ❌ Wave 0 — `evidence/03` | ⬜ pending |
| **DEP-VCL-07** | Vercel Pro active | **N/A — DEFERRED per D-03** | — | — | ⏭ deferred |
| **DEP-VCL-08** | Node.js runtime = 20 in Project Settings | smoke | `vercel inspect $URL` output includes `Node.js Version: 20.x` | ❌ Wave 0 — `evidence/06` | ⬜ pending |
| **DEP-VCL-09** | HSTS = `max-age=300` during launch window | smoke | `curl -sI $URL \| grep -i 'strict-transport-security: max-age=300'` returns one match | ❌ Wave 0 — `evidence/05` | ⬜ pending |
| **DEP-VCL-10** | First build green on `*.vercel.app`, /api/health 200, Playwright anon suite green (D-17) | smoke + e2e | `curl -sf $URL/api/health \| jq -e '.status == "healthy"'` AND `cd apps/web && PLAYWRIGHT_BASE_URL=$URL pnpm test:e2e` (anon-only specs) | ❌ Wave 0 — `evidence/07` + `evidence/08` | ⬜ pending |

**Deferred (per CONTEXT.md D-03 + D-07): DEP-VCL-07 (Pro upgrade) — trigger is first paying user.**

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ⏭ deferred*

---

## Wave 0 Requirements

Code/infra changes that MUST be in place before D-17 smoke and DEP-VCL-* checks can run:

- [ ] **Edit `apps/web/playwright.config.ts`** to support `PLAYWRIGHT_BASE_URL` env var override + conditional `webServer` block (so tests can target `*.vercel.app` instead of localhost). Currently `baseURL: 'http://localhost:3000'` and `webServer` auto-starts `pnpm dev` — both are blockers for D-17.
- [ ] **Edit `apps/web/next.config.ts:11`** to reduce HSTS `max-age` from `63072000` (current) → `300` (DEP-VCL-09 launch window).
- [ ] **User-side prep (out-of-band, NOT a code task):** create `$HOME/.vercel-token` file (mode 600) with a 30-day Vercel API token scoped to `team_WuQK7GkPndJ2xH9YKvZTMtB3`. Without this, every Bash CLI call may trigger a device-code prompt (D-20 mitigation). Plan should call this out as a user precondition, not as an automated task.
- [ ] **Add `evidence/` directory** under `.planning/phases/035-vercel-environment-wiring/` mirroring Phase 34 structure (Plan 01 task: create `.gitkeep` + `00-path-deviation.md`).
- [ ] Framework install: **none** (Playwright + Vitest already installed since Phase 33.1).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel project initial creation via Dashboard wizard | DEP-VCL-01 | `vercel link --repo` works once project exists; first-time project creation is best done via Dashboard "New Project → Import from GitHub" wizard which auto-detects Next.js + pnpm workspace + apps/web Root Directory. CLI alternative `vercel project add` exists but Dashboard wizard reduces config errors on first creation. | User opens https://vercel.com/new → imports `cbraidatto/digswap` → confirms `digswap-web` name + `apps/web` Root Directory + Production branch `main`. After creation, CLI takes over. |
| Production scope confirmation per env var (visual audit) | DEP-VCL-02 | Pitfall #9 protection — easy to typo `production` as `all` in CLI. Visual confirmation in Dashboard catches scope errors before they cause prod/preview bleed. | After CLI loop, user opens Vercel Dashboard → Settings → Environment Variables → visually confirms each of the 21 keys shows "Production" badge ONLY (not "All Environments"). |
| Vercel Pro upgrade (DEFERRED) | DEP-VCL-07 | Free-tier launch decision per D-03. No Pro-only features needed. | N/A this phase. |

---

## Validation Sign-Off

- [ ] Every plan task has `<acceptance_criteria>` mapped to one or more rows in the table above (or to a manual-only behavior)
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify command
- [ ] Wave 0 covers all MISSING references (`playwright.config.ts` edit, `next.config.ts:11` edit, `evidence/.gitkeep`, `~/.vercel-token` user precondition documented)
- [ ] No watch-mode flags (Playwright `--ui` + Vitest `--watch` not used; Phase 35 runs CI-mode)
- [ ] Feedback latency < 5min (full Playwright suite); < 30s for individual CLI/curl probes
- [ ] `nyquist_compliant: true` set in frontmatter once gsd-plan-checker passes

**Approval:** pending
