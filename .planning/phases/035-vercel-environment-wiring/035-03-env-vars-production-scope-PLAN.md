---
phase: 035-vercel-environment-wiring
plan: 03
type: execute
wave: 3
depends_on:
  - 035-02-vercel-project-create-link-and-settings-PLAN
files_modified:
  - .planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log
  - .planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt
autonomous: false
requirements:
  - DEP-VCL-02
  - DEP-VCL-05
  - DEP-VCL-06
gap_closure: false

must_haves:
  truths:
    - "All 21 env vars exist in Vercel with Production scope only — never `all environments`"
    - "Exactly 7 NEXT_PUBLIC_* vars are set in Production scope (NEXT_PUBLIC_SENTRY_DSN intentionally omitted per D-08)"
    - "HANDOFF_HMAC_SECRET is freshly generated 64 hex chars (≥32 char minimum); ≠ dev value (D-14)"
    - "IMPORT_WORKER_SECRET is freshly generated 64 hex chars (D-15)"
    - "Stripe + Discogs deferred dummies use the `DEFERRED_PHASE_37_*` convention (D-21)"
    - "10 secret env vars carry the `--sensitive` flag (encrypted at rest)"
    - "Sentry vars (DSN/AUTH_TOKEN/ORG/PROJECT) are NOT added in this phase (Phase 39 owns; keeps NEXT_PUBLIC_ count at 7)"
  artifacts:
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log"
      provides: "Per-var add result: KEY + SCOPE + sensitive flag — never values (RESEARCH §11 evidence pattern)"
      min_lines: 21
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt"
      provides: "Sanitized audit: NEXT_PUBLIC_ count, expected-key-presence map, sensitive flag presence"
      min_lines: 15
  key_links:
    - from: "Vercel project digswap-web (Production scope)"
      to: "Supabase prod project swyfhpgerzvvmoswkjyt (URL + anon key + service_role + DATABASE_URL pooler)"
      via: "vercel env add KEY production"
      pattern: "swyfhpgerzvvmoswkjyt"
    - from: "Vercel project digswap-web (Production scope)"
      to: "Fresh HANDOFF_HMAC_SECRET + IMPORT_WORKER_SECRET (≠ dev values)"
      via: "openssl rand -hex 32 | vercel env add NAME production --sensitive"
      pattern: "openssl rand -hex 32"
---

<objective>
Wave 2 (parallel with Plan 04): populate the 21 Production-scope env vars in Vercel using the per-var atomic CLI loop.

Includes 7 public NEXT_PUBLIC_* keys, 14 server-side secrets (10 sensitive + 4 placeholders/optional). Two of the secrets are freshly generated locally via `openssl rand -hex 32 | vercel env add ... --sensitive` (one-shot pipe — value never leaves the pipe). Stripe + Discogs deferred dummies follow the `DEFERRED_PHASE_37_*` convention (D-21). Sentry vars are EXCLUDED (Phase 39 owns; keeps NEXT_PUBLIC_ count = 7).

Halt-on-fail blast radius: PER-VAR atomic. Each `vercel env add` is independent. If one fails, halt + investigate + retry that single var (RESEARCH §11). The idempotent `add_if_missing` helper (RESEARCH §11 lines 707-722) makes the loop safe to re-run.

Purpose:
- DEP-VCL-02: 21 prod env vars in Production scope only
- DEP-VCL-05: exactly 7 NEXT_PUBLIC_* (verified at end via `vercel env ls production | grep -c '^NEXT_PUBLIC_'`)
- DEP-VCL-06: HANDOFF_HMAC_SECRET + IMPORT_WORKER_SECRET freshly generated, ≥32 chars

