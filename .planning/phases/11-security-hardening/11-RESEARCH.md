# Phase 11: Security Hardening - Research

**Researched:** 2026-03-28
**Domain:** Application security, OWASP compliance, penetration testing, Next.js + Supabase hardening
**Confidence:** HIGH

## Summary

Phase 11 is a security hardening pass over the entire DigSwap platform (Phases 1-10). The codebase already has a strong security foundation: rate-limited auth endpoints, Zod input validation, IDOR prevention on ownership-sensitive actions, RLS policies on all 14 database tables, OWASP security headers, and optimistic concurrency on trade state transitions. Recent quick tasks (260328-a21, 260328-8g4) closed P0 RLS bypasses and P1 race conditions.

The three open requirements are: (1) SEC-02: harden all API endpoints against injection, IDOR, broken access control, and rate limiting abuse; (2) SEC-03: security tests for every feature from Phases 1-10; (3) SEC-04: formal penetration test with all critical/high findings resolved. The primary gap areas are: no rate limiting outside auth endpoints (15 server action files unprotected), CSP uses `unsafe-inline` + `unsafe-eval` in production, several `select("*")` calls in server-side code, missing input validation on community/social actions, no automated security test suite, and no pen test infrastructure.

**Primary recommendation:** Structure the phase as four sequential workstreams: (1) CSP nonce-based hardening, (2) rate limiting + input validation across all surfaces, (3) comprehensive security test suite (Vitest unit + pgTAP RLS), (4) automated pen test with ZAP/manual review.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SEC-02 | All API endpoints protected against injection, IDOR, broken access control, and rate limiting abuse | Rate limiting expansion to all server actions; input validation audit; IDOR review of all 15 action files; CSP hardening to remove unsafe-inline/unsafe-eval |
| SEC-03 | Security tests exist for every feature developed in Phases 1-10 | Vitest security test suite covering auth, IDOR, rate limiting, input validation, RLS; pgTAP tests for database-level RLS policy verification |
| SEC-04 | Formal penetration test conducted before public launch | OWASP ZAP automated scan + manual review of Next.js-specific attack vectors (server action CSRF, Flight protocol, signaling auth) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

### Enforced Directives
- **OWASP Top 10 coverage mandatory** -- pen testing required before launch
- **Solo developer** -- all tooling must be automatable, no manual security team
- **WebRTC P2P only** -- no server-side file storage, ever (legal posture)
- **Stack**: Next.js 15, Supabase, Drizzle ORM, Upstash Redis, PeerJS, Stripe
- **Testing**: Vitest for unit/integration, Playwright for E2E
- **Linting**: Biome (not ESLint)
- **Playwright**: Chromium-only (multi-browser deferred from Phase 1 decision, but Phase 11 success criteria says security tests for all features -- multi-browser E2E is NOT a security requirement)

### Workflow
- GSD workflow enforcement -- all changes through GSD commands
- commit_docs enabled, nyquist_validation enabled

## Standard Stack

### Core Security Libraries (Already Installed)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| zod | 4.3.x | Input validation schemas | Installed -- used in auth only, needs expansion |
| @upstash/ratelimit | 2.0.x | Rate limiting | Installed -- auth endpoints only, needs expansion |
| @upstash/redis | 1.37.x | Rate limit backing store | Installed |
| bcryptjs | 3.0.x | Backup code hashing | Installed |

### Libraries to Add
| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| (none) | -- | -- | The existing stack covers all security needs. ZAP is a standalone tool, not an npm dependency. pgTAP runs in Supabase. No new dependencies required. |

### Pen Testing Tools (External)
| Tool | Purpose | How to Use |
|------|---------|------------|
| OWASP ZAP | Automated vulnerability scanning | Docker: `docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://localhost:3000` |
| Supabase CLI + pgTAP | Database-level RLS policy testing | `supabase test db` runs pgTAP tests in local Supabase |
| cURL / httpie | Manual endpoint probing | Test API routes, server action boundaries, auth bypass attempts |

