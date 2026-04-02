import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ---------------------------------------------------------------------------
// Mock @/components/ui/popover — base-ui Popover doesn't work in jsdom.
// The Popover mock uses a context to wire onOpenChange to the trigger button.
// ---------------------------------------------------------------------------
vi.mock("@/components/ui/popover", () => {
	// Import React inside the factory to avoid hoisting issues
	const React = require("react");
	const { createContext, useContext } = React;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const Ctx = createContext({} as { onOpenChange?: (v: boolean) => void });

	return {
		Popover: ({
			children,
			open,
			onOpenChange,
		}: {
			children: React.ReactNode;
			open?: boolean;
			onOpenChange?: (v: boolean) => void;
		}) => (
			<Ctx.Provider value={{ onOpenChange }}>
				<div data-testid="popover-root" data-open={String(open)}>
					{children}
				</div>
			</Ctx.Provider>
		),
		PopoverTrigger: ({
			children,
		}: {
			children: React.ReactNode;
			render?: React.ReactElement;
		}) => {
			const { onOpenChange } = useContext(Ctx);
			return (
				<div
					data-testid="popover-trigger"
					onClick={() => onOpenChange?.(true)}
					role="button"
					tabIndex={0}
					onKeyDown={(e: React.KeyboardEvent) => {
						if (e.key === "Enter") onOpenChange?.(true);
					}}
				>
					{children}
				</div>
			);
		},
		PopoverContent: ({
			children,
			className,
		}: {
			children: React.ReactNode;
			className?: string;
		}) => (
			<div data-testid="popover-content" className={className}>
				{children}
			</div>
		),
	};
});

// ---------------------------------------------------------------------------
// Mock @/actions/crates
// ---------------------------------------------------------------------------
const mockGetUserCratesAction = vi.fn();
const mockAddToCrate = vi.fn();
const mockCreateCrate = vi.fn();

vi.mock("@/actions/crates", () => ({
	getUserCratesAction: (...args: unknown[]) => mockGetUserCratesAction(...args),
	addToCrate: (...args: unknown[]) => mockAddToCrate(...args),
	createCrate: (...args: unknown[]) => mockCreateCrate(...args),
}));

// ---------------------------------------------------------------------------
// Mock sonner toast
// ---------------------------------------------------------------------------
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { AddToCratePopover } from "@/components/crates/add-to-crate-popover";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeCrate(id: string, name: string, itemCount = 0) {
	return {
		id,
		userId: "user-123",
		name,
		date: "2026-03-29",
		sessionType: "digging_trip" as const,
		createdAt: new Date("2026-03-29"),
		updatedAt: new Date("2026-03-29"),
		itemCount,
	};
}

const DEFAULT_PROPS = {
	releaseId: "a0000000-0000-4000-a000-000000000099",
	discogsId: 12345,
	title: "Blue Train",
	artist: "John Coltrane",
	coverImageUrl: null,
};

// Since our Popover mock always renders content, and the component drives open
// state internally via useState, we need to trigger the open state by clicking
// the trigger. The component's useEffect loads crates when open becomes true.
// Our Popover mock renders children unconditionally, so we also need the
// component's internal open state to be true for the useEffect to fire.
// We'll click the trigger button (children) to set open=true.

describe("AddToCratePopover", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("when getUserCratesAction resolves with 2 crates, renders 2 crate name buttons", async () => {
		const crates = [
			makeCrate("crate-1", "Sabado Dig", 3),
			makeCrate("crate-2", "Jazz Finds", 7),
		];
		mockGetUserCratesAction.mockResolvedValue({ success: true, data: crates });

		render(
			<AddToCratePopover {...DEFAULT_PROPS}>
				<button type="button">Open</button>
			</AddToCratePopover>,
		);

		// Click the PopoverTrigger wrapper to fire onOpenChange(true)
		const trigger = screen.getByTestId("popover-trigger");
		await act(async () => {
			await userEvent.click(trigger);
		});

		// Wait for the async getUserCratesAction to resolve and render crate buttons
		await waitFor(() => {
			expect(screen.getByText("Sabado Dig")).toBeInTheDocument();
			expect(screen.getByText("Jazz Finds")).toBeInTheDocument();
		});
	});

	test("when getUserCratesAction resolves with empty array, renders inline name input", async () => {
		mockGetUserCratesAction.mockResolvedValue({ success: true, data: [] });

		render(
			<AddToCratePopover {...DEFAULT_PROPS}>
				<button type="button">Open</button>
			</AddToCratePopover>,
		);

		const trigger = screen.getByTestId("popover-trigger");
		await act(async () => {
			await userEvent.click(trigger);
		});

		await waitFor(() => {
			expect(
				screen.getByPlaceholderText("Crate name..."),
			).toBeInTheDocument();
		});
	});

	test("clicking a crate row calls addToCrate with the correct crateId", async () => {
		const crates = [makeCrate("crate-abc", "My Crate", 2)];
		mockGetUserCratesAction.mockResolvedValue({ success: true, data: crates });
		mockAddToCrate.mockResolvedValue({ success: true });

		render(
			<AddToCratePopover {...DEFAULT_PROPS}>
				<button type="button">Open</button>
			</AddToCratePopover>,
		);

		// Open the popover
		const trigger = screen.getByTestId("popover-trigger");
		await act(async () => {
			await userEvent.click(trigger);
		});

		// Wait for crate list to appear
		await waitFor(() => {
			expect(screen.getByText("My Crate")).toBeInTheDocument();
		});

		// Click the crate row
		const crateButton = screen.getByText("My Crate");
		await act(async () => {
			await userEvent.click(crateButton);
		});

		expect(mockAddToCrate).toHaveBeenCalledWith(
			expect.objectContaining({ crateId: "crate-abc" }),
		);
	});
});
