export const PREVIEW_BUCKET = "trade-previews";
export const PREVIEW_DURATION_SECONDS = 120;
export const PREVIEW_TTL_HOURS = 48;

export const ALLOWED_PREVIEW_FORMATS = [
	"flac",
	"mp3",
	"wav",
	"aiff",
	"ogg",
] as const;

export type PreviewFormat = (typeof ALLOWED_PREVIEW_FORMATS)[number];

export interface PreviewValidationContext {
	bitrate: number | null;
	collectionBitrate: number | null;
	collectionFormat: string | null;
	collectionSampleRate: number | null;
	durationSeconds: number | null;
	format: string | null;
	sampleRate: number | null;
}

export function normalizePreviewFormat(value: string | null | undefined): PreviewFormat | null {
	if (!value) {
		return null;
	}

	const normalized = value.trim().toLowerCase();
	if (normalized.includes("flac")) return "flac";
	if (normalized.includes("mpeg") || normalized.includes("mp3")) return "mp3";
	if (normalized.includes("wave") || normalized === "wav" || normalized.includes("x-wav")) {
		return "wav";
	}
	if (normalized.includes("aiff") || normalized === "aif" || normalized.includes("x-aiff")) {
		return "aiff";
	}
	if (normalized.includes("ogg")) return "ogg";
	return null;
}

export function parseMetadataNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string" && value.trim().length > 0) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
}

export function getMinimumBitrateForFormat(format: PreviewFormat): number {
	switch (format) {
		case "flac":
		case "wav":
		case "aiff":
			return 700_000;
		case "ogg":
			return 256_000;
		case "mp3":
			return 192_000;
	}
}

export function validatePreviewMetadata(context: PreviewValidationContext): string[] {
	const errors: string[] = [];
	const normalizedPreviewFormat = normalizePreviewFormat(context.format);
	const normalizedCollectionFormat = normalizePreviewFormat(context.collectionFormat);

	if (!normalizedPreviewFormat) {
		errors.push("Preview format is missing or unsupported.");
	} else if (!ALLOWED_PREVIEW_FORMATS.includes(normalizedPreviewFormat)) {
		errors.push(`Preview format "${context.format}" is not allowed.`);
	}

	if (
		context.durationSeconds === null ||
		Number.isNaN(context.durationSeconds) ||
		context.durationSeconds < PREVIEW_DURATION_SECONDS
	) {
		errors.push(`Preview duration must be at least ${PREVIEW_DURATION_SECONDS} seconds.`);
	}

	if (normalizedCollectionFormat && normalizedPreviewFormat && normalizedCollectionFormat !== normalizedPreviewFormat) {
		errors.push(
			`Preview format ${normalizedPreviewFormat} does not match the collection item format ${normalizedCollectionFormat}.`,
		);
	}

	if (normalizedPreviewFormat) {
		const minimumBitrate = Math.max(
			getMinimumBitrateForFormat(normalizedPreviewFormat),
			context.collectionBitrate ?? 0,
		);

		if (context.bitrate === null || Number.isNaN(context.bitrate) || context.bitrate < minimumBitrate) {
			errors.push(
				`Preview bitrate must be at least ${Math.round(minimumBitrate / 1000)} kbps for ${normalizedPreviewFormat}.`,
			);
		}
	}

	if (
		context.collectionSampleRate !== null &&
		context.sampleRate !== null &&
		context.sampleRate < context.collectionSampleRate
	) {
		errors.push(
			`Preview sample rate ${context.sampleRate} Hz is below the collection item sample rate ${context.collectionSampleRate} Hz.`,
		);
	}

	return errors;
}