**Installation:**
```bash
# No new npm dependencies needed
# ZAP runs via Docker (already installed: Docker 29.2.1)
docker pull ghcr.io/zaproxy/zaproxy:stable
```

## Architecture Patterns

### Recommended Project Structure for Security Additions
```
src/
  lib/
    rate-limit.ts          # EXPAND: add apiRateLimit, tradeRateLimit, discogsRateLimit
    validations/
      auth.ts              # EXISTS: auth input schemas
      community.ts         # NEW: group name, post content, review schemas
      trade.ts             # NEW: trade creation, review schemas
      profile.ts           # NEW: profile update, showcase schemas
      common.ts            # NEW: shared validators (uuid, pagination, sanitization)
    security/
      csp.ts               # NEW: nonce-based CSP generation
tests/
  security/                # NEW: dedicated security test directory
    auth-bypass.test.ts    # Server action auth enforcement
    idor.test.ts           # Ownership check coverage
    rate-limiting.test.ts  # Rate limit enforcement
    input-validation.test.ts # Injection resistance
    csp.test.ts            # CSP header correctness
    rls/                   # pgTAP test directory
      setup.sql            # Test helpers
      profiles.test.sql    # RLS policy tests per table
      trades.test.sql
      ...
```

### Pattern 1: Rate Limiting Server Actions
**What:** Add Upstash rate limiting to all server actions, not just auth
**When to use:** Every server action that mutates data or calls external APIs
**Example:**
```typescript
// Source: existing pattern in src/actions/auth.ts + Upstash docs
import { Ratelimit } from "@upstash/ratelimit";

export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "60 s"),
  analytics: true,
  prefix: "ratelimit:api",
});

// In server action:
async function someAction() {
  const user = await requireUser();
  const { success } = await apiRateLimit.limit(user.id);
  if (!success) {
    return { error: "Too many requests. Please wait a moment." };
  }
  // ... action logic
}
```

### Pattern 2: Nonce-Based CSP via Middleware
**What:** Replace static CSP with dynamic nonce-based CSP generated per-request in middleware
**When to use:** Production CSP that eliminates unsafe-inline/unsafe-eval
**Example:**
```typescript
// Source: https://nextjs.org/docs/app/guides/content-security-policy
// In middleware.ts -- generate nonce, set CSP header, pass nonce via x-nonce header
const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
const isDev = process.env.NODE_ENV === "development";
const cspHeader = `
  default-src 'self';
  script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
  style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com;
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://0.peerjs.com wss://0.peerjs.com;
  frame-ancestors 'none';
`;
```

**IMPORTANT:** This project uses Next.js 15 (not 16). Next.js 15 uses `middleware.ts`, NOT `proxy.ts`. The official docs reference `proxy.ts` because they target Next.js 16. For Next.js 15, implement the same logic inside `middleware.ts`.

**Impact on existing code:**
- `layout.tsx` has a `dangerouslySetInnerHTML` script for theme flash prevention -- must add `nonce` attribute
- `totp-setup.tsx` has `dangerouslySetInnerHTML` for QR code SVG -- SVG is trusted server data from Supabase MFA, safe with nonce
- All pages will become dynamically rendered (no ISR/static caching) -- acceptable for an authenticated social app
- CSP in `next.config.ts` headers section should be REMOVED once middleware handles it

### Pattern 3: Zod Validation Schemas for All Inputs
**What:** Create Zod schemas for every user-controlled input in every server action
**When to use:** Every server action that accepts user input (strings, numbers, IDs)
**Example:**
```typescript
// Source: existing pattern in src/lib/validations/auth.ts
import { z } from "zod";

export const uuidSchema = z.string().uuid("Invalid ID format");

export const createPostSchema = z.object({
  groupId: uuidSchema,
  content: z.string().min(1).max(5000).trim(),
  releaseId: uuidSchema.optional(),
});

export const paginationSchema = z.object({
  page: z.number().int().min(1).max(1000).default(1),
  cursor: z.string().uuid().optional(),
});
```

