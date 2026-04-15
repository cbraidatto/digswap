/**
 * Normalize a string for deduplication matching.
 * - Lowercases
 * - Strips leading articles (The, A, An)
 * - Removes punctuation (non-word, non-space)
 * - Collapses whitespace
 */
export function normalizeForDedup(value: string | null): string {
	if (!value) return "";
	return value
		.toLowerCase()
		.replace(/^(the|a|an)\s+/i, "")
		.replace(/[^\w\s]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * Create a dedup key from artist + album.
 * Used to group tracks into albums and match against existing releases.
 */
export function makeAlbumKey(artist: string | null, album: string | null): string {
	return `${normalizeForDedup(artist)}::${normalizeForDedup(album)}`;
}
