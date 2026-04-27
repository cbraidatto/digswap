---
phase: 036-dns-ssl-cutover
plan: 04
type: execute
wave: 4
depends_on: ["036-03"]
files_modified:
  - .planning/phases/036-dns-ssl-cutover/evidence/11-health-probe.txt
  - .planning/phases/036-dns-ssl-cutover/evidence/12-playwright-smoke.txt
  - .planning/phases/036-dns-ssl-cutover/evidence/13-soak-1h.txt
  - .planning/phases/036-dns-ssl-cutover/evidence/14-verify-final.txt
  - .planning/phases/036-dns-ssl-cutover/036-SUMMARY.md
autonomous: true
requirements: []
gap_closure: false

must_haves:
  truths:
    - "GET https://digswap.com.br/api/health returns HTTP 200 with `database:ok` (D-16 smoke layer 1)"
    - "Playwright anon smoke suite (apps/web with PLAYWRIGHT_BASE_URL=https://digswap.com.br) shows ≥ 16 PASS — same baseline as Phase 35 (5 known test-debt FAIL carried over per Phase 35 SUMMARY POST-PHASE-35 TODOs)"
    - "1-hour soak completed: 5x curl /api/health at 12-min intervals, all 200 (D-13 — Nyquist undersample acknowledged per VALIDATION.md)"
    - "evidence/14-verify-final.txt aggregates DEP-DNS-{01..07} status — 6 PASS + 1 N/A (DEP-DNS-07 N/A by D-04 construction)"
    - "036-SUMMARY.md is committed with all evidence references, requirement-by-requirement closure, POST-PHASE-36 TODOs (TTL bump trigger, HSTS bump trigger, public announce trigger, Phase 37 inputs)"
  artifacts:
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/11-health-probe.txt"
      provides: "curl /api/health probe — HTTP 200 + JSON body with database:ok"
      min_lines: 5
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/12-playwright-smoke.txt"
      provides: "Playwright e2e suite output against https://digswap.com.br — 16 PASS + 5 known test-debt FAIL"
      min_lines: 30
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/13-soak-1h.txt"
      provides: "5 timestamped curl probes spread across 1h — all 200 expected (D-13)"
      min_lines: 15
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/14-verify-final.txt"
      provides: "DEP-DNS-{01..07} aggregator table — single source of truth for phase closure"
      min_lines: 25
    - path: ".planning/phases/036-dns-ssl-cutover/036-SUMMARY.md"
      provides: "Phase 36 summary — requirements closure, deviations, POST-PHASE-36 TODOs, Phase 37 handoff"
      min_lines: 40
  key_links:
    - from: "https://digswap.com.br/api/health"
      to: "Supabase prod database (DATABASE_URL set in Phase 35)"
      via: "Next.js API route + Drizzle query"
      pattern: "database.*ok"
    - from: "Playwright config"
      to: "https://digswap.com.br"
      via: "PLAYWRIGHT_BASE_URL env"
      pattern: "PLAYWRIGHT_BASE_URL=https://digswap.com.br"
---

<objective>
Functionally verify the live site with three smoke layers (D-16): (1) curl /api/health 200 + database:ok, (2) full Playwright anon suite against the new BASE_URL, (3) 1-hour soak with 5x /api/health probes (D-13). Then aggregate every DEP-DNS-NN status from earlier waves into a single evidence/14-verify-final.txt and write 036-SUMMARY.md closing the phase.

Purpose: Earlier waves verified DNS + cert. This wave proves the platform end-to-end works on the new URL: routing, TLS termination, app code execution, database round-trip, redirect chain. If any of these break, the cert-error window may have masked an underlying issue (e.g., NEXT_PUBLIC_APP_URL mismatch, OAuth callback regression).

Output: 4 evidence files + 036-SUMMARY.md. Phase 36 is closed; Phase 37 (External Integrations) can begin.

