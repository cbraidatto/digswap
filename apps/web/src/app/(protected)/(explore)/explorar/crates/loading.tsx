import { SkeletonLine } from "@/components/ui/skeletons";

export default function ExploreCratesLoading() {
	return (
		<div className="max-w-4xl mx-auto px-8 md:px-12 py-8">
			<SkeletonLine className="h-6 w-36 mb-6" />
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{Array.from({ length: 6 }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static list
						key={i}
						className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-4 space-y-3"
					>
						<SkeletonLine className="h-5 w-36" />
						<SkeletonLine className="h-3 w-full" />
						<SkeletonLine className="h-3 w-20" />
					</div>
				))}
			</div>
		</div>
	);
}
