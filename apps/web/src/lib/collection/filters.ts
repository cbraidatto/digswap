import { z } from "zod";

export const CONDITION_GRADES = [
	"Mint",
	"VG+",
	"VG",
	"G+",
	"G",
	"F",
	"P",
] as const;
export type ConditionGrade = (typeof CONDITION_GRADES)[number];

export const DECADES = [
	{ label: "50s", startYear: 1950 },
	{ label: "60s", startYear: 1960 },
	{ label: "70s", startYear: 1970 },
	{ label: "80s", startYear: 1980 },
	{ label: "90s", startYear: 1990 },
	{ label: "00s", startYear: 2000 },
	{ label: "10s", startYear: 2010 },
	{ label: "20s", startYear: 2020 },
] as const;

export const SORT_OPTIONS = [
	{ value: "rarity", label: "Rarity" },
	{ value: "date", label: "Date Added" },
	{ value: "alpha", label: "A-Z" },
	{ value: "rating", label: "Rating" },
] as const;
export type SortOption = "rarity" | "date" | "alpha" | "rating";

/**
 * Returns the year range for a decade label (e.g. "80s" -> { start: 1980, end: 1990 }).
 * Returns null for unrecognized labels.
 */
export function getDecadeRange(
	decade: string,
): { start: number; end: number } | null {
	const entry = DECADES.find((d) => d.label === decade);
	if (!entry) return null;
	return { start: entry.startYear, end: entry.startYear + 10 };
}

export const collectionFilterSchema = z.object({
	genre: z.string().optional(),
	decade: z.string().optional(),
	format: z.string().optional(),
	sort: z.enum(["rarity", "date", "alpha", "rating"]).default("rarity"),
	search: z.string().max(200).optional(),
	page: z.coerce.number().int().min(1).default(1),
});
export type CollectionFilters = z.infer<typeof collectionFilterSchema>;
