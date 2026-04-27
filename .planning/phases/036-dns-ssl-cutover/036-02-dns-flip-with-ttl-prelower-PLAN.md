---
phase: 036-dns-ssl-cutover
plan: 02
type: execute
wave: 2
depends_on: ["036-01"]
files_modified:
  - .planning/phases/036-dns-ssl-cutover/evidence/05-pre-lower-ttl.json
  - .planning/phases/036-dns-ssl-cutover/evidence/05b-ttl-wait-log.txt
  - .planning/phases/036-dns-ssl-cutover/evidence/06-flip-a-record.json
  - .planning/phases/036-dns-ssl-cutover/evidence/07-flip-www-cname.json
  - .planning/phases/036-dns-ssl-cutover/evidence/07b-post-flip-zone.json
  - .planning/phases/036-dns-ssl-cutover/evidence/07c-ttl-300-verify.txt
autonomous: true
requirements:
  - DEP-DNS-01
  - DEP-DNS-02
  - DEP-DNS-06
gap_closure: false

must_haves:
  truths:
    - "Existing zone records have been pre-lowered to TTL=300 with values UNCHANGED, then the wait window of max(old_TTL) seconds elapsed before the value flip (RESEARCH Pitfall 1 — collapses rollback window from 4h to 5min)"
    - "Hostinger A record `@` points at 76.76.21.21 with ttl=300 (DEP-DNS-01 + DEP-DNS-06)"
    - "Hostinger CNAME `www` points at the value extracted by Wave 1 (evidence/04b — either cname.vercel-dns.com. or project-specific *.vercel-dns-NNN.com.) with ttl=300 (DEP-DNS-02 + DEP-DNS-06)"
    - "Post-flip GET zone confirms every changed record has ttl=300 (DEP-DNS-06)"
    - "If Wave 1 marked TXT-REQUIRED, the TXT _vercel record was added BEFORE the A/CNAME flip; if TXT-NOT-REQUIRED, the flip proceeded directly"
    - "DNS is now flipped — point of no return crossed; Wave 3 verifies cert issuance + propagation"
  artifacts:
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/05-pre-lower-ttl.json"
      provides: "PUT response for the TTL pre-lower step (existing values, ttl=300)"
      min_lines: 1
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/05b-ttl-wait-log.txt"
      provides: "Timestamped log of the wait window between TTL pre-lower and the value flip"
      min_lines: 4
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/06-flip-a-record.json"
      provides: "PUT response for A `@ → 76.76.21.21` ttl=300 (DEP-DNS-01)"
      min_lines: 1
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/07-flip-www-cname.json"
      provides: "PUT response for CNAME `www → <vercel-target>` ttl=300 (DEP-DNS-02)"
      min_lines: 1
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/07b-post-flip-zone.json"
      provides: "GET zone post-flip — full new state"
      min_lines: 5
    - path: ".planning/phases/036-dns-ssl-cutover/evidence/07c-ttl-300-verify.txt"
      provides: "Grep proof every changed record has ttl=300 (DEP-DNS-06)"
      min_lines: 4
  key_links:
    - from: ".planning/phases/036-dns-ssl-cutover/evidence/04b-cname-target-extracted.txt"
      to: "Hostinger PUT body zone[].records[].content for CNAME www"
      via: "shell variable expansion"
      pattern: "CNAME_TARGET=\\$\\(cat .*04b-cname-target-extracted\\.txt\\)"
    - from: "evidence/01c-max-old-ttl.txt"
      to: "Wave 2 Task 2.2 sleep duration"
      via: "MAX_OLD_TTL_SECONDS env"
      pattern: "MAX_OLD_TTL_SECONDS="
---

<objective>
Cross the point of no return: flip Hostinger DNS for `digswap.com.br` (apex A → 76.76.21.21) and `www` (CNAME → Vercel target from Wave 1) with TTL=300. Apply RESEARCH Pitfall 1 mitigation — pre-lower TTLs to 300 with UNCHANGED values first, wait for the old TTL to expire, THEN flip values. This collapses the rollback window from up-to-old-TTL (commonly 14400s = 4h on Hostinger defaults) to ~5 minutes.

