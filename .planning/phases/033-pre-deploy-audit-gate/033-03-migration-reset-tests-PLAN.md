---
phase: 033-pre-deploy-audit-gate
plan: 03
type: execute
wave: 1
depends_on: [033-01]
files_modified:
  - .planning/phases/033-pre-deploy-audit-gate/evidence/02a-start.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/02a-reset.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/02b-orgs.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/02b-create.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/02b-link.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/02b-push.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/02b-reset.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/02b-delete.txt
  - .planning/phases/033-pre-deploy-audit-gate/evidence/02b-teardown.png
  - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
autonomous: false
requirements: [DEP-AUD-02]

must_haves:
  truths:
    - "Local supabase start succeeds and supabase db reset on local stack applies all 28 migrations cleanly"
    - "A throwaway cloud project is provisioned, linked, reset successfully, then deleted"
    - "Teardown is confirmed visually via the Supabase dashboard (02b-teardown.png)"
    - "AUDIT-REPORT.md §2 shows PASS verdict; DEP-AUD-02 checkbox is flipped to [x]"
  artifacts:
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/02a-reset.txt"
      provides: "Local Docker Supabase reset proof (Finished supabase db reset on branch local.)"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/02b-reset.txt"
      provides: "Throwaway cloud Supabase reset proof — the GATE per D-07"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/02b-delete.txt"
      provides: "Throwaway project deletion proof"
      contains: ""
    - path: ".planning/phases/033-pre-deploy-audit-gate/evidence/02b-teardown.png"
      provides: "Screenshot of Supabase dashboard confirming project is gone"
      contains: ""
  key_links:
    - from: "supabase/migrations/*.sql"
      to: "evidence/02a-reset.txt and evidence/02b-reset.txt"
      via: "supabase db reset replays all 28 migration files"
      pattern: "Finished supabase db reset"
---

<objective>
DEP-AUD-02: prove the 28-file `supabase/migrations/` trail applies cleanly from an empty database, on BOTH local Docker Supabase AND a throwaway hosted Supabase Cloud project (D-06). This is the "independently proving Pitfall 3 (migration drift) is closed" criterion from ROADMAP §Phase 33. Per D-07, the throwaway cloud test is the BLOCKING gate — Phase 34 cannot start until it passes.

Purpose: The local stack is a fast-feedback step; the cloud stack is 1:1 with prod extensions/pg_cron behavior. Running both gives the solo developer maximum confidence on first deploy (user expressed "new to deploy, want maximum confidence" — D-06 rationale).

Output: 8 evidence files (02a-*, 02b-*) + 1 teardown screenshot + an updated AUDIT-REPORT.md §2 with PASS verdict. Throwaway cloud project is PROVISIONED AND DELETED within this plan.

**Plan is non-autonomous** — contains one `checkpoint:human-action` for the `supabase login` OAuth browser step (required once per machine) and one `checkpoint:human-verify` for the teardown screenshot. Every other step is automated.
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

<interfaces>
<!-- supabase/migrations/ trail verified 2026-04-21: 28 SQL files -->
<!-- Older: 030_purge_soft_deleted.sql -->
<!-- Newer: 20260327_*.sql through 20260418_*.sql (27 files) -->
<!-- The RESET replays ALL of them on a fresh database. -->
<!-- -->
<!-- Supabase CLI verified: pnpm dlx supabase v2.93.0 responds. -->
<!-- Docker Desktop verified in Plan 01 (evidence/00-docker.txt). -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Local Docker Supabase reset (Audit 2a)</name>
  <files>
    .planning/phases/033-pre-deploy-audit-gate/evidence/02a-start.txt
    .planning/phases/033-pre-deploy-audit-gate/evidence/02a-reset.txt
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md §Audit 2 subsection 2a (exact commands, pass criteria)
    - .planning/phases/033-pre-deploy-audit-gate/033-CONTEXT.md (D-06 — why local AND cloud, not either/or)
    - .planning/phases/033-pre-deploy-audit-gate/evidence/00-docker.txt (Plan 01 verified Docker is up)
    - supabase/config.toml (confirm local stack config — ports, extensions)
  </read_first>
  <action>
