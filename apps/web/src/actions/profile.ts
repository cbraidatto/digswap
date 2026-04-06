"use server";

import { and, eq, ilike, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import { profiles } from "@/lib/db/schema/users";
import { z } from "zod";
import { apiRateLimit , safeLimit} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { sanitizeWildcards, uuidSchema } from "@/lib/validations/common";
import { updateProfileSchema } from "@/lib/validations/profile";

export type ShowcaseSlot = "searching" | "rarest" | "favorite";

const showcaseSlotSchema = z.enum(["searching", "rarest", "favorite"]);
const showcaseReleaseIdSchema = uuidSchema.nullable();

const SLOT_COLUMN = {
	searching: "showcaseSearchingId",
	rarest:    "showcaseRarestId",
	favorite:  "showcaseFavoriteId",
} as const;

// ---------------------------------------------------------------------------
// Upload security helpers
// ---------------------------------------------------------------------------

/**
 * Allowed image types for avatar and cover uploads.
 * Keys are MIME types; values are the magic-byte signatures to check.
 * Only JPEG, PNG, and WebP are permitted — SVG and HTML are explicitly excluded
 * because browsers execute inline script in SVGs served from the same origin.
 */
const ALLOWED_IMAGE_TYPES: Record<string, { magic: number[]; ext: string[] }> = {
	"image/jpeg": { magic: [0xff, 0xd8, 0xff],          ext: ["jpg", "jpeg"] },
	"image/png":  { magic: [0x89, 0x50, 0x4e, 0x47],    ext: ["png"] },
	"image/webp": { magic: [0x52, 0x49, 0x46, 0x46],    ext: ["webp"] },
};

/**
 * Validates an image file by checking:
 *  1. MIME type is in the allowlist (blocks SVG, HTML, etc.)
 *  2. File extension matches the declared MIME type
 *  3. Magic bytes match the declared MIME type (prevents disguised executables)
 *
 * Returns an error string if invalid, or null if valid.
 */
async function validateImageFile(file: File): Promise<string | null> {
	const allowed = ALLOWED_IMAGE_TYPES[file.type];
	if (!allowed) {
		return "Only JPEG, PNG, and WebP images are allowed.";
	}

	const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
	if (!allowed.ext.includes(ext)) {
		return `File extension .${ext} does not match the declared type ${file.type}.`;
	}

	// Read the first 12 bytes to check magic bytes
	const headerBytes = await file.slice(0, 12).arrayBuffer();
	const header = new Uint8Array(headerBytes);

	const magicMatches = allowed.magic.every((byte, i) => header[i] === byte);
	if (!magicMatches) {
		return "File content does not match its declared type.";
	}

	return null; // valid
}

export async function updateShowcase(slot: ShowcaseSlot, releaseId: string | null) {
	try {
		// S-01: Validate slot at runtime — TypeScript types don't enforce RPC boundaries
		const parsedSlot = showcaseSlotSchema.safeParse(slot);
		if (!parsedSlot.success) {
			return { error: "Invalid showcase slot." };
		}

		// S-05: Validate releaseId as UUID
		const parsedReleaseId = showcaseReleaseIdSchema.safeParse(releaseId);
		if (!parsedReleaseId.success) {
			return { error: "Invalid release ID." };
		}

		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return { error: "Unauthenticated" };

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		await db
			.update(profiles)
			.set({ [SLOT_COLUMN[parsedSlot.data]]: parsedReleaseId.data, updatedAt: new Date() })
			.where(eq(profiles.id, user.id));

		revalidatePath("/perfil");
		return { ok: true };
	} catch (err) {
		console.error("[updateShowcase] error:", err);
		return { error: "Failed to update showcase. Please try again." };
	}
}

export async function searchCollectionForShowcase(query: string) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return [];

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, false);
		if (!rlSuccess) {
			return [];
		}

		const term = query.trim().slice(0, 200);
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
	} catch (err) {
		console.error("[searchCollectionForShowcase] error:", err);
		return [];
	}
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
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return { error: "Unauthenticated" };

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		// Validate URL fields with Zod schema — covers all social URL fields
		const urlValidation = updateProfileSchema.safeParse({
			displayName: data.displayName,
			bio: data.bio,
			youtubeUrl: data.youtubeUrl,
			websiteUrl: data.discogsUrl,
		});
		if (!urlValidation.success) {
			return { error: urlValidation.error.issues[0]?.message ?? "Invalid profile data" };
		}

		// Validate social URLs explicitly — must be https:// to prevent javascript: XSS
		const socialUrls = {
			instagramUrl: data.instagramUrl,
			soundcloudUrl: data.soundcloudUrl,
			beatportUrl: data.beatportUrl,
		};
		for (const [field, value] of Object.entries(socialUrls)) {
			if (value && value.trim()) {
				try {
					const parsed = new URL(value.trim());
					if (parsed.protocol !== "https:") {
						return { error: `${field} must use https://` };
					}
				} catch {
					return { error: `Invalid URL for ${field}` };
				}
			}
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
	} catch (err) {
		console.error("[updateProfile] error:", err);
		return { error: "Failed to update profile. Please try again." };
	}
}

