# Threat Model

Use this workflow for planned features, architecture decisions, refactors, new integrations, or any request that asks what can go wrong before code exists.

## Objective

Model threats early enough that DigSwap can remove unsafe design choices before implementation.

## Read First

1. Read `../references/books-to-practices.md`.
2. Read `../references/owasp-top10-stack-mapping.md`.
3. Load the domain references that match the feature surface.
4. Use `../templates/threat-model-report.md` if the user wants a report.

## Threat Modeling Sequence

1. Define the feature scope.
   State actors, assets, entry points, data stores, external systems, and success criteria.
2. Draw the data flow in text.
   List each step from origin to destination, including redirects, callbacks, background jobs, realtime channels, and peer connections.
3. Mark trust boundaries.
   Browser to server, server to Supabase, server to Stripe, server to Discogs, peer to peer, dev to CI/CD, or operator to production.
4. Apply STRIDE per boundary.
   Spoofing, tampering, repudiation, information disclosure, denial of service, elevation of privilege.
5. Add API abuse cases.
   BOLA, mass assignment, brute force, rate-limit bypass, replay, and business logic abuse.
6. Propose controls.
   Prefer preventive controls first, detective controls second, recovery controls third.
7. Convert controls into implementation and test requirements.

## DigSwap-Specific Questions

- Can one user influence another user's collection, wants, trade state, or subscription data?
- Does the flow rely on a client-provided identifier, role, price, file path, or entitlement flag?
- Could a malicious peer join or interfere with a trade they do not own?
- Could imported Discogs metadata trigger XSS, SSRF, or confusing UI state?
- Could a replayed webhook, callback, or handoff token alter state twice?
- Could a preview deployment, log, or analytics event leak secrets or personal data?

## Output Expectations

Produce:

1. A short feature summary
2. A text data-flow diagram
3. A trust-boundary list
4. A threat table with severity and rationale
5. Required controls
6. Tests, monitoring, and residual risks

If the current design is unsafe at a foundational level, say so directly and recommend a safer redesign instead of layering patches.
