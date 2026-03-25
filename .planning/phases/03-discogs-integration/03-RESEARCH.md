# Phase 3: Discogs Integration - Research

**Researched:** 2026-03-25
**Domain:** OAuth 1.0a integration, background job processing, real-time progress, Discogs API
**Confidence:** HIGH

## Summary

Phase 3 connects VinylDig users to Discogs via OAuth 1.0a, imports their collection and wantlist asynchronously with real-time progress feedback, supports delta re-sync, and allows disconnection with full data cleanup. The existing codebase from Phases 1-2 provides a solid foundation: the `profiles`, `releases`, `collectionItems`, and `wantlistItems` Drizzle schemas are already defined with Discogs-specific columns (`discogsId`, `discogsInstanceId`, `addedVia`, `discogsConnected`, `discogsUsername`). The onboarding component `discogs-connect.tsx` has a disabled placeholder button ready to activate.

The core technical challenge is the background import pipeline. A collection of 5,000+ records at 100 items/page and 60 requests/minute takes 50+ pages and ~1 minute of pure API time -- but with rate limiting, realistic imports of large collections span 5-15 minutes. The architecture must decouple the import from the HTTP request lifecycle, persist progress, and stream updates to the client. Two viable approaches exist: Supabase Edge Functions with pg_cron (CLAUDE.md recommendation) or Next.js API routes with a database-driven job queue and self-invocation pattern. This research recommends the **Next.js API route approach with database job queue** as the primary pattern, because: (1) Edge Functions require Supabase CLI + Deno runtime setup not yet in the project, (2) Edge Functions are a separate deployment artifact from the Next.js app, adding operational complexity for a solo developer, and (3) Next.js API routes can achieve the same result using a chunked self-invocation pattern that stays within Vercel's timeout limits.

**Primary recommendation:** Use Next.js API routes with a `import_jobs` database table as the job queue. The API route processes one page of Discogs results per invocation (100 items), writes to the database, updates the job progress row, then re-invokes itself for the next page. Supabase Realtime Broadcast delivers progress to the client. OAuth tokens are stored encrypted in Supabase Vault.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Activate the existing disabled "Connect Discogs" button in the onboarding wizard (Phase 1 placeholder at `src/components/onboarding/discogs-connect.tsx`). This is the primary entry point.
- **D-02:** Also add a Discogs section to the Settings page (`/settings`) as a secondary entry point for users who skipped onboarding. Shows: connected account username, last synced timestamp, "Sync Now" button, and "Disconnect" option.
- **D-03:** OAuth callback triggers import immediately -- no confirmation screen. Flow: OAuth success -> import starts server-side -> user sees import progress screen. Zero extra taps.
- **D-04:** Real-time progress via Supabase Realtime subscription. Progress screen shows: progress bar, "342 / 1,247 records" count, and "Currently importing: [title] -- [artist]" beneath it. Updates live as records are written to DB.
- **D-05:** Import runs server-side (Edge Functions + pg_cron) -- user can safely close the tab and the import continues. Progress screen is navigable back to from Settings if user leaves.
- **D-06:** On import complete: 2-second success state on the progress screen ("Import complete! 1,247 records added") -> auto-redirect to `/perfil`. First experience of their collection.
- **D-07:** Import order: collection first, wantlist second (sequential). Wantlist import starts automatically after collection completes -- no user action needed.
- **D-08:** Records appear in the Perfil tab as they are imported -- no lock. Users can start browsing partial collection immediately.
- **D-09:** While import is running, a sticky banner is shown at the top of the Perfil tab: "Importing... 342/1,247". Tapping the banner navigates to the full import progress screen. Banner disappears when import finishes.
- **D-10:** Same sticky banner appears during manual re-sync.
- **D-11:** Delta sync strategy -- stores `last_synced_at` timestamp on the user's profile. Re-sync only fetches Discogs collection items added or modified since that timestamp. Fast for frequent syncs.
- **D-12:** Full re-import option available as a separate "Reset and re-import" action in Settings > Discogs (secondary, destructive-styled button).
- **D-13:** Sync button lives in Settings > Discogs section. During sync: button shows "Syncing..." (disabled). Last synced timestamp updates when complete.
- **D-14:** Hard delete on disconnect. Removing a Discogs connection deletes: all `collection_items` rows with `added_via = 'discogs'` for that user, and all wantlist items sourced from Discogs. The shared `releases` table is NOT purged. `profiles.discogs_connected` set to false, `discogs_username` cleared.
- **D-15:** Disconnect is confirmed with a single confirmation dialog before executing.

### Claude's Discretion
- Exact OAuth 1.0a request token -> authorize URL -> access token flow implementation details (using `@lionralfs/discogs-client`)
- Rate limit backoff implementation (exponential backoff on 429s, respect Retry-After header)
- pg_cron job schedule and Edge Function chunking strategy for the import queue
- Import job state storage schema (how progress is persisted so Realtime subscription can read it)
- Exact Supabase Realtime channel name and event shape for progress updates
- Error handling for partial import failures (network timeout mid-import)

