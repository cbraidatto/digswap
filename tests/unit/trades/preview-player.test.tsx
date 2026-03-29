import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mock AudioContext — jsdom does not provide Web Audio API
// ---------------------------------------------------------------------------

const mockDecodeAudioData = vi.fn().mockResolvedValue({
	duration: 60,
	getChannelData: () => new Float32Array(44100 * 60).fill(0.5),
});

const mockCreateBufferSource = vi.fn(() => ({
	connect: vi.fn(),
	start: vi.fn(),
	stop: vi.fn(),
	buffer: null,
	onended: null,
}));

const mockAudioContextInstance = {
	decodeAudioData: mockDecodeAudioData,
	createBufferSource: mockCreateBufferSource,
	destination: {},
	currentTime: 0,
	state: "running",
	resume: vi.fn().mockResolvedValue(undefined),
	close: vi.fn().mockResolvedValue(undefined),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).AudioContext = vi.fn(() => mockAudioContextInstance);

// ---------------------------------------------------------------------------
// Mock canvas getContext — jsdom canvas has no rendering context
// ---------------------------------------------------------------------------

HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
	clearRect: vi.fn(),
	fillRect: vi.fn(),
	fillStyle: "",
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
}) as any;

// ---------------------------------------------------------------------------
// Mock getComputedStyle (used inside drawWaveform for CSS custom properties)
// ---------------------------------------------------------------------------

const originalGetComputedStyle = globalThis.getComputedStyle;
vi.spyOn(globalThis, "getComputedStyle").mockImplementation(
	(el) => {
		const result = originalGetComputedStyle(el);
		return {
			...result,
			getPropertyValue: (prop: string) => {
				if (prop === "--color-primary") return "#c4a882";
				if (prop === "--color-surface-container") return "#3a3530";
				return "";
			},
		} as CSSStyleDeclaration;
	},
);

// ---------------------------------------------------------------------------
// Import component after mocks
// ---------------------------------------------------------------------------

import { PreviewPlayer } from "@/app/(protected)/trades/[id]/_components/preview-player";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PreviewPlayer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Re-apply AudioContext mock since clearAllMocks resets the fn
		mockDecodeAudioData.mockResolvedValue({
			duration: 60,
			getChannelData: () => new Float32Array(44100 * 60).fill(0.5),
		});
	});

	it("renders canvas element", () => {
		const blob = new Blob([new ArrayBuffer(1000)], { type: "audio/mp3" });
		const { container } = render(
			<PreviewPlayer previewBlob={blob} label="TEST" />,
		);
		expect(container.querySelector("canvas")).toBeTruthy();
	});

	it("renders play button", () => {
		const blob = new Blob([new ArrayBuffer(1000)], { type: "audio/mp3" });
		render(<PreviewPlayer previewBlob={blob} label="TEST" />);
		expect(screen.getByText("PLAY_PREVIEW")).toBeTruthy();
	});

	it("renders label", () => {
		const blob = new Blob([new ArrayBuffer(1000)], { type: "audio/mp3" });
		render(<PreviewPlayer previewBlob={blob} label="PARTNER_PREVIEW" />);
		expect(screen.getByText("PARTNER_PREVIEW")).toBeTruthy();
	});

	it("renders ADVANCED_SPECTRUM button when callback provided", () => {
		const blob = new Blob([new ArrayBuffer(1000)], { type: "audio/mp3" });
		render(
			<PreviewPlayer
				previewBlob={blob}
				label="TEST"
				onAdvancedSpectrum={() => {}}
			/>,
		);
		expect(screen.getByText("ADVANCED_SPECTRUM")).toBeTruthy();
	});

	it("does not render ADVANCED_SPECTRUM when no callback", () => {
		const blob = new Blob([new ArrayBuffer(1000)], { type: "audio/mp3" });
		render(<PreviewPlayer previewBlob={blob} label="TEST" />);
		expect(screen.queryByText("ADVANCED_SPECTRUM")).toBeNull();
	});
});
