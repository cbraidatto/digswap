import { z } from "zod";

export const onboardingProfileSchema = z.object({
	display_name: z
		.string()
		.min(3, "Display name must be at least 3 characters.")
		.max(50, "Display name must be 50 characters or less.")
		.regex(
			/^[a-zA-Z0-9_-]+$/,
			"Display name can only contain letters, numbers, hyphens, and underscores.",
		),
	avatar_url: z.string().url("Invalid URL").max(500).optional().or(z.literal("")).or(z.literal(null)),
});

export const skipToStepSchema = z.object({
	step: z.number().int().min(1).max(10),
});

export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;
export type SkipToStepInput = z.infer<typeof skipToStepSchema>;
