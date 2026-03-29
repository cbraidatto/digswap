---
phase: quick-260328-tef
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/shell/notification-bell.tsx
  - src/components/shell/app-header.tsx
  - src/actions/trades.ts
  - tests/unit/components/shell/notification-bell.test.tsx
  - tests/unit/components/shell/app-header.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Notification badge count resets to 0 after user clicks Mark all read"
    - "Notification badge count decrements after user clicks individual notification, only on server success"
    - "Notification badge count re-syncs with server when popover opens (handles drift from failed silent marks)"
    - "Trade icon appears in AppHeader beside the notification bell"
    - "Trade icon links to /trades"
    - "Trade icon shows badge count of actionable trades (pending as provider, or accepted/transferring)"
  artifacts:
    - path: "src/components/shell/notification-bell.tsx"
      provides: "Fixed stale count: re-fetch on popover open, await markNotificationRead before decrement"
    - path: "src/components/shell/app-header.tsx"
      provides: "Trade icon with badge beside NotificationBell"
    - path: "src/actions/trades.ts"
      provides: "getActionableTradeCount server action"
  key_links:
    - from: "src/components/shell/app-header.tsx"
      to: "src/actions/trades.ts"
      via: "getActionableTradeCount import"
      pattern: "getActionableTradeCount"
    - from: "src/components/shell/notification-bell.tsx"
      to: "src/actions/notifications.ts"
      via: "getUnreadCountAction called on popover open"
      pattern: "getUnreadCountAction"
---

<objective>
Fix the notification bell badge showing stale unread counts, and add a trade icon with its own actionable-trade badge to the AppHeader navbar beside the notification bell.

Purpose: Users currently see a stuck notification badge count that never resets properly. Additionally, there is no quick visual indicator for pending trades in the navbar.
Output: Corrected notification bell behavior + new trade icon with badge in AppHeader.
</objective>

<execution_context>
@.claude/skills/ (if exists)
</execution_context>

<context>
@src/components/shell/notification-bell.tsx
@src/components/shell/app-header.tsx
@src/components/shell/app-shell.tsx
@src/actions/notifications.ts
@src/actions/trades.ts
@src/lib/trades/queries.ts
@src/lib/trades/constants.ts
@src/lib/db/schema/trades.ts
@tests/unit/components/shell/notification-bell.test.tsx
@tests/unit/components/shell/app-header.test.tsx

<interfaces>
<!-- Key types and contracts the executor needs -->

From src/components/shell/notification-bell.tsx:
```typescript
interface NotificationBellProps {
  userId: string;
}
// Uses: getUnreadCountAction, getRecentNotificationsAction, markAllRead, markNotificationRead from @/actions/notifications
// Uses: Supabase Realtime subscription for INSERT on notifications table
```

From src/components/shell/app-header.tsx:
```typescript
interface AppHeaderProps {
  displayName: string | null;
  avatarUrl: string | null;
  xp?: number;
  userId: string;
}
// Currently renders: Logo, nav links, XP badge, NotificationBell
```

From src/actions/notifications.ts:
```typescript
export async function markNotificationRead(notificationId: string): Promise<{ success?: boolean; error?: string }>;
export async function markAllRead(): Promise<{ success?: boolean; error?: string }>;
export async function getUnreadCountAction(): Promise<number>;
```

From src/lib/trades/constants.ts:
```typescript
export const TRADE_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  TRANSFERRING: "transferring",
  COMPLETED: "completed",
  DECLINED: "declined",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
} as const;
```

