---
phase: 033-pre-deploy-audit-gate
plan: 04
type: execute
wave: 2
depends_on: [033-01, 033-02]
files_modified:
  - .planning/phases/033-pre-deploy-audit-gate/evidence/03-build.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/03-server-stderr.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/04-session-revocation.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/04-protected-endpoint.txt
  - apps/web/tests/e2e/audit/session-revocation.audit.spec.ts
  - apps/web/src/app/api/user/me/route.ts
  - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
autonomous: false
requirements: [DEP-AUD-03, DEP-AUD-04]

must_haves:
  truths:
    - "Prod-built Next server returns 200 on /, /signin, /signup, /pricing after 15-min idle (per D-08)"
    - "No server-side exceptions in stderr during the curl loop"
    - "Logged-out JWT returns 401 on protected /api route within 60s of logout"
    - "Playwright spec executed end-to-end against running pnpm start"
    - "AUDIT-REPORT.md §3 and §4 both flipped to PASS"
  artifacts:
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt"
      provides: "4-route curl matrix with HTTP code + time_total"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/04-session-revocation.txt"
      provides: "Playwright audit spec output showing pre/post-logout status codes + elapsed ms"
      contains: ""
    - path: "apps/web/tests/e2e/audit/session-revocation.audit.spec.ts"
      provides: "Updated spec with concrete protected endpoint constant"
      contains: "logged-out JWT is rejected"
  key_links:
    - from: "apps/web/tests/e2e/audit/session-revocation.audit.spec.ts"
      to: "apps/web/src/lib/supabase/middleware.ts"
      via: "Spec validates the session allowlist revocation path"
      pattern: "session-revocation"
---

<objective>
DEP-AUD-03 (cold-start, LOCAL ONLY per D-08/D-09) and DEP-AUD-04 (session revocation E2E) both need the prod-built Next.js server running on localhost:3000. Co-locating them in one plan avoids spinning up/tearing down the server twice.

Purpose:
- DEP-AUD-03 proves the 35ed595 cold-start claim holds on the local code path — 4 public routes return 200 in <3s after a 15-min idle.
- DEP-AUD-04 proves session revocation actually revokes — a logged-out JWT returns 401 on a protected API route within 60s.

Output: 5 evidence files, an updated Playwright spec with a concrete protected endpoint, and AUDIT-REPORT.md §§3–4 flipped to PASS.

**Plan is non-autonomous** — the 15-min idle is a manual `checkpoint:human-action` (no practical automation per 033-VALIDATION.md).
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
@apps/web/tests/e2e/audit/session-revocation.audit.spec.ts
@apps/web/src/middleware.ts
@apps/web/src/lib/supabase/middleware.ts

<interfaces>
<!-- Middleware bypass list (per 033-RESEARCH.md §Audit 4 Gotcha 1) — pick an endpoint NOT in this set: -->
<!--   bypassed: /api/stripe/, /api/og/, /api/discogs/import, /api/desktop/ -->
<!-- Existing apps/web/src/app/api/ structure: auth/, desktop/, discogs/, health/, og/, stripe/, trade-preview/ -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pick protected /api endpoint for revocation spec; update spec file</name>
  <files>
    .planning/phases/033-pre-deploy-audit-gate/evidence/04-protected-endpoint.txt
    apps/web/tests/e2e/audit/session-revocation.audit.spec.ts
    apps/web/src/app/api/user/me/route.ts
  </files>
  <read_first>
    - apps/web/tests/e2e/audit/session-revocation.audit.spec.ts (current scaffold from Plan 01)
    - apps/web/src/middleware.ts (bypass list)
    - apps/web/src/lib/supabase/middleware.ts (session allowlist check logic)
    - .planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md §Audit 4 Gotcha 1 and §Open Questions 1
  </read_first>
  <action>
Pick a concrete protected API endpoint and embed it in the spec so Task 3 runs against a real route.

**Step 1 — Enumerate candidate protected routes:**

```bash
grep -rE "^export async function (GET|POST)" apps/web/src/app/api/ --include="route.ts" \
  > .planning/phases/033-pre-deploy-audit-gate/evidence/04-protected-endpoint.txt
echo "---" >> .planning/phases/033-pre-deploy-audit-gate/evidence/04-protected-endpoint.txt

grep -rl "createClient\|supabase\.auth\.getUser\|supabase\.auth\.getClaims" apps/web/src/app/api/ --include="route.ts" \
  >> .planning/phases/033-pre-deploy-audit-gate/evidence/04-protected-endpoint.txt
echo "---" >> .planning/phases/033-pre-deploy-audit-gate/evidence/04-protected-endpoint.txt

grep -E "bypass|skip|!?\.startsWith" apps/web/src/middleware.ts | head -20 \
  >> .planning/phases/033-pre-deploy-audit-gate/evidence/04-protected-endpoint.txt
```

