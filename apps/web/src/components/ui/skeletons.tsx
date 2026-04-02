export function SkeletonLine({ className = "" }: { className?: string }) {
	return (
		<div
			className={`bg-surface-container-high rounded animate-pulse ${className}`}
		/>
	);
}

export function SkeletonDisc({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
	const sizeClass = {
		sm: "w-10 h-10",
		md: "w-24 h-24",
		lg: "w-32 h-32",
	}[size];

	return (
		<div
			className={`${sizeClass} rounded-full bg-surface-container-high animate-pulse`}
		/>
	);
}

export function SkeletonCard() {
	return (
		<div className="bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10">
			<div className="aspect-square bg-surface-container-high animate-pulse" />
			<div className="p-3 space-y-2">
				<SkeletonLine className="h-4 w-3/4" />
				<SkeletonLine className="h-3 w-1/2" />
			</div>
		</div>
	);
}

export function SkeletonFeedItem() {
	return (
		<div className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-4">
			<div className="flex items-center gap-3 mb-3">
				<SkeletonDisc size="sm" />
				<div className="flex-1 space-y-1.5">
					<SkeletonLine className="h-3.5 w-32" />
					<SkeletonLine className="h-2.5 w-20" />
				</div>
			</div>
			<SkeletonLine className="h-3 w-full mb-1.5" />
			<SkeletonLine className="h-3 w-2/3" />
		</div>
	);
}

export function SkeletonProfileHeader() {
	return (
		<div className="space-y-4">
			<div className="h-32 bg-surface-container-high rounded-lg animate-pulse" />
			<div className="flex items-end gap-4 -mt-10 px-4">
				<SkeletonDisc size="lg" />
				<div className="flex-1 space-y-2 pb-2">
					<SkeletonLine className="h-5 w-40" />
					<SkeletonLine className="h-3 w-24" />
				</div>
			</div>
		</div>
	);
}
