import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

// -- Mock Supabase browser client --
const mockOn = vi.fn().mockReturnThis();
const mockSubscribe = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
const mockRemoveChannel = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
	createClient: vi.fn(() => ({
		channel: vi.fn(() => ({
			on: mockOn,
			subscribe: mockSubscribe,
		})),
		removeChannel: mockRemoveChannel,
	})),
}));

// -- Mock next/navigation --
const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: vi.fn(() => ({
		push: mockPush,
		replace: vi.fn(),
		back: vi.fn(),
		forward: vi.fn(),
		refresh: vi.fn(),
		prefetch: vi.fn(),
	})),
}));

// -- Mock import store with a controllable state --
let storeState = {
	isActive: false,
	jobId: null as string | null,
	type: null as string | null,
	status: null as string | null,
	processedItems: 0,
	totalItems: 0,
	currentRecord: null as string | null,
};

const mockUpdateProgress = vi.fn((payload: Record<string, unknown>) => {
	storeState = {
		...storeState,
		jobId: payload.jobId as string,
		type: payload.type as string,
		status: payload.status as string,
		processedItems: payload.processedItems as number,
		totalItems: payload.totalItems as number,
		currentRecord: payload.currentRecord as string | null,
		isActive: payload.status === "processing" || payload.status === "pending",
	};
});

const mockReset = vi.fn();

vi.mock("@/stores/import-store", () => ({
	useImportStore: vi.fn(() => ({
		...storeState,
		updateProgress: mockUpdateProgress,
		reset: mockReset,
		setActive: vi.fn(),
	})),
}));

import { ImportProgress } from "@/components/discogs/import-progress";

describe("ImportProgress component", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		storeState = {
			isActive: false,
			jobId: null,
			type: null,
			status: null,
			processedItems: 0,
			totalItems: 0,
			currentRecord: null,
		};
	});

	test("renders skeleton state when no initialJob and no store data", () => {
		render(<ImportProgress userId="user-123" initialJob={null} />);

		// Should show the Disc3 icon (skeleton state) but no heading
		const disc = document.querySelector("svg");
		expect(disc).toBeTruthy();

		// No heading text in skeleton state
		expect(screen.queryByText("Importing your collection")).toBeNull();
		expect(screen.queryByText("Import complete!")).toBeNull();
	});

	test("renders progress bar with correct percentage in processing state", () => {
		storeState = {
			isActive: true,
			jobId: "job-1",
			type: "collection",
			status: "processing",
			processedItems: 50,
			totalItems: 200,
			currentRecord: "Kind of Blue -- Miles Davis",
		};

		render(
			<ImportProgress
				userId="user-123"
				initialJob={{
					id: "job-1",
					type: "collection",
					status: "processing",
					processedItems: 50,
					totalItems: 200,
					currentRecord: "Kind of Blue -- Miles Davis",
				}}
			/>,
		);

		// Heading
		expect(screen.getByText("Importing your collection")).toBeTruthy();

		// Record count
		expect(screen.getByText(/50/)).toBeTruthy();
		expect(screen.getByText(/200/)).toBeTruthy();

		// Current record
		expect(screen.getByText("Kind of Blue -- Miles Davis")).toBeTruthy();
	});

	test("displays current record name in processing state", () => {
		storeState = {
			isActive: true,
			jobId: "job-2",
			type: "collection",
			status: "processing",
			processedItems: 10,
			totalItems: 100,
			currentRecord: "A Love Supreme -- John Coltrane",
		};

		render(
			<ImportProgress
				userId="user-123"
				initialJob={{
					id: "job-2",
					type: "collection",
					status: "processing",
					processedItems: 10,
					totalItems: 100,
					currentRecord: "A Love Supreme -- John Coltrane",
				}}
			/>,
		);

		expect(screen.getByText("Currently importing:")).toBeTruthy();
		expect(screen.getByText("A Love Supreme -- John Coltrane")).toBeTruthy();
	});

	test("shows completed state with Import complete! heading", () => {
		storeState = {
			isActive: false,
			jobId: "job-3",
			type: "collection",
			status: "completed",
			processedItems: 150,
			totalItems: 150,
			currentRecord: null,
		};

		render(
			<ImportProgress
				userId="user-123"
				initialJob={{
					id: "job-3",
					type: "collection",
					status: "completed",
					processedItems: 150,
					totalItems: 150,
					currentRecord: null,
				}}
			/>,
		);

		expect(screen.getByText("Import complete!")).toBeTruthy();
		expect(screen.getByText("150 records imported")).toBeTruthy();
		expect(screen.getByText("Redirecting to your collection...")).toBeTruthy();
	});

	test("renders failed state with retry button", () => {
		storeState = {
			isActive: false,
			jobId: "job-4",
			type: "collection",
			status: "failed",
			processedItems: 30,
			totalItems: 100,
			currentRecord: null,
		};

		render(
			<ImportProgress
				userId="user-123"
				initialJob={{
					id: "job-4",
					type: "collection",
					status: "failed",
					processedItems: 30,
					totalItems: 100,
					currentRecord: null,
				}}
			/>,
		);

		expect(screen.getByText("Import paused")).toBeTruthy();
		expect(screen.getByText("Retry Import")).toBeTruthy();
	});

	test("renders wantlist heading when type is wantlist", () => {
		storeState = {
			isActive: true,
			jobId: "job-5",
			type: "wantlist",
			status: "processing",
			processedItems: 5,
			totalItems: 50,
			currentRecord: null,
		};

		render(
			<ImportProgress
				userId="user-123"
				initialJob={{
					id: "job-5",
					type: "wantlist",
					status: "processing",
					processedItems: 5,
					totalItems: 50,
					currentRecord: null,
				}}
			/>,
		);

		expect(screen.getByText("Importing your wantlist")).toBeTruthy();
	});

	test("progress bar has correct ARIA attributes", () => {
		storeState = {
			isActive: true,
			jobId: "job-6",
			type: "collection",
			status: "processing",
			processedItems: 75,
			totalItems: 300,
			currentRecord: "Head Hunters -- Herbie Hancock",
		};

		render(
			<ImportProgress
				userId="user-123"
				initialJob={{
					id: "job-6",
					type: "collection",
					status: "processing",
					processedItems: 75,
					totalItems: 300,
					currentRecord: "Head Hunters -- Herbie Hancock",
				}}
			/>,
		);

		const progressBar = screen.getByRole("progressbar");
		expect(progressBar).toBeTruthy();
		expect(progressBar.getAttribute("aria-label")).toBe("Import progress");
	});
});
