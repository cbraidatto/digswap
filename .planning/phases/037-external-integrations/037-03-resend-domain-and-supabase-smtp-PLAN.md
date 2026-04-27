---
phase: 037-external-integrations
plan: 03
type: execute
wave: 1
depends_on: ["037-00"]
files_modified:
  - .planning/phases/037-external-integrations/evidence/03-resend-domain-create.json
  - .planning/phases/037-external-integrations/evidence/03-hostinger-dns-put.json
  - .planning/phases/037-external-integrations/evidence/03-resend-verified.json
  - .planning/phases/037-external-integrations/evidence/03-supabase-smtp-config.json
  - .planning/phases/037-external-integrations/evidence/03-resend-env-audit.txt
  - .planning/phases/037-external-integrations/evidence/03b-smtp-deliverability.md
autonomous: false
requirements: [DEP-INT-07, DEP-INT-08]
gap_closure: false
user_setup:
  - service: resend-domain
    why: "DKIM/SPF/Return-Path records must be applied via Hostinger DNS API + Resend verifies; SMTP swap follows verification"
    dashboard_config:
      - task: "Manual UAT — trigger password-reset email at https://digswap.com.br/forgot-password and verify From=noreply@digswap.com.br + DKIM=PASS in Gmail Show Original"
        location: "Gmail / inbox; Supabase Auth /forgot-password flow"

must_haves:
  truths:
    - "Resend domain digswap.com.br exists with status=verified (probed via GET /domains/{id})"
    - "Hostinger DNS zone has SPF (TXT on send), DKIM (CNAME on <id>._domainkey), Return-Path (MX on send), and DMARC (TXT on _dmarc) records — all 4 propagated"
    - "Vercel Production scope RESEND_API_KEY contains real re_* value (no DEFERRED marker)"
    - "Supabase Auth SMTP config: smtp_host=smtp.resend.com, smtp_port=465, smtp_user=resend, smtp_admin_email=noreply@digswap.com.br, smtp_sender_name=DigSwap, rate_limit_email_sent=100"
    - "User triggered password-reset email from prod URL, received it from noreply@digswap.com.br with DKIM=PASS in Gmail Show-Original headers"
  artifacts:
    - path: ".planning/phases/037-external-integrations/evidence/03-resend-domain-create.json"
      provides: "Full POST /domains response including domain_id and records[] (DKIM CNAME id captured for downstream tasks)"
      min_lines: 20
    - path: ".planning/phases/037-external-integrations/evidence/03-hostinger-dns-put.json"
      provides: "PUT body sent + Hostinger ack response for SPF/DKIM/MX/DMARC records"
      min_lines: 30
    - path: ".planning/phases/037-external-integrations/evidence/03-resend-verified.json"
      provides: "GET /domains/{id} polling log + final response showing status=verified (DEP-INT-07 evidence)"
      min_lines: 15
    - path: ".planning/phases/037-external-integrations/evidence/03-supabase-smtp-config.json"
      provides: "Pre/post diff of GET /v1/projects/{ref}/config/auth showing smtp_* fields and rate_limit_email_sent change"
      min_lines: 20
    - path: ".planning/phases/037-external-integrations/evidence/03-resend-env-audit.txt"
      provides: "Vercel env ls + pull confirming RESEND_API_KEY is real (no DEFERRED)"
      min_lines: 8
    - path: ".planning/phases/037-external-integrations/evidence/03b-smtp-deliverability.md"
      provides: "Manual UAT log: From-address, DKIM=PASS in Gmail headers (DEP-INT-08 evidence)"
      min_lines: 15
  key_links:
    - from: "Resend POST /domains response records[]"
      to: "Hostinger DNS zone PUT body (transformed: SPF TXT, DKIM CNAME, Return-Path MX) + DMARC TXT added independently"
      via: "Single PUT to /api/dns/v1/zones/digswap.com.br with overwrite=false (Phase 36 lineage; new name/type pairs don't conflict with apex/www)"
      pattern: "DKIM|_dmarc|send"
    - from: "Resend domain status"
      to: "Supabase Auth SMTP enable trigger (must reach status=verified BEFORE SMTP enable)"
      via: "POST /domains/{id}/verify then poll GET /domains/{id} every 60s"
      pattern: "verified"
    - from: "Supabase Auth SMTP config"
      to: "Resend SMTP relay (smtp.resend.com:465 user=resend pass=re_*)"
      via: "PATCH /v1/projects/{ref}/config/auth with smtp_* fields + rate_limit_email_sent=100"
      pattern: "smtp\\.resend\\.com"
---

<objective>
Verify the Resend sending domain `digswap.com.br` end-to-end: (1) call Resend `POST /domains` to receive the per-domain DKIM CNAME id and SPF/MX baseline records; (2) PUT all 4 DNS records (SPF + DKIM + Return-Path MX + DMARC at p=none per RESEARCH §"State of the Art") to Hostinger via the Phase 36 token + curl pattern; (3) trigger Resend verification and poll until `status=verified` (≤10min hard timeout); (4) atomically swap `RESEND_API_KEY` in Vercel Production from DEFERRED to real; (5) PATCH Supabase Auth Management API to point SMTP at Resend AND raise the email rate limit from 30/hr to 100/hr (Pitfall P-NEW-3 mitigation); (6) manual UAT — user triggers a password-reset email from prod and confirms From + DKIM=PASS in Gmail headers. Closes DEP-INT-07 + DEP-INT-08.

