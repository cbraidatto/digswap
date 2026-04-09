# Release Manager Report -- v1.0.0 Assessment

## Meta
| Field | Value |
|-------|-------|
| Date | 2026-04-09 |
| Target Version | v1.0.0 |
| Branch | milestone/M008 |
| Commit | bb53575 |
| Codebase | 551 total commits, 78 ahead of master |
| Reporter | Release Manager (automated audit) |

## Executive Summary

DigSwap has completed 23 development phases across two milestones (v1.0 features + v1.1 deploy readiness) and the build compiles cleanly, TypeScript passes with zero errors, and all 646 tests pass. However, **the project is not ready for a v1.0.0 production release**. There are 9 known blockers from prior team audits (DevOps, DBA, QA, SRE), no CHANGELOG exists, no staging environment exists, the version is still 0.1.0, lint has 149 errors remaining (147 in tests, 2 in src), the .env.local.example is severely outdated (missing 10+ env vars), STRIPE_SECRET_KEY and SENTRY_DSN bypass Zod validation, and there is no /api/health endpoint for monitoring. Additionally, there is no feature flag system, no rollback-safe database migration strategy, and no documented deploy runbook.

**Recommendation: Blocked -- fix blockers first.** Estimated 1-2 days of focused work to reach a safe first deploy.

---

## 1. Release Inventory -- What's Shipping

### Feature Set

Based on 23 completed phases (Phases 1-8, 10-14, 16, 19-24) across 551 commits:

| # | Feature Area | Description |
|---|-------------|-------------|
| 1 | **Authentication** | Email/password signup, Google + GitHub OAuth, TOTP 2FA, backup codes, session management (max 3), password reset |
| 2 | **UI Shell** | 4-tab navigation (Feed, Perfil, Explorar, Comunidade), responsive layout, retro/analog design system |
| 3 | **Discogs Integration** | OAuth 1.0a, full collection + wantlist import, async pipeline with progress, manual sync, disconnect |
| 4 | **Collection Management** | Public collection profiles, rarity scoring, filtering (genre/decade/country/format), condition grading, manual entry |
| 5 | **Social Layer** | Follow system, activity feed, collection comparison, public profiles, user search |
| 6 | **Discovery + Notifications** | Cross-collection search, wantlist matching, in-app notifications (Realtime), email notifications (Resend), notification preferences |
| 7 | **Community + Reviews** | Auto-generated genre groups, user-created groups (public/private), group posts, pressing/release reviews |
| 8 | **Gamification** | Global rank (gem economy), genre leaderboards, badges, titles, 6 gem tiers (Quartzo to Diamante) |
| 9 | **Positioning + Radar** | Landing page repositioning, Radar hero feature (wantlist matches), public profiles, Bounty Link, OG images, Digger Memory |
| 10 | **Security Hardening** | Nonce-based CSP, rate limiting (3 tiers), Zod validation, RLS policies, OWASP Top 10 coverage |
| 11 | **Release Pages** | Public SEO-indexable /release/[discogsId] with YouTube embed, owners, reviews |
| 12 | **Crates + Sets** | Pre-dig folder creation, add-to-crate from any surface, ordered sets with drag-and-drop |
| 13 | **Trade V2** | 3-phase negotiation (proposal > preview > transfer), desktop handoff architecture, trade lobby |
| 14 | **Monetization** | Stripe freemium, premium tiers, billing settings, webhook idempotency |
| 15 | **Desktop Trade Runtime** | Electron app shell, IPC bridge, peer-to-peer trade execution (separate from web) |
| 16 | **DM Chat** | Right-sidebar direct messages for mutual followers |
| 17 | **Sentry Integration** | Error tracking instrumentation (client + server + edge), production-only enabled |

### Feature Completeness Assessment

