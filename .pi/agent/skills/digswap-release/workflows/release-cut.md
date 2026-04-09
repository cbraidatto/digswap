# Workflow: Release Cut

## Objective

Cut a release from a milestone branch to production (master) with full validation, changelog, and monitoring.

## When to Use

- A milestone's roadmap phases are complete
- The user says "release", "ship", "deploy to production", or "merge milestone"

## Steps

### 1. Verify Milestone Completeness

- Review the milestone roadmap (`.planning/roadmap.md` or PROJECT.md) — all planned phases should be marked complete.
- Check for any open TODOs or outstanding UAT items.
- If phases are incomplete, raise a go/no-go decision before proceeding.

### 2. Run Full Validation

```bash
pnpm build          # All workspaces must build cleanly
pnpm test           # Vitest test suite passes
pnpm lint           # Biome reports zero errors
pnpm tsc --noEmit   # TypeScript compiles with no errors
```

All four must pass. Any failure is a hard stop.

### 3. Database Migration Check

- List any new migrations since the last release.
- If migrations exist, apply them to production Supabase BEFORE merging: `supabase db push --linked`.
- Verify migration success before proceeding.

### 4. Generate Changelog

```bash
# Commits since last tag (or all commits if first release)
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "")..HEAD --oneline --no-merges
```

- Group into Added, Changed, Fixed, Removed, Security.
- Write user-facing descriptions, not commit messages.
- Update `CHANGELOG.md` at project root.

### 5. Create PR to Master

- PR title: `release: vX.Y.Z — Milestone MXXX`
- PR body: release notes (use [templates/release-notes.md](../templates/release-notes.md))
- Assign yourself as reviewer.

### 6. Verify Preview Deployment

- Wait for Vercel preview deployment on the PR.
- Smoke-test critical paths: sign in, collection view, search, profile page.
- Check browser console for errors.

### 7. Squash Merge

- Squash merge the PR to master.
- Merge commit message: `release: vX.Y.Z — brief description`

### 8. Tag the Release

```bash
git checkout master
git pull origin master
git tag -a vX.Y.Z -m "Release vX.Y.Z — Milestone MXXX description"
git push origin vX.Y.Z
```

### 9. Post-Deploy Monitoring

- Watch Vercel deployment logs for build/deploy errors.
- Monitor Sentry for new errors in the first 30 minutes.
- Spot-check production URL: homepage, auth flow, one protected page.

### 10. Backmerge (if needed)

If work continues on a new milestone branch, backmerge master:

```bash
git checkout milestone/MXXX
git merge master
```

## Go/No-Go Criteria

| Criterion              | Go                        | No-Go                          |
|------------------------|---------------------------|--------------------------------|
| Build                  | Clean across all packages  | Any build error                |
| Tests                  | All passing               | Any failure                    |
| Lint                   | Zero errors               | Errors present                 |
| Type-check             | No errors                 | Type errors                    |
| Migrations             | Applied and verified      | Migration fails or untested    |
| Env vars               | All configured in Vercel  | Missing production env vars    |
| Preview deployment     | Smoke test passes         | Broken pages or console errors |

## Deliverable

A filled-out release notes document (from the template) committed to the repo or posted in the PR description.
