# Phase 35: Vercel + Environment Wiring — Research

**Researched:** 2026-04-26
**Domain:** Vercel project provisioning + env var population for a pnpm monorepo Next.js 15 app, executed via MCP/CLI under a free-tier launch posture
**Confidence:** HIGH (CLI flags, plugin commands, MCP tool surface, code current state) / MEDIUM (Vercel CLI auth-file persistence under Claude Code Bash sandbox — verified by Phase 34 recon, 1 data point)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Vercel project setup**
- **D-01:** Project name = `digswap-web`. GitHub repo: `cbraidatto/digswap`. Root Directory = `apps/web`. Production branch = `main`.
- **D-02:** Team: `thiagobraidatto-3732's projects` (`team_WuQK7GkPndJ2xH9YKvZTMtB3`). 0 existing projects — `digswap-web` is create-from-scratch.
- **D-03:** Plan: **Vercel Hobby**. No Pro upgrade. Carrying forward Phase 34 D-02 free-tier launch posture. Trade-off accepted: 10s function timeout, non-commercial ToS (acceptable without Stripe Live), no instant rollback. Pro deferred to first paying user.
- **D-04:** Node.js runtime = **20** in Project Settings → General (matches CI).

**Env var fill strategy (DEVIATION from Phase 34 secret-isolation discipline)**
- **D-05:** **Tudo via MCP/CLI executado por Claude.** Explicit user choice. DB password + service_role key pass through AI context temporarily. Mitigations:
  - Secrets NEVER committed to evidence files or SUMMARY.md
  - HANDOFF_HMAC_SECRET + IMPORT_WORKER_SECRET generated locally via `openssl rand -hex 32` — never exposed to user/echoed
  - Vercel CLI is the vehicle (MCP has no env-write tools); `vercel env add KEY production` per env var
  - Leak suspicion → user revokes via Supabase Dashboard (service_role) + Vercel Dashboard (project DB) + Phase 35.1 gap-closure plan re-populates
- **D-06:** **Production scope only** in each `vercel env add`. NEVER "All Environments". Preview/Development scopes populated separately pointing at Supabase **dev** (`mrkgoucqcbqjhrdjcnpw`).

**Deferred env vars**
- **D-07:** Stripe vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`, `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL`) → dummy `DEFERRED_PHASE_37_*` (>=10 chars to satisfy `min(10)` validation in env.ts production branch). `NEXT_PUBLIC_STRIPE_PRICE_*` may stay genuinely empty (default "" in env.ts).
- **D-08:** Sentry vars (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`) → genuinely empty. Phase 39 owns.
- **D-09:** Discogs prod app (`DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET`) → dummy `DEFERRED_PHASE_37` (>=1 char). Phase 37 owns.

**URLs canonical**
- **D-10/11:** `NEXT_PUBLIC_APP_URL` = `NEXT_PUBLIC_SITE_URL` = `https://digswap.com.br` (Production scope) since Phase 35. Trade-off accepted: previews on `*.vercel.app` with absolute redirects to `digswap.com.br` may break between Phase 35 and Phase 36.
- **D-12:** Preview scope of `NEXT_PUBLIC_*_URL` → Vercel-assigned `$VERCEL_URL` (auto-injected, always `*.vercel.app`).

