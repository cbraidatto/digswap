# Phase 2: UI Shell + Navigation - Research

**Researched:** 2026-03-25
**Domain:** Next.js 15 App Router layouts, route groups, client-side navigation, shadcn/ui components, CSS safe-area insets
**Confidence:** HIGH

## Summary

Phase 2 is a pure frontend/routing phase that builds the persistent 4-tab navigation shell wrapping all authenticated content. The technical domain is well-understood: Next.js 15 App Router route groups for per-tab layouts, `usePathname()` for active tab detection, shadcn/ui `dropdown-menu` for the avatar menu, and fixed positioning with CSS safe-area insets for the bottom bar.

The existing codebase from Phase 1 provides solid foundations: a `(protected)/` route group (with `onboarding/` and `settings/` already inside), the Supabase auth middleware, OKLCH color variables in `globals.css`, font variables (`--font-fraunces`, `--font-dm-sans`), the `Avatar` component, and the grain texture overlay. The primary work is creating the `(protected)/layout.tsx` shell layout, building the `BottomBar` and `AppHeader` components, establishing the 4 tab route groups, and wiring up the avatar dropdown with a new `signOut` server action.

**Primary recommendation:** Use Next.js route groups under `(protected)/` for each tab, a single `(protected)/layout.tsx` for the shell (header + bottom bar + `{children}`), `usePathname()` with `startsWith()` matching for active tab detection, and install the shadcn `dropdown-menu` component for the avatar menu. Create a `signOut` server action (currently missing from the codebase).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Bottom bar, always -- fixed at the bottom of the viewport on all screen sizes. No responsive sidebar on desktop. Keeps implementation simple and matches social-app conventions (Instagram, TikTok style).
- **D-02:** 4 tabs in order: Feed -> Perfil -> Explorar -> Comunidade.
- **D-03:** Active tab is visually distinct -- amber accent (`#D4872C` / `oklch(0.65 0.14 60)`) on active icon + label; muted color on inactive tabs. No reset on within-tab navigation.
- **D-04:** Bottom bar sits above the browser chrome (fixed positioning) with safe-area inset support for iOS notch/home bar.
- **D-05:** Every authenticated page has a top header: VinylDig wordmark (Fraunces, left) + user avatar (right). Avatar click opens a dropdown with: Settings, Sign Out.
- **D-06:** Header is fixed at top. Content area scrolls between header and bottom bar.
- **D-07:** No per-tab title in header -- the bottom bar active tab provides enough orientation.
- **D-08:** Feed, Explorar, and Comunidade tabs get unique styled empty states -- not skeletons, not "coming soon" text. Each has a vinyl/music icon and copy that hints at the future feature.
- **D-09:** Empty states use dark-warm styling -- no white boxes, warm amber accents, Fraunces heading + DM Sans body.
- **D-10:** Perfil tab routes to the current user's own profile page (placeholder for Phase 4 -- just shows display name and avatar from onboarding, with a link to settings).
- **D-11:** Icon + Portuguese text label on every tab. No icon-only or text-only. Labels: "Feed", "Perfil", "Explorar", "Comunidade".
- **D-12:** Icons are simple, recognizable: Feed = newspaper/record, Perfil = person, Explorar = magnifying glass, Comunidade = people group. Use Lucide icons where available.
- **D-13:** Each tab lives in its own route group under `(protected)/`: `(protected)/(feed)/feed/page.tsx`, `(protected)/(profile)/perfil/page.tsx`, etc.
- **D-14:** Deep links work -- navigating directly to `/feed` or `/explorar` highlights the correct tab. Active tab detection via `usePathname()`.
- **D-15:** The layout wrapping all 4 tabs is `(protected)/layout.tsx` -- it renders the header and bottom bar, and `{children}` is the tab content.

### Claude's Discretion
- Exact icon choices for each tab (within Lucide where possible)
- Bottom bar height and active indicator style (underline vs dot vs filled background)
- Avatar dropdown animation (fade vs slide)
- Empty state illustration style (SVG vs emoji vs Lucide icon)
- Safe-area inset CSS implementation details
- Whether to add a subtle background blur to fixed header/footer

