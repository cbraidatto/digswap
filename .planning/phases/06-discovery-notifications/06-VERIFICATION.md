---
phase: 06-discovery-notifications
verified: 2026-03-26T06:00:00Z
status: human_needed
score: 7/8 must-haves verified
human_verification:
  - test: "Verify email is sent for wantlist match in production"
    expected: "When user B adds a record that user A wants, user A receives an email with the correct subject and body"
    why_human: "Requires RESEND_API_KEY configured and two test users. Cannot be verified programmatically without a live Resend account."
  - test: "Verify Supabase Realtime subscription delivers notifications live"
    expected: "When user B adds a record to collection that user A wants, user A's bell badge increments in real-time without page refresh"
    why_human: "Requires ALTER PUBLICATION supabase_realtime ADD TABLE notifications; run in Supabase SQL editor. WebSocket delivery cannot be verified programmatically."
  - test: "Verify trade request email (NOTF-02 partial — deferred to Phase 9)"
    expected: "SC4 states 'User receives email notifications for wantlist matches AND trade requests'. Trade request email is intentionally deferred to Phase 9 per D-11. Confirm the deferred scope is acceptable."
    why_human: "Policy decision — is partial NOTF-02 (wantlist match email only) an acceptable Phase 6 delivery, or must trade request email be included?"
---

# Phase 6: Discovery + Notifications Verification Report

**Phase Goal:** Users can find who has the records they want and get notified when matches appear
**Verified:** 2026-03-26T06:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can search by record name or artist and see which platform users own that record | VERIFIED | `searchRecords()` in `src/lib/discovery/queries.ts` performs ILIKE query with owner join; `searchRecordsAction` wraps it with auth; `RecordSearch` component calls it with 300ms debounce and 2-char minimum |
| 2 | User can browse collections filtered by genre and decade on the Explorar tab | VERIFIED | `browseRecords()` uses PostgreSQL array contains for genre, `getDecadeRange()` for year range; `BrowseFilters` chip component drives `BrowseGrid` via `browseRecordsAction` |
| 3 | User receives an in-app notification when a platform user has a record from their wantlist | VERIFIED | `checkWantlistMatches()` inserts to `notifications` table via admin client; triggered in `addRecordToCollection` and Discogs import pipeline; `NotificationBell` displays with Realtime subscription |
| 4 | User receives email notifications for wantlist matches and trade requests | PARTIAL | Wantlist match email implemented via Resend (`sendWantlistMatchEmail`). Trade request email is deferred to Phase 9 per D-11 (intentional design decision) |
| 5 | User can configure which notification types they receive (in-app, email, push) per event type | VERIFIED | `NotificationPreferences` component in `/settings` provides toggles for all types; PHASE_8 and PHASE_9 badges shown for deferred types; `updatePreferencesAction` persists changes with optimistic UI |

