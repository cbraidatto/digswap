import { describe, expect, it, vi } from "vitest";
import { uploadPreviewToStorage } from "./preview-uploader";

describe("uploadPreviewToStorage", () => {
  it("uploads preview metadata and returns a signed URL payload", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.test/signed-preview" },
      error: null,
    });

    const client = {
      storage: {
        from: vi.fn().mockReturnValue({
          upload,
          createSignedUrl,
        }),
      },
    } as any;

    const result = await uploadPreviewToStorage(
      client,
      "trade-123",
      "user-456",
      "proposal-789",
      process.execPath,
      {
        bitrate: 320000,
        duration: 180,
        format: "mp3",
        sampleRate: 44100,
      },
    );

    expect(upload).toHaveBeenCalledWith(
      "trade-123/user-456/proposal-789.exe",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "audio/mpeg",
        metadata: expect.objectContaining({
          bitrate: 320000,
          duration_seconds: 180,
          format: "mp3",
          proposal_item_id: "proposal-789",
          sample_rate: 44100,
          trade_id: "trade-123",
          uploader_user_id: "user-456",
        }),
        upsert: false,
      }),
    );
    expect(createSignedUrl).toHaveBeenCalledWith("trade-123/user-456/proposal-789.exe", 172800);
    expect(result.signedUrl).toBe("https://example.test/signed-preview");
    expect(result.storagePath).toBe("trade-123/user-456/proposal-789.exe");
    expect(new Date(result.expiresAt).toString()).not.toBe("Invalid Date");
  });
});
