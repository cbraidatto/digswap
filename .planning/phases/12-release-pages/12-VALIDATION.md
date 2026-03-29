# Phase 12: Release Pages — Validation Architecture

**Phase:** 12
**Generated:** 2026-03-29
**Framework:** Vitest 3.x

## Requirements → Test Map

| Req ID | Behavior | Test Type | Test File | Automated Command |
|--------|----------|-----------|-----------|-------------------|
| REL-01 | /release/[discogsId] loads without auth, returns release data | unit | `tests/unit/release/release-page.test.ts` | `npx vitest run tests/unit/release/release-page.test.ts -x` |
| REL-02 | Discogs link constructed from discogsId | unit | `tests/unit/release/release-queries.test.ts` | `npx vitest run tests/unit/release/release-queries.test.ts -x` |
| REL-03 | YouTube search caches result, handles quota errors gracefully | unit | `tests/unit/release/youtube-search.test.ts` | `npx vitest run tests/unit/release/youtube-search.test.ts -x` |
| REL-04 | Owners list returns correct users for a release | unit | `tests/unit/release/owners-query.test.ts` | `npx vitest run tests/unit/release/owners-query.test.ts -x` |
| REL-05 | Reviews shown for release (reuses existing query) | unit | `tests/unit/release/release-reviews.test.ts` | `npx vitest run tests/unit/release/release-reviews.test.ts -x` |

## Sampling Schedule

| Gate | Command |
|------|---------|
| Per task commit | `npx vitest run tests/unit/release/ --reporter=verbose` |
| Per wave merge | `npx vitest run --reporter=verbose` |
| Phase gate | Full suite green before `/gsd:verify-work` |

## Wave 0 Gaps (created in Plan 03)

- [ ] `tests/unit/release/release-queries.test.ts` — REL-01, REL-02, REL-04
- [ ] `tests/unit/release/youtube-search.test.ts` — REL-03
- [ ] `tests/unit/release/release-reviews.test.ts` — REL-05

*No new test framework needed — Vitest already configured in vitest.config.ts*