### Deferred Ideas (OUT OF SCOPE)
- None surfaced during discussion.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NAV-01 | App has 4 primary tabs: Feed, Perfil, Explorar, Comunidade | Route groups under `(protected)/` with per-tab route folders; `BottomBar` component with 4 `BottomBarItem` children; Lucide icons (Disc3, User, Search, Users) per UI-SPEC |
| NAV-02 | Active tab is visually indicated and persists on navigation | `usePathname()` with `startsWith()` matching in BottomBar client component; amber accent on active, muted on inactive; route groups prevent layout remount on within-tab navigation |
| NAV-03 | Each tab has its own navigation stack (deep links work within tabs) | Route groups `(feed)/`, `(profile)/`, `(explore)/`, `(community)/` each can have nested routes; deep link to `/feed/anything` highlights Feed tab because pathname starts with `/feed` |

</phase_requirements>

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.14 | App Router, route groups, layouts | Already installed. Route groups and nested layouts are the canonical pattern for tab-based navigation. |
| React | 19.1.0 | UI library | Already installed. Bundled by create-next-app. |
| lucide-react | ^1.6.0 | Tab icons | Already installed. Disc3, User, Search, Users icons confirmed available in Lucide. |
| @base-ui/react | ^1.3.0 | Primitive components | Already installed. shadcn base-nova preset uses Base UI primitives for dropdown-menu. |
| tailwind-merge | ^3.5.0 | Class merging | Already installed. Used by `cn()` utility. |
| clsx | ^2.1.1 | Conditional classes | Already installed. Used by `cn()` utility for active tab styling. |

### Supporting (to install)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn dropdown-menu | Latest (via CLI) | Avatar dropdown menu | Install via `npx shadcn@latest add dropdown-menu`. Provides DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator. Uses Base UI primitives (base-nova preset). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| shadcn dropdown-menu | Custom Radix/Base UI dropdown | No reason -- shadcn copies the component into your project with correct styling. Use shadcn. |
| `usePathname()` for active tab | Route group metadata or context | `usePathname()` is the standard Next.js pattern, zero additional complexity, works with deep links. |
| Fixed bottom bar | CSS `sticky` positioning | Fixed is correct here -- sticky requires a scroll container parent. Bottom bar must always be visible regardless of scroll position. |

**Installation:**
```bash
npx shadcn@latest add dropdown-menu
```

## Architecture Patterns

### Recommended Project Structure

```
src/
  app/
    (protected)/
      layout.tsx              # Shell layout: AppHeader + {children} + BottomBar
      (feed)/
        feed/
          page.tsx             # Feed empty state
      (profile)/
        perfil/
          page.tsx             # Profile placeholder (display name + avatar + settings link)
      (explore)/
        explorar/
          page.tsx             # Explorar empty state
      (community)/
        comunidade/
          page.tsx             # Comunidade empty state
      onboarding/              # Already exists -- keep as-is
        layout.tsx
        page.tsx
        2fa/page.tsx
      settings/                # Already exists -- keep as-is
        sessions/page.tsx
  components/
    shell/
      app-header.tsx           # Fixed top header: wordmark + avatar dropdown
      bottom-bar.tsx           # Fixed bottom navigation: 4 tabs
      bottom-bar-item.tsx      # Individual tab item: icon + label + active state
      user-avatar-menu.tsx     # Avatar + dropdown menu (Settings, Sign Out)
      empty-state.tsx          # Reusable empty state component (icon + heading + body)
  actions/
    auth.ts                    # Add signOut server action here (currently missing)
```

### Pattern 1: Shell Layout (Protected Layout)

**What:** A single `(protected)/layout.tsx` that renders the fixed header, scrollable content area, and fixed bottom bar around all authenticated pages.

**When to use:** Always -- this is the root layout for all authenticated content.

**Key constraint:** The onboarding flow and settings page also live under `(protected)/` but should NOT show the shell (no bottom bar, no header). The layout must conditionally render the shell only for tab routes. This is handled by checking `usePathname()` -- if the path starts with `/onboarding` or `/settings`, render `{children}` without the shell. Alternatively, use the route group structure so that onboarding/settings have their own layout that does not include the shell.

**Recommended approach:** The simplest approach is to create a nested route group for the "shelled" pages. However, CONTEXT.md D-15 explicitly states `(protected)/layout.tsx` renders the header and bottom bar. The cleanest implementation is:

```typescript
// src/app/(protected)/layout.tsx -- Server Component
// Reads user profile data, passes to client shell

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  // Fetch profile for avatar in header
  const [profile] = await db
    .select({
      displayName: profiles.displayName,
      avatarUrl: profiles.avatarUrl,
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  return (
    <AppShell
      user={{
        displayName: profile?.displayName ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}
```

