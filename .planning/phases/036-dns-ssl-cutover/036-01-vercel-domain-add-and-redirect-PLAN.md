---
phase: 036-dns-ssl-cutover
plan: 01
type: execute
wave: 1
depends_on: ["036-00"]
files_modified:
  - .planning/phases/036-dns-ssl-cutover/evidence/02-vercel-domain-add.log
  - .planning/phases/036-dns-ssl-cutover/evidence/02b-vercel-domain-add-www.log
  - .planning/phases/036-dns-ssl-cutover/evidence/03-www-redirect-config.json
  - .planning/phases/036-dns-ssl-cutover/evidence/04-vercel-domain-inspect.log
  - .planning/phases/036-dns-ssl-cutover/evidence/04b-cname-target-extracted.txt
autonomous: true
requirements: []
gap_closure: false

must_haves:
  truths:
    - "digswap.com.br is registered as a custom domain on Vercel project digswap-web (prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY)"
    - "www.digswap.com.br is registered on the same Vercel project AND configured as a 308 permanent redirect to digswap.com.br (per D-07)"
    - "vercel domains inspect output captures the EXACT A IP and CNAME target Vercel expects for THIS project — not the hardcoded literal (per RESEARCH Pitfall 4)"
    - "Any TXT _vercel verification record requested by Vercel is documented in evidence/02 — Wave 2 reads this to add the TXT before the A/CNAME flip if required"
    - "Cert is NOT yet issued (per RESEARCH §Vercel ACME Timing Reality — HTTP-01 cannot complete until DNS resolves at Vercel)"
  artifacts:
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/02-vercel-domain-add.log"
      provides: "vercel domains add digswap.com.br output — records ownership + any TXT verification + IP target"
      min_lines: 5
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/02b-vercel-domain-add-www.log"
      provides: "vercel domains add www.digswap.com.br output — records CNAME target Vercel expects"
      min_lines: 5
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/03-www-redirect-config.json"
      provides: "Vercel REST API PATCH response confirming www→apex 308 redirect (D-07)"
      min_lines: 1
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/04-vercel-domain-inspect.log"
      provides: "vercel domains inspect digswap.com.br — authoritative A/CNAME targets for this project"
      min_lines: 10
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/04b-cname-target-extracted.txt"
      provides: "Single-line CNAME target Wave 2 must use (e.g. cname.vercel-dns.com OR project-specific *.vercel-dns-NNN.com)"
      min_lines: 1
  key_links:
    - from: "Vercel project digswap-web (prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY)"
      to: "digswap.com.br + www.digswap.com.br"
      via: "vercel CLI domains add + REST API PATCH for redirect"
      pattern: "vercel domains add digswap.com.br"
---

<objective>
Add `digswap.com.br` (apex) and `www.digswap.com.br` to the Vercel project `digswap-web` AHEAD of any DNS change (D-06 ordering). Configure the www→apex 308 redirect (D-07). Discover the exact CNAME target Vercel wants for THIS project (RESEARCH Pitfall 4 — `cname.vercel-dns.com` literal vs project-specific `*.vercel-dns-NNN.com`) so Wave 2 uses the authoritative value, not a hardcoded guess.

Purpose: Vercel must own the domain config BEFORE the DNS flip. Once DNS resolves at Vercel, ACME HTTP-01 issuance kicks off automatically (per RESEARCH §"Vercel ACME Timing Reality" — cert issues AFTER DNS resolves, not before). If Vercel doesn't know about the domain when traffic arrives, it returns the platform fallback cert and a 404 — a worse failure mode than the brief 5-30min cert-error window we already accept.

Output: 5 evidence files. Vercel knows about both hostnames. www has the 308 redirect. Wave 2 has the exact CNAME target it needs.