From src/lib/db/schema/trades.ts:
```typescript
// trade_requests table: id, requester_id, provider_id, status, ...
// RLS: select allowed for participants (requester or provider)
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix stale notification badge count</name>
  <files>src/components/shell/notification-bell.tsx, tests/unit/components/shell/notification-bell.test.tsx</files>
  <action>
Fix two bugs in `src/components/shell/notification-bell.tsx`:

**Bug 1 — `handleNotificationClick` does fire-and-forget `markNotificationRead`:**
On line 133, `markNotificationRead(notificationId)` is called without `await` and its result is never checked. Lines 134-136 optimistically decrement `unreadCount` regardless of success. If the server action fails (rate limit, network error), the local count drifts from the server.

Fix: Make `handleNotificationClick` properly await `markNotificationRead` and only decrement `unreadCount` + mark local notification as read if the result contains `success: true`. Wrap in try/catch for network errors.

```typescript
const handleNotificationClick = async (notificationId: string) => {
  const notification = recentNotifications.find((n) => n.id === notificationId);
  if (!notification) return;

  // Close dropdown first for responsiveness
  setIsOpen(false);

  // Mark as read on server, only update local state on success
  try {
    const result = await markNotificationRead(notificationId);
    if (result.success) {
      setRecentNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
      if (!notification.read) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    }
  } catch {
    // Silent fail — count stays as-is, will re-sync on next open
  }

  // Navigate if link exists
  if (notification.link) {
    router.push(notification.link);
  }
};
```

Note the added `!notification.read` guard — prevents double-decrementing if a user clicks an already-read notification.

**Bug 2 — No re-sync of unread count when popover opens:**
The unread count is only fetched once on mount. If a user marks notifications as read (especially via the /notifications page or another tab), the bell badge stays stale until full page navigation.

Fix: Add an `onOpenChange` handler that re-fetches the unread count from the server whenever the popover opens:

```typescript
const handleOpenChange = async (open: boolean) => {
  setIsOpen(open);
  if (open) {
    // Re-sync with server on every open to catch any drift
    try {
      const [count, recent] = await Promise.all([
        getUnreadCountAction(),
        getRecentNotificationsAction(),
      ]);
      setUnreadCount(count);
      setRecentNotifications(
        recent.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          link: n.link,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        })),
      );
    } catch {
      // Silent fail — keep existing local state
    }
  }
};
```

Replace `onOpenChange={setIsOpen}` on the Popover (line 148) with `onOpenChange={handleOpenChange}`.

**Update tests** in `tests/unit/components/shell/notification-bell.test.tsx`:
Add a test case verifying that when the mock `markNotificationRead` returns `{ error: "..." }`, the unreadCount does NOT decrement. The existing tests already mock these actions so follow the same pattern.
  </action>
  <verify>
    <automated>npx vitest run tests/unit/components/shell/notification-bell.test.tsx</automated>
  </verify>
  <done>
- handleNotificationClick awaits markNotificationRead and only decrements on success
- Popover open triggers re-fetch of unreadCount and recent notifications from server
- Double-click on already-read notification does not double-decrement
- Existing tests pass, new test for failed mark-read added
  </done>
</task>

<task type="auto">
  <name>Task 2: Add trade icon with actionable badge to AppHeader</name>
  <files>src/actions/trades.ts, src/components/shell/app-header.tsx, tests/unit/components/shell/app-header.test.tsx</files>
  <action>
**Step 1 — Add `getActionableTradeCount` server action to `src/actions/trades.ts`:**

Add a new exported server action at the bottom of the file (before the internal helpers section). This counts trades that need the current user's attention:
- Status = "pending" AND user is the provider (trade request awaiting their accept/decline)
- Status = "accepted" OR "transferring" AND user is a participant (trade in active transfer)

```typescript
export async function getActionableTradeCount(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const admin = createAdminClient();

  // Count pending trades where user is provider (needs accept/decline)
  const { count: pendingCount } = await admin
    .from("trade_requests")
    .select("id", { count: "exact", head: true })
    .eq("provider_id", user.id)
    .eq("status", TRADE_STATUS.PENDING);

  // Count active trades (accepted/transferring) where user is participant
  const { count: activeCount } = await admin
    .from("trade_requests")
    .select("id", { count: "exact", head: true })
    .or(`requester_id.eq.${user.id},provider_id.eq.${user.id}`)
    .in("status", [TRADE_STATUS.ACCEPTED, TRADE_STATUS.TRANSFERRING]);

  return (pendingCount ?? 0) + (activeCount ?? 0);
}
```

Note: This does NOT rate-limit because it is a read-only count query called on every header render. The existing `requireUser()` helper throws on unauthenticated, but here we silently return 0 so the header never crashes.

**Step 2 — Create `TradeBadge` client component inline in `src/components/shell/app-header.tsx`:**

Convert `app-header.tsx` to a client component by adding `"use client";` at the top. This is necessary because the TradeBadge needs `useEffect`/`useState` for fetching the count. The existing `NotificationBell` is already a client component, and AppHeader's parent `AppShell` is also a client component that passes server-fetched props, so this is consistent.

Add a `TradeBadge` component (defined in the same file, not exported) that:
- Takes `userId: string` prop (for potential Realtime subscription later)
- Fetches `getActionableTradeCount()` on mount via useEffect
- Renders a Link to `/trades` with the `swap_horiz` Material Symbol icon
- Shows a badge count (same styling as NotificationBell badge) when count > 0
- Uses same `p-2 text-on-surface-variant hover:bg-surface-bright transition-colors rounded` classes as NotificationBell trigger

```typescript
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NotificationBell } from "@/components/shell/notification-bell";
import { getActionableTradeCount } from "@/actions/trades";

