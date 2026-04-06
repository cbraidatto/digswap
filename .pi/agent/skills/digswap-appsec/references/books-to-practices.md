# Books To Practices

Use this file to ground recommendations in the books the user selected. Translate each book into actions for DigSwap rather than book summaries.

## Core Rule

Do not cite the books as authority alone. Convert them into design checks, code checks, and launch checks.

## Book Map

| Book | Use It For | DigSwap Translation |
| --- | --- | --- |
| Alice and Bob Learn Application Security | Secure SDLC, threat modeling, testing, deployment | Build security into feature planning, code review, test strategy, and release gates |
| Alice and Bob Learn Secure Coding | Input validation, trust boundaries, framework-safe patterns | Review TypeScript, React, Next.js, file handling, race conditions, and secret handling |
| Threat Modeling | STRIDE, data-flow diagrams, design-time risk analysis | Model trade flows, OAuth callbacks, billing, realtime updates, and peer transfers before implementation |
| Hacking APIs | API abuse, BOLA, auth failures, mass assignment | Assume every server action and route can be scripted and tampered with |
| The Tangled Web | Browser internals, same-origin, CSP, cookies, parsing edge cases | Protect user-generated content, embeds, redirects, and browser state |
| The Web Application Hacker's Handbook | Attacker methodology and business logic abuse | Review auth, session handling, file upload or transfer semantics, and hidden workflow assumptions |
| Bug Bounty Bootcamp | Practical exploit patterns plus prevention | Turn common bug classes into review prompts and self-pentest scenarios |
| Real-World Bug Hunting | Pattern recognition from real incidents | Look for familiar exploit chains in DigSwap features before launch |
| Grokking Web Application Security | Clear why plus how for web defenses | Explain controls in developer-friendly terms and choose pragmatic fixes |
| Securing DevOps | Secrets, CI/CD, logging, incident response | Harden the pipeline, preview environments, runtime secrets, and operational detection |

## How To Apply The Books

1. Use Tanya Janca and Adam Shostack to shape the workflow.
2. Use Corey Ball, Vickie Li, Peter Yaworski, and WAHH to think like the attacker.
3. Use Zalewski and McDonald for browser and web platform correctness.
4. Use Julien Vehent for environment, logging, and deployment security.

## Required Behavior

- Prefer systemic fixes over one-off patches.
- Tie every recommendation to a concrete attack path.
- Convert every important recommendation into a test, invariant, or release gate.
- Never claim these books can make the app absolutely safe.