| Feature | Status | Notes |
|---------|--------|-------|
| Authentication (AUTH-01 to AUTH-06) | **Complete** | All 6 requirements validated Phase 1 |
| Navigation (NAV-01 to NAV-03) | **Complete** | Validated Phase 2 |
| Discogs Integration (DISC-01 to DISC-06) | **Complete** | Validated Phase 3 |
| Collection Management (COLL-01 to COLL-06) | **Complete** | Validated Phase 4 |
| Social Layer (SOCL-01 to SOCL-05) | **Complete** | Validated Phase 5 |
| Discovery + Notifications (DISC2/NOTF) | **Complete** | Validated Phase 6 |
| Community + Reviews (COMM/REV) | **Complete** | Validated Phase 7 |
| Gamification (GAME-01 to GAME-06) | **Complete** | Validated Phase 8, upgraded to gem economy Phase 20 |
| P2P Audio Trading (Phase 9) | **Not Started** | Deferred -- requires DMCA agent registration |
| Positioning + Radar | **Complete** | Validated Phase 10 |
| Security Hardening | **Complete** | Validated Phase 11, additional fixes Phase 19 |
| Release Pages | **Complete** | Validated Phase 12 |
| Crates + Sets | **Complete** | Validated Phase 13 |
| Trade V2 | **Complete** | Validated Phase 14 (desktop execution model) |
| Social V2 (Phase 15) | **Not Started** | Trade-scoped messaging, presence |
| Monetization (Phase 16) | **Complete** | Stripe integration live |
| Gem Economy (Phase 20) | **Complete** | Gem tiers, visual effects, leaderboard integration |

**Assessment:** The feature set is comprehensive for a v1.0.0 social platform. Phase 9 (P2P Audio Trading) and Phase 15 (Social V2) are deferred by design -- they require DMCA compliance infrastructure. The current feature set delivers a complete social discovery and collection management experience.

---

## 2. Version + Changelog

### Current Version
`package.json` shows `"version": "0.1.0"` -- still at the create-next-app default. This must be bumped to `1.0.0` before release.

### Changelog Status
**No CHANGELOG.md exists.** With 551 commits across 23 phases, the entire development history is documented only in git log and .planning/ artifacts. A changelog is essential for:
- Users to understand what's in the release
- Future developers (or the solo dev after a break) to understand version history
- App store / distribution channel requirements if applicable

### Versioning Strategy Recommendation

Adopt **Semantic Versioning (SemVer)** with this convention:
- **1.0.0** -- First production release (current target)
- **1.0.x** -- Hotfixes (no feature changes)
- **1.1.0** -- Next feature release (P2P trading, Social V2)
- **2.0.0** -- Breaking changes (if ever needed)

Tag the release commit with `v1.0.0` in git. Use `npm version` or manual bump in package.json.

---

## 3. Branch + Deploy Strategy

### Current Branch Structure

| Branch | Purpose | Status |
|--------|---------|--------|
| `master` | Historical default branch | 78 commits behind milestone/M008, last commit 2026-04-05 |
| `milestone/M006` | Historical milestone | Stale |
| `milestone/M007` | Historical milestone | Stale |
| `milestone/M008` | **Active development** (current) | HEAD at bb53575 |
| `gsd/*` (7 branches) | Quick task branches | Stale |
| `worktree-agent-*` (60+ branches) | GSD worktree branches | Should be cleaned up |

**Critical issue:** There is no `main` branch. The git status header says `main` is the main branch, but `main` does not exist -- only `master` exists and it is 78 commits behind. The CI workflow triggers on `push: main` and `pull_request: main`, meaning **CI has never run on the primary development branch**.

### Recommended Deploy Flow

For a solo developer, the simplest safe flow:

```
milestone/M008 --> (merge to main) --> Vercel auto-deploy preview --> manual promote to production
```

1. Rename `master` to `main` (or update CI to use `master`)
2. Merge `milestone/M008` into `main`
3. Vercel auto-deploys on push to `main`
4. Preview deploys on PRs (already supported by Vercel)

### CI/CD Pipeline

| Stage | Exists? | Tool | Notes |
|-------|---------|------|-------|
| Lint (Biome) | Yes | GitHub Actions | Runs `pnpm --filter @digswap/web lint` |
| Type check | Yes | GitHub Actions | Runs `tsc --noEmit` on web + desktop + trade-domain |
| Unit tests | Yes | GitHub Actions | Runs `vitest run` on web + trade-domain |
| Build | Yes | GitHub Actions | Runs `next build` -- depends on typecheck passing |
| E2E tests | **No** | Playwright installed but not in CI | 3 spec files exist, 10 tests skipped/fixme |
| Deploy preview | **No** | Vercel (not configured) | No Vercel project connected |
| Production deploy | **No** | Vercel (not configured) | No vercel.json, no Vercel project linked |
| Coverage reporting | **No** | @vitest/coverage-v8 not installed | Cannot generate coverage metrics |