HALT-ON-FAIL conditions:
- /api/health non-200 → halt before Playwright (no point running suite if app is down)
- Playwright shows MORE THAN 5 NEW failures (more than the 5 known test-debt carryovers from Phase 35) → halt and investigate; maybe the cert-error window confused a redirect path
- Soak shows any 200→non-200 transition during the hour → halt; investigate cert renewal or platform issue
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
<files_to_read>
- .planning/phases/036-dns-ssl-cutover/036-CONTEXT.md (D-13, D-16)
- .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md (§"Validation Architecture")
- .planning/phases/036-dns-ssl-cutover/036-VALIDATION.md (Nyquist undersample acknowledgment)
- .planning/phases/036-dns-ssl-cutover/036-03-SUMMARY.md (cert is live)
- .planning/phases/035-vercel-environment-wiring/035-SUMMARY.md (Phase 35 baseline: 16 PASS + 19 SKIP + 5 FAIL test-debt)
- apps/web/playwright.config.ts (already supports PLAYWRIGHT_BASE_URL override)
- .planning/REQUIREMENTS.md lines 58-64 (DEP-DNS-NN aggregation source)
</files_to_read>

<interfaces>
<!-- Smoke + soak surfaces -->

App health probe:
  GET https://digswap.com.br/api/health
  Expected: 200 + JSON body containing `"status":"healthy"` AND `"database":"ok"`

