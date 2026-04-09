import { SkeletonLine } from "@/components/ui/skeletons";

export default function TradeDetailLoading() {
	return (
		<div className="max-w-2xl mx-auto px-4 py-8">
			<SkeletonLine className="h-3 w-16 mb-6" />

			{/* Header skeleton */}
			<div className="border-b border-outline-variant pb-5 mb-6">
				<SkeletonLine className="h-3 w-20 mb-4" />
				<div className="flex items-center gap-3 mb-5">
					<div className="w-10 h-10 rounded-full bg-surface-container-high animate-pulse" />
					<div className="space-y-1.5">
						<SkeletonLine className="h-3.5 w-28" />
						<SkeletonLine className="h-2.5 w-20" />
					</div>
				</div>
			</div>

			{/* Messages skeleton */}
			<div className="space-y-3 min-h-[300px]">
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static list
						key={i}
						className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
					>
						<SkeletonLine className={`h-12 rounded-lg ${i % 2 === 0 ? "w-2/3" : "w-1/2"}`} />
					</div>
				))}
			</div>
		</div>
	);
}
