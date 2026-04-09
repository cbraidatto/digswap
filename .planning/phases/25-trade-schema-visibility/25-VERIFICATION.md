---
phase: 25-trade-schema-visibility
verified: 2026-04-09T17:00:00Z
status: gaps_found
score: 5/6 must-haves verified
re_verification: false
gaps:
  - truth: "TRD-04 — Multi-item trade proposals with tier enforcement (1:1 free / 3:3 premium) fully implemented"
    status: failed
    reason: "Schema tables (trade_proposals, trade_proposal_items) exist and satisfy the structural prerequisite, but the tier-enforcement logic (1:1 vs 3:3 item limits based on subscription) is not implemented. REQUIREMENTS.md correctly marks TRD-04 as [ ] incomplete. The plan's claim that TRD-04 is 'completed' overstates what was delivered — the schema is a partial prerequisite, not the full requirement."
    artifacts:
      - path: "apps/web/src/lib/db/schema/trades.ts"
        issue: "tradeProposals + tradeProposalItems tables exist with correct FK structure but no item-count enforcement logic"
      - path: "apps/web/src/actions/collection.ts"
        issue: "No server action for creating/validating proposals with 1:1 vs 3:3 tier enforcement"
    missing:
      - "Server action to create a trade proposal that enforces 1-item limit for free tier and 3-item limit for premium tier"
      - "Validation that rejects proposals exceeding the tier limit"
      - "REQUIREMENTS.md TRD-04 checkbox update — currently still [ ] which is correct"
human_verification:
  - test: "Visibility selector cycle on /perfil collection card"
    expected: "Clicking the selector on a collection card cycles not_trading -> tradeable -> private -> not_trading, updating the badge visible on the card and persisting after page reload"
    why_human: "Requires browser interaction with auth session; cannot be verified programmatically without running the app"
  - test: "Private items hidden from other users"
    expected: "When user A marks a record as 'private', visiting user B cannot see that record on user A's public profile at /perfil/[username]"
    why_human: "Requires two authenticated sessions and visual confirmation of the collection display"
  - test: "Pagination count on public profile"
    expected: "The total count shown in pagination should match the number of non-private items displayed (not include private items in the count)"
    why_human: "getCollectionCount is called WITHOUT excludePrivate:true on the public profile page — count will include private items. This is a minor data inconsistency that needs human eyes to confirm impact."
---

# Phase 25: Trade Schema + Visibility Verification Report

**Phase Goal:** Extend the database to support multi-item trade proposals and give users control over which collection items are visible/tradeable
**Verified:** 2026-04-09T17:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `collection_items` has `visibility` column (tradeable/not_trading/private) replacing `open_for_trade` | VERIFIED | `collections.ts` L26: `visibility: varchar("visibility", { length: 20 }).default("not_trading").notNull()` |
| 2 | Other users see tradeable and not-trading items but NOT private items (RLS enforced) | VERIFIED | `collections.ts` L40-43: dual SELECT policies — `collection_items_select_own` (owner, all) and `collection_items_select_public` (visibility IN tradeable/not_trading). Drizzle-level defense-in-depth via `excludePrivate` on `getCollectionPage` in `perfil/[username]/page.tsx` L79 |
| 3 | `trade_proposals` and `trade_proposal_items` tables exist with proper foreign keys | VERIFIED | `trades.ts` L246-332: both tables with correct FKs (trade_proposals → trade_requests, trade_proposal_items → trade_proposals + collection_items + releases). RLS on both. Mirrored in SQL migration sections 4+5 |
| 4 | Quality metadata columns (audio_format, bitrate, sample_rate) exist on collection_items | VERIFIED | `collections.ts` L27-29: `audioFormat`, `bitrate`, `sampleRate` present. `setVisibility` and `updateQualityMetadata` actions in `collection.ts` L370-470 |
| 5 | Existing `open_for_trade` values correctly migrated to visibility enum | VERIFIED | SQL migration section 2: `UPDATE collection_items SET visibility = 'tradeable' WHERE open_for_trade = 1 AND visibility = 'not_trading'`. `open_for_trade` column kept with `@deprecated` comment |
| 6 | TRD-04 multi-item trade proposal tier enforcement implemented | FAILED | Schema tables exist (structural prerequisite satisfied), but 1:1/3:3 tier enforcement logic is absent. REQUIREMENTS.md correctly marks TRD-04 as `[ ]` incomplete |

