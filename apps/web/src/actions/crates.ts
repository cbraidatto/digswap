"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { crates, crateItems, sets, setTracks } from "@/lib/db/schema/crates";
import { wantlistItems } from "@/lib/db/schema/wantlist";
import { collectionItems } from "@/lib/db/schema/collections";
import { createClient } from "@/lib/supabase/server";
import {
  createCrateSchema,
  updateCrateSchema,
  addToCrateSchema,
  crateItemIdSchema,
  createSetSchema,
  updateSetTracksSchema,
} from "@/lib/validations/crates";
import { getCrates } from "@/lib/crates/queries";
import type { CrateRow } from "@/lib/crates/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// ---------------------------------------------------------------------------
// Crate mutations
// ---------------------------------------------------------------------------

export async function createCrate(
  input: unknown,
): Promise<{ success: boolean; data?: { crateId: string }; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const parsed = createCrateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { name, date, sessionType } = parsed.data;

    const [row] = await db
      .insert(crates)
      .values({
        userId: user.id,
        name,
        date,
        sessionType,
      })
      .returning({ crateId: crates.id });

    if (!row) return { success: false, error: "Failed to create crate" };

    revalidatePath("/crates");
    return { success: true, data: { crateId: row.crateId } };
  } catch (err) {
    console.error("[createCrate] error:", err);
    return { success: false, error: "Failed to create crate. Please try again." };
  }
}

export async function updateCrate(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const parsed = updateCrateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { id, ...fields } = parsed.data;

    await db
      .update(crates)
      .set({ ...fields, updatedAt: new Date() })
      .where(and(eq(crates.id, id), eq(crates.userId, user.id)));

    revalidatePath("/crates");
    revalidatePath(`/crates/${id}`);
    return { success: true };
  } catch (err) {
    console.error("[updateCrate] error:", err);
    return { success: false, error: "Failed to update crate. Please try again." };
  }
}

export async function toggleCrateVisibility(
  crateId: string,
  isPublic: boolean,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Not authenticated" };

    await db
      .update(crates)
      .set({ isPublic, updatedAt: new Date() })
      .where(and(eq(crates.id, crateId), eq(crates.userId, user.id)));

    revalidatePath("/crates");
    revalidatePath(`/crates/${crateId}`);
    revalidatePath("/explorar/crates");
    return { success: true };
  } catch (err) {
    console.error("[toggleCrateVisibility] error:", err);
    return { success: false, error: "Failed to update visibility. Please try again." };
  }
}