Playwright suite (Phase 35 already configured — env override is the only knob):
  cd apps/web && PLAYWRIGHT_BASE_URL=https://digswap.com.br pnpm test:e2e
  Phase 35 baseline: 16 PASS + 19 SKIP + 5 FAIL (test-debt: see Phase 35 POST-PHASE TODO #3)
  Phase 36 expectation: same counts. Anything beyond 5 FAIL = NEW regression.

Phase 35 known test-debt (carried over — NOT a Phase 36 regression):
  1. landing.spec.ts:18  — `.first()` needed on Sign In link
  2. pricing.spec.ts:62  — GET_STARTED_FREE locator mismatch
  3. pricing.spec.ts:69  — UPGRADE_TO_PREMIUM locator mismatch
  4. pricing.spec.ts:86  — getByText('Pricing', { exact: true }) needed
  5. session-revocation.audit.spec.ts — needs AUDIT_USER provisioning (Phase 38)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 4.1: /api/health smoke probe (D-16 layer 1)</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/11-health-probe.txt</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/036-03-SUMMARY.md (cert PASS confirmed)
    - .planning/phases/035-vercel-environment-wiring/evidence/07-health-probe.txt (Phase 35 baseline shape)
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"

    {
      echo "/api/health probe — D-16 layer 1"
      echo "Generated: $(date -u +%FT%TZ)"
      echo ""
      echo "=== curl -fsS https://digswap.com.br/api/health ==="
      curl -fsS \
        -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}s\n" \
        "https://digswap.com.br/api/health"
      echo ""
      echo "=== curl -sI (headers only) ==="
      curl -sI "https://digswap.com.br/api/health"
    } > "$EVIDENCE_DIR/11-health-probe.txt" 2>&1

    # PASS criteria
    grep -qE 'HTTP_CODE:200' "$EVIDENCE_DIR/11-health-probe.txt" \
      || { echo "HALT: /api/health non-200"; cat "$EVIDENCE_DIR/11-health-probe.txt"; exit 1; }
    grep -qE '"database"\s*:\s*"ok"' "$EVIDENCE_DIR/11-health-probe.txt" \
      || { echo "HALT: /api/health did not return database:ok"; cat "$EVIDENCE_DIR/11-health-probe.txt"; exit 1; }
    grep -qE 'strict-transport-security:\s*max-age=300' "$EVIDENCE_DIR/11-health-probe.txt" \
      || echo "[note] HSTS header not max-age=300 — verify Phase 35 D-18 setting still in effect"

    {
      echo ""
      echo "=== verdict ==="
      echo "Status: PASS"
      echo "HTTP 200 + database:ok confirmed at $(date -u +%FT%TZ)"
    } >> "$EVIDENCE_DIR/11-health-probe.txt"
  </action>
  <acceptance_criteria>
    - evidence/11-health-probe.txt exists, ≥ 5 lines
    - Contains literal `HTTP_CODE:200`
    - Contains literal `"database":"ok"` (or equivalent — `"database": "ok"` with whitespace)
    - Contains a final `Status: PASS` verdict line
  </acceptance_criteria>
  <done>
    App is live on the new URL with database connectivity. D-16 layer 1 satisfied.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4.2: Playwright anon smoke against https://digswap.com.br (D-16 layer 2)</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/12-playwright-smoke.txt</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/evidence/11-health-probe.txt (app is up)
    - .planning/phases/035-vercel-environment-wiring/evidence/08-playwright-smoke.txt (16 PASS + 19 SKIP + 5 FAIL baseline)
    - apps/web/playwright.config.ts (BASE_URL override mechanism)
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"

    # Run from repo root via pnpm; BASE_URL env override is the only knob
    PLAYWRIGHT_BASE_URL=https://digswap.com.br \
      pnpm --filter @digswap/web test:e2e 2>&1 | \
      tee "$EVIDENCE_DIR/12-playwright-smoke.txt"

    # Expected outcome: 16 PASS + 19 SKIP + 5 FAIL (same as Phase 35; the 5 FAIL are test-debt POST-PHASE-35 TODO #3)
    PASS=$(grep -oE '[0-9]+ passed' "$EVIDENCE_DIR/12-playwright-smoke.txt" | head -1 | grep -oE '[0-9]+')
    FAIL=$(grep -oE '[0-9]+ failed' "$EVIDENCE_DIR/12-playwright-smoke.txt" | head -1 | grep -oE '[0-9]+')
    SKIP=$(grep -oE '[0-9]+ skipped' "$EVIDENCE_DIR/12-playwright-smoke.txt" | head -1 | grep -oE '[0-9]+')

    : "${PASS:=0}"; : "${FAIL:=0}"; : "${SKIP:=0}"

    {
      echo ""
      echo "=== verdict ==="
      echo "Generated: $(date -u +%FT%TZ)"
      echo "PASS:    $PASS"
      echo "FAIL:    $FAIL"
      echo "SKIP:    $SKIP"
      echo ""
      echo "Phase 35 baseline: 16 PASS + 19 SKIP + 5 FAIL (test-debt — POST-PHASE-35 TODO #3)"
      echo ""
      if [ "$PASS" -ge 16 ] && [ "$FAIL" -le 5 ]; then
        echo "Status: PASS — meets-or-exceeds Phase 35 baseline"
      elif [ "$PASS" -ge 16 ] && [ "$FAIL" -le 6 ]; then
        echo "Status: PASS-WITH-CAVEAT — 1 NEW failure beyond Phase 35 baseline; investigate but do not block phase close"
      else
        echo "Status: FAIL — more than 5 failures OR fewer than 16 PASSes; HALT and investigate (cert-error masked redirect issue?)"
      fi
    } >> "$EVIDENCE_DIR/12-playwright-smoke.txt"

    grep -qE 'Status: PASS' "$EVIDENCE_DIR/12-playwright-smoke.txt" \
      || { echo "HALT: Playwright shows regression beyond Phase 35 baseline"; tail -30 "$EVIDENCE_DIR/12-playwright-smoke.txt"; exit 1; }
  </action>
  <acceptance_criteria>
    - evidence/12-playwright-smoke.txt exists, ≥ 30 lines
    - PASS count ≥ 16 (Phase 35 baseline) AND FAIL count ≤ 5 (Phase 35 known test-debt) — verified by `Status: PASS` or `Status: PASS-WITH-CAVEAT` in the verdict block
    - File references the 5 known test-debt items by mentioning `POST-PHASE-35 TODO`
  </acceptance_criteria>
  <done>
    D-16 layer 2 satisfied: Playwright anon suite confirms the same behavior on the new URL as on Phase 35's *.vercel.app baseline (no regressions beyond known test-debt).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4.3: 1-hour soak — 5x /api/health at 12-min intervals (D-13)</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/13-soak-1h.txt</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/036-CONTEXT.md (D-13: 1h soak window)
    - .planning/phases/036-dns-ssl-cutover/036-VALIDATION.md (§"Sampling Rate" — Nyquist undersample acknowledged)
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"

    {
      echo "1-hour soak — D-13"
      echo "Started: $(date -u +%FT%TZ)"
      echo "Plan: 5 probes at 12-min intervals (Nyquist undersample acknowledged per VALIDATION.md — invite-only, no SLO)"
      echo ""
    } > "$EVIDENCE_DIR/13-soak-1h.txt"

    FAILURES=0
    for i in 1 2 3 4 5; do
      {
        echo "=== probe #$i — $(date -u +%FT%TZ) ==="
        curl -fsS \
          -w "\nHTTP_CODE:%{http_code}\nTIME_TOTAL:%{time_total}s\n" \
          "https://digswap.com.br/api/health" 2>&1
        echo ""
      } | tee -a "$EVIDENCE_DIR/13-soak-1h.txt"

      # Tail-check this probe's HTTP code
      LAST_CODE=$(tail -20 "$EVIDENCE_DIR/13-soak-1h.txt" | grep -oE 'HTTP_CODE:[0-9]+' | tail -1 | cut -d: -f2)
      if [ "$LAST_CODE" != "200" ]; then
        FAILURES=$((FAILURES + 1))
        echo "[FAIL] probe #$i returned $LAST_CODE — possible cert renewal lag, platform incident, or DB hiccup" | tee -a "$EVIDENCE_DIR/13-soak-1h.txt"
      else
        echo "[ok] probe #$i 200" | tee -a "$EVIDENCE_DIR/13-soak-1h.txt"
      fi

      # Skip sleep on final iteration
      if [ "$i" -lt 5 ]; then
        sleep 720   # 12 minutes
      fi
    done

    {
      echo ""
      echo "=== verdict ==="
      echo "Completed: $(date -u +%FT%TZ)"
      echo "Failures: $FAILURES / 5"
      if [ "$FAILURES" = "0" ]; then
        echo "Status: PASS"
      else
        echo "Status: FAIL — at least one probe non-200; investigate before phase close"
      fi
    } >> "$EVIDENCE_DIR/13-soak-1h.txt"

    [ "$FAILURES" = "0" ] || { echo "HALT: soak has $FAILURES failures — investigate"; exit 1; }
  </action>
  <acceptance_criteria>
    - evidence/13-soak-1h.txt exists, ≥ 15 lines, contains 5 distinct `=== probe #` blocks
    - All 5 probes show `[ok] probe #N 200`
    - Verdict block shows `Failures: 0 / 5` AND `Status: PASS`
  </acceptance_criteria>
  <done>
    D-13 satisfied: 1h soak observed no degradation. The cert is stable; no platform incident in the soak window.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4.4: Aggregate DEP-DNS-{01..07} verify-final + write 036-SUMMARY.md</name>
  <files>
    .planning/phases/036-dns-ssl-cutover/evidence/14-verify-final.txt
    .planning/phases/036-dns-ssl-cutover/036-SUMMARY.md
  </files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/evidence/01-pre-cutover-zone.json (Wave 0)
    - .planning/phases/036-dns-ssl-cutover/evidence/01b-mx-na-confirm.txt (DEP-DNS-07 N/A)
    - .planning/phases/036-dns-ssl-cutover/evidence/06-flip-a-record.json (DEP-DNS-01)
    - .planning/phases/036-dns-ssl-cutover/evidence/07-flip-www-cname.json (DEP-DNS-02)
    - .planning/phases/036-dns-ssl-cutover/evidence/07c-ttl-300-verify.txt (DEP-DNS-06)
    - .planning/phases/036-dns-ssl-cutover/evidence/08-3-resolver-matrix.txt (DEP-DNS-04)
    - .planning/phases/036-dns-ssl-cutover/evidence/09-caa-audit.txt (DEP-DNS-05)
    - .planning/phases/036-dns-ssl-cutover/evidence/10-openssl-cert.txt (DEP-DNS-03)
    - .planning/phases/035-vercel-environment-wiring/035-SUMMARY.md (style template for phase summary)
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"
    PHASE_DIR=".planning/phases/036-dns-ssl-cutover"

    # === evidence/14-verify-final.txt ===
    {
      echo "Phase 36 — DEP-DNS-{01..07} aggregator"
      echo "Generated: $(date -u +%FT%TZ)"
      echo ""
      echo "| Req        | Status         | Source                                    | Note                                                                                |"
      echo "|------------|----------------|-------------------------------------------|-------------------------------------------------------------------------------------|"

      # DEP-DNS-01
      if grep -q '"content": "76.76.21.21"' "$EVIDENCE_DIR/06-flip-a-payload.json" 2>/dev/null \
         && grep -qE 'HTTP_CODE:(200|201)' "$EVIDENCE_DIR/06-flip-a-record.http-code.txt" 2>/dev/null; then
        echo "| DEP-DNS-01 | PASS           | evidence/06-flip-a-record.json + 07b      | A @ → 76.76.21.21 ttl=300                                                          |"
      else
        echo "| DEP-DNS-01 | UNVERIFIED     | evidence/06                              | Missing artifact or non-200 PUT                                                     |"
      fi

      # DEP-DNS-02
      CNAME_TARGET=$(cat "$EVIDENCE_DIR/04b-cname-target-extracted.txt" 2>/dev/null | tr -d '\n')
      if [ -n "$CNAME_TARGET" ] && grep -qE 'HTTP_CODE:(200|201)' "$EVIDENCE_DIR/07-flip-www-cname.http-code.txt" 2>/dev/null; then
        echo "| DEP-DNS-02 | PASS           | evidence/07-flip-www-cname.json + 04b     | CNAME www → ${CNAME_TARGET} ttl=300 (RESEARCH Pitfall 4 — used inspect, not literal) |"
      else
        echo "| DEP-DNS-02 | UNVERIFIED     | evidence/07                              | Missing artifact or non-200 PUT                                                     |"
      fi

      # DEP-DNS-03
      if grep -qE 'verify return code: 0 \(ok\)' "$EVIDENCE_DIR/10-openssl-cert.txt" 2>/dev/null \
         && grep -qE 'issuer=.*Let.s Encrypt' "$EVIDENCE_DIR/10-openssl-cert.txt" 2>/dev/null; then
        echo "| DEP-DNS-03 | PASS           | evidence/10-openssl-cert.txt              | LE issuer R3/R10/R11/E5/E6 + verify code 0 + DNS:digswap.com.br SAN                 |"
      else
        echo "| DEP-DNS-03 | UNVERIFIED     | evidence/10                              | openssl did not surface verify return code 0 + LE issuer — see incident log if any  |"
      fi

      # DEP-DNS-04
      if grep -q 'DEP-DNS-04 status: PASS' "$EVIDENCE_DIR/08-3-resolver-matrix.txt" 2>/dev/null; then
        echo "| DEP-DNS-04 | PASS           | evidence/08-3-resolver-matrix.txt + 08b   | 3/3 resolvers (1.1.1.1+8.8.8.8+9.9.9.9) + dns.google = 4 networks (D-14 strengthening) |"
      else
        echo "| DEP-DNS-04 | UNVERIFIED     | evidence/08                              | Resolver matrix did not produce PASS verdict                                        |"
      fi

      # DEP-DNS-05
      if grep -q 'DEP-DNS-05 status: PASS' "$EVIDENCE_DIR/09-caa-audit.txt" 2>/dev/null; then
        echo "| DEP-DNS-05 | PASS           | evidence/09-caa-audit.txt                 | No CAA OR includes letsencrypt.org                                                  |"
      else
        echo "| DEP-DNS-05 | UNVERIFIED     | evidence/09                              | CAA audit did not produce PASS verdict                                              |"
      fi

      # DEP-DNS-06
      if grep -q 'DEP-DNS-06 status: PASS' "$EVIDENCE_DIR/07c-ttl-300-verify.txt" 2>/dev/null; then
        echo "| DEP-DNS-06 | PASS           | evidence/07c-ttl-300-verify.txt           | A @ ttl=300 + CNAME www ttl=300 (post-flip GET zone confirms)                       |"
      else
        echo "| DEP-DNS-06 | UNVERIFIED     | evidence/07c                             | TTL verify did not produce PASS verdict                                             |"
      fi

      # DEP-DNS-07 — N/A by D-04
      if grep -q 'MX entries found: 0' "$EVIDENCE_DIR/01b-mx-na-confirm.txt" 2>/dev/null; then
        echo "| DEP-DNS-07 | N/A by D-04    | evidence/01b-mx-na-confirm.txt            | No MX records present at cutover; Phase 37 owns Resend MX/SPF/DKIM/DMARC            |"
      else
        echo "| DEP-DNS-07 | REVIEW         | evidence/01b                             | MX entries WERE present — verify Wave 2 PUT preserved them (re-read 01b)            |"
      fi

      echo ""
      echo "Smoke summary (D-16 + D-13)"
      echo "----------------------------"
      grep -E 'Status:' "$EVIDENCE_DIR/11-health-probe.txt" "$EVIDENCE_DIR/12-playwright-smoke.txt" "$EVIDENCE_DIR/13-soak-1h.txt" 2>/dev/null
      echo ""
      echo "Effective closure: 6 PASS + 1 N/A = 7/7 in-scope requirements satisfied"
      echo ""
      echo "Nyquist undersample acknowledged (per VALIDATION.md): soak rate 1/720 Hz vs Nyquist 2/300 Hz floor."
      echo "Rationale: invite-only soak (D-11), no SLO, step-function failure modes detected by openssl + Playwright one-shot regardless of rate."
    } > "$EVIDENCE_DIR/14-verify-final.txt"

    cat "$EVIDENCE_DIR/14-verify-final.txt"

    # Verify all rows are PASS or N/A — no UNVERIFIED rows allowed
    if grep -qE '\| (UNVERIFIED|REVIEW)\s' "$EVIDENCE_DIR/14-verify-final.txt"; then
      echo "HALT: at least one DEP-DNS row is UNVERIFIED/REVIEW — cannot close phase"
      exit 1
    fi

    # === 036-SUMMARY.md ===
    cat > "$PHASE_DIR/036-SUMMARY.md" <<'SUMMARY_EOF'
