# DigSwap

## What This Is

A social network for vinyl diggers — collectors who actively hunt for records. The app operates as a layer on top of Discogs: import your collection instantly, then access social discovery, community groups, gamified rankings, and peer-to-peer audio trading — all in one place. It serves two types of users equally: the obsessive researcher and the community-driven digger.

## Core Value

A digger opens the app and immediately finds who has the record they've been hunting — and sees where they stand in the community.

## Product Architecture

The app is built around 5 interconnected pillars:

1. **Ferramenta (Tool)** — Individual value. Useful even with one user.
   - Full Discogs collection import (no limits)
   - Wantlist management
   - Rarity scoring per record (Discogs have/want ratio)
   - Filters: genre, decade, country, format, condition
   - Physical condition tracking (Goldmine Standard)

2. **Rede Social (Social Network)** — Collective value. Grows with users.
   - Activity feed (what followed diggers are doing)
   - Public profiles with collection showcase (URL-addressable)
   - Follow system
   - Collection comparison between users
   - Wantlist matching: see who on the platform has what you want

3. **Comunidade (Community)** — Groups for shared interests.
   - Auto-generated groups by genre (exist day 1, never empty)
   - User-created groups (free-form themes, e.g. "Blue Note Originals SP")
   - Groups can be public (open) or private (invite-only)
   - Group feed: member posts (text + optional linked record) + reviews
   - Moderation: deferred to later phase

4. **Gamificação (Gamification)** — Motivates contribution and return.
   - Global rank = rarity score + social contribution (trades, reviews, activity)
   - Per-genre leaderboards
   - Badges for milestones (first import, 100 records, first trade, first review)
   - Profile titles by rank tier ("Crate Digger" → "Wax Prophet")

5. **Trades P2P** — Audio exchange directly between browsers.
   - Trade linked to an audio file the user owns (not necessarily physical record)
   - WebRTC browser-to-browser transfer — zero server file storage
   - Audio spectrum analysis: verify if file is genuine analog (not digital upscale)
   - Post-trade quality rating → sharer reputation score
   - Legal prerequisite: DMCA agent registration before any trade is enabled

## First Day Experience

New user lands on app → immediately sees live content (global feed, active groups, rare records in spotlight) without needing to import first.

Alongside, a 3-step progress bar:
```
[ Connect Discogs ] → [ Follow 3 diggers ] → [ Join a group ]
```
Each step completed unlocks more of the app and awards a welcome badge. Users without Discogs see value immediately (social content); users with Discogs have a clear setup path.

## Home Screen Decision

Feed and Profile have equal weight — both are primary entry points. Feed-first for social diggers; Profile-first for collection-focused diggers. Neither is secondary.

## Current Milestone: v1.3 Local Library — Soulseek-Inspired Collection Import

**Goal:** Ampliar o DigSwap para diggers que não usam Discogs — importar coleção direto de arquivos locais no PC, com IA organizando metadata e o desktop app rodando em background como daemon.

**Target features:**
- Tray mode + background daemon — app minimiza pro system tray, roda sempre-on
- Scan de pasta local — seleciona pasta, scan recursivo de arquivos de áudio
- Extração de metadata — lê tags ID3/Vorbis + nome de arquivo + estrutura de pastas
- IA organizadora (Gemini Flash) — infere artista/álbum/faixa quando metadata é bagunçada
- File watcher em tempo real — detecta adição/remoção de arquivos enquanto app está no tray
- Diff scan no startup — ao reabrir o app, compara índice salvo vs estado atual da pasta
- Sync com coleção no servidor — items aparecem no web app igual Discogs (source: "local")
- Busca YouTube automática — para cada release identificado
- Startup automático — opção de iniciar com o Windows

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

**Phase 6: Discovery + Notifications** *(2026-03-26)*
- [x] Search across all user collections to find who has a specific record (DISC2-01)
- [x] Genre/decade browse across all user collections, sorted by rarity (DISC2-02)
- [x] Automatic wantlist matching — notify user when someone adds a record from their wantlist (DISC2-03)
- [x] Taste-match suggestions based on collection and followed users (DISC2-04)
- [x] In-app notification bell with Supabase Realtime delivery and unread badge (NOTF-01)
- [x] Email notifications for wantlist matches via Resend (NOTF-02, partial — trade request email in Phase 9)
- [x] Per-type notification preferences in settings with phase badges for deferred types (NOTF-04)

### Active

**Discovery & Matching**
- [x] Search across all user collections to find who has a specific record — *Validated in Phase 6*
- [x] Automatic wantlist matching — *Validated in Phase 6*
- [x] Recommendation engine based on collection taste — *Validated in Phase 6 (SQL-based taste match)*
- [ ] Discogs library import (collection + wantlist) with manual sync option

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
- [ ] Free tier: full social features, 5 P2P trades/month, 1 spectrum analysis per trade
- [ ] Premium tier (~$8/month): unlimited P2P trades, unlimited spectrum analysis, deep collection analytics, unlimited private groups, priority wantlist matching
- [ ] Conversion trigger: hitting trade/analysis limit mid-session naturally converts free users

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
| WebRTC for P2P (no server file storage) | Legal "mere conduit" posture — platform not liable for content users share | — Pending Phase 9 |
| Discogs have/want ratio as rarity base | Discogs is the authoritative data source for vinyl rarity in the community | ✓ Phase 4: implemented |
| Web-first (no native mobile v1) | Solo developer constraint — web reaches all platforms without maintaining two codebases | — Pending |
| Freemium model (not subscription) | Lower barrier to adoption; proves willingness to pay before locking in subscription model | ✓ Defined: free=5 trades/mo + 1 analysis/trade; premium=unlimited+analytics+groups |
| Trade linked to audio file, not physical record | Digger may have audio without owning the physical disc today | ✓ Defined 2026-03-25 |
| Audio spectrum analysis as premium conversion trigger | Solves real digger pain (analog vs digital upscale verification); free with 1/trade limit drives upgrades | ✓ Defined 2026-03-25 |
| Auto-generated groups by genre + user-created groups (hybrid) | Auto groups ensure day-1 content; user groups enable niche communities | ✓ Defined 2026-03-25 |
| First day: global feed visible before import (B+C hybrid) | Reduces friction for new users without Discogs while guiding Discogs users through setup | ✓ Defined 2026-03-25 |
| Feed and Profile as equal primary entry points | Serves both community-first and collection-first digger personas | ✓ Defined 2026-03-25 |
| Security-first development | Pen testing and security tests generated during development — not bolted on at the end | ✓ Phase 1: vitest unit + integration + Playwright E2E scaffolds; OWASP headers + rate limiting live |
| Claude aesthetics prompting for frontend | Distinctive retro/analog visual identity using Anthropic cookbook methodology | ✓ Phase 1: Fraunces + DM Sans, OKLCH dark-warm palette, SVG grain texture |
| Full DB schema in Phase 1 (not incremental) | Prevents painful migrations in later phases | ✓ Phase 1: 20 tables, 59 RLS policies, all v1 domains covered |
| Max 3 simultaneous sessions, persist until logout | UX convenience (D-13/D-14); custom user_sessions table required (Supabase no native limit) | ✓ Phase 1: enforceSessionLimit() with oldest-first eviction |
| getClaims() not getSession() in all server code | getSession() doesn't validate JWT signature — security risk | ✓ Phase 1: enforced in middleware, all server actions, session management |

---

## Evolution

This document evolves at phase transitions and milestone boundaries.

*Last updated: 2026-04-14 — Milestone v1.3 started (Local Library)*

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
