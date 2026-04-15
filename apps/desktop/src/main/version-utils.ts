export function compareAppVersions(left: string, right: string): number {
	const leftParts = normalizeVersion(left);
	const rightParts = normalizeVersion(right);

	for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
		const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
		if (delta !== 0) {
			return delta;
		}
	}

	return 0;
}

function normalizeVersion(value: string): number[] {
	return value
		.split(/[+-]/u)[0]
		.split(".")
		.map((segment) => {
			const parsed = Number.parseInt(segment, 10);
			return Number.isFinite(parsed) ? parsed : 0;
		});
}
