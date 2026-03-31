> [!IMPORTANT]
> **Code Review Context**
> **App:** DigSwap (SaaS P2P Market for Vinyl Diggers)
> **Stack:** Next.js 15, React 19, Supabase (Auth/DB), Drizzle ORM
> **Focus:** Architecture, Consistency, Security & PostgreSQL optimization

## 🔴 Critical Issues

### The "Dual-ORM" Distributed Transaction Failure 
**[DDIA — Consistency Model & Partial Failures]**
In `src/actions/trades.ts` (`completeTrade`), the code updates trade status via the Supabase Javascript Client (`admin.from("trade_requests").update()`), and immediately executes raw Drizzle SQL updates for gamification and metrics (`db.execute(sql... UPDATE user_rankings)`). 

Because these run as separate network requests outside of an ACID database transaction, if the Supabase call succeeds but the `db.execute` fails (e.g. timeout, Node server crash), the database enters an inconsistent state (Trade marked completed, but no limits deducted and no points awarded).
* **Fix**: You must wrap all mutations that belong to a single logical operation inside a strict Drizzle transaction block (`db.transaction`).

## 🟡 Important Improvements

### Missing Database Enum Constraints
**[The Art of PostgreSQL — Data Types]**
In `src/lib/db/schema/trades.ts`, the `status` column is defined as `varchar("status", { length: 20 })`. The application layer enforces specific states like PENDING, ACCEPTED. However, if someone modifies the DB directly, a webhook fires, or a bug is introduced in a new server action, impossible states (e.g. `status: 'foo'`) can be written.
* **Fix**: Use PostgreSQL native ENUM types `pgEnum('trade_status', ['pending', 'accepted', ...])` to enforce state integrity at the lowest storage layer.

### Random UUIDs vs B-Tree Fragmentation
**[High Performance PostgreSQL — Indexing]** 
The schema uses `.defaultRandom()` (which generates completely random UUIDv4) for primary keys. In write-heavy tables like `trade_requests` or `user_sessions`, random UUIDs cause B-Tree indexes to fragment as the table scales, leading to extreme write-amplification and page faults in memory.
* **Fix**: Switch to sequential UUIDs (UUIDv7) which are time-ordered and keep B-Tree inserts local, fast, and cached.

## 🟢 Good Practices Detected

