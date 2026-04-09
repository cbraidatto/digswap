import { SkeletonLine } from "@/components/ui/skeletons";

export default function OnboardingLoading() {
	return (
		<div className="min-h-screen flex items-center justify-center p-6">
			<div className="w-full max-w-md space-y-6 text-center">
				<SkeletonLine className="h-8 w-48 mx-auto" />
				<SkeletonLine className="h-4 w-64 mx-auto" />
				<div className="space-y-4 pt-4">
					<SkeletonLine className="h-10 w-full rounded-md" />
					<SkeletonLine className="h-10 w-full rounded-md" />
					<SkeletonLine className="h-10 w-full rounded-md" />
				</div>
				<SkeletonLine className="h-10 w-full rounded-md" />
			</div>
		</div>
	);
}
