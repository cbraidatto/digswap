import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------- Module-level mocks (vi.hoisted) ----------

const { mockHandle, mockShowOpenDialog, mockGetLibraryDb, mockGetAllTracks,
  mockGetLibraryRoot, mockScanFolder } = vi.hoisted(() => ({
  mockHandle: vi.fn(),
  mockShowOpenDialog: vi.fn(),
  mockGetLibraryDb: vi.fn(),
  mockGetAllTracks: vi.fn(),
  mockGetLibraryRoot: vi.fn(),
  mockScanFolder: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: { handle: mockHandle },
  dialog: { showOpenDialog: mockShowOpenDialog },
}));

vi.mock("./db", () => ({
  getLibraryDb: mockGetLibraryDb,
  getAllTracks: mockGetAllTracks,
  getLibraryRoot: mockGetLibraryRoot,
  closeLibraryDb: vi.fn(),
}));

vi.mock("./scanner", () => ({
  scanFolder: mockScanFolder,
}));

// Module under test
import { registerLibraryIpc } from "./library-ipc";

// ---------- Helpers ----------

const handlers = new Map<string, (...args: unknown[]) => unknown>();
const mockSendToMainWindow = vi.fn();
const mockDb = {};

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();

  mockHandle.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
    handlers.set(channel, handler);
  });

  mockGetLibraryDb.mockReturnValue(mockDb);

  registerLibraryIpc(mockSendToMainWindow);
});

function getHandler(channel: string) {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler registered for ${channel}`);
  return handler;
}

// ---------- Tests ----------

describe("registerLibraryIpc", () => {
  it("registers all 6 IPC handlers", () => {
    expect(handlers.size).toBe(6);
    expect(handlers.has("desktop:select-library-folder")).toBe(true);
    expect(handlers.has("desktop:start-scan")).toBe(true);
    expect(handlers.has("desktop:start-incremental-scan")).toBe(true);
    expect(handlers.has("desktop:start-full-scan")).toBe(true);
    expect(handlers.has("desktop:get-library-tracks")).toBe(true);
    expect(handlers.has("desktop:get-library-root")).toBe(true);
  });
});

describe("desktop:select-library-folder", () => {
  it("returns null when dialog is canceled", async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    const result = await getHandler("desktop:select-library-folder")();
    expect(result).toBeNull();
  });

  it("returns filePaths[0] when not canceled", async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ["/home/user/music"],
    });
    const result = await getHandler("desktop:select-library-folder")();
    expect(result).toBe("/home/user/music");
  });

  it("calls dialog.showOpenDialog with openDirectory property", async () => {
    mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });
    await getHandler("desktop:select-library-folder")();
    expect(mockShowOpenDialog).toHaveBeenCalledWith({
      properties: ["openDirectory"],
      title: "Selecionar pasta da biblioteca",
    });
  });
});

describe("desktop:start-scan", () => {
  it("calls scanFolder with correct arguments", async () => {
    const mockResult = { filesFound: 5, filesProcessed: 5, errors: [] };
    mockScanFolder.mockResolvedValue(mockResult);

    const result = await getHandler("desktop:start-scan")({}, "/music");
    expect(result).toEqual(mockResult);
    expect(mockScanFolder).toHaveBeenCalledWith(
      "/music",
      expect.any(Function),
      { incremental: false },
    );
  });

  it("sends progress events via sendToMainWindow", async () => {
    mockScanFolder.mockImplementation(
      async (_path: string, onProgress: (event: unknown) => void) => {
        onProgress({ filesFound: 10, filesProcessed: 3, currentPath: "/a.flac", errorCount: 0 });
        return { filesFound: 10, filesProcessed: 10, errors: [] };
      },
    );

    await getHandler("desktop:start-scan")({}, "/music");
    expect(mockSendToMainWindow).toHaveBeenCalledWith("desktop:scan-progress", {
      filesFound: 10,
      filesProcessed: 3,
      currentPath: "/a.flac",
      errorCount: 0,
    });
  });
});

describe("desktop:start-incremental-scan", () => {
  it("returns error when no library root configured", async () => {
    mockGetLibraryRoot.mockReturnValue(null);
    const result = await getHandler("desktop:start-incremental-scan")();
    expect(result).toEqual({
      filesFound: 0,
      filesProcessed: 0,
      errors: [{ filePath: "", reason: "No library root configured" }],
    });
  });

  it("calls scanFolder with incremental: true when root exists", async () => {
    mockGetLibraryRoot.mockReturnValue("/music");
    mockScanFolder.mockResolvedValue({ filesFound: 2, filesProcessed: 2, errors: [] });

    await getHandler("desktop:start-incremental-scan")();
    expect(mockScanFolder).toHaveBeenCalledWith(
      "/music",
      expect.any(Function),
      { incremental: true },
    );
  });
});

describe("desktop:start-full-scan", () => {
  it("returns error when no library root configured", async () => {
    mockGetLibraryRoot.mockReturnValue(null);
    const result = await getHandler("desktop:start-full-scan")();
    expect(result).toEqual({
      filesFound: 0,
      filesProcessed: 0,
      errors: [{ filePath: "", reason: "No library root configured" }],
    });
  });

  it("calls scanFolder with incremental: false when root exists", async () => {
    mockGetLibraryRoot.mockReturnValue("/music");
    mockScanFolder.mockResolvedValue({ filesFound: 10, filesProcessed: 10, errors: [] });

    await getHandler("desktop:start-full-scan")();
    expect(mockScanFolder).toHaveBeenCalledWith(
      "/music",
      expect.any(Function),
      { incremental: false },
    );
  });
});

describe("desktop:get-library-tracks", () => {
  it("returns tracks from db", () => {
    const mockTracks = [
      { id: "1", filePath: "/a.flac", title: "Track 1" },
      { id: "2", filePath: "/b.flac", title: "Track 2" },
    ];
    mockGetAllTracks.mockReturnValue(mockTracks);

    const result = getHandler("desktop:get-library-tracks")();
    expect(result).toEqual(mockTracks);
    expect(mockGetAllTracks).toHaveBeenCalledWith(mockDb);
  });
});

describe("desktop:get-library-root", () => {
  it("returns root path from db", () => {
    mockGetLibraryRoot.mockReturnValue("/home/user/music");
    const result = getHandler("desktop:get-library-root")();
    expect(result).toBe("/home/user/music");
    expect(mockGetLibraryRoot).toHaveBeenCalledWith(mockDb);
  });

  it("returns null when no root configured", () => {
    mockGetLibraryRoot.mockReturnValue(null);
    const result = getHandler("desktop:get-library-root")();
    expect(result).toBeNull();
  });
});
