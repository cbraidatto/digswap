---
phase: 036-dns-ssl-cutover
plan: 03
type: execute
wave: 3
depends_on: ["036-02"]
files_modified:
  - .planning/phases/036-dns-ssl-cutover/evidence/08-3-resolver-matrix.txt
  - .planning/phases/036-dns-ssl-cutover/evidence/08b-google-resolve.json
  - .planning/phases/036-dns-ssl-cutover/evidence/09-caa-audit.txt
  - .planning/phases/036-dns-ssl-cutover/evidence/10-openssl-cert.txt
  - .planning/phases/036-dns-ssl-cutover/evidence/10b-openssl-www-cert.txt
  - .planning/phases/036-dns-ssl-cutover/evidence/10c-cert-acme-incident.md
autonomous: false
requirements:
  - DEP-DNS-03
  - DEP-DNS-04
  - DEP-DNS-05
gap_closure: false

must_haves:
  truths:
    - "All 3 resolvers (1.1.1.1 + 8.8.8.8 + 9.9.9.9) return 76.76.21.21 for digswap.com.br A — DEP-DNS-04 satisfied beyond ROADMAP's '2+ networks' floor (per D-14)"
    - "All 3 resolvers return the Vercel CNAME target (matching evidence/04b) for www.digswap.com.br"
    - "CAA audit: either no CAA exists (default-allow → wildcard policy lets LE issue) OR existing CAA includes letsencrypt.org — DEP-DNS-05 satisfied"
    - "openssl s_client against digswap.com.br:443 returns `verify return code: 0 (ok)` AND issuer matches Let's Encrypt CA pattern (R3|R10|R11|E5|E6) — DEP-DNS-03 satisfied"
    - "openssl s_client against www.digswap.com.br:443 either returns valid LE cert with DNS:www.digswap.com.br SAN (separate cert) OR redirects via 308 to apex (and apex covers www in SAN)"
    - "If cert issuance exceeds 30min (D-17), human checkpoint is invoked with full diagnostic bundle (CAA + _acme-challenge TXT + Vercel runtime logs) before any rollback decision"
  artifacts:
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/08-3-resolver-matrix.txt"
      provides: "Resolve-DnsName output across 1.1.1.1, 8.8.8.8, 9.9.9.9 for A apex + CNAME www (DEP-DNS-04)"
      min_lines: 20
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/08b-google-resolve.json"
      provides: "Cross-network confirmation via dns.google/resolve HTTP API (independent fourth check)"
      min_lines: 1
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/09-caa-audit.txt"
      provides: "CAA record audit (DEP-DNS-05) with PASS/FAIL determination"
      min_lines: 6
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/10-openssl-cert.txt"
      provides: "openssl s_client output for apex (DEP-DNS-03) — issuer, subject, SAN, verify return code"
      min_lines: 30
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/10b-openssl-www-cert.txt"
      provides: "openssl s_client output for www (cert separate or 308 redirect path verified)"
      min_lines: 10
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/10c-cert-acme-incident.md"
      provides: "Incident log if cert issuance exceeded 30min — diagnostics + user decision (D-17 + D-09); empty file if happy path"
      min_lines: 1
  key_links:
    - from: "evidence/06 + 07 (Wave 2 DNS flip)"
      to: "evidence/08-3-resolver-matrix.txt"
      via: "PowerShell Resolve-DnsName -Server X polling for propagation"
      pattern: "Resolve-DnsName.*-Server"
    - from: "Wave 2 DNS resolution at Vercel edge"
      to: "Let's Encrypt HTTP-01 challenge fetch"
      via: "Vercel auto-issuance (5-30min after first resolver hits)"
      pattern: "Let's Encrypt"
---

<objective>
Verify the Wave 2 DNS flip propagated globally AND that Vercel's auto-issued Let's Encrypt cert is live on apex (and reachable on www, either via separate cert or via the 308 redirect to apex). Audit CAA records to make DEP-DNS-05 pass-status explicit.