**Critical gap:** CI triggers on `main` branch which does not exist. No CI has run against the primary development work on `milestone/M008`. This means all CI gates are effectively disabled.

---

## 4. Pre-Release Blocker Status

### Audit Blockers (from all teams)

| # | Blocker | Owner | Status | Est. Time | Current State |
|---|---------|-------|--------|-----------|---------------|
| 1 | STRIPE_SECRET_KEY outside Zod schema | DevOps | **OPEN** | 15 min | Used via `requireEnv()` in stripe.ts -- runtime throw, not Zod |
| 2 | NEXT_PUBLIC_SENTRY_DSN outside Zod schema | DevOps | **OPEN** | 15 min | Read directly via `process.env.NEXT_PUBLIC_SENTRY_DSN` in instrumentation files |
| 3 | NEXT_PUBLIC_SITE_URL defaults to localhost in prod | DevOps/SRE | **OPEN** | 15 min | Zod schema uses `.optional().default("http://localhost:3000")` -- silent failure in prod |
| 4 | No /api/health endpoint | DevOps/SRE | **OPEN** | 30 min | No route exists; SRE runbooks reference `/api/health/deep` |
| 5 | acquire_trade_lease() overload conflict | DBA | **PARTIALLY FIXED** | 15 min | Migration 20260412 created a 3-arg version; migration 20260331 has a 5-arg version. Need to verify both coexist. Desktop calls 5-arg, web security audit created 3-arg. |
| 6 | stripe_event_log has no migration/RLS | DBA | **FIXED** | 0 min | Drizzle migration `0005_stripe_event_log.sql` exists with RLS and `USING (false)` policy |
| 7 | UPDATE policies missing WITH CHECK | DBA | **NEEDS VERIFICATION** | 30 min | Migration 20260405 fixes null RLS policies but WITH CHECK clauses need audit |
| 8 | .env.local.example outdated | DevOps | **OPEN** | 15 min | Missing: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, RESEND_API_KEY, RESEND_FROM_EMAIL, HANDOFF_HMAC_SECRET, YOUTUBE_API_KEY, SYSTEM_USER_ID, SENTRY vars, NEXT_PUBLIC_STRIPE_*, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_P2P_ENABLED, NEXT_PUBLIC_PEERJS_*, NEXT_PUBLIC_MIN_DESKTOP_VERSION |
| 9 | @vitest/coverage-v8 not installed | QA | **OPEN** | 5 min | Not in package.json devDependencies |

### Release-Specific Blockers (new findings)

| # | Blocker | Severity | Est. Time | Details |
|---|---------|----------|-----------|---------|
| R1 | No `main` branch -- CI never runs | **P0** | 15 min | CI triggers on `main` but only `master` exists. All CI gates are bypassed. |
| R2 | Version still 0.1.0 | **P1** | 5 min | Must bump to 1.0.0 |
| R3 | No CHANGELOG.md | **P1** | 1-2h | 23 phases of work undocumented for users |
| R4 | No Vercel project linked | **P1** | 30 min | No vercel.json, no deployment target configured |
| R5 | Sentry config files missing | **P1** | 15 min | `@sentry/nextjs` installed and instrumentation files exist, but no `sentry.client.config.ts` / `sentry.server.config.ts` (using newer instrumentation API instead -- may be correct for Sentry v10) |
| R6 | 147 lint errors in tests (CRLF + noThenProperty) | **P2** | 30 min | 73 CRLF formatting, 68 noThenProperty (Drizzle mock pattern), 6 other |
| R7 | 2 lint errors in src (noNonNullAssertion) | **P2** | 5 min | wrapped.ts and 1 other |
| R8 | Build warnings: /comunidade dynamic server usage | **P2** | 10 min | Expected behavior (cookies usage), but should add `export const dynamic = 'force-dynamic'` |
| R9 | 60+ stale worktree branches | **P3** | 15 min | Noise in git branch listing, cleanup recommended |
| R10 | No git remote configured | **P0** | 10 min | `git remote -v` returns empty. Code exists only locally. |