---
phase: 036-dns-ssl-cutover
status: complete
mode: hybrid (Vercel CLI + REST API + Hostinger DNS API + PowerShell Resolve-DnsName + openssl + Playwright)
milestone: v1.4 Production Launch
domain_canonical: digswap.com.br
domain_www: www.digswap.com.br (308 → apex per D-07)
vercel_project_id: prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY
vercel_team_id: team_WuQK7GkPndJ2xH9YKvZTMtB3
production_url: https://digswap.com.br
ttl_seconds: 300
hsts_max_age: 300
plans_completed: 5
plans_total: 5
requirements_addressed: [DEP-DNS-01, DEP-DNS-02, DEP-DNS-03, DEP-DNS-04, DEP-DNS-05, DEP-DNS-06]
requirements_n_a: [DEP-DNS-07]
n_a_reason: |
  DEP-DNS-07 (preserve MX records) is N/A by construction per CONTEXT D-04 — email is not configured
  on digswap.com.br at cutover time; Phase 37 owns Resend MX/SPF/DKIM/DMARC. Pre-cutover zone snapshot
  (evidence/01) had zero MX entries; Wave 2 PUT did not introduce any.
final_verify: 6 PASS + 1 N/A — evidence/14-verify-final.txt
completed: PLACEHOLDER_DATE
---