### Deferred Ideas (OUT OF SCOPE)
- None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DISC-01 | User can connect their Discogs account via OAuth 1.0a | OAuth flow via `@lionralfs/discogs-client` DiscogsOAuth class; 3-step flow (request token -> authorize -> access token); API route callback handler pattern |
| DISC-02 | User can import their full Discogs collection (all owned records) | Collection endpoint `/users/{username}/collection/folders/0/releases` with pagination (100/page); background job queue with self-invocation; upsert into releases + collection_items tables |
| DISC-03 | User can import their Discogs wantlist | Wantlist endpoint via `client.user().wantlist().getReleases()`; sequential after collection import per D-07; upsert into releases + wantlist_items tables |
| DISC-04 | Import runs asynchronously with progress indicator | `import_jobs` table tracks state (pending/processing/completed/failed); Supabase Realtime Broadcast for live progress; sticky banner component for Perfil tab |
| DISC-05 | User can trigger manual sync to pull latest Discogs changes | Delta sync via `sort=added&sort_order=desc` and comparing `date_added` against `last_synced_at`; same job queue pattern as initial import |
| DISC-06 | User can disconnect their Discogs account and remove imported data | Hard delete of collection_items (addedVia='discogs') and wantlist_items for user; clear profile fields; Vault secret deletion; confirmation dialog |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Server-side only for OAuth secrets:** Discogs OAuth tokens must NEVER be exposed to client. Use server actions/API routes only.
- **getClaims() not getSession():** All server-side auth validation must use `getClaims()` per Phase 1 convention.
- **Drizzle ORM with `prepare: false`:** PgBouncer transaction mode compatibility. All DB operations through `db` from `@/lib/db`.
- **supabaseAuthAdminRole for service tables:** The `releases` table uses `supabaseAuthAdminRole` for insert/update. Import pipeline MUST use the admin client (`createAdminClient()`) to write releases.
- **Biome for linting, Vitest for tests, Playwright for E2E.**
- **Rate limit: 60 authenticated Discogs requests/minute.** Must implement exponential backoff on 429s.
- **CSP header in next.config.ts:** `connect-src` already includes `https://*.supabase.co wss://*.supabase.co`. May need `https://api.discogs.com` added for any client-side fetches (but all Discogs calls should be server-side, so likely not needed).
- **React 19.1.0** (not 18 as CLAUDE.md initially stated -- create-next-app bundled 19.1.0 per Phase 1 decision).

## Standard Stack

### Core (New Dependencies for Phase 3)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @lionralfs/discogs-client | 4.1.4 | Discogs API client with OAuth 1.0a | Only actively maintained JS Discogs client. Includes DiscogsOAuth class for the full OAuth dance, built-in rate limit tracking via response headers, configurable exponential backoff on 429s. Verified 4.1.4 on npm registry. |

### Already Installed (Phase 1)

| Library | Version | Purpose | Used For |
|---------|---------|---------|----------|
| @supabase/supabase-js | ^2.100.0 | Supabase client | Realtime subscriptions, Vault RPC, admin client for imports |
| @supabase/ssr | ^0.9.0 | Server-side Supabase | OAuth callback handling, server actions |
| drizzle-orm | ^0.45.1 | Database ORM | All DB read/write operations |
| @upstash/ratelimit | ^2.0.8 | Rate limiting | Discogs API rate limiting (optional secondary layer) |
| zustand | ^5.0.12 | Client state | Import progress state management |
| zod | ^4.3.6 | Validation | Schema validation for import data |
| sonner | ^2.0.7 | Toast notifications | Import success/error toasts |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next.js API routes for job queue | Supabase Edge Functions + pg_cron | Edge Functions require Supabase CLI setup (Deno runtime), separate deployment, and are a different execution environment. For a solo developer, keeping the import logic in the Next.js app simplifies debugging, testing, and deployment. Edge Functions are better at scale but overkill for MVP. |
| Database job table | Supabase pgmq (message queue) | pgmq adds queue semantics (visibility timeout, retry) but requires enabling the extension and learning a new API. A simple `import_jobs` table with status column achieves the same for this use case. |
| Supabase Realtime Broadcast | Supabase postgres_changes | postgres_changes requires adding tables to the realtime publication and has RLS overhead for each event. Broadcast is more performant and gives explicit control over what gets sent. |
| Supabase Vault | Encrypted column with pgcrypto | Vault is purpose-built for secrets, auto-manages encryption keys, and is accessible via SQL views. Manual pgcrypto is error-prone and requires key management. |

**Installation:**
```bash
npm install @lionralfs/discogs-client
```

No other new dependencies needed -- everything else is already installed.

## Architecture Patterns