**Critical consideration:** The onboarding layout already has its OWN layout.tsx that provides a different structure (centered, no header/bottom bar). Since onboarding is inside `(protected)/`, the `(protected)/layout.tsx` will wrap it. The `AppShell` client component must detect when it's rendering onboarding/settings and skip the shell chrome. Use `usePathname()` to check if the current path starts with `/onboarding` -- if so, render only `{children}`.

### Pattern 2: Active Tab Detection

**What:** Client component that uses `usePathname()` from `next/navigation` to determine which tab is active based on the current URL path.

**When to use:** In the `BottomBar` and `BottomBarItem` components.

**Example:**
```typescript
// Source: Next.js docs (usePathname)
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const TABS = [
  { href: "/feed", label: "Feed", icon: Disc3 },
  { href: "/perfil", label: "Perfil", icon: User },
  { href: "/explorar", label: "Explorar", icon: Search },
  { href: "/comunidade", label: "Comunidade", icon: Users },
] as const;

export function BottomBar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="...">
      {TABS.map((tab) => {
        const isActive = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={isActive ? "text-primary" : "text-muted-foreground"}
          >
            <tab.icon className="size-6" />
            <span className="text-xs font-semibold">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

### Pattern 3: Sign Out Server Action

**What:** A server action that calls `supabase.auth.signOut()` and redirects to `/signin`.

**When to use:** Called from the avatar dropdown "Sign Out" menu item.

**Example:**
```typescript
// Source: Supabase Auth docs
"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
```

**Important:** `signOut()` uses `scope: "local"` by default (signs out only the current session). This is correct -- D-13 allows up to 3 concurrent sessions, so global signout would unexpectedly terminate other sessions.

### Pattern 4: Route Groups for Tab Navigation Stacks

**What:** Each tab uses a route group `(groupName)/` to isolate its layout tree. This means navigating within a tab (e.g., from `/feed` to `/feed/post/123`) does not remount the shell layout or reset tab state.

**Why:** Next.js App Router preserves layout state on navigation within a layout tree. Route groups allow per-tab layouts without affecting the URL structure.

**Structure:**
```
(protected)/
  (feed)/feed/page.tsx         -> URL: /feed
  (feed)/feed/[id]/page.tsx    -> URL: /feed/123 (future)
  (profile)/perfil/page.tsx    -> URL: /perfil
  (explore)/explorar/page.tsx  -> URL: /explorar
  (community)/comunidade/page.tsx -> URL: /comunidade
```

### Anti-Patterns to Avoid

- **Putting the bottom bar in root layout:** The bottom bar and header belong ONLY in the protected layout. Auth pages and onboarding must NOT have them.
- **Using parallel routes (`@slot`) for tabs:** Parallel routes are for simultaneously rendered content in the same viewport. Tabs are mutually exclusive routes -- use route groups, not parallel routes.
- **Server Component for BottomBar:** `usePathname()` requires a client component. The bottom bar MUST be a client component. However, the shell layout itself can be a server component that passes data down to client children.
- **Hardcoding active tab via route group name:** Use `usePathname()` for active detection, not the route group name (which is not exposed at runtime).
- **Using `pathname === href` instead of `pathname.startsWith(href)`:** Exact match will break when navigating to sub-routes within a tab. Always use `startsWith()` for tab detection.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dropdown menu | Custom dropdown with state management | shadcn `dropdown-menu` (Base UI primitives) | Handles focus management, keyboard navigation, ARIA roles, click-outside-to-close, positioning. 100+ edge cases. |
| Active link detection | Custom context or state tracking | `usePathname()` from `next/navigation` | Built-in, SSR-compatible, updates on route changes automatically. |
| Safe-area insets | JavaScript measurement of notch height | CSS `env(safe-area-inset-bottom)` | Native CSS solution, no JS needed, works with `viewport-fit=cover` meta tag. |
| Avatar with fallback | Custom image loading + error handling | shadcn `Avatar` + `AvatarImage` + `AvatarFallback` | Already installed, handles loading states and fallback automatically. |
| Route protection | Custom auth checks per page | Existing middleware pattern in `src/middleware.ts` | Already working, just needs updated protected paths list. |

**Key insight:** This phase is almost entirely about composition -- assembling existing primitives (Next.js layouts, shadcn components, Lucide icons, Tailwind classes) into the shell. There is very little custom logic beyond the `signOut` action and profile data fetching.

## Common Pitfalls

### Pitfall 1: Missing viewport-fit=cover for safe-area-inset-bottom

**What goes wrong:** `env(safe-area-inset-bottom)` returns `0px` on iOS devices, causing the bottom bar to be hidden behind the home indicator bar.
**Why it happens:** The `env()` CSS function for safe-area insets only activates when the viewport meta tag includes `viewport-fit=cover`. Without it, iOS assumes the page does not extend into the safe area.
**How to avoid:** Add `viewport-fit: 'cover'` to the Next.js viewport export in `src/app/layout.tsx`:
```typescript
import type { Viewport } from "next";