---

## 5. Rollback + Hotfix Readiness

### Rollback Capability

**Vercel instant rollback:** Once deployed, Vercel maintains every deployment as an immutable snapshot. Rolling back is a one-click operation in the Vercel dashboard (Deployments > select previous > "Promote to Production"). This is the primary rollback mechanism and is excellent.

**Database rollback: NOT POSSIBLE.** All Supabase migrations are forward-only SQL. There are 23 migration files with no corresponding down-migration files. Drizzle Kit is installed but no `drizzle.config` exists for managed rollbacks. If a migration causes data loss or breaks queries, manual SQL intervention is required.

**Risk mitigation:** For v1.0.0 (first deploy), there is no existing production data to protect. The first deploy is inherently safe from a data perspective -- you can always wipe and re-deploy. This becomes critical from v1.0.1 onward.

### Hotfix Flow

**No hotfix flow is documented.** Recommended process:

1. Create branch `hotfix/description` from `main`
2. Fix the issue
3. Push to remote -- Vercel creates a preview deploy for verification
4. Merge to `main` -- Vercel auto-deploys to production
5. Tag as `v1.0.1` (patch version bump)

For the solo developer, this is simple enough to not need automation. The key requirement is that `main` auto-deploys to Vercel.

### Database Migration Rollback

**Not automated.** Current state:
- 7 Drizzle migrations (`drizzle/*.sql`)
- 23 Supabase migrations (`supabase/migrations/*.sql`)
- No down-migration files
- No `drizzle.config.ts` for Drizzle Kit operations

**Recommendation for v1.0.0:** Since this is the first deploy with zero existing users, database rollback is not a concern. For v1.1.0+, adopt this pattern:
1. Always write additive migrations (add columns, never remove)
2. Use feature flags to control code paths using new schema
3. Only remove old columns/tables after confirming the new code is stable

---

## 6. Feature Flags + Progressive Rollout

### Current Feature Flag Usage

**One pseudo-flag exists:** `NEXT_PUBLIC_P2P_ENABLED` controls whether P2P trade features are shown in the UI. This is referenced via `isP2PEnabledClient` for client components. This is not a dynamic feature flag system -- it's a build-time environment variable.

**No feature flag service is integrated.** No Vercel Edge Config, no LaunchDarkly, no Statsig, no custom flags table.

### Recommended Flags for v1.0.0

For a solo developer, a full feature flag service is overkill. Instead, use environment variable flags (already the pattern with P2P_ENABLED):

| Flag | Purpose | Default | Why |
|------|---------|---------|-----|
| `NEXT_PUBLIC_P2P_ENABLED` | Already exists | `"true"` in CI | Controls desktop trade feature visibility |
| `NEXT_PUBLIC_STRIPE_ENABLED` | Gate monetization | `"false"` | Ship free-only initially, enable billing when Stripe is fully tested in prod |
| `NEXT_PUBLIC_DM_ENABLED` | Gate direct messages | `"true"` | DM is new and untested at scale; allows quick disable |

For v1.1.0+, consider Vercel Edge Config ($0) for flags that need to change without redeploy.

---

## 7. Environment + Configuration Readiness

### Environment Checklist

| Environment | Ready? | Notes |
|-------------|--------|-------|
| Development (local) | **Yes** | Works with .env.local, dev server, all tests pass |
| Preview (Vercel PR deploys) | **No** | No Vercel project configured, no remote |
| Staging | **No** | Does not exist -- not recommended for solo dev, preview deploys are sufficient |
| Production | **No** | No Vercel project, no domain, no prod env vars set |

### Required Env Vars for Production

**Server-side (set in Vercel Environment Variables):**

