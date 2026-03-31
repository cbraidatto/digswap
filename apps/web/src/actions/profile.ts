"use server";

import { and, eq, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import { profiles } from "@/lib/db/schema/users";
import { apiRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { sanitizeWildcards } from "@/lib/validations/common";
import { updateProfileSchema } from "@/lib/validations/profile";

export type ShowcaseSlot = "searching" | "rarest" | "favorite";

const SLOT_COLUMN = {
	searching: "showcaseSearchingId",
	rarest:    "showcaseRarestId",
	favorite:  "showcaseFavoriteId",
} as const;

export async function updateShowcase(slot: ShowcaseSlot, releaseId: string | null) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthenticated" };

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	await db
		.update(profiles)
		.set({ [SLOT_COLUMN[slot]]: releaseId, updatedAt: new Date() })
		.where(eq(profiles.id, user.id));

	revalidatePath("/perfil");
	return { ok: true };
}

export async function searchCollectionForShowcase(query: string) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return [];

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return [];
	}

	const term = query.trim();
	if (!term) return [];

	const sanitized = sanitizeWildcards(term);

	const rows = await db
		.selectDistinctOn([releases.id], {
			id:            releases.id,
			title:         releases.title,
			artist:        releases.artist,
			year:          releases.year,
			coverImageUrl: releases.coverImageUrl,
		})
		.from(collectionItems)
		.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
		.where(
			and(
				eq(collectionItems.userId, user.id),
				or(
					ilike(releases.title,  `%${sanitized}%`),
					ilike(releases.artist, `%${sanitized}%`),
				),
			),
		)
		.limit(8);

	return rows;
}

export async function updateProfile(data: {
	displayName: string;
	username: string;
	location: string;
	bio?: string;
	youtubeUrl?:    string;
	instagramUrl?:  string;
	soundcloudUrl?: string;
	discogsUrl?:    string;
	beatportUrl?:   string;
}) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthenticated" };

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	// Validate URL fields with Zod schema
	const urlValidation = updateProfileSchema.safeParse({
		displayName: data.displayName,
		bio: data.bio,
		youtubeUrl: data.youtubeUrl,
		websiteUrl: data.discogsUrl, // validate as URL
	});
	if (!urlValidation.success) {
		return { error: urlValidation.error.issues[0]?.message ?? "Invalid profile data" };
	}

	const displayName = data.displayName.trim().slice(0, 50);
	const username = data.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
	const location = data.location.trim().slice(0, 300);
	const bio = (data.bio ?? "").trim().slice(0, 300);

	if (!displayName) return { error: "Display name is required" };
	if (username && username.length < 3) return { error: "Username must be at least 3 characters" };

	const clean = (v?: string) => v?.trim() || null;

	const profileData = {
		displayName,
		username:      username || null,
		location:      location || null,
		bio:           bio || null,
		youtubeUrl:    clean(data.youtubeUrl),
		instagramUrl:  clean(data.instagramUrl),
		soundcloudUrl: clean(data.soundcloudUrl),
		discogsUrl:    clean(data.discogsUrl),
		beatportUrl:   clean(data.beatportUrl),
		updatedAt:     new Date(),
	};

	await db
		.insert(profiles)
		.values({ id: user.id, ...profileData })
		.onConflictDoUpdate({ target: profiles.id, set: profileData });

	revalidatePath("/perfil");
	return { ok: true };
}

export async function uploadCoverImage(formData: FormData) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { error: "Unauthenticated" };

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const file = formData.get("cover") as File | null;
	if (!file || file.size === 0) return { error: "No file provided" };
	if (file.size > 5 * 1024 * 1024) return { error: "File too large (max 5MB)" };

	const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
	const path = `${user.id}/cover.${ext}`;

	const { error: uploadError } = await supabase.storage
		.from("profile-covers")
		.upload(path, file, { upsert: true, contentType: file.type });

	if (uploadError) return { error: uploadError.message };

	const { data: urlData } = supabase.storage
		.from("profile-covers")
		.getPublicUrl(path);

	// Bust cache with timestamp
	const coverUrl = `${urlData.publicUrl}?t=${Date.now()}`;

	await db
		.update(profiles)
		.set({ coverUrl, updatedAt: new Date() })
		.where(eq(profiles.id, user.id));

	revalidatePath("/perfil");
	return { url: coverUrl };
}

export async function uploadAvatar(formData: FormData) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { error: "Unauthenticated" };

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const file = formData.get("avatar") as File | null;
	if (!file || file.size === 0) return { error: "No file provided" };
	if (file.size > 2 * 1024 * 1024) return { error: "File too large (max 2MB)" };

	const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
	const path = `${user.id}/avatar.${ext}`;

	const { error: uploadError } = await supabase.storage
		.from("profile-covers")
		.upload(path, file, { upsert: true, contentType: file.type });

	if (uploadError) return { error: uploadError.message };

	const { data: urlData } = supabase.storage
		.from("profile-covers")
		.getPublicUrl(path);

	const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

	await db
		.update(profiles)
		.set({ avatarUrl, updatedAt: new Date() })
		.where(eq(profiles.id, user.id));

	revalidatePath("/perfil");
	return { url: avatarUrl };
}

export async function updateHolyGrails(ids: string[]) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Not authenticated" };

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	if (ids.length > 3) return { error: "Maximum 3 Holy Grails allowed" };

	await db
		.update(profiles)
		.set({ holyGrailIds: ids, updatedAt: new Date() })
		.where(eq(profiles.id, user.id));

	revalidatePath("/perfil");
	return { success: true };
}

export async function saveCoverPosition(positionY: number) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { error: "Unauthenticated" };

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const clamped = Math.min(100, Math.max(0, positionY));

	await db
		.update(profiles)
		.set({ coverPositionY: String(clamped), updatedAt: new Date() })
		.where(eq(profiles.id, user.id));

	revalidatePath("/perfil");
	return { ok: true };
}
