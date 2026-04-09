import { SkeletonLine } from "@/components/ui/skeletons";

export default function NewGroupLoading() {
	return (
		<div className="max-w-lg mx-auto p-4 md:p-8">
			<SkeletonLine className="h-7 w-40 mb-6" />
			<div className="space-y-5">
				<div className="space-y-2">
					<SkeletonLine className="h-4 w-20" />
					<SkeletonLine className="h-10 w-full rounded-md" />
				</div>
				<div className="space-y-2">
					<SkeletonLine className="h-4 w-24" />
					<SkeletonLine className="h-24 w-full rounded-md" />
				</div>
				<SkeletonLine className="h-10 w-full rounded-md" />
			</div>
		</div>
	);
}