**Step 2 — Pick by deterministic rule:**

From the `createClient`-calling routes, pick the FIRST GET route that:
- Is NOT under `/api/stripe/`, `/api/og/`, `/api/discogs/import`, or `/api/desktop/`
- Returns user-scoped data (401 is the expected post-logout response)

If no obvious candidate exists, **create** `/api/user/me` — canonical recommendation per RESEARCH.md Open Question 1.

Append the chosen endpoint to the evidence file:

```bash
CHOSEN_ENDPOINT="/api/<picked-route>"
echo "CHOSEN: $CHOSEN_ENDPOINT" >> .planning/phases/033-pre-deploy-audit-gate/evidence/04-protected-endpoint.txt
```

**Step 3 — If `/api/user/me` does not exist, create it:**

Create `apps/web/src/app/api/user/me/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ id: user.id, email: user.email });
}
```

Confirm `@/lib/supabase/server` is the correct import path by grepping existing `apps/web/src/app/api/` imports. If the route already exists (an `/api/<x>` is already in the createClient list), skip this step and use that route in Step 2.

**Step 4 — Update the Playwright spec constant:**

Open `apps/web/tests/e2e/audit/session-revocation.audit.spec.ts`. Replace:

```typescript
const PROTECTED_ENDPOINT = process.env.AUDIT_PROTECTED_ENDPOINT ?? "http://localhost:3000/api/user/me";
```

With the concrete URL:

```typescript
// Picked in Plan 04 Task 1: this endpoint calls createClient() and returns 401 without a valid session.
const PROTECTED_ENDPOINT = "http://localhost:3000<CHOSEN_ENDPOINT>";
```

**Step 5 — Verify the spec still compiles:**

```bash
cd apps/web && npx tsc --noEmit tests/e2e/audit/session-revocation.audit.spec.ts 2>&1 | head -10
```
  </action>
  <verify>
    <automated>test -f .planning/phases/033-pre-deploy-audit-gate/evidence/04-protected-endpoint.txt && grep -q "^CHOSEN: " .planning/phases/033-pre-deploy-audit-gate/evidence/04-protected-endpoint.txt && grep -q "PROTECTED_ENDPOINT" apps/web/tests/e2e/audit/session-revocation.audit.spec.ts && ! grep -q "AUDIT_PROTECTED_ENDPOINT ?? " apps/web/tests/e2e/audit/session-revocation.audit.spec.ts && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `evidence/04-protected-endpoint.txt` exists and contains a `CHOSEN: /api/...` line
    - The spec file no longer contains the `process.env.AUDIT_PROTECTED_ENDPOINT ?? "..."` fallback
    - The spec file contains `http://localhost:3000/api/` (concrete URL hardcoded)
    - If `/api/user/me/route.ts` was created, it contains both `createClient` and `status: 401` literals
    - `cd apps/web && npx tsc --noEmit tests/e2e/audit/session-revocation.audit.spec.ts 2>&1 | grep -c "error TS"` returns 0 (or only errors unrelated to our spec)
  </acceptance_criteria>
  <done>Spec references a concrete, grep-verified protected endpoint.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Human operator — 15-minute idle period for cold-start simulation</name>
  <what-built>No code. This gate enforces the 15-min idle per D-08. Before the gate: operator MUST have run `pnpm --filter @digswap/web build` (captured in evidence/03-build.txt) and started `pnpm --filter @digswap/web start` in a separate terminal.</what-built>
  <how-to-verify>
    1. Run: `pnpm --filter @digswap/web build 2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/03-build.txt`. Expect exit 0 and `Generating static pages`.
    2. In a SEPARATE terminal: `pnpm --filter @digswap/web start 2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/03-server-stderr.txt`. Wait for `Ready` / `started server on 0.0.0.0:3000`.
    3. Ping once: `curl -sI http://localhost:3000/ | head -1` — expect `HTTP/1.1 200` or `HTTP/1.1 307`.
    4. Note start time (`date -u`). Set a 15-minute timer.
    5. Do NOT touch the server during the idle period (no other curl, no browser).
    6. After 15 min elapse, reply `idled 15+ minutes`.
  </how-to-verify>
  <resume-signal>Reply `idled 15+ minutes; server on :3000 ready` OR `crashed: <log excerpt>` if the server crashed during idle.</resume-signal>
  <files>(checkpoint — no file written directly by this task; downstream artifacts listed in files_modified frontmatter)</files>
  <action>This is a checkpoint task. Follow the steps in `<how-to-verify>` above. The human operator performs the verification; execution pauses until the `<resume-signal>` is received.</action>
  <verify>Human replies with the signal phrase specified in `<resume-signal>`.</verify>
  <done>Operator confirms the checkpoint via the resume signal.</done>
</task>

