# Review Code

Use this workflow for files, diffs, PRs, routes, migrations, server actions, webhooks, and feature slices that already exist in code.

## Objective

Find exploitable security weaknesses and explain how to eliminate them with the least complexity that still closes the attack path.

## Read First

1. Read `../references/books-to-practices.md`.
2. Read the changed files plus the closest auth, database, and routing code.
3. Load only the domain references that match the surface under review.

## Review Sequence

1. Identify the trust boundary.
   Browser to server, server to database, peer to peer, third-party callback to server, or webhook to billing logic.
2. Identify the protected asset.
   User data, trade state, payment state, OAuth tokens, session cookies, entitlement flags, or local file writes.
3. Ask how an attacker would cross that boundary.
   Guess IDs, replay requests, tamper with payloads, exploit stale state, race requests, inject markup, or bypass RLS.
4. Verify enforcement at every layer.
   UI checks are never enough. Confirm server checks, RLS policies, schema validation, and safe defaults.
5. Produce findings with exploit path, impact, fix, and verification.

## Checklist By Surface

### Any Mutation

- Enforce authentication before business logic.
- Enforce authorization against the target resource, not just the session.
- Validate input with a strict schema.
- Reject extra fields when mass assignment could alter ownership, role, status, price, or entitlement.
- Rate limit abuse-prone endpoints.
- Avoid leaking internal errors or secrets.

### Next.js Server Actions and API Routes

- Treat server actions like public POST endpoints.
- Re-check user identity inside the action.
- Derive `userId` from the session, never from client input.
- Guard redirects and callback destinations.
- Sanitize or avoid HTML injection points.
- Protect high-risk mutations with origin-aware CSRF posture and cookie settings.

### Supabase, Drizzle, and RLS

- Assume the client is hostile.
- Require RLS on all user-owned tables and storage buckets.
- Verify policies enforce ownership and role constraints.
- Keep `service_role` keys server-only.
- Avoid raw SQL unless absolutely necessary; if present, verify parameterization and authorization.

### WebRTC, PeerJS, and Trade Transfers

- Bind peers to authenticated trade context.
- Use short-lived, one-time handoff tokens.
- Validate chunk order, size, count, and metadata.
- Refuse unsafe filenames, paths, or MIME assumptions.
- Cap transfer size and concurrent sessions.
- Make lease expiry and replay handling explicit.

### Discogs OAuth and External APIs

- Keep tokens server-side only.
- Verify callback state and correlation values.
- Do not trust external metadata or cover art URLs.
- Respect rate limits and backoff behavior.
- Prevent token values from reaching logs, analytics, or error pages.

### Stripe and Billing

- Create sessions and price selection on the server.
- Verify webhook signatures.
- Use idempotent event handling.
- Do not grant entitlements from the client alone.
- Handle replay and out-of-order delivery safely.

## Common Finding Patterns

- Broken access control or BOLA
- Missing or weak RLS policy
- Trusting client-supplied ownership fields
- Mass assignment on server-side model creation
- Unsafe redirect or callback handling
- XSS through profile, message, embed, or external metadata
- Race conditions around swaps, messages, or entitlement state
- File handling bugs in received transfer metadata
- Sensitive data exposure in logs or responses
- Missing rate limits on brute-force or enumeration surfaces

## Output Format

For each finding, include:

1. Severity
2. Location
3. Exploit path
4. Why the current code allows it
5. Safe fix
6. Proof to add with tests or logs

If no findings are discovered, say so explicitly and list the remaining blind spots.
