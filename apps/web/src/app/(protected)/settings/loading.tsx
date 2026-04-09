import { SkeletonLine } from "@/components/ui/skeletons";

export default function SettingsLoading() {
	return (
		<div className="max-w-2xl mx-auto p-4 md:p-8">
			<SkeletonLine className="h-7 w-32 mb-6" />
			<div className="space-y-6">
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static list
						key={i}
						className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-4 space-y-3"
					>
						<SkeletonLine className="h-4 w-28" />
						<SkeletonLine className="h-9 w-full rounded-md" />
					</div>
				))}
			</div>
		</div>
	);
}
