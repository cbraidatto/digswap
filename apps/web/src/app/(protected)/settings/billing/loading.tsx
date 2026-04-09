import { SkeletonLine } from "@/components/ui/skeletons";

export default function BillingLoading() {
	return (
		<div className="max-w-2xl mx-auto p-4 md:p-8">
			<SkeletonLine className="h-7 w-28 mb-6" />
			<div className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-5 mb-6 space-y-3">
				<SkeletonLine className="h-5 w-36" />
				<SkeletonLine className="h-3 w-48" />
				<SkeletonLine className="h-9 w-32 rounded-md" />
			</div>
			<div className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-5 space-y-3">
				<SkeletonLine className="h-5 w-40" />
				<SkeletonLine className="h-3 w-full" />
				<SkeletonLine className="h-3 w-2/3" />
			</div>
		</div>
	);
}
