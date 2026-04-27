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

## Current Milestone: v1.4 Production Launch

**Goal:** Colocar o webapp do DigSwap no ar com segurança — primeira deploy de produção, com auditoria pré-deploy, setup de infraestrutura, smoke tests e UAT humano antes de liberar acesso real.

**Target features:**
- Pre-deploy audit — build, typecheck, tests, lint, migrations, env vars, secrets auditados antes de tocar em prod
- Supabase prod setup — projeto prod separado do dev, migrations aplicadas, RLS testada, Storage configurado, backups ativos
- Vercel + domínio — projeto Vercel criado, env vars, DNS Hostinger apontado, SSL validado
- Deploy + smoke tests automatizados — primeiro deploy real, health checks, Stripe webhook, OAuth callbacks atualizados
- Human UAT — fluxo completo testado como usuário real (signup, Discogs, trade, etc.)

**Scope notes:**
- Stack: Vercel + Supabase Cloud + Hostinger (só domínio)
- Desktop app fora de escopo — lançamento desktop vira milestone v1.5 separada (envolve code signing, VPS com PeerJS/coturn, auto-update)
- Solo dev, primeira deploy — plano explícito e verificável, sem atalhos

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

**Phase 34: Supabase Production Setup** *(2026-04-26)*
- [x] `digswap-prod` Supabase project provisioned (us-east-1, Free tier — `swyfhpgerzvvmoswkjyt`) (DEP-SB-01)
- [x] All 35 migrations applied via MCP (path-deviation #1 from CLI — same `supabase_migrations.schema_migrations` table; ADR-003 honored) (DEP-SB-02)
- [x] Security Advisor green — 0 ERROR, 0 "Tables without RLS" findings; 50 WARN advisory tracked as post-MVP (DEP-SB-03)
- [x] 2 Edge Functions deployed and ACTIVE: `cleanup-trade-previews` (200 with anon JWT) + `validate-preview` (401 to anon) (DEP-SB-04)
- [x] 3 active pg_cron jobs under role postgres: recalculate-rankings (15min), trade-preview-cleanup (hourly), purge-soft-deleted-collection-items (daily 3am) (DEP-SB-05)
- [x] Vault populated: `trade_preview_project_url` + `trade_preview_publishable_key` (legacy anon JWT, gateway-compatible) (DEP-SB-06)
- [x] `trade-previews` Storage bucket created (public=false, 10 audio MIME types). D-07 CORS task resolved as N/A (path-deviation #2 — per-bucket CORS doesn't exist in modern Supabase Storage; RLS policies on `storage.objects` are the actual security boundary, stronger than CORS) (DEP-SB-07)
- [x] DATABASE_URL pooler template documented (host `aws-0-us-east-1.pooler.supabase.com:6543`, `?pgbouncer=true`, `prepare: false`) — Phase 35 will paste real password directly to Vercel (DEP-SB-10)
- [DEFERRED] Supabase Pro tier + auto-pause off (DEP-SB-08) — Free-tier launch (CONTEXT.md D-03)
- [DEFERRED] PITR + rehearsed restore (DEP-SB-09) — Free-tier launch (CONTEXT.md D-05)

**Phase 35: Vercel + Environment Wiring** *(2026-04-26)*
- [x] Vercel project `digswap-web` (`prj_PK0FvmB3CI0kgEHlPPljuUfjIyzY`) created, GitHub `cbraidatto/digswap` linked, production branch=main, Node 20.x, framework=nextjs, Root Directory `apps/web` (DEP-VCL-01 + DEP-VCL-08)
- [x] 21 env vars in Production scope (real prod Supabase URL/keys + DATABASE_URL pooler shard `aws-1-us-east-1` + DEFERRED_PHASE_37 placeholders for Stripe/Discogs/Resend + DEFERRED_POST_MVP for YouTube/Upstash) (DEP-VCL-02)
- [x] 21 env vars in Preview scope sourced from dev `.env.local` — Pitfall #9 (preview-to-prod bleed) prevented by construction (DEP-VCL-03)
- [x] Exactly 7 NEXT_PUBLIC_* keys (Sentry intentionally excluded per D-08; Phase 39 owns) (DEP-VCL-05)
- [x] HANDOFF_HMAC_SECRET + IMPORT_WORKER_SECRET freshly generated via `openssl rand -hex 32 | vercel env add ... --sensitive` one-shot pipe (Pitfall #29) (DEP-VCL-06)
- [x] HSTS reduced to `max-age=300` for launch window (D-18 trigger to bump to 31536000 = Phase 38 + 1-week soak) (DEP-VCL-09)
- [x] First production deploy READY on `https://digswap-web.vercel.app` (commit `7ea20b7` via GitHub auto-deploy after 3 ERROR attempts: UPSTASH placeholder URL fix + secret-scan unblock + DATABASE_URL pooler shard correction) — `/api/health` returns `{"status":"healthy","checks":{"database":"ok"}}` (DEP-VCL-10)
- [x] Playwright anon smoke 16/16 PASS against `*.vercel.app` (5 pre-existing test-debt failures classified, NOT deploy regressions) (DEP-VCL-10)
- [DEFERRED-Phase-38] Post-build secret grep on `.next/static/` (DEP-VCL-04) — Vercel CLI 52.x encrypts artifacts at rest; needs local `vercel pull && vercel build` orchestration
- [DEFERRED-post-MVP] Vercel Pro upgrade (DEP-VCL-07) — Free-tier launch (CONTEXT.md D-03); trigger = first paying user

**Phase 36: DNS + SSL Cutover** *(2026-04-27)*
- [x] Production live on `https://digswap.com.br` — apex A `@` → `76.76.21.21` (Vercel) ttl=300 (DEP-DNS-01)
- [x] www subdomain on `https://www.digswap.com.br` — CNAME → `cname.vercel-dns.com.` ttl=300 (DEP-DNS-02)
- [x] Let's Encrypt R12 cert valid on apex AND www (separate certs, both auto-renewed by Vercel; ~30min ACME issuance window from DNS flip per RESEARCH §"Vercel ACME Timing Reality") (DEP-DNS-03)
- [x] DNS propagation confirmed from 4 independent networks: 1.1.1.1 (Cloudflare) + 8.8.8.8 (Google) + 9.9.9.9 (Quad9) + dns.google HTTP API — D-14 strengthening of ROADMAP "2+" floor (DEP-DNS-04)
- [x] CAA records audited via Google HTTP DNS — none exist on the zone, default-allow per RFC 8659 → Let's Encrypt unblocked (DEP-DNS-05)
- [x] TTLs at 300s on cutover records — drives ~5min rollback window (DEP-DNS-06)
- [x] www → apex 308 permanent redirect configured at Vercel project layer (D-07 verified live via `curl -sI`)
- [x] HSTS=300 launch-window honored on apex (D-18; bump to 31536000 deferred to Phase 38 + 1w soak)
- [x] /api/health 200 + database:ok on the new URL; Playwright anon suite IDENTICAL to Phase 35 baseline (16 PASS + 19 SKIP + 5 test-debt FAIL — zero regression from cutover)
- [x] 1-hour soak: 5/5 probes 200 (D-13)
- [N/A by D-04] DEP-DNS-07 (preserve MX) — no MX records existed at cutover time (email not yet configured); Phase 37 owns Resend MX/SPF/DKIM/DMARC
- [DEFERRED] Public announce gate per CONTEXT D-11 — site stays invite-only until Phase 38 UAT clean
- Path deviations logged: 6 (Vercel CLI single-arg, CNAME target fallback, TTL pre-lower no-op, PowerShell CAA enum gap, dig→nslookup substitution, aggregator grep case-sensitivity)

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

*Last updated: 2026-04-27 — Phase 36 (DNS + SSL Cutover) complete; production live on https://digswap.com.br with valid Let's Encrypt R12 cert (apex + www), www→apex 308, HSTS=300 launch-window, 1h soak 5/5 200; Phase 37 (External Integrations — Stripe/OAuth/Resend) and Phase 39 (Monitoring, parallel track) unblocked. Site is in invite-only mode per CONTEXT D-11 until Phase 38 UAT clean.*

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
