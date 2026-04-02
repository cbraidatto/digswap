import { SkeletonLine } from "@/components/ui/skeletons";

export default function AuthLoading() {
	return (
		<div className="min-h-screen flex items-center justify-center p-6">
			<div className="w-full max-w-md space-y-6">
				<div className="flex justify-center">
					<SkeletonLine className="h-10 w-36" />
				</div>
				<div className="bg-card rounded-lg border border-border p-6 space-y-4">
					<SkeletonLine className="h-6 w-40" />
					<SkeletonLine className="h-4 w-16" />
					<SkeletonLine className="h-10 w-full" />
					<SkeletonLine className="h-4 w-20" />
					<SkeletonLine className="h-10 w-full" />
					<SkeletonLine className="h-10 w-full rounded-md" />
				</div>
			</div>
		</div>
	);
}
