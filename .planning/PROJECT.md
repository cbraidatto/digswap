# VinylDig

## What This Is

A social network for vinyl diggers — collectors who actively hunt for records. Users import their Discogs library, discover who has what they're looking for, compare collections with others, and trade audio rips of their vinyl via secure peer-to-peer connections. Gamified rankings reward both collection rarity and community contribution.

## Core Value

A digger opens the app and immediately finds who has the record they've been hunting — and sees where they stand in the community.

## Requirements

### Validated

**Phase 1: Foundation + Authentication** *(2026-03-25)*
- [x] Email/password signup with mandatory email verification (AUTH-01)
- [x] Login with session persistence — sessions persist until manual logout, max 3 simultaneous (AUTH-02)
- [x] Password reset via email link (AUTH-03)
- [x] Google + GitHub OAuth social login (AUTH-04)
- [x] TOTP two-factor authentication enrollment and challenge (AUTH-05)
- [x] 2FA disable + backup code recovery (AUTH-06)
- [x] OWASP Top 10 compliance on all auth surfaces — CSP/HSTS headers, rate limiting, input validation, CSRF protection (SEC-01)

**Phase 2: UI Shell + Navigation** *(2026-03-25)*
- [x] 4-tab bottom navigation shell (Feed, Perfil, Explorar, Comunidade) visible on all authenticated pages (NAV-01)
- [x] Active tab visually distinct with amber accent — persists on within-tab navigation (NAV-02)
- [x] Deep-link routing — navigating directly to any tab route highlights the correct tab (NAV-03)

### Active

**Discovery & Matching**
- [ ] Discogs library import (collection + wantlist) with manual sync option
- [ ] Search across all user collections to find who has a specific record
- [ ] Automatic wantlist matching — notify user when someone in the platform has a record they want
- [ ] Recommendation engine based on collection taste and what similar diggers have

**Collection & Social**
- [ ] Public profile with collection showcase
- [ ] Activity feed — what others added, traded, discovered
- [ ] Collection comparison between users
- [ ] Groups/communities organized by genre, era, style
- [ ] Reviews and ratings for records and pressings

**Gamification & Rankings**
- [ ] Rarity score based on Discogs have/want ratio
- [ ] Overall ranking combining rarity score + community contribution (trades, reviews, activity)
- [ ] Status rewards: badges and titles visible on profiles
- [ ] Privilege rewards: more P2P trades, exclusive groups, early access unlocked at higher ranks

**P2P Audio File Trading**
- [ ] Direct peer-to-peer file transfer (WebRTC) — files never stored on server
- [ ] Files exist only during active transfer session
- [ ] Post-trade review system for file quality
- [ ] Reputation score for sharers — bad quality = reputation loss

**Monetization (Freemium)**
- [ ] Free tier with limited P2P trades per month
- [ ] Premium tier unlocks: unlimited P2P, collection analytics, exclusive groups, priority wantlist matching

**Security**
- [ ] Security tests generated throughout development (not as afterthought)
- [ ] Penetration testing integrated into QA pipeline
- [ ] All auth, API, and P2P connections hardened to professional security standards
- [ ] OWASP Top 10 coverage on every exposed surface

### Out of Scope

- Physical vinyl marketplace/escrow — focus is audio files, not shipping records (Discogs already does this)
- Music streaming — this is sharing rips between collectors, not a streaming service
- Label/distributor partnerships — community-driven, not commercial licensing
- Mobile native app (v1) — web first, mobile later based on traction
- Subscription-only model (v1) — freemium first, subscription when user volume justifies it

## Context

**The problem with Discogs today:** It's cold and transactional. Wantlists are private, discovery is search-based not social, there's no community layer, and no way to share audio files of your records. Diggers use multiple disconnected tools (Discogs for catalog, Discord/Reddit for community, private channels for sharing rips).

**This platform closes the loop:** Import your Discogs data as the starting point, then layer on social, discovery, gamification, and P2P sharing — creating a single home for the digger's life.

**Cold start strategy:** Discogs integration is the hook. Anyone with a Discogs account can import instantly — lowering friction to near zero and tapping into an existing community of millions.

**Legal approach for P2P:** Platform acts as signaling/connection layer only. Files are transferred directly browser-to-browser via WebRTC. No files touch or are stored on platform servers. Similar legal posture to WebRTC-based tools — "mere conduit" defense. Terms of service place responsibility on users for the files they share.

**Frontend approach:** Built using Claude's "Distilled Aesthetics" prompting methodology (Anthropic cookbook) to produce distinctive, non-generic UI. Visual identity: **Retro/Analog** — vinyl texture, grain, warm color palette, typography that references the physical format. Avoid generic AI-generated aesthetics (purple gradients, Inter font, cookie-cutter layouts).

**Security posture:** Ultra-professional from day one. Security tests generated during feature development. Penetration testing built into QA. Not an afterthought — a first-class requirement on every surface.

**Solo developer:** Scope must be executable by one person. Architecture choices should favor simplicity and maintainability over premature optimization.

## Constraints

- **Team**: Solo developer — all architecture decisions must favor simplicity and solo maintainability
- **Platform**: Web first (browser, responsive) — no mobile native in v1
- **Language**: English-first — global vinyl digger community
- **P2P**: WebRTC only — no server-side file storage, ever. Non-negotiable for legal posture
- **Discogs API**: Subject to rate limits and Discogs ToS — import/sync must be respectful of limits
- **Security**: OWASP Top 10 coverage mandatory. Pen testing required before launch
- **Frontend**: Claude aesthetics prompting methodology — distinctive design, retro/analog visual identity
- **Stack**: To be determined by research — no existing preferences, optimize for solo developer productivity

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| WebRTC for P2P (no server file storage) | Legal "mere conduit" posture — platform not liable for content users share | — Pending |
| Discogs have/want ratio as rarity base | Discogs is the authoritative data source for vinyl rarity in the community | — Pending |
| Web-first (no native mobile v1) | Solo developer constraint — web reaches all platforms without maintaining two codebases | — Pending |
| Freemium model (not subscription) | Lower barrier to adoption; proves willingness to pay before locking in subscription model | — Pending |
| Security-first development | Pen testing and security tests generated during development — not bolted on at the end | ✓ Phase 1: vitest unit + integration + Playwright E2E scaffolds; OWASP headers + rate limiting live |
| Claude aesthetics prompting for frontend | Distinctive retro/analog visual identity using Anthropic cookbook methodology | ✓ Phase 1: Fraunces + DM Sans, OKLCH dark-warm palette, SVG grain texture |
| Full DB schema in Phase 1 (not incremental) | Prevents painful migrations in later phases | ✓ Phase 1: 20 tables, 59 RLS policies, all v1 domains covered |
| Max 3 simultaneous sessions, persist until logout | UX convenience (D-13/D-14); custom user_sessions table required (Supabase no native limit) | ✓ Phase 1: enforceSessionLimit() with oldest-first eviction |
| getClaims() not getSession() in all server code | getSession() doesn't validate JWT signature — security risk | ✓ Phase 1: enforced in middleware, all server actions, session management |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-25 after Phase 2 (UI Shell + Navigation) complete*