Purpose: Once this wave completes, `digswap.com.br` resolves to Vercel from caching resolvers worldwide. Vercel's HTTP-01 ACME challenge starts succeeding, Let's Encrypt issues the cert (5-30min after first resolver hits). The brief cert-error window is mitigated by D-11 invite-only (only solo dev + sócio see it).

Output: 6 evidence files + DNS state mutated. Wave 3 verifies propagation + cert issuance.

HALT-ON-FAIL conditions:
- If Wave 1 evidence/02-vercel-domain-add.log marks TXT-REQUIRED and TXT was not yet added: ABORT, add TXT first.
- If TTL pre-lower PUT returns non-200: ABORT, no flip should be attempted on a zone with stale long TTLs (rollback would take hours).
- If A record flip PUT returns non-200: ABORT, www CNAME flip would create a half-state.
- If post-flip GET zone shows any changed record with ttl ≠ 300: trigger DEP-DNS-06 failure path; do not proceed to Wave 3.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
<files_to_read>
- .planning/phases/036-dns-ssl-cutover/036-CONTEXT.md (D-06, D-10, D-15)
- .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md (§"Pattern 3: Hostinger zone PUT — exact request body", §"Pitfall 1: Stale TTL governs rollback window", §"Operation: TTL pre-lowering", §"Open Questions" #4 trailing-dot)
- .planning/phases/036-dns-ssl-cutover/036-VALIDATION.md (per-task verify map for 36-02-*)
- .planning/phases/036-dns-ssl-cutover/evidence/01-pre-cutover-zone.json (current values to preserve in pre-lower)
- .planning/phases/036-dns-ssl-cutover/evidence/01c-max-old-ttl.txt (drives wait window)
- .planning/phases/036-dns-ssl-cutover/evidence/02-vercel-domain-add.log (TXT-REQUIRED marker)
- .planning/phases/036-dns-ssl-cutover/evidence/04b-cname-target-extracted.txt (authoritative CNAME target)
- .planning/REQUIREMENTS.md lines 58-64 (DEP-DNS-01/02/06 acceptance)
</files_to_read>

<interfaces>
<!-- Hostinger DNS API v1 — exact PUT body shape for Wave 2 -->

PUT zone (write — used 2-3x in this wave):
  PUT https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br
  Header: Authorization: Bearer $HOSTINGER_TOKEN
  Header: Content-Type: application/json
  Body schema (verified via hostinger/api-php-sdk):
    {
      "overwrite": <bool>,           # true = replace matching (name,type) pairs; false = merge/update TTL only
      "zone": [
        {
          "name": "<@|subdomain>",   # "@" for apex, "www" for www subdomain
          "type": "<A|CNAME|TXT|MX>",
          "ttl": 300,                # always 300 for cutover (DEP-DNS-06)
          "records": [
            { "content": "<value>" } # IP for A, FQDN with trailing dot for CNAME
          ]
        }
      ]
    }

  Response: JSON; expect 200/201 on success, 4xx with error body on failure.

GET zone (read — used 1x post-flip):
  GET https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br
  Header: Authorization: Bearer $HOSTINGER_TOKEN
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 2.0: Add TXT _vercel verification record IF Wave 1 marked TXT-REQUIRED (conditional)</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/05a-txt-vercel-record.json</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/evidence/02-vercel-domain-add.log (look for [TXT-REQUIRED] marker + the literal _vercel value Vercel printed)
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"

    # Branch on Wave 1 marker
    if grep -q '\[TXT-NOT-REQUIRED\]' "$EVIDENCE_DIR/02-vercel-domain-add.log"; then
      echo "[skip] TXT-NOT-REQUIRED per Wave 1 — proceeding directly to Task 2.1" > "$EVIDENCE_DIR/05a-txt-vercel-record.json"
      exit 0
    fi

    if ! grep -q '\[TXT-REQUIRED\]' "$EVIDENCE_DIR/02-vercel-domain-add.log"; then
      echo "HALT: Wave 1 log missing both TXT-REQUIRED and TXT-NOT-REQUIRED markers — replan Wave 1"
      exit 1
    fi

    # TXT-REQUIRED branch. Extract the verification value Vercel asked for.
    # Vercel typically prints lines like: "Add the following TXT record: _vercel TXT vc-domain-verify=..."
    TXT_NAME=$(grep -oE '_vercel(\.\S+)?' "$EVIDENCE_DIR/02-vercel-domain-add.log" | head -1)
    TXT_VALUE=$(grep -oE 'vc-domain-verify=\S+' "$EVIDENCE_DIR/02-vercel-domain-add.log" | head -1)

    if [ -z "$TXT_NAME" ] || [ -z "$TXT_VALUE" ]; then
      echo "HALT: TXT-REQUIRED but Wave 1 log does not contain extractable TXT name/value — manual intervention needed"
      exit 1
    fi

    HOSTINGER_TOKEN=$(cat ~/.hostinger-token)

    cat > "$EVIDENCE_DIR/05a-txt-vercel-payload.json" <<JSON
{
  "overwrite": false,
  "zone": [
    {
      "name": "_vercel",
      "type": "TXT",
      "ttl": 300,
      "records": [ { "content": "${TXT_VALUE}" } ]
    }
  ]
}
JSON

    curl -sS -X PUT \
      -H "Authorization: Bearer $HOSTINGER_TOKEN" \
      -H "Content-Type: application/json" \
      -d @"$EVIDENCE_DIR/05a-txt-vercel-payload.json" \
      -w "\nHTTP_CODE:%{http_code}\n" \
      -o "$EVIDENCE_DIR/05a-txt-vercel-record.json" \
      "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br" \
      | tee "$EVIDENCE_DIR/05a-txt-vercel-record.http-code.txt"

    grep -qE 'HTTP_CODE:(200|201)' "$EVIDENCE_DIR/05a-txt-vercel-record.http-code.txt" \
      || { echo "HALT: TXT _vercel PUT failed"; exit 1; }

    # Wait 60s for TXT to propagate to Vercel's verifier before continuing to A/CNAME flip
    echo "[wait] sleeping 60s for TXT _vercel propagation before A/CNAME flip" | tee -a "$EVIDENCE_DIR/05a-txt-vercel-record.http-code.txt"
    sleep 60
  </action>
  <acceptance_criteria>
    - If Wave 1 was TXT-NOT-REQUIRED: evidence/05a-txt-vercel-record.json contains literal `[skip]`
    - If Wave 1 was TXT-REQUIRED: HTTP code 200 or 201 + at least one `[wait]` line in the http-code log
  </acceptance_criteria>
  <done>
    Domain ownership is verified at Vercel (or branch was skipped because no TXT was required).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2.1: Pre-lower TTL on existing zone records to 300 (RESEARCH Pitfall 1 mitigation)</name>
  <files>
    .planning/phases/036-dns-ssl-cutover/evidence/05-pre-lower-ttl.json
    .planning/phases/036-dns-ssl-cutover/evidence/05b-ttl-wait-log.txt
  </files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/evidence/01-pre-cutover-zone.json (existing values to preserve)
    - .planning/phases/036-dns-ssl-cutover/evidence/01c-max-old-ttl.txt (wait window)
    - .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md §"Pitfall 1" + §"Operation: TTL pre-lowering"
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"
    HOSTINGER_TOKEN=$(cat ~/.hostinger-token)

    # Read MAX_OLD_TTL_SECONDS from Wave 0 evidence
    MAX_OLD_TTL=$(grep -oE 'MAX_OLD_TTL_SECONDS=\s*[0-9]+' "$EVIDENCE_DIR/01c-max-old-ttl.txt" | grep -oE '[0-9]+')
    if [ -z "$MAX_OLD_TTL" ] || [ "$MAX_OLD_TTL" = "0" ]; then
      echo "[edge-case] MAX_OLD_TTL_SECONDS unparseable or 0 — assume worst case 14400s (Hostinger default)"
      MAX_OLD_TTL=14400
    fi

    # Skip pre-lower if all existing TTLs are already <= 300
    if [ "$MAX_OLD_TTL" -le 300 ]; then
      echo "[skip] all existing TTLs already <= 300 — pre-lower is a no-op"
      echo "{\"skipped\":true,\"reason\":\"max_old_ttl=$MAX_OLD_TTL <= 300\"}" > "$EVIDENCE_DIR/05-pre-lower-ttl.json"
      {
        echo "TTL pre-lower skipped"
        echo "Date: $(date -u +%FT%TZ)"
        echo "MAX_OLD_TTL_SECONDS=$MAX_OLD_TTL"
        echo "Wait window: 0s (skip)"
      } > "$EVIDENCE_DIR/05b-ttl-wait-log.txt"
      exit 0
    fi

    # Build pre-lower payload: every record from snapshot, same values, ttl=300, overwrite=true so we
    # DON'T accumulate duplicates (Hostinger merge semantics with overwrite=false would append, not update).
    python > "$EVIDENCE_DIR/05-pre-lower-payload.json" <<'PY'
import json
with open(".planning/phases/036-dns-ssl-cutover/evidence/01-pre-cutover-zone.json") as f:
    z = json.load(f)
recs = z if isinstance(z, list) else z.get("zone", [])
# Group by (name,type) — Hostinger PUT semantics expect one zone[] entry per (name,type)
groups = {}
for r in recs:
    key = (r.get("name", "@"), str(r.get("type", "")).upper())
    if not r.get("type"):
        continue
    groups.setdefault(key, []).extend(r.get("records") or [])
out = {"overwrite": True, "zone": []}
for (name, typ), records in groups.items():
    # Skip NS records — managed by registrar, not the zone PUT path
    if typ == "NS":
        continue
    out["zone"].append({
        "name": name,
        "type": typ,
        "ttl": 300,
        "records": [{"content": r["content"]} for r in records if "content" in r]
    })
print(json.dumps(out, indent=2))
PY

    curl -sS -X PUT \
      -H "Authorization: Bearer $HOSTINGER_TOKEN" \
      -H "Content-Type: application/json" \
      -d @"$EVIDENCE_DIR/05-pre-lower-payload.json" \
      -w "\nHTTP_CODE:%{http_code}\n" \
      -o "$EVIDENCE_DIR/05-pre-lower-ttl.json" \
      "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br" \
      | tee "$EVIDENCE_DIR/05-pre-lower-ttl.http-code.txt"

    grep -qE 'HTTP_CODE:(200|201)' "$EVIDENCE_DIR/05-pre-lower-ttl.http-code.txt" \
      || { echo "HALT: TTL pre-lower PUT failed"; cat "$EVIDENCE_DIR/05-pre-lower-ttl.json"; exit 1; }

    # Wait the old TTL — that's how long resolvers worldwide cache the old record before re-querying
    # and seeing TTL=300 on the next refresh. Cap at 14400 (4h) for sanity.
    WAIT_SECONDS=$MAX_OLD_TTL
    if [ "$WAIT_SECONDS" -gt 14400 ]; then WAIT_SECONDS=14400; fi
    {
      echo "TTL pre-lower applied"
      echo "Started: $(date -u +%FT%TZ)"
      echo "MAX_OLD_TTL_SECONDS=$MAX_OLD_TTL"
      echo "Wait window: ${WAIT_SECONDS}s"
      echo "Resume after: $(date -u -d "+${WAIT_SECONDS} seconds" +%FT%TZ 2>/dev/null || echo 'unknown — date -d not supported')"
    } > "$EVIDENCE_DIR/05b-ttl-wait-log.txt"

    sleep "$WAIT_SECONDS"

    echo "Completed: $(date -u +%FT%TZ)" >> "$EVIDENCE_DIR/05b-ttl-wait-log.txt"
  </action>
  <acceptance_criteria>
    - evidence/05-pre-lower-ttl.json exists. Either contains `"skipped":true` (already-low TTL case) OR is the API PUT response body.
    - evidence/05-pre-lower-ttl.http-code.txt (if present) contains `HTTP_CODE:200` or `HTTP_CODE:201`.
    - evidence/05b-ttl-wait-log.txt ≥ 4 lines, contains `Started:` and `Completed:` timestamps OR explicit `Wait window: 0s (skip)`.
  </acceptance_criteria>
  <done>
    Old long-TTL caches are now refreshing on the new ttl=300 cadence; the rollback window has collapsed to ~5min for the rest of the cutover.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2.2: Flip A record `@ → 76.76.21.21` (DEP-DNS-01)</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/06-flip-a-record.json</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md §"Pattern 3: Hostinger zone PUT"
    - .planning/phases/036-dns-ssl-cutover/evidence/05b-ttl-wait-log.txt (wait window completed)
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"
    HOSTINGER_TOKEN=$(cat ~/.hostinger-token)

    # Build the apex A record PUT body. overwrite=true so it REPLACES any existing @ A
    # (e.g. Hostinger parking IP) rather than appending a second A record.
    cat > "$EVIDENCE_DIR/06-flip-a-payload.json" <<'JSON'
{
  "overwrite": true,
  "zone": [
    {
      "name": "@",
      "type": "A",
      "ttl": 300,
      "records": [
        { "content": "76.76.21.21" }
      ]
    }
  ]
}
JSON

    curl -sS -X PUT \
      -H "Authorization: Bearer $HOSTINGER_TOKEN" \
      -H "Content-Type: application/json" \
      -d @"$EVIDENCE_DIR/06-flip-a-payload.json" \
      -w "\nHTTP_CODE:%{http_code}\n" \
      -o "$EVIDENCE_DIR/06-flip-a-record.json" \
      "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br" \
      | tee "$EVIDENCE_DIR/06-flip-a-record.http-code.txt"

    grep -qE 'HTTP_CODE:(200|201)' "$EVIDENCE_DIR/06-flip-a-record.http-code.txt" \
      || { echo "HALT: A record flip failed — DO NOT attempt CNAME flip"; cat "$EVIDENCE_DIR/06-flip-a-record.json"; exit 1; }

    echo "[flipped] A @ → 76.76.21.21 ttl=300 at $(date -u +%FT%TZ)"
  </action>
  <acceptance_criteria>
    - evidence/06-flip-a-record.json exists, non-empty, valid JSON
    - evidence/06-flip-a-record.http-code.txt contains `HTTP_CODE:200` or `HTTP_CODE:201`
    - evidence/06-flip-a-payload.json contains `"content": "76.76.21.21"` AND `"ttl": 300`
  </acceptance_criteria>
  <done>
    Apex A record now resolves to Vercel from the Hostinger authoritative server. DEP-DNS-01 satisfied at the registrar layer; resolver propagation verified in Wave 3.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2.3: Flip CNAME `www → <vercel-target>` (DEP-DNS-02)</name>
  <files>.planning/phases/036-dns-ssl-cutover/evidence/07-flip-www-cname.json</files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/evidence/04b-cname-target-extracted.txt (Wave 1 authoritative target)
    - .planning/phases/036-dns-ssl-cutover/036-RESEARCH.md §"Open Questions" #4 (trailing dot handling)
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"
    HOSTINGER_TOKEN=$(cat ~/.hostinger-token)

    CNAME_TARGET=$(cat "$EVIDENCE_DIR/04b-cname-target-extracted.txt")
    test -n "$CNAME_TARGET" || { echo "HALT: empty CNAME target"; exit 1; }

    # Build PUT body
    cat > "$EVIDENCE_DIR/07-flip-www-payload.json" <<JSON
{
  "overwrite": true,
  "zone": [
    {
      "name": "www",
      "type": "CNAME",
      "ttl": 300,
      "records": [
        { "content": "${CNAME_TARGET}" }
      ]
    }
  ]
}
JSON

    curl -sS -X PUT \
      -H "Authorization: Bearer $HOSTINGER_TOKEN" \
      -H "Content-Type: application/json" \
      -d @"$EVIDENCE_DIR/07-flip-www-payload.json" \
      -w "\nHTTP_CODE:%{http_code}\n" \
      -o "$EVIDENCE_DIR/07-flip-www-cname.json" \
      "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br" \
      | tee "$EVIDENCE_DIR/07-flip-www-cname.http-code.txt"

    HTTP_CODE=$(grep -oE 'HTTP_CODE:[0-9]+' "$EVIDENCE_DIR/07-flip-www-cname.http-code.txt" | cut -d: -f2)

    # If 4xx and the response complains about trailing dot, retry without it (RESEARCH Open Q #4)
    if [ "$HTTP_CODE" -ge 400 ] && grep -qiE "trailing|dot|format" "$EVIDENCE_DIR/07-flip-www-cname.json"; then
      CNAME_NO_DOT="${CNAME_TARGET%.}"
      sed -i.bak "s|${CNAME_TARGET}|${CNAME_NO_DOT}|" "$EVIDENCE_DIR/07-flip-www-payload.json"

      curl -sS -X PUT \
        -H "Authorization: Bearer $HOSTINGER_TOKEN" \
        -H "Content-Type: application/json" \
        -d @"$EVIDENCE_DIR/07-flip-www-payload.json" \
        -w "\nHTTP_CODE:%{http_code}\n" \
        -o "$EVIDENCE_DIR/07-flip-www-cname.json" \
        "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br" \
        | tee "$EVIDENCE_DIR/07-flip-www-cname.http-code.txt"

      HTTP_CODE=$(grep -oE 'HTTP_CODE:[0-9]+' "$EVIDENCE_DIR/07-flip-www-cname.http-code.txt" | cut -d: -f2)
    fi

    case "$HTTP_CODE" in
      200|201) echo "[flipped] CNAME www → $CNAME_TARGET ttl=300 at $(date -u +%FT%TZ)";;
      *) echo "HALT: CNAME www flip returned $HTTP_CODE — ZONE IS NOW HALF-FLIPPED (apex A live, www CNAME stale). Either retry this task or invoke rollback per RESEARCH §Operation: Hostinger snapshot restore."; exit 1;;
    esac
  </action>
  <acceptance_criteria>
    - evidence/07-flip-www-cname.json exists, non-empty, valid JSON
    - evidence/07-flip-www-cname.http-code.txt contains `HTTP_CODE:200` or `HTTP_CODE:201`
    - evidence/07-flip-www-payload.json contains `"type": "CNAME"` AND `"ttl": 300` AND a content matching regex `[a-z0-9.-]+\.vercel-dns(-[0-9]+)?\.com\.?`
  </acceptance_criteria>
  <done>
    www subdomain now CNAMEs to Vercel from the Hostinger authoritative server. Combined with the 308 redirect from Wave 1, www requests will redirect to apex once DNS resolves.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2.4: Capture post-flip zone + verify all changed records have ttl=300 (DEP-DNS-06)</name>
  <files>
    .planning/phases/036-dns-ssl-cutover/evidence/07b-post-flip-zone.json
    .planning/phases/036-dns-ssl-cutover/evidence/07c-ttl-300-verify.txt
  </files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/evidence/06-flip-a-record.json
    - .planning/phases/036-dns-ssl-cutover/evidence/07-flip-www-cname.json
  </read_first>
  <action>
    EVIDENCE_DIR=".planning/phases/036-dns-ssl-cutover/evidence"
    HOSTINGER_TOKEN=$(cat ~/.hostinger-token)

    # Capture post-flip zone state from authoritative source
    curl -sS \
      -H "Authorization: Bearer $HOSTINGER_TOKEN" \
      -H "Accept: application/json" \
      -w "HTTP_CODE:%{http_code}\n" \
      -o "$EVIDENCE_DIR/07b-post-flip-zone.json" \
      "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br" \
      | tee "$EVIDENCE_DIR/07b-post-flip-zone.http-code.txt"

    grep -q 'HTTP_CODE:200' "$EVIDENCE_DIR/07b-post-flip-zone.http-code.txt" \
      || { echo "HALT: post-flip GET zone non-200"; exit 1; }

    # Verify ttl=300 on the records we just changed (apex A and www CNAME)
    python > "$EVIDENCE_DIR/07c-ttl-300-verify.txt" <<'PY'
