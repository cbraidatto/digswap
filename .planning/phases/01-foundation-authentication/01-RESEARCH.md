# Phase 1: Foundation + Authentication - Research

**Researched:** 2026-03-25
**Domain:** Next.js 15 project scaffolding, Supabase Auth (email/password, OAuth, TOTP MFA), Drizzle ORM schema design, dark-warm design system, OWASP auth compliance
**Confidence:** HIGH

## Summary

Phase 1 is the foundation layer for VinylDig -- a greenfield Next.js 15 project with Supabase as the backend. The scope covers project scaffolding (Next.js 15 + Tailwind v4 + shadcn/ui dark-warm theme), complete database schema definition via Drizzle ORM with RLS policies, and full authentication flows (email/password, Google/GitHub OAuth, TOTP 2FA, password reset, email verification, session management).

The most critical technical finding is that **Next.js 15 App Router requires React 19** (not React 18 as stated in the STACK.md research). The `create-next-app@15` CLI installs React 19 when App Router is selected. This is confirmed by the official Next.js 15 blog post. The STACK.md recommendation to use React 18 applies only to Pages Router, which this project does not use.

A second critical finding is that **Supabase Auth does not natively support "max N sessions per user"** -- it only supports single-session-per-user enforcement on Pro plans. The D-13 decision (max 3 simultaneous sessions) requires a custom implementation: tracking sessions in a custom table and invalidating the oldest when a 4th session is created. Additionally, **Supabase does not support backup/recovery codes for MFA** -- the recommended approach is enrolling a second TOTP factor as backup. The AUTH-06 requirement (backup codes) will need custom implementation.

**Primary recommendation:** Use `create-next-app@15` with App Router (which installs React 19), wire up Supabase Auth via `@supabase/ssr` with middleware-based token refresh using `getClaims()` (never `getSession()` in server code), define the full database schema in Drizzle ORM with Supabase RLS helpers, implement rate limiting via `@upstash/ratelimit`, and build custom session tracking to enforce the 3-session limit.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Dark-only mode -- no light mode, no OS preference toggle
- **D-02:** Mood: dark + warm -- near-black background with amber/orange/sepia accent palette
- **D-03:** Grain texture: subtle CSS grain on backgrounds
- **D-04:** Typography: Fraunces (display) + DM Sans (body) -- distinctive, non-generic fonts
- **D-05:** Use CSS variables for theme consistency across all components
- **D-06:** After signup/first login: onboarding flow (not direct to Feed). Steps: connect Discogs (optional) + set display name/avatar
- **D-07:** Email verification is mandatory -- account not activated until email verified. No grace period
- **D-08:** 2FA (TOTP) suggested during onboarding (not mandatory). Accessible in settings
- **D-09:** Social login (Google, GitHub) bypasses email verification
- **D-10:** Scaffold complete database schema in Phase 1 -- all tables for the full app
- **D-11:** Use Drizzle ORM for schema definition and migrations. PostgreSQL via Supabase
- **D-12:** Supabase RLS policies defined from the start for every table
- **D-13:** Maximum 3 simultaneous active sessions. 4th login invalidates oldest session
- **D-14:** Sessions persist until manual logout ("until sign out") -- no automatic expiry
- **D-15:** User can view all active sessions and terminate any from account settings
- **D-16:** Rate limiting on all auth endpoints
- **D-17:** Secure headers via Next.js config (CSP, HSTS, X-Frame-Options, etc.)
- **D-18:** Input validation and sanitization on all auth form fields
- **D-19:** CSRF protection on all mutation endpoints
- **D-20:** Security tests written alongside auth implementation

### Claude's Discretion
- Exact onboarding step count and copy
- Loading skeleton designs for auth pages
- Error message phrasing (clear without revealing security details)
- Exact grain CSS implementation (SVG filter vs CSS noise)
- shadcn/ui component customization level
- Supabase Edge Functions vs Vercel serverless for auth webhooks

