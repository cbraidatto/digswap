---
name: digswap-release
description: DigSwap release management — cutting releases from milestone branches, generating changelogs, coordinating database migrations with Vercel deployments, hotfix flows, and feature flag lifecycle. Use when the user wants to release, deploy, tag, hotfix, write release notes, review feature flags, or coordinate a production launch.
---

# DigSwap Release Manager

Use this skill to coordinate releases for a solo-developer monorepo (apps/web + packages/trade-domain) deployed to Vercel via trunk-based development. The goal is structured but lightweight — no ceremony that does not prevent breakage.

Every release decision should answer: "Can I roll this back in under 5 minutes if something breaks?"

## Core Rules

1. Never deploy code that depends on a database migration before the migration has been applied and verified in production.
2. Use semantic versioning (vMAJOR.MINOR.PATCH) for all tagged releases. No exceptions.
3. Every release gets a signed annotated git tag and a human-readable changelog entry.
4. Prefer squash merges from milestone branches to master — keep the production history linear and scannable.
5. Stripe billing changes (plan prices, webhook endpoints, entitlement logic) must be deployed in a separate release from feature work to isolate payment risk.
6. If a production fix will take longer than 30 minutes, roll back first and hotfix second.

## Workflow Router

Choose exactly one workflow based on the user's intent:

- If the user wants to cut a release, ship a milestone, or deploy to production, read [workflows/release-cut.md](./workflows/release-cut.md).
- If the user reports a production bug or needs an emergency fix, read [workflows/hotfix-flow.md](./workflows/hotfix-flow.md).
- If the user wants to audit feature flags, plan gradual rollout, or clean up stale flags, read [workflows/feature-flag-review.md](./workflows/feature-flag-review.md).

Always read [references/release-process.md](./references/release-process.md) first. Then load additional references as needed:

- Changelog format and conventional commits: [references/changelog-standards.md](./references/changelog-standards.md)
- Release notes template: [templates/release-notes.md](./templates/release-notes.md)

## DigSwap Priorities

Bias toward these concerns because they are especially relevant to DigSwap:

- **Vercel preview before production.** Every PR to master gets a Vercel preview deployment. Verify the preview URL before merging — this is your staging environment.
- **Database migration timing.** Supabase migrations must land before the code that uses new tables/columns. Use `supabase db push` against production, verify, then merge the PR.
- **Stripe billing isolation.** Never bundle pricing or webhook changes with unrelated feature work. Deploy billing changes as their own patch release.
- **Feature flags for gradual rollout.** When a feature is risky (WebRTC changes, Discogs sync rewrites, new gamification rules), gate it behind an env-var flag and promote incrementally.
- **Monorepo coordination.** Changes to `packages/trade-domain` affect `apps/web` — always run the full build (`pnpm build`) before tagging, not just the app build.

## Output Contract

Every response from this skill should include:

1. Clear go/no-go decision with reasoning.
2. The exact commands to run (git, pnpm, supabase CLI) — no hand-waving.
3. A checklist the developer can copy into the PR description.
4. Rollback instructions if the release goes wrong.
5. Any follow-up tasks (backmerge, flag cleanup, monitoring) with owners and deadlines.
