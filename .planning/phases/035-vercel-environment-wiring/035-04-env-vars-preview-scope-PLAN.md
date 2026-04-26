---
phase: 035-vercel-environment-wiring
plan: 04
type: execute
wave: 3
depends_on:
  - 035-02-vercel-project-create-link-and-settings-PLAN
files_modified:
  - .planning/phases/035-vercel-environment-wiring/evidence/02b-env-add-preview.log
  - .planning/phases/035-vercel-environment-wiring/evidence/03b-env-pull-preview-audit.txt
autonomous: false
requirements:
  - DEP-VCL-03
gap_closure: false

must_haves:
  truths:
    - "All 21 env vars exist in Vercel with Preview scope only — never `all environments`"
    - "Preview NEXT_PUBLIC_SUPABASE_URL points at dev project mrkgoucqcbqjhrdjcnpw (NOT prod swyfhpgerzvvmoswkjyt)"
    - "Preview DATABASE_URL points at dev pooler (NOT prod) — Pitfall #9 protection"
    - "Preview SUPABASE_SERVICE_ROLE_KEY is the dev service_role (NOT prod)"
    - "Preview Stripe keys use the same DEFERRED_PHASE_37 dummies as Production (Stripe deferred in both — Phase 37 swaps both scopes)"
    - "Preview HANDOFF_HMAC_SECRET + IMPORT_WORKER_SECRET match the dev .env.local values (Pitfall #29 protection: dev secrets in dev scope = OK; prod secrets must be FRESH and SEPARATE)"
  artifacts:
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/02b-env-add-preview.log"
      provides: "Per-var Preview-scope add results: KEY + SCOPE=preview + sensitive flag — never values"
      min_lines: 21
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/03b-env-pull-preview-audit.txt"
      provides: "Sanitized audit confirming Preview scope contains dev project ref (mrkgoucqcbqjhrdjcnpw), NOT prod"
      min_lines: 10
  key_links:
    - from: "Vercel project digswap-web (Preview scope)"
      to: "Supabase DEV project mrkgoucqcbqjhrdjcnpw"
      via: "vercel env add KEY preview"
      pattern: "mrkgoucqcbqjhrdjcnpw"
---

<objective>
Wave 2 (parallel with Plan 03): populate the 21 Preview-scope env vars in Vercel. Every Supabase-related value points at the **dev** project (`mrkgoucqcbqjhrdjcnpw`) — not prod. This is Pitfall #9 protection: PR previews/branch deploys NEVER touch prod data.

For HANDOFF_HMAC_SECRET + IMPORT_WORKER_SECRET in Preview scope, we reuse the dev `.env.local` values (NOT freshly generated) — the symmetry between Preview deploys and dev local matches Pitfall #29 logic exactly: dev values in dev scope is fine; prod must have FRESH values that differ from dev.

Halt-on-fail blast radius: PER-VAR atomic. Same idempotent loop as Plan 03 with `add_if_missing`. Independent from Plan 03 (different scope, no shared writes). Both plans can run in parallel.

Purpose:
- DEP-VCL-03: Preview env vars separately scoped to dev Supabase + Stripe deferred dummies (preview deploys never touch prod)

Output:
- 21 keys in Vercel Preview scope, all pointing at dev or carrying deferred dummies
- evidence/02b-env-add-preview.log: per-var KEY + SCOPE=preview + sensitive flag log (never values)
- evidence/03b-env-pull-preview-audit.txt: sanitized audit confirming `mrkgoucqcbqjhrdjcnpw` (dev ref) appears in Preview values, `swyfhpgerzvvmoswkjyt` (prod ref) does NOT
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/035-vercel-environment-wiring/035-CONTEXT.md
@.planning/phases/035-vercel-environment-wiring/035-RESEARCH.md
@.planning/phases/035-vercel-environment-wiring/evidence/01-link-confirm.txt
@apps/web/src/lib/env.ts
@apps/web/.env.local

<interfaces>
Source-of-truth values for Preview scope (all from existing dev `.env.local`, which the user already has populated for local dev):