HALT-ON-FAIL: If `vercel domains add digswap.com.br` or `vercel domains add www.digswap.com.br` fails (non-zero exit OR error in stderr that isn't an idempotent "already exists"), DO NOT proceed to Wave 2. Without Vercel knowing the domain, flipping DNS produces a guaranteed cert error window with no escape valve. Pause for user investigation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
<files_to_read>
- .planning/phases/036-dns-ssl-cutover/036-CONTEXT.md (D-06, D-07, D-08)
- .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md (§"Pattern 4: Vercel domain add", §"Pattern 5: www → apex 308 redirect", §"Vercel ACME Timing Reality", §"Pitfall 4: Vercel project-specific CNAME drift")
- .planning/phases/036-dns-ssl-cutover/036-00-SUMMARY.md (Wave 0 outputs — token confirmed live)
- .planning/phases/035-vercel-environment-wiring/035-SUMMARY.md (Vercel project IDs)
- .planning/phases/035-vercel-environment-wiring/evidence/06a-project-settings.txt (Vercel project config baseline)
</files_to_read>

<interfaces>
<!-- Vercel surfaces — exact commands + REST endpoints for Wave 1 -->

Vercel CLI (write surface for domain add):
  vercel domains add <domain> <project-name> --token "$(cat ~/.vercel-token)"
  vercel domains inspect <domain> --token "$(cat ~/.vercel-token)"

Vercel REST API v9 (write surface for www redirect — CLI doesn't expose redirectStatusCode):
  PATCH https://api.vercel.com/v9/projects/{projectId}/domains/{domain}?teamId={teamId}
  Header: Authorization: Bearer $VERCEL_TOKEN
  Header: Content-Type: application/json
  Body: {"redirect":"digswap.com.br","redirectStatusCode":308}

Phase 35 LOCKED constants (never edit, just reference):
  Vercel project_id   = prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY
  Vercel team_id      = team_WuQK7GkPndJ2xH9YKvZTMtB3
  Vercel project name = digswap-web
  Domain canonical    = digswap.com.br

Token files on disk (Phase 35 + Wave 0):
  ~/.vercel-token    (Phase 35 — for vercel CLI + REST)
  ~/.hostinger-token (Wave 0 — NOT used in this plan)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1.1: Add apex digswap.com.br to Vercel project digswap-web</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/02-vercel-domain-add.log</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md §"Pattern 4: Vercel domain add"
    - .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md §"Open Questions" #2 (TXT verification may not be required for fresh domain)
  </read_first>
  <action>
    Run from git-bash at the repo root (NOT from apps/web — vercel CLI uses --token flag so cwd doesn't matter for `domains add`).

    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"
    VERCEL_TOKEN_FILE="$HOME/.vercel-token"
    test -s "$VERCEL_TOKEN_FILE" || { echo "HALT: ~/.vercel-token missing (Phase 35 prerequisite)"; exit 1; }

    # Add apex. Capture stdout+stderr (Vercel writes the TXT verification + A IP guidance to stderr).
    vercel domains add digswap.com.br digswap-web --token "$(cat "$VERCEL_TOKEN_FILE")" 2>&1 | \
      tee "$EVIDENCE_DIR/02-vercel-domain-add.log"

    EXIT=${PIPESTATUS[0]}

    # Treat "already exists" / "already configured" as idempotent success — Phase 35 may have left a leftover.
    if [ "$EXIT" -ne 0 ]; then
      if grep -qiE "already (exists|configured|in use|added)" "$EVIDENCE_DIR/02-vercel-domain-add.log"; then
        echo "[idempotent] domain already on project — proceeding" | tee -a "$EVIDENCE_DIR/02-vercel-domain-add.log"
      else
        echo "HALT: vercel domains add apex returned exit $EXIT with non-idempotent error" | tee -a "$EVIDENCE_DIR/02-vercel-domain-add.log"
        exit 1
      fi
    fi

    # Surface any TXT _vercel verification requirement (RESEARCH §Open Questions #2)
    if grep -qiE "_vercel|TXT" "$EVIDENCE_DIR/02-vercel-domain-add.log"; then
      echo "" | tee -a "$EVIDENCE_DIR/02-vercel-domain-add.log"
      echo "[TXT-REQUIRED] Vercel requested a TXT verification record — Wave 2 must add it via Hostinger PUT BEFORE the A/CNAME flip" | tee -a "$EVIDENCE_DIR/02-vercel-domain-add.log"
    else
      echo "" | tee -a "$EVIDENCE_DIR/02-vercel-domain-add.log"
      echo "[TXT-NOT-REQUIRED] No TXT _vercel verification mentioned — Wave 2 proceeds directly to A/CNAME flip" | tee -a "$EVIDENCE_DIR/02-vercel-domain-add.log"
    fi
  </action>
  <acceptance_criteria>
    - evidence/02-vercel-domain-add.log exists, ≥ 5 lines
    - Either: command exited 0, OR log contains literal "already" indicating idempotent success
    - Log contains exactly ONE of `[TXT-REQUIRED]` / `[TXT-NOT-REQUIRED]` markers (drives Wave 2 branch)
  </acceptance_criteria>
  <done>
    Vercel project owns digswap.com.br. TXT verification requirement (if any) is documented for Wave 2.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 1.2: Add www.digswap.com.br to Vercel project digswap-web</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/02b-vercel-domain-add-www.log</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/evidence/02-vercel-domain-add.log (apex add succeeded)
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"

    vercel domains add www.digswap.com.br digswap-web --token "$(cat ~/.vercel-token)" 2>&1 | \
      tee "$EVIDENCE_DIR/02b-vercel-domain-add-www.log"

    EXIT=${PIPESTATUS[0]}

    if [ "$EXIT" -ne 0 ]; then
      if grep -qiE "already (exists|configured|in use|added)" "$EVIDENCE_DIR/02b-vercel-domain-add-www.log"; then
        echo "[idempotent] www already on project — proceeding" | tee -a "$EVIDENCE_DIR/02b-vercel-domain-add-www.log"
      else
        echo "HALT: vercel domains add www returned exit $EXIT with non-idempotent error" | tee -a "$EVIDENCE_DIR/02b-vercel-domain-add-www.log"
        exit 1
      fi
    fi
  </action>
  <acceptance_criteria>
    - evidence/02b-vercel-domain-add-www.log exists, ≥ 5 lines
    - Either: command exited 0, OR log contains literal "already" indicating idempotent success
  </acceptance_criteria>
  <done>
    Vercel project owns www.digswap.com.br as a separate domain entry — required before redirect can be configured.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 1.3: Configure www → apex 308 permanent redirect via Vercel REST API (D-07)</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/03-www-redirect-config.json</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/036-CONTEXT.md (D-07: apex canonical, www → 308 redirect)
    - .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md §"Pattern 5: www → apex 308 redirect"
    - .planning/phases/036-dns-ssl-cutover/evidence/02b-vercel-domain-add-www.log (www exists on project)
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"
    VERCEL_TOKEN=$(cat ~/.vercel-token)
    PROJECT_ID="prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY"
    TEAM_ID="team_WuQK7GkPndJ2xH9YKvZTMtB3"

    # PATCH the www domain entry on the project. Body shape per RESEARCH §"Pattern 5".
    curl -sS -X PATCH \
      -H "Authorization: Bearer $VERCEL_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"redirect":"digswap.com.br","redirectStatusCode":308}' \
      -w "\nHTTP_CODE:%{http_code}\n" \
      -o "$EVIDENCE_DIR/03-www-redirect-config.json" \
      "https://api.vercel.com/v9/projects/${PROJECT_ID}/domains/www.digswap.com.br?teamId=${TEAM_ID}" \
      | tee "$EVIDENCE_DIR/03-www-redirect-config.http-code.txt"

    HTTP_CODE=$(grep -oE 'HTTP_CODE:[0-9]+' "$EVIDENCE_DIR/03-www-redirect-config.http-code.txt" | cut -d: -f2)
    case "$HTTP_CODE" in
      200|201) echo "[ok] redirect configured: 308 www→apex";;
      *) echo "HALT: PATCH redirect returned $HTTP_CODE"; cat "$EVIDENCE_DIR/03-www-redirect-config.json"; exit 1;;
    esac

    # Verify response body confirms redirect + statusCode
    grep -qE '"redirect"\s*:\s*"digswap\.com\.br"' "$EVIDENCE_DIR/03-www-redirect-config.json" \
      || { echo "HALT: response body lacks redirect=digswap.com.br"; exit 1; }
    grep -qE '"redirectStatusCode"\s*:\s*308' "$EVIDENCE_DIR/03-www-redirect-config.json" \
      || { echo "HALT: response body lacks redirectStatusCode=308"; exit 1; }

    echo "[verified] D-07 satisfied via Vercel REST API"
  </action>
  <acceptance_criteria>
    - evidence/03-www-redirect-config.json exists, contains literal `"redirect":"digswap.com.br"` and `"redirectStatusCode":308`
    - evidence/03-www-redirect-config.http-code.txt contains `HTTP_CODE:200` or `HTTP_CODE:201`
  </acceptance_criteria>
  <done>
    www→apex 308 redirect is configured at Vercel project level; will activate the moment DNS resolves www to Vercel.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 1.4: Inspect Vercel domain to discover authoritative A IP + CNAME target</name>
  <files>
    .planning/phases/036-dns-ssl-cutover/evidence/04-vercel-domain-inspect.log
    .planning/phases/036-dns-ssl-cutover/evidence/04b-cname-target-extracted.txt
  </files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md §"Pitfall 4: Vercel project-specific CNAME drift"
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"

    # Inspect apex — primary source of truth for what A IP Vercel wants
    vercel domains inspect digswap.com.br --token "$(cat ~/.vercel-token)" 2>&1 | \
      tee "$EVIDENCE_DIR/04-vercel-domain-inspect.log"

    # Inspect www — source of truth for the CNAME target
    echo "" | tee -a "$EVIDENCE_DIR/04-vercel-domain-inspect.log"
    echo "=== www.digswap.com.br ===" | tee -a "$EVIDENCE_DIR/04-vercel-domain-inspect.log"
    vercel domains inspect www.digswap.com.br --token "$(cat ~/.vercel-token)" 2>&1 | \
      tee -a "$EVIDENCE_DIR/04-vercel-domain-inspect.log"

    # Extract the CNAME target Vercel wants for www. Two patterns:
    #   1. Legacy literal: cname.vercel-dns.com
    #   2. Project-specific: <hash>.vercel-dns-NNN.com
    # The inspect output typically prints lines like "CNAME  <target>"
    CNAME_TARGET=$(grep -oE '[a-z0-9.-]+\.vercel-dns(-[0-9]+)?\.com\.?' "$EVIDENCE_DIR/04-vercel-domain-inspect.log" | head -1)

    if [ -z "$CNAME_TARGET" ]; then
      echo "[fallback] inspect did not surface a *.vercel-dns*.com target — using legacy literal cname.vercel-dns.com per RESEARCH Pitfall 4"
      CNAME_TARGET="cname.vercel-dns.com."
    else
      # Normalize trailing dot for Hostinger (RESEARCH §Open Questions #4 — Hostinger may want trailing dot)
      case "$CNAME_TARGET" in
        *.) ;;
        *)  CNAME_TARGET="${CNAME_TARGET}.";;
      esac
    fi

    # Persist single-line target for Wave 2 to read
    printf '%s\n' "$CNAME_TARGET" > "$EVIDENCE_DIR/04b-cname-target-extracted.txt"

    # Log decision
    echo "" | tee -a "$EVIDENCE_DIR/04-vercel-domain-inspect.log"
    echo "[wave-2-handoff] CNAME target Wave 2 will use: $CNAME_TARGET" | tee -a "$EVIDENCE_DIR/04-vercel-domain-inspect.log"

    # Sanity: target must end in .vercel-dns.com. or .vercel-dns-NNN.com.
    grep -qE '^[a-z0-9.-]+\.vercel-dns(-[0-9]+)?\.com\.$' "$EVIDENCE_DIR/04b-cname-target-extracted.txt" \
      || { echo "HALT: extracted CNAME target does not match Vercel pattern"; cat "$EVIDENCE_DIR/04b-cname-target-extracted.txt"; exit 1; }

    # The apex A IP is fixed at 76.76.21.21 across all Vercel projects (per Vercel docs);
    # confirm inspect output does not contradict.
    if grep -qE '\b76\.76\.21\.21\b' "$EVIDENCE_DIR/04-vercel-domain-inspect.log"; then
      echo "[apex-ip-confirmed] 76.76.21.21 appears in inspect — Wave 2 uses this literal"
    else
      echo "[apex-ip-noted] 76.76.21.21 not surfaced in inspect output, but it is Vercel's documented apex IP. Wave 2 will use 76.76.21.21 unless inspect explicitly returns a different IP."
    fi
  </action>
  <acceptance_criteria>
    - evidence/04-vercel-domain-inspect.log ≥ 10 lines, includes a `=== www.digswap.com.br ===` divider
    - evidence/04b-cname-target-extracted.txt is non-empty, single line, matches regex `^[a-z0-9.-]+\.vercel-dns(-[0-9]+)?\.com\.$`
    - evidence/04-vercel-domain-inspect.log contains literal `[wave-2-handoff] CNAME target Wave 2 will use:`
  </acceptance_criteria>
  <done>
    Wave 2 has the EXACT CNAME target on disk in a one-line file. Apex A IP is confirmed 76.76.21.21 (or contradicted, in which case the noted value drives Wave 2).
  </done>