### Deferred Ideas (OUT OF SCOPE)
- None -- discussion stayed within Phase 1 scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can sign up with email and password | Supabase Auth `signUp()` with email+password, mandatory email verification via "Confirm email" setting enabled in Supabase dashboard |
| AUTH-02 | User can log in with email and password and stay logged in across sessions | Supabase Auth `signInWithPassword()`, `@supabase/ssr` middleware refreshes tokens via `getClaims()`, custom session tracking table for D-13/D-14 |
| AUTH-03 | User can reset password via email link | Supabase Auth `resetPasswordForEmail()` sends reset link, `updateUser({ password })` on the reset page with PKCE flow |
| AUTH-04 | User can log in with Google or GitHub (OAuth social login) | Supabase Auth `signInWithOAuth({ provider })` for Google/GitHub, bypasses email verification per D-09 |
| AUTH-05 | User can enable two-factor authentication (TOTP) | Supabase Auth MFA API: `mfa.enroll()`, `mfa.challenge()`, `mfa.verify()`, QR code generation, AAL level checking |
| AUTH-06 | User can disable 2FA and recover access via backup codes | Supabase `mfa.unenroll()` for disabling. **Backup codes require custom implementation** -- Supabase only supports enrolling additional TOTP factors as backup, not recovery codes |
| SEC-01 | All authentication surfaces comply with OWASP Top 10 | Rate limiting via `@upstash/ratelimit`, secure headers in `next.config.ts`, input validation via Zod, CSRF via SameSite cookies + Server Actions |
</phase_requirements>

## Standard Stack

### Core (Phase 1 specific)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 15.5.14 | Full-stack framework | Latest stable 15.x. App Router with Server Components and Server Actions. Decision locked in CONTEXT.md |
| react / react-dom | 19.2.4 | UI library | **Required by Next.js 15 App Router.** STACK.md incorrectly states React 18 -- that only applies to Pages Router |
| typescript | 5.x | Type safety | Bundled with create-next-app. Non-negotiable for solo developer |
| @supabase/supabase-js | 2.100.0 | Supabase client SDK | Official SDK for auth, database, realtime |
| @supabase/ssr | 0.9.0 | Server-side auth for Next.js | Replaces deprecated `@supabase/auth-helpers-nextjs`. Handles cookie-based sessions in App Router |
| drizzle-orm | 0.45.1 | Database ORM | SQL-like TypeScript ORM. Lightweight, serverless-optimized. Decision locked |
| drizzle-kit | 0.31.10 | Schema migrations | Generates and runs PostgreSQL migrations from TypeScript schema |
| postgres | 3.4.8 | PostgreSQL driver | Required by Drizzle ORM for Supabase connection. Use `prepare: false` with connection pooler |
| tailwindcss | 4.2.2 | Styling | CSS-first config via `@theme` directives. OKLCH color format native. Decision locked |
| @tailwindcss/postcss | 4.2.2 | PostCSS plugin | Required for Tailwind v4 integration with Next.js |

### Supporting (Phase 1 specific)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.3.6 | Schema validation | All form validation (auth forms), Server Action input validation, API input sanitization |
| react-hook-form | 7.72.0 | Form state management | All auth forms (signup, signin, reset password, 2FA). Pairs with Zod via resolvers |
| @hookform/resolvers | 5.2.2 | Zod resolver for react-hook-form | Connects Zod schemas to react-hook-form validation |
| @upstash/ratelimit | 2.0.8 | Rate limiting | Auth endpoint rate limiting (D-16). Serverless, uses Redis |
| @upstash/redis | latest | Redis client | Required by @upstash/ratelimit. Serverless Redis |
| resend | 6.9.4 | Transactional email | Custom email templates for verification, password reset. 3K emails/month free |
| otpauth | 9.5.0 | TOTP library | QR code URI generation for 2FA setup display. Supabase handles verification, this handles display |
| qrcode | 1.5.4 | QR code generation | Generates QR code image from TOTP URI for 2FA enrollment |
| zustand | 5.0.12 | Client state | UI state (loading states, modal toggles, onboarding step tracking) |
| @biomejs/biome | 2.4.8 | Linting + formatting | Replaces ESLint + Prettier. Single tool, 10-100x faster |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-hook-form + zod | Conform (server-first forms) | Conform is better for progressive enhancement but has smaller ecosystem. RHF + Zod is more widely documented with shadcn/ui |
| @upstash/ratelimit | next-rate-limit (in-memory) | In-memory rate limiting resets on cold start; Upstash persists across serverless invocations |
| Custom backup codes | Supabase multiple TOTP factors | Supabase recommends enrolling a 2nd TOTP factor instead of backup codes. Custom backup codes (stored hashed in DB) are more user-friendly for AUTH-06 |
| otpauth + qrcode | Use Supabase's QR code SVG from enroll() | Supabase returns the TOTP URI and a QR code SVG. Using the built-in SVG avoids extra dependencies, but custom QR rendering allows styling control |

**Installation:**

```bash
# Create Next.js 15 project with TypeScript + Tailwind CSS v4 + App Router
npx create-next-app@15 vinyldig --typescript --tailwind --app --src-dir

# Core dependencies
npm install @supabase/supabase-js @supabase/ssr drizzle-orm postgres
npm install zod react-hook-form @hookform/resolvers
npm install @upstash/ratelimit @upstash/redis
npm install zustand resend qrcode
npm install -D @types/qrcode

# Dev dependencies
npm install -D drizzle-kit
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D @playwright/test
npm install -D @biomejs/biome

# UI components (shadcn/ui -- copies into project)
npx shadcn@latest init
npx shadcn@latest add button input label card form separator avatar skeleton badge sonner dialog alert
```