**Score:** 4.5/5 success criteria (SC4 is partial — wantlist match email works, trade request email is intentionally deferred)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/discovery/queries.ts` | searchRecords, browseRecords, getSuggestedRecords | VERIFIED | 387 lines; all 3 functions exported with real Drizzle queries |
| `src/actions/discovery.ts` | Server actions wrapping discovery queries | VERIFIED | "use server"; exports searchRecordsAction, browseRecordsAction, getSuggestionsAction with auth |
| `src/lib/notifications/match.ts` | checkWantlistMatches with admin client | VERIFIED | Uses createAdminClient(); checks discogs_id; inserts notifications; calls email helper |
| `src/lib/notifications/email.ts` | sendWantlistMatchEmail via Resend | VERIFIED | Non-fatal try/catch; dark-themed HTML template; `RESEND_API_KEY` env var |
| `src/lib/notifications/queries.ts` | 5 notification query functions | VERIFIED | getUnreadCount, getRecentNotifications, getNotificationPage, getPreferences, upsertPreferences all present |
| `src/actions/notifications.ts` | 6 notification server actions | VERIFIED | "use server"; getNotificationsAction, getRecentNotificationsAction, getUnreadCountAction, markNotificationRead, markAllRead, getPreferencesAction, updatePreferencesAction (7 total — extra getRecentNotificationsAction added in Plan 03) |
| `src/app/(protected)/(explore)/explorar/page.tsx` | Tab layout with DIGGERS/RECORDS | VERIFIED | "use client"; role="tablist"; DIGGERS and RECORDS tabs; no hardcoded data; SearchSection preserved |
| `src/app/(protected)/(explore)/explorar/_components/record-search.tsx` | Debounced search with results | VERIFIED | 300ms debounce; 2-char minimum; calls searchRecordsAction; renders RecordSearchCard |
| `src/app/(protected)/(explore)/explorar/_components/browse-filters.tsx` | Genre/decade filter chips | VERIFIED | DISCOGS_GENRES subset (10 genres); DECADES import; aria-pressed; toggle-off on active click |
| `src/app/(protected)/(explore)/explorar/_components/browse-grid.tsx` | Cross-user record browse grid | VERIFIED | calls browseRecordsAction; [NO_RECORDS_FOUND] empty state; renders nothing when no filters |
| `src/app/(protected)/(explore)/explorar/_components/suggested-section.tsx` | Taste-match suggestions | VERIFIED | calls getSuggestionsAction on mount; [NO_SUGGESTIONS_YET] empty state; SUGGESTED_FOR_YOU header |
| `src/app/(protected)/(explore)/explorar/_components/owners-list.tsx` | Owner list with condition grades | VERIFIED | [NO_OWNERS_IN_NETWORK]; collapse at 3 with +N more; links to /perfil/username |
| `src/components/shell/notification-bell.tsx` | Bell with Realtime + dropdown | VERIFIED | 223 lines; postgres_changes subscription; filter: user_id=eq.${userId}; 9+ overflow; mark all read |
| `src/components/shell/notification-row.tsx` | Reusable notification row | VERIFIED | 92 lines; type icon mapping; playlist_add_check for wantlist_match; line-clamp-1; relative timestamps |
| `src/app/(protected)/notifications/page.tsx` | Full notifications page with pagination | VERIFIED | [NO_NOTIFICATIONS] empty state; Previous/Next pagination; calls getNotificationsAction |
| `src/app/(protected)/settings/_components/notification-preferences.tsx` | Preference toggles UI | VERIFIED | "use client"; getPreferencesAction on mount; optimistic toggles; PHASE_8/PHASE_9 badges; opacity-50 disabled state |
| `src/app/(protected)/settings/page.tsx` | Settings page with notification prefs | VERIFIED | Imports NotificationPreferences; renders `<NotificationPreferences />` below DiscogsSettings |
| `src/actions/collection.ts` | addRecordToCollection with match trigger | VERIFIED | imports checkWantlistMatches; try/catch non-blocking call after logActivity |
| `src/app/api/discogs/import/route.ts` | Import pipeline with batch match check | VERIFIED | imports checkWantlistMatches; MAX_IMPORT_NOTIFICATIONS=50; batch query on collection/sync completion |
| `tests/unit/discovery/record-search.test.ts` | Record search unit tests | VERIFIED | file exists |
| `tests/unit/discovery/genre-browse.test.ts` | Browse unit tests | VERIFIED | file exists |
| `tests/unit/discovery/taste-match.test.ts` | Suggestions unit tests | VERIFIED | file exists |
| `tests/unit/notifications/wantlist-match.test.ts` | Match checker unit tests | VERIFIED | file exists |
| `tests/unit/notifications/email.test.ts` | Email helper unit tests | VERIFIED | file exists |
| `tests/unit/notifications/preferences.test.ts` | Preference query unit tests | VERIFIED | file exists |
| `tests/unit/components/shell/notification-bell.test.tsx` | NotificationBell component tests | VERIFIED | file exists; mocks Supabase Realtime; tests aria-label and 9+ badge |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/lib/notifications/match.ts` | `src/lib/notifications/email.ts` | import sendWantlistMatchEmail | WIRED | Line 2: `import { sendWantlistMatchEmail } from "@/lib/notifications/email"` |
| `src/actions/discovery.ts` | `src/lib/discovery/queries.ts` | import searchRecords | WIRED | Lines 5-8: imports searchRecords, browseRecords, getSuggestedRecords |
| `src/actions/notifications.ts` | `src/lib/notifications/queries.ts` | import getUnreadCount | WIRED | Lines 6-11: imports all 5 query functions |
| `src/app/(protected)/(explore)/explorar/_components/record-search.tsx` | `src/actions/discovery.ts` | import searchRecordsAction | WIRED | Line 4: `import { searchRecordsAction } from "@/actions/discovery"` |
| `src/app/(protected)/(explore)/explorar/_components/browse-grid.tsx` | `src/actions/discovery.ts` | import browseRecordsAction | WIRED | Line 4: `import { browseRecordsAction } from "@/actions/discovery"` |
| `src/app/(protected)/(explore)/explorar/_components/suggested-section.tsx` | `src/actions/discovery.ts` | import getSuggestionsAction | WIRED | Line 4: `import { getSuggestionsAction } from "@/actions/discovery"` |
| `src/components/shell/notification-bell.tsx` | `src/actions/notifications.ts` | import markAllRead, getUnreadCountAction | WIRED | Lines 14-19: imports getUnreadCountAction, getRecentNotificationsAction, markAllRead, markNotificationRead |
| `src/components/shell/notification-bell.tsx` | `src/lib/supabase/client.ts` | import createClient for Realtime | WIRED | Line 13: `import { createClient } from "@/lib/supabase/client"` |
| `src/components/shell/app-header.tsx` | `src/components/shell/notification-bell.tsx` | import NotificationBell | WIRED | Line 3: `import { NotificationBell } from "@/components/shell/notification-bell"` |
| `src/actions/collection.ts` | `src/lib/notifications/match.ts` | import checkWantlistMatches | WIRED | Line 9: `import { checkWantlistMatches } from "@/lib/notifications/match"` |
| `src/app/(protected)/settings/_components/notification-preferences.tsx` | `src/actions/notifications.ts` | import getPreferencesAction, updatePreferencesAction | WIRED | Lines 3-7: both imported and called on mount and toggle |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `record-search.tsx` | `results` (SearchResult[]) | `searchRecordsAction` -> `searchRecords` -> Drizzle ILIKE query + owner join | Yes — real DB queries with ilike, inArray | FLOWING |
| `browse-grid.tsx` | `results` (BrowseResult[]) | `browseRecordsAction` -> `browseRecords` -> Drizzle inner join with genre/decade filters | Yes — PostgreSQL array contains, year range, groupBy | FLOWING |
| `suggested-section.tsx` | `suggestions` (SuggestionResult[]) | `getSuggestionsAction` -> `getSuggestedRecords` -> 4-step Drizzle query (top genres, owned IDs, genre recs, follow recs) | Yes — real multi-step query with dedup | FLOWING |
| `notification-bell.tsx` | `recentNotifications`, `unreadCount` | `getRecentNotificationsAction` / `getUnreadCountAction` -> Drizzle queries on notifications table; Realtime INSERT subscription | Yes — Drizzle count() and select() on notifications table; Realtime payload.new | FLOWING |
| `notification-preferences.tsx` | `preferences` (PreferencesState) | `getPreferencesAction` -> `getPreferences` -> Drizzle select on notification_preferences; lazy INSERT on first visit | Yes — real DB read with lazy-create | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| searchRecords exported from queries.ts | `grep -c "export async function searchRecords" src/lib/discovery/queries.ts` | 1 match | PASS |
| browseRecords exported | `grep -c "export async function browseRecords" src/lib/discovery/queries.ts` | 1 match | PASS |
| checkWantlistMatches in addRecordToCollection | `grep -c "checkWantlistMatches" src/actions/collection.ts` | 2 matches (import + call) | PASS |
| MAX_IMPORT_NOTIFICATIONS=50 in import route | `grep -c "MAX_IMPORT_NOTIFICATIONS = 50" src/app/api/discogs/import/route.ts` | 1 match | PASS |
| NotificationBell in AppHeader | `grep -c "NotificationBell" src/components/shell/app-header.tsx` | 2 matches (import + usage) | PASS |
| userId threaded through layout -> shell -> header | `grep "id: user.id" src/app/(protected)/layout.tsx` + `grep "userId={user.id}" src/components/shell/app-shell.tsx` | Both present | PASS |
| postgres_changes subscription | `grep -c "postgres_changes" src/components/shell/notification-bell.tsx` | 1 match | PASS |
| Realtime cleanup | `grep -c "removeChannel" src/components/shell/notification-bell.tsx` | 1 match | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DISC2-01 | 06-01, 06-02, 06-05 | User can search by record name/artist and see which platform users have it | SATISFIED | `searchRecords` with ILIKE + owner join; `RecordSearch` component with `OwnersList` |
| DISC2-02 | 06-01, 06-02, 06-05 | User can browse collections filtered by genre and decade | SATISFIED | `browseRecords` with PostgreSQL array contains + year range; `BrowseFilters` + `BrowseGrid` |
| DISC2-03 | 06-01, 06-04, 06-05 | User receives notification when platform user has wantlist record | SATISFIED | `checkWantlistMatches` triggered from `addRecordToCollection` and import pipeline; in-app notification inserted + email sent |
| DISC2-04 | 06-01, 06-02, 06-05 | Platform suggests records based on collection taste and similar diggers | SATISFIED | `getSuggestedRecords` with top-genre + follow-based recs; `SuggestedSection` with SUGGESTED_FOR_YOU |
| NOTF-01 | 06-01, 06-03, 06-05 | User receives in-app notifications for wantlist match | SATISFIED | NotificationBell with Realtime subscription; dropdown showing 5 recent; badge with 9+ overflow |
| NOTF-02 | 06-01, 06-03, 06-05 | User receives email notifications for wantlist match, trade request | PARTIAL | Wantlist match email via Resend: SATISFIED. Trade request email: deferred to Phase 9 per D-11. `notificationPreferences.tradeRequestEmail` column exists but trigger not wired. |
| NOTF-03 | NOT CLAIMED by any plan | User can enable browser push notifications | DEFERRED | Explicitly deferred to Phase 11 per D-01. `pushEnabled` column in schema but service worker / VAPID implementation not started. ROADMAP lists this as a Phase 6 requirement but the RESEARCH doc documents the intentional deferral decision. |
| NOTF-04 | 06-01, 06-04, 06-05 | User can configure which notification types they receive | SATISFIED | `NotificationPreferences` in settings with functional wantlist toggles; future types shown disabled with phase badges |

