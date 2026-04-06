# Pre-Launch Checklist

Use this workflow for release readiness, hardening passes, pentest prep, investor or stakeholder confidence checks, or any request to assess whether DigSwap is ready to face real users and hostile traffic.

## Objective

Produce an evidence-based security readiness report for DigSwap. Do not accept assertions without proof.

## Read First

1. Read `../references/books-to-practices.md`.
2. Read `../references/owasp-top10-stack-mapping.md`.
3. Load any relevant domain references for the parts of the product in scope.
4. Use `../templates/pre-launch-report.md` when the user wants a reusable artifact.

## Evaluation Rules

- Mark each control as `Pass`, `Partial`, `Fail`, or `Not Reviewed`.
- Require evidence such as code references, tests, policies, configs, screenshots, logs, or runbook excerpts.
- Treat `Partial` on critical auth, authorization, secrets, or billing controls as a launch blocker until resolved.
- Never say "secure" without naming the remaining blind spots.

## Minimum Launch Gates

### Identity and Access

- Auth flows work as expected.
- Authorization is enforced server-side and in RLS.
- Admin-only actions are isolated and audited.
- Session handling, logout, rotation, and recovery flows are tested.

### Data Protection

- Secrets stay server-side and are rotated out of examples and logs.
- Sensitive fields are minimized in logs and telemetry.
- Upload or transfer metadata cannot trigger path traversal, unsafe rendering, or privilege escalation.

### API and Business Logic

- High-risk endpoints are schema-validated and rate-limited.
- Trade, messaging, and entitlement flows are resilient to replay and race conditions.
- OAuth callbacks and Stripe webhooks are verified and idempotent.

### Browser and Client

- CSP, cookie policy, safe redirects, and content rendering rules are in place.
- Untrusted HTML is blocked or rigorously sanitized.
- Client code does not contain service-role keys, webhook secrets, or third-party tokens.

### Platform and Operations

- Dependency updates and vulnerability triage are active.
- CI/CD protects secrets and production deployment paths.
- Monitoring, alerting, backup, and incident response basics exist.
- External pentest is scheduled or completed before launch.

## Deliverable

Produce:

1. Overall status
2. Blockers
3. Important but non-blocking gaps
4. Evidence reviewed
5. Recommended fix order
6. Residual risk summary