export const viewport: Viewport = {
  viewportFit: "cover",
};
```
**Warning signs:** Bottom bar works on desktop/Android but clips behind home bar on iPhone.

### Pitfall 2: Protected layout wrapping onboarding/settings with shell chrome

**What goes wrong:** The header and bottom bar appear on the onboarding flow and settings page, breaking their layouts.
**Why it happens:** `(protected)/layout.tsx` wraps ALL routes under `(protected)/`, including `onboarding/` and `settings/`. If the layout unconditionally renders the shell, it will appear on pages that should not have it.
**How to avoid:** Two options:
1. **Pathname check in client component:** The `AppShell` checks `usePathname()` and conditionally renders the shell chrome only for tab routes (paths starting with `/feed`, `/perfil`, `/explorar`, `/comunidade`).
2. **Restructure routes:** Move tab routes into a nested route group `(protected)/(tabs)/` with its own layout.tsx for the shell, keeping onboarding/settings at the `(protected)/` level without shell chrome. However, this contradicts D-15 which specifies `(protected)/layout.tsx` for the shell.

**Recommended:** Option 1 (pathname check) because it matches the CONTEXT.md decision D-15 exactly.
**Warning signs:** Header/bottom bar appearing on the onboarding stepper.

### Pitfall 3: Middleware protectedPaths list not updated

**What goes wrong:** New tab routes (`/feed`, `/perfil`, `/explorar`, `/comunidade`) are accessible without authentication.
**Why it happens:** The middleware in `src/lib/supabase/middleware.ts` has a hardcoded `protectedPaths` array: `["/onboarding", "/settings", "/profile"]`. New tab routes need to be added.
**How to avoid:** Update the `protectedPaths` array to include all new routes: `/feed`, `/perfil`, `/explorar`, `/comunidade`. Or switch to a whitelist approach (only allow `/signin`, `/signup`, etc. as public routes, protect everything else).
**Warning signs:** Unauthenticated users can access tab pages.

### Pitfall 4: Onboarding redirect goes to `/` instead of `/feed`

**What goes wrong:** After completing onboarding, the user lands on the root `/` page (the placeholder landing page) instead of the Feed tab.
**Why it happens:** The `completeOnboarding()` action in `src/actions/onboarding.ts` returns `{ redirectTo: "/" }`, and the `onboarding-complete.tsx` component calls `router.push(result.redirectTo ?? "/")`. The root page is a static landing page, not the authenticated app.
**How to avoid:** Update `completeOnboarding()` to return `{ redirectTo: "/feed" }`. Also update the middleware redirect for authenticated users visiting auth routes to go to `/feed` instead of `/`.
**Warning signs:** After onboarding, user sees "Welcome" landing page instead of the Feed tab.

### Pitfall 5: Sign-in redirect goes to `/onboarding` unconditionally

**What goes wrong:** Returning users who completed onboarding are sent to `/onboarding` every time they sign in, which then redirects them to `/` (the landing page).
**Why it happens:** The `signIn` action in `src/actions/auth.ts` returns `{ redirectTo: "/onboarding" }` on success. The onboarding layout checks `onboardingCompleted` and redirects to `/` if already completed.
**How to avoid:** The signIn action (or the client-side handling) should check onboarding status and redirect to `/feed` if already completed, or `/onboarding` if not. Alternatively, keep the `/onboarding` redirect but update the onboarding layout's "already completed" redirect to go to `/feed` instead of `/`.
**Warning signs:** Extra redirect hop on every login.

### Pitfall 6: Z-index conflict with grain overlay

**What goes wrong:** The header or bottom bar appears behind the grain texture overlay.
**Why it happens:** The grain overlay in `globals.css` uses `z-index: 50`. If the header/bottom bar use a lower z-index, they will be covered.
**How to avoid:** Use `z-index: 40` for the header and bottom bar (as specified in UI-SPEC), which is BELOW the grain overlay (`z-index: 50`). The grain overlay has `pointer-events: none`, so it does not block interaction. This is correct behavior -- the grain should appear on top of everything for the visual effect.
**Warning signs:** None -- this is working as designed if the grain has `pointer-events: none`.

## Code Examples

### signOut Server Action (to be created)

```typescript
// src/actions/auth.ts -- add to existing file
// Source: Supabase Auth docs (auth-signout)

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/signin");
}
```

### Viewport Configuration (to be added)

```typescript
// src/app/layout.tsx -- add viewport export
// Source: Next.js docs (generate-viewport)