**Version verification note:** All versions above were verified against the npm registry on 2026-03-25. The `next@15.5.14` is the latest 15.x release. React 19.2.4 is installed automatically by `create-next-app@15` when using App Router.

## Architecture Patterns

### Recommended Project Structure

```
vinyldig/
├── src/
│   ├── app/                        # Next.js App Router pages
│   │   ├── (auth)/                 # Auth route group (no layout nesting)
│   │   │   ├── signin/page.tsx
│   │   │   ├── signup/page.tsx
│   │   │   ├── forgot-password/page.tsx
│   │   │   ├── reset-password/page.tsx
│   │   │   ├── verify-email/page.tsx
│   │   │   └── signin/2fa/page.tsx
│   │   ├── (protected)/            # Protected route group
│   │   │   └── onboarding/
│   │   │       ├── page.tsx
│   │   │       └── 2fa/page.tsx
│   │   ├── api/                    # API routes (rate limiting, webhooks)
│   │   │   └── auth/
│   │   │       └── callback/route.ts  # OAuth callback handler
│   │   ├── layout.tsx              # Root layout (fonts, grain, providers)
│   │   └── globals.css             # Theme CSS variables, grain texture
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components (auto-generated)
│   │   └── auth/                   # Auth-specific components
│   │       ├── sign-in-form.tsx
│   │       ├── sign-up-form.tsx
│   │       ├── forgot-password-form.tsx
│   │       ├── reset-password-form.tsx
│   │       ├── totp-setup.tsx
│   │       ├── totp-challenge.tsx
│   │       ├── social-login-buttons.tsx
│   │       └── auth-card.tsx       # Shared card layout wrapper
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser Supabase client (singleton)
│   │   │   ├── server.ts           # Server Supabase client (per-request)
│   │   │   └── admin.ts            # Service role client (bypasses RLS)
│   │   ├── db/
│   │   │   ├── index.ts            # Drizzle client instance
│   │   │   ├── schema/             # Drizzle schema files
│   │   │   │   ├── users.ts
│   │   │   │   ├── collections.ts
│   │   │   │   ├── releases.ts
│   │   │   │   ├── social.ts
│   │   │   │   ├── trades.ts
│   │   │   │   ├── notifications.ts
│   │   │   │   ├── gamification.ts
│   │   │   │   ├── subscriptions.ts
│   │   │   │   └── index.ts        # Re-exports all schemas
│   │   │   └── migrations/         # Generated migration files
│   │   ├── validations/
│   │   │   └── auth.ts             # Zod schemas for auth forms
│   │   ├── rate-limit.ts           # Upstash rate limiter config
│   │   └── utils.ts                # Shared utilities (cn helper, etc.)
│   ├── actions/
│   │   └── auth.ts                 # Server Actions for auth mutations
│   └── middleware.ts               # Auth token refresh + route protection
├── drizzle/                        # Generated migration SQL files
├── drizzle.config.ts               # Drizzle Kit configuration
├── biome.json                      # Biome linter/formatter config
├── next.config.ts                  # Security headers, CSP config
├── .env.local                      # Supabase URL, keys, Upstash credentials
└── tests/
    ├── unit/                       # Vitest unit tests
    │   ├── validations/
    │   │   └── auth.test.ts
    │   └── lib/
    │       └── rate-limit.test.ts
    ├── integration/                # Integration tests
    │   └── auth/
    │       ├── signup.test.ts
    │       └── session.test.ts
    └── e2e/                        # Playwright E2E tests
        ├── auth-flow.spec.ts
        └── onboarding.spec.ts
```

### Pattern 1: Supabase Auth with Next.js 15 Middleware

**What:** Cookie-based auth session management using `@supabase/ssr`. Middleware refreshes expired JWTs on every request. Server Components read auth state from cookies without client-side JavaScript.

**When to use:** Every page that needs auth state.

**Critical security rule:** Always use `supabase.auth.getClaims()` to protect pages and user data. **Never use `supabase.auth.getSession()` in server code** -- it does not revalidate the JWT signature.

**Example:**

```typescript
// src/lib/supabase/server.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

```typescript
// src/middleware.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh auth token -- MUST use getClaims(), never getSession()
  const { data: { claims } } = await supabase.auth.getClaims();
  const user = claims?.sub;

  // Redirect unauthenticated users from protected routes
  if (!user && request.nextUrl.pathname.startsWith("/(protected)")) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### Pattern 2: Custom Session Tracking (D-13: Max 3 Sessions)