### Pattern 4: pgTAP RLS Testing
**What:** Database-level tests that verify RLS policies by impersonating different user roles
**When to use:** Testing that unauthenticated users, wrong users, and correct users get expected access
**Example:**
```sql
-- Source: https://supabase.com/docs/guides/local-development/testing/overview
-- Uses supabase-test-helpers for user simulation
BEGIN;
SELECT plan(3);

-- Test 1: anon cannot read profiles
SELECT tests.clear_authentication();
SELECT is_empty(
  $$ SELECT id FROM profiles LIMIT 1 $$,
  'Anon cannot read profiles'
);

-- Test 2: user can read own profile
SELECT tests.authenticate_as('test-user-1');
SELECT results_eq(
  $$ SELECT id FROM profiles WHERE id = tests.get_supabase_uid('test-user-1') $$,
  $$ VALUES (tests.get_supabase_uid('test-user-1')) $$,
  'User can read own profile'
);

-- Test 3: user cannot update another user profile
SELECT tests.authenticate_as('test-user-2');
SELECT throws_ok(
  $$ UPDATE profiles SET display_name = 'hacked' WHERE id = tests.get_supabase_uid('test-user-1') $$,
  'new row violates row-level security policy for table "profiles"'
);

SELECT * FROM finish();
ROLLBACK;
```

