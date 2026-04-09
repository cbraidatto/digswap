import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────────

// Track channel lifecycle for assertions
const mockRemoveChannel = vi.fn();
const mockSubscribe = vi.fn().mockReturnThis();
const mockOn = vi.fn().mockReturnValue({ subscribe: mockSubscribe });
const mockChannel = vi.fn().mockReturnValue({
	on: mockOn,
	subscribe: mockSubscribe,
});

vi.mock("@/lib/supabase/client", () => ({
	createClient: () => ({
		channel: mockChannel,
		removeChannel: mockRemoveChannel,
	}),
}));

// Mock notification actions with controlled return values
const mockGetUnreadCount = vi.fn().mockResolvedValue(3);
const mockGetRecentNotifications = vi.fn().mockResolvedValue([
	{
		id: "n-1",
		type: "wantlist_match",
		title: "Wantlist match found!",
		body: "Someone has Kind of Blue",
		link: "/explorar?tab=records",
		read: false,
		createdAt: new Date("2026-03-25T10:00:00Z"),
	},
	{
		id: "n-2",
		type: null,
		title: "Welcome to DigSwap",
		body: null,
		link: null,
		read: true,
		createdAt: new Date("2026-03-24T08:00:00Z"),
	},
]);
const mockMarkAllRead = vi.fn().mockResolvedValue({ success: true });
const mockMarkNotificationRead = vi.fn().mockResolvedValue({ success: true });

vi.mock("@/actions/notifications", () => ({
	getUnreadCountAction: (...args: unknown[]) => mockGetUnreadCount(...args),
	getRecentNotificationsAction: (...args: unknown[]) => mockGetRecentNotifications(...args),
	markAllRead: (...args: unknown[]) => mockMarkAllRead(...args),
	markNotificationRead: (...args: unknown[]) => mockMarkNotificationRead(...args),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: vi.fn(),
		replace: vi.fn(),
		refresh: vi.fn(),
		back: vi.fn(),
		forward: vi.fn(),
		prefetch: vi.fn(),
	}),
	useSearchParams: () => new URLSearchParams(),
}));

// Mock next/link
vi.mock("next/link", () => ({
	default: ({ href, children, ...props }: Record<string, unknown>) => (
		<a href={href as string} {...props}>
			{children as React.ReactNode}
		</a>
	),
}));

// Mock Popover components from shadcn/ui to avoid Radix jsdom issues
vi.mock("@/components/ui/popover", () => ({
	Popover: ({
		children,
	}: {
		children: React.ReactNode;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}) => <div data-testid="popover">{children}</div>,
	PopoverTrigger: ({ children, ...props }: Record<string, unknown>) => (
		<button type="button" {...props}>
			{children as React.ReactNode}
		</button>
	),
	PopoverContent: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="popover-content">{children}</div>
	),
}));

// Mock Separator
vi.mock("@/components/ui/separator", () => ({
	Separator: () => <hr />,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: vi.fn(),
}));

import { NotificationBell } from "@/components/shell/notification-bell";

// ── Tests ───────────────────────────────────────────────────────────────────

describe("NotificationBell", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		cleanup();
	});

	it("renders bell icon with material-symbols-outlined notifications", async () => {
		render(<NotificationBell userId="user-123" />);

		await waitFor(() => {
			const icon = screen.getByText("notifications");
			expect(icon).toBeInTheDocument();
			expect(icon.className).toContain("material-symbols-outlined");
		});
	});

	it("shows unread badge with count from getUnreadCountAction", async () => {
		mockGetUnreadCount.mockResolvedValue(3);

		render(<NotificationBell userId="user-123" />);

		await waitFor(() => {
			expect(screen.getByLabelText("3 unread notifications")).toBeInTheDocument();
			expect(screen.getByText("3")).toBeInTheDocument();
		});
	});

	it('badge shows "9+" when count > 9', async () => {
		mockGetUnreadCount.mockResolvedValue(42);

		render(<NotificationBell userId="user-123" />);

		await waitFor(() => {
			expect(screen.getByText("9+")).toBeInTheDocument();
		});
	});

	it("no badge when count is 0", async () => {
		mockGetUnreadCount.mockResolvedValue(0);

		render(<NotificationBell userId="user-123" />);

		await waitFor(() => {
			expect(mockGetUnreadCount).toHaveBeenCalled();
		});

		expect(screen.queryByLabelText(/unread notifications/)).not.toBeInTheDocument();
	});

	it('bell has aria-label="Notifications"', () => {
		render(<NotificationBell userId="user-123" />);

		expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
	});

	it("creates Supabase Realtime channel on mount with correct filter", async () => {
		render(<NotificationBell userId="user-abc" />);

		await waitFor(() => {
			expect(mockChannel).toHaveBeenCalledWith("notifications-user-abc");
		});

		expect(mockOn).toHaveBeenCalledWith(
			"postgres_changes",
			expect.objectContaining({
				event: "INSERT",
				schema: "public",
				table: "notifications",
				filter: "user_id=eq.user-abc",
			}),
			expect.any(Function),
		);
	});

	it("cleans up channel on unmount (removeChannel called)", async () => {
		const { unmount } = render(<NotificationBell userId="user-xyz" />);

		await waitFor(() => {
			expect(mockChannel).toHaveBeenCalled();
		});

		unmount();

		expect(mockRemoveChannel).toHaveBeenCalled();
	});

	it("does not decrement unreadCount when markNotificationRead returns error", async () => {
		mockGetUnreadCount.mockResolvedValue(3);
		mockMarkNotificationRead.mockResolvedValue({ error: "Could not mark notification as read." });

		render(<NotificationBell userId="user-123" />);

		// Wait for initial data to load
		await waitFor(() => {
			expect(screen.getByText("3")).toBeInTheDocument();
		});

		// Click the first (unread) notification row button
		const notificationButtons = screen.getAllByRole("button");
		const notifButton = notificationButtons.find((btn) =>
			btn.textContent?.includes("Wantlist match found!"),
		);
		fireEvent.click(notifButton!);

		// Wait for the async markNotificationRead to resolve
		await waitFor(() => {
			expect(mockMarkNotificationRead).toHaveBeenCalledWith("n-1");
		});

		// Count should still be 3 because mark-read failed
		expect(screen.getByText("3")).toBeInTheDocument();
	});
});
