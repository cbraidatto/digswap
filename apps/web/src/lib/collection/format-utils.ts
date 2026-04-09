export type CardVariant = "expanded-lp" | "expanded-ep" | "compact";

export function getCardVariant(format: string | null, tracklist: unknown): CardVariant {
	if (!format) return "compact";
	const f = format.toUpperCase();
	const hasMultipleTracks = Array.isArray(tracklist) && tracklist.length > 1;

	if (
		(f.includes("LP") || f.includes("COMPILATION") || f.includes("BOX SET")) &&
		hasMultipleTracks
	) {
		return "expanded-lp";
	}
	if (f.includes("EP") && hasMultipleTracks) {
		return "expanded-ep";
	}
	return "compact";
}

export function getFormatBadgeStyle(format: string | null): string {
	if (!format) return "bg-outline/10 text-on-surface-variant border-outline/20";
	const f = format.toUpperCase();
	if (f.includes("LP")) return "bg-primary/10 text-primary border-primary/20";
	if (f.includes("EP")) return "bg-secondary/10 text-secondary border-secondary/20";
	if (f.includes('7"') || f.includes('7"'))
		return "bg-tertiary/10 text-tertiary border-tertiary/20";
	if (f.includes('12"') || f.includes('12"'))
		return "bg-secondary/10 text-secondary border-secondary/20";
	if (f.includes("COMP")) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
	if (f.includes("BOX")) return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
	return "bg-outline/10 text-on-surface-variant border-outline/20";
}

export function getFormatLabel(format: string | null): string {
	if (!format) return "";
	const f = format.toUpperCase();
	if (f.includes("COMPILATION")) return "COMP";
	if (f.includes("BOX SET")) return "BOX";
	// Return the original format for LP, EP, 7", 12", Vinyl, CD, etc.
	return format;
}
