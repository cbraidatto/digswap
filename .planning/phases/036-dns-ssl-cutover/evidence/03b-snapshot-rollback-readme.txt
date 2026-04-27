# Snapshot list - captured at 2026-04-27T15:35:58Z
HTTP code: 200
Body bytes: 2
Body content: []

Interpretation:
  HTTP 200 + body '[]' = endpoint live, zero existing snapshots. Hostinger auto-creates a snapshot on the FIRST mutating PUT (per RESEARCH §Open Questions #1).
  Wave 2 first PUT will generate snapshot[0]; subsequent rollback restores via that ID.

Wave 2 rollback uses: POST /api/dns/v1/snapshots/digswap.com.br/{snapshotId}/restore
  snapshotId is parsed from a fresh GET /api/dns/v1/snapshots/digswap.com.br call AFTER the Wave 2 PUT (response shape: array of {id, snapshot_at, ...} per Hostinger API docs)
