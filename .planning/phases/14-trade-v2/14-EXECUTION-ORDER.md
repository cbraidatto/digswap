# Phase 14 Trade V2: Consolidated Execution Order

## Purpose

This document merges two inputs into one execution path:

1. The consolidated security/performance review of the current codebase
2. The existing Phase 14 Trade V2 plan set (`14-01` through `14-05`)

The goal is simple: **do not start Trade V2 on top of unresolved integrity problems or contradictory plan assumptions**.

## Inputs

### Review Findings That Matter Before Trade V2

- `trade_requests` integrity is still too loose in [src/actions/trades.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/actions/trades.ts)
  - `completeTrade` and `skipReview` still allow invalid completion paths
  - `completeTrade` still mixes multiple critical mutations without one atomic database transaction
- WebRTC receive path still needs stricter safety in [src/lib/webrtc/use-peer-connection.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/lib/webrtc/use-peer-connection.ts)
  - unexpected peer acceptance remains risky
  - chunk metadata still needs explicit bounds discipline
- Rate limiting is still a hard availability dependency in [src/lib/rate-limit.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/lib/rate-limit.ts)
- Private groups and invite exposure remain open in:
  - [src/lib/db/schema/groups.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/lib/db/schema/groups.ts)
  - [src/lib/db/schema/group-invites.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/lib/db/schema/group-invites.ts)
- Trust/public-surface issues remain open but do not block Trade V2:
  - forgeable rarity OG in [src/app/api/og/rarity/[username]/route.tsx](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/app/api/og/rarity/[username]/route.tsx)
  - arbitrary Holy Grails in [src/actions/profile.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/actions/profile.ts)
- Performance/correctness debt remains open but is secondary to Trade V2 rollout:
  - Radar filter and thresholds in [src/lib/wantlist/radar-queries.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/lib/wantlist/radar-queries.ts)
  - duplicated Digger Memory reads in [src/hooks/use-digger-memory.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/hooks/use-digger-memory.ts)

### Existing Phase 14 Shape

Current plans:
- `14-01` Schema migration + pre-phase fixes
- `14-02` Proposal form redesign
- `14-03` Lobby state machine + presence + negotiation
- `14-04` Preview subsystem
- `14-05` Tests + human verification

This structure is good. The order and a few assumptions need correction before execution.

## Adjudication: What Changes Before Execution

### 1. Trade V2 stays asymmetric

**Decision:** keep Trade V2 asymmetric.

Meaning:
- proposer requests `X`
- proposer offers `Y`
- proposer supplies the file
- recipient validates preview and accepts or rejects

Do **not** let the plan drift into a bilateral file-preview system unless the product intentionally becomes a two-file barter flow.

Why:
- lower state complexity
- lower UX friction
- consistent with the solo-maintainable path
- matches the accepted Trade V2 intent better than a symmetric negotiation model

### 2. Proposer terms acceptance is implicit

If `createTrade` sets `terms_accepted_at` on insert, then:
- proposer is already accepted
- `acceptTerms` is only for the recipient
- proposer UI should render accepted state immediately

Do **not** keep a model where both sides separately click the same terms-accept action after creation. That creates semantic drift and duplicate state paths.

### 3. Plans 14-02 and 14-03 are not true parallel work

Even if the UI files differ, both plans mutate shared trade contracts in:
- [src/actions/trades.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/actions/trades.ts)
- shared trade status semantics
- lobby expectations

**Decision:** serialize them.

Recommended order:
- `14-02` first
- `14-03` second

### 4. The proposal form must query the real collection table

`14-02` currently references `user_collections`, but the schema uses [collection_items](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/lib/db/schema/collections.ts).

**Decision:** fix the plan before execution.

Also require server-side validation that `offeringReleaseId` belongs to the requester.

### 5. Preview semantics should stay honest and small

If preview generation remains based on `Blob.slice()` + estimated bitrate, do not promise exact temporal precision that the implementation cannot guarantee for all codecs.

Safe product framing:
- `first segment preview`
- `~1 minute preview`

Avoid overstating this as exact, codec-agnostic 60-second extraction unless the implementation truly supports it.

### 6. Pre-phase fixes must expand slightly

`14-01` already includes:
- status gate fixes
- schema additions
- backpressure threshold tuning

It should also explicitly carry:
- expected-peer validation in the WebRTC receive path
- hard bounds on incoming chunk metadata
- trade integrity fix so completion cannot bypass actual transfer semantics
- ideally the `completeTrade` multi-mutation consistency fix

## Best Execution Order

## Block A: Preflight Hotfixes

**Run before `execute-phase 14`.**

Use `/gsd:debug` for these, because they are bug/hardening work rather than feature delivery.

