import { SkeletonCard, SkeletonLine } from "@/components/ui/skeletons";

export default function CrateDetailLoading() {
	return (
		<div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
			<SkeletonLine className="h-7 w-48 mb-2" />
			<SkeletonLine className="h-3 w-32 mb-6" />
			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
				{Array.from({ length: 8 }).map((_, i) => (
					<SkeletonCard
						// biome-ignore lint/suspicious/noArrayIndexKey: static list
						key={i}
					/>
				))}
			</div>
		</div>
	);
}
