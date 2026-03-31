/**
 * Analyzes an audio file using Web Audio API to extract format metadata.
 * Decodes the file to determine duration, channels, and sample rate.
 */
export async function analyzeAudioFile(
	file: Blob,
): Promise<{
	format: string;
	duration: number;
	channels: number;
	sampleRate: number;
}> {
	const arrayBuffer = await file.arrayBuffer();
	const audioCtx = new AudioContext();

	try {
		const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
		return {
			format: detectFormat(file),
			duration: audioBuffer.duration,
			channels: audioBuffer.numberOfChannels,
			sampleRate: audioBuffer.sampleRate,
		};
	} finally {
		void audioCtx.close();
	}
}

/**
 * Detects audio format from the Blob's MIME type.
 */
function detectFormat(file: Blob): string {
	const typeMap: Record<string, string> = {
		"audio/flac": "FLAC",
		"audio/wav": "WAV",
		"audio/wave": "WAV",
		"audio/x-wav": "WAV",
		"audio/mp3": "MP3",
		"audio/mpeg": "MP3",
		"audio/ogg": "OGG",
		"audio/aac": "AAC",
	};

	return typeMap[file.type] || file.type || "Unknown";
}

/**
 * Formats a duration in seconds to mm:ss display.
 */
export function formatDuration(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Formats a file size in bytes to a human-readable string (KB, MB, GB).
 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
