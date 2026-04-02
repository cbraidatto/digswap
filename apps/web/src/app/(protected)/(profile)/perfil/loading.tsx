import { SkeletonCard, SkeletonLine, SkeletonProfileHeader } from "@/components/ui/skeletons";

export default function PerfilLoading() {
	return (
		<div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8">
			<SkeletonProfileHeader />

			{/* Stats row */}
			<div className="flex gap-6 mt-6 mb-8">
				{Array.from({ length: 3 }).map((_, i) => (
					<div key={i} className="text-center">
						<SkeletonLine className="h-6 w-12 mx-auto mb-1" />
						<SkeletonLine className="h-3 w-16 mx-auto" />
					</div>
				))}
			</div>

			{/* Filter bar skeleton */}
			<div className="flex gap-2 mb-6">
				{Array.from({ length: 4 }).map((_, i) => (
					<SkeletonLine key={i} className="h-8 w-20 rounded-md" />
				))}
			</div>

			{/* Collection grid skeleton */}
			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
				{Array.from({ length: 12 }).map((_, i) => (
					<SkeletonCard key={i} />
				))}
			</div>
		</div>
	);
}
