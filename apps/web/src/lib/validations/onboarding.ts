import { z } from "zod";

/**
 * Validates that a URL is HTTPS and hosted on the project's own Supabase Storage.
 * Prevents external tracking pixels, mixed-content issues, and javascript: XSS.
 * The NEXT_PUBLIC_SUPABASE_URL env var always contains the project's base URL,
 * so we can derive the allowed storage hostname from it at module load time.
 */
const supabaseStorageHost = (() => {
	try {
		return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
	} catch {
		return null;
	}
})();

const avatarUrlSchema = z
	.string()
	.url("Invalid URL")
	.max(500)
	.refine((v) => {
		try {
			const parsed = new URL(v);
			// Must be HTTPS
			if (parsed.protocol !== "https:") return false;
			// Must be on the project's own Supabase Storage domain
			if (supabaseStorageHost && !parsed.hostname.endsWith(supabaseStorageHost)) return false;
			return true;
		} catch {
			return false;
		}
	}, "Avatar must be hosted on the app's storage (https only).")
	.optional()
	.or(z.literal(""))
	.or(z.literal(null));

export const onboardingProfileSchema = z.object({
	display_name: z
		.string()
		.min(3, "Display name must be at least 3 characters.")
		.max(50, "Display name must be 50 characters or less.")
		.regex(
			/^[a-zA-Z0-9_-]+$/,
			"Display name can only contain letters, numbers, hyphens, and underscores.",
		),
	avatar_url: avatarUrlSchema,
});

export const skipToStepSchema = z.object({
	step: z.number().int().min(1).max(10),
});

export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;
export type SkipToStepInput = z.infer<typeof skipToStepSchema>;