### Recommended Project Structure (New Files)
```
src/
  actions/
    discogs.ts              # Server actions: connectDiscogs, disconnectDiscogs, triggerSync
  app/
    api/
      auth/
        callback/
          route.ts          # EXISTING - needs no change for Discogs
      discogs/
        callback/
          route.ts          # NEW: OAuth 1.0a callback (receives verifier, exchanges for access token)
        import/
          route.ts          # NEW: Background import worker (processes one page per invocation)
    (protected)/
      import-progress/
        page.tsx            # NEW: Full import progress screen (D-04, D-06)
      settings/
        page.tsx            # NEW or MODIFY: Settings page with Discogs section (D-02)
  components/
    discogs/
      import-progress.tsx   # NEW: Progress bar + current record display (client component)
      import-banner.tsx     # NEW: Sticky banner for Perfil tab (D-09, D-10)
      discogs-settings.tsx  # NEW: Settings > Discogs section card
      disconnect-dialog.tsx # NEW: Confirmation dialog for disconnect (D-15)
    onboarding/
      discogs-connect.tsx   # MODIFY: Activate button, wire OAuth flow
  lib/
    discogs/
      client.ts             # NEW: Server-side Discogs client factory (creates authenticated client)
      oauth.ts              # NEW: OAuth flow helpers (request token, exchange, store)
      import-worker.ts      # NEW: Core import logic (fetch page, upsert records, update progress)
      rate-limiter.ts       # NEW: Discogs-specific rate limit tracking
  lib/db/schema/
    import-jobs.ts          # NEW: import_jobs table schema
    users.ts                # MODIFY: Add lastSyncedAt, discogsAccessToken (or Vault reference)
```

### Pattern 1: OAuth 1.0a Flow with Next.js API Routes

**What:** Three-step OAuth flow using `@lionralfs/discogs-client`'s DiscogsOAuth class. Request token and token secret are stored in a short-lived httpOnly cookie during the redirect. The callback API route exchanges the verifier for access tokens and stores them in Supabase Vault.

**When to use:** Connecting a Discogs account from either onboarding or Settings.

**Flow:**
1. User clicks "Connect Discogs" -> server action calls `DiscogsOAuth.getRequestToken(callbackUrl)` -> stores `{token, tokenSecret}` in an encrypted httpOnly cookie -> redirects user to `authorizeUrl`
2. User authorizes on discogs.com -> Discogs redirects to `/api/discogs/callback?oauth_token=X&oauth_verifier=Y`
3. Callback route reads cookie, calls `DiscogsOAuth.getAccessToken(token, tokenSecret, verifier)` -> stores access token + secret in Supabase Vault -> updates `profiles.discogsConnected = true, discogsUsername = identity.username` -> creates import job row -> redirects to `/import-progress`

**Example:**
```typescript
// src/lib/discogs/oauth.ts
import { DiscogsOAuth } from '@lionralfs/discogs-client';

const CONSUMER_KEY = process.env.DISCOGS_CONSUMER_KEY!;
const CONSUMER_SECRET = process.env.DISCOGS_CONSUMER_SECRET!;

export async function getRequestToken(callbackUrl: string) {
  const oauth = new DiscogsOAuth(CONSUMER_KEY, CONSUMER_SECRET);
  const { token, tokenSecret, authorizeUrl } = await oauth.getRequestToken(callbackUrl);
  return { token, tokenSecret, authorizeUrl };
}

export async function getAccessToken(token: string, tokenSecret: string, verifier: string) {
  const oauth = new DiscogsOAuth(CONSUMER_KEY, CONSUMER_SECRET);
  const { accessToken, accessTokenSecret } = await oauth.getAccessToken(token, tokenSecret, verifier);
  return { accessToken, accessTokenSecret };
}
```

**Why API route for callback (not server action):** OAuth 1.0a requires an external redirect from Discogs back to our server. External services cannot call Server Actions -- they can only redirect to URLs. API routes are the correct pattern for OAuth callbacks in Next.js App Router.

### Pattern 2: Database-Driven Import Job Queue

**What:** An `import_jobs` table serves as a simple job queue. Each row represents one import operation (initial import or sync). A Next.js API route acts as the worker, processing one page of Discogs results per invocation, then calling itself for the next page.

**When to use:** Any import or sync operation that spans multiple Discogs API pages.

**Schema:**
```typescript
// src/lib/db/schema/import-jobs.ts
export const importJobs = pgTable('import_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull(),
  type: varchar('type', { length: 20 }).notNull(), // 'collection' | 'wantlist' | 'sync'
  status: varchar('status', { length: 20 }).notNull().default('pending'),
    // 'pending' | 'processing' | 'completed' | 'failed'
  totalItems: integer('total_items').default(0),
  processedItems: integer('processed_items').default(0),
  currentPage: integer('current_page').default(1),
  totalPages: integer('total_pages'),
  currentRecord: text('current_record'), // "Kind of Blue -- Miles Davis" for UI display
  errorMessage: text('error_message'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
```

**Worker flow (per invocation):**
1. Fetch the import job row by ID (verify status = 'processing')
2. Fetch one page of Discogs results (100 items) for `currentPage`
3. For each item: upsert release into `releases` table (admin client), insert `collection_items` or `wantlist_items` row (user context)
4. Update job: increment `processedItems`, advance `currentPage`, update `currentRecord`
5. Send Broadcast event with progress data
6. If more pages remain: call self via `fetch()` with the job ID (fire-and-forget) -> return 200
7. If last page: set status = 'completed', update `completedAt`
8. If collection just finished and type is initial import: create wantlist job, trigger next invocation

