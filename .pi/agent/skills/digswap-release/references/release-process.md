# Release Process

## Branching Model

DigSwap uses trunk-based development adapted for a solo developer:

- **`master`** = production. Auto-deploys to Vercel production on every push/merge.
- **`milestone/MXXX`** = feature development branches (e.g., `milestone/M008`). Each milestone collects multiple phases of work before merging to master.
- **`gsd/*`** = short-lived task branches created by the GSD workflow. These merge into the active milestone branch, not directly into master.
- **`hotfix/*`** = emergency fixes branched from master, merged back to master, then backmerged to the active milestone.

All work reaches master via PR with squash merge. No direct pushes to master.

## Release Flow

1. **Develop** on `milestone/MXXX` — commit phases, run tests, iterate.
2. **Validate** — full build, test suite, lint, type-check all pass on the milestone branch.
3. **PR to master** — create a pull request with release notes in the description.
4. **Preview** — Vercel creates a preview deployment from the PR. Smoke-test it.
5. **Squash merge** — merge the PR using squash merge to keep master history linear.
6. **Tag** — create an annotated git tag on the merge commit: `git tag -a vX.Y.Z -m "description"`.
7. **Monitor** — watch Vercel deployment logs and Sentry for new errors in the first 30 minutes.

## Pre-Release Checklist

Before creating the PR to master, verify:

- [ ] `pnpm build` succeeds across all workspaces (apps/web, packages/trade-domain)
- [ ] `pnpm test` passes (vitest)
- [ ] `pnpm lint` reports zero errors (biome)
- [ ] `pnpm tsc --noEmit` passes with no type errors
- [ ] Database migrations tested: `supabase db push` applied to a preview/staging environment
- [ ] Environment variables: any new env vars documented and configured in Vercel dashboard
- [ ] No secrets committed (check .env files are gitignored)
- [ ] CHANGELOG.md updated with entries for this release

## Semantic Versioning

DigSwap follows semver strictly:

| Bump  | When                                                              | Example                         |
|-------|-------------------------------------------------------------------|---------------------------------|
| Major | Breaking changes, large redesigns, incompatible API changes       | v1.0.0 -> v2.0.0               |
| Minor | New features, new pages, new integrations (backward-compatible)   | v1.0.0 -> v1.1.0               |
| Patch | Bug fixes, security patches, dependency updates, copy changes     | v1.0.0 -> v1.0.1               |

Pre-1.0 releases (v0.x.y) are development releases where minor bumps may include breaking changes.

## Git Tags

Every release gets an annotated tag on master:

```bash
git tag -a v1.0.0 -m "Launch release — core collection, discovery, gamification"
git push origin v1.0.0
```

Tags are never deleted or moved. If a tag was applied to the wrong commit, create a new patch version.

## Database Migration Coordination

Migrations must be applied BEFORE deploying code that depends on them:

1. Apply migration to production Supabase: `supabase db push --linked`
2. Verify the migration succeeded (check tables, columns, RLS policies)
3. Then merge the PR to master (triggers Vercel deployment)
4. If the migration fails, do NOT merge the PR — fix the migration first

For destructive migrations (dropping columns/tables), deploy in two phases:
1. First release: stop using the column in code, deploy
2. Second release: drop the column in a migration, deploy
