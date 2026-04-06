---
name: digswap-appsec
description: DigSwap-specific application security review, threat modeling, secure implementation guidance, and pre-launch validation grounded in modern AppSec books and OWASP guidance. Use when working on authentication, authorization, Supabase RLS, Next.js server actions, API routes, WebRTC or PeerJS flows, Discogs OAuth, Stripe billing or webhooks, secrets, logging, file transfer, browser security, or when the user asks to harden, audit, pentest, review, or secure the app.
---

# DigSwap AppSec

Use this skill to push DigSwap toward the highest practical security bar for a solo-built product. Ground recommendations in secure design, secure coding, browser security, API abuse resistance, and DevOps hardening.

Do not promise that the app is "100% secure." Treat that phrase as the user's target outcome, not a claim. Always report residual risk, evidence still missing, and the next highest-leverage control.

## Core Rules

1. Start from design and trust boundaries before jumping to patch suggestions.
2. Prefer removing attack paths over compensating with UI checks.
3. Require both authentication and authorization for any record, trade, message, payment, import, or settings mutation.
4. Treat every browser request, server action, webhook, OAuth callback, file chunk, peer message, and external API payload as untrusted input.
5. Recommend tests and evidence, not just code changes.
6. Keep solutions solo-developer friendly: fewer moving parts, safer defaults, stronger invariants.

## Workflow Router

Choose exactly one primary workflow, then load only the references needed for that task.

- If the user gives a file, diff, PR, route, server action, API handler, migration, webhook, or component to review, read [workflows/review-code.md](./workflows/review-code.md).
- If the user is planning a feature, redesigning a flow, or asking "what could go wrong?", read [workflows/threat-model.md](./workflows/threat-model.md).
- If the user asks for a launch audit, hardening pass, pentest prep, or compliance-style checklist, read [workflows/pre-launch-checklist.md](./workflows/pre-launch-checklist.md).

Always read [references/books-to-practices.md](./references/books-to-practices.md) first. Then load only the references that match the active surface:

- Supabase auth, RLS, ownership, sessions: [references/auth-rls-patterns.md](./references/auth-rls-patterns.md)
- Next.js, browser trust boundaries, CSP, redirects, server actions: [references/nextjs-browser-security.md](./references/nextjs-browser-security.md)
- PeerJS, WebRTC, handoff tokens, chunked transfers: [references/p2p-webrtc-threat-surface.md](./references/p2p-webrtc-threat-surface.md)
- Stripe billing, Checkout, webhook processing: [references/payments-and-webhooks.md](./references/payments-and-webhooks.md)
- Discogs OAuth and third-party APIs: [references/oauth-and-third-party.md](./references/oauth-and-third-party.md)
- Secrets, CI/CD, logging, detection, operations: [references/devops-opssec.md](./references/devops-opssec.md)
- Full launch coverage by OWASP category: [references/owasp-top10-stack-mapping.md](./references/owasp-top10-stack-mapping.md)

## DigSwap Priorities

Bias toward these attack paths because they are especially relevant to DigSwap:

- Broken access control in Supabase or server code causing users to read or mutate another user's collection, wantlist, messages, trades, or subscriptions.
- BOLA and IDOR in API routes, server actions, and realtime subscriptions.
- OAuth mistakes that leak Discogs tokens, skip callback verification, or trust client state.
- WebRTC and PeerJS abuse: spoofed peers, replayed handoff tokens, malformed chunks, oversized transfers, and metadata tampering.
- Browser security issues around user content, embeds, image URLs, redirects, and cross-origin behavior.
- Stripe webhook replay, missing signature verification, entitlement drift, or trusting client-provided pricing.
- Sensitive data exposure in logs, telemetry, build output, preview environments, or secrets files.

## Output Contract

Every response from this skill should aim to include:

1. The most important risks first, ordered by impact and exploitability.
2. The exploit path in plain language.
3. The concrete code, schema, config, or architecture fix.
4. The tests or verification steps needed to prove the fix.
5. The residual risk that remains after the fix.

When reviewing code, findings come first. When threat modeling, controls and abuse cases come first. When running launch readiness, blockers come first.

## Templates

Use these output templates when the user wants a structured artifact:

- [templates/threat-model-report.md](./templates/threat-model-report.md)
- [templates/pre-launch-report.md](./templates/pre-launch-report.md)