**Self-invocation pattern:**
```typescript
// At end of page processing, if more pages remain:
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
fetch(`${baseUrl}/api/discogs/import`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.IMPORT_WORKER_SECRET}`,
  },
  body: JSON.stringify({ jobId: job.id }),
}).catch(() => {}); // Fire-and-forget
```

**Why this works on Vercel:** Each invocation handles one page (~100 items, ~2-5 seconds of work). Well within Vercel's 10s Hobby / 60s Pro timeout. The chain of self-invocations processes the entire collection across many short-lived function invocations.

### Pattern 3: Supabase Realtime Broadcast for Progress

**What:** The import worker sends Broadcast messages to a user-specific channel after each page is processed. The client subscribes to this channel and updates the progress UI live.

**When to use:** Import progress screen and sticky banner both subscribe to the same channel.

**Channel design:**
- Channel name: `import:${userId}`
- Event: `progress`
- Payload: `{ jobId, type, status, processedItems, totalItems, currentRecord, completedAt }`

**Server-side (from import worker):**
```typescript
// Use Supabase REST API to broadcast (no WebSocket needed server-side)
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`,
  {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{
        topic: `import:${userId}`,
        event: 'progress',
        payload: { processedItems, totalItems, currentRecord, status, type },
      }],
    }),
  }
);
```

**Client-side subscription:**
```typescript
const supabase = createClient(); // Browser client
const channel = supabase.channel(`import:${userId}`);
channel
  .on('broadcast', { event: 'progress' }, (payload) => {
    // Update Zustand store with progress data
    useImportStore.getState().updateProgress(payload.payload);
  })
  .subscribe();
```

### Pattern 4: Delta Sync Strategy

**What:** Re-sync fetches only items added to Discogs collection since `last_synced_at`. Uses the Discogs `sort=added&sort_order=desc` parameter to get newest items first, stops when encountering items older than `last_synced_at`.

**Limitation:** The Discogs API does not provide a `since` or `changed_after` filter parameter. Delta sync must be approximated by sorting by `date_added desc` and paginating until we hit records we already have.

**Algorithm:**
1. Fetch page 1 sorted by `date_added desc`
2. For each item: if `date_added > last_synced_at`, upsert; else stop
3. If entire page was new, fetch next page; else sync complete
4. Update `profiles.last_synced_at` to current timestamp

**Edge case:** User removes items from Discogs between syncs. A full re-import (D-12) handles this. Delta sync only adds/updates, never deletes.

### Pattern 5: OAuth Token Storage in Supabase Vault

**What:** Discogs OAuth access token and secret are stored in Supabase Vault (encrypted at rest) rather than in plain-text profile columns.

**How:**
```sql
-- Store token (called from admin client via RPC)
SELECT vault.create_secret(
  'access_token_value',
  'discogs_token:USER_UUID',
  'Discogs OAuth access token for user USER_UUID'
);
SELECT vault.create_secret(
  'access_token_secret_value',
  'discogs_secret:USER_UUID',
  'Discogs OAuth access token secret for user USER_UUID'
);

-- Retrieve token (from server-side only)
SELECT decrypted_secret FROM vault.decrypted_secrets
WHERE name = 'discogs_token:USER_UUID';
```

**Alternative (simpler):** Store tokens in a `discogs_tokens` table with RLS restricting to service role only. This avoids Vault SQL complexity but sacrifices encryption at rest. Vault is the recommended approach.

### Anti-Patterns to Avoid

- **Long-running single API route:** Do NOT try to import an entire collection in one request. Vercel will timeout. Always chunk into per-page invocations.
- **Client-side Discogs API calls:** NEVER expose consumer key/secret or access tokens to the browser. All Discogs API calls happen server-side.
- **Polling for progress:** Do NOT have the client poll an endpoint for progress. Use Supabase Realtime Broadcast -- it is push-based and real-time.
- **Storing tokens in plain text:** Discogs OAuth tokens are sensitive credentials. Use Vault or at minimum a service-role-only table.
- **Writing releases with the user's Supabase client:** The `releases` table has `supabaseAuthAdminRole` policies for insert/update. Only the admin client can write releases. Use `createAdminClient()` for release upserts.
- **Blocking import on individual release API calls:** Do NOT fetch full release details for every collection item during import. The collection endpoint already returns title, artist, year, format, cover image, and community stats. Fetch additional release details lazily (Phase 4) or in a separate background pass.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth 1.0a signing | Custom HMAC-SHA1 signature generation | `@lionralfs/discogs-client` DiscogsOAuth | OAuth 1.0a signing is notoriously error-prone (nonce, timestamp, base string construction). The library handles it. |
| Rate limit tracking | Custom counter logic | `@lionralfs/discogs-client` built-in rate limit headers + `setConfig({ exponentialBackoffMaxRetries: 5 })` | Library reads `X-Discogs-Ratelimit-Remaining` header and supports configurable exponential backoff. |
| Secret encryption at rest | Custom AES encryption | Supabase Vault `vault.create_secret()` / `vault.decrypted_secrets` | Vault manages encryption keys internally, prevents accidental exposure in backups. |
| Real-time push to client | WebSocket server or SSE endpoint | Supabase Realtime Broadcast via REST API | Already in the stack, no additional infrastructure, works through the existing Supabase connection. |
| Progress state persistence | In-memory or Redis-based progress | `import_jobs` database table | Survives server restarts, queryable from any route, forms the source of truth for both worker and UI. |

