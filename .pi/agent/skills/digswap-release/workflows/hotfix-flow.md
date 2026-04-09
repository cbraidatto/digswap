# Workflow: Hotfix Flow

## Objective

Ship an emergency fix to production with minimal risk and maximum speed.

## When to Use

- S1 (site down, auth broken, payments failing) or S2 (major feature broken, data corruption risk) severity bugs in production.
- The fix cannot wait for the next milestone release.

## Decision: Rollback vs Hotfix

Before writing code, decide:

| Situation                                | Action   |
|------------------------------------------|----------|
| Fix will take < 30 minutes               | Hotfix   |
| Fix will take > 30 minutes               | Rollback first, then hotfix |
| Root cause unclear                       | Rollback first, investigate, then hotfix |
| Issue is in a database migration         | Cannot rollback easily — hotfix with forward migration |
| Issue is in Stripe webhook handling      | Hotfix — Stripe will retry failed webhooks |

### How to Rollback on Vercel

Vercel keeps every deployment. To rollback:
1. Go to Vercel dashboard > Deployments
2. Find the last known-good deployment
3. Click "Promote to Production"

This buys time while you prepare the hotfix.

## Steps

### 1. Create Hotfix Branch from Master

```bash
git checkout master
git pull origin master
git checkout -b hotfix/brief-description
```

### 2. Fix the Issue

- Minimal changes only. Do not refactor, do not add features.
- If the fix touches more than 3 files, reconsider whether it is truly minimal.

### 3. Test the Fix

At minimum:
```bash
pnpm build
pnpm test
```

If the fix is in a specific area, run targeted tests. Full lint and type-check are recommended but not blocking for S1.

### 4. Create PR to Master

- PR title: `[HOTFIX] brief description of the fix`
- PR body: what broke, why, what this fixes, how to verify.
- Do NOT squash into the milestone branch — this goes directly to master.

### 5. Merge and Verify

- Merge the PR (squash merge).
- Watch Vercel deployment complete.
- Verify the fix on production.
- Monitor Sentry for 15 minutes after deploy.

### 6. Backmerge to Milestone Branch

The active milestone branch needs this fix too:

```bash
git checkout milestone/MXXX
git merge master
```

Resolve any conflicts. The milestone branch should always include all production fixes.

### 7. Post-Mortem

After the fire is out, document:

- **What broke?** Specific behavior and impact.
- **Why did it break?** Root cause.
- **Why did it escape?** What test, check, or review should have caught it?
- **What will prevent recurrence?** New test, validation, or process change.

Add the post-mortem as a comment on the hotfix PR for future reference.

## Deliverable

- Production fix deployed and verified.
- Backmerge to milestone branch complete.
- Post-mortem documented on the PR.
