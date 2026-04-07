import type { InferSelectModel } from "drizzle-orm";
import type { crateItems, crates, sets, setTracks } from "@/lib/db/schema/crates";

export type CrateRow = InferSelectModel<typeof crates>;
export type CrateItemRow = InferSelectModel<typeof crateItems>;
export type SetRow = InferSelectModel<typeof sets>;
export type SetTrackRow = InferSelectModel<typeof setTracks>;

export type CrateWithItems = CrateRow & {
	items: CrateItemRow[];
	itemCount: number;
};

export type SetWithTracks = SetRow & {
	tracks: (SetTrackRow & { item: CrateItemRow })[];
};
