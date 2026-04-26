---
phase: 035-vercel-environment-wiring
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/playwright.config.ts
  - apps/web/next.config.ts
  - .planning/phases/035-vercel-environment-wiring/evidence/.gitkeep
  - .planning/phases/035-vercel-environment-wiring/evidence/00-path-deviation.md
autonomous: false
requirements:
  - DEP-VCL-09
gap_closure: false

must_haves:
  truths:
    - "Playwright config supports remote *.vercel.app target via PLAYWRIGHT_BASE_URL env override (D-17 prerequisite)"
    - "next.config.ts emits HSTS max-age=300 for the launch window (DEP-VCL-09)"
    - "evidence/ directory exists for Phase 35 artifacts (paralleling Phase 34)"
    - "User has created $HOME/.vercel-token to bypass device-code prompts in subsequent waves (D-20 mitigation)"
  artifacts:
    - path: "apps/web/playwright.config.ts"
      provides: "BASE_URL override + conditional webServer (skip when BASE_URL is https://*)"
      contains: "process.env.PLAYWRIGHT_BASE_URL"
    - path: "apps/web/next.config.ts"
      provides: "HSTS reduced to launch-window value"
      contains: "max-age=300"
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/.gitkeep"
      provides: "evidence directory for Phase 35 artifacts"
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/00-path-deviation.md"
      provides: "MCP-vs-CLI path deviation log scaffolding (filled during execution)"
  key_links:
    - from: "apps/web/playwright.config.ts"
      to: "Vercel-assigned *.vercel.app URL"
      via: "PLAYWRIGHT_BASE_URL env at test runtime"
      pattern: "PLAYWRIGHT_BASE_URL"
    - from: "apps/web/next.config.ts:11"
      to: "HSTS response header on every route"
      via: "next headers() callback at build time"
      pattern: "max-age=300"
---

<objective>
Wave 0: prepare codebase + scaffolding so subsequent waves can deploy to Vercel and verify against the assigned `*.vercel.app` URL.

Two surgical code edits + one evidence dir scaffold + one user-side precondition checkpoint.

Purpose: Without these edits, D-17 Playwright smoke (Plan 06) cannot target a remote URL (config hardcodes localhost) and DEP-VCL-09 HSTS verification (Plan 05) would fail (current value is `max-age=63072000; includeSubDomains; preload` — way out of launch window).

Output:
- `apps/web/playwright.config.ts` accepts `PLAYWRIGHT_BASE_URL` env var + skips `webServer` block when target is remote
- `apps/web/next.config.ts:11` emits `Strict-Transport-Security: max-age=300`
- `.planning/phases/035-vercel-environment-wiring/evidence/` directory + scaffolding files
- User has confirmed `~/.vercel-token` is in place for Bash CLI auth in subsequent plans
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/035-vercel-environment-wiring/035-CONTEXT.md
@.planning/phases/035-vercel-environment-wiring/035-RESEARCH.md
@apps/web/playwright.config.ts
@apps/web/next.config.ts

<interfaces>
<!-- Current state of files this plan edits -->

apps/web/playwright.config.ts (line 22, 33-38):
- Hardcodes `baseURL: "http://localhost:3000"`
- `webServer` auto-starts `pnpm dev` — must be conditional on local-only target

apps/web/next.config.ts (line 5-30):
- `securityHeaders` array exports HSTS via Next's `headers()` callback
- Line 11 currently: `value: "max-age=63072000; includeSubDomains; preload"`