Public (5 of 7 — Stripe price IDs deferred = empty in both scopes):
- NEXT_PUBLIC_APP_URL → `$VERCEL_URL` auto-injected by Vercel (per D-12) — DO NOT set explicitly; Vercel auto-resolves to the preview deployment URL (e.g., `digswap-web-git-feature-thiagobraidatto-3732s-projects.vercel.app`)
- Actually correction per D-12: `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` in Preview scope use the placeholder string `https://${VERCEL_URL}` IF env.ts allows interpolation — OR explicitly set to `https://digswap-web-preview.vercel.app` as a generic value. Read RESEARCH §2.4 + D-12 for exact handling.
  - **Decision for this plan**: explicitly set both to `http://localhost:3000` so Preview-from-CI smoke tests can run against localhost; Preview deploys override at runtime via `process.env.VERCEL_URL` (`apps/web/src/lib/env.ts:43-50` defaults to `http://localhost:3000` when `process.env.VERCEL` not set). This is a safe choice — preview deploys won't break, and any code that reads `NEXT_PUBLIC_SITE_URL` will get the localhost default, which is fine for previews-as-development context.
- NEXT_PUBLIC_SUPABASE_URL → `https://mrkgoucqcbqjhrdjcnpw.supabase.co` (dev project)
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY → dev anon key from `apps/web/.env.local` (read at runtime, never committed)
- NEXT_PUBLIC_MIN_DESKTOP_VERSION → `0.2.0` (same as Production)
- NEXT_PUBLIC_STRIPE_PRICE_MONTHLY → "" (deferred)
- NEXT_PUBLIC_STRIPE_PRICE_ANNUAL → "" (deferred)

Server (14 — Supabase dev + Stripe/Discogs dummies + dev HMAC + empty optionals):
- DATABASE_URL → dev pooler URL from `apps/web/.env.local` (e.g., `postgresql://postgres.mrkgoucqcbqjhrdjcnpw:<dev-password>@aws-0-us-west-2.pooler.supabase.com:6543/postgres?pgbouncer=true`)
- SUPABASE_SERVICE_ROLE_KEY → dev service_role from `.env.local`
- DISCOGS_CONSUMER_KEY → real dev value from `.env.local` (or `DEFERRED_PHASE_37` if absent)
- DISCOGS_CONSUMER_SECRET → real dev value from `.env.local` (or `DEFERRED_PHASE_37`)
- IMPORT_WORKER_SECRET → real dev value from `.env.local` (or fresh `openssl rand -hex 32` for preview if absent)
- HANDOFF_HMAC_SECRET → real dev value from `.env.local` (≥32 chars; if dev value < 32 chars, generate fresh for preview)
- RESEND_API_KEY → "" (deferred to Phase 37)
- RESEND_FROM_EMAIL → `noreply@digswap.com.br`
- STRIPE_SECRET_KEY → `sk_test_DEFERRED_PHASE_37_NOT_FOR_USE` (use `sk_test_` prefix in Preview to differentiate from `sk_live_` in Production)
- STRIPE_WEBHOOK_SECRET → `whsec_DEFERRED_PHASE_37_NOT_FOR_USE`
- YOUTUBE_API_KEY → "" (post-MVP)
- SYSTEM_USER_ID → "" (default)
- UPSTASH_REDIS_REST_URL → "" (post-MVP)
- UPSTASH_REDIS_REST_TOKEN → "" (post-MVP)

CLI patterns: same as Plan 03 (`vercel env add KEY preview`). Idempotent skip-if-present via `vercel env ls preview | grep -q "^${KEY}"`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add 21 Preview-scope env vars (all in one Bash heredoc, idempotent)</name>
  <files>.planning/phases/035-vercel-environment-wiring/evidence/02b-env-add-preview.log</files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §2.3 (env add CLI pattern) + §11 (halt-on-fail + idempotent helper)
    - .planning/phases/035-vercel-environment-wiring/035-CONTEXT.md D-13 (Preview = Supabase dev) + D-21 (DEFERRED dummy convention)
    - apps/web/src/lib/env.ts lines 9-55 (Zod schema)
    - apps/web/.env.local (read for dev values — do NOT log values to evidence)
  </read_first>
  <action>
Single Bash heredoc, sourcing dev values from `apps/web/.env.local` (which is NOT committed but exists locally). The heredoc reads each variable from the dotenv file, then pipes the value via `printf | vercel env add ... preview`. Values never echo.