| Variable | In Zod? | In .env.example? | Status |
|----------|---------|-------------------|--------|
| `DATABASE_URL` | Yes | Yes | OK |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Yes | OK |
| `DISCOGS_CONSUMER_KEY` | Yes | Yes | OK |
| `DISCOGS_CONSUMER_SECRET` | Yes | Yes | OK |
| `IMPORT_WORKER_SECRET` | Yes | Yes | OK |
| `HANDOFF_HMAC_SECRET` | Yes (conditional) | **No** | Gap -- required >=32 chars in prod |
| `RESEND_API_KEY` | Yes (optional) | **No** | Gap -- needed for email notifications |
| `RESEND_FROM_EMAIL` | Yes (optional) | **No** | Gap |
| `STRIPE_SECRET_KEY` | **No** | **No** | **BLOCKER** -- uses requireEnv() |
| `STRIPE_WEBHOOK_SECRET` | Yes (conditional) | **No** | Gap -- required in prod |
| `YOUTUBE_API_KEY` | Yes (optional) | **No** | Gap -- needed for release pages |
| `SYSTEM_USER_ID` | Yes (optional) | **No** | Gap |
| `UPSTASH_REDIS_REST_URL` | Yes (optional) | Yes | OK |
| `UPSTASH_REDIS_REST_TOKEN` | Yes (optional) | Yes | OK |
| `SENTRY_ORG` | **No** | **No** | **Gap** -- needed for source maps |
| `SENTRY_PROJECT` | **No** | **No** | **Gap** |
| `SENTRY_AUTH_TOKEN` | **No** | **No** | **Gap** -- needed for build-time upload |

**Client-side (NEXT_PUBLIC_*):**

| Variable | In Zod? | In .env.example? | Status |
|----------|---------|-------------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Yes | OK |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Yes | OK |
| `NEXT_PUBLIC_SITE_URL` | Yes (defaults localhost) | Yes (shows localhost) | **BLOCKER** |
| `NEXT_PUBLIC_APP_URL` | Yes (defaults localhost) | **No** | Gap |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **No** | **No** | **Gap** -- in CI env but not in Zod |
| `NEXT_PUBLIC_STRIPE_PRICE_MONTHLY` | Yes (optional) | **No** | Gap |
| `NEXT_PUBLIC_STRIPE_PRICE_ANNUAL` | Yes (optional) | **No** | Gap |
| `NEXT_PUBLIC_SENTRY_DSN` | **No** | **No** | **Gap** -- read directly from process.env |
| `NEXT_PUBLIC_P2P_ENABLED` | **No** | **No** | Gap -- in CI env but not in Zod |
| `NEXT_PUBLIC_PEERJS_HOST` | **No** | **No** | Gap |
| `NEXT_PUBLIC_PEERJS_PORT` | **No** | **No** | Gap |
| `NEXT_PUBLIC_PEERJS_PATH` | **No** | **No** | Gap |
| `NEXT_PUBLIC_MIN_DESKTOP_VERSION` | Yes (optional) | **No** | Gap |

**Summary:** 10 env vars missing from .env.local.example, 5 env vars missing from Zod validation, 1 env var defaults to localhost in production (critical silent failure).

---

## 8. Release Cut Plan -- Step by Step

### Phase A: Fix Blockers (~4h)

**A1. Create git remote and push code (15 min)**
- Create GitHub repository (private)
- `git remote add origin <url>`
- `git push -u origin milestone/M008`
- This is the single highest-priority item -- code currently exists only on local disk

**A2. Fix branch strategy and CI (15 min)**
- Rename `master` to `main`: `git branch -m master main`
- Push main to remote: `git push -u origin main`
- Merge milestone/M008 into main (or PR workflow)
- Verify CI triggers on push to `main`

**A3. Add STRIPE_SECRET_KEY to Zod schema (15 min)**
- Add to `serverSchema` in `src/lib/env.ts` with production-required validation
- Update `stripe.ts` to use `env.STRIPE_SECRET_KEY` instead of `requireEnv()`

**A4. Add NEXT_PUBLIC_SENTRY_DSN to Zod schema (15 min)**
- Add to `publicSchema` in `src/lib/env.ts` as optional (Sentry is non-critical)
- Update instrumentation files to use `publicEnv.NEXT_PUBLIC_SENTRY_DSN`

**A5. Fix NEXT_PUBLIC_SITE_URL default (15 min)**
- Remove `.default("http://localhost:3000")` in production
- Make it required when `process.env.VERCEL` is set (same pattern as HANDOFF_HMAC_SECRET)
- Or: fall back to `VERCEL_URL` in production (already done in stripe.ts `getSiteUrl()`)

**A6. Create /api/health endpoint (30 min)**
- Create `src/app/api/health/route.ts`
- Basic: return 200 with `{ status: "ok", timestamp, version }`
- Deep: check DB connectivity (simple Drizzle query), Redis ping, return individual statuses