User precondition (out-of-band, NOT a code task per RESEARCH §13):
- `$HOME/.vercel-token` must contain a 30-day Vercel API token scoped to `team_WuQK7GkPndJ2xH9YKvZTMtB3`
- Created via Vercel Dashboard → Settings → Tokens → Create Token
- File mode 600 (read-only by user)
- Without this, every Bash CLI call in Plans 02-06 may trigger a device-code prompt (D-20)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Edit playwright.config.ts — add PLAYWRIGHT_BASE_URL override + conditional webServer</name>
  <files>apps/web/playwright.config.ts</files>
  <read_first>
    - apps/web/playwright.config.ts (current file — entire 39 lines)
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §10 lines 587-642 (recommended config edit + smoke target rationale)
    - .planning/phases/035-vercel-environment-wiring/035-CONTEXT.md D-17 line 56 (Playwright FULL anon suite required)
  </read_first>
  <action>
Replace the entire content of `apps/web/playwright.config.ts` with:

```typescript
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration for DigSwap.
 *
 * Uses Chromium only for speed (solo developer workflow).
 * When PLAYWRIGHT_BASE_URL is set to a remote https URL (e.g. *.vercel.app),
 * skip the local dev server. When unset or pointing at localhost, auto-start
 * `pnpm dev` for local development.
 */
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const isRemote = BASE_URL.startsWith("https://");

export default defineConfig({
	testDir: "tests/e2e",
	timeout: 30_000,
	expect: {
		timeout: 5_000,
	},
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: "html",

	use: {
		baseURL: BASE_URL,
		trace: "on-first-retry",
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	// Only auto-start dev server when targeting localhost.
	...(isRemote
		? {}
		: {
				webServer: {
					command: "pnpm dev",
					url: "http://localhost:3000",
					reuseExistingServer: !process.env.CI,
					timeout: 120_000,
				},
			}),
});
```

This is a drop-in replacement — logic preserved when running locally (no env var → localhost + webServer auto-start). When `PLAYWRIGHT_BASE_URL` starts with `https://`, the `webServer` block is omitted (spread of `{}`), so Playwright targets the remote URL directly.
  </action>
  <verify>
    <automated>cd apps/web && grep -q "PLAYWRIGHT_BASE_URL" playwright.config.ts &amp;&amp; grep -q "isRemote" playwright.config.ts &amp;&amp; cd ../.. &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - File `apps/web/playwright.config.ts` contains literal string `process.env.PLAYWRIGHT_BASE_URL`
    - File contains literal string `isRemote ? {}`
    - File contains literal string `BASE_URL.startsWith("https://")`
    - Running `cd apps/web && pnpm exec tsc --noEmit playwright.config.ts` exits 0 (no TS errors)
    - Running `cd apps/web && PLAYWRIGHT_BASE_URL="https://example.vercel.app" pnpm exec playwright test --list 2>&1 | head -5` does NOT mention "Starting" or "webServer" (proves conditional skip works)
  </acceptance_criteria>
  <done>
    Playwright config accepts external `PLAYWRIGHT_BASE_URL` and conditionally skips `webServer` when target is remote.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Edit next.config.ts:11 — reduce HSTS to max-age=300 for launch window (DEP-VCL-09)</name>
  <files>apps/web/next.config.ts</files>
  <read_first>
    - apps/web/next.config.ts (current file — full 77 lines, focus lines 5-30)
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §7 lines 370-436 (HSTS current state + DEP-VCL-09 fix plan + rationale for omitting includeSubDomains/preload)
    - .planning/phases/035-vercel-environment-wiring/035-CONTEXT.md D-18 line 59 (max-age=300 during launch window; bump after Phase 38 + 1-week soak)
    - .planning/REQUIREMENTS.md DEP-VCL-09 line 51
  </read_first>
  <action>
Edit `apps/web/next.config.ts` line 11. Change:

```typescript
		{
			key: "Strict-Transport-Security",
			value: "max-age=63072000; includeSubDomains; preload",
		},
```

To exactly:

```typescript
		{
			key: "Strict-Transport-Security",
			value: "max-age=300",
		},
```

Critical: the new value MUST be exactly `max-age=300` — no `includeSubDomains`, no `preload`. Rationale (per RESEARCH §7):
1. `includeSubDomains` would propagate HSTS to any future `*.digswap.com.br` subdomain (e.g., `staging.`, `api.`) before those exist with valid certs — locking out access during launch.
2. `preload` is permanent — once submitted to Chrome's HSTS preload list, removal takes 6-12 weeks. Not safe during launch window.