**What:** Since Supabase only supports single-session-per-user (not N-session limit), implement custom session tracking in a `user_sessions` table. On each sign-in, record the session. If count exceeds 3, revoke the oldest via the Supabase Admin API.

**When to use:** Enforcing D-13 (max 3 simultaneous sessions).

**Example:**

```typescript
// src/lib/db/schema/sessions.ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";

export const userSessions = pgTable("user_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  sessionId: text("session_id").notNull().unique(), // Supabase session ID
  deviceInfo: text("device_info"),                   // User-Agent string
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow(),
});

// On sign-in (Server Action or auth webhook):
// 1. Insert new session record
// 2. Count active sessions for user
// 3. If count > 3, delete oldest and call supabase.auth.admin.signOut(sessionId)
```

### Pattern 3: Supabase MFA (TOTP 2FA) Flow

**What:** Three-step TOTP enrollment using Supabase's built-in MFA API. Check AAL levels to determine if 2FA challenge is required after login.

**When to use:** AUTH-05 (enable 2FA) and login flow for users with 2FA enabled.

**Important:** Supabase does NOT support backup/recovery codes. For AUTH-06, implement custom backup codes: generate 10 random codes at enrollment time, store their bcrypt hashes in the database, allow one-time use.

**Enrollment flow:**
1. `supabase.auth.mfa.enroll({ factorType: 'totp' })` -- returns QR code SVG + TOTP URI
2. User scans QR code with authenticator app
3. `supabase.auth.mfa.challenge({ factorId })` -- returns challenge ID
4. `supabase.auth.mfa.verify({ factorId, challengeId, code })` -- activates the factor

**Login challenge flow:**
1. After `signInWithPassword()`, check `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`
2. If `currentLevel === 'aal1'` and `nextLevel === 'aal2'`, redirect to 2FA challenge page
3. User enters TOTP code, call `challenge()` then `verify()`

**Disabling 2FA:**
- `supabase.auth.mfa.unenroll({ factorId })` -- requires aal2 (user must verify with a code first)

### Pattern 4: Drizzle ORM with Supabase RLS

**What:** Define all database tables in Drizzle with RLS policies using Supabase-specific helpers.

**When to use:** Every table definition.

**Example:**

```typescript
// src/lib/db/schema/users.ts
import { pgTable, uuid, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { pgPolicy } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { authenticatedRole, authUid } from "drizzle-orm/supabase";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),  // References auth.users.id
  displayName: varchar("display_name", { length: 50 }),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  discogsUsername: varchar("discogs_username", { length: 100 }),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  subscriptionTier: varchar("subscription_tier", { length: 20 }).default("free"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => [
  pgPolicy("profiles_select_policy", {
    for: "select",
    to: authenticatedRole,
    using: sql`true`,  // All authenticated users can view profiles
  }),
  pgPolicy("profiles_update_own", {
    for: "update",
    to: authenticatedRole,
    using: sql`${table.id} = ${authUid}`,
    withCheck: sql`${table.id} = ${authUid}`,
  }),
  pgPolicy("profiles_insert_own", {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`${table.id} = ${authUid}`,
  }),
]);
```

**Two Drizzle clients required:**
1. **RLS client** (uses anon key) -- for user-facing queries that respect row-level security
2. **Admin client** (uses service role key) -- for webhooks, background jobs, session management

```typescript
// src/lib/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Connection pooler URL (transaction mode) -- MUST set prepare: false
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle({ client, schema });
```

### Pattern 5: Rate Limiting with Upstash

**What:** Serverless rate limiting using Upstash Redis. Apply to all auth endpoints per D-16.

**When to use:** Auth Server Actions and API routes.

**Example:**

```typescript
// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Auth endpoints: 5 attempts per 60 seconds per IP
export const authRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  analytics: true,
  prefix: "ratelimit:auth",
});

// Password reset: 3 attempts per 15 minutes per email
export const resetRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, "15 m"),
  analytics: true,
  prefix: "ratelimit:reset",
});
```

### Anti-Patterns to Avoid