<task type="auto">
  <name>Task 3: Execute cold-start curl loop (DEP-AUD-03) + Playwright session revocation spec (DEP-AUD-04)</name>
  <files>
    .planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt
    .planning/phases/033-pre-deploy-audit-gate/evidence/04-session-revocation.txt
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md §Audit 3 + §Audit 4
    - apps/web/tests/e2e/audit/session-revocation.audit.spec.ts (updated in Task 1)
    - .planning/phases/033-pre-deploy-audit-gate/evidence/04-protected-endpoint.txt (chosen endpoint)
  </read_first>
  <action>
**Step 1 — DEP-AUD-03 cold-start curl loop** (server running from Task 2):

```bash
echo "curl loop started at: $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  > .planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt

for path in / /signin /signup /pricing; do
  echo "=== $path ===" >> .planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt
  curl -o /dev/null -w "HTTP %{http_code}  time_total=%{time_total}s  time_starttransfer=%{time_starttransfer}s\n" \
       "http://localhost:3000${path}" \
       2>&1 | tee -a .planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt
  echo "--- headers ---" >> .planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt
  curl -sI "http://localhost:3000${path}" | head -10 \
       >> .planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt
done

echo "curl loop ended at: $(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  >> .planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt
```

**Pass criterion:** Every route returns `HTTP 200`, every `time_total` < 3.0s, no exceptions in `evidence/03-server-stderr.txt` during the curl window.

```bash
grep -c "HTTP 200" .planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt   # expect 4
awk '/time_total=/ { match($0, /time_total=([0-9.]+)s/, m); if (m[1]+0 > 3.0) print "FAIL:", $0 }' \
  .planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt   # expect no output
grep -E "Error:|TypeError|UnhandledRejection" .planning/phases/033-pre-deploy-audit-gate/evidence/03-server-stderr.txt | head -5   # expect no output
```

**If failing (per D-10):** Fix likely in `apps/web/src/lib/supabase/middleware.ts:45-47` or the pricing page. Wrap getUser() in try/catch, treat failure as anonymous. ≤60 min inline per D-16.

**Step 2 — Prerequisite for DEP-AUD-04: audit user must exist:**

```bash
# Create via Supabase dashboard (Auth → Users → Add user) on the DEV project:
#   email: audit+33@digswap.test
#   password: <your-choice — do NOT commit>
export AUDIT_USER_EMAIL="audit+33@digswap.test"
export AUDIT_USER_PASSWORD="<the password you set>"
```

If user already exists from prior runs, use existing password.

**Step 3 — DEP-AUD-04 Playwright session revocation:**

```bash
pnpm --filter @digswap/web exec playwright test audit/session-revocation.audit.spec.ts \
  --reporter=list \
  2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/04-session-revocation.txt
echo "playwright exit=$?" >> .planning/phases/033-pre-deploy-audit-gate/evidence/04-session-revocation.txt
```

**Pass criterion:**
- `playwright exit=0`
- `[audit] pre-logout status: <2xx>`
- `[audit] post-logout status: 401 after <N>ms` where `N < 60000`

**If failing (per D-10, D-16):**
- `pre-logout status: 401` — wrong endpoint chosen; revisit Task 1 Step 2.
- `post-logout status: 200` — Pitfall #10 live; inspect `apps/web/src/lib/supabase/middleware.ts` lines 82-123. ≤2h inline per D-16.

**Step 4 — Tear down the prod server:**

```bash
lsof -ti:3000 | xargs -r kill   # Git Bash
curl -sI http://localhost:3000/ 2>&1 | head -1   # Expect connection refused
```
  </action>
  <verify>
    <automated>test -f .planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt && [ "$(grep -c 'HTTP 200' .planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt)" = "4" ] && grep -q "playwright exit=0" .planning/phases/033-pre-deploy-audit-gate/evidence/04-session-revocation.txt && grep -q "post-logout status: 401" .planning/phases/033-pre-deploy-audit-gate/evidence/04-session-revocation.txt && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `evidence/03-coldstart.txt` contains `HTTP 200` exactly 4 times
    - `evidence/03-coldstart.txt` has all 4 `time_total=` values under 3.0s (awk check returns empty)
    - `evidence/03-coldstart.txt` tests all 4 routes: `/`, `/signin`, `/signup`, `/pricing`
    - `evidence/03-server-stderr.txt` does not contain `Error:`, `TypeError`, or `UnhandledRejection` from curl window
    - `evidence/04-session-revocation.txt` contains `playwright exit=0`
    - `evidence/04-session-revocation.txt` contains `pre-logout status:` followed by a 2xx code
    - `evidence/04-session-revocation.txt` contains `post-logout status: 401`
    - Post-logout elapsed time is under 60000ms
  </acceptance_criteria>
  <done>Cold-start and session revocation both verified; server torn down.</done>