Output:
- 21 keys in Vercel Production scope
- evidence/02-env-add-loop.log: per-var KEY + SCOPE + sensitive flag log (never values)
- evidence/03-env-pull-prod-audit.txt: sanitized audit confirming counts + key presence + sensitive flag set on the 10 secrets
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/035-vercel-environment-wiring/035-CONTEXT.md
@.planning/phases/035-vercel-environment-wiring/035-RESEARCH.md
@.planning/phases/035-vercel-environment-wiring/evidence/00-path-deviation.md
@.planning/phases/035-vercel-environment-wiring/evidence/01-link-confirm.txt
@.planning/phases/034-supabase-production-setup/034-SUMMARY.md
@.planning/phases/034-supabase-production-setup/evidence/14-database-url-template.txt
@apps/web/src/lib/env.ts
@apps/web/.env.local.example

<interfaces>
<!-- Source-of-truth schema (must respect every constraint) -->

apps/web/src/lib/env.ts (Zod schema — Phase 35 values MUST validate):

Server schema (lines 9-36):
- DATABASE_URL: min(1) — REQUIRED. Real prod pooler URL.
- SUPABASE_SERVICE_ROLE_KEY: min(1) — REQUIRED. Real prod service_role.
- DISCOGS_CONSUMER_KEY: min(1) — REQUIRED. Dummy `DEFERRED_PHASE_37` (D-09, D-21).
- DISCOGS_CONSUMER_SECRET: min(1) — REQUIRED. Dummy `DEFERRED_PHASE_37` (D-09, D-21).
- IMPORT_WORKER_SECRET: min(1) — REQUIRED. Fresh `openssl rand -hex 32` (D-15).
- HANDOFF_HMAC_SECRET: min(32) when NODE_ENV=production OR VERCEL set. Fresh `openssl rand -hex 32` = 64 hex chars (D-14).
- RESEND_API_KEY: optional default "" — leave empty (Phase 37 owns).
- RESEND_FROM_EMAIL: optional default "noreply@digswap.com" — set to `noreply@digswap.com.br` (the real domain).
- STRIPE_SECRET_KEY: min(10) when NODE_ENV=production. Dummy `sk_live_DEFERRED_PHASE_37_NOT_FOR_USE` (D-07, D-21).
- STRIPE_WEBHOOK_SECRET: min(10) when NODE_ENV=production. Dummy `whsec_DEFERRED_PHASE_37_NOT_FOR_USE` (D-07, D-21).
- YOUTUBE_API_KEY: optional default "" — leave empty (post-MVP).
- SYSTEM_USER_ID: optional default "" — leave empty.
- UPSTASH_REDIS_REST_URL: optional default "" — leave empty (post-MVP).
- UPSTASH_REDIS_REST_TOKEN: optional default "" — leave empty (post-MVP).

Public schema (lines 38-55) — exactly 7 NEXT_PUBLIC_* keys:
- NEXT_PUBLIC_SUPABASE_URL: min(1) — `https://swyfhpgerzvvmoswkjyt.supabase.co` (Phase 34 prod project)
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: min(1) — legacy anon JWT 208 chars (Phase 34 evidence/06)
- NEXT_PUBLIC_SITE_URL: min(1) when production/Vercel — `https://digswap.com.br` (D-11)
- NEXT_PUBLIC_APP_URL: min(1) when production/Vercel — `https://digswap.com.br` (D-10)
- NEXT_PUBLIC_STRIPE_PRICE_MONTHLY: optional default "" — leave empty (Phase 37 owns)
- NEXT_PUBLIC_STRIPE_PRICE_ANNUAL: optional default "" — leave empty (Phase 37 owns)
- NEXT_PUBLIC_MIN_DESKTOP_VERSION: optional default "0.2.0" — set to `0.2.0` explicitly

NEXT_PUBLIC_SENTRY_DSN is in `.env.local.example` and read directly via `process.env` in `instrumentation-client.ts` but NOT in `publicSchema`. Per RESEARCH §8: "for Phase 35 (Sentry deferred per D-08), do NOT add NEXT_PUBLIC_SENTRY_DSN to Vercel — keep the count strictly at 7 to make DEP-VCL-05 trivially pass." Phase 39 adds it.

