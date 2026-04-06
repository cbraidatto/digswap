import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push: vi.fn() }),
	usePathname: () => "/feed",
}));

vi.mock("next/link", () => ({
	default: ({ href, children, ...props }: Record<string, unknown>) => (
		<a href={href as string} {...props}>
			{children as React.ReactNode}
		</a>
	),
}));

vi.mock("@/components/shell/notification-bell", () => ({
	NotificationBell: ({ userId }: { userId: string }) => (
		<div data-testid="notification-bell" data-user-id={userId} />
	),
}));

vi.mock("@/components/chat/chat-toggle-button", () => ({
	ChatToggleButton: () => <div data-testid="chat-toggle" />,
}));

vi.mock("@/components/shell/global-search", () => ({
	GlobalSearch: () => <div data-testid="global-search" />,
}));

import { AppHeader } from "@/components/shell/app-header";

describe("AppHeader", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		cleanup();
	});

	it("renders DIGSWAP wordmark", () => {
		render(<AppHeader displayName="Test" avatarUrl={null} userId="test-user-id" />);
		expect(screen.getByText("DIG")).toBeInTheDocument();
		expect(screen.getByText("SWAP")).toBeInTheDocument();
	});

	it("renders wordmark with font-heading class", () => {
		render(<AppHeader displayName="Test" avatarUrl={null} userId="test-user-id" />);
		const dig = screen.getByText("DIG");
		expect(dig.parentElement?.className).toContain("font-heading");
	});

	it("renders main navigation links", async () => {
		render(<AppHeader displayName="Test" avatarUrl={null} userId="test-user-id" />);
		await waitFor(() => {
			expect(screen.getByText("Feed")).toBeInTheDocument();
			expect(screen.getByText("Community")).toBeInTheDocument();
			expect(screen.getByText("Explore")).toBeInTheDocument();
			expect(screen.getByText("Trades")).toBeInTheDocument();
			expect(screen.getByText("Profile")).toBeInTheDocument();
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

	it("renders global search", () => {
		render(<AppHeader displayName="Test" avatarUrl={null} userId="test-user-id" />);
		expect(screen.getByTestId("global-search")).toBeInTheDocument();
	});

	it("renders chat toggle", () => {
		render(<AppHeader displayName="Test" avatarUrl={null} userId="test-user-id" />);
		expect(screen.getByTestId("chat-toggle")).toBeInTheDocument();
	});

	it("renders help link", () => {
		render(<AppHeader displayName="Test" avatarUrl={null} userId="test-user-id" />);
		const helpLink = screen.getByLabelText("How to use DigSwap");
		expect(helpLink).toHaveAttribute("href", "/como-usar");
	});
});