**Key insight:** The import pipeline's complexity lies in orchestration (job state, progress, error recovery), not in any single difficult algorithm. Using database rows as the state machine and Broadcast for notifications keeps everything in tools already deployed.

## Common Pitfalls

### Pitfall 1: Race Condition on Concurrent Imports
**What goes wrong:** User clicks "Connect Discogs" twice quickly, or reconnects while an import is still running, creating duplicate import jobs.
**Why it happens:** No uniqueness constraint on active import jobs per user.
**How to avoid:** Before creating a new import job, check for existing active jobs (status = 'pending' or 'processing') for the same user. If one exists, redirect to the progress screen instead of creating a new job. Add a partial unique index: `CREATE UNIQUE INDEX idx_active_import ON import_jobs (user_id) WHERE status IN ('pending', 'processing');`
**Warning signs:** Duplicate records appearing in collection, progress bar jumping erratically.

### Pitfall 2: Discogs Rate Limit Exhaustion During Large Imports
**What goes wrong:** Import fails mid-way because the app exceeds 60 requests/minute.
**Why it happens:** Each page fetch is one request, but the collection endpoint returns 100 items. For 5,000 records = 50 pages = 50 requests. This fits within the 60/min limit if paced correctly. The danger is additional API calls (e.g., fetching release details) that stack on top.
**How to avoid:** (1) Configure the discogs-client with exponential backoff: `client.setConfig({ exponentialBackoffMaxRetries: 5, exponentialBackoffIntervalMs: 2000, exponentialBackoffRate: 2.7 })`. (2) Only use the collection list endpoint during import -- do NOT call individual release endpoints. (3) Add artificial delay between page fetches if rate limit remaining drops below 10.
**Warning signs:** 429 responses, `X-Discogs-Ratelimit-Remaining: 0` in response headers.

### Pitfall 3: Self-Invocation Infinite Loop
**What goes wrong:** The import worker keeps calling itself even after finishing, or re-processes the same page.
**Why it happens:** Bug in page advancement logic or status check.
**How to avoid:** (1) Always check job status is 'processing' at the start of each invocation -- if completed/failed, return immediately. (2) Persist `currentPage` to the database BEFORE triggering the next invocation. (3) Add a maximum page count safeguard (e.g., if `currentPage > 200`, mark as failed). (4) Protect the import endpoint with a shared secret (`IMPORT_WORKER_SECRET` env var) to prevent external abuse.
**Warning signs:** Vercel logs show continuous invocations, database shows processedItems > totalItems.

### Pitfall 4: Releases Table Conflicts
**What goes wrong:** Two users importing the same Discogs release simultaneously cause a unique constraint violation on `releases.discogs_id`.
**Why it happens:** Both workers try to INSERT the same release row.
**How to avoid:** Use Drizzle's `onConflictDoUpdate` (upsert pattern) on the `discogs_id` unique column. Update `discogsHave`, `discogsWant`, and `updatedAt` on conflict -- these values may have changed since the release was first imported.
**Warning signs:** Import errors mentioning unique constraint violations on `releases`.

### Pitfall 5: OAuth Callback Cookie Timing
**What goes wrong:** The OAuth callback fails because the request token cookie has expired or been cleared.
**Why it happens:** User takes too long to authorize on Discogs, browser clears cookies, or third-party cookie restrictions.
**How to avoid:** (1) Set cookie max-age to 10 minutes (generous but not permanent). (2) Use `sameSite: 'lax'` (allows the redirect back from Discogs). (3) Fall back to a server-side temporary store (e.g., a `pending_oauth` table row keyed by the request token) if cookies prove unreliable.
**Warning signs:** "OAuth callback failed" errors, especially on Safari/iOS.

### Pitfall 6: Missing `last_synced_at` Column
**What goes wrong:** Delta sync cannot function because the `profiles` table lacks a `last_synced_at` column.
**Why it happens:** Phase 1 schema did not include this field (it was a known gap noted in CONTEXT.md).
**How to avoid:** Add `lastSyncedAt` to the Drizzle schema and generate a migration as the first task of this phase.
**Warning signs:** N/A -- this is a known schema gap.

### Pitfall 7: Wantlist Items Without Source Tracking
**What goes wrong:** Disconnect cannot distinguish Discogs-sourced wantlist items from manually-added ones.
**Why it happens:** The `wantlist_items` table has no `addedVia` column (unlike `collection_items` which has one).
**How to avoid:** Add `addedVia` column to `wantlist_items` schema before implementing import. Or add a `discogsReleaseId` integer column that, if non-null, indicates the item was sourced from Discogs.
**Warning signs:** Disconnect deletes ALL wantlist items instead of only Discogs-sourced ones.

## Code Examples

