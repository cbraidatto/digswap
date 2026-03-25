# Phase 2: UI Shell + Navigation - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the persistent 4-tab navigation shell that wraps all authenticated content: Feed, Perfil, Explorar, Comunidade. Fixed bottom bar, logo + avatar header, styled empty states per tab, icon + Portuguese labels. NAV-01, NAV-02, NAV-03 must all be satisfied. This is pure shell/routing work — no real content for Feed, Explorar, or Comunidade (those are Phases 3–7).

</domain>

<decisions>
## Implementation Decisions

### Navigation Bar

- **D-01:** Bottom bar, always — fixed at the bottom of the viewport on all screen sizes. No responsive sidebar on desktop. Keeps implementation simple and matches social-app conventions (Instagram, TikTok style).
- **D-02:** 4 tabs in order: Feed → Perfil → Explorar → Comunidade.
- **D-03:** Active tab is visually distinct — amber accent (`#D4872C` / `oklch(0.65 0.14 60)`) on active icon + label; muted color on inactive tabs. No reset on within-tab navigation.
- **D-04:** Bottom bar sits above the browser chrome (fixed positioning) with safe-area inset support for iOS notch/home bar.

### Header

- **D-05:** Every authenticated page has a top header: VinylDig wordmark (Fraunces, left) + user avatar (right). Avatar click opens a dropdown with: Settings, Sign Out.
- **D-06:** Header is fixed at top. Content area scrolls between header and bottom bar.
- **D-07:** No per-tab title in header — the bottom bar active tab provides enough orientation.

### Tab Placeholder Content

- **D-08:** Feed, Explorar, and Comunidade tabs get unique styled empty states — not skeletons, not "coming soon" text. Each has a vinyl/music icon and copy that hints at the future feature:
  - **Feed:** 💿 "Your feed is warming up" / "Drops when you follow other diggers"
  - **Explorar:** 🔍 "Discover what's out there" / "Search across every collection on the platform"
  - **Comunidade:** 🎵 "Find your people" / "Connect with diggers who share your taste"
- **D-09:** Empty states use dark-warm styling — no white boxes, warm amber accents, Fraunces heading + DM Sans body.
- **D-10:** Perfil tab routes to the current user's own profile page (placeholder for Phase 4 — just shows display name and avatar from onboarding, with a link to settings).

### Tab Labels

- **D-11:** Icon + Portuguese text label on every tab. No icon-only or text-only. Labels: "Feed", "Perfil", "Explorar", "Comunidade".
- **D-12:** Icons are simple, recognizable: Feed = newspaper/record, Perfil = person, Explorar = magnifying glass, Comunidade = people group. Use Lucide icons where available; custom SVG only if Lucide doesn't have the right one.

### Routing Architecture

- **D-13:** Each tab lives in its own route group under `(protected)/`: `(protected)/(feed)/feed/page.tsx`, `(protected)/(profile)/perfil/page.tsx`, etc. This gives each tab its own layout and navigation stack.
- **D-14:** Deep links work — navigating directly to `/feed` or `/explorar` highlights the correct tab. Active tab detection via `usePathname()`.
- **D-15:** The layout wrapping all 4 tabs is `(protected)/layout.tsx` — it renders the header and bottom bar, and `{children}` is the tab content.

### Visual Identity (carried from Phase 1)

- Dark-only mode, no light mode.
- Background: `#0D0B09` (near-black), surface: `#1A1714`, amber accent: `#D4872C`.
- Grain texture via `.grain` wrapper (already in root layout — keep it).
- Typography: Fraunces (headings/wordmark), DM Sans (body/labels). CSS variables `--font-fraunces` and `--font-dm-sans` already set.
- Bottom bar background: slightly elevated surface (`#1A1714`) with a subtle top border in warm muted tone.

### Claude's Discretion

- Exact icon choices for each tab (within Lucide where possible)
- Bottom bar height and active indicator style (underline vs dot vs filled background)
- Avatar dropdown animation (fade vs slide)
- Empty state illustration style (SVG vs emoji vs Lucide icon)
- Safe-area inset CSS implementation details
- Whether to add a subtle background blur to fixed header/footer

</decisions>

<specifics>
## Specific Ideas

- Bottom bar feel: warm dark background matching the surface color, NOT a contrasting light bar. Seamless with the rest of the UI.
- Active tab indicator: amber color on icon + label is enough. No pill/capsule around the active tab — keep it minimal.
- The wordmark "VinylDig" in the header uses Fraunces — same as auth pages. Consistent brand.
- Empty states should feel thematic — not generic. Copy should speak to diggers ("warming up", "crate-digging vibes").
- Avatar in header: use the user's avatar image if set (from onboarding), fallback to initials in an amber circle.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project context
- `.planning/PROJECT.md` — Project vision, core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — NAV-01, NAV-02, NAV-03

### Roadmap
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, dependency chain

### Prior phase context
- `.planning/phases/01-foundation-authentication/01-CONTEXT.md` — Visual identity decisions (D-01..D-05), all locked

### Existing code (must read before implementing)
- `src/app/layout.tsx` — Root layout with fonts, grain wrapper, Toaster
- `src/app/globals.css` — OKLCH color variables, grain texture, spacing scale, skeleton shimmer
- `src/components/ui/` — Available shadcn components: button, card, avatar, badge, separator, skeleton, etc.
- `src/middleware.ts` — Route protection (protected paths list will need updating)
- `src/lib/supabase/middleware.ts` — Auth middleware pattern

### External references
- No external ADRs yet

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Avatar` component in `src/components/ui/avatar.tsx` — ready for user avatar in header dropdown
- `Button` component — for dropdown menu items
- `Separator` component — for dropdown dividers
- Existing `(protected)/` route group with middleware already protecting it
- Existing `settings/` page under `(protected)/` — accessible from avatar dropdown
- Skeleton shimmer already in `globals.css` — can use if needed

### Established Patterns
- Route groups: `(auth)/` for auth pages, `(protected)/` for authenticated pages — extend this for tab routes
- `usePathname()` from `next/navigation` — standard Next.js pattern for active tab detection
- Server actions pattern (all auth actions use this) — use for avatar dropdown sign out
- CSS custom properties (`--color-bg`, `--color-surface`, etc.) via `@theme` in globals.css

### Integration Points
- `src/middleware.ts` — protected paths list needs updating if new routes added outside existing patterns
- `src/app/(protected)/onboarding/` — after onboarding completes, redirect to `/feed` (Feed tab)
- `src/actions/auth.ts` — `signOut` server action already exists, use from avatar dropdown

</code_context>

<deferred>
## Deferred Ideas

- None surfaced during discussion.

</deferred>

---

*Phase: 02-ui-shell-navigation*
*Context gathered: 2026-03-25*