Start the local Supabase stack and run `supabase db reset` against it. This is the fast-feedback check before spending Supabase Cloud slot on the throwaway project.

**Step 1 — Confirm Docker Desktop is still running:**

```bash
docker info 2>&1 | head -1
# Expect: "Client:" or "Server Version:" line. If "error during connect" appears, start Docker Desktop and wait ~30s.
```

**Step 2 — Start the local Supabase stack:**

```bash
# From repo root. First run pulls images — 3-5 min. Subsequent runs ~30s.
pnpm dlx supabase start 2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/02a-start.txt
echo "start exit=$?" >> .planning/phases/033-pre-deploy-audit-gate/evidence/02a-start.txt
```

**Pass criterion — `02a-start.txt`:**
- `start exit=0`
- Last lines include `Started supabase local development setup.`
- If port 54322 or 54323 is busy, output says so — stop the conflicting service and retry.

**Step 3 — Run `supabase db reset` against the LOCAL stack** (no `--linked` flag = targets local):

```bash
pnpm dlx supabase db reset 2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/02a-reset.txt
echo "reset exit=$?" >> .planning/phases/033-pre-deploy-audit-gate/evidence/02a-reset.txt
```

**Pass criterion — `02a-reset.txt`:**
- `reset exit=0`
- Output contains `Finished supabase db reset on branch local.`
- `grep -cE "^ERROR|^FATAL|relation .* does not exist" evidence/02a-reset.txt` returns 0 (warnings from pg_cron scheduling are OK — grep for FATAL/ERROR specifically)

**Step 4 — Stop the local stack to free resources for Audit 7's gitleaks Docker run:**

```bash
pnpm dlx supabase stop 2>&1 | tee -a .planning/phases/033-pre-deploy-audit-gate/evidence/02a-start.txt
```

**If failing (per D-10, D-16):**

- Migration error cites a missing extension → it's a local-only issue (Audit 2b on cloud will likely pass). Fix: add `create extension if not exists <name>;` to the earliest affected migration, re-run.
- Migration cites missing column → real schema drift. Fix: hand-author a correcting migration in `supabase/migrations/YYYYMMDD_fix_<slug>.sql`, commit, re-reset.
- All fixes within ≤2h inline budget; escalate to 33.1 if >2h.
  </action>
  <verify>
    <automated>test -f .planning/phases/033-pre-deploy-audit-gate/evidence/02a-reset.txt && grep -q "reset exit=0" .planning/phases/033-pre-deploy-audit-gate/evidence/02a-reset.txt && grep -q "Finished supabase db reset" .planning/phases/033-pre-deploy-audit-gate/evidence/02a-reset.txt && [ "$(grep -cE '^ERROR|^FATAL' .planning/phases/033-pre-deploy-audit-gate/evidence/02a-reset.txt)" = "0" ] && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `evidence/02a-start.txt` exists and contains `Started supabase local development setup.`
    - `evidence/02a-start.txt` contains `start exit=0`
    - `evidence/02a-reset.txt` exists
    - `evidence/02a-reset.txt` contains `reset exit=0`
    - `evidence/02a-reset.txt` contains `Finished supabase db reset`
    - `grep -cE '^ERROR|^FATAL' evidence/02a-reset.txt` returns 0
    - `grep -c "relation .* does not exist" evidence/02a-reset.txt` returns 0
  </acceptance_criteria>
  <done>Local Docker Supabase reset applies all 28 migrations cleanly; fast-feedback signal is green before spending cloud slot.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Supabase login + captured org-id (one-time per machine)</name>
  <what-built>Nothing programmatic — this gate waits for the operator to complete `pnpm dlx supabase login` (OAuth browser flow) and write their org-id into the environment for the next task.</what-built>
  <how-to-verify>
    1. Run `pnpm dlx supabase login` — if already logged in, it prints the account email and exits 0 immediately.
    2. If not already logged in, the CLI opens a browser tab. Complete the OAuth flow.
    3. Run `pnpm dlx supabase orgs list 2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/02b-orgs.txt` and note the org ID (first column).
    4. Export it so Task 3 can pick it up: `export SUPABASE_ORG_ID="<your-org-id>"`.
  </how-to-verify>
  <resume-signal>Reply with the org-id (first 6 chars for confirmation) OR `logged in as <email>, org <id>` after completing the OAuth flow and exporting SUPABASE_ORG_ID.</resume-signal>
  <files>(checkpoint — no file written directly by this task; downstream artifacts listed in files_modified frontmatter)</files>
  <action>This is a checkpoint task. Follow the steps in `<how-to-verify>` above. The human operator performs the verification; execution pauses until the `<resume-signal>` is received.</action>
  <verify>Human replies with the signal phrase specified in `<resume-signal>`.</verify>
  <done>Operator confirms the checkpoint via the resume signal.</done>
