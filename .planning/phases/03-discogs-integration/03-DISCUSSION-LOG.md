# Phase 3: Discogs Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 03-discogs-integration
**Areas discussed:** OAuth connect placement, Import progress UX, Partial data during import, Sync + disconnect behavior

---

## OAuth Connect Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Onboarding only | Activate the existing disabled button in the onboarding wizard. Users who skipped can connect later from Settings. | ✓ |
| Settings + re-surface in Perfil | Settings page gets a dedicated Discogs section; Perfil tab also shows a CTA if not connected. | |
| Settings only | Skip activating the onboarding step — users connect from Settings after onboarding. | |

**User's choice:** Onboarding only (primary entry point) + Settings (secondary for users who skipped)
**Notes:** Both locations confirmed — onboarding activates the existing placeholder, Settings provides the persistent management surface.

---

## Post-OAuth Landing

| Option | Description | Selected |
|--------|-------------|----------|
| Trigger import immediately, go to import progress screen | OAuth success → import starts automatically → user sees progress. | ✓ |
| Confirmation screen first, then user manually triggers import | OAuth success → confirmation screen → "Start Import" button. | |
| Return to where they came from, import runs silently | OAuth success → back to previous screen → notification when done. | |

**User's choice:** Trigger import immediately, navigate to progress screen.
**Notes:** Zero extra taps — OAuth completes and import starts right away.

---

## Import Progress UX

| Option | Description | Selected |
|--------|-------------|----------|
| Real-time progress bar + live count | Supabase Realtime shows "342 / 1,247 records" updating live. | ✓ |
| Polling-based count, refresh every 5s | Counter updates every 5 seconds. | |
| Indeterminate spinner + "we'll notify you" | No count shown. | |

**User's choice:** Real-time via Supabase Realtime.

---

## Import Screen Detail

| Option | Description | Selected |
|--------|-------------|----------|
| Count + current record being imported | Shows "Currently importing: Kind of Blue — Miles Davis" | ✓ |
| Count + ETA only | Shows estimated time remaining | |
| Progress bar + count only | Minimal display | |

**User's choice:** Count + current record name. Feels alive and personal.

---

## Import Completion

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-navigate to Perfil tab | 2s success state → auto-redirect to /perfil | ✓ |
| Stay on progress screen with "View Collection" CTA | Manual navigation after success | |
| Show a success toast + return to onboarding | For onboarding context | |

**User's choice:** Auto-navigate to Perfil after 2-second success state.

---

## Partial Data During Import

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — collection shows partial results as they arrive | Records appear in Perfil as imported. Sticky banner shows progress. | ✓ |
| No — Perfil shows "Import in progress" state until complete | Collection locked during import. | |
| Yes, but wantlist waits until collection finishes | Collection streams live; wantlist import deferred. | |

**User's choice:** Live streaming into Perfil. Users can browse immediately.

---

## Import Progress Banner

| Option | Description | Selected |
|--------|-------------|----------|
| Sticky banner at top of Perfil: "Importing… 342/1,247" | Non-intrusive persistent bar. Tap to go to full progress screen. | ✓ |
| Small badge on the Perfil bottom tab icon | Pulsing dot/count badge on nav tab. | |
| You decide | Claude picks the detail. | |

**User's choice:** Sticky banner in Perfil, tappable to full progress screen.

---

## Manual Re-Sync Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Delta sync — only fetch records added/changed since last sync | Stores last_synced_at, only fetches newer items. Fast for regular users. | ✓ |
| Full re-import every time | Always fetch all records. Simple but slow for large collections. | |
| Smart sync — check collection count first | Complex heuristic. | |

**User's choice:** Delta sync. Full re-import available as secondary "Reset and re-import" action.

---

## Sync Button Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Settings page — Discogs section, with last synced timestamp | Primary sync trigger in Settings. Button shows "Syncing…" during sync. | ✓ |
| Perfil tab header — sync icon next to collection count | More discoverable, less authoritative. | |
| Both Settings and Perfil | Two entry points. | |

**User's choice:** Settings page only. Same sticky banner appears in Perfil during sync.

---

## Disconnect Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Hard delete immediately — all imported records removed | collectionItems + wantlistItems deleted; releases table kept (shared). | ✓ |
| Soft delete — data hidden, permanently deleted after 30 days | More forgiving, more complex. | |
| Prompt the user: keep data or delete? | Maximum control, more screens. | |

**User's choice:** Hard delete. Matches DISC-06 requirement explicitly. Single confirmation dialog before executing.

---

## Claude's Discretion

- OAuth 1.0a token exchange implementation details
- Rate limit backoff strategy
- pg_cron scheduling and Edge Function chunking
- Import job state schema for Realtime progress
- Error handling for mid-import failures
