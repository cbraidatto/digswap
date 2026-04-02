import { SkeletonFeedItem, SkeletonLine } from "@/components/ui/skeletons";

export default function FeedLoading() {
	return (
		<div className="flex min-h-[calc(100vh-56px)]">
			<main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
				<div className="mb-8">
					<SkeletonLine className="h-8 w-48 mb-4" />
				</div>

				{/* Radar skeleton */}
				<div className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-4 mb-6">
					<SkeletonLine className="h-4 w-32 mb-3" />
					<div className="flex gap-3 overflow-hidden">
						{Array.from({ length: 4 }).map((_, i) => (
							<div key={i} className="w-20 h-20 rounded-full bg-surface-container-high animate-pulse flex-shrink-0" />
						))}
					</div>
				</div>

				{/* Feed items skeleton */}
				<div className="space-y-4">
					{Array.from({ length: 5 }).map((_, i) => (
						<SkeletonFeedItem key={i} />
					))}
				</div>
			</main>
		</div>
	);
}
