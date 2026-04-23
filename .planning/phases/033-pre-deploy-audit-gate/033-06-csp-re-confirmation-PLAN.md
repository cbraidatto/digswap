---
phase: 033-pre-deploy-audit-gate
plan: 06
type: execute
wave: 3
depends_on: [033-01]
files_modified:
  - .planning/phases/033-pre-deploy-audit-gate/evidence/06-rebuild.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/06b-csp-all-routes.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/06c-console-home.png
  - .planning/phases/033-pre-deploy-audit-gate/evidence/06c-console-signin.png
  - .planning/phases/033-pre-deploy-audit-gate/evidence/06c-console-signup.png
  - .planning/phases/033-pre-deploy-audit-gate/evidence/06c-console-pricing.png
  - .planning/phases/033-pre-deploy-audit-gate/evidence/06c-console-feed.png
  - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
autonomous: false
requirements: [DEP-AUD-06]

must_haves:
  truths:
    - "CSP header is present on every public route served by pnpm start"
    - "Header contains nonce-<base64> in script-src (nonce-based CSP active)"
    - "Header does NOT contain unsafe-inline for script-src in prod mode"
    - "DevTools Console shows zero CSP violations on /, /signin, /signup, /pricing, /feed"
    - "AUDIT-REPORT.md §6 flipped to PASS (per user memory this is a re-confirmation — fix was applied 2026-03-28)"
    - "Prod server rebuild evidence captured (evidence/06-rebuild.txt) — Plan 04 Task 3 killed the port-3000 server at the end of W2, so W3 MUST rebuild before curling"
  artifacts:
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/06-rebuild.txt"
      provides: "pnpm build stdout+stderr, proving the prod server was restarted cleanly after Plan 04 killed port 3000"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt"
      provides: "Curl -I of / showing the Content-Security-Policy response header"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/06b-csp-all-routes.txt"
      provides: "Multi-route CSP header dump"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/06c-console-home.png"
      provides: "DevTools Console screenshot for / showing zero violations"
      contains: ""
  key_links:
    - from: "apps/web/src/middleware.ts"
      to: "apps/web/src/lib/security/csp.ts"
      via: "middleware generates per-request nonce, generateCspHeader(nonce, isDev) constructs policy"
      pattern: "generateCspHeader"
---

<objective>
DEP-AUD-06: re-confirm that the 2026-03-28 CSP fix (nonce-based CSP, no unsafe-inline in prod) still holds on main HEAD. Per user memory (`project_security_posture.md`) this was resolved in Phase 11, so DEP-AUD-06 is primarily a verification exercise — not a new fix.

Purpose: ROADMAP criterion 7 requires the outstanding CSP issue to be confirmed resolved OR explicitly documented as accepted risk. User memory says "fixed" — this plan proves the claim on main HEAD via two evidence types: header curl output (machine-checkable) and DevTools Console screenshots (the canonical source of CSP violation signals).

Output: 1 rebuild log (06-rebuild.txt) + 2 text evidence files (06a, 06b) + 5 DevTools screenshots (06c-*.png) + AUDIT-REPORT.md §6 flipped to PASS.

**Plan is non-autonomous** — DevTools Console inspection is a `checkpoint:human-verify` step (per 033-VALIDATION.md Manual-Only Verifications: "Browser DevTools console is the authoritative source for CSP reports; no headless tool matches the real-user signal").

**Prerequisite:** Plan 04 Task 3 explicitly kills the port-3000 prod server at the end of W2 (`lsof -ti:3000 | xargs -r kill`). Because this plan is in W3 and depends on the work Plan 04 produced (confirmed nonce middleware), Task 1 MUST rebuild and restart the server before curling — the "if not already running" branch is always taken.
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/033-pre-deploy-audit-gate/033-CONTEXT.md
@.planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md
@.planning/phases/033-pre-deploy-audit-gate/033-VALIDATION.md
@.planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
@apps/web/src/middleware.ts
@apps/web/src/lib/security/csp.ts