import type { Viewport } from "next";

export const viewport: Viewport = {
  viewportFit: "cover",
};
```

### Empty State Component Pattern

```typescript
// src/components/shell/empty-state.tsx
// Source: UI-SPEC empty state specification

import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  body: string;
}

export function EmptyState({ icon: Icon, heading, body }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <Icon
        className="size-12"
        style={{ color: "oklch(0.72 0.14 65 / 0.4)" }}
      />
      <h2 className="mt-8 font-heading text-xl font-semibold text-foreground">
        {heading}
      </h2>
      <p className="mt-2 max-w-[280px] text-base text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
```

### Bottom Bar Item with Active Detection

```typescript
// src/components/shell/bottom-bar-item.tsx
"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomBarItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
}

export function BottomBarItem({ href, label, icon: Icon, isActive }: BottomBarItemProps) {
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 transition-colors duration-150",
        isActive ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className="size-6" />
      <span className="text-xs font-semibold">{label}</span>
    </Link>
  );
}
```

### Profile Data Fetching for Header (Server Component)

```typescript
// Pattern for fetching user profile in (protected)/layout.tsx
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

const [profile] = await db
  .select({
    displayName: profiles.displayName,
    avatarUrl: profiles.avatarUrl,
  })
  .from(profiles)
  .where(eq(profiles.id, user.id))
  .limit(1);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pages/` directory routing | App Router with `app/` directory | Next.js 13+ (stable in 14+) | Route groups, nested layouts, server components |
| `getSession()` for auth | `getClaims()` for JWT validation | Supabase SSR best practice 2024+ | Project already uses this pattern exclusively |
| `tailwind.config.js` | `@theme inline` in CSS (Tailwind v4) | Tailwind 4.0 (2025) | Project already uses v4 CSS-first config |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Project already uses `@supabase/ssr` |
| Radix primitives (shadcn default) | Base UI primitives (base-nova preset) | shadcn 2025 | Project uses base-nova -- dropdown-menu will use Base UI primitives |
| `viewport` in metadata export | Separate `viewport` export | Next.js 14+ | Must use `export const viewport: Viewport` not `metadata.viewport` |

## Open Questions

1. **Onboarding/settings shell exclusion strategy**
   - What we know: D-15 says `(protected)/layout.tsx` renders the shell. Onboarding and settings are under `(protected)/`.
   - What's unclear: Whether to use pathname checking or route restructuring.
   - Recommendation: Use pathname checking in the AppShell client component. If pathname starts with `/onboarding`, render only `{children}`. This keeps the file structure matching D-13/D-15 exactly.

2. **Root page (`/`) after Phase 2**
   - What we know: Currently a placeholder landing page. Onboarding redirects to `/`. Auth middleware redirects authenticated users from auth pages to `/`.
   - What's unclear: Should `/` redirect to `/feed` for authenticated users? Should it remain as a public landing page?
   - Recommendation: Add a redirect from `/` to `/feed` for authenticated users (in middleware or in the page itself). Keep the landing page for unauthenticated visitors.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x (unit/integration), Playwright 1.58.x (e2e) |
| Config file | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `npm test` |
| Full suite command | `npm test && npm run test:e2e` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NAV-01 | 4 tabs rendered with correct labels and icons | unit | `npx vitest run tests/unit/components/shell/bottom-bar.test.tsx` | Wave 0 |
| NAV-01 | 4 tabs visible in rendered page | e2e | `npx playwright test tests/e2e/navigation.spec.ts` | Wave 0 |
| NAV-02 | Active tab highlighted based on pathname | unit | `npx vitest run tests/unit/components/shell/bottom-bar.test.tsx` | Wave 0 |
| NAV-02 | Active tab persists on within-tab navigation | e2e | `npx playwright test tests/e2e/navigation.spec.ts` | Wave 0 |
| NAV-03 | Deep link to tab route highlights correct tab | e2e | `npx playwright test tests/e2e/navigation.spec.ts` | Wave 0 |
| NAV-03 | Route groups exist for each tab | unit (structure) | `npx vitest run tests/unit/routing/tab-routes.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test`
- **Per wave merge:** `npm test && npm run test:e2e`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/components/shell/bottom-bar.test.tsx` -- covers NAV-01, NAV-02 (renders 4 tabs, active state detection)
- [ ] `tests/e2e/navigation.spec.ts` -- covers NAV-01, NAV-02, NAV-03 (tab visibility, active state, deep links)
- [ ] `tests/unit/components/shell/app-header.test.tsx` -- covers header rendering (wordmark, avatar)
- [ ] `tests/unit/components/shell/empty-state.test.tsx` -- covers empty state rendering
- [ ] `tests/unit/actions/signout.test.ts` -- covers signOut server action