### A1. Trade integrity and completion gates

Target:
- [src/actions/trades.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/actions/trades.ts)

Must fix:
- `completeTrade` and `skipReview` cannot allow invalid progression from legacy states
- `completeTrade` should not leave the system in a partial state if later updates fail

Goal:
- trade completion reflects actual successful business-state advancement

### A2. WebRTC receive-path hardening

Target:
- [src/lib/webrtc/use-peer-connection.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/lib/webrtc/use-peer-connection.ts)

Must fix:
- validate the connecting peer against the expected counterparty
- impose explicit caps on chunk counts / preview chunk counts
- reject malformed or unbounded metadata before array growth

Goal:
- do not build preview and lobby complexity on top of a still-trusting receive path

### A3. Rate-limit availability fix

Target:
- [src/lib/rate-limit.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/lib/rate-limit.ts)

Must fix:
- missing or unhealthy Upstash config must not take down unrelated trade actions during local/dev/test execution

Goal:
- Phase 14 actions and tests can run without infra-induced false negatives

### A4. Open P0 privacy issues

Targets:
- [src/lib/db/schema/groups.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/lib/db/schema/groups.ts)
- [src/lib/db/schema/group-invites.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/lib/db/schema/group-invites.ts)

Why now:
- these are launch blockers regardless of Trade V2
- they should not remain open while new public/trust-sensitive work continues

## Block B: Phase 14 Plan Adjudication

**Run as a quick planning adjustment before feature execution.**

Needed changes to phase docs:
- mark `14-02` and `14-03` as serialized
- correct collection query references in `14-02`
- make `acceptTerms` recipient-only
- keep preview flow asymmetric in `14-04` and `14-05`
- update tests so they match the asymmetric contract

This is the minimum doc cleanup required before implementation.

## Block C: Execute Phase 14

After Blocks A and B are done, run Trade V2 in this order:

1. `14-01`
   - schema additions
   - status gate fixes
   - P2P hardening remainder
   - trade constants/query updates

2. `14-02`
   - proposal form redesign
   - metadata-only proposal creation
   - offering release validation

3. `14-03`
   - lobby state machine
   - presence
   - recipient terms acceptance

4. `14-04`
   - asymmetric preview pipeline
   - preview player
   - preview acceptance

5. `14-05`
   - tests
   - human verification

## Block D: Trust/Public Surface Cleanup

These do not block Trade V2, but should follow soon after.

Targets:
- [src/app/api/og/rarity/[username]/route.tsx](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/app/api/og/rarity/[username]/route.tsx)
- [src/actions/profile.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/actions/profile.ts)
- [src/actions/sessions.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/actions/sessions.ts)

Fix order:
1. server-derived rarity OG data
2. Holy Grail ownership validation
3. real session-revocation strategy

## Block E: Radar and Performance Follow-up

Targets:
- [src/lib/wantlist/radar-queries.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/lib/wantlist/radar-queries.ts)
- [src/hooks/use-digger-memory.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/hooks/use-digger-memory.ts)
- [src/lib/gamification/queries.ts](/C:/Users/INTEL/Desktop/Get%20Shit%20DOne/src/lib/gamification/queries.ts)

Fix order:
1. Radar correctness
2. Digger Memory duplicated reads
3. heavy leaderboard query off the request path

## Ready-to-Execute Checklist

Do not start `/gsd:execute-phase 14` until all are true:

- [ ] Phase 14 docs no longer mix asymmetric trade with bilateral preview upload
- [ ] `14-02` no longer references the wrong collection table
- [ ] proposer implicit terms acceptance is reflected in both docs and tests
- [ ] `completeTrade` integrity path is fixed enough to trust Trade V2 progression
- [ ] WebRTC receive path validates peer identity and bounded chunk metadata
- [ ] rate-limit availability no longer blocks normal trade/test development

## Recommended GSD Command Sequence

1. `/gsd:quick --discuss`
   - use this to apply the Phase 14 plan adjudication if you want a dedicated planning pass first

2. `/gsd:debug`
   - issue: `Trade V2 preflight blockers`
   - scope: trade integrity, WebRTC validation, rate-limit availability, private-group P0s

3. `/gsd:execute-phase 14`
   - after the blockers are closed and the docs are consistent

4. `/gsd:debug`
   - issue: `Trade V2 trust/public surface follow-up`

5. `/gsd:debug`
   - issue: `Radar correctness and performance follow-up`

## Final Recommendation

**Do not treat Phase 14 as the very next thing to code.**

Treat it as the next feature phase **after** a small but critical preflight blocker batch.

That gives you the best order:
- minimum delay
- no fake parallelism
- no new Trade V2 complexity on top of known integrity issues
- clean handoff into GSD execution