```bash
set -u
export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"
[ -n "$VERCEL_TOKEN" ] || { echo "VERCEL_TOKEN missing" >&2; exit 1; }

LOG=".planning/phases/035-vercel-environment-wiring/evidence/02b-env-add-preview.log"
mkdir -p "$(dirname "$LOG")"
echo "# Phase 35 Plan 04 — Preview-scope env-var add log" > "$LOG"
echo "# Date: $(date -Is)" >> "$LOG"
echo "# Format: TIMESTAMP RESULT KEY SCOPE [sensitive=true|false]" >> "$LOG"
echo "# Source: dev .env.local for Supabase/HMAC/IMPORT_WORKER; deferred dummies for Stripe/Discogs" >> "$LOG"
echo "" >> "$LOG"

# Source dev values (file is gitignored)
if [ ! -f apps/web/.env.local ]; then
  echo "FATAL: apps/web/.env.local not found" >&2
  exit 1
fi
# Use bash's set -a + source pattern; values stay in env vars only inside this heredoc
set -a
. apps/web/.env.local
set +a

add_if_missing() {
  local KEY="$1"; local VALUE="$2"; local SENS="$3"
  local TS; TS="$(date -Is)"
  if vercel env ls preview 2>/dev/null | grep -qE "^[[:space:]]*${KEY}[[:space:]]"; then
    echo "${TS} SKIP ${KEY} preview sensitive=${SENS} reason=already_present" >> "$LOG"
    return 0
  fi
  local FLAGS=""
  [ "$SENS" = "true" ] && FLAGS="--sensitive"
  if printf "%s" "$VALUE" | vercel env add "$KEY" preview $FLAGS >/dev/null 2>&1; then
    echo "${TS} OK ${KEY} preview sensitive=${SENS}" >> "$LOG"
    return 0
  fi
  echo "${TS} FAIL ${KEY} preview sensitive=${SENS}" >> "$LOG"
  return 1
}

# ===== Group A: 7 NEXT_PUBLIC_* (matches publicSchema in env.ts) =====
add_if_missing NEXT_PUBLIC_APP_URL                "${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"                false
add_if_missing NEXT_PUBLIC_SITE_URL               "${NEXT_PUBLIC_SITE_URL:-http://localhost:3000}"               false
add_if_missing NEXT_PUBLIC_MIN_DESKTOP_VERSION    "0.2.0"                                                         false
add_if_missing NEXT_PUBLIC_SUPABASE_URL           "https://mrkgoucqcbqjhrdjcnpw.supabase.co"                      false
add_if_missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY "${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-}"                   false
add_if_missing NEXT_PUBLIC_STRIPE_PRICE_MONTHLY   ""                                                              false
add_if_missing NEXT_PUBLIC_STRIPE_PRICE_ANNUAL    ""                                                              false

# ===== Group B: server-side secrets pointing at DEV =====
add_if_missing DATABASE_URL                       "${DATABASE_URL:-}"                                             true
add_if_missing SUPABASE_SERVICE_ROLE_KEY          "${SUPABASE_SERVICE_ROLE_KEY:-}"                                true
add_if_missing HANDOFF_HMAC_SECRET                "${HANDOFF_HMAC_SECRET:-$(openssl rand -hex 32)}"               true
add_if_missing IMPORT_WORKER_SECRET               "${IMPORT_WORKER_SECRET:-$(openssl rand -hex 32)}"              true
add_if_missing DISCOGS_CONSUMER_KEY               "${DISCOGS_CONSUMER_KEY:-DEFERRED_PHASE_37}"                    true
add_if_missing DISCOGS_CONSUMER_SECRET            "${DISCOGS_CONSUMER_SECRET:-DEFERRED_PHASE_37}"                 true

# ===== Group C: deferred dummies (test-mode prefixes for clarity in Preview) =====
add_if_missing STRIPE_SECRET_KEY                  "sk_test_DEFERRED_PHASE_37_NOT_FOR_USE"                         true
add_if_missing STRIPE_WEBHOOK_SECRET              "whsec_DEFERRED_PHASE_37_NOT_FOR_USE"                           true

# ===== Group D: optional / empty (env.ts default "") =====
add_if_missing RESEND_API_KEY                     ""                                                              true
add_if_missing RESEND_FROM_EMAIL                  "noreply@digswap.com.br"                                        false
add_if_missing YOUTUBE_API_KEY                    ""                                                              true
add_if_missing SYSTEM_USER_ID                     ""                                                              false
add_if_missing UPSTASH_REDIS_REST_URL             ""                                                              false
add_if_missing UPSTASH_REDIS_REST_TOKEN           ""                                                              true

echo "" >> "$LOG"
echo "# Preview scope complete — 21 env vars added/skipped" >> "$LOG"
tail -25 "$LOG"

# Sanity check: no FAIL entries
if grep -q "^.*FAIL" "$LOG"; then
  echo "FAIL entries detected — investigate before proceeding" >&2
  exit 1
fi
```

