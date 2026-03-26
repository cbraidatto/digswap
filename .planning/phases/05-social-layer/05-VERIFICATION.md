---
phase: 05-social-layer
verified: 2026-03-26T00:25:00Z
status: human_needed
score: 16/16 must-haves verified
human_verification:
  - test: "Navigate to /feed — verify progress banner shows 3 steps with step 3 locked [PHASE_7], and feed loads from activity_feed table (not empty/placeholder)"
    expected: "Banner shows Onboarding_Progress header, progress bar, 3 steps — step 1 and 2 conditionally checked, step 3 always locked with [PHASE_7] badge. Feed items render with rarity-colored accent strips, avatar, metadata grid, cover art."
    why_human: "Cannot verify rendered output, DB data existence, or real-time infinite scroll trigger without running the browser"
  - test: "Scroll to the bottom of /feed — verify infinite scroll fires and loads more items"
    expected: "Sentinel div enters viewport, loadMoreFeed is called, new items append without duplicates, [END_OF_FEED] appears when no more items"
    why_human: "Requires browser scroll interaction and live network call"
  - test: "Visit /explorar, type at least 2 characters in the search box, wait ~300ms"
    expected: "Results appear after debounce with avatar, username, record count, follower count, and an inline Follow button per result"
    why_human: "Requires browser interaction and live DB query via searchUsers"
  - test: "Click Follow on a search result"
    expected: "Button flips to FOLLOWING instantly without page reload (optimistic UI via useOptimistic)"
    why_human: "useOptimistic behavior only observable in browser"
  - test: "Navigate to /perfil/[some-username] — verify public profile renders correctly"
    expected: "ProfileHeader shows avatar, @username, bio, following/follower counts, FOLLOW button, COMPARE COLLECTION button. Collection grid below with filter bar."
    why_human: "Requires a real user with a username in the DB"
  - test: "Click COMPARE COLLECTION from a public profile"
    expected: "3-column layout: UNIQUE_TO_YOU (blue/secondary), IN_COMMON (green/primary), UNIQUE_TO_THEM (orange/tertiary). Each column has count badge and scrollable records. Back link returns to profile."
    why_human: "Requires two users with collections in DB"
  - test: "Hover the Following button after following a user"
    expected: "Button text changes from FOLLOWING to UNFOLLOW with person_remove icon and red/destructive styling. Click unfollows and reverts to FOLLOW instantly."
    why_human: "CSS group-hover behavior requires browser"
  - test: "Navigate to /perfil (own profile) — click following or followers count"
    expected: "Expandable inline list opens showing avatars, usernames as links to /perfil/[username], display names. Empty state shows appropriate message."
    why_human: "Lazy-load fetch on first expand requires browser interaction"
  - test: "Navigate to /perfil/[own-username] directly"
    expected: "Redirects to /perfil immediately"
    why_human: "Requires testing redirect behavior in browser with real auth session"
  - test: "Navigate to /perfil/nonexistent-user"
    expected: "404 page is shown"
    why_human: "Requires browser navigation and confirms notFound() is reached"
---

# Phase 5: Social Layer Verification Report

