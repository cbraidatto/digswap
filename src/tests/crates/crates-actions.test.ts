// Stub — tests implemented in Plan 13-04
import { describe, it } from "vitest";

describe("crates server actions", () => {
  it.todo("createCrate creates a row and returns crateId");
  it.todo("addToCrate rejects when crate belongs to another user");
  it.todo("moveToWantlist inserts wantlist row and marks item found");
  it.todo("moveToCollection inserts collection row and marks item found");
  it.todo("markAsFound updates status to found");
  it.todo("createSet stores tracks with correct positions");
  it.todo("updateSetTracks recomputes positions contiguously");
});