import json, sys
with open(".planning/phases/036-dns-ssl-cutover/evidence/07b-post-flip-zone.json") as f:
    z = json.load(f)
recs = z if isinstance(z, list) else z.get("zone", [])
hits = []
fails = []
print("DEP-DNS-06 verification — ttl=300 on changed records")
print(f"Source: evidence/07b-post-flip-zone.json")
print("")
for r in recs:
    name = r.get("name", "?")
    typ = str(r.get("type", "")).upper()
    ttl = r.get("ttl")
    contents = [x.get("content","") for x in (r.get("records") or [])]
    if (name == "@" and typ == "A") or (name == "www" and typ == "CNAME"):
        line = f"  {typ} {name} ttl={ttl} content={contents}"
        if ttl == 300:
            print("[ok]   " + line)
            hits.append(line)
        else:
            print("[FAIL] " + line)
            fails.append(line)
print("")
print(f"PASS records: {len(hits)}")
print(f"FAIL records: {len(fails)}")
print("DEP-DNS-06 status:", "PASS" if not fails and len(hits) >= 2 else "FAIL")
sys.exit(0 if not fails and len(hits) >= 2 else 1)
PY

    EXIT=$?
    if [ "$EXIT" -ne 0 ]; then
      echo "HALT: at least one changed record has ttl != 300 — DEP-DNS-06 fails. Either retry the relevant flip with ttl:300 explicit or escalate."
      cat "$EVIDENCE_DIR/07c-ttl-300-verify.txt"
      exit 1
    fi
  </action>
  <acceptance_criteria>
    - evidence/07b-post-flip-zone.json exists, non-empty, valid JSON, captured at HTTP 200
    - evidence/07c-ttl-300-verify.txt ≥ 4 lines, contains `DEP-DNS-06 status: PASS` AND `[ok]` lines for both `A @` and `CNAME www`
  </acceptance_criteria>
  <done>
    DEP-DNS-06 (TTL=300 on cutover records) is empirically confirmed at the registrar's authoritative source.
  </done>