### Anti-Patterns to Avoid
- **select("*") in server-side code exposed to clients:** 4 instances found in codebase (import-worker.ts x2, discogs/import route.ts, trades/queries.ts). While these are server-side only and not directly exposed to clients, they risk leaking sensitive columns if code is refactored. Replace with explicit column selection.
- **String interpolation in ilike queries without sanitization:** Found in `profile.ts` (searchCollectionForShowcase) -- the `term` variable is not sanitized for SQL wildcard characters (`%`, `_`, `\`). The `social.ts` searchUsers already has sanitization -- apply the same pattern everywhere.
- **Throwing raw Error messages from server actions:** Some actions throw `new Error("Not authenticated")` which leaks implementation details to the client. Next.js serializes server action errors -- use `redirect()` or return error objects instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom token bucket | @upstash/ratelimit (already installed) | Distributed, Redis-backed, sliding window built-in |
| Input validation | Manual regex/string checks | Zod schemas (already installed) | Type-safe, composable, error messages included |
| CSP nonce generation | Custom random string | crypto.randomUUID() + base64 | Cryptographically secure, per Next.js official guide |
| Pen testing | Manual endpoint probing only | OWASP ZAP Docker baseline scan | Automated OWASP Top 10 coverage, reproducible |
| RLS testing | Application-level mocking | pgTAP + supabase-test-helpers | Tests actual PostgreSQL policies, not mocked behavior |
| Password hashing | Custom hash function | bcryptjs (already installed) | Industry standard, timing-safe comparison |
| CSRF protection | Custom token middleware | Next.js built-in (Server Actions use Origin/Host check) | Framework handles it; API routes need manual protection |

## Common Pitfalls

### Pitfall 1: ZAP Cannot Test Next.js Server Actions
**What goes wrong:** OWASP ZAP treats the Flight protocol body as opaque text and rejects malformed binary streams. Server actions appear "safe" when they are not scanned at all.
**Why it happens:** Server actions use React's Flight protocol (not standard JSON POST), which legacy scanners don't understand.
**How to avoid:** Supplement ZAP automated scanning with: (1) manual cURL-based testing of server action endpoints, (2) Vitest-based security unit tests that invoke server actions with malicious inputs, (3) use ZAP for API routes (standard REST endpoints it CAN scan).
**Warning signs:** ZAP reports zero findings on a non-trivial app. That means it did not actually test server actions.

### Pitfall 2: Nonce CSP Breaks Static Pages
**What goes wrong:** Moving to nonce-based CSP forces all pages to be dynamically rendered, killing ISR/static caching.
**Why it happens:** Nonces must be unique per request, which requires server rendering.
**How to avoid:** For this project, acceptable tradeoff -- the app is authenticated and mostly dynamic already. Alternative: use experimental SRI (hash-based) from Next.js 15 which allows static pages. But SRI is experimental and may change. Recommend nonce-based for security-critical launch.
**Warning signs:** TTFB increases on previously-static pages.

### Pitfall 3: Supabase Admin Client Bypasses RLS
**What goes wrong:** Server actions using `createAdminClient()` bypass ALL RLS policies by design. If an action does not properly verify the requesting user's authorization before mutating via admin client, IDOR vulnerabilities emerge.
**Why it happens:** Admin client is used intentionally (for cross-user operations like notifications, badge awards). But every admin client call MUST be preceded by explicit ownership/authorization checks.
**How to avoid:** Audit every `createAdminClient()` usage. For each call, verify: (1) the calling user is authenticated, (2) the user has authorization for the specific operation (participant check, ownership check, role check).
**Warning signs:** Server action accepts a `userId` parameter and uses it with admin client without verifying it matches the authenticated user.

### Pitfall 4: Open Redirect in Auth Callback
**What goes wrong:** The `/api/auth/callback` route accepts a `next` query parameter and redirects to it. An attacker could craft `?next=https://evil.com` to redirect users after authentication.
**Why it happens:** The `next` parameter is used for post-auth routing (e.g., password reset redirects to `/reset-password`).
**How to avoid:** Validate that `next` starts with `/` (relative path only) and does not contain `://` or `//`. Current code: `const next = searchParams.get("next") ?? "/onboarding"` -- needs validation.
**Warning signs:** `next` parameter used in `NextResponse.redirect()` without validation.

### Pitfall 5: Missing Rate Limits on Data-Mutating Actions
**What goes wrong:** Attackers can spam trade creation, follow/unfollow, group join/leave, post creation without any throttling.
**Why it happens:** Rate limiting was implemented for auth endpoints only (Phase 1). Non-auth server actions were deferred.
**How to avoid:** Add rate limiting to all data-mutating server actions. Group by category: trades (10/min), social (30/min), community (20/min), profile (10/min), discovery (60/min for read-only).
**Warning signs:** No `rateLimit.limit()` calls in action files outside `auth.ts` and `mfa.ts`.

### Pitfall 6: ilike SQL Wildcard Injection
**What goes wrong:** The `searchCollectionForShowcase` function in `profile.ts` passes user input directly to `ilike` without escaping SQL wildcard characters (`%`, `_`).
**Why it happens:** Drizzle's `ilike()` parameterizes the value (preventing SQL injection), but wildcards are interpreted by PostgreSQL's LIKE operator, allowing a user to craft a search pattern that matches unintended data.
**How to avoid:** Apply the same sanitization pattern used in `social.ts` searchUsers: `trimmed.replace(/[%_\\]/g, "\\$&")`.
**Warning signs:** `ilike` with unsanitized user input.

## Code Examples

### Rate Limiting Categories (to implement)
```typescript
// Source: pattern from src/lib/rate-limit.ts extended for all surfaces

// General API actions: 30 req per 60s per user
export const apiRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, "60 s"),
  analytics: true,
  prefix: "ratelimit:api",
});

// Trade actions: 10 req per 60s per user (high-cost operations)
export const tradeRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "60 s"),
  analytics: true,
  prefix: "ratelimit:trade",
});

// Discogs API proxy: 5 req per 60s per user (external rate limit protection)
export const discogsRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "60 s"),
  analytics: true,
  prefix: "ratelimit:discogs",
});

// File upload: 5 req per 300s per user
export const uploadRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "5 m"),
  analytics: true,
  prefix: "ratelimit:upload",
});
```

### Open Redirect Prevention
```typescript
// Source: OWASP Open Redirect Prevention Cheat Sheet
function validateRedirectPath(next: string | null): string {
  const fallback = "/onboarding";
  if (!next) return fallback;
  // Must start with / and not contain protocol or double slashes
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return fallback;
  }
  return next;
}
```

### UUID Validation for All ID Parameters
```typescript
// Source: Zod docs + existing project pattern
import { z } from "zod";

export const uuidSchema = z.string().uuid("Invalid identifier");

// Use in server actions:
const parsed = uuidSchema.safeParse(groupId);
if (!parsed.success) return { error: "Invalid group ID" };
```

## Existing Security Posture Inventory

### What Is Already Solid (from code audit)

| Surface | Protection | Status | Confidence |
|---------|-----------|--------|------------|
| Auth endpoints | Rate limiting (5/60s, 3/15m reset, 5/5m TOTP) | Complete | HIGH |
| Password storage | Supabase Auth (bcrypt under the hood) | Complete | HIGH |
| Backup codes | bcryptjs hash + atomic consumption | Complete | HIGH |
| Session management | JWT via getUser() (not getSession()), max 3 sessions | Complete | HIGH |
| Security headers | HSTS, X-Frame-Options DENY, X-Content-Type-Options, Permissions-Policy | Complete | HIGH |
| Email enumeration | Generic error messages on signup/login/reset | Complete | HIGH |
| OAuth token storage | Supabase Vault with table fallback | Complete | HIGH |
| Trade state transitions | Optimistic concurrency (compare-and-swap) | Complete | HIGH |
| RLS policies | All 14 tables have RLS enabled | Complete | HIGH |
| RLS dangerous policies | Removed trade_requests UPDATE and user_rankings UPDATE | Complete | HIGH |
| Trade reviews RLS | Hardened with correlated subquery (participant + counterparty check) | Complete | HIGH |
| IDOR on collection | updateConditionGrade uses `.eq(user_id, user.id)` | Complete | HIGH |
| IDOR on trades | All trade actions verify participant/requester/provider | Complete | HIGH |
| IDOR on notifications | markNotificationRead uses `.eq(user_id, user.id)` | Complete | HIGH |
| IDOR on wantlist | remove/markAsFound use `.eq(user_id, user.id)` | Complete | HIGH |
| Self-follow prevention | followUser checks `targetUserId === user.id` | Complete | HIGH |
| Import worker auth | Bearer token (IMPORT_WORKER_SECRET) | Complete | HIGH |
| Username search sanitization | SQL wildcard chars escaped in searchUsers | Complete | HIGH |

### What Needs Hardening (gaps found)

| Surface | Gap | Severity | Fix |
|---------|-----|----------|-----|
| CSP headers | `unsafe-inline` + `unsafe-eval` in production script-src | HIGH | Nonce-based CSP via middleware |
| Server actions (13 files) | No rate limiting outside auth/mfa | HIGH | Add Upstash rate limiting to all mutation actions |
| Auth callback | Open redirect via `next` param | HIGH | Validate relative path only |
| profile.ts searchCollectionForShowcase | ilike wildcard injection | MEDIUM | Escape `%`, `_`, `\` |
| profile.ts updateProfile | No validation on URL fields (youtubeUrl, etc.) | MEDIUM | Zod URL schema validation |
| community.ts createPostAction | Content length validated but no XSS sanitization | MEDIUM | CSP nonces handle XSS; add max-length Zod schema |
| community.ts createReviewAction | body/title not validated with Zod schema | MEDIUM | Add Zod review schema |
| trade email HTML | Template literal HTML with fileName variable | MEDIUM | Escape HTML entities in user-provided fileName |
| select("*") usage | 4 instances in server-side code | LOW | Replace with explicit column lists |
| Server action error leakage | `throw new Error()` messages serialized to client | LOW | Return error objects instead of throwing |
| OG image route | User-controlled display name/stats rendered in image | LOW | No XSS risk (ImageResponse is not HTML), but validate inputs |
| Stripe webhook verification | No webhook route exists yet (Phase 10 MON-* pending) | DEFERRED | Will be addressed when Stripe is integrated |
| fetchFollowersList/fetchFollowingList | Accept userId param without auth check on who can view | LOW | Public data by design (social network), but consider privacy settings |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Static CSP in next.config | Nonce-based CSP in middleware | Next.js 13.4.20+ | Eliminates unsafe-inline, per-request nonce |
| ESLint security plugins | Biome + manual review | Project decision | Biome does not have security-specific rules; supplement with automated security tests |
| Manual pen testing only | ZAP automated baseline + manual review | OWASP ZAP 2.x | Reproducible, CI-ready security scanning |
| Application-level RLS mocking | pgTAP database-level tests | Supabase test framework | Tests actual PostgreSQL policies, not mocked behavior |
| Next.js 16 proxy.ts for CSP | Next.js 15 middleware.ts | Project on Next.js 15 | Same pattern, different file name |

**Deprecated/outdated:**
- `@supabase/auth-helpers-nextjs`: replaced by `@supabase/ssr` (already using correct package)
- `getSession()` for auth: replaced by `getUser()` (already using correct pattern)
- Static CSP via next.config headers: replaced by middleware-generated nonce CSP

## Open Questions

1. **pgTAP test infrastructure availability**
   - What we know: Docker is installed (29.2.1), Supabase CLI availability is pending check
   - What's unclear: Whether `supabase test db` works in this project's local setup
   - Recommendation: Attempt `supabase test db` setup in Wave 0. If Supabase CLI is not available locally, fall back to Vitest-based RLS tests that use Supabase client with different auth contexts

2. **Multi-browser Playwright for pen testing**
   - What we know: Phase 1 decision locked Playwright to Chromium-only for speed
   - What's unclear: Whether SEC-04 pen test requires Firefox/WebKit coverage
   - Recommendation: Keep Chromium-only for automated security tests. Multi-browser is a QA concern, not a security requirement. Manual pen test with ZAP covers browser-agnostic HTTP-level vulnerabilities

3. **Stripe webhook route does not exist yet**
   - What we know: Phase 10 MON-* requirements are pending. No Stripe webhook verification code exists
   - What's unclear: Whether this phase should create the webhook verification skeleton
   - Recommendation: OUT OF SCOPE for Phase 11. Stripe integration is Phase 10 work. If Stripe routes exist by execution time, include them in the security audit

4. **form-action CSP directive**
   - What we know: Next.js Server Actions use POST to the current page URL. The CSP `form-action 'self'` directive is recommended
   - What's unclear: Whether this conflicts with any existing OAuth redirect flows (Discogs OAuth redirects to external domain)
   - Recommendation: Add `form-action 'self'` to CSP. OAuth redirects are server-side redirects (via NextResponse.redirect), not form submissions, so form-action should not conflict

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | ZAP pen testing | Yes | 29.2.1 | Manual cURL testing |
| Vitest | Security unit tests | Yes | 4.1.1 | -- |
| Playwright | E2E security tests | Yes | 1.58.2 | -- |
| Node.js | Runtime | Yes | 24.14.0 | -- |
| Upstash Redis | Rate limiting | Yes (via env) | Serverless | -- |
| Supabase CLI | pgTAP tests | Pending | -- | Vitest-based RLS tests with Supabase client |

**Missing dependencies with no fallback:**
- None

**Missing dependencies with fallback:**
- Supabase CLI: if not available, pgTAP tests can be replaced with application-level RLS verification tests using Supabase client auth context switching

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 + Playwright 1.58.2 |
| Config file | vitest.config.ts, playwright.config.ts |
| Quick run command | `npx vitest run tests/security/` |
| Full suite command | `npx vitest run && npx playwright test` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEC-02a | Rate limiting on all server actions | unit | `npx vitest run tests/security/rate-limiting.test.ts -x` | Wave 0 |
| SEC-02b | Input validation on all actions | unit | `npx vitest run tests/security/input-validation.test.ts -x` | Wave 0 |
| SEC-02c | IDOR prevention on all ownership-sensitive actions | unit | `npx vitest run tests/security/idor.test.ts -x` | Wave 0 |
| SEC-02d | CSP nonce-based headers | unit | `npx vitest run tests/security/csp.test.ts -x` | Wave 0 |
| SEC-02e | Open redirect prevention | unit | `npx vitest run tests/security/open-redirect.test.ts -x` | Wave 0 |
| SEC-03a | Auth security test coverage | unit | `npx vitest run tests/security/auth-bypass.test.ts -x` | Wave 0 |
| SEC-03b | RLS policy coverage | unit/pgTAP | `npx vitest run tests/security/rls-coverage.test.ts -x` | Wave 0 |
| SEC-04a | ZAP baseline scan passes | manual/automated | `docker run ... zap-baseline.py` | Wave 0 |
| SEC-04b | Manual server action audit | manual-only | Manual review with checklist | -- |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/security/ -x`
- **Per wave merge:** `npx vitest run && npx playwright test`
- **Phase gate:** Full suite green + ZAP baseline clean before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/security/rate-limiting.test.ts` -- covers SEC-02a
- [ ] `tests/security/input-validation.test.ts` -- covers SEC-02b
- [ ] `tests/security/idor.test.ts` -- covers SEC-02c
- [ ] `tests/security/csp.test.ts` -- covers SEC-02d
- [ ] `tests/security/open-redirect.test.ts` -- covers SEC-02e
- [ ] `tests/security/auth-bypass.test.ts` -- covers SEC-03a
- [ ] `tests/security/rls-coverage.test.ts` -- covers SEC-03b
- [ ] `src/lib/validations/community.ts` -- Zod schemas for community actions
- [ ] `src/lib/validations/trade.ts` -- Zod schemas for trade actions
- [ ] `src/lib/validations/profile.ts` -- Zod schemas for profile actions
- [ ] `src/lib/validations/common.ts` -- shared UUID, pagination, sanitization schemas

## Sources

### Primary (HIGH confidence)
- [Next.js CSP Guide](https://nextjs.org/docs/app/guides/content-security-policy) -- nonce-based CSP implementation for Next.js 15/16, verified 2026-03-25
- [Next.js Data Security Guide](https://nextjs.org/docs/app/guides/data-security) -- server action security model
- [Next.js Blog: How to Think About Security](https://nextjs.org/blog/security-nextjs-server-components-actions) -- Server Action CSRF protection (Origin/Host header check built-in)
- [Supabase RLS Docs](https://supabase.com/docs/guides/database/postgres/row-level-security) -- RLS best practices and testing
- [Supabase Testing Overview](https://supabase.com/docs/guides/local-development/testing/overview) -- pgTAP test framework for database-level testing
- [Supabase pgTAP Extension](https://supabase.com/docs/guides/database/extensions/pgtap) -- pgTAP setup and usage
- DigSwap codebase audit (all 15 server action files, 5 API routes, middleware.ts, next.config.ts) -- direct code review

### Secondary (MEDIUM confidence)
- [Arcjet Next.js Server Action Security](https://blog.arcjet.com/next-js-server-action-security/) -- server action attack vectors and defense patterns
- [Deepstrike Next.js Security Testing Guide](https://deepstrike.io/blog/nextjs-security-testing-bug-bounty-guide) -- ZAP limitations with Flight protocol
- [Supabase Test Helpers](https://github.com/usebasejump/supabase-test-helpers) -- community pgTAP helper library for RLS testing
- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv) -- RLS policy optimization

### Tertiary (LOW confidence)
- [CVE-2025-66478 Next.js Server Actions](https://www.penligent.ai/hackinglabs/unmasking-cve-2025-66478-the-silent-killer-in-next-js-server-actions/) -- specific CVE in server actions (needs verification against project's Next.js version 15.5.14)
- [OWASP Top 10 2025 Checklist](https://accuknox.com/blog/owasp-api-security-top-10-the-complete-testing-checklist-2026) -- OWASP API security categories for testing
- [Web App Pen Testing Checklist 2026](https://findsec.org/index.php/blog/521-web-application-penetration-testing-checklist-2026) -- comprehensive pen test methodology

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies needed, existing tools cover all requirements
- Architecture: HIGH -- patterns derived from official Next.js docs and existing codebase conventions
- Pitfalls: HIGH -- verified through direct codebase audit, all claims supported by code evidence
- Pen testing approach: MEDIUM -- ZAP limitations with server actions are well-documented but manual supplement needed

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable domain, 30-day validity)
