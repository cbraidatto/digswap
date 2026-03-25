# Phase 1: Foundation + Authentication - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Project scaffolding with Next.js 15 + Supabase, Drizzle ORM with full database schema, retro/analog design system (dark + warm), and complete auth flows (email/password, Google/GitHub OAuth, 2FA TOTP). All auth surfaces must comply with OWASP Top 10. This phase is the foundation everything else builds on — nothing from Phase 2 onward works without this.

</domain>

<decisions>
## Implementation Decisions

### Visual Identity

- **D-01:** Dark-only mode — no light mode, no OS preference toggle. Simplifies maintenance and matches the vinyl digger aesthetic.
- **D-02:** Mood: dark + warm — near-black background with amber/orange/sepia accent palette. Think low-light vinyl record shop.
- **D-03:** Grain texture: subtle CSS grain on backgrounds — gives the feel of vinyl/paper without weighing down the UI.
- **D-04:** Typography: leave to Claude aesthetics prompt methodology (from Anthropic cookbook) — choose fonts that are distinctive, non-generic, appropriate for the dark+warm mood. Avoid Inter, Roboto, Arial, system fonts. Avoid purple gradients.
- **D-05:** Use CSS variables for theme consistency across all components.

### Auth UX

- **D-06:** After creating account or first login: user goes through an onboarding flow (not directly to Feed). Onboarding steps: connect Discogs (optional, skippable) + set display name/avatar.
- **D-07:** Email verification is mandatory — account is not activated until email is verified. No grace period.
- **D-08:** 2FA (TOTP) is suggested during onboarding (not mandatory). Onboarding screen explains the security benefit, user can skip. 2FA stays accessible in settings.
- **D-09:** Social login (Google, GitHub) bypasses email verification — OAuth providers already verify email.

### Database Schema

- **D-10:** Scaffold the complete database schema in Phase 1 (not just auth tables). All tables for the full app created now — users, collections, records/releases, wantlist, follows, activity, groups, reviews, rankings, trades, notifications, subscriptions. This prevents painful migrations in later phases.
- **D-11:** Use Drizzle ORM for schema definition and migrations. PostgreSQL via Supabase.
- **D-12:** Supabase Row Level Security (RLS) policies defined from the start for every table — not retrofitted later.

### Session Behavior

- **D-13:** Maximum 3 simultaneous active sessions across devices. A 4th login invalidates the oldest session.
- **D-14:** Sessions persist until manual logout ("until sign out") — no automatic expiry. Convenient for regular users.
- **D-15:** User can view all active sessions and terminate any of them from account settings.

### Security (OWASP Compliance on Auth)

- **D-16:** Rate limiting on all auth endpoints (login, signup, password reset, 2FA) — prevent brute force.
- **D-17:** Secure headers via Next.js config (CSP, HSTS, X-Frame-Options, etc.).
- **D-18:** Input validation and sanitization on all auth form fields.
- **D-19:** CSRF protection on all mutation endpoints.
- **D-20:** Security tests written alongside auth implementation — not after.

### Claude's Discretion

- Exact onboarding step count and copy
- Loading skeleton designs for auth pages
- Error message phrasing (be clear without revealing security details)
- Exact grain CSS implementation (SVG filter vs CSS noise)
- shadcn/ui component customization level
- Supabase Edge Functions vs Vercel serverless for auth webhooks

</decisions>

<specifics>
## Specific Ideas

- Frontend uses the Claude "Distilled Aesthetics" prompting methodology from the Anthropic cookbook (`https://github.com/anthropics/claude-cookbooks/blob/main/coding/prompting_for_frontend_aesthetics.ipynb`) — every frontend component generation must include the aesthetics prompt to avoid generic "AI slop" output.
- The aesthetic reference: "like a low-light vinyl record shop" — warm, textured, atmospheric. Not sterile.
- Onboarding should feel inviting to the digger community — reference crate-digging culture in copy and micro-interactions.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Project vision, core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — Full v1 requirements; Phase 1 covers AUTH-01..06 and SEC-01

### Roadmap
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and dependency chain

### Research findings
- `.planning/research/STACK.md` — Stack recommendations (Next.js 15, Supabase, Drizzle ORM, shadcn/ui, Tailwind)
- `.planning/research/ARCHITECTURE.md` — DB schema design, auth architecture, monolith-first approach
- `.planning/research/PITFALLS.md` — Security pitfalls, OWASP surface coverage, auth common mistakes
- `.planning/research/SUMMARY.md` — Synthesized recommendations and open questions

### External references
- No external ADRs yet — all decisions captured above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. No existing code.

### Established Patterns
- None yet — this phase establishes the patterns all other phases follow.

### Integration Points
- This phase IS the integration point. All subsequent phases build on the foundation established here.

</code_context>

<deferred>
## Deferred Ideas

- None — discussion stayed within Phase 1 scope.

</deferred>

---

*Phase: 01-foundation-authentication*
*Context gathered: 2026-03-25*
