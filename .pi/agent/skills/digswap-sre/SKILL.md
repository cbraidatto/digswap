---
name: digswap-sre
description: DigSwap-specific Site Reliability Engineering — SLO definition, monitoring strategy, incident response, capacity planning, health checks, and production readiness reviews adapted for a solo developer running Next.js 15 on Vercel with Supabase, Upstash Redis, Stripe, Sentry, Resend, Discogs API, and PeerJS/WebRTC. Use when working on uptime, observability, alerting, error budgets, runbooks, deployment confidence, cost forecasting, scaling triggers, or when the user asks to harden production, plan capacity, respond to incidents, or prepare for launch.
---

# DigSwap SRE

Use this skill to keep DigSwap reliably running in production with the minimum operational overhead a solo developer can sustain. Ground every recommendation in realistic SLOs, concrete service limits, and automation that replaces manual toil.

Do not recommend practices that require a team or 24/7 on-call. Every process must be executable by one person during waking hours, with automated detection filling the gaps.

## Core Rules

1. Define SLOs before building monitoring — measure what matters to users, not what is easy to measure.
2. Use error budgets to make deploy/pause decisions: when the budget is spent, stop shipping features and fix reliability.
3. Automate detection first, then response — a solo developer cannot watch dashboards, so alerts must be precise and actionable.
4. Plan capacity around real service tier limits, not theoretical maximums — know exactly when each free/hobby tier will be exhausted.
5. Reduce toil by encoding runbooks into scripts, health checks, and automated rollbacks rather than relying on manual steps.
6. Treat every incident as a learning event — write a brief post-mortem even for small outages to prevent recurrence.

## Workflow Router

Choose exactly one primary workflow, then load only the references needed for that task.

- If the user is preparing a feature or service for production, evaluating launch readiness, or asking "are we ready to ship?", read [workflows/production-readiness-review.md](./workflows/production-readiness-review.md).
- If the user is responding to an active incident, debugging a production issue, or asking "what do I do when X goes down?", read [workflows/incident-runbook.md](./workflows/incident-runbook.md).
- If the user is setting up monitoring, defining health endpoints, or asking "how do I know if the system is healthy?", read [workflows/health-check.md](./workflows/health-check.md).

Always read [references/sla-budget.md](./references/sla-budget.md) first. Then load only the references that match the active concern:

- Incident triage, severity, response, post-mortems: [references/incident-response.md](./references/incident-response.md)
- Service tier limits, cost forecasting, scaling triggers: [references/capacity-planning.md](./references/capacity-planning.md)

## DigSwap Priorities

Bias toward these reliability risks because they are especially relevant to DigSwap:

- Vercel function timeouts on heavy Discogs import routes — 10s on Hobby is easy to exceed with large collections.
- Supabase connection pool exhaustion under concurrent Realtime subscriptions and server-side queries.
- Upstash Redis quota exhaustion from leaderboard operations and rate limiting during traffic spikes.
- Discogs API 429 rate limit errors cascading into failed imports and degraded user experience.
- Stripe webhook delivery failures causing subscription state drift between Stripe and the database.
- Sentry error spikes after deploys going unnoticed without proper alerting thresholds.
- PeerJS signaling server availability — if it goes down, all WebRTC P2P connections fail.

## Output Contract

Every response from this skill should aim to include:

1. The current reliability posture — what is working and what is at risk.
2. The specific service limits, SLOs, or error budgets that are relevant.
3. The concrete action — config change, monitoring rule, runbook step, or automation script.
4. The verification method — how to confirm the action improved reliability.
5. The cost or effort tradeoff — what this costs in money, time, or complexity.

When reviewing production readiness, blockers come first. When responding to incidents, diagnosis and fix come first. When planning capacity, growth triggers and cost come first.

## Templates

Use these output templates when the user wants a structured artifact:

- [templates/prr-report.md](./templates/prr-report.md)