## Project Constraints (from CLAUDE.md)

- **Stack:** Next.js 15.x, React (bundled version), TypeScript, Supabase, Tailwind CSS 4.x, shadcn/ui
- **Frontend:** Claude aesthetics prompting methodology -- distinctive design, retro/analog visual identity
- **Security:** OWASP Top 10 coverage mandatory
- **P2P:** WebRTC only -- no server-side file storage (not relevant to this phase)
- **Language:** English-first (but tab labels are in Portuguese per user decision)
- **Testing:** Vitest for unit/integration, Playwright for E2E (Chromium-only per Phase 1 decision)
- **Linting:** Biome (not ESLint + Prettier)
- **Auth pattern:** `getClaims()` exclusively for JWT validation (never `getSession()`)
- **Conventions:** Dark-only mode, OKLCH colors, Fraunces headings + DM Sans body
- **Avoid:** Socket.IO, MongoDB, Redux, Clerk, ESLint+Prettier, simple-peer-files, WebTorrent, Tailwind v3, next lint

## Sources

### Primary (HIGH confidence)
- [Next.js App Router Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages) -- route groups, nested layouts
- [Next.js Route Groups](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups) -- `(group)` syntax
- [Next.js usePathname](https://nextjs.org/docs/app/api-reference/functions/use-pathname) -- active tab detection
- [Next.js generateViewport](https://nextjs.org/docs/app/api-reference/functions/generate-viewport) -- viewport-fit configuration
- [Supabase Auth signOut](https://supabase.com/docs/reference/javascript/auth-signout) -- signOut scope behavior
- [Supabase Auth Signing Out](https://supabase.com/docs/guides/auth/signout) -- signOut best practices
- [Lucide Icons - Disc3](https://lucide.dev/icons/disc-3) -- icon verification
- [shadcn/ui Dropdown Menu](https://ui.shadcn.com/docs/components/base/dropdown-menu) -- component API
- Existing codebase: `src/app/layout.tsx`, `src/app/globals.css`, `src/middleware.ts`, `src/lib/supabase/middleware.ts`, `src/actions/auth.ts`, `src/lib/db/schema/users.ts`

### Secondary (MEDIUM confidence)
- [How to Style Active Links in Next.js App Router](https://spacejelly.dev/posts/how-to-style-active-links-in-next-js-app-router) -- active link pattern
- [CSS env() Safe Area Insets](https://medium.com/@developerr.ayush/understanding-env-safe-area-insets-in-css-from-basics-to-react-and-tailwind-a0b65811a8ab) -- safe-area implementation
- [Next.js Advanced Routing](https://eastondev.com/blog/en/posts/dev/20251218-nextjs-advanced-routing/) -- route groups, nested layouts, parallel routes

### Tertiary (LOW confidence)
- None -- all findings verified with primary sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed, only dropdown-menu to add
- Architecture: HIGH -- Next.js route groups and layouts are well-documented, existing codebase patterns are clear
- Pitfalls: HIGH -- discovered concrete gaps (missing signOut action, missing viewport-fit, middleware paths, redirect targets) by reading the actual codebase

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable technologies, unlikely to change)