</task>

<task type="auto">
  <name>Task 3: Throwaway cloud project — create, link, reset, teardown (Audit 2b — the GATE per D-07)</name>
  <files>
    .planning/phases/033-pre-deploy-audit-gate/evidence/02b-create.txt
    .planning/phases/033-pre-deploy-audit-gate/evidence/02b-link.txt
    .planning/phases/033-pre-deploy-audit-gate/evidence/02b-push.txt
    .planning/phases/033-pre-deploy-audit-gate/evidence/02b-reset.txt
    .planning/phases/033-pre-deploy-audit-gate/evidence/02b-delete.txt
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md §Audit 2 subsection 2b (exact sequence + Pitfall A: "db reset --linked against dev by accident")
    - .planning/phases/033-pre-deploy-audit-gate/033-CONTEXT.md (D-07 — cloud test is THE blocker)
    - .planning/phases/033-pre-deploy-audit-gate/evidence/02b-orgs.txt (Task 2 captured the org list)
    - .planning/phases/033-pre-deploy-audit-gate/033-RESEARCH.md §Common Pitfalls A (link to wrong project = data loss — mandatory `●` marker check)
  </read_first>
  <action>
This task provisions a THROWAWAY Supabase Cloud project, applies all migrations via `db push --linked`, then runs `db reset --linked` to prove the trail replays from scratch, then DELETES the throwaway project. Per D-07, this is the blocking gate.

**CRITICAL Pitfall A safety rule (per RESEARCH.md §Common Pitfalls A):** `supabase db reset --linked` drops all user-created entities in the linked project. If that link accidentally points at the dev or prod project, months of data die. Before every `--linked` command below, confirm `supabase projects list` shows the `●` marker on the throwaway ref — NOT on `digswap-dev`.

**Step 1 — Create the throwaway project:**

```bash
# SUPABASE_ORG_ID exported by Task 2
: "${SUPABASE_ORG_ID:?Must export SUPABASE_ORG_ID from Task 2}"

AUDIT_PROJECT_NAME="digswap-audit-$(date +%Y%m%d-%H%M)"
AUDIT_DB_PASSWORD=$(openssl rand -hex 16)   # or: node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

pnpm dlx supabase projects create "$AUDIT_PROJECT_NAME" \
  --org-id "$SUPABASE_ORG_ID" \
  --region us-east-1 \
  --db-password "$AUDIT_DB_PASSWORD" \
  --size nano \
  2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/02b-create.txt
echo "create exit=$?" >> .planning/phases/033-pre-deploy-audit-gate/evidence/02b-create.txt
```

**Pass:** `create exit=0`; output contains `API URL: https://<ref>.supabase.co`.

Capture the project ref:

```bash
# Grep the API URL line and extract the ref
AUDIT_PROJECT_REF=$(grep -oE 'https://[a-z0-9]+\.supabase\.co' .planning/phases/033-pre-deploy-audit-gate/evidence/02b-create.txt | head -1 | sed -E 's|https://([a-z0-9]+)\.supabase\.co|\1|')
echo "AUDIT_PROJECT_REF=$AUDIT_PROJECT_REF"
# If empty, eyeball evidence/02b-create.txt and export manually: export AUDIT_PROJECT_REF="<ref>"
```

Region rationale: `us-east-1` matches the likely prod region per ARCHITECTURE.md. Size `nano` keeps cost at $0.