Both flags will be restored after Phase 38 UAT clean + 1-week soak (D-18 deferred trigger).

The 5-minute (300s) max-age is the minimum that still asserts HSTS while leaving an escape hatch if SSL breaks during cutover (Phase 36).
  </action>
  <verify>
    <automated>grep -q 'value: "max-age=300"' apps/web/next.config.ts &amp;&amp; ! grep -q 'max-age=63072000' apps/web/next.config.ts &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'value: "max-age=300"' apps/web/next.config.ts` returns `1`
    - `grep -c 'max-age=63072000' apps/web/next.config.ts` returns `0`
    - `grep -c 'includeSubDomains' apps/web/next.config.ts` returns `0`
    - `grep -c 'preload' apps/web/next.config.ts` returns `0`
    - The Strict-Transport-Security entry still resides inside the `securityHeaders` array (line 4-30 region)
    - `cd apps/web && pnpm exec tsc --noEmit -p .` exits 0 (no TS errors introduced)
  </acceptance_criteria>
  <done>
    next.config.ts emits HSTS `max-age=300` only — `includeSubDomains` and `preload` removed; will be restored post-Phase-38 + 1-week soak.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Create evidence/ directory + .gitkeep + 00-path-deviation.md scaffolding</name>
  <files>
    .planning/phases/035-vercel-environment-wiring/evidence/.gitkeep
    .planning/phases/035-vercel-environment-wiring/evidence/00-path-deviation.md
  </files>
  <read_first>
    - .planning/phases/034-supabase-production-setup/evidence/00-path-deviation.md (template — adopt structure for Phase 35)
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §14 lines 896-913 (evidence file inventory — 10 expected files paralleling Phase 34)
    - .planning/phases/035-vercel-environment-wiring/035-CONTEXT.md D-20 line 62-63 (CLI re-auth quirk → MCP-first/CLI-for-writes pattern)
  </read_first>
  <action>
1. Create `.planning/phases/035-vercel-environment-wiring/evidence/.gitkeep` — empty file (just to make the directory commit-trackable).

2. Create `.planning/phases/035-vercel-environment-wiring/evidence/00-path-deviation.md` with this seed content (subsequent plans will append actual deviation observations):

```markdown
# Phase 35 Path Deviation Log: MCP-first + CLI-for-writes

**Date:** [filled by execution]
**Decision owner:** Solo developer (user)
**Approved during:** /gsd:plan-phase 35 + /gsd:execute-phase 35

## Pattern inherited from Phase 34

Phase 34 established the **MCP-first / CLI-for-writes** pattern (see `.planning/phases/034-supabase-production-setup/evidence/00-path-deviation.md`). Phase 35 adopts the same pattern adapted to Vercel:

- **MCP for read/observability** — `mcp__vercel__list_deployments`, `mcp__vercel__get_deployment`, `mcp__vercel__get_deployment_build_logs`, `mcp__vercel__get_runtime_logs`. OAuth-bound to `thiagobraidatto-3732`. Zero re-auth prompts.
- **CLI for writes** — `vercel project add`, `vercel link --repo`, `vercel env add KEY <env>`, `vercel deploy --prod`, `vercel pull`, `vercel build`, `vercel inspect`. Authenticated via `VERCEL_TOKEN` env var sourced from `$HOME/.vercel-token` (D-20 mitigation).

## Why this matters for Phase 35

Vercel CLI auth file at `$HOME/AppData/Roaming/com.vercel.cli/Data/auth.json` does NOT persist between Bash sub-shells under the Claude Code sandbox (verified during Phase 34 D-04 recon: 2 sequential `vercel teams ls` + `vercel projects ls` calls triggered 2 device codes). Mitigation:

