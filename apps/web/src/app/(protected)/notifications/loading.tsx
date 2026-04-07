import { SkeletonLine } from "@/components/ui/skeletons";

export default function NotificationsLoading() {
	return (
		<div className="max-w-2xl mx-auto px-4 py-8">
			<div className="mb-6">
				<SkeletonLine className="h-6 w-32 mb-2" />
			</div>

			<div className="space-y-2">
				{Array.from({ length: 8 }).map((_, i) => (
					<div
						key={i}
						className="flex items-start gap-3 p-3 bg-surface-container-low border border-outline-variant/10 rounded"
					>
						<div className="w-8 h-8 rounded-full bg-surface-container-high animate-pulse flex-shrink-0" />
						<div className="flex-1 space-y-1.5">
							<SkeletonLine className="h-3.5 w-3/4" />
							<SkeletonLine className="h-2.5 w-1/2" />
						</div>
						<SkeletonLine className="h-2.5 w-10 flex-shrink-0" />
					</div>
				))}
			</div>
		</div>
	);
}
