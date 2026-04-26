# Phase 34 — Evidence 10: CORS investigation (substitutes 10-cors-dashboard.png)

**Date:** 2026-04-26
**Outcome:** Per-bucket CORS configuration **does not exist** in modern Supabase Storage. The plan's CORS task (Plan 04 T4) is N/A by construction.

## Context

CONTEXT.md D-07 specified: "CORS do bucket `trade-previews` configurado em Phase 34 com `https://digswap.com.br` + `https://www.digswap.com.br`. Origem hard-coded para o domínio real desde a criação do bucket."

The plan (Plan 04 T4) operationalized this as a Dashboard checkpoint:
> "Configure CORS on the bucket via Dashboard (the MCP scope has only storage:read, no bucket-CORS write)."

Both the decision and the task were based on RESEARCH.md §8 (CORS via dashboard or supabase storage update-bucket-cors CLI — MEDIUM confidence), which described a Supabase Storage feature that **does not exist in the version running on `digswap-prod`** (and likely never existed for hosted free-tier projects).

## Evidence: per-bucket CORS not configurable

Three probes were run to confirm:

### Probe 1: storage.buckets schema

```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'storage' AND table_name = 'buckets'
ORDER BY ordinal_position;
```

Columns returned:
```
id, name, owner, created_at, updated_at, public, avif_autodetection,
file_size_limit, allowed_mime_types, owner_id, type
```

**No CORS-related column.** The `public` boolean is the only access-control field at the row level.

### Probe 2: Schema-wide search for CORS/origin tables

```sql
SELECT table_schema, table_name FROM information_schema.tables
WHERE (table_name ILIKE '%cors%' OR table_name ILIKE '%origin%')
  AND table_schema NOT IN ('pg_catalog', 'information_schema');
```

Result: `[]` (zero tables).

### Probe 3: Project-level Storage config (mcp__supabase__get_storage_config)

```json
{
  "fileSizeLimit": 52428800,
  "features": {
    "imageTransformation": {"enabled": true},
    "s3Protocol": {"enabled": true},
    "icebergCatalog": {"enabled": true, "maxNamespaces": 10, "maxTables": 10, "maxCatalogs": 2},
    "vectorBuckets": {"enabled": true, "maxBuckets": 10, "maxIndexes": 5}
  },
  "capabilities": {"list_v2": true, "iceberg_catalog": true},
  "external": {"upstreamTarget": "canary"},
  "migrationVersion": "operation-ergonomics",
  "databasePoolMode": "recycled"
}
```

**No CORS field at the project level either.** The Storage HTTP gateway handles CORS universally and is not exposed to project-level configuration.

## Conclusion

In modern Supabase Storage:
- The Storage HTTP API (`/storage/v1/...`) is fronted by an Envoy gateway whose CORS policy is configured at the platform level (typically permissive for the API endpoints)
- **Security is enforced via:** the bucket's `public` flag (which we set to `false`) + RLS policies on `storage.objects`
- The migration `20260417_trade_preview_infrastructure.sql` created two RLS policies on `storage.objects` that gate all access to bucket `trade-previews`:
  - `trade_previews_insert_owner` — only authenticated users uploading to a folder named after their own `auth.uid()`, and only if a matching `collection_items` row owned by them exists
  - `trade_previews_select_participant` — only trade participants (requester or provider) can SELECT objects, joining through `trade_proposal_items` → `trade_proposals` → `trade_requests`

These RLS rules are **stronger** than a CORS allow-list because:
- CORS only blocks browser-originated requests; curl/server requests bypass CORS
- RLS evaluates on every request regardless of origin or transport
- The policies enforce business invariants (must own the collection item, must be a trade participant) that CORS cannot express

## D-07 satisfaction (revised)

The CONTEXT.md D-07 intent was "lock down access to the bucket so only the production domain can use it." The intent is satisfied by:

| D-07 sub-requirement              | Satisfied by                                         | Status |
|------------------------------------|-------------------------------------------------------|--------|
| Bucket private (Public=off)        | `storage.buckets.public = false` (verified via SQL)   | ✓      |
| TTL 48h                            | preview_expires_at + hourly cron + Edge Function      | ✓      |
| Origin lockdown to digswap.com.br  | **N/A — feature doesn't exist; RLS provides stronger guarantee** | ✓ (re-interpreted) |

If a future requirement specifically needs "block requests from origins other than digswap.com.br at the HTTP level" (e.g., to prevent scraping of signed URLs leaked via Referer), that would have to be implemented at:
- Vercel Edge Middleware (Phase 35) — check `Origin` header on routes that proxy Storage
- Cloudflare/Vercel edge rules (Phase 36) — block based on Referer/Origin

This is post-MVP work; deferred until a real attack vector emerges.

## D-08 unaffected

D-08 ("Bucket permanece Public=off, TTL via Storage lifecycle rule per Pitfall #20") still satisfied. Note CONTEXT.md D-08 also referenced "Storage lifecycle rule" which **also doesn't exist** as a configurable feature — the 48h TTL is the 3-piece mechanism (preview_expires_at column + cron + Edge Function), as documented in evidence/00-path-deviation.md.

## Task disposition

Plan 04 Task 4 (CORS Dashboard config) → **resolved as N/A**. No screenshot needed; this evidence file replaces `10-cors-dashboard.png` in the inventory.