1. User created `$HOME/.vercel-token` once (Vercel Dashboard → Settings → Tokens → 30-day, scoped to `team_WuQK7GkPndJ2xH9YKvZTMtB3`).
2. Every Bash call that runs `vercel` starts with `export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"`.
3. Multiple CLI commands batch into a single Bash heredoc when feasible (one possible device-code prompt per sub-shell, not per command).

## D-05 secret-isolation deviation (acknowledged)

User explicitly chose (D-05) to allow Claude to populate ALL env vars via MCP/CLI — DB password + service_role key transit through AI context temporarily. Mitigations:

- Secrets NEVER written to evidence files or SUMMARY.md (length-only or presence-only)
- HANDOFF_HMAC_SECRET + IMPORT_WORKER_SECRET generated locally via `openssl rand -hex 32 | vercel env add ... --sensitive` (one-shot pipe — value never enters a shell variable, never echoes)
- `--sensitive` flag on all 10 secret env vars (encrypted-at-rest in Vercel; not readable post-creation)
- Leak suspicion → revoke via Supabase Dashboard (service_role) + Vercel Dashboard (project DB) + Phase 35.1 gap-closure plan re-populates

## Path deviations actually observed during execute

[filled by execute-phase as deviations occur — examples: open-question 1 (vercel project add --scope behavior), open-question 3 (vercel pull file location)]
```
  </action>
  <verify>
    <automated>test -f .planning/phases/035-vercel-environment-wiring/evidence/.gitkeep &amp;&amp; test -f .planning/phases/035-vercel-environment-wiring/evidence/00-path-deviation.md &amp;&amp; grep -q "MCP-first" .planning/phases/035-vercel-environment-wiring/evidence/00-path-deviation.md &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/035-vercel-environment-wiring/evidence/.gitkeep` exists (size = 0 bytes is fine)
    - File `.planning/phases/035-vercel-environment-wiring/evidence/00-path-deviation.md` exists, size > 1500 bytes
    - 00-path-deviation.md contains the literal string "MCP-first / CLI-for-writes"
    - 00-path-deviation.md contains the literal string "VERCEL_TOKEN"
    - 00-path-deviation.md contains the literal string "D-05"
    - 00-path-deviation.md contains the literal string "openssl rand -hex 32"
  </acceptance_criteria>
  <done>
    evidence/ directory committed-trackable; 00-path-deviation.md scaffolds the MCP-first pattern Phase 35 inherits from Phase 34.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 4 (CHECKPOINT): User creates $HOME/.vercel-token</name>
  <files>$HOME/.vercel-token (user-owned, NOT in repo)</files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §13 lines 787-849 (Vercel CLI device-code re-prompt mitigation; Strategy 1: VERCEL_TOKEN from gitignored local file)
    - .planning/phases/035-vercel-environment-wiring/035-CONTEXT.md D-20 line 62 (CLI re-auth quirk acknowledgement)
  </read_first>
  <what-built>
    Plans 02-06 each run multiple `vercel` CLI commands. Without `$HOME/.vercel-token`, every Bash sub-shell that calls `vercel` may trigger a device-code prompt (verified during Phase 34 D-04 recon: 2 commands → 2 device codes). With the token file in place, `export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"` at the start of every Bash call gives the CLI an in-memory token and zero re-auth prompts.

    This is a one-time setup. Once the file exists, all subsequent plans pick it up automatically.
  </what-built>
  <how-to-verify>
    User actions (one-time setup, not automatable — Vercel Dashboard requires browser interaction):

    1. Open https://vercel.com/account/tokens (Vercel Dashboard → Settings → Tokens)
    2. Click **Create Token**:
       - **Token Name:** `digswap-phase-35-execute`
       - **Scope:** Select team `thiagobraidatto-3732's projects` (`team_WuQK7GkPndJ2xH9YKvZTMtB3`) — NOT "Full Account"
       - **Expiration:** 30 days (covers Phase 35 + Phase 36 cutover + Phase 37 safety margin)
    3. Click **Create**, copy the token value (shown ONCE)
    4. In a terminal on your machine (NOT in the agent — keep the value out of agent context):
       ```bash
       echo "<paste-token-here>" > "$HOME/.vercel-token"
       chmod 600 "$HOME/.vercel-token"
       ```
    5. Verify the file is in place and not group/world-readable:
       ```bash
       ls -la "$HOME/.vercel-token"
       # Expected: -rw-------  (mode 600), owned by your user
       ```
    6. Sanity check the token works (this DOES touch agent context but only briefly, just to confirm):
       ```bash
       export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"
       vercel whoami
       # Expected: thiagobraidatto-3732 (no device-code prompt)
       ```

    If `vercel whoami` triggers a device-code prompt instead of printing the username, the token didn't work — re-create with correct scope.

    Type "approved" once `vercel whoami` succeeded silently. Type "skip" if you accept device-code prompts in subsequent plans (graceful degradation per RESEARCH §13 Strategy 2 fallback).
  </how-to-verify>
  <acceptance_criteria>
    - User confirms one of:
      (a) `~/.vercel-token` exists, mode 600, contains a working token (verified via `vercel whoami` returning `thiagobraidatto-3732` with no prompt) — execute-phase can rely on `VERCEL_TOKEN` strategy
      (b) User explicitly opts to skip and accept device-code prompts per Strategy 2 fallback — execute-phase will batch CLI commands per Bash heredoc and tolerate possible mid-loop prompts
    - Decision recorded in `evidence/00-path-deviation.md` (append a "User precondition decision" section noting which strategy was chosen)
  </acceptance_criteria>
  <resume-signal>
    Type "approved" once `vercel whoami` succeeded silently with the token, or "skip" to accept device-code prompts (fallback Strategy 2).
  </resume-signal>
  <done>
    User has either created `$HOME/.vercel-token` (Strategy 1) or explicitly opted into Strategy 2 (heredoc batching + accept prompts). Decision recorded in evidence/00-path-deviation.md.
  </done>