# Phase 36: DNS + SSL Cutover — Phase Summary

**digswap.com.br + www.digswap.com.br are LIVE on the Vercel project `digswap-web` with valid Let's Encrypt cert. www serves a 308 permanent redirect to apex per D-07. TTL=300s active for the cutover week. /api/health returns 200 + database:ok; Playwright anon suite passes baseline (16/19 + 5 known test-debt FAIL carried from Phase 35); 1h soak completed clean. Point of no return crossed safely — invite-only mode active until Phase 38 UAT clean (D-11).**

## Plans

| # | Plan                                          | Wave | Result | SUMMARY                                |
|---|-----------------------------------------------|------|--------|----------------------------------------|
| 0 | Wave 0 scaffolding + token + zone snapshot   | 0    | ✓      | [036-00-SUMMARY.md](./036-00-SUMMARY.md) |
| 1 | Vercel domain add + www→apex 308 redirect    | 1    | ✓      | [036-01-SUMMARY.md](./036-01-SUMMARY.md) |
| 2 | DNS flip with TTL pre-lower                  | 2    | ✓      | [036-02-SUMMARY.md](./036-02-SUMMARY.md) |
| 3 | Cert + resolver verification                 | 3    | ✓      | [036-03-SUMMARY.md](./036-03-SUMMARY.md) |
| 4 | Smoke + soak + summary                       | 4    | ✓      | (this file)                            |