**A7. Fix acquire_trade_lease() overload (15 min)**
- Verify both 3-arg (security audit) and 5-arg (desktop runtime) versions coexist
- If conflict: drop the old 5-arg version and update desktop to use 3-arg
- Test with `\df acquire_trade_lease` in Supabase SQL Editor

**A8. Audit UPDATE policies WITH CHECK (30 min)**
- Run `SELECT * FROM pg_policies WHERE cmd = 'UPDATE' AND with_check IS NULL;`
- Add WITH CHECK clauses matching the USING clause for each missing policy
- Create migration file `20260417_update_with_check.sql`

**A9. Update .env.local.example (15 min)**
- Add all 15+ missing variables with placeholder values
- Group by service (Supabase, Stripe, Sentry, Discogs, Upstash, Resend, App)

**A10. Install @vitest/coverage-v8 (5 min)**
- `pnpm --filter @digswap/web add -D @vitest/coverage-v8`
- Add coverage config to vitest.config.ts

### Phase B: Release Preparation (~3h)

**B1. Create Vercel project (30 min)**
- Link GitHub repo to Vercel
- Configure framework: Next.js
- Set all production environment variables (use checklist from Section 7)
- Configure production domain
- Verify preview deploys work on PR

**B2. Fix remaining lint errors (30 min)**
- Fix 2 src errors (noNonNullAssertion in wrapped.ts)
- Fix 73 CRLF errors in test files: `pnpm biome format --write tests/`
- Suppress or fix 68 noThenProperty warnings (Drizzle mock pattern -- add biome-ignore comments)

**B3. Bump version to 1.0.0 (5 min)**
- Update `apps/web/package.json` version to `"1.0.0"`
- Add version to /api/health response

**B4. Create CHANGELOG.md (1-2h)**
- Document all 23 phases as the initial release
- Use Keep a Changelog format
- Group by: Added, Changed, Fixed, Security

