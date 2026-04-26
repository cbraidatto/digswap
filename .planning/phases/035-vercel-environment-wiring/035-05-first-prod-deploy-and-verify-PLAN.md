---
phase: 035-vercel-environment-wiring
plan: 05
type: execute
wave: 4
depends_on:
  - 035-03-env-vars-production-scope-PLAN
  - 035-04-env-vars-preview-scope-PLAN
files_modified:
  - .planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt
  - .planning/phases/035-vercel-environment-wiring/evidence/04-secret-grep-static.txt
  - .planning/phases/035-vercel-environment-wiring/evidence/05-hsts-curl.txt
  - .planning/phases/035-vercel-environment-wiring/evidence/06-deploy-inspect.txt
  - .planning/phases/035-vercel-environment-wiring/evidence/07-health-probe.txt
autonomous: false
requirements:
  - DEP-VCL-01
  - DEP-VCL-04
  - DEP-VCL-05
  - DEP-VCL-08
  - DEP-VCL-09
  - DEP-VCL-10
gap_closure: false

must_haves:
  truths:
    - "First production deployment completed with state=READY (not ERROR/CANCELED)"
    - "Build used Node.js 20.x (DEP-VCL-08)"
    - "Build framework detected as Next.js (DEP-VCL-01)"
    - "Root Directory = `apps/web` (DEP-VCL-01)"
    - "Build artifact `.next/static/` and `.vercel/output/static/` contain ZERO matches for service_role|STRIPE_SECRET|HANDOFF_HMAC|IMPORT_WORKER_SECRET|DATABASE_URL|RESEND_API_KEY|DISCOGS_CONSUMER_SECRET|UPSTASH_REDIS_REST_TOKEN (DEP-VCL-04)"
    - "Production scope contains EXACTLY 7 NEXT_PUBLIC_* vars (DEP-VCL-05)"
    - "Production scope contains 21 keys total (DEP-VCL-02 cross-check)"
    - "HSTS response header reads `max-age=300` exactly (DEP-VCL-09)"
    - "/api/health returns 200 with body `{status:'healthy', database:'ok'}` (DEP-VCL-10 part 1)"
  artifacts:
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt"
      provides: "Sanitized audit: Production scope key counts, NEXT_PUBLIC_ count, sensitive flag presence on 10 secrets"
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/04-secret-grep-static.txt"
      provides: "Post-build grep results across `.next/static/` and `.vercel/output/static/` — must show zero hits"
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/05-hsts-curl.txt"
      provides: "curl -sI $URL output showing Strict-Transport-Security: max-age=300"
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/06-deploy-inspect.txt"
      provides: "vercel inspect $URL output: state=READY, framework=Next.js, Node 20.x, build duration, region"
    - path: ".planning/phases/035-vercel-environment-wiring/evidence/07-health-probe.txt"
      provides: "curl $URL/api/health output: 200 status + JSON body with database connectivity"
  key_links:
    - from: "First production deploy on *.vercel.app"
      to: "Supabase prod project swyfhpgerzvvmoswkjyt"
      via: "/api/health probe checks DB connectivity via DATABASE_URL pooler"
      pattern: "database.*ok"
---

<objective>
Wave 3: trigger the first Production deploy on `*.vercel.app` (Vercel auto-deploys on push to `main`, OR explicit `vercel deploy --prod`), wait for build completion, and run all DEP-VCL-* verification probes against the deployed URL.

This plan is the gate between "env vars wired" and "Phase 36 DNS cutover". Six requirements are validated here:
- DEP-VCL-01: project linked + build green
- DEP-VCL-04: post-build secret grep zero hits
- DEP-VCL-05: exactly 7 NEXT_PUBLIC_*
- DEP-VCL-08: Node 20 pinned
- DEP-VCL-09: HSTS max-age=300
- DEP-VCL-10 (partial): /api/health 200 (Playwright suite is Plan 06)

Halt-on-fail: if first deploy fails, the recovery is to inspect build logs via MCP, fix the root cause (likely a missing env var or config issue), and re-trigger. The Production env vars and Project Settings remain — only the deployment is replayed.
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
@.planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log
@.planning/phases/035-vercel-environment-wiring/evidence/02b-env-add-preview.log
@apps/web/next.config.ts

<interfaces>
Deploy trigger options (RESEARCH §2.5):
- A) `vercel deploy --prod --yes` from repo root (uses `.vercel/repo.json` to target `digswap-web`). Returns the deployment URL.
- B) Push commit to `main` branch — Vercel auto-deploys via GitHub integration (after Plan 02 linked the repo).
- Recommended: A (explicit, deterministic). B requires a meaningful commit which we don't need.