**Step 2 — Link the repo to the throwaway (Pitfall A safety):**

```bash
pnpm dlx supabase link --project-ref "$AUDIT_PROJECT_REF" \
  --password "$AUDIT_DB_PASSWORD" \
  2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/02b-link.txt
echo "link exit=$?" >> .planning/phases/033-pre-deploy-audit-gate/evidence/02b-link.txt

# PARANOIA CHECK — confirm the ● marker points at the throwaway
pnpm dlx supabase projects list 2>&1 | tee -a .planning/phases/033-pre-deploy-audit-gate/evidence/02b-link.txt
pnpm dlx supabase projects list 2>&1 | grep "●" | grep -q "$AUDIT_PROJECT_REF" || {
  echo "HALT — linked project is NOT the throwaway. Do NOT proceed to reset."
  exit 1
}
```

**Step 3 — Apply migrations via `db push --linked`:**

```bash
pnpm dlx supabase db push --linked 2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/02b-push.txt
echo "push exit=$?" >> .planning/phases/033-pre-deploy-audit-gate/evidence/02b-push.txt
```

**Pass:** `push exit=0`; output contains `Finished supabase db push.`.

**Step 4 — The CORE test: `db reset --linked` against the throwaway**

```bash
# Final ● marker confirmation before the destructive command
pnpm dlx supabase projects list 2>&1 | grep "●" | grep -q "$AUDIT_PROJECT_REF" || {
  echo "HALT — ● moved. Refusing reset."
  exit 1
}

# Answer Y when prompted. `yes Y` feeds the prompt.
yes Y | pnpm dlx supabase db reset --linked 2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/02b-reset.txt
echo "reset exit=$?" >> .planning/phases/033-pre-deploy-audit-gate/evidence/02b-reset.txt
```

**Pass criterion (this is THE criterion per D-07):**
- `reset exit=0`
- Output contains `Finished supabase db reset on branch`
- `grep -cE "^ERROR|^FATAL" evidence/02b-reset.txt` returns 0

**Note on pg_cron warnings (RESEARCH.md §Audit 2 Gotcha 6):** Migrations that `SELECT cron.schedule(...)` may warn on a fresh project if the role lacks superuser — this is Pitfall #18's surface and is EXPECTED to be handled in Phase 34 via SQL Editor, not Phase 33. If `02b-reset.txt` shows cron warnings but exit=0, note them in AUDIT-REPORT.md §2 and do NOT block. Only `ERROR`/`FATAL` lines block.

**Step 5 — MANDATORY teardown:**

```bash
pnpm dlx supabase projects delete "$AUDIT_PROJECT_REF" 2>&1 | tee .planning/phases/033-pre-deploy-audit-gate/evidence/02b-delete.txt
echo "delete exit=$?" >> .planning/phases/033-pre-deploy-audit-gate/evidence/02b-delete.txt

# Post-delete: project must NOT appear in list
pnpm dlx supabase projects list 2>&1 | grep -q "$AUDIT_PROJECT_REF" && {
  echo "DELETE FAILED — $AUDIT_PROJECT_REF still appears in list. Manual cleanup required via dashboard." >> .planning/phases/033-pre-deploy-audit-gate/evidence/02b-delete.txt
} || {
  echo "DELETE CONFIRMED — $AUDIT_PROJECT_REF no longer appears." >> .planning/phases/033-pre-deploy-audit-gate/evidence/02b-delete.txt
}
```

**If failing (per D-10, D-16):**