**Phase Goal:** Users can build a social graph, see what fellow diggers are doing, and compare collections
**Verified:** 2026-03-26T00:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | followUser server action inserts into follows table and logs activity | VERIFIED | `src/actions/social.ts` lines 62-98: db.insert(follows) + logActivity call confirmed |
| 2 | unfollowUser server action deletes from follows with IDOR guard | VERIFIED | `src/actions/social.ts` lines 100-126: db.delete with and(followerId=user.id, followingId=target) |
| 3 | getGlobalFeed returns activity_feed rows ordered by rarityScore DESC then createdAt DESC | VERIFIED | `src/lib/social/queries.ts` lines 15-62: COALESCE(rarityScore, -1) DESC, createdAt DESC ordering confirmed |
| 4 | getPersonalFeed returns activity_feed rows only from followed users ordered by createdAt DESC | VERIFIED | `src/lib/social/queries.ts` lines 64-113: IN (SELECT followingId FROM follows WHERE followerId = currentUserId) subquery + createdAt DESC |
| 5 | getCollectionComparison returns three arrays: uniqueToMe, inCommon, uniqueToThem | VERIFIED | `src/lib/social/comparison.ts` lines 31-92: full Map-based comparison with discogsId primary / artist+title fallback |
| 6 | searchUsers returns profiles matching ilike query on username | VERIFIED | `src/actions/social.ts` lines 160-226: ilike(profiles.username, '%sanitized%') with count enrichment |
| 7 | addRecordToCollection calls logActivity with added_record event | VERIFIED | `src/actions/collection.ts` lines 156-161: logActivity import confirmed at line 8, non-blocking try/catch at line 157-161 |
| 8 | User sees activity feed with real data on /feed | VERIFIED | `src/app/(protected)/(feed)/feed/page.tsx`: server-fetches getGlobalFeed/getPersonalFeed based on followingCount |
| 9 | Feed shows global/personal mode based on follow count, togglable | VERIFIED | `feed-container.tsx`: mode toggle (tablist/tab) shown only when followingCount > 0; handleModeSwitch resets state and fetches |
| 10 | Infinite scroll loads more items without button click | VERIFIED | `feed-container.tsx`: useInView sentinel + startTransition + loadMoreFeed on inView=true |
| 11 | Progress banner shows 3 onboarding steps with correct state | VERIFIED | `progress-banner.tsx`: step1=discogsConnected, step2=followingCount>=3, step3 always locked with [PHASE_7] |
| 12 | User can visit /perfil/[username] and see another digger's collection | VERIFIED | `perfil/[username]/page.tsx`: notFound(), self-redirect, parallel fetch of collection + social data |
| 13 | User can follow/unfollow from public profile with optimistic UI | VERIFIED | `follow-button.tsx`: useOptimistic + useTransition + toast on error; aria-pressed, group-hover unfollow state |
| 14 | User can search for diggers by username on /explorar | VERIFIED | `search-section.tsx`: 300ms debounce, searchUsers call, result cards with inline FollowButton |
| 15 | Own profile shows follower/following counts with expandable lists | VERIFIED | `perfil/page.tsx`: getFollowCounts imported + FollowList components wired; `follow-list.tsx`: lazy-load on first expand |
| 16 | Collection comparison page shows 3 columns with correct matching | VERIFIED | `compare/page.tsx`: getCollectionComparison called, ComparisonColumn rendered for uniqueToMe/inCommon/uniqueToThem |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/actions/social.ts` | followUser, unfollowUser, logActivity, loadMoreFeed, searchUsers | VERIFIED | All 5 exports present, "use server" directive, full DB query logic |
| `src/lib/social/queries.ts` | getGlobalFeed, getPersonalFeed, getFollowCounts, getFollowers, getFollowing, checkIsFollowing, getProgressBarState | VERIFIED | All 7 functions exported, real Drizzle queries with joins |
| `src/lib/social/comparison.ts` | getCollectionComparison returning 3 sets | VERIFIED | Full implementation with Map-based matching, 5000-item safeguard |
| `src/app/(protected)/(feed)/feed/page.tsx` | Server component fetching initial feed + progress state | VERIFIED | Auth check, parallel getProgressBarState+getFollowCounts, conditional feed fetch |
| `src/app/(protected)/(feed)/feed/_components/feed-container.tsx` | Client component with infinite scroll, mode toggle | VERIFIED | useInView, loadMoreFeed, deduplication, [END_OF_FEED], [AWAITING_SIGNAL/CONNECTION] |
| `src/app/(protected)/(feed)/feed/_components/feed-card.tsx` | FeedCard for added_record events | VERIFIED | Rarity accent strip, avatar, metadata grid, cover art, [NEW_FIND] label |
| `src/app/(protected)/(feed)/feed/_components/follow-event-card.tsx` | FollowEventCard for followed_user events | VERIFIED | "started following" text, both usernames as links, timestamp |
| `src/app/(protected)/(feed)/feed/_components/progress-banner.tsx` | 3-step onboarding banner | VERIFIED | Onboarding_Progress header, Progress component, step 3 locked [PHASE_7] |
| `src/app/(protected)/(profile)/perfil/[username]/page.tsx` | Public profile page | VERIFIED | notFound(), self-redirect, CollectionGrid isOwner=false, ProfileHeader |
| `src/app/(protected)/(profile)/perfil/[username]/_components/profile-header.tsx` | Header with avatar, counts, COMPARE COLLECTION button | VERIFIED | FollowButton and Compare link wired, "COMPARE COLLECTION" text present |
| `src/app/(protected)/(profile)/perfil/[username]/_components/follow-button.tsx` | Optimistic follow/unfollow toggle | VERIFIED | useOptimistic, FOLLOW/FOLLOWING/UNFOLLOW states, aria-pressed, group-hover |
| `src/app/(protected)/(profile)/perfil/_components/follow-list.tsx` | Expandable inline follower/following list | VERIFIED | aria-expanded, lazy-load on first expand via fetchFollowersList/fetchFollowingList |
| `src/app/(protected)/(explore)/explorar/_components/search-section.tsx` | Debounced username search with results | VERIFIED | 300ms debounce, searchUsers, result cards, inline FollowButton, "no diggers found" empty state |
| `src/app/(protected)/(profile)/perfil/[username]/compare/page.tsx` | 3-column comparison page | VERIFIED | COLLECTION_COMPARISON, UNIQUE_TO_YOU, IN_COMMON, UNIQUE_TO_THEM, getCollectionComparison |
| `tests/unit/social/follow.test.ts` | Unit tests for follow/unfollow | VERIFIED | 7 tests, vi.mock, real test() blocks, all passing |
| `tests/unit/social/unfollow.test.ts` | Unit tests for unfollowUser edge cases | VERIFIED | 3 tests, IDOR prevention test |
| `tests/unit/social/feed.test.ts` | Unit tests for feed queries | VERIFIED | 5 tests, getGlobalFeed + getPersonalFeed, cursor + limit coverage |
| `tests/unit/social/compare.test.ts` | Unit tests for comparison logic | VERIFIED | 4 tests, discogsId matching, artist+title fallback, empty collections |
| `tests/unit/social/public-profile.test.ts` | Unit tests for follow counts / profile queries | VERIFIED | 5 tests, getFollowCounts, checkIsFollowing, getFollowers, getFollowing |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/actions/social.ts` | `src/lib/db/schema/social` | db.insert(follows), db.delete(follows), db.insert(activityFeed) | WIRED | Lines 79-83 (insert follows), 113-120 (delete follows), 53-59 (insert activityFeed) |
| `src/lib/social/queries.ts` | `src/lib/db/schema/social` | db.select...from(activityFeed) with joins | WIRED | Lines 19-51 (getGlobalFeed), 77-101 (getPersonalFeed) |
| `src/actions/collection.ts` | `src/actions/social.ts` | logActivity called after successful addRecordToCollection | WIRED | Import at line 8, non-blocking call at lines 156-161 |
| `src/app/(protected)/(feed)/feed/page.tsx` | `src/lib/social/queries.ts` | getGlobalFeed, getPersonalFeed, getProgressBarState | WIRED | All three imported and called in parallel |
| `src/app/(protected)/(feed)/feed/_components/feed-container.tsx` | `src/actions/social.ts` | loadMoreFeed for infinite scroll pagination | WIRED | loadMoreFeed imported and called in useEffect + handleModeSwitch |
| `src/app/(protected)/(profile)/perfil/[username]/page.tsx` | `src/lib/social/queries.ts` | getFollowCounts + checkIsFollowing in parallel fetch | WIRED | Both imported and used in Promise.all |
| `src/app/(protected)/(profile)/perfil/[username]/page.tsx` | `src/lib/collection/queries.ts` | getCollectionPage with target userId | WIRED | getCollectionPage(targetProfile.id, filters) |
| `src/app/(protected)/(profile)/perfil/[username]/_components/follow-button.tsx` | `src/actions/social.ts` | followUser and unfollowUser in handleToggle | WIRED | Both imported and called in startTransition |
| `src/app/(protected)/(explore)/explorar/_components/search-section.tsx` | `src/actions/social.ts` | searchUsers with 300ms debounce | WIRED | searchUsers imported and called in setTimeout callback |
| `src/app/(protected)/(profile)/perfil/[username]/compare/page.tsx` | `src/lib/social/comparison.ts` | getCollectionComparison query | WIRED | Imported and called at line 158 |
| `src/app/(protected)/(profile)/perfil/[username]/_components/profile-header.tsx` | compare/page.tsx | Compare Collection button link href="/perfil/[username]/compare" | WIRED | Link href={`/perfil/${profile.username}/compare`} at line 86 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `feed/page.tsx` → `FeedContainer` | `initialFeed: FeedItem[]` | getGlobalFeed / getPersonalFeed → db.select from activityFeed JOIN profiles JOIN releases | Yes — real Drizzle query with joins | FLOWING |
| `FeedContainer` → pagination | `items` via loadMoreFeed | Server action → getPersonalFeed/getGlobalFeed → same DB joins | Yes — same query path | FLOWING |
| `perfil/[username]/page.tsx` → `CollectionGrid` | `items: CollectionItem[]` | getCollectionPage(targetProfile.id, filters) → DB query | Yes — real DB query on collectionItems | FLOWING |
| `compare/page.tsx` → ComparisonColumn | `comparison.uniqueToMe/inCommon/uniqueToThem` | getCollectionComparison → two DB queries + JS Set matching | Yes — real queries joining collectionItems+releases | FLOWING |
| `explorar` SearchSection | `results: SearchResult[]` | searchUsers → ilike query + count enrichment per result | Yes — real DB query | FLOWING |

