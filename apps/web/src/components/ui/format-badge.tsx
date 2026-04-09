import { getFormatBadgeStyle, getFormatLabel } from "@/lib/collection/format-utils";

interface FormatBadgeProps {
	format: string | null;
	className?: string;
}

export function FormatBadge({ format, className = "" }: FormatBadgeProps) {
	const label = getFormatLabel(format);
	if (!label) return null;

	const style = getFormatBadgeStyle(format);

	return (
		<span
			className={`inline-flex items-center font-mono text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${style} ${className}`}
		>
			{label}
		</span>
	);
}
