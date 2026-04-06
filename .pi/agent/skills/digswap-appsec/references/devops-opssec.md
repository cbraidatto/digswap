# DevOps And Operational Security

Use this file for secrets, CI/CD, deployment, runtime logging, monitoring, dependency hygiene, and incident readiness.

## Core Rules

- Keep secrets out of repos, client bundles, logs, and build artifacts.
- Separate local, preview, staging, and production environments clearly.
- Grant least privilege to CI, deploy tokens, databases, and third-party services.
- Log enough to investigate abuse without leaking sensitive content.

## Checklist

- Review environment variable exposure rules.
- Review preview deployment behavior and data access.
- Review dependency update cadence and vulnerability triage.
- Review audit logging for auth, billing, admin, and trade events.
- Review alerting for repeated auth failures, webhook failures, and suspicious rate-limit events.
- Review backup, recovery, and incident response basics.

## High-Risk Smells

- Long-lived shared credentials
- Production secrets reused in preview or local environments
- Missing rotation plan for Stripe, Supabase, Discogs, or email providers
- Logs containing tokens, cookies, callback URLs, or personal data
- No operator trail for admin actions or entitlement changes

## Verification

- Verify secret scanning is part of the workflow, even if lightweight.
- Verify critical security events are observable.
- Verify a rollback path exists for broken auth or billing deployments.
- Verify external pentest findings can be tracked to closure before launch.