### Behavioral Spot-Checks

Step 7b is skipped for UI components — interactive browser behavior (infinite scroll trigger, optimistic updates, CSS hover states) cannot be verified without a running browser. Data layer functions are covered by the 24 passing unit tests.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| SOCL-01 | 05-01, 05-03 | User can follow other diggers | SATISFIED | followUser action exists with DB insert, FollowButton wires it with optimistic UI |
| SOCL-02 | 05-01, 05-03 | User can unfollow diggers | SATISFIED | unfollowUser action exists with IDOR guard, FollowButton handles unfollow path |
| SOCL-03 | 05-01, 05-02 | User can view activity feed | SATISFIED | /feed page fetches real data from activity_feed, FeedContainer with infinite scroll |
| SOCL-04 | 05-01, 05-04 | User can compare collections with overlap/unique sets | SATISFIED | getCollectionComparison function + 3-column compare page |
| SOCL-05 | 05-01, 05-03 | User can view any public profile and their collection | SATISFIED | /perfil/[username] route with ProfileHeader + CollectionGrid |

All 5 requirements fully covered. No orphaned requirements found in REQUIREMENTS.md Phase 5 mapping.

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|-----------|
| `src/actions/social.ts` lines 138, 169, 174 | `return []` | Info | Auth guard early exits and query-length guard — not stubs. Data flow never reaches rendering path when unauthenticated. |