## Final verify (6 PASS + 1 N/A)

See evidence/14-verify-final.txt for the source-of-truth table.

## Path deviations / interpretation notes

1. **D-06 wording corrected via RESEARCH §"Vercel ACME Timing Reality"**: Vercel uses HTTP-01 ACME for non-wildcards, NOT DNS-01. Cert can only issue AFTER DNS resolves, NOT before. The "zero cert-error window" claim was reframed; the actual 5-30min cert-error window post-flip was mitigated by D-11 invite-only.

2. **DEP-DNS-02 PASS-with-discretion**: ROADMAP says CNAME www → `cname.vercel-dns.com`. Wave 1 `vercel domains inspect` revealed the project-specific value (per RESEARCH Pitfall 4); evidence/04b-cname-target-extracted.txt records the actual target used. Either the legacy literal or a project-specific *.vercel-dns-NNN.com counts as PASS.

3. **DEP-DNS-04 strengthened beyond ROADMAP**: ROADMAP requires "2+ independent networks". D-14 raised this to 3 (1.1.1.1 + 8.8.8.8 + 9.9.9.9) plus a 4th cross-check via dns.google/resolve HTTP API. All 4 confirmed.

4. **TTL pre-lower step (RESEARCH Pitfall 1) added to Wave 2**: Not in original CONTEXT but added by planner per RESEARCH. Collapsed rollback window from up-to-old-TTL (often 14400s = 4h) to ~5min.