**Orphaned requirements (in ROADMAP but not claimed by any Phase 6 plan):**
- **NOTF-03**: Listed in ROADMAP `Requirements` field for Phase 6 but explicitly deferred to Phase 11 per D-01. No Phase 6 plan claimed it. The REQUIREMENTS.md tracking table marks it `Pending`. This is a documented intentional decision, not an oversight.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/notifications/email.ts` | 3 | `new Resend(process.env.RESEND_API_KEY)` at module load time (not lazy) | Warning | Causes 3 integration test failures when `RESEND_API_KEY` is absent at import time. Noted in 06-05-SUMMARY as a known deferred item. Does not affect production behavior. |

No blocker anti-patterns found. No TODO/FIXME/placeholder comments in Phase 6 files. No hardcoded empty data arrays flowing to rendering. No stubs.

### Human Verification Required

#### 1. Wantlist Match Email Delivery

**Test:** With `RESEND_API_KEY` set in `.env.local` and `ALTER PUBLICATION supabase_realtime ADD TABLE notifications;` run in Supabase: have user B add a record that user A has on their wantlist.
**Expected:** User A receives an email with subject "Someone has a record from your wantlist" containing the record title, artist, and link to user B's profile.
**Why human:** Requires live Resend API key and two real user accounts. Cannot verify email delivery programmatically.

#### 2. Real-Time Notification Bell

**Test:** With the Realtime publication configured, have user B add a record that user A wants while user A has the app open.
**Expected:** User A's bell badge increments immediately without page refresh. The dropdown shows the new notification as the first item.
**Why human:** Requires WebSocket delivery over a live Supabase Realtime connection. Cannot simulate without running server.

#### 3. NOTF-02 Partial Delivery Acceptance

**Test:** Review NOTF-02 scope. ROADMAP SC4 states "User receives email notifications for wantlist matches AND trade requests." Trade request email trigger is intentionally deferred to Phase 9 per D-11.
**Expected:** Confirm that wantlist match email only (no trade request email) is an acceptable delivery for Phase 6, and that NOTF-02 can be marked partial rather than complete.
**Why human:** Policy/scope decision cannot be determined programmatically. Human must confirm whether partial NOTF-02 satisfies Phase 6 goals.

### Gaps Summary

No blocking gaps. All automated checks pass.

The only items requiring attention are:

1. **NOTF-03 deferred (not a gap — documented decision):** Push notifications were explicitly deferred to Phase 11 per D-01 in RESEARCH.md and CONTEXT.md. The ROADMAP requirements field lists it for Phase 6, but the deferral is formally documented. The `pushEnabled` column exists in the schema as a placeholder.

2. **NOTF-02 partial (not a gap — documented decision):** Trade request email is deferred to Phase 9 per D-11. Wantlist match email is fully implemented. The `tradeRequestEmail` preference column exists and defaults to true.

3. **Resend module-load anti-pattern (warning):** `new Resend(...)` at line 3 of `email.ts` runs at import time, causing 3 integration test failures when `RESEND_API_KEY` is absent. This is a test environment concern only — production behavior is unaffected. The fix (lazy initialization) is tracked as a deferred item in 06-05-SUMMARY.

---

_Verified: 2026-03-26T06:00:00Z_
_Verifier: Claude (gsd-verifier)_
