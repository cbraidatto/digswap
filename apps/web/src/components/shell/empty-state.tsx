import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
	icon: LucideIcon;
	heading: string;
	body: string;
}

export function EmptyState({ icon: Icon, heading, body }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-[16px]">
			<Icon className="size-12" style={{ color: "oklch(0.72 0.14 65 / 0.4)" }} />
			<h2 className="mt-[32px] font-heading text-xl font-semibold text-foreground">{heading}</h2>
			<p className="mt-[8px] max-w-[280px] text-base text-muted-foreground">{body}</p>
		</div>
	);
}
