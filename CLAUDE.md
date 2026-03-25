<!-- GSD:project-start source:PROJECT.md -->
## Project

**VinylDig**

A social network for vinyl diggers — collectors who actively hunt for records. Users import their Discogs library, discover who has what they're looking for, compare collections with others, and trade audio rips of their vinyl via secure peer-to-peer connections. Gamified rankings reward both collection rarity and community contribution.

**Core Value:** A digger opens the app and immediately finds who has the record they've been hunting — and sees where they stand in the community.

### Constraints

- **Team**: Solo developer — all architecture decisions must favor simplicity and solo maintainability
- **Platform**: Web first (browser, responsive) — no mobile native in v1
- **Language**: English-first — global vinyl digger community
- **P2P**: WebRTC only — no server-side file storage, ever. Non-negotiable for legal posture
- **Discogs API**: Subject to rate limits and Discogs ToS — import/sync must be respectful of limits
- **Security**: OWASP Top 10 coverage mandatory. Pen testing required before launch
- **Frontend**: Claude aesthetics prompting methodology — distinctive design, retro/analog visual identity
- **Stack**: To be determined by research — no existing preferences, optimize for solo developer productivity
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Next.js | 15.x (latest 15.5+) | Full-stack framework | Server-first architecture, App Router, Server Actions, API routes, Turbopack dev server. Next.js 16 is available but 15 is the safer production choice for a solo developer -- 16 removes synchronous request APIs and renames middleware to proxy, creating migration friction with less ecosystem coverage. Start on 15, upgrade to 16 once the ecosystem stabilizes. | HIGH |
| React | 18.x | UI library | Next.js 15 ships with React 18. React 19 is available but Next.js 15 officially supports 18. Stick with what the framework bundles. | HIGH |
| TypeScript | 5.x | Type safety | Non-negotiable for a solo developer. Catches bugs at compile time, self-documents the codebase, and makes refactoring safe. Every file should be .ts/.tsx. | HIGH |
| Supabase | Latest (self-updating hosted) | Backend-as-a-Service | PostgreSQL database + Auth + Realtime subscriptions + Edge Functions + Storage -- all in one platform. A solo developer cannot afford to manage 4+ separate services. Supabase consolidates auth, database, realtime, and serverless functions with a generous free tier (500MB DB, 50K MAU auth, 1GB storage). Row Level Security provides database-level authorization that eliminates custom auth middleware. | HIGH |
| Drizzle ORM | 0.45.x | Database ORM | ~7.4KB bundle, zero dependencies, SQL-like syntax ("if you know SQL, you know Drizzle"). 90% smaller than Prisma, cold starts under 500ms vs Prisma's 1-3s. Critical for serverless/edge where Next.js API routes run. Works natively with Supabase PostgreSQL. Prisma 7 improved but Drizzle is still lighter and faster for serverless. | HIGH |
| Tailwind CSS | 4.2.x | Styling | 5x faster full builds, 100x faster incremental builds vs v3. CSS-first configuration via @theme directives -- no JavaScript config file needed. Perfect for the retro/analog aesthetic: define warm color palettes and vinyl textures as theme variables that auto-generate utility classes. | HIGH |
| shadcn/ui | Latest | Component library | Not a dependency -- copies component source directly into your project. Full ownership, zero runtime overhead, Tailwind-first. Provides 40+ production-ready components (cards, dialogs, forms, navigation, tables, badges) that can be restyled for the retro vinyl aesthetic. Saves months of building from scratch. | HIGH |
### Database & Caching
| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Supabase PostgreSQL | 15+ (managed) | Primary database | Relational data model fits social networks perfectly: users, collections, wantlists, trades, reviews, rankings. PostgreSQL's JSON columns handle flexible metadata. Full-text search for record discovery. Materialized views for pre-computed rankings. | HIGH |
| Upstash Redis | Serverless | Caching + Leaderboards | Redis sorted sets (ZADD/ZRANK/ZRANGE) are purpose-built for leaderboards -- O(log N) rank lookups with no expensive ORDER BY. Upstash free tier: 500K commands/month, 200GB bandwidth. Use for: leaderboard rankings, rate limiting Discogs API calls, session caching, hot data caching. Serverless model means no server to manage. | HIGH |
### Authentication & Payments
| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Supabase Auth | Bundled with Supabase | Authentication | 50K MAU free tier. Integrated Row Level Security means auth decisions happen at the database level -- users can only see their own data without writing middleware. Supports OAuth (for Discogs OAuth flow), email/password, magic links. One fewer service to manage vs Auth.js or Clerk. | HIGH |
| Stripe | Latest SDK | Payments/Subscriptions | Industry standard for freemium/subscription billing. Vercel provides an official Next.js subscription starter template (next.js + Supabase + Stripe). Webhooks sync subscription state to your database. Free until you process payments (2.9% + 30c per transaction). Supabase dashboard now has one-click Stripe Sync Engine integration. | HIGH |
### WebRTC / P2P File Transfer
| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| PeerJS | 1.5.x | WebRTC abstraction | Wraps RTCPeerConnection + RTCDataChannel with a clean API. Includes built-in signaling server (PeerServer) that can be self-hosted or cloud-hosted. 13K+ GitHub stars, actively maintained. Handles ICE negotiation, DTLS encryption (mandatory in WebRTC spec), and data channel setup. For file transfer: chunk files into 64KB segments, send via data channel, reassemble on receiver. | MEDIUM |
| PeerJS Server | 1.0.x | Signaling server | Open-source Node.js signaling server. Deploy alongside your app or as a separate service. Handles peer discovery and connection brokering only -- no file data passes through it. Self-hosting is critical for the "mere conduit" legal posture. | MEDIUM |
| Metered.ca TURN | Managed service | NAT traversal | ~15-20% of WebRTC connections fail without a TURN relay (symmetric NATs, restrictive firewalls). Start with Metered.ca's free tier or Google's free STUN servers for development. For production, either self-host coturn on a VPS or use Metered.ca's managed TURN. Budget $5-20/month for a low-traffic TURN relay. | MEDIUM |
### State Management & Data Fetching
| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Zustand | 5.x | Client-side state | 3KB bundle, minimal boilerplate, selector-based re-renders. Use for: WebRTC connection state, UI state (modals, filters, active tabs), client-side caches of frequently accessed data. Do NOT use for server data -- that belongs in React Server Components or SWR/React Query. | HIGH |
| TanStack Query (React Query) | 5.x | Server state management | Handles caching, background refetching, optimistic updates, and pagination for client-side data fetching. Use for: Discogs API calls from the client, paginated collection views, search results. Pairs with Supabase client for real-time data. | HIGH |
### Discogs Integration
| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| @lionralfs/discogs-client | 4.1.x | Discogs API client | The only actively maintained JavaScript Discogs client. Supports OAuth 1.0a, rate limit tracking via response headers, exponential backoff on 429s. Works in both Node.js and browsers (ESM + CommonJS). Use server-side only to protect OAuth secrets. | MEDIUM |
### Email & Notifications
| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| Supabase Realtime | Bundled | In-app notifications | Subscribe to database changes via WebSocket. When a wantlist match occurs (new INSERT into matches table), the subscribed client gets notified instantly. Uses PostgreSQL's LISTEN/NOTIFY under the hood. RLS ensures users only receive their own notifications. | HIGH |
| Resend | Latest SDK | Transactional email | 3,000 emails/month free (100/day). Built for developers, React Email templates, Next.js SDK. Use for: wantlist match notifications, trade requests, weekly digests, account verification. | HIGH |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| Drizzle Kit | Database migrations | `drizzle-kit push` for development, `drizzle-kit generate` + `drizzle-kit migrate` for production. Generates SQL migrations from TypeScript schema. |
| Biome | Linting + formatting | Replaces ESLint + Prettier with a single tool. 10-100x faster than ESLint. Single config file. Less tooling overhead for a solo developer. |
| Vitest | Unit/integration testing | Vite-native test runner, compatible with Jest API. Fast, works with TypeScript out of the box. |
| Playwright | E2E testing | Browser automation for testing WebRTC flows, auth flows, Stripe checkout. Chromium, Firefox, WebKit support. |
| Supabase CLI | Local development | Run Supabase locally with Docker. Database, Auth, Edge Functions all available offline. `supabase db diff` for migration generation. |
### Deployment & Infrastructure
| Technology | Purpose | Why Recommended | Confidence |
|------------|---------|-----------------|------------|
| Vercel | Hosting + CDN | Native Next.js optimization (ISR, Edge Functions, Fluid Compute). Free Hobby tier: unlimited deployments, 100GB bandwidth, 1M function invocations. Automatic preview deployments for every git push. Note: Hobby plan is non-commercial; upgrade to Pro ($20/mo) before charging users. | HIGH |
| Supabase Cloud | Database + Auth + Realtime | Managed PostgreSQL, automatic backups, connection pooling via PgBouncer. Free tier sufficient for MVP. Pro plan ($25/mo) when you need more than 500MB database or custom domains. | HIGH |
| Upstash | Redis + Rate Limiting | Serverless Redis, pay-per-request. Free tier: 500K commands/month. No server to maintain. | HIGH |
## Installation
# Create Next.js 15 project with TypeScript + Tailwind CSS v4
# Core dependencies
# UI components (shadcn/ui -- adds components into your project)
# Dev dependencies
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 15 | Next.js 16 | When the ecosystem (shadcn, Auth.js, tutorials) fully supports 16's renamed middleware/proxy pattern and removed sync APIs. Likely safe in 6 months. |
| Supabase | Firebase | If you need better mobile SDK support or are building React Native. Firebase's NoSQL model (Firestore) is a poor fit for the relational data in a social network with rankings. |
| Supabase Auth | Auth.js (NextAuth v5) | If you need to support 10+ OAuth providers beyond what Supabase offers, or if you leave Supabase entirely. Auth.js gives maximum flexibility but requires more integration work. |
| Drizzle ORM | Prisma 7 | If you prefer schema-first development with automated migrations. Prisma 7 removed the Rust engine and is now pure TypeScript, but Drizzle's serverless performance edge remains. |
| PeerJS | simple-peer | If you want lower-level WebRTC control and will build your own signaling server. simple-peer has higher weekly npm downloads (200K vs 34K) but requires you to wire up signaling from scratch. For a solo developer, PeerJS's built-in signaling is a significant time saver. |
| Zustand | Jotai | If your client state becomes deeply interconnected with many derived atoms. Jotai's atomic model prevents unnecessary re-renders in complex state graphs. For this project's relatively straightforward client state, Zustand's simplicity wins. |
| Upstash Redis | PostgreSQL-only rankings | If your leaderboard has under 10K users and updates infrequently. PostgreSQL with an indexed score column and RANK() window functions works fine at small scale. Add Redis when latency matters. |
| Vercel | Railway or Fly.io | If you need to run long-lived processes (e.g., background workers for Discogs sync jobs). Vercel's serverless model has execution time limits. Railway provides persistent containers. Consider Railway for a dedicated PeerJS signaling server. |
| Resend | Supabase Edge Functions + generic SMTP | If email volume exceeds 3K/month and you want to avoid Resend's paid tier. But Resend's DX with React Email templates is significantly better than raw SMTP. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Socket.IO for realtime | Adds a separate WebSocket server to manage. Supabase Realtime already provides WebSocket subscriptions backed by PostgreSQL LISTEN/NOTIFY. Don't run two real-time systems. | Supabase Realtime |
| MongoDB / Firestore | Social networks are inherently relational (users follow users, users own collections, collections reference records, records have reviews). Document databases create painful N+1 queries and data duplication for these patterns. | PostgreSQL via Supabase |
| Redux / Redux Toolkit | Massive boilerplate (actions, reducers, selectors, thunks) for what this app needs. Zustand provides the same centralized store pattern in 1/10th the code. | Zustand |
| Clerk for auth | $25/month after 10K MAU (Supabase Auth is free to 50K MAU). Clerk adds another vendor dependency and doesn't integrate with PostgreSQL RLS. Clerk is excellent but overkill when Supabase Auth is already in your stack. | Supabase Auth |
| ESLint + Prettier (separate) | Two tools, two configs, potential conflicts. Biome does both in a single binary, 10-100x faster. Fewer config files = less maintenance for a solo developer. | Biome |
| simple-peer-files | Thin wrapper around simple-peer with minimal maintenance (last commit years ago). Better to implement chunked file transfer directly with PeerJS's data channel -- it's ~50 lines of code. | PeerJS data channels + custom chunking |
| WebTorrent | Designed for BitTorrent-over-WebRTC. Overkill for 1-to-1 file transfers. Adds torrent protocol complexity (trackers, DHT, piece selection) that provides no benefit for direct peer-to-peer vinyl rip sharing. | PeerJS |
| Tailwind CSS v3 | v4 is stable (4.2.x), 5x faster builds, CSS-first config. No reason to start a new project on v3. | Tailwind CSS v4 |
| next lint (built-in) | Deprecated in Next.js 15.5+ (removal warning for v16). The built-in lint wrapper is being phased out in favor of using ESLint/Biome directly. | Biome |
## Stack Patterns by Variant
- Self-host coturn on a $5/month VPS (e.g., Hetzner, DigitalOcean)
- Configure PeerJS to use your coturn instance as TURN relay
- Monitor TURN relay bandwidth -- this is where costs can surprise you
- Because TURN relays all data through your server, which defeats "mere conduit" slightly but is necessary for connectivity
- Implement a background sync queue using Supabase Edge Functions + pg_cron
- Cache Discogs data aggressively in PostgreSQL (records rarely change)
- Sync collections incrementally (only fetch changes since last sync timestamp)
- Because bulk imports of large collections (5000+ records) at 60 req/min take 80+ minutes
- Migrate ranking computation to Upstash Redis sorted sets entirely
- Use PostgreSQL materialized views refreshed on a schedule (pg_cron every 15 min)
- Because Redis ZRANK is O(log N) vs PostgreSQL RANK() window function which scans the entire table
- Extend shadcn/ui components with custom Tailwind theme tokens (grain textures, warm amber/brown palette, serif typography)
- Use CSS backdrop-filter + noise SVGs for vinyl grain effects
- Because the "Claude aesthetics prompting" approach means generating distinctive CSS, not picking a pre-built theme
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 15.5.x | React 18.x | Next.js 15 officially supports React 18. React 19 is available but introduces breaking changes. |
| Next.js 15.5.x | Tailwind CSS 4.2.x | Works via `@tailwindcss/postcss` plugin. shadcn/ui CLI initializes with Tailwind v4 support. |
| Drizzle ORM 0.45.x | Supabase PostgreSQL | Use `postgres` driver (not `pg`). Set `prepare: false` in connection config when using Supabase's connection pooler (PgBouncer in transaction mode). |
| Drizzle ORM 0.45.x | Drizzle Kit 0.30.x | Kit version must match ORM version track. Check release notes when upgrading either. |
| PeerJS 1.5.x | PeerJS Server 1.0.x | Client and server versions are loosely coupled. Server provides REST API for peer discovery. |
| @supabase/supabase-js | @supabase/ssr | Use `@supabase/ssr` for Next.js App Router server-side auth. It replaces the deprecated `@supabase/auth-helpers-nextjs`. |
| Zustand 5.x | React 18.x | Zustand 5 dropped legacy React support. Requires React 18+. |
| shadcn/ui | Tailwind CSS 4.x | The CLI detects Tailwind v4 and uses `@theme` directives instead of `tailwind.config.js`. Components use updated v4 class names. |
| Stripe SDK | Supabase | Vercel's official subscription starter template validates this pairing. Use Stripe webhooks to sync to Supabase via API routes. |
## Architecture Decisions Driven by Stack
### Why This Stack Works for a Solo Developer
### Key Technical Constraints
- **Discogs API rate limit:** 60 authenticated requests/minute. Large collection imports (5000+ records) must be queued and processed over time. This is a background job problem -- Supabase Edge Functions + pg_cron handle it without a separate worker service.
- **WebRTC file size limits:** Browser data channels have no hard size limit, but large files (>100MB) should use chunked transfer with progress tracking. 64KB chunks are the standard practice.
- **Vercel function timeout:** 10 seconds on Hobby, 60 seconds on Pro. Long-running Discogs sync jobs must be broken into small batches or moved to Supabase Edge Functions (no timeout limit on self-hosted, 150s on hosted).
- **Supabase Realtime connection limit:** 200 concurrent connections on free tier, 500 on Pro. Sufficient for MVP but monitor as user base grows.
## Sources
- [Next.js 15 App Router Documentation](https://nextjs.org/docs/app/getting-started) -- HIGH confidence, official docs
- [Next.js 15 vs 16 Comparison](https://www.descope.com/blog/post/nextjs15-vs-nextjs16) -- HIGH confidence, verified with official upgrade guide
- [Supabase Documentation](https://supabase.com/docs) -- HIGH confidence, official docs
- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime) -- HIGH confidence, official docs
- [Supabase Auth Quick Start for Next.js](https://supabase.com/docs/guides/auth/quickstarts/nextjs) -- HIGH confidence, official docs
- [Drizzle ORM Documentation](https://orm.drizzle.team/) -- HIGH confidence, official docs
- [Drizzle vs Prisma Comparison](https://designrevision.com/blog/prisma-vs-drizzle) -- MEDIUM confidence, third-party but corroborated by multiple sources
- [PeerJS Documentation](https://peerjs.com/) -- MEDIUM confidence, official but smaller project
- [PeerJS GitHub](https://github.com/peers/peerjs) -- MEDIUM confidence, verified maintenance status
- [@lionralfs/discogs-client GitHub](https://github.com/lionralfs/discogs-client) -- MEDIUM confidence, actively maintained but niche library
- [Discogs API Documentation](https://www.discogs.com/developers) -- HIGH confidence, official API docs
- [Discogs API Rate Limits Forum](https://www.discogs.com/forum/thread/1104957) -- HIGH confidence, official forum
- [Tailwind CSS v4.0 Blog Post](https://tailwindcss.com/blog/tailwindcss-v4) -- HIGH confidence, official announcement
- [shadcn/ui Tailwind v4 Support](https://ui.shadcn.com/docs/tailwind-v4) -- HIGH confidence, official docs
- [Zustand npm](https://www.npmjs.com/package/zustand) -- HIGH confidence, package registry
- [Stripe Subscription Docs](https://docs.stripe.com/billing/subscriptions/build-subscriptions) -- HIGH confidence, official docs
- [Vercel Subscription Starter Template](https://github.com/vercel/nextjs-subscription-payments) -- HIGH confidence, official Vercel template
- [Upstash Redis Pricing](https://upstash.com/pricing/redis) -- HIGH confidence, official pricing page
- [Resend Next.js Integration](https://resend.com/nextjs) -- HIGH confidence, official docs
- [Redis Leaderboard System Design](https://systemdesign.one/leaderboard-system-design/) -- MEDIUM confidence, well-known system design reference
- [PostgreSQL vs Redis for Leaderboards](https://nickb.dev/blog/favoring-sql-over-redis-for-an-evergreen-leaderboard/) -- MEDIUM confidence, practitioner blog with benchmarks
- [WebRTC TURN Server Setup Guide](https://webrtc.ventures/2025/01/how-to-set-up-self-hosted-stun-turn-servers-for-webrtc-applications/) -- MEDIUM confidence, specialist blog
- [Metered.ca Open Relay Project](https://www.metered.ca/tools/openrelay/) -- MEDIUM confidence, service provider docs
- [Supabase vs PlanetScale Comparison](https://www.leanware.co/insights/supabase-vs-planetscale) -- MEDIUM confidence, third-party analysis
- [Auth Solutions Comparison (Clerk vs Supabase vs NextAuth)](https://medium.com/better-dev-nextjs-react/clerk-vs-supabase-auth-vs-nextauth-js-the-production-reality-nobody-tells-you-a4b8f0993e1b) -- MEDIUM confidence, practitioner analysis
- [State Management 2025 Guide](https://dev.to/hijazi313/state-management-in-2025-when-to-use-context-redux-zustand-or-jotai-2d2k) -- MEDIUM confidence, community analysis
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