**B5. Clean up stale branches (15 min)**
- Delete 60+ worktree-agent branches: `git branch -D $(git branch | grep worktree-agent)`
- Delete stale gsd/* branches
- Delete milestone/M006, milestone/M007

**B6. Verify build + tests one final time (10 min)**
- `pnpm typecheck` (passing)
- `pnpm test` (646 passing)
- `pnpm build` (succeeds)
- `pnpm lint` (zero errors after B2 fixes)

### Phase C: Deploy (~1h)

**C1. Create release branch and tag (10 min)**
```
git checkout main
git merge milestone/M008
git tag -a v1.0.0 -m "v1.0.0: Initial production release"
git push origin main --tags
```

**C2. Verify CI passes (15 min)**
- Watch GitHub Actions: lint, typecheck, test, build-web, build-desktop
- All 5 jobs must pass

**C3. Deploy to Vercel (10 min)**
- Merge to main triggers auto-deploy
- Verify build logs in Vercel dashboard
- Verify deployment URL is accessible

**C4. Run production smoke test (20 min)**
Manual checklist:
- [ ] Landing page loads with correct positioning copy
- [ ] /signin page loads, form renders
- [ ] /signup page loads, form renders
- [ ] OAuth buttons redirect correctly
- [ ] /api/health returns 200
- [ ] Security headers present (check via browser devtools)
- [ ] CSP nonce visible in script/style tags
- [ ] Sentry DSN configured (check Sentry dashboard for init event)

### Phase D: Post-Deploy Verification (~1h)

**D1. Functional verification (30 min)**
- Create test account via email signup
- Verify email verification flow
- Connect Discogs account
- Import collection (test with small library)
- Verify collection appears on profile
- Follow another user (if test data exists)
- Create a community group
- Visit /explorar, /comunidade tabs

**D2. Performance baseline (15 min)**
- Run Lighthouse on production URL (target: 90+ Performance, 100 Accessibility)
- Check Vercel Analytics (if enabled) for initial load times
- Monitor Supabase dashboard for connection count and query performance

**D3. Monitoring verification (15 min)**
- Verify /api/health is pingable from external monitor (set up UptimeRobot or similar)
- Trigger a test error and verify it appears in Sentry
- Check Upstash Redis dashboard for rate limit commands

---

## 9. Post-Launch Priorities

### Week 1 (critical follow-ups)
- Set up external uptime monitoring (UptimeRobot free tier) on /api/health
- Monitor Sentry for unexpected errors in first real-user sessions
- Monitor Supabase connection pool (should stay under max: 10 per function)
- Monitor Upstash Redis usage (10K commands/day free tier -- tight at 100 DAU)
- Fix any P1 bugs reported by early users
- Run E2E tests against production (manually via Playwright pointed at prod URL)

### Week 2-4 (stabilization)
- Add @vitest/coverage-v8 and generate baseline coverage report
- Write tests for the 12 uncovered server action files (highest risk: auth, chat, desktop, export)
- Enable E2E tests in CI pipeline with auth storageState fixture
- Set up Vercel Speed Insights for real-user performance monitoring
- Review and potentially upgrade Upstash Redis tier if hitting limits
- Document the deploy + hotfix process in a CONTRIBUTING.md

### Month 2+ (maturation)
- Implement Phase 9 (P2P Audio Trading) -- requires DMCA agent registration
- Implement Phase 15 (Social V2) -- trade-scoped messaging
- Add Vercel Edge Config for runtime feature flags
- Write down-migration scripts for all existing migrations
- Consider Vercel Pro upgrade ($20/mo) if function timeouts become an issue
- Plan and execute formal penetration test before opening to broader audience

---

## 10. Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Code loss (no remote)** | High | Critical | Push to GitHub immediately. Code exists only on local disk. |
| **SITE_URL defaults to localhost in prod** | High | High | Fix Zod schema to require SITE_URL in production. Discogs import will silently fail without this. |
| **Stripe key misconfiguration** | Medium | High | Add to Zod schema. Currently throws at runtime, not at boot. |
| **Upstash Redis free tier exhaustion** | High | Medium | At 100 DAU, rate limiting alone approaches 10K/day limit. Upgrade to $10/mo pay-as-you-go when DAU exceeds 50. |
| **Database migration failure** | Low | High | First deploy has no data to lose. For future deploys, adopt additive-only migration strategy. |
| **Sentry not receiving errors** | Medium | Medium | DSN not validated at boot. Add to Zod as optional, log warning if missing. |
| **CI gates bypassed** | High | Medium | CI triggers on `main` which does not exist. Fix immediately. |
| **Vercel function timeout (Hobby: 10s)** | Medium | Medium | Import worker sets maxDuration=60, requires Pro. Either upgrade to Pro or restructure. |
| **No staging environment** | Medium | Low | Preview deploys on PRs serve this purpose. Not needed for solo dev. |
| **Large Discogs import stalls** | Medium | Medium | Self-invocation chain depends on SITE_URL. Fix SITE_URL blocker. |

---

## Overall Recommendation

**Blocked -- fix 12 items first (original 9 blockers + 3 new critical findings)**

The codebase is functionally complete and well-architected for a solo developer project. 646 tests pass, TypeScript compiles cleanly, and the build succeeds. The security posture is strong with nonce-based CSP, multi-tier rate limiting, and RLS policies.

However, three critical findings prevent a safe release:

1. **No git remote** -- the entire codebase exists only on one local machine. One disk failure loses everything. This must be fixed immediately, regardless of release timeline.

2. **CI has never run** -- the pipeline triggers on `main` which does not exist. All quality gates (lint, typecheck, test, build) have been effectively disabled for the entire development cycle.

3. **SITE_URL defaults to localhost** -- this will silently break Discogs imports, OAuth callbacks, and email links in production. It is the highest-risk silent failure in the codebase.

### Timeline to Production

| Phase | Duration | What |
|-------|----------|------|
| A: Fix blockers | 4 hours | All 12 items |
| B: Release prep | 3 hours | Vercel, lint, version, changelog |
| C: Deploy | 1 hour | Tag, CI, deploy, smoke test |
| D: Post-deploy | 1 hour | Functional verification, monitoring |
| **Total** | **~9 hours** | **One focused day** |

With focused effort, v1.0.0 can ship within **1 working day** after starting blocker fixes. The recommended sequence is: push to remote (A1) first, then fix blockers in parallel, then cut the release.