</task>

</tasks>

<verification>
- Tasks must run sequentially: 2.0 → 2.1 → 2.2 → 2.3 → 2.4. Any HALT-ON-FAIL aborts the wave; do NOT skip ahead.
- Task 2.1 has the long sleep (up to 4h) — this is intentional. The wait window cannot be shortened without nullifying the Pitfall 1 mitigation.
- After Task 2.3 succeeds, the world's resolvers begin learning the new values. Wave 3 verifies global propagation + cert.
- Rollback path (only if Wave 3 fails catastrophically): use evidence/03-snapshot-list.json + POST `/api/dns/v1/snapshots/digswap.com.br/{snapshotId}/restore` per RESEARCH §"Operation: Hostinger snapshot restore". Hostinger auto-creates a snapshot on the first PUT in this wave; that snapshot ID is the rollback handle.
</verification>

<success_criteria>
- DEP-DNS-01 satisfied at registrar: A `@` = 76.76.21.21 with ttl=300 (verified in evidence/06 + 07b)
- DEP-DNS-02 satisfied at registrar: CNAME `www` = <vercel target> with ttl=300 (verified in evidence/07 + 07b)
- DEP-DNS-06 satisfied: evidence/07c shows `DEP-DNS-06 status: PASS`
- Pitfall 1 mitigated: TTL pre-lower applied + waited; rollback window collapsed to 5min
- Pitfall 4 avoided: CNAME target was extracted from `vercel domains inspect` (Wave 1), not hardcoded
- TXT _vercel verification handled: either added pre-flip (TXT-REQUIRED branch) or skipped (TXT-NOT-REQUIRED branch)
</success_criteria>

<output>
After completion, create `.planning/phases/036-dns-ssl-cutover/036-02-SUMMARY.md` with:
- TXT-REQUIRED branch outcome (added or skipped)
- TTL pre-lower outcome + actual wait window
- A flip status (apex 76.76.21.21 ttl=300)
- CNAME flip status (www → exact target ttl=300)
- DEP-DNS-06 verification result
- The post-flip zone snapshot summary (record counts by type)
- Cert state: still NOT YET ISSUED (expected; Wave 3 polls until present)
- Rollback handle (snapshot ID from Hostinger auto-snapshot of the first PUT)
</output>