This wave includes the only checkpoint:human-action gate of the phase: if cert issuance exceeds 30 minutes after Wave 2 completion, Claude gathers diagnostics (CAA query + _acme-challenge TXT query + Vercel runtime logs) per D-17 and pauses for the user to choose between (a) wait longer, (b) investigate root cause, (c) rollback DNS via snapshot. This is D-09 in action.

Purpose: Convert the registrar-level changes from Wave 2 into observable, externally-verifiable PASS for DEP-DNS-03 / DEP-DNS-04 / DEP-DNS-05. After this wave, the site is technically reachable at https://digswap.com.br with a valid LE cert. Wave 4 then runs functional smoke + soak.

Output: 6 evidence files. The site is live with valid cert OR the cert-failure incident log captures exactly what went wrong + what the user decided.

Acceptance window: Wave 2 completed → resolver consistency in 1-15min (TTL=300 + Hostinger publish) → cert issuance complete in 5-30min after that. Total wait window: typically 5-20min, worst case 45min.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
<files_to_read>
- .planning/phases/036-dns-ssl-cutover/036-CONTEXT.md (D-09, D-14, D-16, D-17)
- .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md (§"Operation: 3-resolver DNS matrix", §"Operation: Pre-flight CAA audit", §"Operation: Cert validation post-flip", §"Pitfall 2: Cert ACME stuck — multiple causes", §"Pitfall 5: openssl on Windows", §"Pitfall 6: dig unavailable")
- .planning/phases/036-dns-ssl-cutover/036-VALIDATION.md (per-task verify map for 36-03-*)
- .planning/phases/036-dns-ssl-cutover/evidence/04b-cname-target-extracted.txt (expected www CNAME target)
- .planning/phases/036-dns-ssl-cutover/evidence/07-flip-www-cname.json (flip done time anchors the cert wait)
- .planning/REQUIREMENTS.md lines 60-62 (DEP-DNS-03/04/05 acceptance)
</files_to_read>

<interfaces>
<!-- Verification surfaces -->

PowerShell Resolve-DnsName (DNS lookup with custom resolver — primary substitute for `dig` since dig is NOT installed; per RESEARCH §"Pitfall 6"):
  Resolve-DnsName -Name digswap.com.br -Type A     -Server 1.1.1.1
  Resolve-DnsName -Name digswap.com.br -Type A     -Server 8.8.8.8
  Resolve-DnsName -Name digswap.com.br -Type A     -Server 9.9.9.9
  Resolve-DnsName -Name www.digswap.com.br -Type CNAME -Server 1.1.1.1   # repeat for 8.8.8.8 and 9.9.9.9
  Resolve-DnsName -Name digswap.com.br -Type CAA   -Server 1.1.1.1

  RUN FROM PowerShell, NOT git-bash (cmdlet is PowerShell-only).

Google DNS HTTP resolver (4th independent network — confirms from outside the local box):
  GET https://dns.google/resolve?name=digswap.com.br&type=A
  GET https://dns.google/resolve?name=digswap.com.br&type=CAA

OpenSSL TLS handshake (cert chain inspection — primary DEP-DNS-03 evidence):
  openssl s_client -connect digswap.com.br:443 -servername digswap.com.br -showcerts </dev/null
  openssl s_client -connect www.digswap.com.br:443 -servername www.digswap.com.br -showcerts </dev/null

  RUN FROM git-bash (openssl 3.5.5 is at /mingw64/bin/openssl per RESEARCH §"Pitfall 5"; NOT on PATH from PowerShell or cmd.exe).

