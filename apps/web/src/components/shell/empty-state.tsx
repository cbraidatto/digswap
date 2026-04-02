import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
	icon: LucideIcon;
	heading: string;
	body: string;
	action?: {
		label: string;
		href?: string;
		onClick?: () => void;
	};
}

export function EmptyState({ icon: Icon, heading, body, action }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center min-h-[40vh] text-center px-4 py-12">
			<div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
				<Icon className="size-8 text-primary/60" />
			</div>
			<h2 className="font-heading text-lg font-semibold text-foreground">{heading}</h2>
			<p className="mt-2 max-w-[320px] text-sm text-muted-foreground leading-relaxed">{body}</p>
			{action && (
				action.href ? (
					<a
						href={action.href}
						className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
					>
						{action.label}
						<span className="material-symbols-outlined text-base">arrow_forward</span>
					</a>
				) : action.onClick ? (
					<button
						onClick={action.onClick}
						type="button"
						className="mt-5 text-sm px-4 py-2 rounded-lg border border-primary/40 text-primary hover:bg-primary/10 transition-colors font-medium"
					>
						{action.label}
					</button>
				) : null
			)}
		</div>
	);
}
