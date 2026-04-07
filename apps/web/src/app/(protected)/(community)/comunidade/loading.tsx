import { SkeletonLine } from "@/components/ui/skeletons";

export default function ComunidadeLoading() {
	return (
		<div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
			<div className="flex items-center justify-between mb-8">
				<SkeletonLine className="h-7 w-40" />
				<SkeletonLine className="h-8 w-28 rounded-md" />
			</div>

			{/* Group cards skeleton */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{Array.from({ length: 6 }).map((_, i) => (
					<div
						key={i}
						className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-4 space-y-3"
					>
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-full bg-surface-container-high animate-pulse" />
							<div className="flex-1 space-y-1.5">
								<SkeletonLine className="h-4 w-32" />
								<SkeletonLine className="h-3 w-20" />
							</div>
						</div>
						<SkeletonLine className="h-3 w-full" />
						<SkeletonLine className="h-3 w-2/3" />
						<div className="flex gap-2 pt-1">
							<SkeletonLine className="h-5 w-14 rounded-full" />
							<SkeletonLine className="h-5 w-14 rounded-full" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
