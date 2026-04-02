import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mockPathname = vi.fn(() => "/feed");
vi.mock("next/navigation", () => ({
	usePathname: () => mockPathname(),
}));

vi.mock("next/link", () => ({
	default: ({ href, children, ...props }: Record<string, unknown>) => (
		<a href={href as string} {...props}>
			{children as React.ReactNode}
		</a>
	),
}));

import { BottomBar } from "@/components/shell/bottom-bar";

describe("BottomBar", () => {
	it("renders 4 tab links with correct labels", () => {
		render(<BottomBar />);
		expect(screen.getByText("Feed")).toBeInTheDocument();
		expect(screen.getByText("Profile")).toBeInTheDocument();
		expect(screen.getByText("Explore")).toBeInTheDocument();
		expect(screen.getByText("Community")).toBeInTheDocument();
	});

	it("renders tab links with correct hrefs", () => {
		render(<BottomBar />);
		const links = screen.getAllByRole("link");
		const hrefs = links.map((link) => link.getAttribute("href"));
		expect(hrefs).toContain("/feed");
		expect(hrefs).toContain("/perfil");
		expect(hrefs).toContain("/explorar");
		expect(hrefs).toContain("/comunidade");
	});

	it("marks active tab with aria-current=page", () => {
		mockPathname.mockReturnValue("/feed");
		render(<BottomBar />);
		const feedLink = screen.getByText("Feed").closest("a");
		expect(feedLink).toHaveAttribute("aria-current", "page");

		const explorarLink = screen.getByText("Explore").closest("a");
		expect(explorarLink).not.toHaveAttribute("aria-current");
	});

	it("applies active styling to current tab", () => {
		mockPathname.mockReturnValue("/explorar");
		render(<BottomBar />);
		const explorarLink = screen.getByText("Explore").closest("a");
		expect(explorarLink?.className).toContain("text-primary");

		const feedLink = screen.getByText("Feed").closest("a");
		expect(feedLink?.className).toContain("text-on-surface-variant");
	});

	it("has nav element with aria-label", () => {
		render(<BottomBar />);
		const nav = screen.getByRole("navigation");
		expect(nav).toHaveAttribute("aria-label", "Main navigation");
	});

	it("detects active tab for deep links using startsWith", () => {
		mockPathname.mockReturnValue("/feed/some-post/123");
		render(<BottomBar />);
		const feedLink = screen.getByText("Feed").closest("a");
		expect(feedLink).toHaveAttribute("aria-current", "page");
	});
});
