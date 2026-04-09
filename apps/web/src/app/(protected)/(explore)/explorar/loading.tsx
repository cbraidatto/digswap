import { SkeletonCard, SkeletonLine } from "@/components/ui/skeletons";

export default function ExplorarLoading() {
	return (
		<div className="min-h-[calc(100vh-56px)] flex flex-col">
			{/* Tab bar skeleton */}
			<div className="w-full border-b border-outline-variant/10">
				<div className="px-6 flex gap-6">
					<SkeletonLine className="h-8 w-20" />
					<SkeletonLine className="h-8 w-20" />
				</div>
			</div>

			{/* Search skeleton */}
			<div className="w-full bg-surface-container-low px-8 md:px-12 pt-8 pb-10">
				<div className="max-w-4xl mx-auto">
					<SkeletonLine className="h-10 w-full rounded-md mb-4" />
					<SkeletonLine className="h-4 w-48" />
				</div>
			</div>

			{/* Results grid skeleton */}
			<div className="flex-1 px-8 md:px-12 py-8">
				<div className="max-w-4xl mx-auto">
					<SkeletonLine className="h-5 w-32 mb-4" />
					<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
						{Array.from({ length: 8 }).map((_, i) => (
							<SkeletonCard
								// biome-ignore lint/suspicious/noArrayIndexKey: static list
								key={i}
							/>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
