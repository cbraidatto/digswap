# Next.js And Browser Security

Use this file for Next.js routes, middleware, server actions, cookies, redirects, content rendering, and browser-side attack surface.

## Core Rules

- Treat every server action as a public mutation endpoint.
- Validate input before business logic.
- Re-authorize inside the action or route.
- Keep secrets, elevated tokens, and signing keys on the server only.

## Browser-Side Risks

- XSS through bios, comments, messages, release notes, imported metadata, or embed fields
- Open redirects through return URLs, onboarding redirects, and callback flows
- Cookie misuse through weak `SameSite`, `Secure`, or domain scope settings
- CSP gaps that allow script injection or unsafe asset origins
- Unsafe handling of external image or media URLs

## Review Checklist

- Avoid `dangerouslySetInnerHTML` unless there is strict sanitization and a clear reason.
- Validate redirect targets against an allowlist or same-origin rule.
- Keep auth cookies `HttpOnly`, `Secure`, and appropriately scoped.
- Use CSP and other security headers consistently.
- Do not echo secrets or stack traces to the client.
- Keep external fetches constrained and validated.

## Server Action Checklist

- Authenticate and authorize inside the action.
- Validate shape and length with Zod or an equivalent strict schema.
- Reject unknown fields when object shape matters.
- Apply rate limits to abuse-prone actions.
- Ensure high-risk cookie-backed actions have a strong CSRF posture.
- Return safe errors that do not leak internal state.

## Verification

- Add tests for XSS payloads, open redirects, and cross-user access.
- Verify middleware and headers survive preview and production builds.
- Confirm no client bundle contains secrets or privileged env vars.