export async function deleteCrate(
  crateId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Not authenticated" };

    await db
      .delete(crates)
      .where(and(eq(crates.id, crateId), eq(crates.userId, user.id)));

    revalidatePath("/crates");
    return { success: true };
  } catch (err) {
    console.error("[deleteCrate] error:", err);
    return { success: false, error: "Failed to delete crate. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Crate item mutations
// ---------------------------------------------------------------------------

export async function addToCrate(
  input: unknown,
): Promise<{ success: boolean; data?: { crateItemId: string }; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const parsed = addToCrateSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { crateId, releaseId, discogsId, title, artist, coverImageUrl } = parsed.data;

    // Verify crate ownership before inserting
    const [ownedCrate] = await db
      .select({ id: crates.id })
      .from(crates)
      .where(and(eq(crates.id, crateId), eq(crates.userId, user.id)))
      .limit(1);

    if (!ownedCrate) {
      return { success: false, error: "Crate not found or access denied" };
    }

    const [row] = await db
      .insert(crateItems)
      .values({
        crateId,
        userId: user.id,
        releaseId,
        discogsId,
        title,
        artist,
        coverImageUrl,
        status: "active",
      })
      .returning({ crateItemId: crateItems.id });

    if (!row) return { success: false, error: "Failed to add item to crate" };

    revalidatePath(`/crates/${crateId}`);
    return { success: true, data: { crateItemId: row.crateItemId } };
  } catch (err) {
    console.error("[addToCrate] error:", err);
    return { success: false, error: "Failed to add to crate. Please try again." };
  }
}

export async function moveToWantlist(
  crateItemId: string,
): Promise<{ success: boolean; data?: { wantlistItemId: string }; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const parsed = crateItemIdSchema.safeParse({ crateItemId });
    if (!parsed.success) {
      return { success: false, error: "Invalid crate item id" };
    }

    // Lookup crate item, verify ownership
    const [item] = await db
      .select()
      .from(crateItems)
      .where(
        and(eq(crateItems.id, crateItemId), eq(crateItems.userId, user.id)),
      )
      .limit(1);

    if (!item) return { success: false, error: "Crate item not found or access denied" };

    // Insert into wantlist_items
    const [wantlistRow] = await db
      .insert(wantlistItems)
      .values({
        userId: user.id,
        releaseId: item.releaseId,
        addedVia: "crate",
      })
      .returning({ wantlistItemId: wantlistItems.id });

    if (!wantlistRow) return { success: false, error: "Failed to add to wantlist" };

    // Mark crate item as found
    await db
      .update(crateItems)
      .set({ status: "found" })
      .where(and(eq(crateItems.id, crateItemId), eq(crateItems.userId, user.id)));

    revalidatePath(`/crates/${item.crateId}`);
    revalidatePath("/perfil");
    return { success: true, data: { wantlistItemId: wantlistRow.wantlistItemId } };
  } catch (err) {
    console.error("[moveToWantlist] error:", err);
    return { success: false, error: "Failed to move to wantlist. Please try again." };
  }
}

export async function moveToCollection(
  crateItemId: string,
): Promise<{ success: boolean; data?: { collectionItemId: string }; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const parsed = crateItemIdSchema.safeParse({ crateItemId });
    if (!parsed.success) {
      return { success: false, error: "Invalid crate item id" };
    }

    // Lookup crate item, verify ownership
    const [item] = await db
      .select()
      .from(crateItems)
      .where(
        and(eq(crateItems.id, crateItemId), eq(crateItems.userId, user.id)),
      )
      .limit(1);

    if (!item) return { success: false, error: "Crate item not found or access denied" };

    // Insert into collection_items
    const [collectionRow] = await db
      .insert(collectionItems)
      .values({
        userId: user.id,
        releaseId: item.releaseId,
        addedVia: "crate",
      })
      .returning({ collectionItemId: collectionItems.id });

    if (!collectionRow) return { success: false, error: "Failed to add to collection" };

    // Mark crate item as found
    await db
      .update(crateItems)
      .set({ status: "found" })
      .where(and(eq(crateItems.id, crateItemId), eq(crateItems.userId, user.id)));

    revalidatePath(`/crates/${item.crateId}`);
    revalidatePath("/perfil");
    return { success: true, data: { collectionItemId: collectionRow.collectionItemId } };
  } catch (err) {
    console.error("[moveToCollection] error:", err);
    return { success: false, error: "Failed to move to collection. Please try again." };
  }
}