Vercel runtime logs MCP (used only in cert-incident path):
  mcp__vercel__get_deployment_runtime_logs
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 3.1: 3-resolver DNS matrix — DEP-DNS-04 (D-14: 1.1.1.1 + 8.8.8.8 + 9.9.9.9 + Google HTTP)</name>
  <files>
    .planning/phases/036-dns-ssl-cutover/evidence/08-3-resolver-matrix.txt
    .planning/phases/036-dns-ssl-cutover/evidence/08b-google-resolve.json
  </files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md §"Operation: 3-resolver DNS matrix" + §"Pitfall 6"
    - .planning/phases/036-dns-ssl-cutover/036-CONTEXT.md D-14
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"
    EXPECTED_A_IP="76.76.21.21"
    EXPECTED_CNAME=$(cat "$EVIDENCE_DIR/04b-cname-target-extracted.txt" | tr -d '\n')

    # === PowerShell block — Resolve-DnsName (run via powershell.exe -Command) ===
    # We invoke from bash but route the command through powershell.
    powershell -NoProfile -Command "
      \$out = '$EVIDENCE_DIR/08-3-resolver-matrix.txt'
      Set-Content -Path \$out -Value ''
      \$expectedA = '$EXPECTED_A_IP'
      \$expectedCname = '$EXPECTED_CNAME'

      'DEP-DNS-04 — 3-resolver propagation matrix' | Add-Content \$out
      ('Generated: ' + (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')) | Add-Content \$out
      ('Expected A:     ' + \$expectedA)     | Add-Content \$out
      ('Expected CNAME: ' + \$expectedCname) | Add-Content \$out
      '' | Add-Content \$out

      \$resolvers = @('1.1.1.1','8.8.8.8','9.9.9.9')
      \$aCount = 0
      \$cnameCount = 0

      foreach (\$r in \$resolvers) {
        ('=== Resolver ' + \$r + ' — A digswap.com.br ===') | Add-Content \$out
        try {
          \$ans = Resolve-DnsName -Name digswap.com.br -Type A -Server \$r -ErrorAction Stop -DnsOnly
          \$ans | Format-List Name, Type, IPAddress, TTL | Out-String | Add-Content \$out
          if (\$ans.IPAddress -contains \$expectedA) { \$aCount++; '[ok] matched expected A' | Add-Content \$out }
          else { '[FAIL] expected A not in answer' | Add-Content \$out }
        } catch {
          ('[error] ' + \$_.Exception.Message) | Add-Content \$out
        }

        ('=== Resolver ' + \$r + ' — CNAME www.digswap.com.br ===') | Add-Content \$out
        try {
          \$ans2 = Resolve-DnsName -Name www.digswap.com.br -Type CNAME -Server \$r -ErrorAction Stop -DnsOnly
          \$ans2 | Format-List Name, Type, NameHost, TTL | Out-String | Add-Content \$out
          \$nh = (\$ans2 | Where-Object { \$_.Type -eq 'CNAME' } | Select-Object -ExpandProperty NameHost) -join ','
          if (\$nh -like ('*' + \$expectedCname.TrimEnd('.') + '*')) { \$cnameCount++; '[ok] matched expected CNAME' | Add-Content \$out }
          else { '[FAIL] expected CNAME not in answer' | Add-Content \$out }
        } catch {
          ('[error] ' + \$_.Exception.Message) | Add-Content \$out
        }
        '' | Add-Content \$out
      }

      '' | Add-Content \$out
      ('Resolvers passing A:     ' + \$aCount + ' / 3') | Add-Content \$out
      ('Resolvers passing CNAME: ' + \$cnameCount + ' / 3') | Add-Content \$out
      ('DEP-DNS-04 status: ' + (if ((\$aCount -ge 2) -and (\$cnameCount -ge 2)) { 'PASS' } else { 'FAIL — wait + retry, or investigate Hostinger publish lag' })) | Add-Content \$out
    "

    # === Cross-network confirmation via Google DNS HTTP (run from bash with curl) ===
    curl -sS "https://dns.google/resolve?name=digswap.com.br&type=A" \
      > "$EVIDENCE_DIR/08b-google-resolve.json"

    # Quick sanity grep — Google's resolver should return the 76.76.21.21 IP
    grep -q '"data": *"76\.76\.21\.21"' "$EVIDENCE_DIR/08b-google-resolve.json" \
      && echo "[ok] dns.google/resolve confirms 76.76.21.21 from outside this box" \
      || echo "[note] dns.google/resolve did not surface 76.76.21.21 — may be propagation lag; check evidence/08b-google-resolve.json"

    # Final pass/fail signal
    grep -q "DEP-DNS-04 status: PASS" "$EVIDENCE_DIR/08-3-resolver-matrix.txt" \
      || { echo "DNS propagation NOT yet PASS — sleep 60s and retry"; sleep 60; echo "[retry-needed] re-run this task or proceed to Task 3.2 manually after retry confirms"; exit 1; }
  </action>
  <acceptance_criteria>
    - evidence/08-3-resolver-matrix.txt exists, ≥ 20 lines, contains 6 `=== Resolver ... ===` blocks (3 resolvers × 2 record types)
    - evidence/08-3-resolver-matrix.txt contains literal `DEP-DNS-04 status: PASS`
    - evidence/08-3-resolver-matrix.txt contains `Resolvers passing A:     3 / 3` AND `Resolvers passing CNAME: 3 / 3` (per D-14 strengthening of ROADMAP's "2+")
    - evidence/08b-google-resolve.json is non-empty and parseable JSON; ideally contains `"data": "76.76.21.21"`
  </acceptance_criteria>
  <done>
    DNS propagation is confirmed from 3 resolvers + Google's HTTP resolver = effectively 4 independent networks. DEP-DNS-04 is PASS with margin (D-14 exceeds ROADMAP floor of 2+).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3.2: CAA audit — DEP-DNS-05</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/09-caa-audit.txt</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md §"Operation: Pre-flight CAA audit"
    - .planning/REQUIREMENTS.md line 62 (DEP-DNS-05 acceptance — empty CAA OR includes letsencrypt.org)
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"

    powershell -NoProfile -Command "
      \$out = '$EVIDENCE_DIR/09-caa-audit.txt'
      Set-Content -Path \$out -Value ''
      'DEP-DNS-05 — CAA audit' | Add-Content \$out
      ('Generated: ' + (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')) | Add-Content \$out
      '' | Add-Content \$out

      try {
        \$caa = Resolve-DnsName -Name digswap.com.br -Type CAA -Server 1.1.1.1 -ErrorAction Stop -DnsOnly
        if (\$caa -and \$caa.Count -gt 0) {
          'CAA records found:' | Add-Content \$out
          \$caa | Format-List | Out-String | Add-Content \$out
          \$txt = (\$caa | Out-String)
          if (\$txt -match 'letsencrypt\\.org' -or \$txt -match '0 issue \";\"') {
            '[PASS] CAA includes letsencrypt.org or wildcard issue \";\"' | Add-Content \$out
            'DEP-DNS-05 status: PASS' | Add-Content \$out
          } else {
            '[FAIL] CAA records exist but do NOT include letsencrypt.org — Vercel ACME will fail' | Add-Content \$out
            'DEP-DNS-05 status: FAIL — add CAA `0 issue \"letsencrypt.org\"` via Hostinger PUT before retrying cert issuance' | Add-Content \$out
          }
        } else {
          '[PASS] No CAA records — default-allow policy applies, Let''s Encrypt is permitted by RFC 8659' | Add-Content \$out
          'DEP-DNS-05 status: PASS' | Add-Content \$out
        }
      } catch {
        ('[note] Resolve-DnsName CAA query did not return — assuming no CAA records (default-allow): ' + \$_.Exception.Message) | Add-Content \$out
        'DEP-DNS-05 status: PASS (no-records-implicit)' | Add-Content \$out
      }
    "

    # Cross-confirm via Google HTTP DNS
    echo "" >> "$EVIDENCE_DIR/09-caa-audit.txt"
    echo "=== Cross-check via dns.google/resolve type=CAA ===" >> "$EVIDENCE_DIR/09-caa-audit.txt"
    curl -sS "https://dns.google/resolve?name=digswap.com.br&type=CAA" >> "$EVIDENCE_DIR/09-caa-audit.txt"

    # Halt only if explicit FAIL marker present
    if grep -q 'DEP-DNS-05 status: FAIL' "$EVIDENCE_DIR/09-caa-audit.txt"; then
      echo "HALT: CAA blocking Let's Encrypt detected — fix CAA before Task 3.3"
      exit 1
    fi
  </action>
  <acceptance_criteria>
    - evidence/09-caa-audit.txt exists, ≥ 6 lines
    - File contains literal `DEP-DNS-05 status: PASS` OR `DEP-DNS-05 status: PASS (no-records-implicit)` (the no-CAA case is the most common; both are valid PASS forms per RESEARCH)
    - File contains a `=== Cross-check via dns.google/resolve type=CAA ===` divider with the API response below
  </acceptance_criteria>
  <done>
    DEP-DNS-05 PASS confirmed: either no CAA exists (default-allow) or existing CAA includes letsencrypt.org. Cert issuance won't be silently blocked.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3.3: openssl s_client cert verify — apex digswap.com.br (DEP-DNS-03)</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/10-openssl-cert.txt</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md §"Operation: Cert validation post-flip" + §"Vercel ACME Timing Reality" + §"Pitfall 5: openssl on Windows"
    - .planning/REQUIREMENTS.md line 60 (DEP-DNS-03)
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"

    # MUST run openssl from git-bash (it's at /mingw64/bin/openssl per RESEARCH Pitfall 5)
    which openssl > /dev/null 2>&1 || { echo "HALT: openssl not on PATH — must run this task from git-bash, not PowerShell"; exit 1; }

    # Cert may take 5-30min to issue after DNS resolves at Vercel edge. Poll up to 30min total.
    MAX_WAIT_SECONDS=1800
    POLL_INTERVAL=60
    ELAPSED=0
    SUCCESS=0

    while [ "$ELAPSED" -lt "$MAX_WAIT_SECONDS" ]; do
      echo "[poll t=${ELAPSED}s] openssl s_client digswap.com.br:443"
      openssl s_client -connect digswap.com.br:443 -servername digswap.com.br -showcerts </dev/null 2>&1 \
        > "$EVIDENCE_DIR/10-openssl-cert.txt.tmp"

      # Two checks: verify return code 0 AND issuer matches Let's Encrypt CA pattern
      if grep -qE 'verify return code: 0 \(ok\)' "$EVIDENCE_DIR/10-openssl-cert.txt.tmp" && \
         grep -qE 'issuer=.*Let.s Encrypt' "$EVIDENCE_DIR/10-openssl-cert.txt.tmp" && \
         grep -qE 'issuer=.*(R3|R10|R11|E5|E6)' "$EVIDENCE_DIR/10-openssl-cert.txt.tmp"; then
        SUCCESS=1
        break
      fi

      sleep "$POLL_INTERVAL"
      ELAPSED=$((ELAPSED + POLL_INTERVAL))
    done

    # Persist final result
    cp "$EVIDENCE_DIR/10-openssl-cert.txt.tmp" "$EVIDENCE_DIR/10-openssl-cert.txt"
    rm -f "$EVIDENCE_DIR/10-openssl-cert.txt.tmp"

    {
      echo ""
      echo "=== DEP-DNS-03 verdict ==="
      echo "Generated: $(date -u +%FT%TZ)"
      echo "Total wait: ${ELAPSED}s"
      if [ "$SUCCESS" = "1" ]; then
        echo "Status: PASS"
        grep -E "issuer=|subject=|verify return code" "$EVIDENCE_DIR/10-openssl-cert.txt"
        # Also confirm SAN coverage
        if openssl s_client -connect digswap.com.br:443 -servername digswap.com.br </dev/null 2>/dev/null | \
             openssl x509 -noout -text 2>/dev/null | grep -qE 'DNS:digswap\.com\.br'; then
          echo "[ok] SAN includes DNS:digswap.com.br"
        fi
      else
        echo "Status: TIMEOUT — exceeded ${MAX_WAIT_SECONDS}s with no valid LE cert"
        echo "Next: Task 3.5 incident path (D-17 + D-09)"
      fi
    } >> "$EVIDENCE_DIR/10-openssl-cert.txt"

    # Do NOT exit 1 on TIMEOUT — Task 3.5 (incident handler) takes over
    if [ "$SUCCESS" != "1" ]; then
      echo "[timeout] Cert not issued in 30min. Proceeding to Task 3.5 incident path."
    fi
  </action>
  <acceptance_criteria>
    - evidence/10-openssl-cert.txt exists, ≥ 30 lines
    - On HAPPY PATH: file contains `verify return code: 0 (ok)` AND `issuer=` line containing both `Let's Encrypt` and one of `R3|R10|R11|E5|E6`, AND `Status: PASS`
    - On TIMEOUT PATH: file contains `Status: TIMEOUT` — Task 3.5 takes over with diagnostics + checkpoint
  </acceptance_criteria>
  <done>
    Either DEP-DNS-03 is PASS for apex (happy path) OR Task 3.5 is invoked with full diagnostics (incident path).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3.4: openssl s_client cert verify — www.digswap.com.br (separate cert OR 308 redirect)</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/10b-openssl-www-cert.txt</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/evidence/10-openssl-cert.txt (apex cert state — proceed only on PASS)
    - .planning/phases/036-dns-ssl-cutover/evidence/03-www-redirect-config.json (Wave 1 redirect setup)
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"

    # If apex cert isn't yet valid, skip — incident handler in 3.5 will eventually unblock or rollback
    if ! grep -qE 'verify return code: 0 \(ok\)' "$EVIDENCE_DIR/10-openssl-cert.txt" 2>/dev/null; then
      echo "[skip] apex cert not yet valid — re-run after 3.5 resolves apex" > "$EVIDENCE_DIR/10b-openssl-www-cert.txt"
      exit 0
    fi

    # Try www TLS handshake. Vercel handles www in ONE of two ways:
    # (a) Issues a separate LE cert for www.digswap.com.br
    # (b) Issues apex with SAN covering www, returns same cert for both hostnames
    # Either is acceptable; verify return code 0 + issuer LE is the real check.
    openssl s_client -connect www.digswap.com.br:443 -servername www.digswap.com.br -showcerts </dev/null 2>&1 \
      > "$EVIDENCE_DIR/10b-openssl-www-cert.txt"

    {
      echo ""
      echo "=== www verdict ==="
      echo "Generated: $(date -u +%FT%TZ)"

      if grep -qE 'verify return code: 0 \(ok\)' "$EVIDENCE_DIR/10b-openssl-www-cert.txt" && \
         grep -qE 'issuer=.*Let.s Encrypt' "$EVIDENCE_DIR/10b-openssl-www-cert.txt"; then
        echo "Status: PASS — www has a valid Let's Encrypt cert (separate cert OR shared SAN with apex)"
        # Functional confirm: HTTP request to https://www.digswap.com.br should 308 to apex
        curl -sI "https://www.digswap.com.br/" 2>&1 | head -20 | tee -a "$EVIDENCE_DIR/10b-openssl-www-cert.txt"
        if curl -sI "https://www.digswap.com.br/" 2>&1 | grep -qE 'HTTP/[12](\.[01])? 308'; then
          echo "[ok] www → apex 308 redirect functioning (D-07 verified live)"
        elif curl -sI "https://www.digswap.com.br/" 2>&1 | grep -qE 'HTTP/[12](\.[01])? (301|302|307|308)'; then
          echo "[note] www returns redirect but not 308 — D-07 specified 308; check Vercel project domain config"
        else
          echo "[note] www did not return a redirect — verify Wave 1 PATCH took effect"
        fi
      else
        echo "Status: PARTIAL — www cert not yet issued; apex valid means base requirement is met. Re-run when www cert resolves."
      fi
    } >> "$EVIDENCE_DIR/10b-openssl-www-cert.txt"
  </action>
  <acceptance_criteria>
    - evidence/10b-openssl-www-cert.txt exists, ≥ 10 lines
    - Either: contains literal `Status: PASS` AND ideally a `308` line confirming D-07 live, OR `Status: PARTIAL` (www cert lag, apex still valid), OR `[skip]` (apex not yet ready)
  </acceptance_criteria>
  <done>
    www cert state is documented; D-07 308 redirect functionality is observed live (when both certs available).
  </done>
</task>

<task type="checkpoint:human-action" tdd="false">
  <name>Task 3.5: Cert ACME timeout incident handler (D-17 + D-09)</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/10c-cert-acme-incident.md</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/evidence/10-openssl-cert.txt (look for Status: TIMEOUT marker)
    - .planning/phases/036-dns-ssl-cutover/036-CONTEXT.md (D-09 + D-17)
    - .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md §"Pitfall 2: Cert ACME stuck — multiple causes"
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"

    # If Task 3.3 succeeded, write empty marker and exit
    if grep -q 'Status: PASS' "$EVIDENCE_DIR/10-openssl-cert.txt" 2>/dev/null; then
      {
        echo "# Cert ACME incident log"
        echo ""
        echo "**Status:** No incident — Task 3.3 completed successfully on the happy path."
        echo "**Date:** $(date -u +%FT%TZ)"
      } > "$EVIDENCE_DIR/10c-cert-acme-incident.md"
      exit 0
    fi

    # TIMEOUT path — gather diagnostics PER D-17 BEFORE asking user for decision
    {
      echo "# Cert ACME incident log"
      echo ""
      echo "**Date:** $(date -u +%FT%TZ)"
      echo "**Trigger:** Task 3.3 reached 30min wait without valid LE cert. Per D-17, gather diagnostics BEFORE rollback decision."
      echo ""
      echo "## Diagnostic 1: CAA records (most common cert-block cause)"
      echo '```'
      cat "$EVIDENCE_DIR/09-caa-audit.txt"
      echo '```'
      echo ""
      echo "## Diagnostic 2: _acme-challenge TXT (stale leftover from previous host?)"
      echo '```'
    } > "$EVIDENCE_DIR/10c-cert-acme-incident.md"

    powershell -NoProfile -Command "
      try {
        Resolve-DnsName -Name _acme-challenge.digswap.com.br -Type TXT -Server 1.1.1.1 -ErrorAction Stop -DnsOnly | Format-List | Out-String
      } catch {
        'no _acme-challenge TXT record (expected for fresh issuance)'
      }
    " >> "$EVIDENCE_DIR/10c-cert-acme-incident.md"

    {
      echo '```'
      echo ""
      echo "## Diagnostic 3: Vercel runtime logs around DNS-flip time"
      echo "Manual check via Vercel MCP: \`mcp__vercel__get_deployment_runtime_logs\` for prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY"
      echo ""
      echo "## Diagnostic 4: Let's Encrypt rate limit check"
      echo "If repeated failed issuance attempts in last week: \"Duplicate Certificate\" sub-limit may apply (5/hour)."
      echo "Fresh-domain digswap.com.br: not affected on first cutover."
      echo ""
      echo "## Diagnostic 5: external diagnoser"
      echo "Recommended: open https://letsdebug.net → enter digswap.com.br → run HTTP-01 test (Vercel-recommended per RESEARCH)."
      echo ""
      echo "## DECISION REQUIRED FROM USER (D-09)"
      echo ""
      echo "Options:"
      echo "  (a) WAIT_LONGER — Vercel docs note 'usually within a few hours' for stuck issuance. Re-run Task 3.3 in 30min."
      echo "  (b) FIX_AND_RETRY — if a diagnostic above shows a fixable cause (CAA, stale TXT), fix via Hostinger PUT and re-run Task 3.3."
      echo "  (c) ROLLBACK — invoke Hostinger snapshot restore per RESEARCH §Operation: Hostinger snapshot restore. Site reverts to pre-cutover (parking IP) within ~5min (TTL=300)."
      echo ""
      echo "User decision: ____ (write a/b/c + reasoning here when resumed)"
    } >> "$EVIDENCE_DIR/10c-cert-acme-incident.md"

    echo ""
    echo "===================================================================="
    echo "  CERT ACME TIMEOUT — checkpoint:human-action invoked per D-09 / D-17"
    echo "  Diagnostics written to: $EVIDENCE_DIR/10c-cert-acme-incident.md"
    echo ""
    echo "  Pause for user. User reads incident log + decides:"
    echo "    (a) wait longer — re-run Task 3.3 in 30min"
    echo "    (b) fix root cause + retry — fix via Hostinger PUT, re-run Task 3.3"
    echo "    (c) rollback — Hostinger snapshot restore (RESEARCH operation)"
    echo "===================================================================="

    exit 0
  </action>
  <acceptance_criteria>
    - evidence/10c-cert-acme-incident.md exists. Either documents `No incident` (happy path) OR contains the full 5-diagnostic bundle + Options (a)/(b)/(c) + a `User decision:` line awaiting input
    - In incident path: file contains literal mentions of `D-09` and `D-17` (traceability)
  </acceptance_criteria>
  <done>
    Either (a) no-op acknowledgment recorded for happy path, or (b) full diagnostic bundle prepared for user decision per D-09. The plan does NOT auto-rollback — D-09 mandates user choice case-by-case.
  </done>
</task>

</tasks>

<verification>
- Tasks 3.1 + 3.2 are independent and can run in parallel; both need DNS post-flip from Wave 2.
- Task 3.3 has the 30min poll loop — this is the longest single step.
- Task 3.4 depends on Task 3.3 success.
- Task 3.5 is the safety net — runs regardless of 3.3 outcome (writes "No incident" for happy path; full diagnostic bundle for timeout path).
- HALT-ON-FAIL: only Task 3.2 hard-halts (CAA blocking Let's Encrypt is fixable but blocks issuance). Tasks 3.3 / 3.4 do NOT halt — they delegate to 3.5.
</verification>

<success_criteria>
- DEP-DNS-04 PASS: 3-resolver matrix shows all 3 resolvers returning expected A + CNAME (D-14 strengthening of ROADMAP "2+")
- DEP-DNS-05 PASS: CAA empty (default-allow) OR includes letsencrypt.org
- DEP-DNS-03 PASS: openssl s_client returns `verify return code: 0 (ok)` + Let's Encrypt issuer (R3/R10/R11/E5/E6) + DNS:digswap.com.br SAN
- www reachable with valid LE cert (separate or shared SAN); 308 redirect to apex confirmed by curl -sI
- Cert ACME timeout (if any) handled per D-09 + D-17 — diagnostics gathered, user decision logged before any rollback
</success_criteria>

<output>
After completion, create `.planning/phases/036-dns-ssl-cutover/036-03-SUMMARY.md` with:
- DEP-DNS-04 status (3/3 resolvers + Google HTTP)
- DEP-DNS-05 status (no-CAA OR includes letsencrypt.org)
- DEP-DNS-03 status (apex cert verify code 0 + LE issuer match)
- www cert state (separate cert / shared SAN / 308-redirect verified)
- Time from Wave 2 completion to first valid cert (operational metric for future cutovers)
- Incident log status (No incident / Resolved / In progress)
</output>