Polling MCP tools (RESEARCH §5):
- `mcp__vercel__list_deployments` — find the just-triggered deploy by timestamp
- `mcp__vercel__get_deployment` — poll state=READY (or BUILDING/ERROR/CANCELED)
- `mcp__vercel__get_deployment_build_logs` — debug if state=ERROR

Verification CLIs (RESEARCH §14):
- `vercel inspect <url>` — Node version, framework, region, build duration, state
- `vercel env ls production` — count keys, count NEXT_PUBLIC_*, confirm 21 total
- `vercel env pull --environment=production <tmp>` — full env audit (delete tmp after)
- `vercel pull --environment=production && vercel build --prod` — produce local `.vercel/output/` and `.next/static/` for secret grep
- `curl -sI <url>` — HSTS header check
- `curl -sf <url>/api/health` — health probe
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Trigger first production deploy + wait for READY</name>
  <files>.planning/phases/035-vercel-environment-wiring/evidence/06-deploy-inspect.txt</files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §2.5 (vercel deploy command + flags)
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §5 (MCP polling pattern)
    - .planning/phases/035-vercel-environment-wiring/evidence/01-link-confirm.txt (confirms .vercel/repo.json + project digswap-web)
  </read_first>
  <action>
```bash
set -u
export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"

EVIDENCE=".planning/phases/035-vercel-environment-wiring/evidence/06-deploy-inspect.txt"
mkdir -p "$(dirname "$EVIDENCE")"

# Trigger deploy (production, auto-confirm, capture URL)
echo "# Phase 35 Plan 05 Task 1 — First production deploy" > "$EVIDENCE"
echo "# Date: $(date -Is)" >> "$EVIDENCE"
echo "" >> "$EVIDENCE"

DEPLOY_OUT="$(vercel deploy --prod --yes 2>&1)"
echo "## vercel deploy output" >> "$EVIDENCE"
echo "$DEPLOY_OUT" >> "$EVIDENCE"
echo "" >> "$EVIDENCE"

# Extract the URL (last URL printed by `vercel deploy`)
DEPLOY_URL="$(echo "$DEPLOY_OUT" | grep -Eo 'https://[a-z0-9-]+\.vercel\.app' | tail -1)"
if [ -z "$DEPLOY_URL" ]; then
  echo "FAIL: could not extract deploy URL" >&2
  exit 1
fi
echo "DEPLOY_URL=$DEPLOY_URL" >> "$EVIDENCE"
echo "$DEPLOY_URL" > .planning/phases/035-vercel-environment-wiring/evidence/.deploy-url

# Wait for state=READY (poll for up to 5 min via vercel inspect)
echo "" >> "$EVIDENCE"
echo "## vercel inspect polling" >> "$EVIDENCE"
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  STATE="$(vercel inspect "$DEPLOY_URL" 2>&1 | grep -iE '^[[:space:]]*(status|state)' | head -1)"
  echo "[$i/20 attempt $(date -Is)] $STATE" >> "$EVIDENCE"
  case "$STATE" in
    *READY*) break ;;
    *ERROR*|*CANCELED*)
      echo "FAIL: deploy state $STATE" >&2
      vercel inspect --logs "$DEPLOY_URL" >> "$EVIDENCE" 2>&1
      exit 1
      ;;
  esac
  sleep 15
done

# Final inspect (full output)
echo "" >> "$EVIDENCE"
echo "## Final vercel inspect" >> "$EVIDENCE"
vercel inspect "$DEPLOY_URL" >> "$EVIDENCE" 2>&1

# Confirm Node 20 in inspect output (DEP-VCL-08)
if grep -qE "Node\.js Version:?[[:space:]]*20" "$EVIDENCE"; then
  echo "✓ Node 20.x confirmed (DEP-VCL-08)" >> "$EVIDENCE"
else
  echo "⚠ Node version line not found in inspect output — manual review needed" >> "$EVIDENCE"
fi

cat "$EVIDENCE"
```
  </action>
  <verify>
    <automated>test -f .planning/phases/035-vercel-environment-wiring/evidence/.deploy-url &amp;&amp; grep -q "READY" .planning/phases/035-vercel-environment-wiring/evidence/06-deploy-inspect.txt &amp;&amp; ! grep -q "ERROR\|CANCELED" .planning/phases/035-vercel-environment-wiring/evidence/06-deploy-inspect.txt &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/035-vercel-environment-wiring/evidence/06-deploy-inspect.txt` exists, size > 1500 bytes
    - File contains state=READY (or equivalent positive marker)
    - File does NOT contain state=ERROR or CANCELED
    - File contains "Node.js Version" with value matching `20` (any patch — `20.x`)
    - File contains "Framework" with value matching `Next.js`
    - `.deploy-url` cookie file exists with single `https://*.vercel.app` URL on the only line
  </acceptance_criteria>
  <done>
    First production deploy completed. URL captured for downstream tasks. DEP-VCL-01 satisfied (build green). DEP-VCL-08 satisfied (Node 20 confirmed).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Production env audit — count + scope verify</name>
  <files>.planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt</files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §4 (env pull verify strategy + sanitized evidence pattern)
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §14 DEP-VCL-02 + DEP-VCL-05 + DEP-VCL-06 rows
  </read_first>
  <action>