export async function uploadCoverImage(formData: FormData) {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { error: "Unauthenticated" };

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const file = formData.get("cover") as File | null;
		if (!file || file.size === 0) return { error: "No file provided" };
		if (file.size > 5 * 1024 * 1024) return { error: "File too large (max 5MB)" };

		// Validate MIME type, extension, and magic bytes before uploading
		const validationError = await validateImageFile(file);
		if (validationError) return { error: validationError };

		// Use the canonical extension derived from the validated MIME type, not
		// the client-supplied filename, to prevent path traversal and type confusion.
		const canonicalExt = ALLOWED_IMAGE_TYPES[file.type].ext[0];
		const path = `${user.id}/cover.${canonicalExt}`;

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
	} catch (err) {
		console.error("[uploadCoverImage] error:", err);
		return { error: "Failed to upload cover image. Please try again." };
	}
}

export async function uploadAvatar(formData: FormData) {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { error: "Unauthenticated" };

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const file = formData.get("avatar") as File | null;
		if (!file || file.size === 0) return { error: "No file provided" };
		if (file.size > 2 * 1024 * 1024) return { error: "File too large (max 2MB)" };

		// Validate MIME type, extension, and magic bytes before uploading
		const validationError = await validateImageFile(file);
		if (validationError) return { error: validationError };

		// Use canonical extension from validated MIME type — never trust client filename
		const canonicalExt = ALLOWED_IMAGE_TYPES[file.type].ext[0];
		const path = `${user.id}/avatar.${canonicalExt}`;

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
	} catch (err) {
		console.error("[uploadAvatar] error:", err);
		return { error: "Failed to upload avatar. Please try again." };
	}
}

export async function updateHolyGrails(ids: string[]) {
	try {
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) return { error: "Not authenticated" };

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		if (ids.length > 3) return { error: "Maximum 3 Holy Grails allowed" };

		// SECURITY: Validate each ID is a valid UUID to prevent injection of arbitrary strings
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
		if (ids.some((id) => !uuidRegex.test(id))) {
			return { error: "Invalid release ID format" };
		}

		await db
			.update(profiles)
			.set({ holyGrailIds: ids, updatedAt: new Date() })
			.where(eq(profiles.id, user.id));

		revalidatePath("/perfil");
		return { success: true };
	} catch (err) {
		console.error("[updateHolyGrails] error:", err);
		return { error: "Failed to update Holy Grails. Please try again." };
	}
}

export async function saveCoverPosition(positionY: number) {
	try {
		// S-03: Validate positionY at runtime — reject NaN/Infinity
		const parsed = z.number().finite().safeParse(positionY);
		if (!parsed.success) {
			return { error: "Invalid position value." };
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { error: "Unauthenticated" };

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const clamped = Math.min(100, Math.max(0, parsed.data));

		await db
			.update(profiles)
			.set({ coverPositionY: String(clamped), updatedAt: new Date() })
			.where(eq(profiles.id, user.id));

		revalidatePath("/perfil");
		return { ok: true };
	} catch (err) {
		console.error("[saveCoverPosition] error:", err);
		return { error: "Failed to save cover position. Please try again." };
	}
}
