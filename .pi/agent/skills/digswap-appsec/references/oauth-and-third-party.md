# OAuth And Third-Party Integrations

Use this file for Discogs OAuth, API consumption, imports, callbacks, and any external data flowing into DigSwap.

## Discogs OAuth Rules

- Keep consumer secrets and access tokens server-side only.
- Correlate authorization requests and callbacks with a strong state value.
- Reject callbacks with missing or mismatched correlation data.
- Avoid logging OAuth tokens, verifier values, or raw callback URLs.
- Scope stored tokens to the smallest needed usage and access path.

## Third-Party Data Rules

- Treat all imported metadata as untrusted.
- Validate and normalize external URLs before server-side fetching.
- Escape or sanitize any external text before rendering.
- Cache conservatively and respect upstream rate limits.
- Back off on 429s and transient failures.

## Attack Paths To Consider

- Token leakage to the client bundle, logs, or query strings
- OAuth login CSRF or callback swapping
- SSRF through external image or metadata URLs
- XSS through imported release text or user-supplied profile fields
- Enumeration and rate-limit abuse during large imports

## Verification

- Test callback rejection on bad state.
- Test token secrecy in logs and errors.
- Test imported metadata containing scripts, malicious URLs, and oversized fields.