**Preview scope (Pitfall #9 protection)**
- **D-13:** Preview env vars point **100%** at Supabase dev (`mrkgoucqcbqjhrdjcnpw`):
  - `NEXT_PUBLIC_SUPABASE_URL` (Preview) = `https://mrkgoucqcbqjhrdjcnpw.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (Preview) = dev anon key (already in `.env.local`)
  - `SUPABASE_SERVICE_ROLE_KEY` (Preview) = dev service_role
  - `DATABASE_URL` (Preview) = dev pooler URL
  - Stripe Preview = same dummy as Production

**Secret regeneration (Pitfall #29)**
- **D-14:** `HANDOFF_HMAC_SECRET` (Production) generated via `openssl rand -hex 32` (64-char hex string ≥32). Value never passes through user; Bash generates, CLI injects directly into Vercel.
- **D-15:** `IMPORT_WORKER_SECRET` (Production) idem.
- **D-16:** Dev secrets in `apps/web/.env.local` remain unchanged — Phase 35 only touches Vercel.

**Build verification**
- **D-17:** Após primeiro build verde no `*.vercel.app`, rodar **Playwright smoke COMPLETO** apontando `BASE_URL` para Vercel-assigned URL. Tests existentes em `apps/web/tests/e2e/` (Phase 33.1 já provisionou Playwright). Cobertura: signup → email confirm → login → /perfil → /api/health (200 com `{db:ok}`). Cold-start verification incluída (Pitfall #8 — 35ed595 fix).

**Security headers**
- **D-18:** HSTS = `max-age=300` durante launch window (Phase 35 → 38). Bump para `max-age=31536000; includeSubDomains; preload` SOMENTE after Phase 38 UAT green + 1 week clean soak. Aderente a DEP-VCL-09.
- **D-19:** Outros security headers (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) já existem — Phase 35 verifica que estão ligados em prod, não cria novos.

**Vercel CLI auth quirk**
- **D-20:** O Bash sandbox do Claude Code NÃO persiste auth do `vercel` CLI entre calls. Cada `vercel <command>` pode triggerar device-code login fresh. Mitigação: usar **MCP Vercel** para read/observability (zero re-auth) e minimizar Bash CLI a operações estritamente write (env add, link, deploy). Multiple Bash CLI calls em sequência → batch num single Bash heredoc.

**Build-blocker dummy convention**
- **D-21:** `DEFERRED_PHASE_NN_<note>` prefix para env vars com hard validation. Padrão facilita find-and-replace na phase que ativa a integração.
  - `STRIPE_SECRET_KEY = sk_live_DEFERRED_PHASE_37_NOT_FOR_USE`
  - `STRIPE_WEBHOOK_SECRET = whsec_DEFERRED_PHASE_37_NOT_FOR_USE`
  - `DISCOGS_CONSUMER_KEY = DEFERRED_PHASE_37`
  - `DISCOGS_CONSUMER_SECRET = DEFERRED_PHASE_37`

### Claude's Discretion

- Vercel CLI flag selection (e.g., `--yes`, `--token` vs `VERCEL_TOKEN` env var)
- Ordering of the 21 env vars in the `vercel env add` loop (recommended: NEXT_PUBLIC_* first, secrets last — easier to abort cleanly mid-loop if something fails)
- Evidence capture (per-env-var log vs single dump)
- Halt-on-fail protocol if any `vercel env add` fails (recommendation in §11 below)
- When exactly to trigger the first production deploy vs letting Vercel auto-build on the first push to `main`

### Deferred Ideas (OUT OF SCOPE for Phase 35)

- **Vercel Pro upgrade** — first paying user trigger
- **Stripe Live activation** (Phase 37) — swap `DEFERRED_PHASE_37_*` for real Live values
- **Sentry activation** (Phase 39) — populate DSN, auth token, filters
- **Discogs prod app registration** (Phase 37)
- **HSTS 2-year bump** — post-Phase 38 + 1 week soak
- **Resend email setup** (Phase 37) — DKIM/SPF/DMARC + `RESEND_API_KEY`
- **UPSTASH_REDIS** — post-MVP (Discogs imports degrade gracefully without it)
- **YOUTUBE_API_KEY** — post-MVP
- **Doc-debt sweep** (`digswap.com` → `digswap.com.br` across `.planning/` docs and 4 source files) — recommended QUICK after Phase 35
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **DEP-VCL-01** | Vercel project created and linked to GitHub repo (Root Directory = `apps/web`) | §2 (CLI sequence: `vercel link --repo` for monorepo, then `apps/web/vercel.json` with `rootDirectory` if needed); §6 (`vercel.json` recommendation) |
| **DEP-VCL-02** | All 21 production env vars set with **Production scope only** | §2 (`vercel env add KEY production` non-interactive pattern); §11 (halt-on-fail) |
| **DEP-VCL-03** | Preview env vars separately scoped to dev Supabase (preview deploys never touch prod) | §2 (per-scope add pattern); §4 (`vercel env pull --environment=preview` for verify) |
| **DEP-VCL-04** | Post-build grep of `.next/static/` finds zero hits for `service_role`, `STRIPE_SECRET`, `HANDOFF_HMAC`, `IMPORT_WORKER_SECRET`, `DATABASE_URL` | §8 (full methodology with `vercel build` local invocation) |
| **DEP-VCL-05** | Only 7 env vars carry `NEXT_PUBLIC_` prefix (no service-role or Stripe secret leaked into client bundle) | §8 (companion grep + Vercel CLI `vercel env ls production` audit) |
| **DEP-VCL-06** | `HANDOFF_HMAC_SECRET` and `IMPORT_WORKER_SECRET` regenerated for prod via `openssl rand -hex 32` | §9 (one-shot pipe pattern; `openssl` confirmed available at `/mingw64/bin/openssl` on Git Bash) |
| **DEP-VCL-07** | Vercel Pro active before first paying user | **DEFERRED per D-03** — DEP-VCL-07 is intentionally out of scope for this phase. Documented as not-blocking-launch (no Stripe Live, no commercial use). Re-opens at first-paying-user trigger. |
| **DEP-VCL-08** | Node.js runtime pinned to 20 in Vercel project settings (matches CI) | §6 (Project Settings → General; alternative: `engines.node` in `apps/web/package.json` — currently absent) |
| **DEP-VCL-09** | HSTS reduced to `max-age=300` during launch window | §7 (current state: HSTS lives ONLY in `apps/web/next.config.ts:11`, currently `max-age=63072000; includeSubDomains; preload` — must be reduced) |
| **DEP-VCL-10** | First build green on `*.vercel.app` preview URL before DNS cutover | §10 (Playwright smoke against `BASE_URL=$VERCEL_URL`); §5 (MCP `get_deployment_build_logs` for live build observability) |
</phase_requirements>

---

## 1. Phase Goal Restatement

Provision the Vercel project `digswap-web` (linked to GitHub `cbraidatto/digswap`, Root Directory `apps/web`, production branch `main`, Hobby plan, Node 20), populate all 21 production env vars with **Production scope only** (and a parallel set of Preview env vars pointing at the **dev** Supabase project to enforce Pitfall #9 isolation), regenerate `HANDOFF_HMAC_SECRET` + `IMPORT_WORKER_SECRET` fresh for prod via locally-piped `openssl rand -hex 32`, reduce HSTS to `max-age=300` for the launch window (DEP-VCL-09 / D-18), and run the **full Playwright suite** (D-17) against the Vercel-assigned `*.vercel.app` URL — all before any DNS cutover (which is Phase 36). Operating mode: **MCP-first for read/observability + CLI for writes**, with secrets piped through stdin and never echoed (carrying forward the Phase 34 path-deviation pattern). DEP-VCL-07 (Pro upgrade) is **intentionally deferred** to first-paying-user trigger per the free-tier launch posture (D-03).

The post-deploy verification gates are: (a) `grep -r "service_role|STRIPE_SECRET|HANDOFF_HMAC|IMPORT_WORKER_SECRET|DATABASE_URL" apps/web/.next/static/` returns zero hits, (b) exactly 7 env vars carry the `NEXT_PUBLIC_` prefix, (c) `/api/health` on `*.vercel.app` returns 200 with `{database: "ok"}`, and (d) the full Playwright suite passes against `BASE_URL=$VERCEL_URL`.

---

## 2. Vercel CLI Command Sequence (Numbered, Exact Flags)

> **Execution mode:** Every Bash invocation should source `VERCEL_TOKEN` from a local gitignored file before running `vercel`. This is the canonical CI pattern (CI/CD skill: "Use `VERCEL_TOKEN` env var (not `--token` — it leaks in process listings)") and it sidesteps the device-code re-prompt issue under the Claude Code Bash sandbox (D-20). See §13 for the exact mitigation.

### 2.0 — Authentication preflight (run once at top of phase, then re-source per Bash call)

```bash
# Reads the token from a gitignored file the user owns; `set +x` to keep
# the value out of any verbose log; `set -u` defends against typos.
set -u
export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"
[ -n "$VERCEL_TOKEN" ] || { echo "VERCEL_TOKEN not set" >&2; exit 1; }
vercel whoami           # confirms scope without re-auth
```

The user creates `~/.vercel-token` once (Vercel Dashboard → Settings → Tokens → Create Token, scope `team_WuQK7GkPndJ2xH9YKvZTMtB3`). After that, every Bash call that runs `vercel` must `export VERCEL_TOKEN=...` first. Why this works: the CLI prefers `VERCEL_TOKEN` over the on-disk auth file (`$HOME/AppData/Roaming/com.vercel.cli/Data/auth.json`); when the env var is set, no device-code prompt is triggered.

### 2.1 — Create + link project (DEP-VCL-01)

The repo is a pnpm workspace with two app candidates (`apps/web`, `apps/desktop`). The vercel-cli skill states explicitly: "Use `vercel link --repo` instead [of `vercel link`]. **Always a good idea when any project has a non-root directory.**"

```bash
# Step 1 — create the project. `vercel project add` is non-interactive.
vercel project add digswap-web --scope team_WuQK7GkPndJ2xH9YKvZTMtB3

# Step 2 — link the monorepo root. Creates .vercel/repo.json (gitignored).
vercel link --repo --yes \
  --scope team_WuQK7GkPndJ2xH9YKvZTMtB3 \
  --project digswap-web
```

Result: `.vercel/repo.json` at repo root maps `apps/web/` → `digswap-web` project. Subsequent `vercel <cmd>` calls run from `apps/web/` skip the "which project?" prompt.

**Connect the GitHub repo:** the CLI does NOT have a `vercel git connect` command. Two options:
1. **Dashboard step:** After `vercel project add`, the user opens `https://vercel.com/thiagobraidatto-3732s-projects/digswap-web/settings/git` and clicks "Connect Git Repository → cbraidatto/digswap". One manual step. **Recommended.**
2. **REST API via `vercel api`:** Documented in vercel-cli skill as fallback for missing CLI commands. Endpoint: `PATCH /v9/projects/digswap-web?teamId=...` with body `{gitRepository:{type:"github",repo:"cbraidatto/digswap"}}`. Requires GitHub OAuth association already on the Vercel team — verify before attempting.

### 2.2 — Set Root Directory + production branch (DEP-VCL-01)

These are **Project Settings**, not env vars. Two paths:
- **Dashboard:** `vercel.com/.../digswap-web/settings/general` → set Root Directory = `apps/web`, Production Branch = `main`. **Recommended** (one-time, atomic).
- **`vercel.json`:** see §6 for the keys; less idempotent because some keys conflict with Dashboard settings.

### 2.3 — Add env vars (DEP-VCL-02, DEP-VCL-03, DEP-VCL-06)

The canonical non-interactive pattern from the env-vars skill SKILL.md:

```bash
# Pipe value via stdin — value does NOT appear in `ps`, history, or shell logs.
echo "<value>" | vercel env add KEY production

# Add to multiple environments in one call — useful only when the SAME value
# is appropriate. We will NOT use this for Supabase keys (D-13 isolates dev).
echo "<value>" | vercel env add KEY production preview development
```

**Important flag-shape facts** (verified from the env-vars skill + commands/env.md):
- `environment` is a **positional argument**, not a flag. Order: `vercel env add KEY <env> [<env> ...] [--git-branch=<branch>] [--sensitive]`.
- The CLI accepts the value either via stdin (`echo` + pipe) or interactively. **There is no `--value` flag.**
- `--sensitive` flag (added Vercel CLI v34+) marks the var as encrypted-at-rest, not readable after creation. **Recommended for all secrets** in Phase 35: DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HANDOFF_HMAC_SECRET, IMPORT_WORKER_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, SENTRY_AUTH_TOKEN, UPSTASH_REDIS_REST_TOKEN, DISCOGS_CONSUMER_SECRET (10 of the 21).
- Values with newlines or `=` are safe via stdin pipe but NOT safe as command-line args. Use `printf "%s" "$VALUE"` (no trailing newline) when piping.

**Recommended add-loop pattern** (the bootstrap skill demonstrates this for `AUTH_SECRET` — adapt for our 21 vars):

```bash
# Public, non-secret URL (Production scope, NOT sensitive)
echo "https://digswap.com.br" | vercel env add NEXT_PUBLIC_APP_URL production

# Production secret (Production scope, --sensitive)
printf "%s" "$DATABASE_URL_PROD" | vercel env add DATABASE_URL production --sensitive
unset DATABASE_URL_PROD

# Preview-scoped value pointing at dev Supabase
printf "%s" "$DATABASE_URL_DEV" | vercel env add DATABASE_URL preview --sensitive
unset DATABASE_URL_DEV
```

**Recommended ordering of the 21 vars** (Claude's Discretion area; rationale: lowest-risk first so a mid-loop halt strands the project in a clearly-incomplete state, never an almost-deployable one):

1. **Public URLs (3):** `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_MIN_DESKTOP_VERSION` — hard-coded constants, lowest risk.
2. **Public Supabase (1):** `NEXT_PUBLIC_SUPABASE_URL` — public anon URL.
3. **Public Supabase key (1):** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — public anon JWT (208 chars; `trade_preview_publishable_key` in Vault).
4. **Deferred public placeholders (3):** `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`, `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL`, `NEXT_PUBLIC_SENTRY_DSN` — empty strings allowed.
5. **Server-side secrets, low blast radius (3):** `RESEND_API_KEY` (empty allowed), `RESEND_FROM_EMAIL` (`noreply@digswap.com.br`), `SYSTEM_USER_ID` (empty allowed).
6. **Server-side secrets, deferred dummies (5):** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `DISCOGS_CONSUMER_KEY`, `DISCOGS_CONSUMER_SECRET`, `YOUTUBE_API_KEY` — `DEFERRED_PHASE_37_*` per D-21.
7. **Server-side secrets, generated locally (2):** `HANDOFF_HMAC_SECRET`, `IMPORT_WORKER_SECRET` — see §9 for one-shot pattern.
8. **Server-side secrets, real prod values (3):** `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (last 2 may be empty if Upstash deferred). These are highest-blast-radius — added last so a halt before this point leaves no prod secret in Vercel.

For each Production-scope var, immediately add the Preview-scope counterpart pointing at the **dev** Supabase project where applicable (Supabase URL, Supabase anon key, service_role, DATABASE_URL — per D-13). For non-Supabase vars (Stripe dummy, Resend, etc.), Preview = same value as Production unless a different value is required.

### 2.4 — First production deploy (DEP-VCL-10)

After all env vars are set:

```bash
# Trigger from apps/web/ so the link mapping resolves to digswap-web.
cd apps/web
URL=$(vercel deploy --prod --yes --scope team_WuQK7GkPndJ2xH9YKvZTMtB3 2>/dev/null)
echo "$URL"   # captures the *.vercel.app URL on stdout
cd -
```

Notes:
- `--prod` deploys directly to the production target. **Do NOT use `--prebuilt`** unless we ran `vercel build` locally first (and we are not — D-17 runs Playwright AGAINST a remote build, which means we want Vercel's runner to do the build).
- `--yes` skips the interactive "Are you sure?" prompt.
- `--scope` is required because the token may have access to multiple teams; explicit is safer.
- stdout = the deployment URL (pipeable). stderr = progress + errors.

**Alternative:** push to `main` and let Vercel's GitHub integration auto-deploy. Pro: zero CLI auth issues. Con: harder to capture the URL programmatically (need to poll `mcp__vercel__list_deployments`). **Recommendation:** trigger explicitly via CLI for the first deploy so we get the URL in stdout immediately and can pipe it into the Playwright run.

---

## 3. `/env` Plugin Slash Command Capabilities

The `vercel@claude-plugins-official` plugin (v0.40.0) ships a `/env` slash command. From `commands/env.md`:

| Subcommand | What it does | Useful for Phase 35? |
|------------|--------------|----------------------|
| `/env list` | `vercel env ls` — list var names per environment, **never values** | YES — DEP-VCL-05 verification |
| `/env pull` | `vercel env pull .env.local --environment=production --yes` | YES — DEP-VCL-04 cross-check (see §4) |
| `/env add <NAME>` | Single-var interactive flow. **Asks for explicit confirmation if production is selected.** | NO — too slow (21 vars × confirmation prompt = 21 turns). Loop bash pattern is faster. |
| `/env diff` | Compares local `.env.local` keys vs Vercel keys (names only) | YES — sanity check before phase ends |
| `/env rm <NAME>` | Remove with explicit confirmation | NO — phase 35 doesn't remove anything |

**Key discovery — never-echo-secrets rule:** `commands/env.md` line 9 explicitly states: *"Environment variable values must never appear in command output, summaries, or conversation text. Only show variable names, environments, and metadata."* This is a built-in safety rail of the `/env` command. The Phase 35 plan should **mirror this rule** in its evidence-capture step: log var **names** + **scope** + **was-it-marked-sensitive**, never values.

**Recommendation:**
- **Use `/env add <NAME>` interactively for the 2 generated secrets only** (HANDOFF_HMAC_SECRET, IMPORT_WORKER_SECRET) — the slash command guides through a clean one-secret-at-a-time flow with the never-echo rule enforced. But this requires user-driven turn-taking (21 vars × confirmation = friction). **In practice, prefer §9's one-shot Bash pipe.**
- **Use `/env list` and `/env diff` for verification** at end of each wave (cheap, read-only, zero re-auth risk).
- **Do NOT use `/env add` for the 19 non-generated vars.** A scripted Bash loop is faster, evidence-capture-friendlier, and avoids 21 production-confirmation prompts.

The plugin's `/deploy prod` command can be used for the first deploy (it embeds the production-confirmation guard + post-deploy error scan), but the bare `vercel deploy --prod --yes` is more scriptable and doesn't add value over §2.4. **Recommendation: skip `/deploy` for Phase 35.**

---

## 4. `vercel env pull` Strategy for DEP-VCL-04 / DEP-VCL-05 Verify

`vercel env pull` writes the resolved env vars for one environment into a local file. **Crucially, the file is plaintext** — so:
1. Pull goes to a path outside the repo (e.g. `~/.tmp/digswap-prod-env.local`).
2. After grep checks complete, the file is **shredded** (`rm` is fine for our threat model since the file never touched git).
3. The file is also **inherently gitignored** if written to `.env*.local` — `.gitignore` line 40-41 covers `.env*` with `!.env.local.example` carve-out.

### Verification flow

```bash
# Pull all 21 prod env vars resolved to actual values.
TMPFILE=$(mktemp -t digswap-prod-env-XXXXXX.local)
vercel env pull "$TMPFILE" --environment=production --yes

# DEP-VCL-05: count NEXT_PUBLIC_ prefix vars — must be exactly 7.
NUM_PUBLIC=$(grep -c '^NEXT_PUBLIC_' "$TMPFILE" || true)
echo "NEXT_PUBLIC_ count: $NUM_PUBLIC (expected 7)"
[ "$NUM_PUBLIC" -eq 7 ] || echo "FAIL: NEXT_PUBLIC_ count mismatch"

# DEP-VCL-02: confirm all 21 expected keys are present.
EXPECTED_KEYS=(
  NEXT_PUBLIC_APP_URL NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_PUBLIC_STRIPE_PRICE_MONTHLY
  NEXT_PUBLIC_STRIPE_PRICE_ANNUAL NEXT_PUBLIC_MIN_DESKTOP_VERSION
  SUPABASE_SERVICE_ROLE_KEY DATABASE_URL HANDOFF_HMAC_SECRET
  IMPORT_WORKER_SECRET STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET
  DISCOGS_CONSUMER_KEY DISCOGS_CONSUMER_SECRET RESEND_API_KEY
  RESEND_FROM_EMAIL UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN
  YOUTUBE_API_KEY SYSTEM_USER_ID
  # NEXT_PUBLIC_SENTRY_DSN deliberately empty — Phase 39
)
for k in "${EXPECTED_KEYS[@]}"; do
  grep -q "^${k}=" "$TMPFILE" || echo "MISSING: $k"
done

# Shred the file.
shred -u "$TMPFILE" 2>/dev/null || rm "$TMPFILE"
```

**Evidence to commit** (sanitized): just the **counts and key presence**, NEVER values. Pattern to reuse from Phase 34 (`evidence/06-vault-secrets.txt`): document length-only + presence-confirm, never the value itself.

```text
# evidence/03-env-pull-prod-audit.txt (sanitized)
NEXT_PUBLIC_ count: 7 (expected 7) — PASS
Expected keys present: 21/21 — PASS
Sensitive flag set on: DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HANDOFF_HMAC_SECRET, ... — 10 of 10 — PASS
```

Repeat for `--environment=preview` and confirm: `NEXT_PUBLIC_SUPABASE_URL` value contains `mrkgoucqcbqjhrdjcnpw` (dev project_ref) — that single check is enough to validate D-13's Pitfall #9 isolation.

---

## 5. MCP Observability Patterns During Deploy

The Vercel MCP at `https://mcp.vercel.com` (configured in `.mcp.json`, OAuth-authenticated as `thiagobraidatto-3732`) exposes 18 tools for read/observability/deploy. The tools relevant to a live deploy:

| Tool | Use during deploy | Latency / Caveat |
|------|---------------------|------------------|
| `mcp__vercel__list_deployments` | Poll for the new deployment ID once `vercel deploy --prod` returns the URL — use `target=production`, `limit=5` | Near-real-time; deployments appear within ~1s of `--prod` returning |
| `mcp__vercel__get_deployment` | Query the deployment by ID; returns `state` (QUEUED → BUILDING → READY / ERROR), `target`, `url` | Polls Vercel's deployments API; safe to call every 5-10s |
| `mcp__vercel__get_deployment_build_logs` | Stream build logs — Next.js compile, env-var resolution, function bundling, static page generation | **Build logs are buffered** — they appear in chunks, not line-by-line. Expect ~10-30s lag for the first chunk, then near-real-time |
| `mcp__vercel__get_runtime_logs` | Stream runtime function logs (post-READY state) — useful for validating /api/health response after deploy | Available within ~60s after first request hits the endpoint; supports `--level error --since 1h` filter |
| `mcp__vercel__list_drains` | List configured log drains | Hobby plan: returns 0; informational only for Phase 35 |

**Recommended monitoring loop during the first deploy:**

```
1. CLI: vercel deploy --prod --yes  →  captures $URL on stdout
2. MCP: list_deployments(limit=5, target=production)  →  finds the new deploymentId
3. MCP: get_deployment(deploymentId)  →  poll every 10s until state = READY or ERROR
4. If state = BUILDING for >2 minutes:
   MCP: get_deployment_build_logs(deploymentId)  →  diagnose
5. If state = READY:
   curl -s "$URL/api/health"  →  expect 200 with {"status":"healthy","checks":{"database":"ok"}}
6. If state = ERROR:
   MCP: get_deployment_build_logs(deploymentId)  →  capture last 50 lines for evidence
```

**Why MCP-first for observability:** zero re-auth (the MCP is OAuth-bound to the user's Vercel account, no device-code prompt per call). The CLI alternative (`vercel logs $URL --follow`) re-prompts on every Bash sub-shell entry under the Claude Code sandbox per D-20.

**Latency reality check:** the MCP `get_deployment_build_logs` tool is built on top of Vercel's deployment events API (`/v3/deployments/:id/events`). The CLI's `vercel logs $URL --follow` reads from the same source; the MCP buffers per-call rather than streaming, so use `--follow` via CLI only when sub-second latency matters. For Phase 35's first build (where READY → smoke test takes minutes anyway), MCP polling is plenty.

---

## 6. `vercel.json` vs Project Settings — Recommendation

**Recommendation:** Use Project Settings (Dashboard) for everything. Do NOT create a `vercel.json` for Phase 35.

### Rationale

The vercel-cli skill's "anti-patterns" section warns: *"Letting commands auto-link in monorepos: Many commands implicitly run `vercel link`... This creates `project.json`, which may be wrong."* — but does NOT recommend `vercel.json` for monorepo Root Directory. The monorepos reference (`references/monorepos.md`) shows `vercel.json` ONLY as **fallback** when Dashboard cannot express the override (e.g., explicit Turborepo `buildCommand` filter for non-trivial cases).

For DigSwap, the Dashboard handles every Phase 35 setting cleanly:

| Setting | Where to set | Dashboard URL |
|---------|--------------|---------------|
| Root Directory = `apps/web` | Project Settings → General | `vercel.com/.../digswap-web/settings` |
| Production branch = `main` | Project Settings → Git | same |
| Framework preset = Next.js | Auto-detected | — |
| Build command = `pnpm --filter @digswap/web build` | Project Settings → Build & Output (override the auto-detected `pnpm build`) | same |
| Install command = `pnpm install --frozen-lockfile` | Project Settings → Build & Output | same |
| Output directory = `apps/web/.next` (default for Next.js) | Auto-detected | — |
| Node.js Version = 20.x | Project Settings → General → Node.js Version | same |

### When `vercel.json` would be necessary (and why we don't need it)

The vercel-cli skill lists `vercel.json` keys that the Dashboard cannot express:
- `headers` array — but DigSwap's headers are set in `next.config.ts` `headers()` callback (which Vercel runs at build time), so `vercel.json` `headers` would conflict with Next.js. **Skip.**
- `functions[].maxDuration` — Vercel auto-detects `export const maxDuration = N` in route files (already used in `app/api/stripe/webhook/route.ts:14`), so `vercel.json` would duplicate config. **Skip.**
- `crons` — DigSwap uses pg_cron in Supabase, not Vercel Cron. **Skip.**
- `redirects` / `rewrites` — none needed at platform level. **Skip.**

**Conclusion:** zero `vercel.json` keys are load-bearing for Phase 35. Ship without one. If a future phase needs cron or platform-level headers, add `vercel.json` then.

### What about `.vercelignore`?

Optional. The `pnpm-workspace.yaml` already directs Vercel to install the whole workspace and only build `@digswap/web`. The default ignore (`.vercel/`, `.next/`, `node_modules/`) is sufficient. **Skip.**

---

## 7. HSTS / Security Headers — Current State + DEP-VCL-09 Fix Plan

### Current state (verified by grep)

HSTS is set in **exactly one place** in the codebase: `apps/web/next.config.ts:11`.

```typescript
// apps/web/next.config.ts:5-30
const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload" },   // ← LINE 11
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer-Policy intentionally omitted — middleware sets it
  { key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()" },
  // CSP is dynamic via middleware
];
```

`apps/web/src/middleware.ts:27-29` sets Referrer-Policy + X-Content-Type-Options + Permissions-Policy on every response, but NOT HSTS. The `securityHeaders` array in `next.config.ts` is the only HSTS source. Verified by:
```
grep -rn "Strict-Transport-Security" apps/web/src/  →  zero hits
grep -rn "Strict-Transport-Security" apps/web/next.config.ts  →  one hit (line 11)
```

### DEP-VCL-09 fix (D-18)

Phase 35 plan must include a code edit to `apps/web/next.config.ts:11`:

```typescript
// BEFORE (current):
{ key: "Strict-Transport-Security",
  value: "max-age=63072000; includeSubDomains; preload" }

// AFTER (Phase 35 launch window):
{ key: "Strict-Transport-Security",
  value: "max-age=300" }
```

**Rationale for the value choice:** `max-age=300` (5 minutes) is the minimum value that still asserts HSTS while leaving a 5-minute escape hatch if the SSL cert breaks. It explicitly omits `includeSubDomains` and `preload` because:
1. `includeSubDomains` would propagate to any future `*.digswap.com.br` subdomain (e.g., `staging.`, `api.`) before those exist with valid certs — locking out access.
2. `preload` is permanent — once submitted to the HSTS preload list (Chrome's hardcoded list), removal takes 6-12 weeks. Not safe during launch window.

These are restored to `max-age=31536000; includeSubDomains; preload` only after Phase 38 UAT clean + 1-week soak (per Deferred section).

**Edit must be paired with a redeploy** — `next.config.ts` is bundled at build time, so the change requires a fresh Vercel build to take effect. Sequence: edit → commit → push → Vercel auto-builds (or `vercel deploy --prod --force` to skip cache).

**Verification post-deploy:**
```bash
curl -sI https://<URL>.vercel.app | grep -i strict-transport-security
# Expected: strict-transport-security: max-age=300
```

### Other security headers — sanity confirmation (D-19)

| Header | Source | Verified present? |
|--------|--------|-------------------|
| Content-Security-Policy | `apps/web/src/middleware.ts:23` (dynamic, nonce-based via `generateCspHeader`) | YES |
| X-Frame-Options: DENY | `next.config.ts:14` | YES |
| X-Content-Type-Options: nosniff | `next.config.ts:18` + `middleware.ts:27` | YES (double-set; benign) |
| Referrer-Policy: strict-origin-when-cross-origin | `middleware.ts:28` | YES |
| Permissions-Policy: camera=(), microphone=(), geolocation=() | `next.config.ts:26` + `middleware.ts:29` | YES |
| X-DNS-Prefetch-Control: on | `next.config.ts:7` | YES |

All non-HSTS security headers stay as-is. Phase 35 only changes HSTS.

---

## 8. Post-Build Secret Grep Methodology (Pitfall #1, DEP-VCL-04, DEP-VCL-05)

The detection script at PITFALLS.md §1 lines 42-46 is the canonical pattern:

```bash
# 1. Build locally with the same env Vercel will use.
NODE_ENV=production pnpm --filter @digswap/web build

# 2. Grep static client bundles for secret patterns.
grep -r "service_role\|SUPABASE_SERVICE_ROLE\|STRIPE_SECRET\|HANDOFF_HMAC\|IMPORT_WORKER_SECRET\|RESEND_API_KEY\|DISCOGS_CONSUMER_SECRET\|UPSTASH_REDIS_REST_TOKEN\|DATABASE_URL" apps/web/.next/static/ \
  || echo "clean"

# 3. Any hit = abort deploy.
```

### Strategy for Phase 35

The CRITICAL insight: **the grep must run against the actual production build artifact**, not against a dev build. Three viable paths, ranked best to worst:

#### Strategy A (RECOMMENDED): `vercel build` locally with prod env

The Vercel CLI exposes `vercel build` which reproduces the production build locally using the same logic Vercel's runner uses, including env-var resolution from the linked project.

```bash
# After all 21 prod env vars are populated (§2.3 complete):
cd apps/web
vercel pull --yes --environment=production    # writes .vercel/.env.production.local
vercel build --prod                            # builds to apps/web/.vercel/output/
# Static assets that ship to the browser:
grep -r "service_role\|SUPABASE_SERVICE_ROLE\|STRIPE_SECRET\|HANDOFF_HMAC\|IMPORT_WORKER_SECRET\|RESEND_API_KEY\|DISCOGS_CONSUMER_SECRET\|UPSTASH_REDIS_REST_TOKEN\|DATABASE_URL" .vercel/output/static/ \
  || echo "clean"
# Also check .next/static (Next's intermediate output) for completeness:
grep -r "service_role\|SUPABASE_SERVICE_ROLE\|STRIPE_SECRET\|HANDOFF_HMAC\|IMPORT_WORKER_SECRET\|RESEND_API_KEY\|DISCOGS_CONSUMER_SECRET\|UPSTASH_REDIS_REST_TOKEN\|DATABASE_URL" .next/static/ \
  || echo "clean"
# Cleanup: shred the prod env file after grep completes.
shred -u .vercel/.env.production.local 2>/dev/null || rm .vercel/.env.production.local
cd -
```

**Why this is best:** uses the actual prod env values that Vercel will inline, so a misprefixed `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` (Pitfall #1) would surface in the grep. Strategy B (next) only catches code-level prefix bugs, not env-var-name bugs.

#### Strategy B: `pnpm build` with manually-constructed `.env.production.local`

```bash
# Hand-craft a .env.production.local file from the var inventory.
# (Risky: needs all 21 values; typo in this file ≠ what's in Vercel.)
cd apps/web
pnpm build
grep ... .next/static/
```

**Why not:** drift between hand-crafted file and what's actually in Vercel. Use only if `vercel build` is unavailable.

#### Strategy C: post-deploy grep against the Vercel deployment

Vercel exposes `_next/static/` chunks at `https://<deployment>.vercel.app/_next/static/chunks/*.js`. Crawling all chunk URLs and grepping is theoretically possible but:
- Need to enumerate all chunks (parse `apps/web/.next/static/chunks/*.js` → URL paths; or hit `/_next/data/<buildId>/...` to get the manifest).
- Vercel's deployment protection adds auth headers — `vercel curl` handles this.
- Slower (network round-trip per chunk) than local grep.

**Why not:** much slower than Strategy A; only useful as a final paranoia check after deploy.

### DEP-VCL-05 companion check

DEP-VCL-05 says "exactly 7 env vars carry the `NEXT_PUBLIC_` prefix." Two complementary verifications:

1. **CLI side:** `vercel env ls production` then `grep -c '^NEXT_PUBLIC_'` (or use `/env list` and visually count).
2. **Code side:** Verify `apps/web/src/lib/env.ts` `publicSchema` (lines 38-55) declares exactly 7 NEXT_PUBLIC_ keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY`, `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL`, `NEXT_PUBLIC_MIN_DESKTOP_VERSION`. **Verified — exactly 7.** (`NEXT_PUBLIC_SENTRY_DSN` is in the env-file template but NOT in the `publicSchema` because Sentry is conditionally imported; it's parsed via `process.env.NEXT_PUBLIC_SENTRY_DSN` directly in `instrumentation-client.ts` and is empty for Phase 35 anyway.)

   The mismatch (template has `NEXT_PUBLIC_SENTRY_DSN`, schema doesn't include it) means the **count from `vercel env ls production`** could legitimately be 7 OR 8 depending on whether Sentry DSN is added. **Recommendation:** for Phase 35 (Sentry deferred per D-08), do NOT add `NEXT_PUBLIC_SENTRY_DSN` to Vercel — keep the count strictly at 7 to make DEP-VCL-05 trivially pass. Phase 39 adds it and DEP-VCL-05 will need re-evaluation.

### Evidence file

```text
# evidence/04-secret-grep-static.txt
$ grep -r "service_role|SUPABASE_SERVICE_ROLE|STRIPE_SECRET|HANDOFF_HMAC|IMPORT_WORKER_SECRET|RESEND_API_KEY|DISCOGS_CONSUMER_SECRET|UPSTASH_REDIS_REST_TOKEN|DATABASE_URL" apps/web/.vercel/output/static/
clean

$ grep -r "service_role|...|DATABASE_URL" apps/web/.next/static/
clean

NEXT_PUBLIC_ count (from vercel env ls production): 7 (expected 7)
```

---

## 9. HANDOFF_HMAC_SECRET / IMPORT_WORKER_SECRET Regen Flow (DEP-VCL-06)

Both vars must be fresh-generated for prod (D-14, D-15). The `openssl` binary is available on Git Bash on Windows at `/mingw64/bin/openssl` (verified with `which openssl` + `openssl rand -hex 4` smoke test returning 8 hex chars). The Phase 34 D-05 mitigation requires that **values never appear in user-visible output and never enter user clipboard or files**.

### One-shot pattern (RECOMMENDED)

```bash
# Generate AND inject in a single pipe — value never lives in a shell variable
# that could leak into history or a screen scrollback buffer.
openssl rand -hex 32 | vercel env add HANDOFF_HMAC_SECRET production --sensitive
openssl rand -hex 32 | vercel env add IMPORT_WORKER_SECRET production --sensitive
```

Why this is safe:
- `openssl rand -hex 32` writes 64 hex chars to stdout (no trailing newline issue for `vercel env add` — the CLI strips a single trailing `\n`).
- The pipe is **anonymous** — the value never enters `process.env`, never lives in a shell variable, never appears in `bash` history (Bash does not log piped data).
- `--sensitive` marks the var as encrypted-at-rest. Once added, even the user cannot read the value back via Dashboard.
- Bash sandbox: this is a single Bash call → single `vercel` invocation → one possible device-code prompt. If `VERCEL_TOKEN` is exported (per §13), zero prompts.

### Two-shot variant (NOT RECOMMENDED but safer if `vercel env add` errors mid-pipe)

```bash
# Generate to temporary in-memory variable, inject, immediately unset.
H_VALUE=$(openssl rand -hex 32)
printf "%s" "$H_VALUE" | vercel env add HANDOFF_HMAC_SECRET production --sensitive
unset H_VALUE
```

Slightly riskier (the value briefly lives in a shell variable; on Windows Bash, this could appear in `.bash_history` if the user runs `set` or `env` while it's set). The one-shot pattern is strictly better. Use the two-shot only if the one-shot fails and we need to retry without re-generating.

### Preview scope

Per D-13, the Preview scope of these secrets points at the **dev** values. The dev values are already in `apps/web/.env.local` (untouched per D-16). So:

```bash
# Read the dev value from the local .env.local — gitignored, owned by user.
HANDOFF_DEV=$(grep '^HANDOFF_HMAC_SECRET=' apps/web/.env.local | cut -d'=' -f2-)
printf "%s" "$HANDOFF_DEV" | vercel env add HANDOFF_HMAC_SECRET preview --sensitive
unset HANDOFF_DEV
```

The dev value **does** transit through the AI context (D-05 acknowledged trade-off). Preview-scope dev secrets are lower blast-radius than prod-scope, but should still be `--sensitive`-marked.

### Verification

`HANDOFF_HMAC_SECRET` has `min(32)` validation in `apps/web/src/lib/env.ts:19` when `NODE_ENV=production || VERCEL` is set. Vercel-side validation: at first `vercel build`, env.ts will throw if the value is shorter than 32 chars. So the build itself is the proof of correct length.

Additional sanity check (length-only, never value):

```bash
# Pull production env into a temp file, check length only, shred.
TMPFILE=$(mktemp)
vercel env pull "$TMPFILE" --environment=production --yes
LEN=$(grep '^HANDOFF_HMAC_SECRET=' "$TMPFILE" | cut -d'=' -f2- | wc -c)
echo "HANDOFF_HMAC_SECRET length: $LEN (expected 65 = 64 hex chars + 1 newline)"
[ "$LEN" -eq 65 ] || echo "FAIL: unexpected length"
shred -u "$TMPFILE" 2>/dev/null || rm "$TMPFILE"
```

---

## 10. Playwright Smoke Config (D-17)

### Current state

`apps/web/playwright.config.ts` has THREE problems for D-17's "smoke against `*.vercel.app`" requirement:

1. **`baseURL: "http://localhost:3000"`** is hardcoded (line 22). Must be overridable.
2. **`webServer` block (lines 33-38)** auto-starts `pnpm dev` and waits for `http://localhost:3000`. Will fail (or worse, mask the real test target) when running against Vercel.
3. **No env-var-driven configuration** — there's no `process.env.PLAYWRIGHT_BASE_URL` fallback.

### Recommended config edit

```typescript
// apps/web/playwright.config.ts (Phase 35 edit)
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const isRemote = BASE_URL.startsWith("https://");

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
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
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Only auto-start dev server when targeting localhost.
  ...(isRemote ? {} : {
    webServer: {
      command: "pnpm dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  }),
});
```

This change is **part of the Phase 35 plan** (it's the prerequisite for D-17). After the edit, run smoke against the Vercel deployment:

```bash
cd apps/web
PLAYWRIGHT_BASE_URL="$URL" pnpm test:e2e
# where $URL is the *.vercel.app URL captured from `vercel deploy --prod` stdout.
```

### Test selection — which existing specs are smoke-suitable

The current `tests/e2e/` directory has 14 spec files. For Phase 35 (no test user provisioned, no email verification flow against prod Supabase), the smoke must be **anonymous-only**. Verified by reading:

| Spec | Tests | Anonymous? | Smoke-suitable for Phase 35? |
|------|-------|-----------|------------------------------|
| `landing.spec.ts` | 3 | YES (homepage hero + signup CTA + signin link) | YES |
| `auth-flow.spec.ts` | 5 of 5 anon tests + 4 `.skip()` authed tests | YES (form rendering) | YES — the 4 skipped tests stay skipped |
| `pricing.spec.ts` | 9 anon tests | YES | YES |
| `release.spec.ts` | 1 | Likely | Needs verification |
| `public-profile.spec.ts` | 1 | YES (anonymous-viewable profile route) | Needs valid public username on prod (skip if absent) |
| `onboarding.spec.ts`, `collection.spec.ts`, `community.spec.ts`, `crates.spec.ts`, `explore.spec.ts`, `navigation.spec.ts`, `notifications.spec.ts`, `settings.spec.ts`, `trades.spec.ts` | various | ALL require auth | NO — these will hit `/signin` redirects and either fail or be useless |

**Recommendation: run the WHOLE suite** (per D-17 user choice), accept that the auth-required specs will fail or self-skip on a prod target without seeded test users, and **document the expected pass/fail breakdown in the plan**. Authed tests that fail with redirect-to-signin are non-blocking signal (the redirect itself proves middleware works); authed tests that 500 are blocking.

### Auth state for smoke

The fixture at `tests/e2e/fixtures/auth.ts` reads `E2E_USER_EMAIL` + `E2E_USER_PASSWORD` from env and signs in via the UI. For Phase 35 prod target:

- **Option A (RECOMMENDED for Phase 35):** do NOT set `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`. The fixture auto-skips authed tests. Smoke covers anonymous routes only — sufficient for "first build green on `*.vercel.app`" gate.
- **Option B (Phase 38 owns):** seed a dedicated `e2e@digswap.com.br` test user in prod Supabase, set the credentials in CI, run the full authed suite. This is Phase 38's job, not Phase 35's. **Defer.**

### `/api/health` smoke (Phase 35 specific)

The `/api/health` route exists at `apps/web/src/app/api/health/route.ts` and probes only the database (not Redis or Discogs — the comments overstate). Expected response on `*.vercel.app`:

```bash
curl -s "$URL/api/health" | jq .
# Expected:
# { "status": "healthy",
#   "checks": { "database": "ok" },
#   "timestamp": "2026-04-26T..." }
```

Status code 200 if `database = ok`, 503 otherwise. Critical for DEP-VCL-10 ("first build green ... `/api/health` returns 200 against that preview URL").

---

## 11. Halt-on-Fail Protocol (per-env-var Failure Recovery)

If `vercel env add KEY production` fails mid-loop (network glitch, validation error, scope rejection), the recovery rule is:

### Halt rule

> **HALT after the first failure. Do NOT skip-and-continue. Investigate the failure, fix the root cause, retry the failing var ONLY, then resume the loop from the next-not-yet-attempted var.**

### Rationale

- **Skip-and-continue is unsafe.** The 21 vars include 5 with hard validation in `apps/web/src/lib/env.ts` (`min(10)` for Stripe in production, `min(32)` for HMAC, etc.). A missing var would silently break the build with a non-obvious "Missing server environment variables" error at first request — the kind of failure that's hard to diagnose mid-deploy.
- **Each `vercel env add` is atomic.** Vercel's API is per-var; failure of var N does not affect var N-1. So halt-and-resume is safe (no partial-write state in Vercel).
- **Halt makes evidence cleaner.** A single failure surfaces in the evidence log immediately; skip-and-continue would bury 1 fail among 20 successes.

### Per-failure-class recovery

| Failure mode | Detection | Recovery |
|--------------|-----------|----------|
| Network timeout | Bash exit code != 0 + "ETIMEDOUT" / "ENOTFOUND" in stderr | Retry the same `vercel env add` once. If second attempt also fails: halt + investigate (Vercel status page, local network). |
| Auth re-prompt | "Vercel CLI device login required" output | Re-source `VERCEL_TOKEN` per §13; retry. |
| Scope rejected | "Token not authorized for team_..." | Token doesn't have access to the team. Generate new token with team scope from Dashboard. |
| Var already exists | "Environment variable already exists for production" | Either: the loop is being re-run after a partial completion (use `vercel env rm KEY production --yes` then retry) OR the var is set in two scopes (intentional). Inspect `vercel env ls`. |
| Validation rejection (rare; CLI is permissive) | CLI accepts almost anything — the build is what validates length/regex | The build will reject; fix in env.ts or in the value supplied. |

### Resume pattern

The loop should be **idempotent** — re-running it after a partial completion should not corrupt anything. Use `vercel env ls production --next 0 | grep -c "^${KEY}"` to test presence before each add, and skip if present (the user's halt-investigated-fixed state is preserved):

```bash
add_if_missing() {
  local KEY="$1"
  local VALUE="$2"
  local SCOPE="$3"
  local FLAGS="$4"
  if vercel env ls "$SCOPE" 2>/dev/null | grep -q "^${KEY}"; then
    echo "  [skip] $KEY already in $SCOPE scope"
    return 0
  fi
  printf "%s" "$VALUE" | vercel env add "$KEY" "$SCOPE" $FLAGS
  return $?
}
```

This pattern is **strongly recommended** for the Phase 35 plan because it makes mid-loop halt-resume trivial.

### Evidence on failure

Every halt produces a one-line entry in `evidence/05-env-add-loop.log` (sanitized — never values):

```text
[2026-04-26T17:42:00Z] OK    NEXT_PUBLIC_APP_URL              production
[2026-04-26T17:42:01Z] OK    NEXT_PUBLIC_SITE_URL             production
[2026-04-26T17:42:03Z] FAIL  DATABASE_URL                     production  reason="auth re-prompt"
[2026-04-26T17:43:10Z] OK    DATABASE_URL                     production  retry=1
```

---

## 12. Doc-Debt Verification (`digswap.com` vs `digswap.com.br`)

### Current state — code

Grep against `apps/web/src/`:

| File | Line | Hardcoded value | Severity |
|------|------|-----------------|----------|
| `src/app/sitemap.ts` | 9 | `publicEnv.NEXT_PUBLIC_APP_URL ?? "https://digswap.com"` | Low — fallback only; overridden by env var when set |
| `src/app/robots.ts` | 5 | `publicEnv.NEXT_PUBLIC_APP_URL ?? "https://digswap.com"` | Low — fallback only |
| `src/lib/env.ts` | 22 | `RESEND_FROM_EMAIL: z.string().optional().default("noreply@digswap.com")` | Low — overridden by Vercel env var when set |
| `src/app/api/og/rarity/[username]/route.tsx` | 166 | `{"digswap.com // find who has your Holy Grails"}` | Cosmetic — text rendered in OG image; visible to social-share viewers |

**Phase 35 impact:** ZERO blocking impact on the build, because:
- Sitemap + robots default is overridden by D-10's `NEXT_PUBLIC_APP_URL = https://digswap.com.br`.
- `RESEND_FROM_EMAIL` is overridden by the explicit Vercel env value `noreply@digswap.com.br` (Phase 35 plan must include this — it's one of the 21 vars).
- OG image text is cosmetic; visible only on social-card previews. Not a build blocker.

**Recommendation:** flag these 4 occurrences in the SUMMARY's "doc-debt for QUICK" section, do NOT bundle the rename into Phase 35 (would inflate scope by ~30 minutes of off-topic edits per Phase 34 SUMMARY's analogous flag).

### Current state — `.planning/` docs

18 files in `.planning/` reference `digswap.com` (without `.br`):

```
.planning\phases\035-vercel-environment-wiring\035-DISCUSSION-LOG.md
.planning\phases\035-vercel-environment-wiring\035-CONTEXT.md
.planning\ROADMAP.md
.planning\phases\034-supabase-production-setup\* (many)
.planning\research\STACK.md
.planning\research\PITFALLS.md
.planning\research\ARCHITECTURE.md
.planning\research\SUMMARY.md
.planning\research\ADR-001-strategic-direction.md
```

Many of these are inside Phase 34's evidence/SUMMARY/PLAN files — historical record. The active drift is in the research/* and ROADMAP/REQUIREMENTS/PROJECT files.

**Phase 34 SUMMARY** already flagged this for follow-up: *"CONTEXT.md, ROADMAP.md, REQUIREMENTS.md, PROJECT.md, and many .planning/research/*.md files reference `digswap.com` (without `.br`). The real domain is `digswap.com.br`. ... Should be a follow-up `/gsd:quick` command after Phase 34 closes."*

**Recommendation for Phase 35 SUMMARY:** restate the same flag with the 4 source-code files **added** to the QUICK scope. Suggested QUICK title:

> `domain rename: digswap.com → digswap.com.br across .planning/ docs AND apps/web/src/{sitemap.ts,robots.ts,lib/env.ts,app/api/og/rarity/[username]/route.tsx}`

Phase 35 itself should not block on this.

---

## 13. Vercel CLI Device-Code Re-Prompt Mitigation (D-20)

### Verified state

- Vercel CLI auth file location on Windows: `$HOME/AppData/Roaming/com.vercel.cli/Data/auth.json` (confirmed, 227 bytes, mode 644, last-modified 2026-04-26T17:39).
- The CLI prefers `VERCEL_TOKEN` env var over the on-disk auth file. Source: `vercel-cli/references/ci-automation.md` line 3: *"Use `VERCEL_TOKEN` env var (not `--token` — it leaks in process listings)."*
- The Claude Code Bash sandbox spawns a fresh sub-shell per `Bash(...)` tool call. Environment variables set by `export VAR=...` do NOT persist between calls. Verified by Phase 34 D-04 recon (2 sequential `vercel teams ls` + `vercel projects ls` calls triggered 2 device codes).

### Recommended path

**Strategy 1 (PRIMARY): `VERCEL_TOKEN` from a gitignored local file, sourced per Bash call.**

```bash
# One-time user setup (NOT in plan — user does this manually):
# 1. Vercel Dashboard → Settings → Tokens → Create Token
# 2. Scope = team_WuQK7GkPndJ2xH9YKvZTMtB3
# 3. Expiration = 30 days
# 4. echo "<token>" > $HOME/.vercel-token  &&  chmod 600 $HOME/.vercel-token

# Every Bash call that runs `vercel` starts with:
export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"
```

Why this is the cleanest:
- Zero re-prompts (the CLI sees the token, never falls back to device code).
- Token lives outside the repo (`$HOME/`), gitignored implicitly (not in any tracked path).
- File mode `600` restricts to the user.
- Plan instructions never read or echo the token — only `cat $HOME/.vercel-token` is in scripts, and the value is consumed only by the CLI.
- Token rotates every 30 days (user owns), or per phase if user prefers.

**Strategy 2 (FALLBACK): Bundle multiple operations in a single Bash heredoc.**

When `VERCEL_TOKEN` is not yet set up (first Bash call of the phase), batch operations into one Bash invocation:

```bash
# Single Bash tool call — single sub-shell, one possible device-code prompt total.
{
  vercel link --repo --yes --scope ... --project ...
  vercel project add digswap-web --scope ...
  echo "<value>" | vercel env add NEXT_PUBLIC_APP_URL production
  echo "<value>" | vercel env add NEXT_PUBLIC_SITE_URL production
  # ... rest of the env add loop ...
} 2>&1
```

This works because the device-code prompt happens once on first auth in a sub-shell; subsequent commands in the same sub-shell reuse the in-memory auth.

**Strategy 3 (NOT RECOMMENDED): `--token` flag.**

```bash
vercel deploy --token "$(cat $HOME/.vercel-token)" --prod
```

Why not: the vercel-cli skill explicitly warns *"`--token` ... leaks in process listings."* Some Bash environments echo command lines to syslog or `ps`. `VERCEL_TOKEN` env var is the safer pattern.

### Phase 35 plan implications

The plan should:
1. Have a **Wave 0 task** that asks the user to create the `~/.vercel-token` file ONCE (not in a loop, manual one-time setup).
2. Every subsequent Bash task starts with `export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"`.
3. **Use MCP for read/observability** (`list_deployments`, `get_deployment`, `get_runtime_logs`) — these don't use the CLI at all and are OAuth-bound to the user's Vercel account.

If at any point the plan needs a Bash CLI call **without** `VERCEL_TOKEN` (e.g., user forgot to create the file), the device-code prompt will fire — the user clicks the URL, authenticates, and the CLI proceeds. This is the **graceful degradation path**; it works but adds friction.

---

## 14. Validation Architecture (Nyquist Gate — MANDATORY)

`.planning/config.json` has `workflow.nyquist_validation: true`. This section is required.

### Test framework

| Property | Value |
|----------|-------|
| **Frameworks** | Playwright `^1.58.2` (E2E) + Vitest `^4.1.2` (unit/integration) |
| **Config files** | `apps/web/playwright.config.ts`, `apps/web/vitest.config.ts` |
| **Quick run command (Phase 35 smoke)** | `cd apps/web && PLAYWRIGHT_BASE_URL="$URL" pnpm test:e2e --grep "@smoke"` (after we tag tests; for now, run the full suite) |
| **Full Playwright suite** | `cd apps/web && PLAYWRIGHT_BASE_URL="$URL" pnpm test:e2e` |
| **Manual `/api/health` probe** | `curl -sf "$URL/api/health" \| jq -e '.status == "healthy"'` |
| **Vitest typecheck + unit (CI-equivalent, optional)** | `pnpm typecheck && pnpm test` |

### Phase requirements → test map

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|-------------|
| **DEP-VCL-01** | Project linked to GitHub, Root Directory = `apps/web`, build succeeds | smoke | `vercel inspect $URL --logs` returns READY + framework=Next.js + Node 20.x | ✅ (CLI) |
| **DEP-VCL-02** | All 21 prod env vars set in Production scope | smoke | `vercel env ls production \| wc -l` returns 21+; companion key-presence script in §4 | ✅ (CLI) |
| **DEP-VCL-03** | Preview env vars point at dev Supabase | smoke | `vercel env pull --environment=preview <tmp>` then `grep mrkgoucqcbqjhrdjcnpw <tmp>` returns 1+ hits | ✅ (CLI) |
| **DEP-VCL-04** | `.next/static/` zero secret hits | smoke | `grep -r "service_role\|SUPABASE_SERVICE_ROLE\|STRIPE_SECRET\|HANDOFF_HMAC\|IMPORT_WORKER_SECRET\|RESEND_API_KEY\|DISCOGS_CONSUMER_SECRET\|UPSTASH_REDIS_REST_TOKEN\|DATABASE_URL" apps/web/.vercel/output/static/ apps/web/.next/static/` (after `vercel build --prod`) → "clean" | ✅ (Bash) |
| **DEP-VCL-05** | Exactly 7 NEXT_PUBLIC_ vars | smoke | `vercel env ls production \| grep -c '^NEXT_PUBLIC_'` returns 7 | ✅ (CLI) |
| **DEP-VCL-06** | HANDOFF + IMPORT secrets fresh-generated >=32 chars | smoke | length check via `vercel env pull` then `grep \| cut \| wc -c` (length-only, never value) | ✅ (Bash) |
| **DEP-VCL-07** | Vercel Pro active | **N/A — DEFERRED per D-03** | — | — |
| **DEP-VCL-08** | Node.js runtime = 20 in Project Settings | smoke | `vercel inspect $URL` output `Node.js Version: 20.x` | ✅ (CLI) |
| **DEP-VCL-09** | HSTS = `max-age=300` | smoke | `curl -sI $URL \| grep -i 'strict-transport-security: max-age=300'` returns one match | ✅ (Bash) |
| **DEP-VCL-10** | First build green on `*.vercel.app`, /api/health 200 | smoke + e2e | `curl -sf $URL/api/health \| jq -e '.status == "healthy"'` AND `pnpm test:e2e` (anon-only specs, ~5-7 anon test files × ~3-9 tests each → ~30 assertions) | ✅ (Playwright) |

### Sampling rate

- **Per task commit:** the relevant verification (e.g., adding HSTS edit to next.config.ts triggers `curl -sI $URL` after redeploy). For env-var add tasks: `vercel env ls production` to confirm presence.
- **Per wave merge:** full per-DEP-VCL verify (all 9 in-scope checks above).
- **Phase gate (`/gsd:verify-work`):** ALL 9 in-scope checks pass + Playwright anon suite green against `BASE_URL=$URL` + manual user UAT click-through of `/`, `/signin`, `/signup`, `/pricing`.

### Wave 0 gaps

- [ ] **Edit `apps/web/playwright.config.ts`** to support `PLAYWRIGHT_BASE_URL` env var override and conditional `webServer` block (§10). This is a code change, not infrastructure — must be a Wave 0 task before D-17 smoke can run against `*.vercel.app`.
- [ ] **Edit `apps/web/next.config.ts:11`** to reduce HSTS to `max-age=300` (§7). Wave 0 task; the deploy that consumes this edit is what tests DEP-VCL-09.
- [ ] **User-side prep (out-of-band, not a code task):** create `$HOME/.vercel-token` file with a 30-day Vercel API token scoped to `team_WuQK7GkPndJ2xH9YKvZTMtB3`. Without this, every Bash CLI call may trigger a device-code prompt (D-20). Plan should call this out as a precondition, not as a runnable task.
- [ ] **Add `evidence/` directory under `.planning/phases/035-vercel-environment-wiring/`** mirroring Phase 34 structure (Plan 01 task to create `.gitkeep` + `00-path-deviation.md` if/when path deviation occurs).

### Evidence file inventory (recommended, paralleling Phase 34)

```
evidence/
├── .gitkeep
├── 00-path-deviation.md             — log MCP-vs-CLI choice for write ops + VERCEL_TOKEN strategy
├── 01-link-confirm.txt              — vercel whoami + vercel project ls output (sanitized)
├── 02-env-add-loop.log              — 21 production-scope add results (KEY + SCOPE + sensitive flag, never values)
├── 02b-env-add-preview.log          — Preview-scope add results
├── 03-env-pull-prod-audit.txt       — sanitized audit: NEXT_PUBLIC_ count, expected-key-presence map
├── 03b-env-pull-preview-audit.txt   — sanitized audit: confirms Preview points at dev Supabase
├── 04-secret-grep-static.txt        — grep results from §8 (zero hits expected)
├── 05-hsts-curl.txt                 — `curl -sI $URL \| grep -i strict-transport` post-deploy
├── 06-deploy-inspect.txt            — `vercel inspect $URL` (build duration, Node version, framework)
├── 07-health-probe.txt              — `curl $URL/api/health` (200 + database:ok)
├── 08-playwright-smoke.txt          — Playwright run summary (passed/skipped/failed counts) + report path
└── 09-verify-final.txt              — single-pass DEP-VCL-{01..10} status table + sign-off
```

---

## Project Constraints (from CLAUDE.md)

- **Solo developer / GSD enforced:** Phase 35 is executed via GSD slash commands (`/gsd:execute-phase`); no direct Edit/Write outside that flow.
- **Stack alignment:** Vercel + Supabase + pnpm@10.30.3 (root) + Next.js 15.5.15 + React 19.1.0 + Drizzle ORM 0.45.x. Vercel Project Settings must reflect this (Node 20, pnpm install).
- **Security:** OWASP coverage mandatory; HSTS + CSP + CSP nonce + Referrer-Policy already enforced. Phase 35 reduces HSTS but maintains all other headers (D-19).
- **No mobile native:** `apps/desktop` is NOT deployed to Vercel. Only `apps/web` ships to Vercel.
- **Skills available:** `digswap-appsec`, `digswap-devops`, `digswap-dba`, `digswap-qa`, `digswap-sre`, `digswap-release` — at minimum, the `digswap-devops` skill is relevant for Phase 35 verification (Vercel deploy, env management, rollback).

---

## Standard Stack

### Tools (verified versions, fetched 2026-04-26)

| Tool | Version | Purpose | Source |
|------|---------|---------|--------|
| Vercel CLI | **52.0.0** | Project provisioning, env var management, deploy | `npm view vercel version` (current as of research date) |
| Node.js (Vercel runtime) | **20** | Pinned in Vercel Project Settings (D-04) | matches CI |
| pnpm | **10.30.3** | Package manager (root `package.json`) | repo `package.json` |
| Next.js | **15.5.15** | App framework (apps/web) | `apps/web/package.json` (current; latest npm: 16.2.4 — D-04 carries forward 15 per stack lock) |
| Playwright | **^1.58.2** | E2E smoke (D-17) | `apps/web/package.json` |
| Vitest | **^4.1.2** | Unit/integration | `apps/web/package.json` |
| openssl | mingw64 build | Secret generation (`rand -hex 32`) | `which openssl` → `/mingw64/bin/openssl` |
| Vercel MCP | beta (mcp.vercel.com) | Read/observability tools | `.mcp.json` (OAuth-authenticated) |
| Vercel Plugin | `vercel@claude-plugins-official` v0.40.0 | `/env`, `/deploy`, `/status`, `/bootstrap` slash commands | `~/.claude/plugins/cache/claude-plugins-official/vercel/0.40.0/` |

### Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Bulk env var population | A custom shell script that wraps `curl` to Vercel REST API | `vercel env add <KEY> <ENV>` with stdin pipe | CLI handles auth + scope + idempotency + the `--sensitive` flag |
| Secret randomness | A homebrew JS script | `openssl rand -hex 32` | Audited, zero-dependency, available everywhere |
| Build verification | Hand-crafted `.env.production.local` then `pnpm build` | `vercel pull --environment=production && vercel build --prod` | Uses Vercel's actual env resolution; catches misprefix bugs the manual path can't |
| Deploy observability polling | Direct `curl` to Vercel API | MCP `list_deployments` + `get_deployment` | Zero re-auth; structured output |
| Auth persistence | Re-running `vercel login` per Bash call | `VERCEL_TOKEN` env var sourced from `~/.vercel-token` | Skips the device-code flow entirely |

---

## Architecture Patterns

### Pattern 1: Project Settings via Dashboard, env vars via CLI

The Dashboard is best for one-time, idempotent settings (Root Directory, production branch, Node version, build command, install command). The CLI is best for repeatable, scriptable operations (env add per-var, deploy, env pull). Mixing these is the "MCP-first / CLI for writes" model from Phase 34 (Phase 34 D-05) — keeps each operation in its native medium.

### Pattern 2: Per-scope env-var isolation (Pitfall #9 prevention)

Every secret that has a different value between Production and Preview is added in TWO calls:
```bash
echo "$PROD_VALUE" | vercel env add KEY production --sensitive
echo "$DEV_VALUE"  | vercel env add KEY preview --sensitive
```
Vercel's UI defaults to "All Environments" — to avoid that footgun, the CLI's positional `<env>` arg is **never omitted**.

### Pattern 3: One-shot pipe for fresh secrets

`openssl rand -hex 32 | vercel env add NAME production --sensitive` — value never enters a shell variable, never enters bash history, never appears in any log.

### Pattern 4: Idempotent halt-resume loop

The plan's add-loop calls `vercel env ls $SCOPE | grep -q "^${KEY}"` before each `add` — skip-if-present makes the loop safe to re-run after a partial completion.

### Anti-patterns

- **`vercel link` (without `--repo`) in a monorepo** — vercel-cli skill anti-pattern: creates `project.json` instead of `repo.json`, only tracks one project.
- **`--token` flag** — leaks in process listings; use `VERCEL_TOKEN` env var.
- **Skip-and-continue on env add failure** — see §11.
- **`vercel.json` headers when Next.js sets headers** — duplication causes hard-to-diagnose conflicts; let `next.config.ts headers()` be the single source.

---

## Common Pitfalls (Phase 35-specific, condensed)

### Pitfall A: NEXT_PUBLIC_ misprefix on a server secret
**Source:** PITFALLS.md §1 (P0). **Detection:** §8 grep methodology + §4 `vercel env pull` then count NEXT_PUBLIC_. **Mitigation:** Plan's verify step runs both checks before declaring DEP-VCL-04/-05 PASS.

### Pitfall B: Preview deploys writing to prod Supabase
**Source:** PITFALLS.md §9 (P0). **Detection:** `vercel env pull --environment=preview` then grep for `mrkgoucqcbqjhrdjcnpw` (dev project_ref) in NEXT_PUBLIC_SUPABASE_URL — must be present. **Mitigation:** D-13 enforces dev-only Preview scope; verify step runs the pull-and-grep.

### Pitfall C: Cold-start 500 on `/`, `/signin`, `/signup`, `/pricing`
**Source:** PITFALLS.md §8 (P0). Commit `35ed595` claims a fix. **Phase 38 owns full cold-start verify**, but Phase 35 build-smoke can spot regressions early via the Playwright `landing.spec.ts`, `auth-flow.spec.ts`, `pricing.spec.ts` runs against the cold `*.vercel.app`. If these specs go red on a fresh deploy → halt phase, investigate.

### Pitfall D: HSTS locking users out
**Source:** PITFALLS.md §13 (P0). **Detection:** Phase 35 reduces HSTS to `max-age=300` (D-18). **Verification:** §7 — `curl -sI $URL | grep strict-transport` post-deploy.

### Pitfall E: Vercel Hobby non-commercial ToS
**Source:** PITFALLS.md §22 (P1). **Phase 35 OK** because there is no Stripe Live in v1.4 free-tier launch. Re-evaluate at first paying user (DEP-VCL-07 deferred trigger).

### Pitfall F: Bandwidth / function-invocation overage
**Source:** PITFALLS.md §25 (P2). The middleware matcher (`apps/web/src/middleware.ts:34-46`) already excludes `_next/static`, `_next/image`, image extensions, and `api/og/`. No additional tightening needed for Phase 35; Phase 39 (monitoring) sets the 80% billing alert.

### Pitfall G: Dev HMAC secret in prod
**Source:** PITFALLS.md §29. **Mitigation:** §9 one-shot pipe pattern fresh-generates both secrets; `min(32)` validation in env.ts:19 fails the build if the value is short.

---

## Code Examples (Verified Patterns)

### A. Non-interactive env add (env-vars skill, official)
```bash
echo "secret-value" | vercel env add MY_SECRET production
echo "secret-value" | vercel env add MY_SECRET production --sensitive
```

### B. Bootstrap-skill pattern for generated secret (canonical, never echoes)
```bash
AUTH_SECRET="$(node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))")"
printf "%s" "$AUTH_SECRET" | vercel env add AUTH_SECRET development preview production
unset AUTH_SECRET
vercel env pull .env.local --yes
```
*Adapted for Phase 35: replace `node -e ...` with `openssl rand -hex 32` (already verified available on Git Bash); replace multi-env with `production` only.*

### C. Monorepo link (monorepos reference)
```bash
vercel link --repo --yes --scope team_WuQK7GkPndJ2xH9YKvZTMtB3 --project digswap-web
```

### D. Capture deploy URL (deployment reference)
```bash
URL=$(vercel deploy --prod --yes 2>/dev/null)
# stdout = URL, stderr = progress
```

### E. CI-style auth (ci-automation reference)
```bash
export VERCEL_TOKEN="$(cat $HOME/.vercel-token)"
vercel pull --yes --environment=production
vercel build --prod
vercel deploy --prebuilt --prod --scope team_WuQK7GkPndJ2xH9YKvZTMtB3
```
*Phase 35 will not use `--prebuilt` for the first deploy (we want Vercel's runner to build), but `VERCEL_TOKEN` pattern transfers directly.*

---

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| `vercel link` (single-project) | `vercel link --repo` (creates `repo.json`) | Vercel CLI 33+ | DigSwap's pnpm workspace requires this |
| `--token` flag | `VERCEL_TOKEN` env var | CLI 40+ | Avoids process-listing leak |
| Manual `.env.production.local` for build | `vercel pull --environment=production && vercel build --prod` | CLI 36+ | Catches env-var bugs the manual path can't |
| Setting all env vars to "All Environments" (default UI) | Per-scope `vercel env add KEY <env>` | always preferred | Pitfall #9 isolation |
| `--sensitive` flag for secrets | Optional in CLI 33, recommended in CLI 50+ | CLI 50+ | Encrypted-at-rest; not readable post-creation |

### Deprecated / outdated

- **`now` CLI** (predecessor to `vercel` CLI) — replaced; `now.json` no longer recognized.
- **`vercel-action` (legacy GitHub Action)** — Vercel's Git integration replaces it for normal deploys; the Action is only needed for non-standard CI flows.

---

## Open Questions

1. **Does Vercel CLI v52 `vercel project add` accept `--scope` or only the active team?**
   - What we know: `vercel project add my-project` is documented in projects-and-teams reference (v0.40.0 plugin). `--scope` is documented globally as accepted on most commands.
   - What's unclear: whether `vercel project add --scope <team_id>` is non-interactive when the user's CLI is logged into multiple teams.
   - Recommendation: try `--scope team_WuQK7GkPndJ2xH9YKvZTMtB3` first; fall back to `vercel teams switch <team_slug>` then `vercel project add` if the scope flag is ignored.

2. **Does `vercel link --project digswap-web` require the project to exist first, or can it be combined with `vercel project add`?**
   - What we know: the bootstrap skill's example shows `vercel link --yes --project <name-or-id> --scope <team>` as a single step that links to an existing project.
   - What's unclear: whether `vercel link` would create the project on-the-fly if it doesn't exist (some CLI versions have done this; current behavior unclear).
   - Recommendation: explicit two-step (`project add` then `link --repo --project`) to make the contract clear.

3. **Will `vercel build` locally use the Production-scope env vars even though we run it from a developer machine?**
   - What we know: `vercel pull --environment=production` writes `.vercel/.env.production.local` with the resolved Production scope values. `vercel build --prod` reads from that file.
   - What's unclear: whether Next.js's NEXT_PUBLIC_* variable inlining at build time honors `.vercel/.env.production.local` correctly (vs `apps/web/.env.production.local`). The build runs from `apps/web/` (subdir of the linked monorepo), so file resolution might differ.
   - Recommendation: after `vercel pull`, inspect what file was written and where; if `.vercel/.env.production.local` is in the wrong directory, copy or symlink to where Next.js expects it. Document the actual behavior in evidence.

4. **What is the default `Strict-Transport-Security` value Vercel adds at the platform level?**
   - What we know: Vercel does NOT add HSTS by default to `*.vercel.app` deployments (only Custom Domains get HSTS automatically, and even that's opt-in).
   - What's unclear: whether `*.vercel.app` deployments get any HSTS at all, or whether ours will be the only HSTS source.
   - Recommendation: post-first-deploy, run `curl -sI <url>.vercel.app | grep -i strict-transport` and document what shows up. Then verify the `next.config.ts` value is the only HSTS in the response.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `vercel` CLI | All §2 commands | YES | v52.0.0 (current) | — |
| `openssl` | §9 secret generation | YES | mingw64 build (`/mingw64/bin/openssl`) | `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` |
| Vercel MCP | §5 deploy observability | YES | beta (https://mcp.vercel.com), OAuth as `thiagobraidatto-3732` | `vercel inspect $URL --logs` (CLI fallback) |
| Vercel Plugin (`/env`, `/deploy`) | §3 capability test | YES | v0.40.0 (cache: `~/.claude/plugins/cache/claude-plugins-official/vercel/0.40.0/`) | bare CLI commands |
| Playwright + Chromium | §10 smoke run | YES | Playwright 1.58.2; Chromium installed Phase 33.1 | run only `landing.spec.ts` + `auth-flow.spec.ts` (anon) via `--grep` |
| pnpm | Vercel build (workspace install) | YES | 10.30.3 (matches Vercel auto-detect) | — |
| Node 20 | CI + Vercel runtime | YES on dev machine; YES on Vercel after D-04 setting | 20.x | — |
| `~/.vercel-token` file | §13 auth mitigation | NOT YET — user-side prep task | — | bundle Bash heredoc per Strategy 2 |

**Missing dependency with no fallback:** none.
**Missing dependency with fallback:** `~/.vercel-token` (user creates once); fallback is bundled-heredoc strategy + accept device-code prompts.

---

## Sources

### Primary (HIGH confidence)
- **Vercel Plugin `/env` slash command:** `~/.claude/plugins/cache/claude-plugins-official/vercel/0.40.0/commands/env.md` — verified pattern for non-interactive add via stdin pipe, never-echo-secrets rule, scope semantics
- **Vercel Plugin `env-vars` skill:** `.../skills/env-vars/SKILL.md` — bootstrap flow + AUTH_SECRET generation pattern (one-shot pipe)
- **Vercel Plugin `vercel-cli` skill + references:** `.../skills/vercel-cli/SKILL.md`, `references/{ci-automation,environment-variables,deployment,monorepos,monitoring-and-debugging,projects-and-teams}.md` — exact command surface
- **Vercel Plugin `/deploy`, `/bootstrap`, `/status` commands:** `.../commands/{deploy,bootstrap,status}.md` — patterns for production-confirmation, drain check, post-deploy error scan
- **Codebase facts (verified by direct read):** `apps/web/next.config.ts:11` (HSTS source), `apps/web/src/middleware.ts:5-46` (CSP + headers), `apps/web/src/lib/env.ts:9-55` (Zod schema), `apps/web/.env.local.example` (var inventory), `apps/web/playwright.config.ts:22-38` (smoke target hardcoded), `apps/web/tests/e2e/{landing,auth-flow,pricing}.spec.ts` (anon-suitable specs), `apps/web/src/app/api/health/route.ts` (probe behavior), `apps/web/package.json` (build/test scripts), `apps/web/tests/e2e/fixtures/auth.ts` (skip-if-no-creds pattern), root `package.json` + `pnpm-workspace.yaml` (monorepo shape), `.gitignore` (`.vercel`, `.env*` covered)
- **Vercel CLI version:** `npm view vercel version` → 52.0.0 (verified 2026-04-26)
- **Vercel CLI auth file location on Windows:** verified path + size at `$HOME/AppData/Roaming/com.vercel.cli/Data/auth.json`
- **`openssl rand -hex` availability on Git Bash:** verified with `which openssl` + `openssl rand -hex 4` smoke test
- **PITFALLS.md §1, §8, §9, §13, §22, §25, §29:** the P0 set flagged for Phase 35; copy patterns reused

### Secondary (MEDIUM confidence)
- **Phase 34 SUMMARY + path-deviation evidence:** `.planning/phases/034-supabase-production-setup/{034-SUMMARY.md, evidence/00-path-deviation.md, evidence/14-database-url-template.txt}` — establishes the MCP-first/CLI-for-writes pattern that Phase 35 inherits
- **Vercel CLI `--scope team_id` non-interactive behavior:** documented globally but unverified specifically for `vercel project add` (Open Question 1)
- **Default HSTS at `*.vercel.app`:** Vercel docs say HSTS is opt-in for Custom Domains; `*.vercel.app` behavior not explicitly documented (Open Question 4)

### Tertiary (LOW confidence — flagged for runtime validation)
- **`vercel project add` exact non-interactive flag set:** flag combinations that produce zero prompts have not been verified in Phase 35; the plan should include a "fail loudly if prompt appears" handler

---

## Metadata

**Confidence breakdown:**
- Standard stack (CLI flags, plugin commands, MCP tools): **HIGH** — read directly from skill files at `~/.claude/plugins/cache/claude-plugins-official/vercel/0.40.0/`
- Codebase current state (HSTS location, env.ts schema, playwright config): **HIGH** — verified by Read + Grep
- HSTS reduction edit point: **HIGH** — single-source-of-truth at `next.config.ts:11`
- Secret-grep methodology: **HIGH** — established in PITFALLS.md §1 + verified `vercel build` provides the artifact
- Vercel CLI auth-file persistence under Claude Code Bash sandbox: **MEDIUM** — Phase 34 D-04 recon is one data point; hypothesis is solid but not exhaustive
- `~/.vercel-token` mitigation strategy effectiveness: **MEDIUM** — `VERCEL_TOKEN` env var is the canonical CI pattern (HIGH from skill docs); the gitignored-file-source-per-Bash pattern is novel for this Phase but uses HIGH-confidence building blocks

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days for stable infrastructure topics; Vercel CLI moves slowly between minor versions, but new CLI flags or MCP tools could land within a month)

## RESEARCH COMPLETE
