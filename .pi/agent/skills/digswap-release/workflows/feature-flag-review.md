# Workflow: Feature Flag Review

## Objective

Audit the state of feature flags before each release. Ensure no stale flags remain, risky features are gated, and flags ready for promotion get cleaned up.

## When to Use

- Before every release cut (part of pre-release checklist)
- When introducing a new risky feature (WebRTC changes, Discogs sync rewrites, gamification rule changes)
- When cleaning up after a successful gradual rollout

## Current State

DigSwap does not yet have a formal feature flag system. This workflow documents when and how to introduce one, and how to manage flags once they exist.

## Recommended Approach for Solo Dev

Keep it simple. Two options, in order of preference:

### Option 1: Environment Variable Flags (Start Here)

```env
# .env.local / Vercel environment variables
FEATURE_NEW_SEARCH=true
FEATURE_TRADE_LOBBY_V2=false
```

```typescript
// lib/feature-flags.ts
export const flags = {
  newSearch: process.env.FEATURE_NEW_SEARCH === 'true',
  tradeLobbyV2: process.env.FEATURE_TRADE_LOBBY_V2 === 'true',
} as const;
```

Pros: Zero dependencies, instant toggle via Vercel dashboard, no runtime cost.
Cons: Requires redeployment to change (Vercel redeploys in ~30s, acceptable for solo dev).

### Option 2: Vercel Edge Config (When You Need Instant Toggles)

Use Vercel Edge Config for flags that must change without redeployment (e.g., kill switches).
Adds a dependency but provides sub-millisecond reads at the edge.

Only move to this when env-var flags feel limiting.

## Pre-Release Flag Audit Checklist

For each existing flag, answer:

| Question                                    | Action if Yes                              |
|---------------------------------------------|--------------------------------------------|
| Has this flag been `true` in production for > 2 releases? | Remove the flag, make the feature permanent |
| Has this flag been `false` for > 3 releases? | Remove the flag and the gated code         |
| Is this flag protecting a risky change?      | Keep it, document the rollback plan        |
| Does this flag have no clear owner or purpose? | Remove it — orphaned flags are tech debt  |

## When to Introduce a Flag

Gate a feature behind a flag when:

- It changes WebRTC/P2P behavior (connectivity risk)
- It modifies Discogs sync logic (data integrity risk)
- It changes gamification scoring or ranking (user trust risk)
- It alters Stripe billing flow (revenue risk)
- It is a large UI change that could regress usability

Do NOT flag:

- Bug fixes (just ship them)
- Documentation changes
- Internal refactors that do not change user behavior
- Dependency updates

## Flag Lifecycle

1. **Create** — add env var, document purpose and expected lifetime in PR description.
2. **Ship disabled** — deploy with flag `false`, verify no side effects.
3. **Enable in preview** — set `true` on Vercel preview, smoke-test.
4. **Enable in production** — set `true` in production env vars, monitor.
5. **Bake** — leave enabled for 1-2 releases to confirm stability.
6. **Remove** — delete the flag, remove conditional code, ship clean.

## Deliverable

A list of all current flags with their status (keep/promote/remove) and action items.