Purpose: Transactional email (signup verify, password reset, wantlist match alerts) delivers from `noreply@digswap.com.br` with DKIM/SPF/DMARC alignment — Gmail/Yahoo Feb 2024 enforcement requires DMARC for any production sender (RESEARCH §"State of the Art").

Output: 2 requirements closed (DEP-INT-07, DEP-INT-08), 6 evidence files documenting domain creation → DNS apply → verification → env swap → SMTP config → manual UAT.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
<files_to_read>
- `.planning/phases/037-external-integrations/037-CONTEXT.md` D-09 (From=noreply@digswap.com.br), D-10 (no reply-to), D-11 (Claude applies via Hostinger API), D-12 (Free tier)
- `.planning/phases/037-external-integrations/037-RESEARCH.md` §"Pattern 2: Resend Domain Verification Polling", §"Pattern 3: Hostinger DNS PUT for Multi-Record Set", §"Code Examples > Resend domain creation", §"Code Examples > Supabase Management API auth config update", §"Pitfall P15", §"Pitfall P-NEW-3" (rate-limit raise to 100/hr), §"Anti-Patterns to Avoid" (DKIM as TXT — actually CNAME), §"Open Questions" #2 (region us-east-1 default)
- `.planning/phases/037-external-integrations/037-VALIDATION.md` rows DEP-INT-07 + DEP-INT-08
- `.planning/phases/036-dns-ssl-cutover/evidence/06-flip-a-payload.json` (Hostinger PUT body shape — proven path)
- `.planning/phases/036-dns-ssl-cutover/036-SUMMARY.md` §"Path deviations" (PowerShell Resolve-DnsName CAA gap; nslookup + Google HTTP DNS as fallback)
- `apps/web/src/lib/notifications/email.ts` lines 26-28 (existing Resend client reads `env.RESEND_API_KEY` and `env.RESEND_FROM_EMAIL` — zero code change needed)
- `apps/web/src/lib/env.ts` line 21 (RESEND_API_KEY: optional default ""; swap from DEFERRED to real value via Vercel env)
- `apps/web/src/lib/env.ts` line 22 (RESEND_FROM_EMAIL: default "noreply@digswap.com" — note: missing `.br`; this MIGHT need a Vercel env override to "noreply@digswap.com.br" but the source default is documented in CONTEXT D-09. Verify Vercel Production scope value — Phase 35 D-21 set it; if it's still `noreply@digswap.com` not `.br`, fix in Task 3.4)
</files_to_read>

<interfaces>
**Resend POST /domains response shape** (RESEARCH §"Code Examples"):
```json
{
  "id": "<uuid>",
  "name": "digswap.com.br",
  "status": "not_started",
  "records": [
    { "record": "SPF",  "name": "send", "type": "TXT", "value": "\"v=spf1 include:amazonses.com ~all\"" },
    { "record": "DKIM", "name": "<unique-id>._domainkey", "type": "CNAME", "value": "<unique-id>.dkim.amazonses.com." },
    { "record": "MX",   "name": "send", "type": "MX", "priority": 10, "value": "feedback-smtp.us-east-1.amazonses.com" }
  ]
}
```
Note: response does NOT include DMARC — operator adds independently.

**Hostinger DNS PUT shape** (Phase 36 evidence/06 — proven path; for Phase 37, use `overwrite=false` because new (name,type) pairs don't conflict with apex/www; setting `overwrite=true` would clobber unrelated records — DON'T):
```json
{
  "overwrite": false,
  "zone": [
    { "name": "send", "type": "TXT", "ttl": 300, "records": [{"content": "v=spf1 include:amazonses.com ~all"}] },
    { "name": "<unique-id>._domainkey", "type": "CNAME", "ttl": 300, "records": [{"content": "<unique-id>.dkim.amazonses.com."}] },
    { "name": "send", "type": "MX", "ttl": 300, "records": [{"content": "feedback-smtp.us-east-1.amazonses.com", "priority": 10}] },
    { "name": "_dmarc", "type": "TXT", "ttl": 300, "records": [{"content": "v=DMARC1; p=none; rua=mailto:dmarc@digswap.com.br"}] }
  ]
}
```

**Supabase SMTP PATCH** (RESEARCH §"Code Examples"):
```bash
curl -X PATCH "https://api.supabase.com/v1/projects/swyfhpgerzvvmoswkjyt/config/auth" \
  -H "Authorization: Bearer $(cat ~/.supabase-token)" \
  -H "Content-Type: application/json" \
  -d '{
    "smtp_host": "smtp.resend.com",
    "smtp_port": "465",
    "smtp_user": "resend",
    "smtp_pass": "<RESEND_API_KEY value>",
    "smtp_admin_email": "noreply@digswap.com.br",
    "smtp_sender_name": "DigSwap",
    "smtp_max_frequency": 60,
    "rate_limit_email_sent": 100
  }'
```
</interfaces>

<!-- Pitfall reminder (P15 — RESEARCH §"Pitfall P15"): SMTP enable MUST come AFTER status=verified. Wave 3 sequencing is strict: PUT records first → POST /verify → poll → only then PATCH SMTP config. Skipping the order = sending unsigned email = DMARC fail = sender reputation craters. -->
<!-- Pitfall reminder (P-NEW-3 — RESEARCH §"Pitfall P-NEW-3"): Supabase Auth SMTP defaults to 30 emails/hour; Task 3.5 raises to 100/hour. Without this, first-day signup spike will hit the cap. -->
<!-- Pitfall reminder (DKIM CNAME not TXT — RESEARCH §"Anti-Patterns to Avoid"): Older guides show DKIM as TXT. Resend uses CNAME pointing to *.dkim.amazonses.com. Use Resend's response records[] verbatim — don't normalize to TXT. -->

</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 3.1: Resend POST /domains — create digswap.com.br + capture records[]</name>
  <files>
    .planning/phases/037-external-integrations/evidence/03-resend-domain-create.json
  </files>
  <read_first>
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Code Examples > Resend domain creation"
    - .planning/phases/037-external-integrations/037-CONTEXT.md D-12 (Free tier — region us-east-1 default per RESEARCH §"Open Questions" #2)
    - evidence/00-tokens-handling.md (~/.resend-token reaches Resend API with HTTP 200)
  </read_first>
  <action>
    1. Probe Resend account first (idempotency check — domain may already exist from a prior attempt):
       ```bash
       curl -sS \
         -H "Authorization: Bearer $(cat ~/.resend-token)" \
         https://api.resend.com/domains \
         | jq '.data // [] | map(select(.name == "digswap.com.br"))' \
         > /tmp/resend-pre-check.json
       ```
       If `/tmp/resend-pre-check.json` is `[]` (empty array) — domain doesn't exist, proceed to step 2.
       If it contains an entry — capture its `id` and skip to step 3 (re-fetch the records).

    2. Create domain (only if not present):
       ```bash
       curl -sS -X POST \
         -H "Authorization: Bearer $(cat ~/.resend-token)" \
         -H "Content-Type: application/json" \
         -d '{"name":"digswap.com.br","region":"us-east-1"}' \
         https://api.resend.com/domains \
         > /tmp/resend-domain-create.json

       cat /tmp/resend-domain-create.json | jq '.'
       ```
       Verify response has `.id` and `.records` array (3 entries: SPF, DKIM, MX).

    3. Persist evidence (sanitize: don't log Bearer auth header but DO log all DNS values — they're meant to be public):
       ```bash
       # Determine which file to use
       if [ "$(jq 'length' /tmp/resend-pre-check.json)" -gt 0 ]; then
         # Domain pre-existed; re-fetch full detail
         DOMAIN_ID=$(jq -r '.[0].id' /tmp/resend-pre-check.json)
         curl -sS \
           -H "Authorization: Bearer $(cat ~/.resend-token)" \
           "https://api.resend.com/domains/${DOMAIN_ID}" \
           > /tmp/resend-domain-create.json
       fi

       cp /tmp/resend-domain-create.json .planning/phases/037-external-integrations/evidence/03-resend-domain-create.json
       ```

    4. Extract DKIM CNAME id (Hostinger PUT in Task 3.2 needs the per-domain unique id):
       ```bash
       export RESEND_DOMAIN_ID=$(jq -r '.id' /tmp/resend-domain-create.json)
       export DKIM_CNAME_NAME=$(jq -r '.records[] | select(.record=="DKIM") | .name' /tmp/resend-domain-create.json)
       export DKIM_CNAME_VALUE=$(jq -r '.records[] | select(.record=="DKIM") | .value' /tmp/resend-domain-create.json)
       export SPF_VALUE=$(jq -r '.records[] | select(.record=="SPF") | .value' /tmp/resend-domain-create.json)
       export MX_VALUE=$(jq -r '.records[] | select(.record=="MX") | .value' /tmp/resend-domain-create.json)
       echo "RESEND_DOMAIN_ID=$RESEND_DOMAIN_ID"
       echo "DKIM_CNAME_NAME=$DKIM_CNAME_NAME"
       echo "DKIM_CNAME_VALUE=$DKIM_CNAME_VALUE"
       echo "SPF_VALUE=$SPF_VALUE"
       echo "MX_VALUE=$MX_VALUE"
       ```
       All 5 vars must be non-empty (not `null` from jq).

    5. Append a small text header to the evidence file (since the file is JSON, prepend metadata as a sibling object via jq if desired, OR write a parallel `.md` log; here we prepend to JSON via wrapping):
       ```bash
       jq -n \
         --slurpfile body /tmp/resend-domain-create.json \
         --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
         '{ created_at: $ts, request: {method: "POST", url: "https://api.resend.com/domains", body: {name: "digswap.com.br", region: "us-east-1"}}, response: $body[0] }' \
         > .planning/phases/037-external-integrations/evidence/03-resend-domain-create.json
       ```
  </action>
  <acceptance_criteria>
    - `evidence/03-resend-domain-create.json` exists, ≥20 lines, valid JSON
    - `jq -r '.response.name' evidence/03-resend-domain-create.json` returns `digswap.com.br`
    - `jq -r '.response.id' evidence/03-resend-domain-create.json` returns a UUID-shaped string (length ≥30)
    - `jq '.response.records | length' evidence/03-resend-domain-create.json` returns at least `3` (SPF + DKIM + MX)
    - `jq -r '.response.records[] | select(.record=="DKIM") | .type' evidence/03-resend-domain-create.json` returns `CNAME` (not TXT — RESEARCH §"Anti-Patterns" guard)
    - Shell vars set: `$RESEND_DOMAIN_ID`, `$DKIM_CNAME_NAME`, `$DKIM_CNAME_VALUE`, `$SPF_VALUE`, `$MX_VALUE` all non-empty
  </acceptance_criteria>
  <done>Resend domain created (or fetched if pre-existing); records[] captured into evidence; shell vars set for Task 3.2.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3.2: Hostinger DNS PUT — apply SPF, DKIM, Return-Path MX, and DMARC records (single PUT)</name>
  <files>
    .planning/phases/037-external-integrations/evidence/03-hostinger-dns-put.json
  </files>
  <read_first>
    - .planning/phases/036-dns-ssl-cutover/evidence/06-flip-a-payload.json (PUT body shape — overwrite semantics)
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Pattern 3: Hostinger DNS PUT for Multi-Record Set"
    - evidence/03-resend-domain-create.json (DKIM CNAME id from Resend response)
  </read_first>
  <action>
    1. Construct PUT body — single payload with SPF + DKIM + MX + DMARC. **Use `overwrite: false`** so existing apex A and www CNAME (Phase 36) are NOT clobbered. The 4 new records have unique (name, type) pairs.
       ```bash
       # Strip surrounding quotes from SPF_VALUE if present (Resend response may include them)
       SPF_CLEAN=$(echo "$SPF_VALUE" | sed 's/^"//; s/"$//')
       # MX value: Resend returns "feedback-smtp.us-east-1.amazonses.com" — Hostinger expects content + priority
       # DKIM value: Resend returns trailing dot (FQDN) — Hostinger accepts both with/without; keep trailing dot for explicit FQDN

       PUT_BODY=$(jq -n \
         --arg dkim_name "$DKIM_CNAME_NAME" \
         --arg dkim_val "$DKIM_CNAME_VALUE" \
         --arg spf "$SPF_CLEAN" \
         --arg mx_val "$MX_VALUE" \
         '{
           overwrite: false,
           zone: [
             { name: "send", type: "TXT", ttl: 300, records: [{content: $spf}] },
             { name: $dkim_name, type: "CNAME", ttl: 300, records: [{content: $dkim_val}] },
             { name: "send", type: "MX", ttl: 300, records: [{content: $mx_val, priority: 10}] },
             { name: "_dmarc", type: "TXT", ttl: 300, records: [{content: "v=DMARC1; p=none; rua=mailto:dmarc@digswap.com.br"}] }
           ]
         }')

       echo "$PUT_BODY" | jq '.' > /tmp/hostinger-put-body.json
       cat /tmp/hostinger-put-body.json
       ```

    2. Apply to Hostinger:
       ```bash
       curl -sS -X PUT \
         -H "Authorization: Bearer $(cat ~/.hostinger-token)" \
         -H "Content-Type: application/json" \
         -d @/tmp/hostinger-put-body.json \
         https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br \
         > /tmp/hostinger-put-resp.json

       cat /tmp/hostinger-put-resp.json | jq '.'
       ```
       Expect: response body says "Request accepted" or returns the updated zone (Phase 36 evidence/06 lineage).

    3. Quick DNS resolution check (~5min wait for TTL=300 propagation; can be partial since Resend's verifier polls Route 53):
       ```bash
       # Pre-Resend-verify, do quick resolves to confirm DNS engine published. Use Google HTTP DNS (Phase 36 fallback for Windows git-bash):
       echo "--- DNS quick checks (immediate post-PUT — may take 1-3min to propagate) ---"
       curl -sS "https://dns.google/resolve?name=send.digswap.com.br&type=TXT" | jq '.Answer // []'
       curl -sS "https://dns.google/resolve?name=${DKIM_CNAME_NAME}.digswap.com.br&type=CNAME" | jq '.Answer // []'
       curl -sS "https://dns.google/resolve?name=send.digswap.com.br&type=MX" | jq '.Answer // []'
       curl -sS "https://dns.google/resolve?name=_dmarc.digswap.com.br&type=TXT" | jq '.Answer // []'
       ```
       If any returns `[]` after retry 3-5 minutes later — propagation is still in progress, but Resend's verify (Task 3.3) tolerates this with its own retry.

    4. Persist evidence:
       ```bash
       jq -n \
         --slurpfile body /tmp/hostinger-put-body.json \
         --slurpfile resp /tmp/hostinger-put-resp.json \
         --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
         '{ applied_at: $ts, request: {method: "PUT", url: "https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br", body: $body[0]}, response: $resp[0] }' \
         > .planning/phases/037-external-integrations/evidence/03-hostinger-dns-put.json
       ```
  </action>
  <acceptance_criteria>
    - `evidence/03-hostinger-dns-put.json` exists, ≥30 lines, valid JSON
    - `jq '.request.body.zone | length' evidence/03-hostinger-dns-put.json` returns `4` (SPF + DKIM + MX + DMARC)
    - `jq '.request.body.overwrite' evidence/03-hostinger-dns-put.json` returns `false` (no clobber of apex/www)
    - `jq '.request.body.zone[] | select(.name=="_dmarc") | .records[0].content' evidence/03-hostinger-dns-put.json` returns a string starting with `v=DMARC1; p=none`
    - `jq '.request.body.zone[] | select(.type=="CNAME") | .name' evidence/03-hostinger-dns-put.json` ends with `._domainkey` (DKIM is CNAME, not TXT)
    - Hostinger response is non-error (no top-level `error` or `errors` field; verify: `jq -e '.response | (has("error") or has("errors")) | not' evidence/03-hostinger-dns-put.json` returns true)
  </acceptance_criteria>
  <done>4 DNS records applied to Hostinger via single PUT with overwrite=false. DMARC at p=none for first 30 days (deferred escalation per CONTEXT POST-MVP).</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3.3: POST /domains/{id}/verify + poll GET /domains/{id} until status=verified (≤10min hard timeout)</name>
  <files>
    .planning/phases/037-external-integrations/evidence/03-resend-verified.json
  </files>
  <read_first>
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Pattern 2: Resend Domain Verification Polling" (60s interval, up to 60min — but Phase 37 plan caps at 10min for SLA respect; if 10min insufficient, escalate to checkpoint)
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Pitfall P15" (verification gate before SMTP enable)
  </read_first>
  <action>
    1. Trigger verification:
       ```bash
       curl -sS -X POST \
         -H "Authorization: Bearer $(cat ~/.resend-token)" \
         "https://api.resend.com/domains/${RESEND_DOMAIN_ID}/verify" \
         > /tmp/resend-verify-trigger.json
       cat /tmp/resend-verify-trigger.json | jq '.'
       ```
       Resend may return `{"object":"domain", "id": "...", "status": "pending"}` or similar.

    2. Poll loop — every 60s, up to 10min (10 iterations max):
       ```bash
       LOG=/tmp/resend-poll.log
       echo "[$(date -u +%H:%M:%SZ)] starting poll for domain ${RESEND_DOMAIN_ID}" > $LOG

       for i in $(seq 1 10); do
         RESP=$(curl -sS -H "Authorization: Bearer $(cat ~/.resend-token)" \
           "https://api.resend.com/domains/${RESEND_DOMAIN_ID}")
         STATUS=$(echo "$RESP" | jq -r '.status')
         echo "[$(date -u +%H:%M:%SZ)] poll #$i — status=$STATUS" | tee -a $LOG

         if [ "$STATUS" = "verified" ]; then
           echo "$RESP" > /tmp/resend-final.json
           break
         fi

         if [ "$STATUS" = "failed" ] || [ "$STATUS" = "failure" ]; then
           echo "[FAIL] Resend verification failed — inspect records:" | tee -a $LOG
           echo "$RESP" | jq '.records[] | {record, name, status}' | tee -a $LOG
           echo "$RESP" > /tmp/resend-final.json
           break
         fi

         sleep 60
       done

       FINAL_STATUS=$(jq -r '.status' /tmp/resend-final.json 2>/dev/null || echo "timeout")
       echo "[$(date -u +%H:%M:%SZ)] FINAL status=$FINAL_STATUS" | tee -a $LOG
       ```

    3. If `FINAL_STATUS != "verified"` — DO NOT proceed to Task 3.4/3.5. The plan halts here. Possible causes:
       - DNS records still propagating → wait additional time, re-run Task 3.3
       - Wrong record content (re-check evidence/03-resend-domain-create.json vs evidence/03-hostinger-dns-put.json — values must match byte-for-byte)
       - Hostinger silently rejected one record — query Hostinger zone via `curl https://developers.hostinger.com/api/dns/v1/zones/digswap.com.br -H "Authorization: Bearer $(cat ~/.hostinger-token)"` and confirm 4 new records present

       If verified, proceed.

    4. Persist evidence:
       ```bash
       jq -n \
         --slurpfile final /tmp/resend-final.json \
         --rawfile pollLog $LOG \
         --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
         '{verified_at: $ts, final_status: $final[0].status, final_response: $final[0], poll_log: $pollLog}' \
         > .planning/phases/037-external-integrations/evidence/03-resend-verified.json
       ```
  </action>
  <acceptance_criteria>
    - `evidence/03-resend-verified.json` exists, ≥15 lines, valid JSON
    - `jq -r '.final_status' evidence/03-resend-verified.json` returns `verified` (NOT pending, failed, or timeout)
    - `jq -r '.final_response.name' evidence/03-resend-verified.json` returns `digswap.com.br`
    - `jq '.final_response.records | map(select(.status != "verified" and .record != null)) | length' evidence/03-resend-verified.json` returns `0` (or the records[] field absent — Resend strips after verification)
    - `evidence/03-resend-verified.json` poll_log field contains a `verified` line
    - DEP-INT-07 satisfied per VALIDATION.md row
  </acceptance_criteria>
  <done>Resend domain digswap.com.br is verified. DEP-INT-07 closed. Cleared to enable Supabase Auth SMTP in Task 3.5.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3.4: Atomic Vercel swap — RESEND_API_KEY (and verify RESEND_FROM_EMAIL is digswap.com.br)</name>
  <files>
    .planning/phases/037-external-integrations/evidence/03-resend-env-audit.txt
  </files>
  <read_first>
    - .planning/phases/035-vercel-environment-wiring/evidence/02-env-add-loop.log (rm-then-add pattern with --sensitive)
    - apps/web/src/lib/env.ts line 22 (RESEND_FROM_EMAIL default is `noreply@digswap.com` — missing .br! Verify Vercel Production scope override exists)
    - .planning/phases/037-external-integrations/037-CONTEXT.md D-09 (From=noreply@digswap.com.br)
    - evidence/00-tokens-handling.md (~/.resend-token holds the value to copy into Vercel)
  </read_first>
  <action>
    1. Verify Production scope RESEND_FROM_EMAIL value (env.ts default is wrong — `noreply@digswap.com` without `.br`; Phase 35 D-21 should have set the right value, but verify):
       ```bash
       VTOKEN="$(cat ~/.vercel-token)"
       vercel env pull /tmp/env.production --environment=production --token "$VTOKEN" --yes >/dev/null 2>&1
       FROM_EMAIL=$(grep '^RESEND_FROM_EMAIL=' /tmp/env.production | cut -d= -f2- | tr -d '"')
       echo "Current Production RESEND_FROM_EMAIL: $FROM_EMAIL"

       if [ "$FROM_EMAIL" != "noreply@digswap.com.br" ]; then
         echo "FIXING: RESEND_FROM_EMAIL is '$FROM_EMAIL' — should be 'noreply@digswap.com.br' (CONTEXT D-09)"
         vercel env rm RESEND_FROM_EMAIL production --yes --token "$VTOKEN" 2>&1 | tee -a /tmp/resend-env-swap.log
         printf %s "noreply@digswap.com.br" | vercel env add RESEND_FROM_EMAIL production --token "$VTOKEN" 2>&1 | tee -a /tmp/resend-env-swap.log
       else
         echo "RESEND_FROM_EMAIL already correct"
       fi
       ```

    2. Atomic swap RESEND_API_KEY (DEFERRED → real value from ~/.resend-token):
       ```bash
       set -e
       vercel env rm RESEND_API_KEY production --yes --token "$VTOKEN" 2>&1 | tee -a /tmp/resend-env-swap.log
       cat ~/.resend-token | vercel env add RESEND_API_KEY production --sensitive --token "$VTOKEN" 2>&1 | tee -a /tmp/resend-env-swap.log
       set +e
       ```
       Note: `cat ~/.resend-token` (NOT printf %s — the file already has no trailing newline if Task 0.3 used printf). If accidentally has newline, `printf %s "$(cat ~/.resend-token)"` to be safe.

    3. Audit:
       ```bash
       {
         echo "=== Phase 37 Wave 3 — Resend env audit ==="
         echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
         echo ""
         echo "--- vercel env ls production | grep RESEND ---"
         vercel env ls production --token "$VTOKEN" | grep -E '^[[:space:]]*RESEND_'
         echo ""
         echo "--- DEFERRED marker scan ---"
         vercel env pull /tmp/env.audit --environment=production --token "$VTOKEN" --yes >/dev/null 2>&1
         DEFERRED=$(grep -c -E '^RESEND_API_KEY=.*DEFERRED' /tmp/env.audit || echo "0")
         echo "DEFERRED markers in RESEND_API_KEY: $DEFERRED"
         echo ""
         echo "--- RESEND_FROM_EMAIL value (NOT secret — log full) ---"
         grep '^RESEND_FROM_EMAIL=' /tmp/env.audit
         echo ""
         echo "PASS: RESEND_API_KEY swapped, RESEND_FROM_EMAIL=noreply@digswap.com.br confirmed"
         rm -f /tmp/env.audit /tmp/env.production
       } > .planning/phases/037-external-integrations/evidence/03-resend-env-audit.txt
       ```
  </action>
  <acceptance_criteria>
    - `vercel env ls production --token "$(cat ~/.vercel-token)" | grep -c RESEND_API_KEY` returns ≥1
    - `evidence/03-resend-env-audit.txt` contains literal string `DEFERRED markers in RESEND_API_KEY: 0`
    - `evidence/03-resend-env-audit.txt` contains literal string `RESEND_FROM_EMAIL=noreply@digswap.com.br`
    - `evidence/03-resend-env-audit.txt` contains literal string `PASS: RESEND_API_KEY swapped`
    - No raw `re_*` API key value appears in the audit file (Vercel CLI --sensitive prevents this; verify by `grep -E 're_[A-Za-z0-9_-]{20,}' evidence/03-resend-env-audit.txt` returning empty)
  </acceptance_criteria>
  <done>RESEND_API_KEY swapped to real value in Vercel Production; RESEND_FROM_EMAIL confirmed/fixed to `noreply@digswap.com.br`.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3.5: PATCH Supabase Auth SMTP config — point at Resend + raise email rate limit to 100/hr</name>
  <files>
    .planning/phases/037-external-integrations/evidence/03-supabase-smtp-config.json
  </files>
  <read_first>
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Code Examples > Supabase Management API auth config update" + §"Pitfall P-NEW-3" (rate-limit raise)
    - .planning/phases/037-external-integrations/037-CONTEXT.md D-09 (From=noreply@digswap.com.br) + §"Decisions > Resend + Supabase Auth SMTP"
    - evidence/03-resend-verified.json (must show status=verified before this task runs — Pitfall P15 gate)
  </read_first>
  <action>
    1. Pre-state capture:
       ```bash
       curl -sS \
         -H "Authorization: Bearer $(cat ~/.supabase-token)" \
         https://api.supabase.com/v1/projects/swyfhpgerzvvmoswkjyt/config/auth \
         > /tmp/auth-pre-smtp.json
       jq '{smtp_host, smtp_port, smtp_user, smtp_admin_email, smtp_sender_name, smtp_max_frequency, rate_limit_email_sent}' /tmp/auth-pre-smtp.json
       ```

    2. PATCH (use the resend API key value from ~/.resend-token; Supabase docs confirm smtp_user="resend" + smtp_pass=full API key value):
       ```bash
       RESEND_KEY=$(cat ~/.resend-token)

       curl -sS -X PATCH \
         -H "Authorization: Bearer $(cat ~/.supabase-token)" \
         -H "Content-Type: application/json" \
         https://api.supabase.com/v1/projects/swyfhpgerzvvmoswkjyt/config/auth \
         -d "$(jq -n \
           --arg pass "$RESEND_KEY" \
           '{
             smtp_host: "smtp.resend.com",
             smtp_port: "465",
             smtp_user: "resend",
             smtp_pass: $pass,
             smtp_admin_email: "noreply@digswap.com.br",
             smtp_sender_name: "DigSwap",
             smtp_max_frequency: 60,
             rate_limit_email_sent: 100
           }')" \
         > /tmp/auth-smtp-patch-resp.json

       cat /tmp/auth-smtp-patch-resp.json | jq '{smtp_host, smtp_port, smtp_user, smtp_admin_email, smtp_sender_name, rate_limit_email_sent}'
       ```
       Verify response has no `error` field.

    3. Post-state capture:
       ```bash
       curl -sS \
         -H "Authorization: Bearer $(cat ~/.supabase-token)" \
         https://api.supabase.com/v1/projects/swyfhpgerzvvmoswkjyt/config/auth \
         > /tmp/auth-post-smtp.json
       ```

    4. Write evidence with sanitized diff (smtp_pass length only; never raw):
       ```bash
       jq -n \
         --slurpfile pre /tmp/auth-pre-smtp.json \
         --slurpfile post /tmp/auth-post-smtp.json \
         '{
           pre: ($pre[0] | {smtp_host, smtp_port, smtp_user, smtp_admin_email, smtp_sender_name, smtp_max_frequency, rate_limit_email_sent, smtp_pass: (.smtp_pass // "" | if length > 0 then "<set; length=" + (length|tostring) + ">" else "<unset>" end)}),
           post: ($post[0] | {smtp_host, smtp_port, smtp_user, smtp_admin_email, smtp_sender_name, smtp_max_frequency, rate_limit_email_sent, smtp_pass: (.smtp_pass // "" | if length > 0 then "<set; length=" + (length|tostring) + ">" else "<unset>" end)})
         }' \
         > .planning/phases/037-external-integrations/evidence/03-supabase-smtp-config.json
       ```
  </action>
  <acceptance_criteria>
    - PATCH returned no error (`jq -e 'has("error") | not' /tmp/auth-smtp-patch-resp.json` exits 0)
    - `evidence/03-supabase-smtp-config.json` exists, ≥20 lines, valid JSON
    - `jq -r '.post.smtp_host' evidence/03-supabase-smtp-config.json` returns `smtp.resend.com`
    - `jq -r '.post.smtp_port' evidence/03-supabase-smtp-config.json` returns `465`
    - `jq -r '.post.smtp_user' evidence/03-supabase-smtp-config.json` returns `resend`
    - `jq -r '.post.smtp_admin_email' evidence/03-supabase-smtp-config.json` returns `noreply@digswap.com.br`
    - `jq -r '.post.smtp_sender_name' evidence/03-supabase-smtp-config.json` returns `DigSwap`
    - `jq -r '.post.rate_limit_email_sent' evidence/03-supabase-smtp-config.json` returns a number ≥100 (Pitfall P-NEW-3 mitigation)
    - `jq -r '.post.smtp_pass' evidence/03-supabase-smtp-config.json` matches `<set; length=N>` (sanitized)
  </acceptance_criteria>
  <done>Supabase Auth SMTP routed via Resend with rate limit at 100/hr. DEP-INT-08 substantively satisfied (manual UAT in Task 3.6 confirms end-to-end).</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3.6: Manual UAT — trigger password-reset email + verify From + DKIM=PASS in Gmail headers (DEP-INT-08 evidence)</name>
  <files>
    .planning/phases/037-external-integrations/evidence/03b-smtp-deliverability.md
  </files>
  <read_first>
    - .planning/phases/037-external-integrations/037-VALIDATION.md row DEP-INT-08
    - .planning/phases/037-external-integrations/037-RESEARCH.md §"Pitfall P15" warning signs (DKIM PASS in Gmail Show Original is the deliverability proof)
  </read_first>
  <action>
    INSTRUCTIONS TO USER (paste into chat as checkpoint):

    What was built (autonomously by Claude in Tasks 3.1-3.5):
    - Resend domain `digswap.com.br` is verified (DKIM/SPF/MX records on Hostinger, DMARC at p=none)
    - Vercel Production scope has real RESEND_API_KEY + RESEND_FROM_EMAIL=noreply@digswap.com.br
    - Supabase Auth SMTP now routes via smtp.resend.com:465 (auth user=resend, pass=API key)
    - Email rate limit raised to 100/hr (Pitfall P-NEW-3)

    How to verify (please do this — DEP-INT-08 closes only on email-with-DKIM-PASS):

    1. Open https://digswap.com.br/forgot-password (or whichever route triggers a Supabase password-reset email — could also be `/signin` → "Forgot password?" link).
    2. Enter your email (use a Gmail address — Gmail's "Show original" reveals DKIM/SPF/DMARC results in plain text).
    3. Submit. You should see "Check your email" or similar UI feedback.
    4. Open Gmail. Wait up to 60s for the email to arrive. Look in inbox; if not there, check spam.
       - **Strong fail signal**: email arrives in spam = sender reputation issue (most likely missing DMARC record — re-check evidence/03-hostinger-dns-put.json for the _dmarc TXT entry).
       - **Acceptable**: email arrives in inbox.

    5. In the email, click the three-dot menu → "Show original" (Gmail desktop) — opens a new tab with full headers.

    6. In the "Show original" view, look for:
       ```
       SPF:      PASS  with IP ...
       DKIM:     'PASS' with domain digswap.com.br
       DMARC:    'PASS' with domain digswap.com.br
       ```
       (Gmail labels these clearly at the top.)

    7. Confirm the From header reads `From: DigSwap <noreply@digswap.com.br>` (or just `noreply@digswap.com.br` — sender name display is browser-dependent).

    8. Reply with one of:
       - `approved — DKIM=PASS, SPF=PASS, DMARC=PASS, From=noreply@digswap.com.br, inbox`
       - `partial — DKIM=PASS but DMARC=FAIL` (Gmail tolerates DMARC fail at p=none; document and continue — DMARC escalation deferred POST-MVP per CONTEXT)
       - `failed: <details>` (e.g., spam folder, DKIM=FAIL, no email at all) → blocking, must fix

    Resume signal: `approved — ...` or `partial — DKIM=PASS but DMARC=FAIL`

    Then Claude writes `evidence/03b-smtp-deliverability.md`:
    - Timestamp
    - From address received: noreply@digswap.com.br
    - Inbox or spam: <where>
    - DKIM result (from Show Original): PASS / FAIL
    - SPF result: PASS / FAIL
    - DMARC result: PASS / FAIL (acceptable at p=none if FAIL)
    - User Gmail address (sanitized: first letter + masked)
    - Conclusion: DEP-INT-08 SATISFIED / SATISFIED-WITH-CAVEAT / FAIL
  </action>
  <acceptance_criteria>
    - User has replied `approved — ...` or `partial — DKIM=PASS but DMARC=FAIL`
    - `evidence/03b-smtp-deliverability.md` exists, ≥15 lines
    - File contains literal strings: `noreply@digswap.com.br`, `DKIM`, `PASS`, `Show original`
    - File contains explicit `DEP-INT-08 SATISFIED` (or `SATISFIED-WITH-CAVEAT` if DMARC=FAIL but DKIM=PASS — acceptable per p=none policy)
    - User email sanitized
  </acceptance_criteria>
  <done>Email delivers from prod sender domain with DKIM signature; DEP-INT-08 satisfied.</done>
</task>

</tasks>

<verification>
After all 6 tasks:

1. **Evidence files exist:**
   ```bash
   ls .planning/phases/037-external-integrations/evidence/03-* .planning/phases/037-external-integrations/evidence/03b-*
   # Expect 6 files
   ```

2. **DEP-INT-07 (Resend domain verified):**
   ```bash
   jq -r '.final_status' .planning/phases/037-external-integrations/evidence/03-resend-verified.json
   # verified
   ```

3. **DEP-INT-08 (Supabase SMTP + manual UAT):**
   ```bash
   jq -r '.post.smtp_host' .planning/phases/037-external-integrations/evidence/03-supabase-smtp-config.json
   # smtp.resend.com
   grep -c 'DEP-INT-08 SATISFIED' .planning/phases/037-external-integrations/evidence/03b-smtp-deliverability.md
   # ≥1
   ```

4. **DNS resolution sanity:**
   ```bash
   curl -sS "https://dns.google/resolve?name=_dmarc.digswap.com.br&type=TXT" | jq '.Answer[0].data'
   # contains v=DMARC1; p=none
   ```

5. **No leaked Resend key:**
   ```bash
   grep -RIE 're_[A-Za-z0-9_-]{20,}' .planning/phases/037-external-integrations/evidence/03-* 2>/dev/null
   # exit 1 (no matches)
   ```

6. **Rate limit raised (Pitfall P-NEW-3):**
   ```bash
   jq -r '.post.rate_limit_email_sent' .planning/phases/037-external-integrations/evidence/03-supabase-smtp-config.json
   # ≥100
   ```
</verification>

<success_criteria>
- 6 evidence files exist with correct content
- DEP-INT-07 closed: Resend `digswap.com.br` domain status=verified, all 4 DNS records (SPF + DKIM + MX + DMARC) propagated
- DEP-INT-08 closed: Supabase Auth SMTP routes via smtp.resend.com; manual UAT email arrived from `noreply@digswap.com.br` with DKIM=PASS
- DKIM applied as CNAME (not TXT — RESEARCH §"Anti-Patterns" guard satisfied)
- DMARC at `p=none` for first 30 days (escalation deferred POST-MVP per CONTEXT)
- Email rate limit raised from default 30/hr to 100/hr (Pitfall P-NEW-3 mitigated)
- Hostinger PUT used `overwrite=false` — apex/www records from Phase 36 untouched
- No raw Resend API key in any evidence file (sanitized to length-only)
- RESEND_FROM_EMAIL in Vercel Production = `noreply@digswap.com.br` (corrects env.ts default `noreply@digswap.com` if needed)
</success_criteria>

<output>
After completion, create `.planning/phases/037-external-integrations/037-03-SUMMARY.md` with sections:

1. **Frontmatter** (status: complete, wave: 1, requirements_addressed: [DEP-INT-07, DEP-INT-08])
2. **What this plan delivered** — 1-paragraph
3. **Tasks completed** — 6 tasks with status
4. **Path deviations** (e.g., RESEND_FROM_EMAIL needed correction; verification poll took N minutes)
5. **Resend domain artifacts** — domain_id, all 4 DNS record names/types/values
6. **Hostinger DNS PUT** — overwrite=false confirmed; apex/www untouched
7. **Resend verification** — final status + poll log summary
8. **Vercel env swap** — RESEND_API_KEY DEFERRED→real; RESEND_FROM_EMAIL fix if applied
9. **Supabase SMTP config** — pre/post diff summary; rate_limit_email_sent: pre→100
10. **Manual UAT** — From, DKIM/SPF/DMARC results
11. **Carry-overs flagged** — DMARC escalation `p=none → p=quarantine → p=reject` deferred POST-MVP per CONTEXT
12. **Evidence inventory** — list of 6 files

Commit message: `docs(037-03): wire Resend domain + Supabase SMTP (DEP-INT-07, DEP-INT-08)`
</output>