</task>

</tasks>

<verification>
After Plan 01 completion:

1. `grep -q "PLAYWRIGHT_BASE_URL" apps/web/playwright.config.ts` returns 0
2. `grep -q 'value: "max-age=300"' apps/web/next.config.ts` returns 0 AND `grep -q 'max-age=63072000' apps/web/next.config.ts` returns 1 (no match)
3. `test -d .planning/phases/035-vercel-environment-wiring/evidence` returns 0
4. `test -f .planning/phases/035-vercel-environment-wiring/evidence/00-path-deviation.md` returns 0
5. User has confirmed `~/.vercel-token` strategy (approved or skip)
6. No production state has been touched yet (no Vercel project exists; no DNS change; no env vars set)
</verification>

<success_criteria>
- [ ] `apps/web/playwright.config.ts` accepts `PLAYWRIGHT_BASE_URL` env override; conditional `webServer` block (skip when remote)
- [ ] `apps/web/next.config.ts:11` HSTS = `max-age=300` (no `includeSubDomains`, no `preload`)
- [ ] `evidence/.gitkeep` + `evidence/00-path-deviation.md` scaffold in place
- [ ] User checkpoint: `~/.vercel-token` strategy decision recorded
- [ ] TypeScript still compiles (no new errors introduced by config edits)
- [ ] No Vercel project created yet (Plan 02 owns that step)
- [ ] No env vars set yet (Plans 03+04 own that)
</success_criteria>

<output>
After completion, create `.planning/phases/035-vercel-environment-wiring/035-01-SUMMARY.md` capturing:
- The two file edits (with line ranges and before/after snippets — for HSTS this is one line, for playwright.config.ts this is the full new content)
- Confirmation user-precondition checkpoint completed (Strategy 1 vs Strategy 2 decision)
- Evidence files created
- Pointer to Plan 02 (next wave)
</output>
