import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
	default: ({ href, children, ...props }: Record<string, unknown>) => (
		<a href={href as string} {...props}>
			{children as React.ReactNode}
		</a>
	),
}));

// Mock UserAvatarMenu to avoid Base UI complexity in jsdom
vi.mock("@/components/shell/user-avatar-menu", () => ({
	UserAvatarMenu: ({ displayName }: { displayName: string | null }) => (
		<div data-testid="user-avatar-menu">{displayName}</div>
	),
}));

// Mock NotificationBell to avoid Base UI Popover + Realtime complexity in jsdom
vi.mock("@/components/shell/notification-bell", () => ({
	NotificationBell: ({ userId }: { userId: string }) => (
		<div data-testid="notification-bell" data-user-id={userId} />
	),
}));

import { AppHeader } from "@/components/shell/app-header";

describe("AppHeader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		cleanup();
	});

	it("renders DIGSWAP wordmark", () => {
		render(<AppHeader displayName="Test" avatarUrl={null} userId="test-user-id" />);
		// Text is split across child spans: <span>DIG</span><span>SWAP</span>
		expect(screen.getByText("DIG")).toBeInTheDocument();
		expect(screen.getByText("SWAP")).toBeInTheDocument();
	});

	it("renders wordmark with font-heading class", () => {
		render(<AppHeader displayName="Test" avatarUrl={null} userId="test-user-id" />);
		// The parent span containing DIG+SWAP has font-heading
		const dig = screen.getByText("DIG");
		expect(dig.parentElement?.className).toContain("font-heading");
	});

	it("renders main navigation links", async () => {
		render(<AppHeader displayName="Test" avatarUrl={null} userId="test-user-id" />);

		await waitFor(() => {
			expect(screen.getByText("Feed")).toHaveAttribute("href", "/feed");
			expect(screen.getByText("Community")).toHaveAttribute("href", "/comunidade");
			expect(screen.getByText("Explore")).toHaveAttribute("href", "/explorar");
			expect(screen.getByText("Profile")).toHaveAttribute("href", "/perfil");
		});
	});

	it("renders notification bell for the current user", async () => {
		render(<AppHeader displayName="Test" avatarUrl={null} userId="test-user-id" />);

		await waitFor(() => {
			expect(screen.getByTestId("notification-bell")).toHaveAttribute(
				"data-user-id",
				"test-user-id",
			);
		});
	});

	it("does not render XP badge when XP is zero", () => {
		render(<AppHeader displayName="Test" avatarUrl={null} userId="test-user-id" />);
		expect(screen.queryByText(/XP:/i)).not.toBeInTheDocument();
	});
});
