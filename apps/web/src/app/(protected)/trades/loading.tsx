import { SkeletonLine } from "@/components/ui/skeletons";

export default function TradesLoading() {
	return (
		<div className="max-w-2xl mx-auto px-4 py-8">
			<div className="mb-6">
				<SkeletonLine className="h-6 w-24 mb-2" />
				<SkeletonLine className="h-3 w-32" />
			</div>

			<div className="flex flex-col gap-2">
				{Array.from({ length: 5 }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static list
						key={i}
						className="bg-surface-container-lowest border border-outline-variant rounded p-4"
					>
						<div className="flex items-start justify-between gap-3 mb-2">
							<div className="flex items-center gap-2">
								<div className="w-7 h-7 rounded-full bg-surface-container-high animate-pulse" />
								<SkeletonLine className="h-3.5 w-24" />
							</div>
							<SkeletonLine className="h-5 w-16 rounded" />
						</div>
						<SkeletonLine className="h-2.5 w-3/4" />
					</div>
				))}
			</div>
		</div>
	);
}