Phase 34 inputs ready (from 034-SUMMARY.md "Inputs ready for Phase 35"):
- prod project_ref: `swyfhpgerzvvmoswkjyt`
- prod URL: `https://swyfhpgerzvvmoswkjyt.supabase.co`
- prod anon key (legacy JWT, 208 chars): user provides at runtime via clipboard or by reading from Supabase Dashboard → Settings → API
- prod service_role: user provides at runtime via clipboard or Supabase Dashboard → Settings → API
- DATABASE_URL pooler template: `postgresql://postgres.swyfhpgerzvvmoswkjyt:<PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true` — user provides DB password (NEVER commits to evidence)

CLI patterns (RESEARCH §2.3 + §9 + §11):
- Non-secret URL: `echo "<value>" | vercel env add KEY production`
- Sensitive secret: `printf "%s" "$VALUE" | vercel env add KEY production --sensitive`
- Generated secret one-shot: `openssl rand -hex 32 | vercel env add KEY production --sensitive`
- Idempotent: check `vercel env ls production | grep -q "^${KEY}"` before each add (skip-if-present)

Recommended ordering (RESEARCH §2.3 lines 192-202): low-blast-radius first, highest-blast-radius last (so a halt mid-loop never strands prod with a real secret in a half-configured project).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add 7 NEXT_PUBLIC_* + 4 dummy/optional public keys + 4 deferred Stripe/Sentry placeholders to Production scope (low-risk batch)</name>
  <files>.planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log</files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §2.3 lines 158-204 (env add CLI pattern + ordering rationale)
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §11 lines 681-735 (halt-on-fail + idempotent helper)
    - .planning/phases/035-vercel-environment-wiring/035-CONTEXT.md D-07/D-08/D-09/D-10/D-11/D-21 lines 33-71
    - apps/web/src/lib/env.ts lines 38-55 (publicSchema — 7 keys to set)
    - .planning/phases/034-supabase-production-setup/034-SUMMARY.md "Inputs ready for Phase 35" table
  </read_first>
  <action>
Single Bash heredoc — one sub-shell, one possible auth event. Runs from repo root (any subdir would also work since `.vercel/repo.json` is in root).