```bash
set -u
export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"

AUDIT=".planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt"
TMP="$(mktemp)"

vercel env pull "$TMP" --environment=production --yes >/dev/null 2>&1 || {
  echo "FAIL: vercel env pull production" >&2; exit 1; }

{
  echo "# Phase 35 Plan 05 Task 2 — Production scope sanitized audit"
  echo "# Date: $(date -Is)"
  echo ""
  echo "## Counts"
  TOTAL=$(grep -cE '^[A-Z_]+=' "$TMP")
  PUB=$(grep -cE '^NEXT_PUBLIC_' "$TMP")
  echo "Total Production keys: $TOTAL"
  echo "NEXT_PUBLIC_* count: $PUB"
  echo ""
  echo "## DEP-VCL-02: 21 prod env vars"
  if [ "$TOTAL" -ge 21 ]; then echo "✓ PASS ($TOTAL >= 21)"; else echo "✗ FAIL ($TOTAL < 21)"; fi
  echo ""
  echo "## DEP-VCL-05: exactly 7 NEXT_PUBLIC_*"
  if [ "$PUB" -eq 7 ]; then echo "✓ PASS (=7)"; else echo "✗ FAIL ($PUB != 7) — investigate"; fi
  echo ""
  echo "## Key presence map"
  for KEY in NEXT_PUBLIC_APP_URL NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_PUBLIC_MIN_DESKTOP_VERSION NEXT_PUBLIC_STRIPE_PRICE_MONTHLY NEXT_PUBLIC_STRIPE_PRICE_ANNUAL DATABASE_URL SUPABASE_SERVICE_ROLE_KEY DISCOGS_CONSUMER_KEY DISCOGS_CONSUMER_SECRET HANDOFF_HMAC_SECRET IMPORT_WORKER_SECRET STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET RESEND_API_KEY RESEND_FROM_EMAIL YOUTUBE_API_KEY SYSTEM_USER_ID UPSTASH_REDIS_REST_URL UPSTASH_REDIS_REST_TOKEN; do
    grep -qE "^${KEY}=" "$TMP" && echo "  ${KEY} = present" || echo "  ${KEY} = missing"
  done
  echo ""
  echo "## DEP-VCL-06: HMAC + IMPORT_WORKER length check (>= 32 chars)"
  HMAC_LEN=$(grep -E '^HANDOFF_HMAC_SECRET=' "$TMP" | sed 's/^HANDOFF_HMAC_SECRET=//' | tr -d '\r\n"' | wc -c)
  IMP_LEN=$(grep -E '^IMPORT_WORKER_SECRET=' "$TMP" | sed 's/^IMPORT_WORKER_SECRET=//' | tr -d '\r\n"' | wc -c)
  echo "HANDOFF_HMAC_SECRET length: $HMAC_LEN"
  echo "IMPORT_WORKER_SECRET length: $IMP_LEN"
  [ "$HMAC_LEN" -ge 32 ] && echo "✓ HMAC PASS" || echo "✗ HMAC FAIL"
  [ "$IMP_LEN" -ge 32 ] && echo "✓ IMPORT_WORKER PASS" || echo "✗ IMPORT_WORKER FAIL"
  echo ""
  echo "## Pitfall #29: HMAC + IMPORT_WORKER differ from dev .env.local"
  if [ -f apps/web/.env.local ]; then
    DEV_HMAC=$(grep -E '^HANDOFF_HMAC_SECRET=' apps/web/.env.local | sed 's/^HANDOFF_HMAC_SECRET=//' | tr -d '\r\n"')
    PROD_HMAC=$(grep -E '^HANDOFF_HMAC_SECRET=' "$TMP" | sed 's/^HANDOFF_HMAC_SECRET=//' | tr -d '\r\n"')
    if [ -n "$DEV_HMAC" ] && [ "$DEV_HMAC" = "$PROD_HMAC" ]; then
      echo "✗ FAIL: prod HANDOFF_HMAC_SECRET == dev value (Pitfall #29 violated)"
    else
      echo "✓ PASS: prod HANDOFF_HMAC_SECRET differs from dev"
    fi
  else
    echo "  (skipped — apps/web/.env.local not present)"
  fi
  echo ""
  echo "## DEFERRED_PHASE_37 marker presence (deferred dummies)"
  echo "  STRIPE_SECRET_KEY contains DEFERRED_PHASE_37: $(grep -qE '^STRIPE_SECRET_KEY=.*DEFERRED_PHASE_37' "$TMP" && echo yes || echo no)"
  echo "  STRIPE_WEBHOOK_SECRET contains DEFERRED_PHASE_37: $(grep -qE '^STRIPE_WEBHOOK_SECRET=.*DEFERRED_PHASE_37' "$TMP" && echo yes || echo no)"
  echo "  DISCOGS_CONSUMER_KEY = DEFERRED_PHASE_37: $(grep -qE '^DISCOGS_CONSUMER_KEY=DEFERRED_PHASE_37' "$TMP" && echo yes || echo no)"
} > "$AUDIT"

rm -f "$TMP"
cat "$AUDIT"
```
  </action>
  <verify>
    <automated>grep -q "DEP-VCL-02.*PASS" .planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt &amp;&amp; grep -q "DEP-VCL-05.*PASS" .planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt &amp;&amp; grep -q "HMAC PASS" .planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt &amp;&amp; grep -q "IMPORT_WORKER PASS" .planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt &amp;&amp; ! grep -q "FAIL" .planning/phases/035-vercel-environment-wiring/evidence/03-env-pull-prod-audit.txt &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - File exists, size > 1000 bytes
    - Contains "DEP-VCL-02 ... PASS" line
    - Contains "DEP-VCL-05 ... PASS" line (= 7 NEXT_PUBLIC_* exactly)
    - Contains "HMAC PASS" + "IMPORT_WORKER PASS" (length checks)
    - Contains "PASS: prod HANDOFF_HMAC_SECRET differs from dev" (Pitfall #29)
    - Zero "FAIL" markers
    - Temp file used for env pull was deleted
  </acceptance_criteria>
  <done>
    DEP-VCL-02, DEP-VCL-05, DEP-VCL-06 verified. Pitfall #29 confirmed protected.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Post-build secret grep — zero leaks in static bundle</name>
  <files>.planning/phases/035-vercel-environment-wiring/evidence/04-secret-grep-static.txt</files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §8 (post-build secret grep methodology — Strategy A)
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §14 DEP-VCL-04 row
  </read_first>
  <action>
```bash
set -u
export VERCEL_TOKEN="$(cat "$HOME/.vercel-token")"

GREP_OUT=".planning/phases/035-vercel-environment-wiring/evidence/04-secret-grep-static.txt"

# Strategy A: vercel pull + vercel build --prod, then grep on the resulting static dirs
cd apps/web
vercel pull --environment=production --yes >/dev/null 2>&1 || { echo "FAIL: vercel pull" >&2; exit 1; }
vercel build --prod 2>&1 | tail -20
cd ../..

{
  echo "# Phase 35 Plan 05 Task 3 — Post-build secret grep"
  echo "# Date: $(date -Is)"
  echo "# Strategy: Strategy A from RESEARCH §8 (vercel pull + vercel build --prod, grep on .vercel/output/static/ + .next/static/)"
  echo ""
  echo "## Patterns searched (DEP-VCL-04 + DEP-VCL-05 hardening)"
  PATTERNS='service_role|SUPABASE_SERVICE_ROLE|STRIPE_SECRET|HANDOFF_HMAC|IMPORT_WORKER_SECRET|RESEND_API_KEY|DISCOGS_CONSUMER_SECRET|UPSTASH_REDIS_REST_TOKEN|DATABASE_URL'
  echo "$PATTERNS" | tr '|' '\n' | sed 's/^/  - /'
  echo ""
  echo "## Search dirs"
  ls -d apps/web/.vercel/output/static/ 2>/dev/null && echo "  apps/web/.vercel/output/static/ exists" || echo "  apps/web/.vercel/output/static/ MISSING"
  ls -d apps/web/.next/static/ 2>/dev/null && echo "  apps/web/.next/static/ exists" || echo "  apps/web/.next/static/ MISSING"
  echo ""
  echo "## Grep results"
  HITS=$(grep -rE "$PATTERNS" apps/web/.vercel/output/static/ apps/web/.next/static/ 2>/dev/null | wc -l)
  if [ "$HITS" -eq 0 ]; then
    echo "✓ ZERO HITS — no secret patterns found in static bundle (DEP-VCL-04 PASS)"
  else
    echo "✗ FAIL: $HITS HITS — secrets in static bundle (DEP-VCL-04 VIOLATED)"
    echo ""
    echo "## Sample hits (first 10, masked)"
    grep -rE "$PATTERNS" apps/web/.vercel/output/static/ apps/web/.next/static/ 2>/dev/null | head -10 | sed 's/[A-Za-z0-9_+\/=-]\{20,\}/<REDACTED>/g'
  fi
} > "$GREP_OUT"

cat "$GREP_OUT"
```
  </action>
  <verify>
    <automated>grep -q "ZERO HITS" .planning/phases/035-vercel-environment-wiring/evidence/04-secret-grep-static.txt &amp;&amp; grep -q "DEP-VCL-04 PASS" .planning/phases/035-vercel-environment-wiring/evidence/04-secret-grep-static.txt &amp;&amp; ! grep -q "FAIL" .planning/phases/035-vercel-environment-wiring/evidence/04-secret-grep-static.txt &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - File exists, size > 500 bytes
    - Contains "ZERO HITS" + "DEP-VCL-04 PASS"
    - Zero "FAIL" markers
    - File does NOT contain any unmasked secret value (the `<REDACTED>` mask handles any incidental hit display in the FAIL branch)
  </acceptance_criteria>
  <done>
    DEP-VCL-04 satisfied: no secret material leaked into the client-side static bundle. Pitfall #1 (NEXT_PUBLIC_ misprefix) protected.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: HSTS header verify (max-age=300)</name>
  <files>.planning/phases/035-vercel-environment-wiring/evidence/05-hsts-curl.txt</files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §7 (HSTS edit point + verify command)
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §14 DEP-VCL-09 row
    - .planning/phases/035-vercel-environment-wiring/035-CONTEXT.md D-18 (HSTS lifecycle)
  </read_first>
  <action>
```bash
set -u
DEPLOY_URL="$(cat .planning/phases/035-vercel-environment-wiring/evidence/.deploy-url)"
EVIDENCE=".planning/phases/035-vercel-environment-wiring/evidence/05-hsts-curl.txt"

{
  echo "# Phase 35 Plan 05 Task 4 — HSTS header check"
  echo "# Date: $(date -Is)"
  echo "# Target URL: $DEPLOY_URL"
  echo ""
  echo "## curl -sI response headers"
  curl -sI "$DEPLOY_URL" 2>&1
  echo ""
  echo "## Strict-Transport-Security extraction"
  HSTS=$(curl -sI "$DEPLOY_URL" | grep -i 'strict-transport-security' | tr -d '\r')
  echo "Header: $HSTS"
  if echo "$HSTS" | grep -qE 'max-age=300\b'; then
    echo "✓ DEP-VCL-09 PASS (max-age=300)"
  elif echo "$HSTS" | grep -qE 'max-age=[0-9]+'; then
    echo "✗ DEP-VCL-09 FAIL ($HSTS — expected max-age=300)"
  else
    echo "⚠ HSTS header missing entirely — Vercel platform default may apply; investigate"
  fi
} > "$EVIDENCE"

cat "$EVIDENCE"
```
  </action>
  <verify>
    <automated>grep -q "DEP-VCL-09 PASS" .planning/phases/035-vercel-environment-wiring/evidence/05-hsts-curl.txt &amp;&amp; ! grep -q "DEP-VCL-09 FAIL" .planning/phases/035-vercel-environment-wiring/evidence/05-hsts-curl.txt &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - File exists, size > 300 bytes
    - Contains "DEP-VCL-09 PASS (max-age=300)"
    - Does NOT contain "max-age=63072000" (the pre-Phase-35 value)
    - Does NOT contain "max-age=31536000" (the post-Phase-38 value — premature)
  </acceptance_criteria>
  <done>
    DEP-VCL-09 satisfied: HSTS reduced to launch-window value. Phase 38 + 1-week soak triggers bump to 31536000 per D-18.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 5: /api/health probe — DB connectivity verified end-to-end</name>
  <files>.planning/phases/035-vercel-environment-wiring/evidence/07-health-probe.txt</files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/035-RESEARCH.md §14 DEP-VCL-10 row
  </read_first>
  <action>
```bash
set -u
DEPLOY_URL="$(cat .planning/phases/035-vercel-environment-wiring/evidence/.deploy-url)"
EVIDENCE=".planning/phases/035-vercel-environment-wiring/evidence/07-health-probe.txt"

{
  echo "# Phase 35 Plan 05 Task 5 — /api/health probe"
  echo "# Date: $(date -Is)"
  echo "# Target URL: $DEPLOY_URL/api/health"
  echo ""
  echo "## curl response"
  HTTP_CODE=$(curl -sf -o /tmp/health.json -w "%{http_code}" "$DEPLOY_URL/api/health" 2>&1) || HTTP_CODE=000
  echo "HTTP status: $HTTP_CODE"
  if [ -f /tmp/health.json ]; then
    echo "Body:"
    cat /tmp/health.json | jq . 2>/dev/null || cat /tmp/health.json
    echo ""
  fi
  echo ""
  echo "## Verdict"
  if [ "$HTTP_CODE" = "200" ]; then
    if cat /tmp/health.json 2>/dev/null | jq -e '.status == "healthy"' >/dev/null 2>&1; then
      echo "✓ /api/health returns 200 + status:'healthy'"
    else
      echo "⚠ /api/health returns 200 but body shape differs — manual review"
    fi
    if cat /tmp/health.json 2>/dev/null | jq -e '.database == "ok"' >/dev/null 2>&1; then
      echo "✓ DB connectivity verified (database: ok)"
      echo "✓ DEP-VCL-10 partial PASS (Plan 06 adds Playwright suite)"
    else
      echo "⚠ DB connectivity field missing or != 'ok' — investigate DATABASE_URL pooler config"
    fi
  else
    echo "✗ /api/health failed with HTTP $HTTP_CODE — DEP-VCL-10 BLOCKED"
    echo "  Likely causes: env var typo, DATABASE_URL pooler password wrong, missing dependency"
    echo "  Debug: vercel inspect --logs $DEPLOY_URL"
  fi
  rm -f /tmp/health.json
} > "$EVIDENCE"

cat "$EVIDENCE"
```
  </action>
  <verify>
    <automated>grep -q "DEP-VCL-10 partial PASS" .planning/phases/035-vercel-environment-wiring/evidence/07-health-probe.txt &amp;&amp; grep -q "HTTP status: 200" .planning/phases/035-vercel-environment-wiring/evidence/07-health-probe.txt &amp;&amp; ! grep -q "DEP-VCL-10 BLOCKED" .planning/phases/035-vercel-environment-wiring/evidence/07-health-probe.txt &amp;&amp; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - File exists, size > 300 bytes
    - Contains "HTTP status: 200"
    - Contains "DEP-VCL-10 partial PASS"
    - Does NOT contain "BLOCKED" or "FAIL"
  </acceptance_criteria>
  <done>
    DEP-VCL-10 part 1 satisfied: build green + /api/health 200 + DB connectivity OK. Plan 06 completes DEP-VCL-10 with Playwright suite.
  </done>
</task>

</tasks>

<halt_on_fail>
Per RESEARCH §11:
- Task 1 deploy fails (state=ERROR) → use `mcp__vercel__get_deployment_build_logs` to read the error, fix root cause (likely missing env var or build script issue), re-trigger via `vercel deploy --prod --yes`. Production env vars and Project Settings remain untouched — only the build is replayed.
- Task 3 secret grep finds hits → CRITICAL FAIL. Investigate which env var leaked (likely a `NEXT_PUBLIC_` prefix mistakenly applied to a server-only secret). Fix env.ts schema OR re-add the var without `NEXT_PUBLIC_` prefix. Re-deploy.
- Task 4 HSTS doesn't match max-age=300 → confirm `next.config.ts:11` was correctly edited in Plan 01. If it wasn't, the deploy is using stale code; re-trigger after the edit lands.
- Task 5 /api/health fails → most common cause is DATABASE_URL pooler password wrong. Re-add DATABASE_URL with correct value, re-deploy.
</halt_on_fail>