NOTES:
- The `set -a; . apps/web/.env.local; set +a` pattern auto-exports every variable from the dotenv file. After this block, `$DATABASE_URL`, `$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, etc. are populated from the user's local dev values.
- If a dev `.env.local` value is missing/empty, the `${VAR:-default}` syntax falls back to the documented default (e.g., `DEFERRED_PHASE_37` for Discogs, fresh `openssl rand -hex 32` for HMAC if dev value missing).
- HANDOFF_HMAC_SECRET in Preview reuses the dev value if available — Pitfall #29 protection only applies to PROD HMAC secret being fresh; dev value in dev scope is the symmetric, correct configuration.
- The Vercel CLI rejects empty string `""` for some scopes (`vercel env add` may complain). If that happens, the `add_if_missing` returns FAIL — which is acceptable here because env.ts treats those keys with `optional().default("")`. Pattern: log the FAIL and continue (these specific keys with empty values are optional).
  </action>
  <verify>
    <automated>vercel env ls preview 2>/dev/null | grep -E "^[[:space:]]*(NEXT_PUBLIC_SUPABASE_URL|DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY|HANDOFF_HMAC_SECRET|IMPORT_WORKER_SECRET)[[:space:]]" | wc -l | awk '$1 >= 5 {print "OK"; exit 0} {print "FAIL"; exit 1}'</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/035-vercel-environment-wiring/evidence/02b-env-add-preview.log` exists, size > 1500 bytes
    - Log contains 14+ `OK` or `SKIP` entries for Preview scope (some optional empty-string keys may FAIL — that's OK if env.ts has `optional().default("")`)
    - Log contains zero unrecovered `FAIL` entries on REQUIRED keys (DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HANDOFF_HMAC_SECRET, IMPORT_WORKER_SECRET, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, DISCOGS_CONSUMER_KEY, DISCOGS_CONSUMER_SECRET)
    - `vercel env ls preview` lists at minimum: NEXT_PUBLIC_SUPABASE_URL, DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, HANDOFF_HMAC_SECRET, IMPORT_WORKER_SECRET, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    - Log file does NOT contain any string matching `eyJ[A-Za-z0-9_-]{20,}` (no JWT leaked)
    - Log file does NOT contain any string matching `postgres(ql)?://[^"]*:[^@\s]{8,}@` (no DB password leaked)
  </acceptance_criteria>
  <done>
    21 Preview-scope env vars added (or SKIPped if pre-existing). Real dev Supabase values populated. Pitfall #9 protected: PR previews will deploy against dev project, never prod.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Audit Preview scope — confirm dev project ref present, prod ref ABSENT</name>
  <files>.planning/phases/035-vercel-environment-wiring/evidence/03b-env-pull-preview-audit.txt</files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §4 (vercel env pull strategy + sanitized evidence pattern)
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §14 DEP-VCL-03 row (test command)
  </read_first>
  <action>
```bash
set -u
export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"

AUDIT=".planning/phases/035-vercel-environment-wiring/evidence/03b-env-pull-preview-audit.txt"
TMP="$(mktemp)"

# Pull Preview scope to a temp file (gitignored — never committed)
vercel env pull "$TMP" --environment=preview --yes >/dev/null 2>&1 || {
  echo "FAIL: vercel env pull preview" >&2
  exit 1
}

{
  echo "# Phase 35 Plan 04 — Preview scope sanitized audit"
  echo "# Date: $(date -Is)"
  echo "# Source: vercel env pull --environment=preview (values redacted; only structural facts captured)"
  echo ""
  echo "## Key counts"
  echo "Total Preview keys: $(grep -cE '^[A-Z_]+=' "$TMP")"
  echo "NEXT_PUBLIC_ keys: $(grep -cE '^NEXT_PUBLIC_' "$TMP")"
  echo ""
  echo "## Key presence map (KEY = present|missing)"
  for KEY in NEXT_PUBLIC_APP_URL NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_PUBLIC_MIN_DESKTOP_VERSION NEXT_PUBLIC_STRIPE_PRICE_MONTHLY NEXT_PUBLIC_STRIPE_PRICE_ANNUAL DATABASE_URL SUPABASE_SERVICE_ROLE_KEY DISCOGS_CONSUMER_KEY DISCOGS_CONSUMER_SECRET HANDOFF_HMAC_SECRET IMPORT_WORKER_SECRET STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET RESEND_API_KEY RESEND_FROM_EMAIL YOUTUBE_API_KEY SYSTEM_USER_ID UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN; do
    if grep -qE "^${KEY}=" "$TMP"; then
      echo "  ${KEY} = present"
    else
      echo "  ${KEY} = missing"
    fi
  done
  echo ""
  echo "## Pitfall #9 verification (Preview NEVER touches prod)"
  if grep -qE "mrkgoucqcbqjhrdjcnpw" "$TMP"; then
    echo "  ✓ Dev project ref 'mrkgoucqcbqjhrdjcnpw' found in Preview values (expected)"
  else
    echo "  ✗ FAIL: Dev project ref NOT found in Preview values"
  fi
  if grep -qE "swyfhpgerzvvmoswkjyt" "$TMP"; then
    echo "  ✗ FAIL: Prod project ref 'swyfhpgerzvvmoswkjyt' found in Preview values — Pitfall #9 violation!"
  else
    echo "  ✓ Prod project ref 'swyfhpgerzvvmoswkjyt' NOT found in Preview values (correct)"
  fi
  echo ""
  echo "## DEFERRED_PHASE_37 marker presence"
  echo "  STRIPE_SECRET_KEY contains DEFERRED_PHASE_37: $(grep -qE '^STRIPE_SECRET_KEY=.*DEFERRED_PHASE_37' "$TMP" && echo yes || echo no)"
  echo "  STRIPE_WEBHOOK_SECRET contains DEFERRED_PHASE_37: $(grep -qE '^STRIPE_WEBHOOK_SECRET=.*DEFERRED_PHASE_37' "$TMP" && echo yes || echo no)"
} > "$AUDIT"

# Cleanup tmp file (contains real values)
rm -f "$TMP"

cat "$AUDIT"
```
  </action>
  <verify>
    <automated>test -s .planning/phases/035-vercel-environment-wiring/evidence/03b-env-pull-preview-audit.txt &amp;&amp; grep -q "Dev project ref 'mrkgoucqcbqjhrdjcnpw' found" .planning/phases/035-vercel-environment-wiring/evidence/03b-env-pull-preview-audit.txt &amp;&amp; grep -q "Prod project ref 'swyfhpgerzvvmoswkjyt' NOT found" .planning/phases/035-vercel-environment-wiring/evidence/03b-env-pull-preview-audit.txt &amp;&amp; ! grep -q "FAIL:" .planning/phases/035-vercel-environment-wiring/evidence/03b-env-pull-preview-audit.txt &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/035-vercel-environment-wiring/evidence/03b-env-pull-preview-audit.txt` exists, size > 800 bytes
    - Contains "Dev project ref 'mrkgoucqcbqjhrdjcnpw' found in Preview values (expected)"
    - Contains "Prod project ref 'swyfhpgerzvvmoswkjyt' NOT found in Preview values (correct)"
    - Contains zero "FAIL:" markers
    - Total Preview keys reported >= 14 (the required ones)
    - The temp file used for env pull was deleted (no `.env.preview` or similar persisted in the repo)
  </acceptance_criteria>
  <done>
    DEP-VCL-03 satisfied: Preview scope contains dev Supabase ref AND does NOT contain prod ref. Pitfall #9 verified protected at the env-config level.
  </done>
</task>

</tasks>

<rollback>
If Plan 04 needs to be undone (e.g., wrong values added): use `vercel env rm KEY preview --yes` per affected key. Per-var atomic rollback. The idempotent `add_if_missing` helper makes re-running safe after any `rm`.

If catastrophic (e.g., prod values leaked into Preview): IMMEDIATELY run `for K in $(vercel env ls preview | awk '{print $1}'); do vercel env rm "$K" preview --yes; done` to clear ALL Preview vars, then re-run Plan 04.
</rollback>

<halt_on_fail>
Per RESEARCH §11:
- A single `vercel env add` failure → halt loop, investigate (auth? scope? value rejected?), fix, re-run from FAIL line.
- Multiple consecutive failures → halt phase, check `vercel whoami` + `vercel teams switch <slug>` to confirm scope, ALSO check `$VERCEL_TOKEN` is sourced correctly.
- Pitfall #9 detected (prod ref in Preview) → IMMEDIATELY run rollback above + restart from clean state.
</halt_on_fail>
