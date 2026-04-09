import { SkeletonLine } from "@/components/ui/skeletons";

export default function GroupDetailLoading() {
	return (
		<div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
			{/* Group header */}
			<div className="flex items-center gap-4 mb-6">
				<div className="w-14 h-14 rounded-full bg-surface-container-high animate-pulse" />
				<div className="space-y-2">
					<SkeletonLine className="h-6 w-40" />
					<SkeletonLine className="h-3 w-24" />
				</div>
			</div>
			<SkeletonLine className="h-3 w-full mb-2" />
			<SkeletonLine className="h-3 w-2/3 mb-6" />
			{/* Post skeletons */}
			<div className="space-y-4">
				{Array.from({ length: 3 }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static list
						key={i}
						className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-4 space-y-2"
					>
						<SkeletonLine className="h-4 w-32" />
						<SkeletonLine className="h-3 w-full" />
						<SkeletonLine className="h-3 w-3/4" />
					</div>
				))}
			</div>
		</div>
	);
}
