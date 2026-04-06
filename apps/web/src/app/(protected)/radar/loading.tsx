import { SkeletonLine } from "@/components/ui/skeletons";

export default function RadarLoading() {
	return (
		<div className="flex min-h-[calc(100vh-56px)]">
			<main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
				<div className="mb-6">
					<SkeletonLine className="h-3 w-20 mb-2" />
					<SkeletonLine className="h-8 w-48 mb-4" />
				</div>

				{/* Filter chips skeleton */}
				<div className="flex gap-2 mb-6">
					{Array.from({ length: 4 }).map((_, i) => (
						<SkeletonLine key={i} className="h-8 w-24 rounded-full" />
					))}
				</div>

				{/* Match list skeleton */}
				<div className="space-y-2">
					{Array.from({ length: 8 }).map((_, i) => (
						<div key={i} className="flex items-center gap-3 p-3 bg-surface-container-low border border-outline-variant/10 rounded">
							<div className="w-8 h-8 rounded-full bg-surface-container-high animate-pulse" />
							<div className="flex-1 space-y-1.5">
								<SkeletonLine className="h-3 w-24" />
								<SkeletonLine className="h-2.5 w-48" />
							</div>
							<SkeletonLine className="h-7 w-16 rounded" />
						</div>
					))}
				</div>
			</main>
		</div>
	);
}