```bash
set -u
export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"
[ -n "$VERCEL_TOKEN" ] || { echo "VERCEL_TOKEN missing" >&2; exit 1; }

LOG=".planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log"
mkdir -p "$(dirname "$LOG")"
echo "# Phase 35 Plan 03 — Production-scope env-var add log" > "$LOG"
echo "# Date: $(date -Is)" >> "$LOG"
echo "# Format: TIMESTAMP RESULT KEY SCOPE [sensitive=true|false] [retry=N]" >> "$LOG"
echo "# Values intentionally NOT logged (D-05 mitigation)" >> "$LOG"
echo "" >> "$LOG"

add_if_missing() {
  local KEY="$1"; local VALUE="$2"; local SCOPE="$3"; local SENS="$4"
  local TS; TS="$(date -Is)"
  if vercel env ls "$SCOPE" 2>/dev/null | grep -qE "^[[:space:]]*${KEY}[[:space:]]"; then
    echo "${TS} SKIP ${KEY} ${SCOPE} sensitive=${SENS} reason=already_present" >> "$LOG"
    return 0
  fi
  local FLAGS=""
  [ "$SENS" = "true" ] && FLAGS="--sensitive"
  if printf "%s" "$VALUE" | vercel env add "$KEY" "$SCOPE" $FLAGS >/dev/null 2>&1; then
    echo "${TS} OK ${KEY} ${SCOPE} sensitive=${SENS}" >> "$LOG"
    return 0
  fi
  echo "${TS} FAIL ${KEY} ${SCOPE} sensitive=${SENS}" >> "$LOG"
  return 1
}

# ===== Group A: 7 NEXT_PUBLIC_* keys (DEP-VCL-05 must end at exactly 7) =====
add_if_missing NEXT_PUBLIC_APP_URL                "https://digswap.com.br"                                       production false
add_if_missing NEXT_PUBLIC_SITE_URL               "https://digswap.com.br"                                       production false
add_if_missing NEXT_PUBLIC_MIN_DESKTOP_VERSION    "0.2.0"                                                        production false
add_if_missing NEXT_PUBLIC_SUPABASE_URL           "https://swyfhpgerzvvmoswkjyt.supabase.co"                     production false
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: paste the legacy anon JWT (208 chars, starts with eyJhbGc...) from Supabase Dashboard → Settings → API → "anon public" key
# Same value as Vault `trade_preview_publishable_key` per Phase 34 evidence/06
add_if_missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "$SUPABASE_ANON_JWT"                                         production false
# Stripe price IDs: deferred to Phase 37 — leave empty (env.ts default "")
add_if_missing NEXT_PUBLIC_STRIPE_PRICE_MONTHLY   ""                                                             production false
add_if_missing NEXT_PUBLIC_STRIPE_PRICE_ANNUAL    ""                                                             production false

# ===== Group B: low-risk server-side, deferred dummies (D-07/D-09/D-21) =====
# These satisfy env.ts validation (min(10) for Stripe, min(1) for Discogs in production) but FAIL at runtime invocation
add_if_missing STRIPE_SECRET_KEY                  "sk_live_DEFERRED_PHASE_37_NOT_FOR_USE"                        production true
add_if_missing STRIPE_WEBHOOK_SECRET              "whsec_DEFERRED_PHASE_37_NOT_FOR_USE"                          production true
add_if_missing DISCOGS_CONSUMER_KEY               "DEFERRED_PHASE_37"                                            production true
add_if_missing DISCOGS_CONSUMER_SECRET            "DEFERRED_PHASE_37"                                            production true

# ===== Group C: optional / empty by design =====
add_if_missing RESEND_API_KEY                     ""                                                             production true
add_if_missing RESEND_FROM_EMAIL                  "noreply@digswap.com.br"                                       production false
add_if_missing YOUTUBE_API_KEY                    ""                                                             production true
add_if_missing SYSTEM_USER_ID                     ""                                                             production false
add_if_missing UPSTASH_REDIS_REST_URL             ""                                                             production false
add_if_missing UPSTASH_REDIS_REST_TOKEN           ""                                                             production true

echo "" >> "$LOG"
echo "# Group A+B+C complete — Group D (real prod secrets + fresh-gen) handled in Tasks 2 + 3" >> "$LOG"
cat "$LOG"
```

