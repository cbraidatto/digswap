import { z } from "zod";

export const uuidSchema = z.string().uuid("Invalid identifier");

export const paginationSchema = z.object({
	page: z.number().int().min(1).max(1000).default(1),
	cursor: z.string().uuid().optional(),
});

/** Escape SQL wildcard characters for LIKE/ILIKE queries */
export function sanitizeWildcards(input: string): string {
	return input.replace(/[%_\\]/g, "\\$&");
}

// Validates URL format and restricts to http(s) protocols.
// Prevents javascript:, data:, vbscript:, and other dangerous schemes.
export const urlSchema = z
	.string()
	.url("Invalid URL")
	.max(500)
	.refine(
		(v) => {
			try {
				const p = new URL(v);
				return p.protocol === "https:" || p.protocol === "http:";
			} catch {
				return false;
			}
		},
		"URL must use http:// or https://",
	)
	.optional()
	.or(z.literal(""));

export type PaginationInput = z.infer<typeof paginationSchema>;