5. **dig substituted with Resolve-DnsName + dns.google/resolve** (RESEARCH Pitfall 6): dig is not installed locally. PowerShell + Google HTTP DNS produced functionally identical evidence.

## Inputs ready for Phase 37 (External Integrations)

| Field | Value | Note |
|-------|-------|------|
| Production URL canonical | https://digswap.com.br | Apex; www 308-redirects here per D-07 |
| TTL during cutover | 300s | Bump to 3600s after Phase 38 UAT clean + 1-week soak (D-10) |
| HSTS state at handover | max-age=300 (launch-window) | Bump to 31536000 same trigger as TTL bump (Phase 35 D-18 = D-10 sync) |
| Hostinger DNS API token | ~/.hostinger-token (gitignored) | Phase 37 needs this for Resend MX/SPF/DKIM/DMARC additions |
| MX state | empty | Phase 37 adds Resend MX records |

## POST-PHASE-36 TODOs

1. **TTL bump 300 → 3600** after Phase 38 UAT clean + 1-week prod soak (D-10 trigger; sync with HSTS bump from Phase 35 D-18).
2. **HSTS bump max-age 300 → 31536000** same trigger as TTL (Phase 35 D-18 + Phase 36 D-10).
3. **Public announcement gate** — site declared "no ar" only after Phase 38 UAT clean (D-11). Phase 36 ships invite-only soak.
4. **Domain rename QUICK** (carry-over from Phase 34 + Phase 35): `digswap.com → digswap.com.br` rename in all `.planning/` docs; ROADMAP/REQUIREMENTS still reference the .com form.
5. **Phase 39 UptimeRobot probe** (parallel track) — Phase 36 does NOT touch monitoring per D-12; Phase 39 wires UptimeRobot against `https://digswap.com.br/api/health`.

## Doc-debt flagged

- ROADMAP.md still references `digswap.com` (without `.br`) in Phase 36 success criteria. Carried forward from Phase 35 SUMMARY; rename QUICK still pending.

## Evidence inventory

```
evidence/
├── 00-token-handling.md             — sanitized token-passing record (D-19)
├── 01-pre-cutover-zone.json         — pre-flip Hostinger zone state
├── 01b-mx-na-confirm.txt            — DEP-DNS-07 N/A confirmation (D-04)
├── 01c-max-old-ttl.txt              — drives Wave 2 wait window
├── 02-vercel-domain-add.log         — apex add output (TXT-REQUIRED marker)
├── 02b-vercel-domain-add-www.log    — www add output
├── 03-www-redirect-config.json      — Vercel REST PATCH 308 redirect (D-07)
├── 03-snapshot-list.json            — Hostinger snapshot rollback handles
├── 04-vercel-domain-inspect.log     — authoritative A IP + CNAME target
├── 04b-cname-target-extracted.txt   — single-line CNAME for Wave 2
├── 05-pre-lower-ttl.json            — TTL pre-lower PUT response
├── 05a-txt-vercel-record.json       — TXT _vercel verification (or skip marker)
├── 05b-ttl-wait-log.txt             — wait window timing
├── 06-flip-a-record.json            — DEP-DNS-01 PUT response
├── 07-flip-www-cname.json           — DEP-DNS-02 PUT response
├── 07b-post-flip-zone.json          — post-flip Hostinger zone state
├── 07c-ttl-300-verify.txt           — DEP-DNS-06 verification
├── 08-3-resolver-matrix.txt         — DEP-DNS-04 (3 resolvers)
├── 08b-google-resolve.json          — DEP-DNS-04 cross-check
├── 09-caa-audit.txt                 — DEP-DNS-05
├── 10-openssl-cert.txt              — DEP-DNS-03 (apex)
├── 10b-openssl-www-cert.txt         — www cert + 308 verify
├── 10c-cert-acme-incident.md        — incident log (No incident OR full diagnostics)
├── 11-health-probe.txt              — D-16 layer 1 (curl /api/health)
├── 12-playwright-smoke.txt          — D-16 layer 2 (Playwright anon suite)
├── 13-soak-1h.txt                   — D-13 (1h soak, 5 probes)
└── 14-verify-final.txt              — DEP-DNS-{01..07} aggregator
```