<interfaces>
<!-- CSP generation verified 2026-04-21 per RESEARCH.md §Audit 6: -->
<!-- apps/web/src/middleware.ts:10-24 — generates per-request nonce, sets Content-Security-Policy response header -->
<!-- apps/web/src/lib/security/csp.ts — generateCspHeader(nonce, isDev) -->
<!--   isDev=true → relaxed policy (includes unsafe-inline for dev tooling) -->
<!--   isDev=false → strict policy with nonce, NO unsafe-inline in script-src -->
<!-- -->
<!-- RESEARCH.md §Audit 6 Gotcha 1: MUST run pnpm build && pnpm start — pnpm dev has relaxed CSP and will falsely pass the unsafe-inline check -->
<!-- RESEARCH.md §Audit 6 Gotcha 3: /api/og/* is excluded from middleware; CSP not expected there (intentional) -->
-->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rebuild prod server, capture CSP response headers on public routes via curl</name>
  <files>
    .planning/phases/033-pre-deploy-audit-gate/evidence/06-rebuild.txt
    .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt
    .planning/phases/033-pre-deploy-audit-gate/evidence/06b-csp-all-routes.txt
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md §Audit 6 (exact curl commands + pass thresholds)
    - apps/web/src/lib/security/csp.ts (confirm what the header should look like in prod mode)
    - apps/web/src/middleware.ts (nonce generation — confirms header is per-request, nonce differs each curl)
  </read_first>
  <action>
Plan 04 Task 3 killed port 3000 at the end of W2 (`lsof -ti:3000 | xargs -r kill`). W3 therefore ALWAYS rebuilds and restarts the prod server before curling — the rebuild evidence file `06-rebuild.txt` is a required artifact of this task.

**Step 0 — Port sanity check + rebuild (REQUIRED, always runs):**

```bash
# Confirm nothing is on :3000 (Plan 04 killed it — belt and suspenders)
lsof -ti:3000 | xargs -r kill 2>/dev/null
sleep 1

# Rebuild — capture stdout AND stderr to the evidence file (REQUIRED ARTIFACT)
pnpm --filter @digswap/web build \
  > .planning/phases/033-pre-deploy-audit-gate/evidence/06-rebuild.txt 2>&1
BUILD_EXIT=$?
echo "---" >> .planning/phases/033-pre-deploy-audit-gate/evidence/06-rebuild.txt
echo "build exit=$BUILD_EXIT at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> .planning/phases/033-pre-deploy-audit-gate/evidence/06-rebuild.txt

# Assert build succeeded
test "$BUILD_EXIT" = "0" || { echo "FAIL: pnpm build exited $BUILD_EXIT — see evidence/06-rebuild.txt"; exit 1; }

# Assert build artifact shows success signal (Next.js prints "Compiled successfully" or ".next/standalone" lines)
grep -qE "Compiled successfully|Creating an optimized production build|Generating static pages" \
  .planning/phases/033-pre-deploy-audit-gate/evidence/06-rebuild.txt \
  || { echo "FAIL: build log missing success signal — see evidence/06-rebuild.txt"; exit 1; }

# Start the server in background
pnpm --filter @digswap/web start &
SERVER_PID=$!

# Append the Ready-in marker once the server is up
for i in {1..30}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ | grep -qE "200|301|302|307"; then
    echo "server ready at $(date -u +%Y-%m-%dT%H:%M:%SZ), pid=$SERVER_PID" >> .planning/phases/033-pre-deploy-audit-gate/evidence/06-rebuild.txt
    break
  fi
  sleep 1
done

# Sanity: the rebuild evidence file must contain either "Compiled successfully" or "Ready" (start-up marker)
grep -qE "Compiled successfully|Ready" .planning/phases/033-pre-deploy-audit-gate/evidence/06-rebuild.txt \
  || { echo "FAIL: 06-rebuild.txt missing 'Compiled successfully' or 'Ready' marker"; exit 1; }
```

**CRITICAL (RESEARCH.md §Audit 6 Gotcha 1):** This audit MUST run against `pnpm start` (prod build), NOT `pnpm dev`. Dev mode has a relaxed CSP that includes `unsafe-inline` — testing dev would falsely pass the unsafe-inline-absent check.

**Step 1 — Capture the CSP header for the landing page:**

```bash
curl -sI http://localhost:3000/ \
  | grep -i "content-security-policy" \
  | tee .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt
```

Expected shape (one long header line):
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<base64>' ...; ...
```

**Pass thresholds:**

```bash
# Header is present
grep -qi "content-security-policy" .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt && echo "header present"

# Nonce is present
grep -qE "nonce-[A-Za-z0-9_=+/-]+" .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt && echo "nonce present"

# No unsafe-inline in the script-src directive (prod mode check)
# Note: 'unsafe-inline' may legitimately appear in style-src for shadcn — only script-src is the failure
grep -q "script-src" .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt && \
  awk 'BEGIN{IGNORECASE=1}
       /content-security-policy/ {
         # extract the value after the first colon
         sub(/^[^:]*:[[:space:]]*/, "");
         # look for script-src ... 'unsafe-inline' ... before the next ; or end
         if (match($0, /script-src[^;]*/)) {
           src = substr($0, RSTART, RLENGTH);
           if (src ~ /unsafe-inline/) print "FAIL: script-src contains unsafe-inline — " src;
           else print "OK: script-src does not contain unsafe-inline"
         }
       }' .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt
