# Auth And RLS Patterns

Use this file for Supabase auth, sessions, authorization, ownership, and row-level security review.

## Principles

- Authenticate first. Authorize second. Log the sensitive action third.
- Derive identity from the trusted server-side session, never from client payload.
- Deny by default. Public access must be explicit and narrow.
- Keep service-role credentials off the client and away from broad server helpers.

## RLS Review Checklist

- Confirm RLS is enabled on every user-owned table.
- Confirm `USING` and `WITH CHECK` both match the intended ownership rule.
- Confirm policies scope by `auth.uid()` or an equally strong server-derived principal.
- Confirm no broad policy such as `USING (true)` exposes private records.
- Confirm storage buckets, if used, have equivalent policies.
- Confirm admin or system tasks are isolated to server-only code paths.

## Code Smells

- Accepting `userId`, `ownerId`, `role`, or `subscriptionTier` from the client
- Querying by record ID without checking ownership
- Using a service-role client in request-scoped business logic
- Returning broad `select *` payloads for multi-tenant data
- Assuming RLS alone covers logic that the server already bypasses with elevated credentials

## Session And Auth Patterns

- Read the session from trusted server-side helpers.
- Re-check auth on every mutation and every sensitive read.
- Treat password reset, magic link, and session management pages as high-risk flows.
- Revoke or rotate sessions when changing critical auth state.

## Verification

- Add tests for same-user allowed access and cross-user denied access.
- Test direct object ID tampering.
- Test unauthenticated and partially authenticated requests.
- Test that elevated server utilities never run in user-triggered paths without an explicit gate.
