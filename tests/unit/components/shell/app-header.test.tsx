import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
	it("renders DIGSWAP wordmark", () => {
		render(<AppHeader displayName="Test" avatarUrl={null} userId="test-user-id" />);
		expect(screen.getByText("DIGSWAP")).toBeInTheDocument();
	});

	it("renders wordmark with font-heading class", () => {
		render(<AppHeader displayName="Test" avatarUrl={null} userId="test-user-id" />);
		const wordmark = screen.getByText("DIGSWAP");
		expect(wordmark.className).toContain("font-heading");
	});
});
