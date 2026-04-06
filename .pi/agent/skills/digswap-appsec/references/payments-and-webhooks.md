# Payments And Webhooks

Use this file for Stripe Checkout, subscriptions, billing state, entitlement sync, and webhook handling.

## Core Rules

- Create billing state transitions on the server.
- Verify Stripe webhook signatures before parsing business meaning.
- Make webhook processing idempotent.
- Do not trust client-provided price, entitlement, or subscription status.

## Review Checklist

- Keep test and live secrets separated.
- Map allowed price IDs on the server instead of accepting arbitrary values.
- Persist processed event IDs or another idempotency marker.
- Handle retries and out-of-order event delivery safely.
- Reconcile entitlements from verified billing state, not optimistic client state.
- Avoid logging full customer objects, tokens, or raw webhook payloads if not needed.

## High-Risk Mistakes

- Granting premium access based only on client redirect success
- Parsing webhooks before verifying the signature
- Applying the same event multiple times
- Mixing test and production environments
- Exposing billing secrets to the browser or preview logs

## Verification

- Test replayed webhook events.
- Test invalid signatures.
- Test duplicate event delivery.
- Test downgrade, cancellation, and payment failure edge cases.