```

Append the check results to the evidence file:

```bash
{
  echo "---"
  echo "Checks run at: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  grep -qi "content-security-policy" .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt && echo "CHECK: header present — PASS" || echo "CHECK: header present — FAIL"
  grep -qE "nonce-[A-Za-z0-9_=+/-]+" .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt && echo "CHECK: nonce present — PASS" || echo "CHECK: nonce present — FAIL"
  awk 'BEGIN{IGNORECASE=1} /content-security-policy/ { sub(/^[^:]*:[[:space:]]*/, ""); if (match($0, /script-src[^;]*/)) { src = substr($0, RSTART, RLENGTH); if (src ~ /unsafe-inline/) print "CHECK: script-src unsafe-inline absent — FAIL"; else print "CHECK: script-src unsafe-inline absent — PASS" } }' .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt
} >> .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt
```

**Step 2 — Capture headers across all key public routes:**

```bash
{
  for path in / /signin /signup /pricing; do
    echo "=== $path ==="
    curl -sI "http://localhost:3000${path}" | grep -i "content-security-policy" | head -1
    echo
  done
} | tee .planning/phases/033-pre-deploy-audit-gate/evidence/06b-csp-all-routes.txt
```

Every route must show a non-empty CSP header. `/api/og/*` is intentionally NOT covered (excluded from middleware per RESEARCH.md §Audit 6 Gotcha 3).

**If failing (per D-10):**

- Build fails → check `evidence/06-rebuild.txt` tail for the compile error; fix the underlying code issue; re-run Step 0. ≤30 min inline unless the error is cross-cutting.
- Header absent → middleware.ts regressed. Grep for `Content-Security-Policy` in middleware.ts; if missing, re-apply per the 2026-03-28 fix pattern. ≤30 min inline.
- `unsafe-inline` present in `script-src` → same — re-apply the nonce pattern. ≤30 min inline.
- Regression >2h → escalate to decimal phase 33.1 per D-16.
  </action>
  <verify>
    <automated>test -f .planning/phases/033-pre-deploy-audit-gate/evidence/06-rebuild.txt && grep -qE "Compiled successfully|Ready" .planning/phases/033-pre-deploy-audit-gate/evidence/06-rebuild.txt && test -f .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt && grep -qi "content-security-policy" .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt && grep -qE "nonce-[A-Za-z0-9_=+/-]+" .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt && grep -q "CHECK: script-src unsafe-inline absent — PASS" .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt && [ "$(grep -c 'content-security-policy' .planning/phases/033-pre-deploy-audit-gate/evidence/06b-csp-all-routes.txt)" -ge 4 ] && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `evidence/06-rebuild.txt` exists (pnpm build stdout+stderr captured)
    - `evidence/06-rebuild.txt` contains either `Compiled successfully` (Next.js build success) OR `Ready` (startup signal) — at least one of the two success markers
    - `evidence/06a-csp-header.txt` contains a line with `content-security-policy` (case-insensitive)
    - `evidence/06a-csp-header.txt` contains a `nonce-<base64>` substring
    - `evidence/06a-csp-header.txt` contains the line `CHECK: script-src unsafe-inline absent — PASS`
    - `evidence/06b-csp-all-routes.txt` contains `=== /`, `=== /signin`, `=== /signup`, `=== /pricing` route markers
    - `evidence/06b-csp-all-routes.txt` contains at least 4 `content-security-policy` occurrences (one per route)
  </acceptance_criteria>
  <done>Prod server rebuilt after Plan 04's W2 kill, rebuild log committed as evidence, CSP headers captured via curl on 4 public routes; machine-checkable verdict recorded.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: DevTools Console inspection across 5 routes — zero CSP violations (manual)</name>
  <what-built>Task 1 rebuilt the prod server and captured the HTTP header; this gate captures the canonical CSP signal: the browser DevTools Console. Per 033-VALIDATION.md Manual-Only Verifications, no headless tool matches the real-user signal for inline-script / unsafe-eval / mixed-content violations.</what-built>
  <how-to-verify>
    1. Confirm `pnpm --filter @digswap/web start` is still running on :3000.
    2. Open a FRESH Chrome profile (or Chrome Incognito window) to avoid extension noise.
    3. Open DevTools → Console tab → enable "Preserve log".
    4. Visit each route and check Console for any red / yellow messages matching:
       - `Refused to execute inline script ...`
       - `Refused to load ...`
       - `... violates the following Content Security Policy directive ...`
    5. For each route, take a screenshot of the DevTools Console showing ZERO violations. Save:
       - `/` → `.planning/phases/033-pre-deploy-audit-gate/evidence/06c-console-home.png`
       - `/signin` → `.planning/phases/033-pre-deploy-audit-gate/evidence/06c-console-signin.png`
       - `/signup` → `.planning/phases/033-pre-deploy-audit-gate/evidence/06c-console-signup.png`
       - `/pricing` → `.planning/phases/033-pre-deploy-audit-gate/evidence/06c-console-pricing.png`
       - `/feed` (sign in first) → `.planning/phases/033-pre-deploy-audit-gate/evidence/06c-console-feed.png`
    6. If ANY violation appears on ANY route, STOP and fail-inline per D-10:
       - Missing `nonce` on a `<script>` tag → add `nonce={nonce}` from `x-nonce` header
       - External origin blocked → add to `apps/web/src/lib/security/csp.ts` allowlist
       - Fix time: 15-45 min per violation. If >2 violations, escalate to decimal phase 33.1 per D-16.
    7. Reply with either:
       - `CSP clean — 5 screenshots saved` (all routes zero violations)
       - `CSP violations: <route> — <violation text>` (one per line, if any)
  </how-to-verify>
  <resume-signal>Reply `CSP clean — 5 screenshots saved to evidence/06c-*.png` OR `CSP violations found: <details>` (triggers fail-inline).</resume-signal>
  <files>(checkpoint — no file written directly by this task; downstream artifacts listed in files_modified frontmatter)</files>
  <action>This is a checkpoint task. Follow the steps in `<how-to-verify>` above. The human operator performs the verification; execution pauses until the `<resume-signal>` is received.</action>
  <verify>Human replies with the signal phrase specified in `<resume-signal>`.</verify>
  <done>Operator confirms the checkpoint via the resume signal.</done>
</task>

<task type="auto">
  <name>Task 3: Populate AUDIT-REPORT.md §6 with PASS verdict</name>
  <files>
    .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/evidence/06-rebuild.txt (confirm build success marker for §6 note)
    - .planning/phases/033-pre-deploy-audit-gate/evidence/06a-csp-header.txt (header sample + checks)
    - .planning/phases/033-pre-deploy-audit-gate/evidence/06b-csp-all-routes.txt (multi-route summary)
    - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md (current §6 skeleton)
  </read_first>
  <action>
Replace the §6 skeleton with PASS content.

**§6 replacement block:**

```markdown
## §6 DEP-AUD-06 CSP Re-Confirmation

**Status:** PASS
**Timestamp:** <ISO8601 when Task 1 + Task 2 completed>

**Context:** 2026-03-28 security audit (stored in user memory `project_security_posture.md`) noted CSP unsafe-inline issue was resolved in Phase 11 via nonce-based CSP. Phase 33 re-confirms this fix holds on main HEAD — not re-fixing.

**Prod server rebuild (evidence/06-rebuild.txt):** Plan 04 killed port 3000 at end of W2; Plan 06 rebuilt and restarted the prod server before curling. Build exit 0, success marker `Compiled successfully` present in log.

**Header check (evidence/06a-csp-header.txt + 06b-csp-all-routes.txt):**

Sample header on `/`:
```
<paste first Content-Security-Policy line from evidence/06a-csp-header.txt>
```

Machine checks on sample:
- [x] Content-Security-Policy header present
- [x] `nonce-<base64>` directive in script-src
- [x] `unsafe-inline` absent from script-src (prod build mode)

All 4 curl'd routes (`/`, `/signin`, `/signup`, `/pricing`) returned a CSP header (see evidence/06b-csp-all-routes.txt).

**DevTools Console check (human-verified):**

5 routes inspected in a fresh Chrome profile: `/`, `/signin`, `/signup`, `/pricing`, `/feed`.
- `evidence/06c-console-home.png` — zero violations
- `evidence/06c-console-signin.png` — zero violations
- `evidence/06c-console-signup.png` — zero violations
- `evidence/06c-console-pricing.png` — zero violations
- `evidence/06c-console-feed.png` — zero violations

**Scope note:** `/api/og/*` intentionally excluded from middleware CSP (per `apps/web/src/middleware.ts:44`, confirmed in RESEARCH.md §Audit 6 Gotcha 3). Stripe Checkout / Google OAuth surfaces are covered by Phase 38 DEP-UAT-08 in the real flow.

**Verdict:** PASS — CSP nonce-based header present on all public routes, zero violations across 5 key routes in Chrome DevTools. The 2026-03-28 fix holds.
```

Flip the checkbox:

```
- [ ] DEP-AUD-06: ...
```

→

```
- [x] DEP-AUD-06: ...
```

Verify:
```bash
grep -c '^- \[x\] DEP-AUD-06' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md   # expect 1
```
  </action>
  <verify>
    <automated>grep -q "^- \[x\] DEP-AUD-06" .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md && grep -A 3 "## §6 DEP-AUD-06" .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md | grep -q "Status:.*PASS" && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - AUDIT-REPORT.md §6 Status line is `PASS`
    - AUDIT-REPORT.md §6 mentions the 2026-03-28 audit context
    - AUDIT-REPORT.md §6 references the rebuild evidence file (evidence/06-rebuild.txt) and notes the W2-kill-then-W3-rebuild sequence
    - AUDIT-REPORT.md §6 references all 5 DevTools screenshots (06c-console-home.png through 06c-console-feed.png)
    - AUDIT-REPORT.md §6 contains a pasted CSP header sample (not placeholder)
    - AUDIT-REPORT.md §6 notes `/api/og/*` exclusion scope
    - `grep -c '^- \[x\] DEP-AUD-06' AUDIT-REPORT.md` returns 1
  </acceptance_criteria>
  <done>DEP-AUD-06 checkbox flipped, §6 shows PASS with rebuild + header + console evidence references.</done>
</task>

</tasks>

<verification>
1. `evidence/06-rebuild.txt` exists and contains `Compiled successfully` or `Ready` marker
2. `evidence/06a-csp-header.txt` contains nonce + PASS checks
3. `evidence/06b-csp-all-routes.txt` has ≥4 CSP header occurrences
4. All 5 `evidence/06c-console-*.png` files exist
5. `grep -c '^- \[x\] DEP-AUD-06' AUDIT-REPORT.md` returns 1
6. Commit evidence (rebuild + txt + png) + AUDIT-REPORT.md with `docs(033): DEP-AUD-06 CSP re-confirmed`
</verification>

<success_criteria>
- Prod server rebuilt after Plan 04's W2 port-3000 kill — rebuild log captured as evidence
- Content-Security-Policy header with nonce, no unsafe-inline in script-src
- Zero CSP violations in DevTools Console on 5 routes
- 2026-03-28 fix confirmed still holding on main HEAD
- AUDIT-REPORT.md §6 shows PASS
</success_criteria>

<output>
After completion, create `.planning/phases/033-pre-deploy-audit-gate/033-06-SUMMARY.md`
</output>
</content>
</invoke>