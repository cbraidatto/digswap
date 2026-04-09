import { SkeletonLine } from "@/components/ui/skeletons";

export default function SessionsLoading() {
	return (
		<div className="max-w-2xl mx-auto p-4 md:p-8">
			<SkeletonLine className="h-7 w-32 mb-6" />
			<div className="space-y-3">
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static list
						key={i}
						className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-4 flex items-center justify-between"
					>
						<div className="space-y-1.5">
							<SkeletonLine className="h-4 w-36" />
							<SkeletonLine className="h-3 w-24" />
						</div>
						<SkeletonLine className="h-8 w-20 rounded-md" />
					</div>
				))}
			</div>
		</div>
	);
}