</task>

<task type="auto">
  <name>Task 4: Populate AUDIT-REPORT.md §3 and §4; flip both checkboxes</name>
  <files>
    .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/evidence/03-coldstart.txt
    - .planning/phases/033-pre-deploy-audit-gate/evidence/04-session-revocation.txt
    - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md (current §3/§4 skeletons)
  </read_first>
  <action>
Replace the §3 and §4 skeletons with PASS content, flip both checkboxes.

**§3 replacement block** (write between the `## §3` heading and the `## §4` heading):

```markdown
## §3 DEP-AUD-03 Cold-Start Public Routes (LOCAL ONLY per D-08)

**Status:** PASS
**Timestamp:** <idle-start → curl-end range from evidence/03-coldstart.txt>

**Scope note (D-09):** Local proof only. Real Vercel cold-start validation is deferred to Phase 38 (DEP-UAT-03).

**Sequence:** build → start → 15-min idle → 4-route curl loop.

**Results:**

| Route | HTTP | time_total | time_starttransfer |
|-------|------|-----------|--------------------|
| / | 200 | <paste> | <paste> |
| /signin | 200 | <paste> | <paste> |
| /signup | 200 | <paste> | <paste> |
| /pricing | 200 | <paste> | <paste> |

**Server stderr during curl window:** zero exception lines.

**Verdict:** PASS — all 4 public routes return 200 in <3s after 15-min idle.
```

**§4 replacement block:**

```markdown
## §4 DEP-AUD-04 Session Revocation E2E

**Status:** PASS
**Timestamp:** <Playwright run ISO timestamp>

**Endpoint under test:** `<CHOSEN endpoint from evidence/04-protected-endpoint.txt>`
**Test file:** `apps/web/tests/e2e/audit/session-revocation.audit.spec.ts`
**Command:** `pnpm --filter @digswap/web exec playwright test audit/session-revocation.audit.spec.ts`

**Log excerpts:**
```
[audit] pre-logout status: <paste actual value>
[audit] post-logout status: 401 after <paste>ms
```

**Verdict:** PASS — logged-out JWT returned 401 within the 60000ms bound.
```

Flip the checklist lines:
- `- [ ] DEP-AUD-03: ...` → `- [x] DEP-AUD-03: ...`
- `- [ ] DEP-AUD-04: ...` → `- [x] DEP-AUD-04: ...`

Verify:
```bash
grep -c '^- \[x\] DEP-AUD-0[34]' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
# Expect 2
```
  </action>
  <verify>
    <automated>grep -q "^- \[x\] DEP-AUD-03" .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md && grep -q "^- \[x\] DEP-AUD-04" .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md && grep -A 3 "## §3 DEP-AUD-03" .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md | grep -q "Status:.*PASS" && grep -A 3 "## §4 DEP-AUD-04" .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md | grep -q "Status:.*PASS" && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - AUDIT-REPORT.md §3 Status line is PASS
    - AUDIT-REPORT.md §3 contains a results table with 4 routes, all HTTP 200
    - AUDIT-REPORT.md §3 references evidence/03-coldstart.txt
    - AUDIT-REPORT.md §4 Status line is PASS
    - AUDIT-REPORT.md §4 references the Playwright spec file path
    - AUDIT-REPORT.md §4 contains actual log excerpts (not placeholder `<paste...>`)
    - `grep -c '^- \[x\] DEP-AUD-03' AUDIT-REPORT.md` returns 1
    - `grep -c '^- \[x\] DEP-AUD-04' AUDIT-REPORT.md` returns 1
  </acceptance_criteria>
  <done>§3 and §4 fully populated, DEP-AUD-03 and DEP-AUD-04 checkboxes flipped.</done>
</task>

</tasks>

<verification>
1. `grep -c 'HTTP 200' evidence/03-coldstart.txt` returns 4
2. All `time_total` values in `evidence/03-coldstart.txt` < 3.0s
3. `grep -q 'post-logout status: 401' evidence/04-session-revocation.txt` passes
4. `grep -c '^- \[x\] DEP-AUD-0[34]' AUDIT-REPORT.md` returns 2
5. Commit evidence + AUDIT-REPORT.md + any `/api/user/me/route.ts` addition with message `docs(033): DEP-AUD-03 + DEP-AUD-04 cold-start + session revocation green`
</verification>

<success_criteria>
- 4 public routes serve 200 in <3s after 15-min idle (local proof of 35ed595 fix)
- Logged-out JWT is rejected with 401 on protected API route within 60s
- Playwright audit spec is wired to a concrete endpoint and runs green
- AUDIT-REPORT.md §3 and §4 show PASS
</success_criteria>

<output>
After completion, create `.planning/phases/033-pre-deploy-audit-gate/033-04-SUMMARY.md`
</output>
