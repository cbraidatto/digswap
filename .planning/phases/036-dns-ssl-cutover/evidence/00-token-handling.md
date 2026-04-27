# Hostinger API Token — Handling Log

**Date:** 2026-04-27
**Phase:** 036-dns-ssl-cutover Plan 00 Task 0.1 (checkpoint:human-action)
**Pattern (per CONTEXT.md D-19):** `printf '%s' '<token>' > ~/.hostinger-token` (ASCII, no BOM, no trailing newline)

## Placement
- File path: `~/.hostinger-token` (gitignored — same handling pattern as Phase 35 `~/.vercel-token`)
- File metadata: `wc -c` reports 48 bytes; `file` reports `ASCII text, with no line terminators`
- Token bytes, prefix, and length-as-fingerprint are NOT recorded here

## Verification (`GET /api/dns/v1/zones/digswap.com.br`)
- Header: `Authorization: Bearer $(cat ~/.hostinger-token)`
- HTTP code: **200**
- Response shape: JSON array of `{name, records[], ttl, type}` objects (top-level array — NOT wrapped in `{zone: [...]}`)
- Token authorizes DNS read against the target zone

## Out-of-band notes
- Hostinger MCP (`hostinger-api-mcp@latest`) registered at user scope (`claude mcp add hostinger ...`) but tools require Claude Code session restart to load — Phase 36 proceeds with `curl` per plan (token-on-disk path). MCP becomes available for Phase 37+ in fresh sessions.
- POST-PHASE-36 TODO: rotate Hostinger API token before public announcement (token disclosed in chat during Wave 0 setup; same handling as Phase 35 Vercel token leak — accepted risk during invite-only soak).

## Halt-on-fail status
- 3-attempt threshold not exceeded (1st GET succeeded immediately → HTTP 200).

## D-19 compliance
- printf `%s` (no `\n`) ✓
- Single-quoted argument (no shell expansion) ✓
- Bash on Windows (git-bash) — NOT PowerShell 5.1 (avoids UTF-16 LE BOM problem documented in Phase 35 evidence/00).
