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
		<div className="mb-8 rounded-2xl bg-gradient-to-br from-primary/10 via-surface-container-low to-secondary/8 border border-primary/10 p-6 relative overflow-hidden">
			{/* Background decoration */}
			<div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

			<div className="relative z-10">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<span
							className="material-symbols-outlined text-xl text-primary"
							style={{ fontVariationSettings: "'FILL' 1" }}
						>
							rocket_launch
						</span>
						<h2 className="font-heading text-base font-bold text-on-surface">Get started</h2>
					</div>
					<span className="font-mono text-xs text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
						{doneCount}/3
					</span>
				</div>

				{/* Progress bar */}
				<div className="h-1.5 bg-surface-container-high rounded-full mb-5 overflow-hidden">
					<div
						className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
						style={{ width: `${(doneCount / 3) * 100}%` }}
					/>
				</div>

				{/* All steps */}
				<div className="flex flex-col gap-2">
					{steps.map((step) => (
						<Link
							key={step.label}
							href={step.href}
							className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all ${
								step.done
									? "bg-primary/5 opacity-60"
									: "bg-surface-container-high/50 hover:bg-primary/10 hover:border-primary/20 border border-transparent"
							}`}
						>
							<span
								className={`material-symbols-outlined text-lg ${step.done ? "text-primary" : "text-on-surface-variant"}`}
								style={step.done ? { fontVariationSettings: "'FILL' 1" } : undefined}
							>
								{step.done ? "check_circle" : step.icon}
							</span>
							<span
								className={`font-mono text-xs flex-1 ${step.done ? "text-on-surface-variant line-through" : "text-on-surface font-medium"}`}
							>
								{step.label}
							</span>
							{!step.done && (
								<span className="material-symbols-outlined text-sm text-primary">
									arrow_forward
								</span>
							)}
						</Link>
					))}
				</div>
			</div>
		</div>
	);
}
