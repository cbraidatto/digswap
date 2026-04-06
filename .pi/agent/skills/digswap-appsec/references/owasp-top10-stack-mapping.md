# OWASP Top 10 Stack Mapping

Use this file when auditing launch readiness or when mapping a finding to broader control categories.

## OWASP Top 10 2021

| Category | DigSwap Risk | Expected Controls | Evidence |
| --- | --- | --- | --- |
| A01 Broken Access Control | Users access other users' trades, collections, messages, or subscriptions | Server-side authz, RLS, ownership checks, admin separation | Policy files, route code, tests |
| A02 Cryptographic Failures | Tokens, secrets, or sensitive data leak or are stored unsafely | HTTPS, secret isolation, no plaintext secrets in client or logs | Env handling, logs, config |
| A03 Injection | Raw SQL, shell, HTML, or untrusted URLs alter behavior | Parameterized queries, strict schemas, no unsafe HTML | Code review, tests |
| A04 Insecure Design | Trade engine or OAuth flow lacks safe invariants | Threat modeling, abuse-case review, redesign unsafe flows | Architecture notes, threat model |
| A05 Security Misconfiguration | Weak headers, preview leaks, exposed admin tooling | Hardened headers, env separation, least privilege | Configs, middleware, deployment settings |
| A06 Vulnerable and Outdated Components | Risky packages or stale dependencies | Dependency hygiene, update policy, triage process | Lockfile review, scanning output |
| A07 Identification and Authentication Failures | Session abuse, weak recovery, token misuse | Strong auth flows, secure cookie posture, verified callbacks | Auth code, tests |
| A08 Software and Data Integrity Failures | Replayed webhooks or unsafe CI/CD | Signature verification, idempotency, pipeline protections | Webhook code, CI config |
| A09 Security Logging and Monitoring Failures | Attacks go undetected or logs leak sensitive data | Security-focused logs, alerting, redaction, incident paths | Logging config, runbooks |
| A10 SSRF | External metadata or callbacks abuse server egress | Allowlists, URL validation, server-side restrictions | Fetch code, tests |

## API-Heavy Additions

Use these API-specific lenses from OWASP API Security and Hacking APIs:

- BOLA and IDOR on resource identifiers
- Broken authentication on session and callback boundaries
- Excessive data exposure from overly broad selects or responses
- Mass assignment on object creation or update
- Lack of rate limiting on search, auth, import, and message surfaces
- Unsafe consumption of third-party APIs and webhooks

## DigSwap Blockers

Treat these as launch blockers until proven safe:

- Missing RLS on user-owned tables or buckets
- Service-role key reachable from client code
- Unverified Stripe webhook handling
- OAuth callback without robust state correlation
- Transfer metadata that can influence file paths or ownership without validation
- Untrusted HTML or embeds rendered in the browser
