# Milestones

## v1.3 Local Library (Shipped: 2026-04-15)

**Phases completed:** 33 phases, 121 plans, 207 tasks

**Key accomplishments:**

- Next.js 15 project with VinylDig dark-warm design system (OKLCH, Fraunces/DM Sans, grain texture), 12 shadcn/ui components, Biome linting, and OWASP security headers
- Complete Drizzle ORM schema with 20 tables, 59 RLS policies, and custom session/backup-code tables for Supabase PostgreSQL
- Commit:
- Email/password auth flows with react-hook-form, Zod validation, Supabase server actions, rate limiting, and OAuth social login buttons
- OAuth callback handler with PKCE code exchange, forgot/reset password flows with OWASP-compliant rate-limited server actions
- TOTP 2FA enrollment with QR code and backup codes, login challenge at /signin/2fa, and disable flow using Supabase MFA API + bcryptjs-hashed backup codes
- 3-step onboarding wizard with profile setup, 2FA suggestion, and Discogs placeholder using server actions and step indicator
- Session management with 3-session limit enforcement, plus 63-test auth/security suite covering backup codes, validation schemas, and OWASP security headers
- 1. [Rule 1 - Bug] Whitespace around path separators breaks regex matching
- Library IPC handlers wired to 4-state LibraryScreen with flat list and album-grouped views, Biblioteca tab in AppShell
- import_jobs schema, Discogs client factory with Vault token retrieval, Zustand import store, type contracts, and 27 Wave 0 test stubs across 7 test files
- 42 real test implementations across 7 files replacing all Wave 0 stubs, plus human-verified end-to-end Discogs integration flow (OAuth connect, import progress, settings management, disconnect)
- 1. [Rule 1 - Bug] Removed audioFormat/bitrate/sampleRate from collection item upsert
- Incremental sync manager with batch HTTP, filesystem deletion detection via release_mappings lookup, and IPC trigger from renderer
- isNull(deletedAt) filter added to 19 files across collection queries, discovery, radar, comparison, gems, stats, and trade queries; local-only releases excluded from gem scoring
- System tray integration with close-to-tray, boot-to-tray, and auto-start IPC using Electron built-in APIs
- chokidar file watcher with 2-min debounce and startup diff scan for automatic library sync
- 1. [Rule 1 - Bug] library-ipc.ts unsafe TrackRow-to-LibraryTrack cast
- 1. [Rule 1 - Bug] TypeScript narrowing error on screenState === "enriching" in disabled check
- 3-column collection comparison page at /perfil/[username]/compare with accent-colored columns for unique-to-you (blue), in-common (green), and unique-to-them (orange) records
- NotificationBell with Supabase Realtime subscription, unread badge, Popover dropdown, and paginated /notifications page wired into AppHeader
- 7-test NotificationBell unit suite covering Realtime subscription lifecycle + badge overflow, with human verification confirming all Phase 6 Discovery and Notifications surfaces functional end-to-end
- Complete trade lifecycle schema, server actions, query functions, WebRTC chunked-transfer utility, and 27 passing tests across 8 scaffold files
- WantlistMatchSection with SHOW_ONLY_MATCHES/VIEW_FULL_CRATE toggle wired into public profiles via server-side intersection query and ProfileCollectionSection client state wrapper
- 65 security test stubs across 7 categories, 4 Zod validation schemas, nonce-based CSP replacing unsafe-inline, and open redirect fix in auth callback
- Rate limiting on all 13 unprotected server action files with 3 Upstash tiers, Zod input validation on community/profile, ilike wildcard injection fix, email HTML injection fix, and 81 passing security tests across 5 suites
- Auth bypass tests covering all 15 server action files, RLS coverage verification for all 14 tables, automated server action security audit, ZAP baseline scan passed with no HIGH/MEDIUM alerts, and human sign-off on full SEC-02/SEC-03/SEC-04 compliance
- `src/lib/crates/types.ts`
- Installed:
- `src/components/crates/add-to-crate-popover.tsx`
- Phase:
- Repository restructured into a pnpm workspace monorepo, existing web app moved to `apps/web`, `apps/desktop` scaffolded as a placeholder package, and `packages/trade-domain` created as a pure shared contract boundary.
- apps/desktop is now a real Electron workspace with a locked-down BrowserWindow, digswap:// protocol handling, main-process Supabase OAuth, safeStorage-backed session persistence, and a typed preload bridge ready for Claude's renderer work.
- Found during:
- One-liner:
- Schema alignment verified (8/8 PASS), full test suite green (563 tests), TypeScript clean, 74/74 audit vulnerabilities closed
- 6-tier gem classification system with GemBadge component, SQL distribution queries, 7 CSS keyframe animations, and 55 passing unit tests
- Gem-weighted ranking SQL function replacing ln(1+rarity_score) with tiered CASE expression, recalibrated thresholds, and updated leaderboard queries
- Complete RarityPill-to-GemBadge migration across 17 files covering collection, feed, explore, release, compare, profile, leaderboard, and notifications
- GemVault profile visualization with 6-tier distribution bar, import-pipeline gem tier change notifications via Redis snapshots, and OG image updated to Gem Score
- Fixed 2 TypeScript errors in gem queries using standard double-cast pattern to unblock production build
- Patched 9 vite vulnerabilities (6 high, 3 moderate) across desktop, web, and trade-domain workspaces to achieve zero audit findings
- Removed stale lucide-react mock and updated 4 icon tests to assert Unicode glyphs via screen.getByText()
- LF line endings enforced via .gitattributes, all 96 CRLF format errors and 13 import sorting errors eliminated, auto-fixable lint issues resolved across 424 source files
- Zero biome lint errors achieved -- all a11y violations (labels, semantic elements, keyboard support) and suspicious code patterns (noArrayIndexKey, noImplicitAnyLet) resolved across 20+ component files
- Drizzle schema and SQL migration for collection visibility (tradeable/not_trading/private), audio quality metadata, and trade proposal counterproposal chain tables
- Server actions for three-state collection visibility (tradeable/not_trading/private) and audio quality metadata, with backward-compatible toggleOpenForTrade delegation and 24 passing tests
- 3-state visibility UI (tradeable/not_trading/private) on collection cards with VisibilitySelector component, updated trading tab, and public profile privacy filtering
- Server action layer for trade proposal lifecycle: create, counter, accept, decline with tier enforcement, turn order, round caps, and 14 passing TDD tests
- Side-by-side proposal builder at /trades/new/[userId] with dual collection columns, quality declaration modal, free/premium tier enforcement, and submit-to-createProposalAction flow
- Trade detail page now renders full counterproposal negotiation history as visual thread with Accept/Decline/Counter action bar for the active pending proposal
- End-to-end counterproposal flow: ?tradeId param triggers counter mode in ProposalBuilder routing to createCounterproposalAction, with batch-queried "Counter needed" badges on trade inbox threads
- TDD-driven FFmpeg pipeline for audio spec extraction, 2-minute stream-copy preview generation, and SHA-256 file hashing in the Electron main process
- Supabase Storage preview uploader, SHA-256 immutable DB write, and selectAndPrepareAudio IPC handler wiring the FFmpeg pipeline to the renderer trade flow
- TDD-driven multi-item P2P batch transfer wrapping chunked-transfer with per-item progress, non-blocking error continuation, and startFromIndex resume support
- Canvas-based Spek-style spectral visualizer and AudioPrepScreen with per-item upload flow wired into the desktop trade pipeline between lobby and transfer phases

---
