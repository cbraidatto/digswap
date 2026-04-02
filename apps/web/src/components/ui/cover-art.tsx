import Image from "next/image";
import { cn } from "@/lib/utils";

type CoverSize = "xs" | "sm" | "md" | "lg" | "xl" | "full";

const sizeMap: Record<CoverSize, { container: string; icon: string }> = {
	xs: { container: "w-8 h-8", icon: "text-sm" },
	sm: { container: "w-10 h-10", icon: "text-sm" },
	md: { container: "w-12 h-12", icon: "text-xl" },
	lg: { container: "w-20 h-20 max-sm:w-16 max-sm:h-16", icon: "text-2xl" },
	xl: { container: "w-[120px] h-[120px] max-sm:w-[80px] max-sm:h-[80px]", icon: "text-3xl" },
	full: { container: "w-full h-full", icon: "text-3xl" },
};

interface CoverArtProps {
	src: string | null | undefined;
	alt: string;
	size?: CoverSize;
	/** Explicit pixel width for next/image (required for fixed sizes, optional for "full") */
	width?: number;
	/** Explicit pixel height for next/image */
	height?: number;
	/** Use fill mode — good for aspect-ratio containers */
	fill?: boolean;
	className?: string;
	containerClassName?: string;
	rounded?: "rounded" | "rounded-full" | "rounded-lg" | "rounded-none";
	fallbackIcon?: string;
}

export function CoverArt({
	src,
	alt,
	size = "md",
	width,
	height,
	fill = false,
	className,
	containerClassName,
	rounded = "rounded",
	fallbackIcon = "album",
}: CoverArtProps) {
	const s = sizeMap[size];

	// Default pixel sizes when using fixed dimensions
	const resolvedWidth = width ?? (fill ? undefined : defaultPixel(size));
	const resolvedHeight = height ?? (fill ? undefined : defaultPixel(size));

	return (
		<div
			className={cn(
				size !== "full" && s.container,
				"bg-surface-container-high flex-shrink-0 flex items-center justify-center overflow-hidden",
				rounded,
				fill && "relative",
				containerClassName,
			)}
		>
			{src ? (
				<Image
					src={src}
					alt={alt}
					{...(fill
						? { fill: true }
						: { width: resolvedWidth, height: resolvedHeight })}
					className={cn("object-cover", rounded, className)}
					sizes={fill ? "(max-width: 640px) 100vw, 300px" : undefined}
					unoptimized={isExternalNonConfigured(src)}
				/>
			) : (
				<span
					className={cn(
						"material-symbols-outlined text-on-surface-variant/30",
						s.icon,
					)}
				>
					{fallbackIcon}
				</span>
			)}
		</div>
	);
}

function defaultPixel(size: CoverSize): number {
	switch (size) {
		case "xs": return 32;
		case "sm": return 40;
		case "md": return 48;
		case "lg": return 80;
		case "xl": return 120;
		case "full": return 300;
	}
}

/** Check if the URL is from a domain NOT in next.config remotePatterns */
function isExternalNonConfigured(src: string): boolean {
	try {
		const url = new URL(src);
		const allowed = ["i.discogs.com", "st.discogs.com", "i.ytimg.com"];
		return !allowed.includes(url.hostname);
	} catch {
		return false; // relative URLs are fine
	}
}