**Score:** 5/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/src/lib/db/schema/collections.ts` | visibility column, quality metadata columns on collectionItems | VERIFIED | All 4 new columns present (visibility, audioFormat, bitrate, sampleRate); dual RLS policies; partial index on visibility='tradeable' |
| `apps/web/src/lib/db/schema/trades.ts` | tradeProposals and tradeProposalItems table definitions | VERIFIED | Both tables at L246-332 with correct FK chains and participant-scoped RLS |
| `supabase/migrations/20260409_visibility_and_trade_proposals.sql` | SQL migration with data migration, RLS updates, new tables | VERIFIED | All 5 sections present; idempotent (IF NOT EXISTS); data migration UPDATE; dual RLS; both new tables with RLS and indexes |
| `apps/web/src/actions/collection.ts` | setVisibility, updateQualityMetadata server actions | VERIFIED | `setVisibility` L370-409; `updateQualityMetadata` L421-469; `toggleOpenForTrade` L476-481 delegates to setVisibility (backward compat) |
| `apps/web/src/components/ui/visibility-selector.tsx` | 3-state visibility selector component | VERIFIED | Cycle-on-click (not_trading -> tradeable -> private -> not_trading); calls `setVisibility` action; useTransition + toast + router.refresh() |
| `apps/web/src/lib/collection/queries.ts` | CollectionItem type with visibility + quality fields; excludePrivate option | VERIFIED | Interface L13-36 has visibility, audioFormat, bitrate, sampleRate; getCollectionPage selects all 4 L134-137; excludePrivate WHERE clause L77-79 |
| `apps/web/src/lib/collection/filters.ts` | VISIBILITY_OPTIONS constant for UI reuse | VERIFIED | L35: `export const VISIBILITY_OPTIONS = ["tradeable", "not_trading", "private"] as const`; collectionFilterSchema includes optional visibility field L45 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `visibility-selector.tsx` | `actions/collection.ts` | calls `setVisibility(itemId, nextVisibility)` | WIRED | L58: `const result = await setVisibility(itemId, nextVisibility)` |
| `collection-card.tsx` | `visibility-selector.tsx` | imports and renders `<VisibilitySelector>` | WIRED | L17: import confirmed; L186-190: renders with `itemId={item.id}` and `currentVisibility={item.visibility}` |
| `perfil/page.tsx` | `queries.ts` | filters tradeable items via `i.visibility === 'tradeable'` | WIRED | L165: `const tradeableItems = items.filter((i) => i.visibility === "tradeable")` |
| `perfil/[username]/page.tsx` | `queries.ts` | passes `{ excludePrivate: true }` to getCollectionPage | WIRED | L79: confirmed. NOTE: getCollectionCount on same page does NOT receive excludePrivate (minor count inconsistency) |
| Drizzle schema | SQL migration | visibility varchar pattern | WIRED | Both schema and SQL use `varchar(20) NOT NULL DEFAULT 'not_trading'` |
| `trades.ts` | SQL migration | trade_proposals table | WIRED | Both define identical structure with same FK, RLS policies, and indexes |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `collection-card.tsx` | `item.visibility` | `getCollectionPage` → `collectionItems.visibility` DB column | Yes — Drizzle query selects real `visibility` column from DB | FLOWING |
| `visibility-selector.tsx` | `currentVisibility` prop | Passed from collection-card → CollectionItem from DB query | Yes | FLOWING |
| `trading-tab.tsx` | `tradeableItems` | Filtered from `getCollectionPage` result by `visibility === 'tradeable'` | Yes | FLOWING |
| `perfil/[username]/page.tsx` | `items` (excludePrivate) | `getCollectionPage` with `ne(collectionItems.visibility, 'private')` WHERE clause | Yes | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running the Next.js dev server with active Supabase session. No runnable entry points for static CLI verification.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TRD-01 | 25-01, 25-02, 25-03 | Collection items have visibility states: tradeable, not-trading, private — other users see tradeable/not-trading items but not private | SATISFIED | Visibility column in schema; dual RLS policies; excludePrivate query option; VisibilitySelector UI; REQUIREMENTS.md marks [x] |
| TRD-02 | 25-01, 25-02 | User can optionally declare audio quality metadata (format, bitrate, sample rate) on any tradeable collection item | SATISFIED | audioFormat/bitrate/sampleRate columns on collection_items; updateQualityMetadata server action with partial update support; REQUIREMENTS.md marks [x] |
| TRD-04 | 25-01 | Multi-item trade proposals: free tier 1:1, premium tier up to 3:3 items per trade | PARTIAL | Schema prerequisite (trade_proposals + trade_proposal_items tables) delivered. Tier enforcement logic (1:1 vs 3:3 validation) is NOT implemented. REQUIREMENTS.md correctly marks [ ] incomplete. Plan over-claimed completion. |

**Orphaned requirements check:** REQUIREMENTS.md does not assign TRD-01/TRD-02/TRD-04 to a specific phase in the traceability table yet — these are new requirements from the Trade Redesign section. No orphaned requirements found.

**TRD-03 note:** TRD-03 (side-by-side collection view) is marked [ ] in REQUIREMENTS.md and was not claimed by any plan in this phase — correctly out of scope.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/app/perfil/[username]/page.tsx` | 80 | `getCollectionCount(targetProfile.id, filters)` called WITHOUT `excludePrivate: true` | Warning | Pagination total count will include private items. Visitor sees e.g. "42 records" but only 39 display. Does not leak private item content — only inflates the count. No blocking goal failure. |
| `apps/web/src/lib/db/schema/collections.ts` | 41 | `collection_items_select_public` policy: `visibility IN ('tradeable', 'not_trading')` — no owner exclusion | Info | This is intentional dual-policy design. Both policies match simultaneously for owners, which is correct PostgreSQL RLS behavior (OR semantics between policies of same command type). Not a bug. |