</task>

</tasks>

<verification>
- All 4 tasks must complete sequentially (1.1 → 1.2 → 1.3 → 1.4). Tasks 1.3 and 1.4 each depend on 1.2.
- After this wave: Vercel knows about both hostnames. www has a 308 redirect to apex. Wave 2 has the exact CNAME target written to evidence/04b-cname-target-extracted.txt.
- Cert is NOT yet issued — that is correct and expected per RESEARCH §"Vercel ACME Timing Reality".
- HALT-ON-FAIL: if any task halts, do NOT touch DNS in Wave 2. The DNS flip without a registered Vercel domain produces a guaranteed cert-error window with no recovery beyond rollback.
</verification>

<success_criteria>
- digswap.com.br appears as a custom domain on Vercel project digswap-web
- www.digswap.com.br appears with redirect=digswap.com.br + redirectStatusCode=308 (verified via PATCH response body)
- evidence/04b-cname-target-extracted.txt holds a single-line authoritative CNAME target
- evidence/02-vercel-domain-add.log carries an explicit `[TXT-REQUIRED]` or `[TXT-NOT-REQUIRED]` marker for Wave 2 branching
- D-07 (apex canonical, www→308 redirect) is satisfied at the Vercel project layer; takes effect when DNS resolves
</success_criteria>

<output>
After completion, create `.planning/phases/036-dns-ssl-cutover/036-01-SUMMARY.md` with:
- Both `vercel domains add` outcomes (success / idempotent / failed)
- Whether TXT _vercel verification is required (drives Wave 2 first step)
- Single-line authoritative CNAME target for Wave 2
- Whether Vercel inspect surfaced 76.76.21.21 as apex IP
- Cert state: NOT YET ISSUED (correct per HTTP-01 timing)
- Wave 2 prerequisites: green
</output>