// ... TradeBadge component ...

function TradeBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    getActionableTradeCount()
      .then((c) => { if (mounted) setCount(c); })
      .catch(() => { /* silent */ });
    return () => { mounted = false; };
  }, []);

  return (
    <Link
      href="/trades"
      aria-label="Trades"
      className="relative p-2 text-on-surface-variant hover:bg-surface-bright transition-colors rounded"
    >
      <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
      {count > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-mono font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
          aria-label={`${count} actionable trades`}
        >
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
```

**Step 3 — Add TradeBadge to AppHeader JSX:**

In the `<div className="flex items-center gap-4 ml-auto">` section, add `<TradeBadge />` immediately before `<NotificationBell userId={userId} />`. The order should be: XP badge (if shown), TradeBadge, NotificationBell.

The `gap-4` on the parent flex container provides consistent spacing. Reduce to `gap-2` if the icons feel too spread out, but `gap-4` matches the current design.

**Step 4 — Update tests** in `tests/unit/components/shell/app-header.test.tsx`:

The existing test mocks `NotificationBell`. Add a mock for `@/actions/trades`:
```typescript
vi.mock("@/actions/trades", () => ({
  getActionableTradeCount: vi.fn().mockResolvedValue(2),
}));
```

Add test cases:
1. "renders trade icon with swap_horiz" — check for the swap_horiz text in a material-symbols-outlined span
2. "trade icon links to /trades" — check for an anchor with href="/trades"
3. "trade icon has aria-label Trades" — check for aria-label="Trades"
  </action>
  <verify>
    <automated>npx vitest run tests/unit/components/shell/app-header.test.tsx</automated>
  </verify>
  <done>
- `getActionableTradeCount` server action exists in src/actions/trades.ts
- AppHeader renders a swap_horiz icon linking to /trades beside the notification bell
- Trade icon shows badge count when actionable trades > 0
- Badge shows "9+" for counts over 9
- Badge hidden when count is 0
- All existing and new tests pass
  </done>
</task>

</tasks>

<verification>
Run all affected test suites:
```bash
npx vitest run tests/unit/components/shell/notification-bell.test.tsx tests/unit/components/shell/app-header.test.tsx
```

Manual smoke test (if dev server available):
1. Open the app, check that notification bell badge shows correct count
2. Click a notification — badge should decrement by 1
3. Click "Mark all read" — badge should go to 0
4. Close and reopen popover — count should match server state
5. Verify swap_horiz trade icon appears left of the notification bell
6. Click trade icon — should navigate to /trades
</verification>

<success_criteria>
- Notification badge count correctly decrements only on successful server mark-as-read
- Notification badge re-syncs with server on every popover open
- Trade icon (swap_horiz) visible in AppHeader beside NotificationBell
- Trade icon links to /trades with aria-label="Trades"
- Trade badge shows count of actionable trades (pending as provider + accepted/transferring as participant)
- All unit tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/260328-tef-fix-notification-badge-stale-count-add-t/260328-tef-SUMMARY.md`
</output>
