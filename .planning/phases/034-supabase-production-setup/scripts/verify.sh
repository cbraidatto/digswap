#!/usr/bin/env bash
# Phase 34 verify harness — orchestrates every DEP-SB-* requirement check.
# Usage:
#   PROD_REF=xxx PROD_DIRECT_URL=postgresql://... PROD_ANON_KEY=eyJ... \
#     bash .planning/phases/034-supabase-production-setup/scripts/verify.sh
set -uo pipefail

: "${PROD_REF:?PROD_REF env var required}"
: "${PROD_DIRECT_URL:?PROD_DIRECT_URL env var required (port 5432, session mode)}"
: "${PROD_ANON_KEY:?PROD_ANON_KEY env var required}"

PASS=0; FAIL=0
check() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  PASS  $name"; PASS=$((PASS+1))
  else
    echo "  FAIL  $name"; FAIL=$((FAIL+1))
  fi
}

echo "=== DEP-SB-01: separate digswap-prod project, ref distinct from dev ==="
check "supabase projects list contains digswap-prod" \
  bash -c 'supabase projects list 2>&1 | grep -q digswap-prod'
check "linked ref is NOT dev (mrkgoucqcbqjhrdjcnpw)" \
  bash -c '[ "$(cat supabase/.temp/project-ref 2>/dev/null)" != "mrkgoucqcbqjhrdjcnpw" ]'
check "linked ref equals PROD_REF" \
  bash -c '[ "$(cat supabase/.temp/project-ref 2>/dev/null)" = "$PROD_REF" ]'

echo "=== DEP-SB-02: 35+ migrations applied via supabase db push ==="
check "supabase migration list --linked has >=35 entries" \
  bash -c '[ "$(supabase migration list --linked 2>/dev/null | grep -cE "^[[:space:]]*[0-9]{14}")" -ge 35 ]'

echo "=== DEP-SB-03: RLS probe denies authenticated reads on RLS-locked tables ==="
check "rls-probe.sql returns visible_profiles=0" \
  bash -c "psql \"\$PROD_DIRECT_URL\" -At -f .planning/phases/034-supabase-production-setup/scripts/rls-probe.sql | grep -qE '^visible_profiles\\|0\$'"

echo "=== DEP-SB-04: Edge Functions invocable ==="
check "cleanup-trade-previews returns HTTP 200" \
  bash -c "curl -s -o /dev/null -w '%{http_code}' -X POST \"https://\$PROD_REF.supabase.co/functions/v1/cleanup-trade-previews\" -H \"Authorization: Bearer \$PROD_ANON_KEY\" -H 'Content-Type: application/json' -d '{\"source\":\"verify\",\"bucket\":\"trade-previews\"}' | grep -q '^200$'"
check "validate-preview returns HTTP 401 for anon" \
  bash -c "curl -s -o /dev/null -w '%{http_code}' -X POST \"https://\$PROD_REF.supabase.co/functions/v1/validate-preview\" -H 'Content-Type: application/json' -d '{}' | grep -q '^401$'"

echo "=== DEP-SB-05: >=3 active pg_cron jobs ==="
check "cron.job has >=3 active rows" \
  bash -c "[ \"\$(psql \"\$PROD_DIRECT_URL\" -At -c 'SELECT COUNT(*) FROM cron.job WHERE active = true')\" -ge 3 ]"
check "every active cron.job runs as role postgres" \
  bash -c "[ \"\$(psql \"\$PROD_DIRECT_URL\" -At -c \"SELECT COUNT(*) FROM cron.job WHERE active = true AND username <> 'postgres'\")\" = '0' ]"

echo "=== DEP-SB-06: Vault has both required secrets ==="
check "vault.decrypted_secrets contains trade_preview_project_url + trade_preview_publishable_key" \
  bash -c "[ \"\$(psql \"\$PROD_DIRECT_URL\" -At -c \"SELECT COUNT(*) FROM vault.decrypted_secrets WHERE name IN ('trade_preview_project_url','trade_preview_publishable_key')\")\" = '2' ]"

echo "=== DEP-SB-07: trade-previews bucket exists, public=false ==="
check "storage.buckets.trade-previews has public=false" \
  bash -c "[ \"\$(psql \"\$PROD_DIRECT_URL\" -At -c \"SELECT public::text FROM storage.buckets WHERE id='trade-previews'\")\" = 'false' ]"

echo "=== DEP-SB-10: DATABASE_URL template doc has all three required tokens ==="
EVIDENCE=.planning/phases/034-supabase-production-setup/evidence/14-database-url-template.txt
check "evidence/14-database-url-template.txt mentions aws-0-us-east-1.pooler.supabase.com:6543" \
  bash -c "grep -q 'aws-0-us-east-1\\.pooler\\.supabase\\.com:6543' \"\$EVIDENCE\""
check "evidence/14-database-url-template.txt mentions ?pgbouncer=true" \
  bash -c "grep -q '?pgbouncer=true' \"\$EVIDENCE\""
check "evidence/14-database-url-template.txt mentions prepare: false" \
  bash -c "grep -q 'prepare: false' \"\$EVIDENCE\""

echo
echo "=== SUMMARY: $PASS pass, $FAIL fail ==="
[ "$FAIL" -eq 0 ]