### Clean OWASP Auth Patterns
**[The Web Application Hacker's Handbook — Information Disclosure]**
Your `src/actions/auth.ts` handles authentication pipelines beautifully. It never leaks if an email exists (`GENERIC_AUTH_ERROR`), elegantly handles Upstash Redis rate-limiting on a per-IP and per-Email basis, and explicitly blocks malicious enumeration.

### Row-Level Security (RLS) Excellence
**[Building Multi-Tenant SaaS Architectures — Data Isolation]**
You pushed authorization directly into Drizzle `pgPolicy` blocks (`using: sql...`). This ensures that even if a server action forgets to filter by user ID, tenant isolation is maintained globally by the PostgreSQL kernel.

### Strict Concurrency Control
**[DDIA — Race Conditions]**
The `updateTradeStatus` action uses optimistic locking correctly: `.eq("id", tradeId).eq("status", trade.status)`. This gracefully prevents race conditions where two users might click "Accept" or "Cancel" simultaneously without employing expensive database locks. 

---

## 🛡️ Security Audit

### 🔴 Critical: Mass Assignment Vulnerability
**[The Web Application Hacker's Handbook — Mass Assignment / Input Validation]**
In `src/actions/trades.ts`, the `createTrade` server action takes a raw parameter typed locally via TypeScript: `(formData: { providerId: string; ... })`. In Next.js Server Actions, malicious clients can send arbitrary JSON objects that bypass TypeScript compilations entirely. Without Zod (runtime) validation, an attacker could potentially pass unexpected fields or negative `fileSizeBytes` values.
* **Fix**: You must parse the raw input through a strict Zod schema (`createTradeSchema.safeParse(formData)`) inside the Server Action before executing business logic, just like you did perfectly in `auth.ts`.

### 🟡 Important: Turn Credentials Exposure
**[OAuth 2 in Action / Web Hacker's Handbook]**
In `getTurnCredentials()`, the rate limit is checked, which is great. However, `getTurnCredentials` passes Metered credentials to the client. If an attacker scripts the rate limit maximum regularly, they can exhaust your Metered bandwidth pool. Ensure strict billing alarms and caps on Metered.ca because the Next.js client inherently exposes these temporary connection vectors.

---

## ⚡ Performance & Scalability

### 🔴 Critical: The Global Leaderboard N+1 & Full Scan Bomb
**[High Performance MySQL — Query Analysis & DDIA — Batch vs Stream]**
In `src/lib/gamification/queries.ts`, the `getGenreLeaderboard` executes a massive raw SQL aggregation: 
`SUM(LN(1 + COALESCE(r.rarity_score, 0))) ... ROW_NUMBER() OVER (...)`. 
This query joins `collection_items` with `releases`, computes the natural logarithm per row, filters by a JSON/Array genre, groups by users, and sorts everything. 
At 1,000 rows this is fine. At 100,000 records, this query will lock up database CPU threads and cause extreme latency spikes (taking seconds per page load).
* **Fix**: This is a classic *Scalability Landmine*. You must shift this to a **Materialized View** built in the background (via `pg_cron` every 15 minutes) or use **Redis Sorted Sets (Upstash)** where adding points is `O(log N)` and fetching the top 50 is `O(1)`. Doing heavy recursive math inside the request path will crush PostgreSQL CPU limits.

### 🟢 Good: Lightweight Frontend Architecture
**[Web Performance Fundamentals — Bundle Size]**
Inspecting `src/app/page.tsx` and `layout.tsx`, the use of native CSS rendering for background styling (`radial-gradient`) instead of importing huge libraries (like `three.js` or `vanta.js`) is an excellent choice for TTFB. Additionally, configuring `next/font/google` with `display: "swap"` avoids the "Flash of Invisible Text" (FOIT) block and preserves Core Web Vitals (FCP).

---

## 🔧 Actionable Refactors

### 1. Consolidate Mutations into ACID Transactions
**Impact**: High (prevents silent data corruption)
```typescript
import { and, eq } from "drizzle-orm";

// Stop mixing Supabase Admin client and Drizzle for mutations.
// Use Drizzle for everything to ensure Transaction Support.
await db.transaction(async (tx) => {
  // 1. Verify and update trade status with optimistic lock
  const updatedTrade = await tx.update(tradeRequests)...
    .returning();
    
  if (!updatedTrade.length) throw new Error("Trade modified concurrently");

  // 2. Insert Review
  await tx.insert(tradeReviews).values({...});

  // 3. Update scores safely inside the same atomic block
  await tx.execute(sql`
    UPDATE subscriptions 
    SET trades_this_month = COALESCE(trades_this_month, 0) + 1 
    WHERE user_id = ${trade.requester_id}
  `);
});
```

### 2. Guard Server Actions with Runtime Zod
**Impact**: High (prevents runtime exploits)
```typescript
import { z } from "zod";

const createTradeSchema = z.object({
  providerId: z.string().uuid(),
  releaseId: z.string().uuid().optional(),
  fileName: z.string().max(255),
  fileFormat: z.enum(["mp3", "flac", "wav"]),
  declaredBitrate: z.string().max(50),
  fileSizeBytes: z.number().positive().max(1024 * 1024 * 500) // max 500mb
});

export async function createTrade(rawData: unknown) {
  const parsed = createTradeSchema.safeParse(rawData);
  if (!parsed.success) return { error: "Invalid Data" };
  const formData = parsed.data;
  // ...
}
```

### 3. Shift Leaderboard to Indexed Views
**Impact**: Extreme (Avoids DB outage under load)
Instead of calculating rank dynamically on each page visit:
```sql
-- Run this in a database migration
CREATE MATERIALIZED VIEW genre_leaderboards AS
SELECT
  ci.user_id,
  SUM(LN(1 + COALESCE(r.rarity_score, 0))) AS score
FROM collection_items ci
INNER JOIN releases r ON r.id = ci.release_id
GROUP BY ci.user_id;

CREATE UNIQUE INDEX idx_genre_leaderboards_user ON genre_leaderboards(user_id);
```
Inside Node.js, an edge function or cron job calls `REFRESH MATERIALIZED VIEW CONCURRENTLY genre_leaderboards`, and your Next.js queries run in `~1ms`.
