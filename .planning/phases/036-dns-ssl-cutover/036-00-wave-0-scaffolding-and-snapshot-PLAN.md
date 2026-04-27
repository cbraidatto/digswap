---
phase: 036-dns-ssl-cutover
plan: 00
type: execute
wave: 0
depends_on: []
files_modified:
  - .planning/phases/036-dns-ssl-cutover/evidence/00-token-handling.md
  - .planning/phases/036-dns-ssl-cutover/evidence/01-pre-cutover-zone.json
  - .planning/phases/036-dns-ssl-cutover/evidence/01b-mx-na-confirm.txt
  - .planning/phases/036-dns-ssl-cutover/evidence/03-snapshot-list.json
autonomous: false
requirements:
  - DEP-DNS-07
gap_closure: false

must_haves:
  truths:
    - "Hostinger API token is on disk at ~/.hostinger-token (ASCII, no BOM, no trailing newline) and authorizes a successful GET zone call"
    - "Pre-cutover zone state is captured in evidence/01-pre-cutover-zone.json with HTTP 200 and well-formed JSON"
    - "DEP-DNS-07 (preserve MX) is confirmed N/A by construction — pre-cutover zone has zero MX entries (per D-04)"
    - "Hostinger automatic DNS snapshot list is captured in evidence/03-snapshot-list.json (rollback handle for Wave 2 failure path)"
    - "Existing TTL ceiling (max(zone[].ttl) from snapshot) is recorded — drives the Wave 2 TTL pre-lower wait window"
  artifacts:
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/00-token-handling.md"
      provides: "Sanitized record of how token was passed (printf one-shot pattern, not the token value)"
      min_lines: 8
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/01-pre-cutover-zone.json"
      provides: "GET /api/dns/v1/zones/digswap.com.br response — full zone state pre-flip (rollback baseline)"
      min_lines: 5
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/01b-mx-na-confirm.txt"
      provides: "DEP-DNS-07 N/A confirmation — grep result + reasoning per D-04"
      min_lines: 4
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/03-snapshot-list.json"
      provides: "GET /api/dns/v1/snapshots/digswap.com.br response — rollback IDs"
      min_lines: 1
  key_links:
    - from: "~/.hostinger-token"
      to: "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br"
      via: "Authorization: Bearer header"
      pattern: "curl -H \"Authorization: Bearer \\$HOSTINGER_TOKEN\""
---

<objective>
Bootstrap Phase 36 cutover: place Hostinger API token on disk via printf one-shot (D-19), capture pre-cutover zone state as the rollback baseline, confirm DEP-DNS-07 N/A by construction (D-04 — no MX exists), and list Hostinger automatic snapshots so a one-call rollback path is on hand before any state mutation.

Purpose: Establish the rollback safety net BEFORE Wave 1 touches Vercel domain config. If this wave fails, we abort the entire phase — Phase 36 is the point of no return per ROADMAP §"Phase 36" and CONTEXT D-15. We cannot proceed without a captured zone snapshot.

Output: 4 evidence files + 1 confirmed token on disk. No external state has changed yet.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
<files_to_read>
- .planning/PROJECT.md
- .planning/ROADMAP.md (lines 641-653 — Phase 36 success criteria + P0 pitfalls)
- .planning/STATE.md
- .planning/REQUIREMENTS.md (lines 58-64 — DEP-DNS-01..07 acceptance)
- .planning/phases/036-dns-ssl-cutover/036-CONTEXT.md (D-04, D-15, D-18, D-19)
- .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md (§"Hostinger DNS API via curl + Bearer token", §"Pattern 2: Pre-cutover snapshot")
- .planning/phases/036-dns-ssl-cutover/036-VALIDATION.md
- .planning/phases/035-vercel-environment-wiring/035-SUMMARY.md (Vercel project IDs already in use)
- CLAUDE.md (solo dev guardrails)
</files_to_read>

<interfaces>
<!-- Hostinger DNS API v1 — exact endpoint surface for Wave 0 -->

GET zone (read pre-cutover state):
  GET https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br
  Header: Authorization: Bearer $HOSTINGER_TOKEN
  Header: Accept: application/json
  Response: JSON with zone records (name, type, ttl, records[].content)

GET snapshot list (rollback handles):
  GET https://developers.hostinger.com/api/dns/v1/snapshots/digswap.com.br
  Header: Authorization: Bearer $HOSTINGER_TOKEN
  Response: JSON list of snapshot IDs auto-created on previous changes

