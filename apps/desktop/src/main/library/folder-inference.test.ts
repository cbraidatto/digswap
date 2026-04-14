import { describe, it, expect } from "vitest";
import { inferFromPath } from "./folder-inference";

describe("inferFromPath", () => {
  it("Pattern 1: Artist/Album (Year)/NN - Title.ext", () => {
    const result = inferFromPath(
      "Miles Davis/Kind of Blue (1959)/01 - So What.flac",
    );
    expect(result).not.toBeNull();
    expect(result!.artist).toBe("Miles Davis");
    expect(result!.album).toBe("Kind of Blue");
    expect(result!.year).toBe(1959);
    expect(result!.trackNumber).toBe(1);
    expect(result!.title).toBe("So What");
  });

  it("Pattern 2: Artist/Album/NN - Title.ext", () => {
    const result = inferFromPath(
      "Coltrane/A Love Supreme/01 - Acknowledgement.flac",
    );
    expect(result).not.toBeNull();
    expect(result!.artist).toBe("Coltrane");
    expect(result!.album).toBe("A Love Supreme");
    expect(result!.trackNumber).toBe(1);
    expect(result!.title).toBe("Acknowledgement");
  });

  it("Pattern 3: Artist - Album (Year)/Title.ext", () => {
    const result = inferFromPath(
      "Art Blakey - Moanin (1958)/Blues March.wav",
    );
    expect(result).not.toBeNull();
    expect(result!.artist).toBe("Art Blakey");
    expect(result!.album).toBe("Moanin");
    expect(result!.year).toBe(1958);
    expect(result!.title).toBe("Blues March");
  });

  it("Pattern 4: Artist - Album/NN. Title.ext", () => {
    const result = inferFromPath(
      "Herbie Hancock - Head Hunters/1. Chameleon.aiff",
    );
    expect(result).not.toBeNull();
    expect(result!.artist).toBe("Herbie Hancock");
    expect(result!.album).toBe("Head Hunters");
    expect(result!.trackNumber).toBe(1);
    expect(result!.title).toBe("Chameleon");
  });

  it("Pattern 5: NN - Title.ext (flat folder)", () => {
    const result = inferFromPath("02 - Watermelon Man.flac");
    expect(result).not.toBeNull();
    expect(result!.trackNumber).toBe(2);
    expect(result!.title).toBe("Watermelon Man");
    expect(result!.artist).toBeUndefined();
    expect(result!.album).toBeUndefined();
  });

  it("Windows backslashes are normalized", () => {
    const result = inferFromPath("Artist\\Album\\01 - Title.flac");
    expect(result).not.toBeNull();
    expect(result!.artist).toBe("Artist");
    expect(result!.album).toBe("Album");
    expect(result!.trackNumber).toBe(1);
    expect(result!.title).toBe("Title");
  });

  it("returns null for no-match paths", () => {
    const result = inferFromPath("random-filename.flac");
    expect(result).toBeNull();
  });

  it("trims whitespace from extracted fields", () => {
    const result = inferFromPath(
      " Artist / Album / 01 - Title.flac",
    );
    expect(result).not.toBeNull();
    expect(result!.artist).toBe("Artist");
    expect(result!.album).toBe("Album");
    expect(result!.title).toBe("Title");
  });
});