### Human Verification Required

1. **Visibility selector cycle on /perfil**

   **Test:** Log in, go to /perfil, find a collection card, click the visibility selector (swap_horiz icon at bottom-right of card).
   **Expected:** Each click cycles to the next state (Not Trading → Trading → Private → Not Trading), the badge on the card updates immediately, and a toast confirmation appears. After page refresh the state persists.
   **Why human:** Requires authenticated browser session with real collection data; cannot be verified by static analysis.

2. **Private items hidden from other users**

   **Test:** With user A, mark one collection item as "Private". Log in as user B, visit `/perfil/[userA-username]`.
   **Expected:** The private item does NOT appear in user B's view of user A's collection.
   **Why human:** Requires two authenticated sessions and visual confirmation.

3. **Public profile pagination count accuracy**

   **Test:** User A has 10 items: 8 public (tradeable/not_trading) and 2 private. Visit their public profile as user B.
   **Expected (ideal):** Pagination shows 8 items total.
   **Actual risk:** `getCollectionCount` in `perfil/[username]/page.tsx` L80 does NOT pass `{ excludePrivate: true }`, so totalCount will be 10, totalPages will be calculated with 10. The displayed page will show only 8 items. Confirm the count mismatch severity and decide if it needs a fix.
   **Why human:** Requires a controlled dataset to observe the count discrepancy.

### Gaps Summary

**1 gap blocking full requirement delivery:**

TRD-04 was claimed as "completed" by plan 25-01, but the requirement reads "free tier 1:1, premium tier up to 3:3 items per trade." The trade_proposals and trade_proposal_items schema tables were created — this is the structural foundation — but the enforcement logic does not exist anywhere in the codebase. No server action validates item counts, no subscription check gates multi-item proposals. REQUIREMENTS.md correctly keeps TRD-04 as `[ ]` incomplete. The claim of completion in the SUMMARY and PLAN was premature.

**The phase goal is substantially achieved for TRD-01 and TRD-02:** visibility column, RLS, UI toggle, quality metadata columns, and server actions are all properly implemented and wired. The schema foundation for TRD-04 is solid. Only the enforcement layer is missing.

**1 minor data inconsistency (not blocking):**

`getCollectionCount` on the public profile page does not filter private items, causing the pagination total to be slightly higher than the displayed item count for profiles with private items. Not a data leak — private content never reaches the client — but produces a misleading pagination count.

---

_Verified: 2026-04-09T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