- **Never use `getSession()` in server code.** It does not validate the JWT signature. Use `getClaims()` instead. This is the single most common Supabase + Next.js security mistake.
- **Never store Supabase keys in client-side code beyond the anon key.** The service role key bypasses RLS and must only exist in server-side environment variables (not prefixed with `NEXT_PUBLIC_`).
- **Never skip `prepare: false` when using Supabase's connection pooler.** PgBouncer in transaction mode does not support prepared statements. Omitting this causes cryptic "prepared statement already exists" errors in production.
- **Never use the deprecated `@supabase/auth-helpers-nextjs`.** Use `@supabase/ssr` instead.
- **Never implement rate limiting in-memory for serverless.** State resets on cold start. Use Upstash Redis.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth session management | Custom JWT + cookie handling | `@supabase/ssr` middleware pattern | Cookie handling, token refresh, PKCE flow all built-in. Custom implementations miss edge cases (tab sync, token rotation race conditions) |
| Form validation | Custom regex validation | Zod schemas + react-hook-form | Zod provides composable, type-safe schemas that generate TypeScript types. Custom regex misses edge cases (Unicode emails, password complexity) |
| Rate limiting | Custom counter in database | `@upstash/ratelimit` | Sliding window algorithm, serverless-safe, sub-millisecond reads. Custom DB counters add latency and don't handle distributed serverless invocations |
| TOTP generation/verification | Custom HMAC-based TOTP | Supabase Auth MFA API | TOTP is deceptively complex (time drift, replay attacks, rate limiting challenges). Supabase handles all of this |
| QR code generation | Canvas-based QR rendering | `qrcode` library | QR encoding involves error correction levels, masking patterns, version selection. The library handles all standards compliance |
| Password hashing | bcrypt/argon2 manually | Supabase Auth | Supabase uses bcrypt with proper salt rounds. Manual hashing risks misconfigured work factors |
| OAuth flow | Custom OAuth state/PKCE | Supabase Auth `signInWithOAuth()` | OAuth has dozens of edge cases (CSRF via state param, PKCE code verifier, token exchange). Supabase handles the complete flow |
| CSS component primitives | Custom accessible components | shadcn/ui (Radix primitives) | Accessible dialogs, form controls, focus management are extremely complex. Radix provides WAI-ARIA compliant primitives |

**Key insight:** Authentication is the single worst domain to hand-roll. Every custom auth implementation accumulates security vulnerabilities over time. Supabase Auth handles password hashing, token rotation, OAuth flows, and MFA -- let it.

## Common Pitfalls

### Pitfall 1: Using getSession() Instead of getClaims() in Server Components

**What goes wrong:** `getSession()` returns session data from the cookie without revalidating the JWT. A forged or expired token passes through unchecked. This is the #1 security vulnerability in Supabase + Next.js applications.
**Why it happens:** Old tutorials and blog posts (pre-2025) all use `getSession()`. The `getClaims()` method is newer.
**How to avoid:** Search-and-replace: every occurrence of `getSession()` in server-side code must be `getClaims()`. Use `getUser()` when you need the full user object (makes a network call to Supabase Auth server).
**Warning signs:** Auth bypasses in security testing. Unauthenticated users accessing protected routes.

### Pitfall 2: Supabase "Confirm Email" Setting Misconfiguration

**What goes wrong:** Email verification is disabled in the Supabase dashboard (default for local dev). Users sign up and immediately get a session, bypassing D-07. Or, email verification is enabled but the PKCE callback URL is misconfigured, causing the verification link to 404.
**Why it happens:** Local development defaults differ from production. The Supabase local CLI starts with email confirmation disabled.
**How to avoid:** Explicitly enable "Confirm email" in Supabase dashboard settings. Configure the PKCE callback URL to `/api/auth/callback`. Test the full email verification flow in development using Supabase's Inbucket (local email capture).
**Warning signs:** Users appear in the auth.users table with `email_confirmed_at = null` but can access protected features.

### Pitfall 3: Missing `prepare: false` with Supabase Connection Pooler

**What goes wrong:** Drizzle queries work in development (direct connection) but fail in production with "prepared statement already exists" errors. This is because Supabase's connection pooler (Supavisor/PgBouncer) runs in transaction mode, which does not support prepared statements.
**Why it happens:** Developers use the direct database URL during development but the pooler URL in production, and the behavior differs.
**How to avoid:** Always pass `prepare: false` to the `postgres()` driver when connecting to Supabase. Use the pooler URL (`pooler.supabase.com`) in both development and production for consistency.
**Warning signs:** Intermittent query failures in production. Errors mentioning "prepared statement" in Vercel function logs.

### Pitfall 4: RLS Policies Not Applied to All Tables

**What goes wrong:** Tables are created without RLS policies. Since RLS defaults to "deny all" when enabled but no policies exist, queries return empty results. Or worse, RLS is not enabled at all (Supabase enables it by default for new tables, but Drizzle-managed tables need explicit policy definitions).
**Why it happens:** Scaffolding all tables in Phase 1 (D-10) means many tables won't have active features yet. Developers skip RLS for "future" tables.
**How to avoid:** Define at least a basic RLS policy for every table at creation time. For tables not yet active, add a policy that allows service role access only. Drizzle's Supabase helpers (`authenticatedRole`, `authUid`) make this straightforward.
**Warning signs:** Queries returning empty arrays when data exists. Service role queries working but anon key queries failing silently.

