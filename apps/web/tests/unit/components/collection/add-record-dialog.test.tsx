import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";

// -- Mock server actions --
const mockSearchDiscogs = vi.fn();
const mockAddRecordToCollection = vi.fn();

vi.mock("@/actions/collection", () => ({
	searchDiscogs: (...args: unknown[]) => mockSearchDiscogs(...args),
	addRecordToCollection: (...args: unknown[]) =>
		mockAddRecordToCollection(...args),
}));

// -- Mock next/navigation --
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
	useRouter: () => ({
		refresh: mockRefresh,
		push: vi.fn(),
		replace: vi.fn(),
		back: vi.fn(),
		forward: vi.fn(),
		prefetch: vi.fn(),
	}),
}));

// -- Mock next/image --
vi.mock("next/image", () => ({
	default: (props: Record<string, unknown>) => {
		const { fill, ...rest } = props;
		return <img {...rest} />;
	},
}));

// -- Mock sonner toast --
vi.mock("sonner", () => ({
	toast: {
		success: vi.fn(),
		error: vi.fn(),
	},
}));

import { AddRecordDialog } from "@/app/(protected)/(profile)/perfil/_components/add-record-dialog";

describe("AddRecordDialog", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test("renders search input when open", () => {
		render(<AddRecordDialog open={true} onOpenChange={vi.fn()} />);

		expect(
			screen.getByPlaceholderText("Search by title or artist..."),
		).toBeInTheDocument();
	});

	test("calls searchDiscogs after typing with debounce", async () => {
		mockSearchDiscogs.mockResolvedValue([]);

		render(<AddRecordDialog open={true} onOpenChange={vi.fn()} />);

		const input = screen.getByPlaceholderText("Search by title or artist...");
		fireEvent.change(input, { target: { value: "Kind of Blue" } });

		// Should not have been called immediately
		expect(mockSearchDiscogs).not.toHaveBeenCalled();

		// Advance timers past the 300ms debounce
		await act(async () => {
			vi.advanceTimersByTime(350);
		});

		expect(mockSearchDiscogs).toHaveBeenCalledWith("Kind of Blue");
	});

	test("displays search results", async () => {
		vi.useRealTimers();

		let resolveSearch!: (value: unknown) => void;
		const searchPromise = new Promise((resolve) => {
			resolveSearch = resolve;
		});
		mockSearchDiscogs.mockReturnValue(searchPromise);

		render(<AddRecordDialog open={true} onOpenChange={vi.fn()} />);

		const input = screen.getByPlaceholderText("Search by title or artist...");

		await act(async () => {
			fireEvent.change(input, { target: { value: "Kind of Blue" } });
		});

		// Wait for debounce (300ms real time)
		await act(async () => {
			await new Promise((r) => setTimeout(r, 350));
		});

		// Resolve the search
		await act(async () => {
			resolveSearch([
				{
					discogsId: 1001,
					title: "Miles Davis - Kind of Blue",
					coverImage: null,
					year: "1959",
					format: "LP",
					genre: ["Jazz"],
					country: "US",
					have: 100,
					want: 200,
				},
			]);
		});

		await waitFor(() => {
			expect(screen.getByText("Kind of Blue")).toBeInTheDocument();
		});

		vi.useFakeTimers();
	});

	test("shows loading state during search", async () => {
		// Create a never-resolving promise to keep loading state
		mockSearchDiscogs.mockReturnValue(new Promise(() => {}));

		render(<AddRecordDialog open={true} onOpenChange={vi.fn()} />);

		const input = screen.getByPlaceholderText("Search by title or artist...");
		fireEvent.change(input, { target: { value: "Kind of Blue" } });

		// After typing but before debounce fires, isSearching should be set to true
		expect(screen.getByText("Searching Discogs...")).toBeInTheDocument();
	});

	test("does not search if query is less than 2 characters", async () => {
		render(<AddRecordDialog open={true} onOpenChange={vi.fn()} />);

		const input = screen.getByPlaceholderText("Search by title or artist...");
		fireEvent.change(input, { target: { value: "K" } });

		await act(async () => {
			vi.advanceTimersByTime(350);
		});

		expect(mockSearchDiscogs).not.toHaveBeenCalled();
	});
});