No blocker or warning anti-patterns identified. The `return []` instances are defensive guards that produce correct empty results for unauthenticated/invalid requests. All other code paths execute real DB queries.

### Human Verification Required

#### 1. Activity Feed Renders Real Data

**Test:** Navigate to `/feed` after logging in
**Expected:** Progress banner shows "Onboarding_Progress" with 3 steps (step 3 always locked with [PHASE_7] badge). Feed renders FeedCards with rarity accent strips, cover art, and terminal-style metadata. FollowEventCards appear as compact inline lines.
**Why human:** Cannot verify rendered output, DB population, or visual correctness without a browser

#### 2. Infinite Scroll Triggers

**Test:** Scroll to the bottom of `/feed`
**Expected:** Sentinel div enters viewport, 3 skeleton placeholders appear during load, new items append without duplicates. [END_OF_FEED] appears when exhausted.
**Why human:** Requires browser scroll interaction and live network call

#### 3. Username Search with Debounce

**Test:** Visit `/explorar`, type at least 2 characters in the search box, wait approximately 300ms
**Expected:** Results appear showing avatar, username, record count, follower count, and an inline Follow button per result. Empty state shows "no diggers found matching..." when no matches.
**Why human:** Requires browser interaction and live DB query

#### 4. Optimistic Follow / Unfollow

**Test:** Click Follow on a search result, then navigate to their profile and hover the Following button
**Expected:** Follow flips to FOLLOWING instantly (no page reload). On hover, button shows UNFOLLOW with destructive red styling. Click unfollow reverts to FOLLOW instantly.
**Why human:** useOptimistic and CSS group-hover behavior only observable in browser

#### 5. Public Profile Page

**Test:** Navigate to `/perfil/[some-username]` where that user exists in the DB
**Expected:** ProfileHeader renders avatar, @username, bio, following/follower counts, FOLLOW button, COMPARE COLLECTION button. Collection grid renders below with filter bar working.
**Why human:** Requires a real user with a username in the database

#### 6. Collection Comparison Page

**Test:** Click COMPARE COLLECTION from a public profile where both users have records
**Expected:** 3-column layout: UNIQUE_TO_YOU (blue/secondary accent), IN_COMMON (green/primary accent), UNIQUE_TO_THEM (orange/tertiary accent). Each column shows count badge and scrollable records with artist, title, rarity score. Back link returns to profile.
**Why human:** Requires two users with overlapping collections in DB

#### 7. Own Profile Social Counts

**Test:** Navigate to `/perfil`, click the following or followers count text
**Expected:** Expandable inline list appears with avatars, usernames as links to `/perfil/[username]`, display names. Empty state shows "no followers yet" / "not following anyone yet".
**Why human:** Lazy-load on first expand requires browser click

#### 8. Edge Cases

**Test:** Navigate to `/perfil/[own-username]` and `/perfil/nonexistent-user`
**Expected:** Own username redirects to `/perfil`. Nonexistent username shows 404 page.
**Why human:** Redirect and 404 behavior requires browser navigation with real auth session

### Gaps Summary

No gaps found. All 16 observable truths are verified at all 4 levels (exists, substantive, wired, data-flowing). All 5 SOCL requirements are satisfied. The full test suite (194 tests, 30 test files) passes with 0 failures and 4 skipped (pre-existing skips unrelated to Phase 5).

The only unresolved items are behavioral spot-checks requiring browser interaction — these are expected for a phase producing interactive React UI and are routed to human verification.

---

_Verified: 2026-03-26T00:25:00Z_
_Verifier: Claude (gsd-verifier)_