Phase 35 LOCKED constants (do NOT mutate):
  Vercel project_id   = prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY
  Vercel team_id      = team_WuQK7GkPndJ2xH9YKvZTMtB3
  Vercel project name = digswap-web
  Vercel prod alias   = https://digswap-web.vercel.app
  Domain canonical    = digswap.com.br (apex) + www.digswap.com.br
</interfaces>
</context>

<tasks>

<task type="checkpoint:human-action" tdd="false">
  <name>Task 0.1: User pastes Hostinger API token to ~/.hostinger-token (printf one-shot)</name>
  <files>~/.hostinger-token (created), .planning/phases/036-dns-ssl-cutover/evidence/00-token-handling.md (created)</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/036-CONTEXT.md (D-19: ASCII, no BOM, no newline)
    - .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md §"Pattern 1: Hostinger DNS API via curl + Bearer token"
  </read_first>
  <action>
    Pause for user. Hostinger API token is generated via web UI (no API for token creation per RESEARCH.md). Instruct user:

    1. Open https://hpanel.hostinger.com → top-right user menu → "API" → "Generate token" (scope: DNS read+write).
    2. Copy the token. DO NOT paste it into chat. Run locally in git-bash:

       printf '%s' 'PASTE_TOKEN_HERE' > ~/.hostinger-token

    3. Verify shape (must be one line, no BOM, no trailing newline):

       wc -c ~/.hostinger-token   # expect token byte count, NOT byte count + 1
       file ~/.hostinger-token    # expect "ASCII text, no line terminators"

    4. After user signals "token placed", Claude verifies the token works WITHOUT logging it:

       HOSTINGER_TOKEN=$(cat ~/.hostinger-token) && \
       curl -sS -o /dev/null -w "HTTP_CODE:%{http_code}\n" \
         -H "Authorization: Bearer $HOSTINGER_TOKEN" \
         -H "Accept: application/json" \
         "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br"

       Expect HTTP_CODE:200. If 401/403 → user regenerates token, retry. If 404 → domain not in this Hostinger account, HALT phase.

    5. Write evidence/00-token-handling.md documenting:
       - Date received
       - Pattern used (printf '%s' ... > ~/.hostinger-token; ASCII, no BOM, no newline per D-19)
       - Verification HTTP code (200) — NEVER log token bytes, prefix, or length
       - File path: ~/.hostinger-token (gitignored — same pattern as Phase 35 ~/.vercel-token)

    HALT-ON-FAIL: If after 3 token attempts the GET zone returns non-200, abort the phase. Do not proceed to Task 0.2 — without API access this entire phase falls back to manual UI clicks (D-03 fallback, but planner must replan with checkpoint:human-action everywhere).
  </action>
  <acceptance_criteria>
    - ~/.hostinger-token exists and is non-empty: `test -s ~/.hostinger-token && echo OK`
    - GET /api/dns/v1/zones/digswap.com.br with Bearer token returns HTTP 200
    - evidence/00-token-handling.md exists, ≥ 8 lines, mentions D-19 pattern, contains zero token bytes
    - grep on evidence/00-token-handling.md does NOT match common token shapes (no `[A-Za-z0-9]{30,}` blob)
  </acceptance_criteria>
  <done>
    Token is on disk and authorizes the API; sanitized handling log committed.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 0.2: Capture pre-cutover zone snapshot (rollback baseline)</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/01-pre-cutover-zone.json</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/evidence/00-token-handling.md (token confirmed live)
    - .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md §"Pattern 2: Pre-cutover snapshot"
  </read_first>
  <action>
    Run from git-bash at the repo root. ALWAYS use absolute path for evidence file.

    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"
    mkdir -p "$EVIDENCE_DIR"

    HOSTINGER_TOKEN=$(cat ~/.hostinger-token)

    # Capture full zone with HTTP code recorded out-of-band (not in the body file)
    curl -sS \
      -H "Authorization: Bearer $HOSTINGER_TOKEN" \
      -H "Accept: application/json" \
      -w "HTTP_CODE:%{http_code}\n" \
      -o "$EVIDENCE_DIR/01-pre-cutover-zone.json" \
      "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br" \
      | tee "$EVIDENCE_DIR/01-pre-cutover-zone.http-code.txt"

    # Verify 200 + non-empty + valid JSON
    grep -q 'HTTP_CODE:200' "$EVIDENCE_DIR/01-pre-cutover-zone.http-code.txt" || { echo "HALT: GET zone non-200"; exit 1; }
    test -s "$EVIDENCE_DIR/01-pre-cutover-zone.json" || { echo "HALT: zone snapshot empty"; exit 1; }
    cat "$EVIDENCE_DIR/01-pre-cutover-zone.json" | python -m json.tool > /dev/null || { echo "HALT: zone snapshot not valid JSON"; exit 1; }

    # Compute and log max(ttl) — drives Wave 2 wait window per RESEARCH §"Pitfall 1"
    cat "$EVIDENCE_DIR/01-pre-cutover-zone.json" | \
      python -c "import json,sys; z=json.load(sys.stdin); ttls=[r.get('ttl') for r in (z if isinstance(z,list) else z.get('zone',[])) if r.get('ttl') is not None]; print('MAX_OLD_TTL_SECONDS=', max(ttls) if ttls else 'N/A')" \
      | tee "$EVIDENCE_DIR/01c-max-old-ttl.txt"

    HALT-ON-FAIL: If GET returns non-200, JSON is malformed, or file is empty — abort phase. Without a baseline snapshot, rollback in Wave 2 is impossible per D-15.
  </action>
  <acceptance_criteria>
    - File evidence/01-pre-cutover-zone.json exists, is non-empty, parses as valid JSON
    - File evidence/01-pre-cutover-zone.http-code.txt contains literal `HTTP_CODE:200`
    - File evidence/01c-max-old-ttl.txt contains either `MAX_OLD_TTL_SECONDS=` followed by an integer, or `N/A` (zone empty case)
  </acceptance_criteria>
  <done>
    Pre-cutover zone state and the existing TTL ceiling are captured. Wave 2 has the data it needs to plan its TTL pre-lower wait.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 0.3: Confirm DEP-DNS-07 N/A by construction (no MX records present)</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/01b-mx-na-confirm.txt</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/evidence/01-pre-cutover-zone.json
    - .planning/phases/036-dns-ssl-cutover/036-CONTEXT.md (D-04: email not in use, MX preservation N/A)
    - .planning/REQUIREMENTS.md line 64 (DEP-DNS-07)
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"

    # Count MX entries in the snapshot. JSON shape may be {zone: [...]} or [...] — handle both.
    MX_COUNT=$(cat "$EVIDENCE_DIR/01-pre-cutover-zone.json" | \
      python -c "import json,sys; z=json.load(sys.stdin); recs=z if isinstance(z,list) else z.get('zone',[]); print(sum(1 for r in recs if str(r.get('type','')).upper()=='MX'))")

    {
      echo "DEP-DNS-07 — MX records preserved"
      echo "Date: $(date -u +%FT%TZ)"
      echo "Source: evidence/01-pre-cutover-zone.json"
      echo "MX entries found: $MX_COUNT"
      echo ""
      if [ "$MX_COUNT" = "0" ]; then
        echo "Status: N/A by construction"
        echo "Reasoning (per CONTEXT.md D-04): Email is not configured on digswap.com.br at cutover time."
        echo "  Phase 37 owns Resend MX/SPF/DKIM/DMARC. With zero MX entries to preserve, DEP-DNS-07 is satisfied vacuously."
        echo "  The Wave 2 PUT must NOT introduce MX records."
      else
        echo "Status: REQUIRES PRESERVATION"
        echo "MX entries (raw):"
        cat "$EVIDENCE_DIR/01-pre-cutover-zone.json" | \
          python -c "import json,sys; z=json.load(sys.stdin); recs=z if isinstance(z,list) else z.get('zone',[]); [print(' ',r) for r in recs if str(r.get('type','')).upper()=='MX']"
        echo ""
        echo "Wave 2 PUT body must include these MX entries unchanged. HALT this plan and rerun planning with D-04 revised."
      fi
    } > "$EVIDENCE_DIR/01b-mx-na-confirm.txt"

    cat "$EVIDENCE_DIR/01b-mx-na-confirm.txt"

    HALT-ON-FAIL: If MX_COUNT > 0, this contradicts D-04. Pause; user must update CONTEXT.md decision before proceeding.
  </action>
  <acceptance_criteria>
    - File evidence/01b-mx-na-confirm.txt exists, ≥ 4 lines
    - Contains literal `MX entries found: 0` (D-04 honored) — OR — contains `Status: REQUIRES PRESERVATION` (HALT case)
    - References DEP-DNS-07 and D-04 explicitly
  </acceptance_criteria>
  <done>
    DEP-DNS-07 status is locked: either N/A-confirmed (expected per D-04) or HALT raised for replanning.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 0.4: Capture Hostinger snapshot list (rollback handles)</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/03-snapshot-list.json</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md §"Operation: Hostinger snapshot restore (rollback)" + §"Open Questions" #1
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"
    HOSTINGER_TOKEN=$(cat ~/.hostinger-token)

    curl -sS \
      -H "Authorization: Bearer $HOSTINGER_TOKEN" \
      -H "Accept: application/json" \
      -w "HTTP_CODE:%{http_code}\n" \
      -o "$EVIDENCE_DIR/03-snapshot-list.json" \
      "https://developers.hostinger.com/api/dns/v1/snapshots/digswap.com.br" \
      | tee "$EVIDENCE_DIR/03-snapshot-list.http-code.txt"

    # Soft check: 200 expected, but 404 (no snapshots yet on a fresh zone) is also acceptable —
    # Hostinger auto-creates a snapshot on the FIRST mutating PUT, so Wave 2's flip will create one.
    HTTP_CODE=$(grep -oE 'HTTP_CODE:[0-9]+' "$EVIDENCE_DIR/03-snapshot-list.http-code.txt" | cut -d: -f2)
    case "$HTTP_CODE" in
      200) echo "Snapshot list captured (existing snapshots present)";;
      404) echo "No snapshots yet — Hostinger will auto-create on Wave 2 PUT";;
      *)   echo "HALT: unexpected HTTP code $HTTP_CODE on snapshot list"; exit 1;;
    esac

    # Document for Wave 2 fallback consumption — record the response shape
    {
      echo "# Snapshot list — captured at $(date -u +%FT%TZ)"
      echo "HTTP code: $HTTP_CODE"
      echo "Body bytes: $(wc -c < "$EVIDENCE_DIR/03-snapshot-list.json")"
      echo ""
      echo "Wave 2 rollback uses: POST /api/dns/v1/snapshots/digswap.com.br/{snapshotId}/restore"
      echo "snapshotId is parsed from THIS file at the moment of rollback (response shape per RESEARCH §Open Questions #1)"
    } > "$EVIDENCE_DIR/03b-snapshot-rollback-readme.txt"

    HALT-ON-FAIL: HTTP code other than 200 or 404 indicates an API issue — do not proceed to Wave 1.
  </action>
  <acceptance_criteria>
    - File evidence/03-snapshot-list.json exists (may be empty/`[]` if no prior snapshots)
    - File evidence/03-snapshot-list.http-code.txt contains `HTTP_CODE:200` OR `HTTP_CODE:404`
    - File evidence/03b-snapshot-rollback-readme.txt documents the rollback endpoint contract
  </acceptance_criteria>
  <done>
    Wave 2 has a documented rollback path: it can either restore a captured pre-flip snapshot OR rely on Hostinger's auto-snapshot from the first PUT.
  </done>