### Pitfall 5: OAuth Callback URL Mismatch

**What goes wrong:** Google/GitHub OAuth login redirects to a URL that doesn't match the configured callback in Supabase or the OAuth provider. The user sees an error after authenticating with the provider.
**Why it happens:** Three places must be configured identically: (1) Supabase dashboard Auth > URL Configuration, (2) Google Cloud Console / GitHub OAuth App settings, (3) the Next.js API route that handles the callback.
**How to avoid:** Use the canonical pattern: callback URL is `{site_url}/api/auth/callback`. Configure this exact URL in all three places. Test with both localhost and production domain.
**Warning signs:** OAuth redirects to a blank page or shows "invalid redirect_uri" error from Google/GitHub.

### Pitfall 6: Custom Backup Codes Stored in Plaintext

**What goes wrong:** AUTH-06 requires backup codes. Developer stores them as plain strings in the database. A database breach exposes all backup codes.
**Why it happens:** Backup codes feel less critical than passwords, so developers skip hashing.
**How to avoid:** Generate 10 random backup codes at MFA enrollment time. Hash each with bcrypt before storing. Show the plaintext codes to the user exactly once (on enrollment). When a backup code is used, mark it as consumed in the database. After all are used, prompt re-enrollment.
**Warning signs:** Backup codes visible in plaintext in the database. No "used" flag on backup code records.

### Pitfall 7: Next.js Security Headers Missing in next.config.ts

**What goes wrong:** The application deploys without Content Security Policy, HSTS, X-Frame-Options, or other security headers. Fails OWASP Top 10 compliance (SEC-01).
**Why it happens:** Security headers are not part of any Next.js template by default. Developers focus on features and forget headers.
**How to avoid:** Define headers in `next.config.ts` from the start. Use a strict CSP. Test with securityheaders.com or Mozilla Observatory.
**Warning signs:** "F" rating on securityheaders.com. XSS vulnerabilities in penetration testing.

## Code Examples

### Next.js Security Headers Configuration

```typescript
// next.config.ts
// Source: OWASP Secure Headers Project
import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // Tighten after initial setup
      "style-src 'self' 'unsafe-inline'",                  // Tailwind needs inline styles
      "img-src 'self' data: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
```

### Zod Auth Validation Schemas

```typescript
// src/lib/validations/auth.ts
import { z } from "zod";

export const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number")
    .regex(/[^A-Za-z0-9]/, "Must include a special character"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number")
    .regex(/[^A-Za-z0-9]/, "Must include a special character"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const totpSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits").regex(/^\d+$/, "Code must contain only numbers"),
});
```

### OAuth Callback Route Handler

```typescript
// src/app/api/auth/callback/route.ts
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth code exchange failed -- redirect to error page
  return NextResponse.redirect(`${origin}/signin?error=auth_callback_failed`);
}
```

### Server Action for Sign Up with Rate Limiting

```typescript
// src/actions/auth.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { authRateLimit } from "@/lib/rate-limit";
import { signUpSchema } from "@/lib/validations/auth";
import { headers } from "next/headers";

export async function signUp(formData: FormData) {
  const headerStore = await headers();
  const ip = headerStore.get("x-forwarded-for") ?? "anonymous";

  // Rate limit check
  const { success } = await authRateLimit.limit(ip);
  if (!success) {
    return { error: "Too many attempts. Please wait a moment before trying again." };
  }

  // Validate input
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/callback`,
    },
  });

  if (error) {
    // Generic error message -- never reveal if email exists (OWASP)
    return { error: "Could not create account. Please try again." };
  }

  // With "Confirm email" enabled, data.session is null
  return { success: true, message: "Check your inbox for a verification link." };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Old package deprecated. New package handles cookies correctly for App Router |
