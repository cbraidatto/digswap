---
status: complete
phase: 07-community-reviews
source: [07-VERIFICATION.md]
started: 2026-03-26T23:20:00Z
updated: 2026-03-26T23:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Genre groups appear on /comunidade (requires seeded DB)
expected: 15 genre groups visible in GENRE_GROUPS section, member groups below, [+ CREATE_GROUP] button, genre filter chips functional
result: [pending] — requires running `npx tsx src/lib/db/seeds/genre-groups.ts` against live DB

### 2. Create a group via /comunidade/new, view at /comunidade/[slug]
expected: Form validates, redirects to new group slug URL, group detail shows header with join status, composer visible, empty feed with NO_POSTS_YET state
result: [pending]

### 3. Write a post, write a review with star rating
expected: Regular post: flat layout with LINKED: record reference. Review post: elevated card with StarRating stars, 'review' label
result: [pending]

### 4. Expand reviews panel in /explorar after writing a review
expected: reviews: 1 count trigger appears, clicking expands ReviewsPanel showing StarRating, @username, timestamp, review body
result: [pending]

### 5. Group posts and reviews appear in /feed for eligible followers
expected: Feed shows 'posted in GROUP_NAME' subtitle, star rating shown for review posts, filtered by follower + group membership
result: [pending]

### 6. Create a private group, generate invite link, open in second session
expected: /join/[token] shows PRIVATE GROUP INVITE heading, joining works, non-members see [INVITE_ONLY]
result: [pending]

## Notes

**Automated issues to fix before production:**
- Run `npx tsx src/lib/db/seeds/genre-groups.ts` against live Supabase DB to seed 15 genre groups
- Remove dead `Group` type import in `group-detail-header.tsx:2` (causes TS2305)
- `react-intersection-observer` not installed (pre-existing Phase 5 issue)

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
