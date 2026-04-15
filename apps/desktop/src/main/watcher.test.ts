import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------- Module-level mocks ----------

const mockOn = vi.fn();
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockWatcherInstance = { on: mockOn, close: mockClose };

const { mockWatch } = vi.hoisted(() => ({
  mockWatch: vi.fn().mockReturnValue({
    on: vi.fn().mockReturnThis(),
    close: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("chokidar", () => ({
  watch: mockWatch,
}));

// Module under test
import { startWatching, stopWatching, restartWatching } from "./watcher";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  // Reset watch mock to return a fresh instance each time
  mockWatch.mockReturnValue({
    on: mockOn.mockReturnThis(),
    close: mockClose,
  });
});

afterEach(() => {
  stopWatching();
  vi.useRealTimers();
});

describe("startWatching", () => {
  it("creates a chokidar watcher with correct config", () => {
    const cb = vi.fn();
    startWatching("/music", cb);
    expect(mockWatch).toHaveBeenCalledWith(
      "/music",
      expect.objectContaining({
        ignoreInitial: true,
        persistent: true,
        depth: Infinity,
      }),
    );
  });

  it("registers add, change, unlink, and error event handlers", () => {
    const cb = vi.fn();
    startWatching("/music", cb);
    const events = mockOn.mock.calls.map((c: any[]) => c[0]);
    expect(events).toContain("add");
    expect(events).toContain("change");
    expect(events).toContain("unlink");
    expect(events).toContain("error");
  });

  it("calls onSettled after 2-minute debounce on add event", () => {
    const cb = vi.fn();
    startWatching("/music", cb);
    // Find the 'add' handler and trigger it
    const addCall = mockOn.mock.calls.find((c: any[]) => c[0] === "add");
    expect(addCall).toBeDefined();
    const addHandler = addCall![1];
    addHandler();
    // Should not fire immediately
    expect(cb).not.toHaveBeenCalled();
    // Advance 2 minutes
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("debounces multiple rapid events into a single callback", () => {
    const cb = vi.fn();
    startWatching("/music", cb);
    const addCall = mockOn.mock.calls.find((c: any[]) => c[0] === "add");
    const addHandler = addCall![1];
    // Fire 5 events rapidly
    for (let i = 0; i < 5; i++) {
      addHandler();
      vi.advanceTimersByTime(1000); // 1 sec between events
    }
    // Advance past debounce
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe("stopWatching", () => {
  it("clears debounce timer and closes watcher", () => {
    const cb = vi.fn();
    startWatching("/music", cb);
    stopWatching();
    expect(mockClose).toHaveBeenCalled();
  });

  it("does not throw when called with no active watcher", () => {
    expect(() => stopWatching()).not.toThrow();
  });
});

describe("restartWatching", () => {
  it("restarts watcher on new path preserving callback", () => {
    const cb = vi.fn();
    startWatching("/music", cb);
    vi.clearAllMocks();
    mockWatch.mockReturnValue({
      on: mockOn.mockReturnThis(),
      close: mockClose,
    });
    restartWatching("/new/music");
    expect(mockWatch).toHaveBeenCalledWith(
      "/new/music",
      expect.objectContaining({ ignoreInitial: true }),
    );
  });

  it("does nothing when no active watcher exists", () => {
    restartWatching("/new/music");
    expect(mockWatch).not.toHaveBeenCalled();
  });
});