export async function markAsFound(
  crateItemId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const parsed = crateItemIdSchema.safeParse({ crateItemId });
    if (!parsed.success) {
      return { success: false, error: "Invalid crate item id" };
    }

    // Get item to find crateId for revalidation
    const [item] = await db
      .select({ crateId: crateItems.crateId })
      .from(crateItems)
      .where(
        and(eq(crateItems.id, crateItemId), eq(crateItems.userId, user.id)),
      )
      .limit(1);

    if (!item) return { success: false, error: "Crate item not found or access denied" };

    await db
      .update(crateItems)
      .set({ status: "found" })
      .where(and(eq(crateItems.id, crateItemId), eq(crateItems.userId, user.id)));

    revalidatePath(`/crates/${item.crateId}`);
    return { success: true };
  } catch (err) {
    console.error("[markAsFound (crates)] error:", err);
    return { success: false, error: "Failed to mark as found. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Set mutations
// ---------------------------------------------------------------------------

export async function createSet(
  input: unknown,
): Promise<{ success: boolean; data?: { setId: string }; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const parsed = createSetSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { crateId, eventDate, venueName, trackOrder } = parsed.data;

    // Verify crate ownership
    const [ownedCrate] = await db
      .select({ id: crates.id })
      .from(crates)
      .where(and(eq(crates.id, crateId), eq(crates.userId, user.id)))
      .limit(1);

    if (!ownedCrate) {
      return { success: false, error: "Crate not found or access denied" };
    }

    // Verify all crateItemIds belong to this crate
    const ownedItems = await db
      .select({ id: crateItems.id })
      .from(crateItems)
      .where(
        and(
          inArray(crateItems.id, trackOrder),
          eq(crateItems.crateId, crateId),
          eq(crateItems.userId, user.id),
        ),
      );

    if (ownedItems.length !== trackOrder.length) {
      return {
        success: false,
        error: "One or more track items do not belong to this crate",
      };
    }

    // Insert set
    const [setRow] = await db
      .insert(sets)
      .values({
        crateId,
        userId: user.id,
        eventDate,
        venueName,
      })
      .returning({ setId: sets.id });

    if (!setRow) return { success: false, error: "Failed to create set" };

    // Bulk insert set_tracks with 1-based positions
    const trackInserts = trackOrder.map((crateItemId, index) => ({
      setId: setRow.setId,
      crateItemId,
      userId: user.id,
      position: index + 1,
    }));

    await db.insert(setTracks).values(trackInserts);

    revalidatePath(`/crates/${crateId}`);
    return { success: true, data: { setId: setRow.setId } };
  } catch (err) {
    console.error("[createSet] error:", err);
    return { success: false, error: "Failed to create set. Please try again." };
  }
}

export async function updateSetTracks(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const parsed = updateSetTracksSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const { setId, trackOrder } = parsed.data;

    // Verify set ownership
    const [ownedSet] = await db
      .select({ id: sets.id, crateId: sets.crateId })
      .from(sets)
      .where(and(eq(sets.id, setId), eq(sets.userId, user.id)))
      .limit(1);

    if (!ownedSet) {
      return { success: false, error: "Set not found or access denied" };
    }

    // Delete existing tracks
    await db.delete(setTracks).where(eq(setTracks.setId, setId));

    // Bulk insert with recomputed positions (1, 2, 3...)
    const trackInserts = trackOrder.map((crateItemId, index) => ({
      setId,
      crateItemId,
      userId: user.id,
      position: index + 1,
    }));

    await db.insert(setTracks).values(trackInserts);

    revalidatePath(`/crates/${ownedSet.crateId}`);
    return { success: true };
  } catch (err) {
    console.error("[updateSetTracks] error:", err);
    return { success: false, error: "Failed to update set tracks. Please try again." };
  }
}

export async function deleteSet(
  setId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Not authenticated" };

    // Get crateId for revalidation
    const [ownedSet] = await db
      .select({ crateId: sets.crateId })
      .from(sets)
      .where(and(eq(sets.id, setId), eq(sets.userId, user.id)))
      .limit(1);

    if (!ownedSet) return { success: false, error: "Set not found or access denied" };

    await db
      .delete(sets)
      .where(and(eq(sets.id, setId), eq(sets.userId, user.id)));

    revalidatePath(`/crates/${ownedSet.crateId}`);
    return { success: true };
  } catch (err) {
    console.error("[deleteSet] error:", err);
    return { success: false, error: "Failed to delete set. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// Read action (used by client components like AddToCratePopover)
// ---------------------------------------------------------------------------

export async function getUserCratesAction(): Promise<
  { success: boolean; data?: (CrateRow & { itemCount: number })[]; error?: string }
> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Not authenticated" };

    const data = await getCrates(user.id);
    return { success: true, data };
  } catch (err) {
    console.error("[getUserCratesAction] error:", err);
    return { success: false, error: "Failed to load crates. Please try again." };
  }
}
