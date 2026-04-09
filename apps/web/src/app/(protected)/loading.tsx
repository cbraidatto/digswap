import { SkeletonLine } from "@/components/ui/skeletons";

export default function ProtectedLoading() {
	return (
		<div className="pt-14 lg:pl-64 min-h-screen">
			<div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
				<div className="space-y-3 mb-8">
					<SkeletonLine className="h-7 w-48" />
					<SkeletonLine className="h-4 w-32" />
				</div>
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
					{Array.from({ length: 8 }).map((_, i) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
							key={i}
							className="bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10"
						>
							<div className="aspect-square bg-surface-container-high animate-pulse" />
							<div className="p-3 space-y-2">
								<SkeletonLine className="h-4 w-3/4" />
								<SkeletonLine className="h-3 w-1/2" />
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