Migration error under cloud reset that didn't surface on local:
- Cloud-specific extension gap → add `create extension if not exists <name>;` to the earliest affected migration.
- RLS policy referencing non-existent column → grep `supabase/migrations/` for the column name; find the migration that should have added it, or add a correcting migration.
- Time ≤2h inline per D-16; >2h → open decimal phase 33.1 and pause Phase 34.
  </action>
  <verify>
    <automated>test -f .planning/phases/033-pre-deploy-audit-gate/evidence/02b-create.txt && grep -q "create exit=0" .planning/phases/033-pre-deploy-audit-gate/evidence/02b-create.txt && grep -q "push exit=0" .planning/phases/033-pre-deploy-audit-gate/evidence/02b-push.txt && grep -q "reset exit=0" .planning/phases/033-pre-deploy-audit-gate/evidence/02b-reset.txt && grep -q "Finished supabase db reset" .planning/phases/033-pre-deploy-audit-gate/evidence/02b-reset.txt && [ "$(grep -cE '^ERROR|^FATAL' .planning/phases/033-pre-deploy-audit-gate/evidence/02b-reset.txt)" = "0" ] && grep -q "delete exit=0" .planning/phases/033-pre-deploy-audit-gate/evidence/02b-delete.txt && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - `evidence/02b-create.txt` contains `create exit=0` and an `API URL: https://<ref>.supabase.co` line
    - `evidence/02b-link.txt` contains `link exit=0`
    - `evidence/02b-link.txt` contains `supabase projects list` output with `●` marker on the audit project ref
    - `evidence/02b-push.txt` contains `push exit=0` and `Finished supabase db push.`
    - `evidence/02b-reset.txt` contains `reset exit=0`
    - `evidence/02b-reset.txt` contains `Finished supabase db reset`
    - `grep -cE '^ERROR|^FATAL' evidence/02b-reset.txt` returns 0
    - `evidence/02b-delete.txt` contains `delete exit=0`
    - `evidence/02b-delete.txt` contains `DELETE CONFIRMED` (the echo line after re-listing)
  </acceptance_criteria>
  <done>Throwaway cloud project provisioned, migrations applied, reset replayed cleanly, project deleted and confirmed gone. DEP-AUD-02 cloud gate passes.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Visual teardown confirmation via Supabase dashboard</name>
  <what-built>Task 3 ran `supabase projects delete` and grepped the list — but billing/cleanup safety is important enough to warrant a visual confirm.</what-built>
  <how-to-verify>
    1. Open https://supabase.com/dashboard/projects in a browser.
    2. Confirm the project named `digswap-audit-YYYYMMDD-HHMM` (from Task 3) is NOT in the list.
    3. Take a screenshot of the project list showing only your expected projects (dev, any other, NOT the audit one).
    4. Save the screenshot to `.planning/phases/033-pre-deploy-audit-gate/evidence/02b-teardown.png`.
    5. Reply `teardown confirmed`.
  </how-to-verify>
  <resume-signal>Reply `teardown confirmed` (and confirm the screenshot is saved) OR `teardown issue — <details>` if the project still appears.</resume-signal>
  <files>(checkpoint — no file written directly by this task; downstream artifacts listed in files_modified frontmatter)</files>
  <action>This is a checkpoint task. Follow the steps in `<how-to-verify>` above. The human operator performs the verification; execution pauses until the `<resume-signal>` is received.</action>
  <verify>Human replies with the signal phrase specified in `<resume-signal>`.</verify>
  <done>Operator confirms the checkpoint via the resume signal.</done>
</task>

<task type="auto">
  <name>Task 5: Populate AUDIT-REPORT.md §2</name>
  <files>
    .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
  </files>
  <read_first>
    - .planning/phases/033-pre-deploy-audit-gate/evidence/02a-reset.txt (local reset tail)
    - .planning/phases/033-pre-deploy-audit-gate/evidence/02b-reset.txt (cloud reset tail)
    - .planning/phases/033-pre-deploy-audit-gate/evidence/02b-delete.txt (teardown proof)
    - .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md (current §2 skeleton)
  </read_first>
  <action>
Replace AUDIT-REPORT.md §2 skeleton with PASS content and flip the DEP-AUD-02 checkbox.

Read the current AUDIT-REPORT.md, then replace the §2 block (from `## §2 DEP-AUD-02` up to `## §3`) with:

```markdown
## §2 DEP-AUD-02 Supabase Migration Reset

**Status:** PASS
**Timestamp:** <ISO8601 timestamp of when Tasks 1 and 3 ran>

**Local reset (Audit 2a):**
- Command: `pnpm dlx supabase db reset` (local Docker stack)
- Evidence: `evidence/02a-start.txt`, `evidence/02a-reset.txt`
- Migrations applied: 28 files from `supabase/migrations/`
- Tail excerpt:
  ```
  <paste last 5 lines of evidence/02a-reset.txt>
  ```

**Throwaway cloud reset (Audit 2b — THE gate per D-07):**
- Project: `digswap-audit-<timestamp>` (nano, us-east-1)
- Sequence: `projects create` → `link --project-ref <ref>` → `db push --linked` → `db reset --linked` → `projects delete <ref>`
- Evidence: `evidence/02b-create.txt`, `evidence/02b-link.txt`, `evidence/02b-push.txt`, `evidence/02b-reset.txt`, `evidence/02b-delete.txt`
- Teardown screenshot: `evidence/02b-teardown.png`
- Tail excerpt (reset):
  ```
  <paste last 5 lines of evidence/02b-reset.txt>
  ```

**pg_cron warnings:** (if any appeared in 02b-reset.txt, quote them here and note that Phase 34 handles cron-creating migrations via SQL Editor per Pitfall #18)

**Verdict:** PASS — the 28-migration trail applies cleanly end-to-end on both local and cloud; SYSTEMIC #0 drift is closed by Plan 01's orphan deletion + ADR-003.
```

Flip the top-of-file checklist line:

```
- [ ] DEP-AUD-02: ...
```

becomes:

```
- [x] DEP-AUD-02: ...
```

Verify:
```bash
grep -c '^- \[x\] DEP-AUD-0[12]' .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md
# Expect 2 (DEP-AUD-01 from Plan 02, DEP-AUD-02 from this plan — assuming Plan 02 ran first)
# If running before Plan 02, expect 1
```
  </action>
  <verify>
    <automated>grep -q "^- \[x\] DEP-AUD-02" .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md && grep -q "## §2 DEP-AUD-02" .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md && grep -A 5 "## §2 DEP-AUD-02" .planning/phases/033-pre-deploy-audit-gate/AUDIT-REPORT.md | grep -q "Status:.*PASS" && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - AUDIT-REPORT.md §2 `**Status:**` line is `PASS`
    - AUDIT-REPORT.md §2 mentions both "local" and "cloud" reset runs
    - AUDIT-REPORT.md §2 references `evidence/02a-reset.txt` and `evidence/02b-reset.txt`
    - AUDIT-REPORT.md §2 references `evidence/02b-teardown.png`
    - AUDIT-REPORT.md §2 contains tail excerpts from both reset commands (not placeholder `<paste...>`)
    - AUDIT-REPORT.md §2 ends with `**Verdict:** PASS ...`
    - `grep -c '^- \[x\] DEP-AUD-02' AUDIT-REPORT.md` returns 1
  </acceptance_criteria>
  <done>DEP-AUD-02 checkbox flipped, §2 fully populated with both local + cloud evidence references.</done>
</task>

</tasks>

<verification>
1. `evidence/02a-reset.txt` has `Finished supabase db reset` + exit 0
2. `evidence/02b-reset.txt` has `Finished supabase db reset` + exit 0 + zero ERROR/FATAL
3. `evidence/02b-delete.txt` has `DELETE CONFIRMED`
4. `evidence/02b-teardown.png` exists (human-verified screenshot)
5. `grep -c '^- \[x\] DEP-AUD-02' AUDIT-REPORT.md` returns 1
6. Commit all evidence + AUDIT-REPORT.md with `docs(033): DEP-AUD-02 migration reset local + cloud green`
</verification>

<success_criteria>
- Local Docker Supabase reset applies 28 migrations cleanly (fast-feedback step green)
- Throwaway cloud Supabase reset applies 28 migrations cleanly (THE gate per D-07)
- Throwaway project is DELETED and visually confirmed via dashboard screenshot
- SYSTEMIC #0 drift (Plan 01) + migration trail replays clean = Phase 34 unblocked on migration axis
- AUDIT-REPORT.md §2 shows PASS with both evidence references
</success_criteria>

<output>
After completion, create `.planning/phases/033-pre-deploy-audit-gate/033-03-SUMMARY.md`
</output>