</task>

</tasks>

<verification>
- Run all 4 tasks in order. Tasks 0.2/0.3/0.4 may run sequentially after 0.1 completes.
- Phase gate: every acceptance_criteria above MUST be satisfied. If any HALT-ON-FAIL fires, abort the entire phase and re-discuss with user.
- No external state mutation has happened in Wave 0 — pure reads + token placement. Safe to retry tasks 0.2-0.4 idempotently.
</verification>

<success_criteria>
- ~/.hostinger-token is on disk and the GET zone call returns 200
- evidence/01-pre-cutover-zone.json is well-formed JSON capturing the full pre-cutover state
- evidence/01b-mx-na-confirm.txt confirms zero MX records (DEP-DNS-07 N/A by construction)
- evidence/03-snapshot-list.json captured (200 with snapshots OR 404 with documented Wave 2 fallback)
- evidence/01c-max-old-ttl.txt records MAX_OLD_TTL_SECONDS — Wave 2 reads this for its pre-lower wait
- DEP-DNS-07 is officially marked N/A; no rollback step is required for it in any later wave
</success_criteria>

<output>
After completion, create `.planning/phases/036-dns-ssl-cutover/036-00-SUMMARY.md` with:
- Token placement confirmation (no token bytes in the file)
- Pre-cutover zone snapshot stats (record count, types, MAX_OLD_TTL_SECONDS)
- DEP-DNS-07 N/A confirmation per D-04
- Snapshot list state (existing IDs OR fresh-zone-no-snapshots-yet)
- Wave 1 prerequisites all green / RED with HALT reason
</output>