### OAuth Flow - Server Action to Initiate Connection
```typescript
// src/actions/discogs.ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getRequestToken } from '@/lib/discogs/oauth';

export async function connectDiscogs() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const callbackUrl = `${siteUrl}/api/discogs/callback`;

  const { token, tokenSecret, authorizeUrl } = await getRequestToken(callbackUrl);

  // Store request token in httpOnly cookie for the callback
  const cookieStore = await cookies();
  cookieStore.set('discogs_oauth', JSON.stringify({ token, tokenSecret }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });

  redirect(authorizeUrl);
}
```

### Creating an Authenticated Discogs Client
```typescript
// src/lib/discogs/client.ts
import { DiscogsClient } from '@lionralfs/discogs-client';
import { createAdminClient } from '@/lib/supabase/admin';

export async function createDiscogsClient(userId: string): Promise<DiscogsClient> {
  const admin = createAdminClient();

  // Retrieve tokens from Vault
  const { data: tokenData } = await admin.rpc('get_vault_secret', {
    secret_name: `discogs_token:${userId}`,
  });
  const { data: secretData } = await admin.rpc('get_vault_secret', {
    secret_name: `discogs_secret:${userId}`,
  });

  const client = new DiscogsClient({
    auth: {
      method: 'oauth',
      consumerKey: process.env.DISCOGS_CONSUMER_KEY!,
      consumerSecret: process.env.DISCOGS_CONSUMER_SECRET!,
      accessToken: tokenData,
      accessTokenSecret: secretData,
    },
    userAgent: 'VinylDig/1.0',
  });

  // Configure exponential backoff for rate limits
  client.setConfig({
    exponentialBackoffMaxRetries: 5,
    exponentialBackoffIntervalMs: 2000,
    exponentialBackoffRate: 2.7,
  });

  return client;
}
```

### Import Worker - Page Processing
```typescript
// src/lib/discogs/import-worker.ts (core logic, called from API route)
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { releases } from '@/lib/db/schema/releases';
import { collectionItems } from '@/lib/db/schema/collections';
import { importJobs } from '@/lib/db/schema/import-jobs';
import { createAdminClient } from '@/lib/supabase/admin';
import { createDiscogsClient } from './client';

export async function processImportPage(jobId: string) {
  const [job] = await db.select().from(importJobs).where(eq(importJobs.id, jobId));
  if (!job || job.status !== 'processing') return { done: true };

  const client = await createDiscogsClient(job.userId);
  const identity = await client.getIdentity();
  const username = identity.data.username;

  // Fetch one page of collection releases
  const response = await client.user().collection().getReleases(username, 0, {
    page: job.currentPage,
    per_page: 100,
    sort: 'added',
    sort_order: 'desc',
  });

  const { releases: items, pagination } = response.data;
  const admin = createAdminClient();

  for (const item of items) {
    // Upsert release (admin client required -- supabaseAuthAdminRole)
    await admin.from('releases').upsert({
      discogs_id: item.id,
      title: item.basic_information.title,
      artist: item.basic_information.artists?.[0]?.name ?? 'Unknown',
      year: item.basic_information.year,
      genre: item.basic_information.genres,
      style: item.basic_information.styles,
      format: item.basic_information.formats?.[0]?.name,
      cover_image_url: item.basic_information.cover_image,
      discogs_have: item.basic_information.community?.have ?? 0,
      discogs_want: item.basic_information.community?.want ?? 0,
      rarity_score: computeRarityScore(
        item.basic_information.community?.have,
        item.basic_information.community?.want
      ),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'discogs_id' });

    // Link to user's collection
    // (need release UUID from the upsert -- query by discogs_id)
  }

  // Update job progress
  const newProcessed = (job.processedItems ?? 0) + items.length;
  await db.update(importJobs).set({
    processedItems: newProcessed,
    currentPage: (job.currentPage ?? 1) + 1,
    totalItems: pagination.items,
    totalPages: pagination.pages,
    currentRecord: items.length > 0
      ? `${items[items.length - 1].basic_information.title} -- ${items[items.length - 1].basic_information.artists?.[0]?.name}`
      : job.currentRecord,
  }).where(eq(importJobs.id, jobId));

  // Broadcast progress
  await broadcastProgress(job.userId, {
    jobId,
    type: job.type,
    status: 'processing',
    processedItems: newProcessed,
    totalItems: pagination.items,
    currentRecord: items[items.length - 1]?.basic_information?.title,
  });

  const hasMorePages = (job.currentPage ?? 1) < pagination.pages;
  return { done: !hasMorePages, jobId };
}
```