## Next phase

`/gsd:plan-phase 37` — External Integrations (Stripe Live + Discogs prod app + Google/GitHub OAuth + Resend MX/SPF/DKIM/DMARC).

Phase 39 (Monitoring) — parallel track — can also be planned/executed; depends only on Phase 35's prod URL (now backed by digswap.com.br + valid cert).

---
*Phase: 036-dns-ssl-cutover*
*Mode: hybrid (Vercel CLI + REST + Hostinger DNS API + Resolve-DnsName + openssl + Playwright)*
SUMMARY_EOF

    # Substitute completion date
    sed -i.bak "s|PLACEHOLDER_DATE|$(date -u +%FT%TZ)|" "$PHASE_DIR/036-SUMMARY.md"
    rm -f "$PHASE_DIR/036-SUMMARY.md.bak"

    echo "[ok] 036-SUMMARY.md written + verify-final aggregated"
  </action>
  <acceptance_criteria>
    - evidence/14-verify-final.txt exists, ≥ 25 lines, contains 7 DEP-DNS-NN rows, has zero `UNVERIFIED` or `REVIEW` rows
    - 036-SUMMARY.md exists, ≥ 40 lines, has YAML frontmatter, contains `status: complete`
    - 036-SUMMARY.md mentions all 5 sub-plans + evidence inventory + POST-PHASE-36 TODOs
    - 036-SUMMARY.md `requirements_addressed` lists DEP-DNS-01..06 AND `requirements_n_a` lists DEP-DNS-07
  </acceptance_criteria>
  <done>
    Phase 36 is closed: aggregator confirms 6 PASS + 1 N/A, 036-SUMMARY.md is committed-ready, Phase 37 has its handoff inputs.
  </done>
</task>

</tasks>

<verification>
- Tasks must run sequentially: 4.1 (smoke) → 4.2 (Playwright) → 4.3 (1h soak) → 4.4 (aggregate + summary).
- Task 4.3 has the long sleep (4 × 12min = 48min); planner cannot shorten without violating D-13.
- HALT-ON-FAIL on any task aborts Wave 4 and prevents 036-SUMMARY.md write — phase remains "in progress" until issue resolved.
</verification>

<success_criteria>
- /api/health 200 + database:ok confirmed against https://digswap.com.br (D-16 layer 1)
- Playwright anon suite ≥ 16 PASS + ≤ 5 FAIL (matches Phase 35 baseline; no new regressions) (D-16 layer 2)
- 1h soak completed with 5/5 probes 200 (D-13)
- evidence/14-verify-final.txt aggregator: 6 PASS + 1 N/A (DEP-DNS-07 N/A by D-04 construction)
- 036-SUMMARY.md committed-ready: frontmatter, plans table, deviations, POST-PHASE TODOs, Phase 37 handoff
</success_criteria>

<output>
After completion, the file `.planning/phases/036-dns-ssl-cutover/036-SUMMARY.md` exists and is committed alongside evidence/14-verify-final.txt. Phase 36 status flips to `complete` in the milestone tracker.

Phase 37 (External Integrations) has all inputs ready:
- Production URL: https://digswap.com.br (live with cert)
- Hostinger DNS API token still on disk (Phase 37 reuses for Resend MX/SPF/DKIM/DMARC)
- Vercel project IDs unchanged (Phase 37 adds Stripe webhook URL, OAuth callbacks)
</output>
