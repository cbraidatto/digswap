import Link from "next/link";

interface FeedWelcomeBannerProps {
	discogsConnected: boolean;
	followingCount: number;
}

export function FeedWelcomeBanner({ discogsConnected, followingCount }: FeedWelcomeBannerProps) {
	const steps = [
		{ done: discogsConnected, label: "Connect Discogs", href: "/settings", icon: "link" },
		{
			done: followingCount >= 3,
			label: `Follow 3 diggers (${Math.min(followingCount, 3)}/3)`,
			href: "/explorar",
			icon: "person_add",
		},
		{ done: false, label: "Join a community", href: "/comunidade", icon: "group" },
	];

	const doneCount = steps.filter((s) => s.done).length;

	return (
		<div className="mb-6 rounded-xl bg-gradient-to-r from-primary/5 via-surface-container-low to-secondary/5 border border-outline-variant/10 p-5">
			<div className="flex items-center justify-between mb-3">
				<h2 className="font-heading text-sm font-bold text-on-surface">Get started</h2>
				<span className="font-mono text-[10px] text-on-surface-variant">{doneCount}/3</span>
			</div>

			{/* Progress dots */}
			<div className="flex gap-1.5 mb-4">
				{steps.map((step, i) => (
					<div
						key={i}
						className={`h-1 flex-1 rounded-full transition-colors ${
							step.done ? "bg-primary" : "bg-surface-container-high"
						}`}
					/>
				))}
			</div>

			{/* Next step — show the first incomplete step prominently */}
			<div className="flex items-center gap-3">
				{steps
					.filter((s) => !s.done)
					.slice(0, 1)
					.map((step) => (
						<Link
							key={step.label}
							href={step.href}
							className="flex items-center gap-2 bg-primary/10 hover:bg-primary/15 text-primary font-mono text-xs px-3 py-2 rounded-lg transition-colors"
						>
							<span className="material-symbols-outlined text-[16px]">{step.icon}</span>
							{step.label}
							<span className="material-symbols-outlined text-[14px]">arrow_forward</span>
						</Link>
					))}
			</div>
		</div>
	);
}