NOTES:
- The `$SUPABASE_ANON_JWT` env var must be sourced from a transient shell variable populated from clipboard or file just before this heredoc — NEVER hard-coded into the plan or the executor's response. Pattern: user pastes value into the agent context only as the `value` of the tool call, not into an evidence file.
- If `RESEND_API_KEY=""` (empty string) is rejected by the CLI ("value cannot be empty"), fall back to NOT adding it at all — env.ts has `optional().default("")` so missing-from-Vercel = empty string at build time. Same for any var that env.ts treats as `optional().default("")`.
- Per D-08, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` are intentionally **NOT** added in this task. Phase 39 owns. Keeping NEXT_PUBLIC_ count = 7 makes DEP-VCL-05 trivially pass.
- The deferred Stripe dummies use `--sensitive` (true) so they're encrypted-at-rest even though the values are placeholder; Phase 37 will swap with real values without losing the sensitive flag.
- Halt rule per RESEARCH §11: if any `add_if_missing` returns FAIL, halt the loop, investigate (network? auth? scope?), fix, re-run from the FAIL line. The idempotent skip-if-present logic makes resume safe.
  </action>
  <verify>
    <automated>vercel env ls production 2>/dev/null | grep -E "^[[:space:]]*(NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_SITE_URL|NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|NEXT_PUBLIC_MIN_DESKTOP_VERSION|STRIPE_SECRET_KEY|DISCOGS_CONSUMER_KEY|RESEND_FROM_EMAIL)[[:space:]]" | wc -l | awk '$1 >= 8 {print "OK"; exit 0} {print "FAIL"; exit 1}'</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log` exists, size > 1500 bytes
    - Log contains exactly 17 lines matching pattern `^[0-9-]+T[0-9:.+]+ (OK|SKIP) [A-Z_]+ production sensitive=(true|false)` (Group A: 7 + Group B: 4 + Group C: 6)
    - Log contains zero `FAIL` entries (or if any, they were retried and have a follow-up `OK retry=N` entry within 5 lines)
    - `vercel env ls production` (after this task) lists at minimum: NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_MIN_DESKTOP_VERSION, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, DISCOGS_CONSUMER_KEY, DISCOGS_CONSUMER_SECRET, RESEND_FROM_EMAIL
    - `vercel env ls production | grep -c '^[[:space:]]*NEXT_PUBLIC_'` returns 7 (DEP-VCL-05 mandates exact-7; Task 4 audit re-verifies via `vercel env pull`)
    - Log file does NOT contain any string matching `eyJ[A-Za-z0-9_-]{20,}` (no JWT leaked)
    - Log file does NOT contain any string matching `postgres(ql)?://[^"]*:[^@\s]{8,}@` (no DB connection string with password leaked)
    - Log file does NOT contain any string matching `sk_(test|live)_[A-Za-z0-9]{20,}` (no real Stripe key — dummies don't have 20+ alphanumeric chars after the prefix)
    - NEXT_PUBLIC_SENTRY_DSN is NOT present in `vercel env ls production` output (D-08 — Phase 39 owns)
  </acceptance_criteria>
  <done>
    17 of the 21 prod env vars added (Groups A, B, C). Remaining 4 — DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HANDOFF_HMAC_SECRET, IMPORT_WORKER_SECRET — handled in Tasks 2 + 3.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Generate + inject HANDOFF_HMAC_SECRET + IMPORT_WORKER_SECRET (one-shot pipe, never echoed)</name>
  <files>.planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log</files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §9 lines 526-583 (one-shot openssl pipe pattern + length-only verification)
    - .planning/phases/035-vercel-environment-wiring/035-CONTEXT.md D-14/D-15/D-16 lines 51-53
    - apps/web/src/lib/env.ts lines 17-20 (HANDOFF_HMAC_SECRET min(32) when production/VERCEL)
    - .planning/REQUIREMENTS.md DEP-VCL-06 line 48
  </read_first>
  <action>
Single Bash heredoc — one sub-shell, secrets generated AND injected without ever entering a shell variable. Pattern verified in RESEARCH §9.

```bash
set -u
export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"
LOG=".planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log"
TS="$(date -Is)"

# Confirm openssl is available (Git Bash on Windows: /mingw64/bin/openssl)
which openssl >/dev/null || { echo "openssl not found" >&2; exit 1; }

# === HANDOFF_HMAC_SECRET (Production scope, --sensitive, fresh) ===
# One-shot pipe: openssl writes 64 hex chars → vercel reads from stdin → never lives in a shell var
if vercel env ls production 2>/dev/null | grep -qE "^[[:space:]]*HANDOFF_HMAC_SECRET[[:space:]]"; then
  echo "${TS} SKIP HANDOFF_HMAC_SECRET production sensitive=true reason=already_present" >> "$LOG"
else
  if openssl rand -hex 32 | vercel env add HANDOFF_HMAC_SECRET production --sensitive >/dev/null 2>&1; then
    echo "${TS} OK HANDOFF_HMAC_SECRET production sensitive=true generator=openssl_rand_hex_32" >> "$LOG"
  else
    echo "${TS} FAIL HANDOFF_HMAC_SECRET production sensitive=true" >> "$LOG"
    exit 1
  fi
fi

# === IMPORT_WORKER_SECRET (Production scope, --sensitive, fresh) ===
TS="$(date -Is)"
if vercel env ls production 2>/dev/null | grep -qE "^[[:space:]]*IMPORT_WORKER_SECRET[[:space:]]"; then
  echo "${TS} SKIP IMPORT_WORKER_SECRET production sensitive=true reason=already_present" >> "$LOG"
else
  if openssl rand -hex 32 | vercel env add IMPORT_WORKER_SECRET production --sensitive >/dev/null 2>&1; then
    echo "${TS} OK IMPORT_WORKER_SECRET production sensitive=true generator=openssl_rand_hex_32" >> "$LOG"
  else
    echo "${TS} FAIL IMPORT_WORKER_SECRET production sensitive=true" >> "$LOG"
    exit 1
  fi
fi

echo "" >> "$LOG"
echo "# Fresh secrets injected via one-shot pipe — values never entered a shell variable, never echoed" >> "$LOG"
tail -10 "$LOG"
```

CRITICAL invariants (must hold):
- Each `openssl rand -hex 32` produces 64 hex chars (32 bytes × 2 hex chars/byte). With env.ts `min(32)` validation, 64 ≥ 32 ✓.
- The pipe is anonymous — value never assigns to a shell var, never appears in bash history (Bash does not log piped data), never echoes to stdout/stderr.
- `--sensitive` flag marks the var encrypted-at-rest in Vercel; even Dashboard cannot reveal the value post-creation.
- If the user accidentally hits Ctrl-C between `openssl` and `vercel env add`, the secret is lost from memory — Vercel side is untouched. Just re-run the one-shot.

If `vercel env add` fails mid-pipe (network error), the value is already entropy-spent. Re-run = generate a NEW value (different from the failed attempt). This is FINE — both dev and prod have separate values; no symmetry needed. Phase 35 just needs ONE 32+-char random value per secret.
  </action>
  <verify>
    <automated>vercel env ls production 2>/dev/null | grep -qE "^[[:space:]]*HANDOFF_HMAC_SECRET[[:space:]]" &amp;&amp; vercel env ls production 2>/dev/null | grep -qE "^[[:space:]]*IMPORT_WORKER_SECRET[[:space:]]" &amp;&amp; grep -q "HANDOFF_HMAC_SECRET production sensitive=true generator=openssl" .planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log &amp;&amp; grep -q "IMPORT_WORKER_SECRET production sensitive=true generator=openssl" .planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `vercel env ls production` lists `HANDOFF_HMAC_SECRET` and `IMPORT_WORKER_SECRET` (both with `[sensitive]` marker)
    - Log contains: `HANDOFF_HMAC_SECRET production sensitive=true generator=openssl_rand_hex_32` AND `IMPORT_WORKER_SECRET production sensitive=true generator=openssl_rand_hex_32`
    - Log file does NOT contain any 64-hex-char string matching `[0-9a-f]{64}` (the generated secrets did not leak into the log)
    - Both secrets are >=32 chars (verified later in Task 4 via `vercel env pull` length check)
  </acceptance_criteria>
  <done>
    HANDOFF_HMAC_SECRET + IMPORT_WORKER_SECRET freshly generated and injected into Vercel Production scope via one-shot openssl pipe. Values never entered a shell variable, never echoed to stdout/stderr, never written to evidence files.
  </done>
</task>

<task type="checkpoint:human-action" tdd="false">
  <name>Task 3: USER provides DATABASE_URL (with prod DB password) + SUPABASE_SERVICE_ROLE_KEY pasted into Production scope</name>
  <files>.planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log</files>
  <read_first>
    - .planning/phases/034-supabase-production-setup/evidence/14-database-url-template.txt (DATABASE_URL pooler format with `<DB_PASSWORD>` placeholder)
    - .planning/phases/035-vercel-environment-wiring/035-CONTEXT.md D-05 (user-explicit deviation: secrets through Claude OK with mitigations)
    - apps/web/src/lib/env.ts lines 10-11 (DATABASE_URL min(1), SUPABASE_SERVICE_ROLE_KEY min(1))
  </read_first>
  <action>
This task is `checkpoint:human-action` because the two values must come from the user:

1. **DATABASE_URL** — user composes by interpolating their Supabase prod DB password (only they have it, in their password manager) into the pooler template:
   `postgresql://postgres.swyfhpgerzvvmoswkjyt:<DB_PASSWORD>@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`

2. **SUPABASE_SERVICE_ROLE_KEY** — user copies from Supabase Dashboard → Settings → API → "service_role secret" (long JWT token).

User pastes both values in the Claude chat. Executor receives them as transient shell vars and runs the same `add_if_missing` helper from Task 1, scoped to these two keys with `--sensitive`. After both `vercel env add` complete, executor `unset`s the shell vars and confirms via `vercel env ls production`.

CRITICAL: values NEVER echo to stdout/stderr, NEVER write to log file (only KEY + SCOPE + sensitive flag), NEVER survive the heredoc.
  </action>
  <checkpoint_details>
**Awaiting user input** (paste both as plain text in chat):
1. Full DATABASE_URL string with prod DB password substituted (template in `evidence/14`)
2. SUPABASE_SERVICE_ROLE_KEY (service_role secret) from Supabase Dashboard for project `swyfhpgerzvvmoswkjyt`

Executor confirms receipt by length only (no echo), then runs the add_if_missing helper from Task 1 for these 2 keys, then unsets transient vars.
  </checkpoint_details>
  <verify>
    <automated>vercel env ls production 2>/dev/null | grep -qE "^[[:space:]]*DATABASE_URL[[:space:]]" &amp;&amp; vercel env ls production 2>/dev/null | grep -qE "^[[:space:]]*SUPABASE_SERVICE_ROLE_KEY[[:space:]]" &amp;&amp; grep -q "DATABASE_URL production sensitive=true" .planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log &amp;&amp; grep -q "SUPABASE_SERVICE_ROLE_KEY production sensitive=true" .planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `vercel env ls production` lists `DATABASE_URL` (`[sensitive]`) AND `SUPABASE_SERVICE_ROLE_KEY` (`[sensitive]`)
    - Log contains: `DATABASE_URL production sensitive=true` AND `SUPABASE_SERVICE_ROLE_KEY production sensitive=true`
    - Log file does NOT contain any string matching `postgres(ql)?://[^"]*:[^@\s]{8,}@` (no DB password leak)
    - Log file does NOT contain any string matching `eyJ[A-Za-z0-9_-]{40,}` (no service_role JWT leak)
    - After this task, total Production-scope env vars count = 21 (Tasks 1+2+3 = 17+2+2)
  </acceptance_criteria>
  <done>
    DATABASE_URL + SUPABASE_SERVICE_ROLE_KEY added to Production scope with --sensitive. All 21 prod env vars now wired. DEP-VCL-02 satisfied.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Production env audit (count, NEXT_PUBLIC_=7, HMAC length, Pitfall #29 diff)</name>
  <files>.planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt</files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §4 (env pull verify strategy)
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §14 DEP-VCL-02 + DEP-VCL-05 + DEP-VCL-06 rows
    - apps/web/.env.local (read for dev HMAC value to do Pitfall #29 diff)
  </read_first>
  <action>
Run `vercel env pull --environment=production <tmp>` to a tmpfile, then produce a sanitized audit report at `evidence/03-env-pull-prod-audit.txt`. Audit checks:

- Total Production keys count (should be ≥21 for DEP-VCL-02 PASS)
- NEXT_PUBLIC_* count (should be exactly 7 for DEP-VCL-05 PASS — Sentry intentionally excluded per D-08)
- Key presence map for all 21 expected keys (each as `present` or `missing`)
- HANDOFF_HMAC_SECRET length (should be ≥32 for DEP-VCL-06 PASS)
- IMPORT_WORKER_SECRET length (should be ≥32 for DEP-VCL-06 PASS)
- Pitfall #29 diff: prod HANDOFF_HMAC_SECRET ≠ dev value (compared against `apps/web/.env.local`)
- Pitfall #29 diff: prod IMPORT_WORKER_SECRET ≠ dev value
- DEFERRED_PHASE_37 marker presence in Stripe + Discogs dummies

Audit emits `✓ <CHECK> PASS` or `✗ <CHECK> FAIL` per check. Tmpfile is deleted after audit completes (no `.env.production*` ever persisted in repo).

Implementation pattern: same as Plan 04 Task 2 (sanitized audit pattern from RESEARCH §4) but for Production scope. Reuse the structure, swap `--environment=preview` for `--environment=production`, expand checks to include HMAC length + Pitfall #29 diff against dev.
  </action>
  <verify>
    <automated>grep -q "DEP-VCL-02 PASS" .planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt &amp;&amp; grep -q "DEP-VCL-05 PASS" .planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt &amp;&amp; grep -q "HMAC PASS" .planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt &amp;&amp; grep -q "IMPORT_WORKER PASS" .planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt &amp;&amp; grep -q "PASS: prod HANDOFF_HMAC_SECRET differs from dev" .planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt &amp;&amp; ! grep -qE "^.*FAIL" .planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - File exists, size > 1000 bytes
    - Contains `DEP-VCL-02 PASS` (≥21 keys total)
    - Contains `DEP-VCL-05 PASS` (=7 NEXT_PUBLIC_* exactly — NOT "7 OR fewer")
    - Contains `HMAC PASS` AND `IMPORT_WORKER PASS` (length checks ≥32)
    - Contains `PASS: prod HANDOFF_HMAC_SECRET differs from dev` AND `PASS: prod IMPORT_WORKER_SECRET differs from dev`
    - Zero `FAIL` markers
    - Tmpfile used for env pull was deleted (no `.env.production*` files persisted in `apps/web/`)
  </acceptance_criteria>
  <done>
    DEP-VCL-02, DEP-VCL-05, DEP-VCL-06 all verified passing. Pitfall #29 confirmed protected. Production scope audit complete.
  </done>
</task>

</tasks>

<verification>
After all 4 tasks complete, verify the phase-level invariant:
```bash
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" verify key-links .planning/phases/035-vercel-environment-wiring/035-03-env-vars-production-scope-PLAN.md
```
to confirm key-links wiring (Vercel Production scope → Supabase prod project + openssl-fresh secrets).
</verification>

<success_criteria>
- [ ] 21 env vars in Vercel Production scope (`vercel env ls production` count ≥ 21)
- [ ] Exactly 7 NEXT_PUBLIC_* (DEP-VCL-05 verified in Task 4 — exact-7, not "≤7")
- [ ] HANDOFF_HMAC_SECRET + IMPORT_WORKER_SECRET freshly generated, ≥32 chars, differ from dev (Pitfall #29 + DEP-VCL-06)
- [ ] DATABASE_URL + SUPABASE_SERVICE_ROLE_KEY added with `--sensitive` flag (Task 3)
- [ ] Stripe + Discogs deferred dummies use `DEFERRED_PHASE_37_*` convention (Task 1)
- [ ] No secrets leaked to evidence/02-env-add-loop.log (only KEY + SCOPE + sensitive flag)
- [ ] No transient shell vars survive after Tasks 2+3 (`unset` after pipe)
</success_criteria>

<output>
After this plan completes, write `035-03-SUMMARY.md` per the standard SUMMARY template, with frontmatter `requirements_completed: [DEP-VCL-02, DEP-VCL-05, DEP-VCL-06]` and key-links pointing at the Vercel Production → Supabase prod wiring.
</output>

<halt_on_fail>
Per RESEARCH §11:
- Single env-var add fails (network blip) → idempotent retry; the `add_if_missing` helper handles this naturally.
- Authentication fails ("token expired") → user regenerates `~/.vercel-token` (30-day token); re-run the affected task.
- DATABASE_URL pasted with typo → `vercel env rm DATABASE_URL production --yes` + re-run Task 3.
- service_role key pasted wrong → same recovery as DATABASE_URL.
- Pitfall #29 violated (prod HMAC == dev) → catastrophic; `vercel env rm HANDOFF_HMAC_SECRET production --yes` + re-run Task 2 (fresh openssl).
</halt_on_fail>