| `getSession()` for auth checks | `getClaims()` for auth checks | 2025 | `getClaims()` validates JWT signature. `getSession()` does not. Critical security improvement |
| React 18 with Next.js 15 | React 19 with Next.js 15 | Oct 2024 | App Router requires React 19. Only Pages Router supports React 18 |
| `tailwind.config.js` | CSS `@theme` directives | Tailwind v4 (2024) | No JavaScript config file needed. CSS-first configuration |
| HSL color format in shadcn/ui | OKLCH color format | shadcn + Tailwind v4 (2025) | Better perceptual uniformity. shadcn/ui now generates OKLCH variables |
| `eslint + prettier` | Biome | 2024-2025 | Single tool, 10-100x faster. Next.js 15.5+ deprecates built-in `next lint` |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`. No bug fixes or updates
- `getSession()` for server-side auth: Use `getClaims()` (JWT validation) or `getUser()` (network call)
- `tailwind.config.js`: Replaced by CSS `@theme` directives in Tailwind v4
- React 18 with App Router: Not supported. Next.js 15 App Router bundles React 19

## Open Questions

1. **Backup codes implementation for AUTH-06**
   - What we know: Supabase does not support recovery codes. Their recommendation is enrolling a second TOTP factor as backup.
   - What's unclear: Whether the user-facing requirement (AUTH-06) expects traditional backup codes (10 alphanumeric codes) or is satisfied by the "second TOTP factor" approach.
   - Recommendation: Implement custom backup codes (generate, hash with bcrypt, store in database, one-time use). This is more user-friendly than requiring a second authenticator app. Generate 10 codes at 2FA enrollment time.

2. **Session invalidation timing for D-13 (max 3 sessions)**
   - What we know: Custom session tracking table is needed. Supabase Admin API can sign out specific sessions.
   - What's unclear: Whether to invalidate on the server side immediately (requires Supabase service role client) or lazily on next token refresh (less disruptive but the 4th session exists briefly).
   - Recommendation: Immediate invalidation via `supabase.auth.admin.signOut(sessionId)` on the service role client. The oldest session is terminated the moment the 4th sign-in occurs.

3. **Supabase email verification in local development**
   - What we know: Local Supabase via CLI uses Inbucket for email capture. Email confirmation is disabled by default locally.
   - What's unclear: How to properly test the full PKCE email verification flow locally without the Supabase CLI (which requires Docker).
   - Recommendation: Install Supabase CLI (`npm i -D supabase`) and use `supabase start` for local development. Inbucket captures verification emails at `localhost:54324`. Alternatively, use the hosted Supabase project for development with real email delivery.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | 24.14.0 | -- |
| npm | Package management | Yes | 11.9.0 | -- |
| Git | Version control | Yes | 2.53.0 | -- |
| Docker | Supabase CLI local dev | Yes | 29.2.1 | Use hosted Supabase project instead of local |
| Supabase CLI | Local development | No | -- | Install via `npm i -D supabase` or use hosted Supabase project |

**Missing dependencies with no fallback:**
- None -- all critical dependencies are available.

**Missing dependencies with fallback:**
- Supabase CLI: Not installed globally. Install as dev dependency (`npm i -D supabase`) or use the hosted Supabase project for development. Docker is available, so `supabase start` will work after installation.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 + Playwright 1.58.2 |
| Config file | None yet -- created in Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run && npx playwright test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Sign up with email/password creates unverified account | integration | `npx vitest run tests/integration/auth/signup.test.ts -t "signup"` | No -- Wave 0 |
| AUTH-02 | Login with email/password returns valid session | integration | `npx vitest run tests/integration/auth/signin.test.ts -t "signin"` | No -- Wave 0 |
| AUTH-02 | Session persists across browser close/reopen | e2e | `npx playwright test tests/e2e/auth-flow.spec.ts -g "session persistence"` | No -- Wave 0 |
| AUTH-03 | Password reset email sent and reset link works | e2e | `npx playwright test tests/e2e/auth-flow.spec.ts -g "password reset"` | No -- Wave 0 |
| AUTH-04 | Google/GitHub OAuth redirects and creates account | e2e | `npx playwright test tests/e2e/auth-flow.spec.ts -g "oauth"` | No -- Wave 0 |
| AUTH-05 | TOTP enrollment generates QR code and verifies code | integration | `npx vitest run tests/integration/auth/mfa.test.ts -t "totp enrollment"` | No -- Wave 0 |
| AUTH-06 | Backup code allows login when TOTP unavailable | integration | `npx vitest run tests/integration/auth/mfa.test.ts -t "backup codes"` | No -- Wave 0 |
| AUTH-06 | 2FA can be disabled with valid TOTP code | integration | `npx vitest run tests/integration/auth/mfa.test.ts -t "disable 2fa"` | No -- Wave 0 |
| SEC-01 | Rate limiting blocks excessive login attempts | unit | `npx vitest run tests/unit/lib/rate-limit.test.ts` | No -- Wave 0 |
| SEC-01 | Security headers present on all responses | integration | `npx vitest run tests/integration/security/headers.test.ts` | No -- Wave 0 |
| SEC-01 | Zod validation rejects malformed auth input | unit | `npx vitest run tests/unit/validations/auth.test.ts` | No -- Wave 0 |
| D-13 | 4th login invalidates oldest session | integration | `npx vitest run tests/integration/auth/session.test.ts -t "session limit"` | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run && npx playwright test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `vitest.config.ts` -- Vitest configuration with jsdom environment, path aliases
- [ ] `playwright.config.ts` -- Playwright configuration with baseURL, webServer
- [ ] `tests/unit/validations/auth.test.ts` -- Zod schema validation tests (AUTH-01 input validation)
- [ ] `tests/unit/lib/rate-limit.test.ts` -- Rate limiter configuration tests (SEC-01)
- [ ] `tests/integration/auth/signup.test.ts` -- Signup flow tests (AUTH-01)
- [ ] `tests/integration/auth/signin.test.ts` -- Signin flow tests (AUTH-02)
- [ ] `tests/integration/auth/session.test.ts` -- Session management tests (D-13)
- [ ] `tests/integration/auth/mfa.test.ts` -- MFA enrollment and challenge tests (AUTH-05, AUTH-06)
- [ ] `tests/integration/security/headers.test.ts` -- Security headers tests (SEC-01)
- [ ] `tests/e2e/auth-flow.spec.ts` -- Full auth flow E2E (AUTH-01 through AUTH-04)
- [ ] `tests/e2e/onboarding.spec.ts` -- Onboarding flow E2E (D-06)
- [ ] Framework installs: `npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom @playwright/test`

## Project Constraints (from CLAUDE.md)

- **GSD Workflow Enforcement:** Before using Edit, Write, or other file-changing tools, start work through a GSD command. Use `/gsd:quick` for small fixes, `/gsd:debug` for investigation, `/gsd:execute-phase` for planned phase work. Do not make direct repo edits outside a GSD workflow unless explicitly asked.
- **Stack decisions locked:** Next.js 15, Supabase, Drizzle ORM, Tailwind v4, shadcn/ui. Research should not recommend alternatives.
- **Architecture not yet mapped:** This phase establishes the patterns all other phases follow.
- **Conventions not yet established:** Will populate as patterns emerge during development.
- **Project is greenfield:** No existing code, no existing patterns. Phase 1 sets the foundation.

## Sources

### Primary (HIGH confidence)
- [Supabase Auth Server-Side for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) -- middleware pattern, getClaims() vs getSession() security
- [Supabase MFA TOTP Documentation](https://supabase.com/docs/guides/auth/auth-mfa/totp) -- enroll/challenge/verify flow, AAL levels
- [Supabase User Sessions](https://supabase.com/docs/guides/auth/sessions) -- session lifecycle, single-session enforcement (Pro only), no N-session support
- [Supabase Password-based Auth](https://supabase.com/docs/guides/auth/passwords) -- signUp, email confirmation, PKCE flow
- [Drizzle ORM RLS Documentation](https://orm.drizzle.team/docs/rls) -- pgPolicy, Supabase helpers (authUid, authenticatedRole)
- [Drizzle ORM + Supabase Setup](https://orm.drizzle.team/docs/get-started/supabase-new) -- connection config, prepare: false, migration commands
- [Next.js 15 Blog Post](https://nextjs.org/blog/next-15) -- React 19 requirement for App Router, async request APIs
- [shadcn/ui Tailwind v4 Support](https://ui.shadcn.com/docs/tailwind-v4) -- OKLCH colors, @theme directives, component initialization
- [Supabase Auth Rate Limits](https://supabase.com/docs/guides/auth/rate-limits) -- built-in rate limits on auth endpoints
- npm registry (2026-03-25) -- verified all package versions

### Secondary (MEDIUM confidence)
- [Upstash Rate Limiting for Next.js](https://upstash.com/blog/nextjs-ratelimiting) -- sliding window pattern, middleware integration
- [Can React 18 be used with Next.js 15?](https://github.com/vercel/next.js/discussions/72795) -- community confirmation that App Router requires React 19
- [supasession GitHub](https://github.com/Snehil-Shah/supasession) -- third-party session limit extension (not recommended -- custom implementation preferred)
- [Supabase MFA Best Practices Discussion](https://github.com/orgs/supabase/discussions/16067) -- backup codes not supported, second factor recommended

### Tertiary (LOW confidence)
- None -- all findings verified with official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm registry, compatibility confirmed with official docs
- Architecture: HIGH -- patterns sourced from official Supabase + Next.js documentation, tested in production by many projects
- Pitfalls: HIGH -- based on official security advisories (getClaims vs getSession), documented Supabase limitations (no N-session support, no backup codes)
- Custom session tracking: MEDIUM -- the approach is sound but requires careful implementation of the Supabase Admin API for session invalidation
- Custom backup codes: MEDIUM -- standard practice but not documented in Supabase ecosystem; implementation is straightforward but needs proper security review

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (30 days -- stable ecosystem, no major releases expected)