### Realtime Progress Subscription (Client)
```typescript
// src/components/discogs/import-progress.tsx
'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Progress } from '@/components/ui/progress';

interface ImportProgressProps {
  userId: string;
  jobId: string;
}

export function ImportProgress({ userId, jobId }: ImportProgressProps) {
  const [progress, setProgress] = useState({ processedItems: 0, totalItems: 0, currentRecord: '' });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`import:${userId}`);

    channel
      .on('broadcast', { event: 'progress' }, ({ payload }) => {
        setProgress(payload);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const percent = progress.totalItems > 0
    ? Math.round((progress.processedItems / progress.totalItems) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <Progress value={percent} />
      <p className="text-sm text-muted-foreground">
        {progress.processedItems} / {progress.totalItems} records
      </p>
      {progress.currentRecord && (
        <p className="text-sm text-foreground">
          Currently importing: {progress.currentRecord}
        </p>
      )}
    </div>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `disconnect` npm package | `@lionralfs/discogs-client` | 2023 | `disconnect` is abandoned. `@lionralfs/discogs-client` is the active fork with ESM support and TypeScript types. |
| Supabase postgres_changes for all real-time | Broadcast from Database / REST Broadcast | 2024 | Broadcast is recommended for most use cases now. postgres_changes has RLS performance overhead at scale. |
| Manual OAuth 1.0a with `oauth-1.0a` package | DiscogsOAuth class in `@lionralfs/discogs-client` | Built-in | Library wraps the full OAuth dance. No need for separate `oauth-1.0a` dependency. |
| Supabase Auth Helpers (`@supabase/auth-helpers-nextjs`) | `@supabase/ssr` | 2024 | Already using `@supabase/ssr` in Phase 1. No change needed. |
| Edge Functions for all background work | Edge Functions OR API route self-invocation | 2025 | Both are valid. API route self-invocation avoids the Deno/CLI deployment complexity for simpler cases. |

**Deprecated/outdated:**
- `disconnect` npm package: Last published 2020. Use `@lionralfs/discogs-client` instead.
- `@supabase/auth-helpers-nextjs`: Replaced by `@supabase/ssr`. Already correct in this project.
- `next lint` built-in: Deprecated in Next.js 15.5+. Already using Biome.

## Open Questions

1. **Vault RPC function setup**
   - What we know: Supabase Vault stores secrets via `vault.create_secret()` SQL function. Retrieval is via `vault.decrypted_secrets` view.
   - What's unclear: Whether the Supabase hosted platform has Vault enabled by default, and whether we need to create a custom RPC function to expose Vault operations to the admin client.
   - Recommendation: Test Vault availability during implementation. If unavailable or too complex, fall back to a `discogs_tokens` table with service-role-only RLS policies.

2. **D-05 interpretation: "Edge Functions + pg_cron"**
   - What we know: The CONTEXT.md locked decision D-05 mentions "Edge Functions + pg_cron" specifically. Our research recommends Next.js API routes instead.
   - What's unclear: Whether this is a hard requirement or a description of the general pattern ("server-side background processing").
   - Recommendation: The spirit of D-05 is "import runs server-side, survives tab close." The API route self-invocation pattern achieves this. If the user strictly requires Edge Functions, that would require Supabase CLI setup as a prerequisite task. Proceed with API route approach unless blocked.

3. **Discogs collection item response shape**
   - What we know: The collection endpoint returns `basic_information` with title, artists, year, genres, formats. Community stats (have/want) may or may not be in the collection list response.
   - What's unclear: Exact response shape -- need to verify during implementation whether community stats are included or require a separate release endpoint call.
   - Recommendation: Implement with the assumption that basic collection data is sufficient for import. If community stats are missing, add a separate background pass to enrich releases (can be deferred to Phase 4).

4. **CSP for Discogs OAuth redirect**
   - What we know: The OAuth flow redirects the user's browser to `https://www.discogs.com/oauth/authorize`. This is a navigation, not a fetch.
   - What's unclear: Whether CSP `form-action` or `navigate-to` directives would block this redirect.
   - Recommendation: Browser navigations are not restricted by `connect-src`. No CSP change needed for the OAuth redirect. However, if any client-side fetch to Discogs were needed (it shouldn't be), `connect-src` would need updating.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All | Yes | v24.14.0 | -- |
| npm | Package install | Yes | 11.9.0 | -- |
| Docker | Supabase CLI (if Edge Functions) | Yes | 29.2.1 | -- |
| Supabase CLI | Edge Functions deployment | No | -- | Use Next.js API routes instead (recommended approach) |
| @lionralfs/discogs-client | Discogs API integration | No (not yet installed) | 4.1.4 (npm) | `npm install` required |
| Discogs API credentials | OAuth 1.0a | Unknown | -- | Developer must register app at discogs.com/settings/developers |
| Supabase Vault | Token encryption | Unknown (hosted) | -- | Fall back to service-role-only DB table |

**Missing dependencies with no fallback:**
- Discogs API credentials: Developer must register a Discogs application to get consumer key/secret. This is a prerequisite before any OAuth work can begin.

**Missing dependencies with fallback:**
- Supabase CLI: Not installed, but the recommended architecture uses Next.js API routes, so not blocking.
- `@lionralfs/discogs-client`: Simple `npm install` resolves this.
- Supabase Vault: May or may not be enabled on the hosted platform. Fallback to an RLS-protected table is straightforward.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.1 + Playwright 1.58.2 |
| Config file | `vitest.config.ts` (unit/integration), `playwright.config.ts` (E2E) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npm test && npm run test:e2e` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DISC-01 | OAuth 1.0a connect flow | unit + integration | `npx vitest run tests/unit/lib/discogs/oauth.test.ts -x` | No -- Wave 0 |
| DISC-01 | OAuth callback route handler | integration | `npx vitest run tests/integration/discogs/callback.test.ts -x` | No -- Wave 0 |
| DISC-02 | Collection import worker processes pages | unit | `npx vitest run tests/unit/lib/discogs/import-worker.test.ts -x` | No -- Wave 0 |
| DISC-02 | Collection items written to DB | integration | `npx vitest run tests/integration/discogs/import.test.ts -x` | No -- Wave 0 |
| DISC-03 | Wantlist import processes pages | unit | `npx vitest run tests/unit/lib/discogs/import-worker.test.ts -x` | No -- Wave 0 |
| DISC-04 | Progress broadcast sent per page | unit | `npx vitest run tests/unit/lib/discogs/import-worker.test.ts -x` | No -- Wave 0 |
| DISC-04 | Progress UI updates from broadcast | unit (component) | `npx vitest run tests/unit/components/discogs/import-progress.test.tsx -x` | No -- Wave 0 |
| DISC-05 | Delta sync fetches only new items | unit | `npx vitest run tests/unit/lib/discogs/sync.test.ts -x` | No -- Wave 0 |
| DISC-06 | Disconnect removes collection + wantlist items | integration | `npx vitest run tests/integration/discogs/disconnect.test.ts -x` | No -- Wave 0 |
| DISC-06 | Disconnect clears profile fields | integration | `npx vitest run tests/integration/discogs/disconnect.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npm test && npm run test:e2e`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/lib/discogs/oauth.test.ts` -- covers DISC-01 (OAuth flow helpers)
- [ ] `tests/unit/lib/discogs/import-worker.test.ts` -- covers DISC-02, DISC-03, DISC-04 (page processing, upsert logic, progress broadcast)
- [ ] `tests/unit/lib/discogs/sync.test.ts` -- covers DISC-05 (delta sync logic)
- [ ] `tests/integration/discogs/callback.test.ts` -- covers DISC-01 (callback route)
- [ ] `tests/integration/discogs/import.test.ts` -- covers DISC-02 (DB writes)
- [ ] `tests/integration/discogs/disconnect.test.ts` -- covers DISC-06 (cleanup)
- [ ] `tests/unit/components/discogs/import-progress.test.tsx` -- covers DISC-04 (progress UI)
- [ ] Mock factory for `@lionralfs/discogs-client` responses (shared fixture)
- [ ] Framework install: `npm install @lionralfs/discogs-client` -- required before tests can run

## Sources

### Primary (HIGH confidence)
- [@lionralfs/discogs-client npm](https://www.npmjs.com/package/@lionralfs/discogs-client) -- OAuth API, collection/wantlist methods, rate limit config, version 4.1.4 verified
- [@lionralfs/discogs-client README](https://github.com/lionralfs/discogs-client/blob/main/README.md) -- Full OAuth flow code examples, constructor API, exponential backoff configuration
- [Supabase Scheduling Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions) -- pg_cron + pg_net pattern for invoking Edge Functions on a schedule
- [Supabase Processing Large Jobs](https://supabase.com/blog/processing-large-jobs-with-edge-functions) -- Job queue architecture: collection -> distribution -> processing layers, error handling with finally blocks
- [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast) -- REST API broadcast, channel subscription, event payload structure, RLS policies
- [Supabase Vault](https://supabase.com/docs/guides/database/vault) -- Encrypted secret storage, `vault.create_secret()`, `vault.decrypted_secrets` view
- [Supabase Background Tasks](https://supabase.com/docs/guides/functions/background-tasks) -- `EdgeRuntime.waitUntil()` API, timeout considerations

### Secondary (MEDIUM confidence)
- [Discogs API Forum - Rate Limits](https://www.discogs.com/forum/thread/1104957) -- 60 req/min authenticated, moving average window, `X-Discogs-Ratelimit-Remaining` header
- [Discogs API Forum - Pagination](https://www.discogs.com/forum/thread/355931) -- per_page max 100, sort=added supported, date_added field in response
- [Supabase Realtime postgres_changes](https://supabase.com/docs/guides/realtime/postgres-changes) -- Comparison with Broadcast, RLS performance considerations
- [Discogs OAuth Python Example](https://github.com/jesseward/discogs-oauth-example) -- OAuth 1.0a endpoint URLs verified: request_token, authorize, access_token

### Tertiary (LOW confidence)
- Community discussions about Discogs API response shape for collection items -- exact fields in `basic_information` need verification during implementation
- Supabase Vault availability on hosted free tier -- needs testing

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `@lionralfs/discogs-client` is the only viable JS Discogs client, version verified on npm
- Architecture: HIGH -- database job queue with self-invocation is a well-documented pattern for Vercel; Supabase Broadcast is officially documented
- OAuth flow: HIGH -- DiscogsOAuth class API verified from library README and npm docs
- Delta sync: MEDIUM -- Discogs API lacks a native `since` parameter; sort-by-added approach is the community consensus but has edge cases
- Vault integration: MEDIUM -- Vault is documented but availability on free tier unverified
- Pitfalls: HIGH -- based on direct analysis of schema gaps and known Discogs API constraints

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable domain -- Discogs API and Supabase rarely change breaking things)
