import { Skeleton } from "@/components/ui/skeleton";

export function CollectionSkeleton() {
	return (
		<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{Array.from({ length: 12 }, (_, i) => (
				<div
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
					key={i}
					className="bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10"
				>
					{/* Cover art placeholder */}
					<Skeleton className="aspect-square w-full" />
					{/* Info placeholders */}
					<div className="p-3 space-y-2">
						<Skeleton className="h-4 w-3/4" />
						<Skeleton className="h-3 w-1/2" />
						<Skeleton className="h-4 w-16 rounded-full" />
					</div>
				</div>
			))}
		</div>
	);
}
