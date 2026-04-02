import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "DigSwap — The social network for vinyl diggers",
	description:
		"Import your Discogs collection, discover who has the records you're hunting, and connect with serious diggers worldwide. Rarity scores, wantlist matching, and community-powered crate digging.",
	openGraph: {
		title: "DigSwap — The social network for vinyl diggers",
		description:
			"Import your Discogs collection, discover who has the records you're hunting, and connect with serious diggers worldwide.",
		type: "website",
		siteName: "DigSwap",
	},
	twitter: {
		card: "summary_large_image",
		title: "DigSwap — The social network for vinyl diggers",
		description:
			"Import your Discogs collection, discover who has the records you're hunting, and connect with serious diggers worldwide.",
	},
};

function FeatureCard({
	icon,
	title,
	description,
}: {
	icon: string;
	title: string;
	description: string;
}) {
	return (
		<div className="bg-surface-container-low/80 backdrop-blur-sm rounded-xl border border-outline-variant/10 p-6 transition-all hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
			<div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
				<span className="material-symbols-outlined text-primary text-xl">
					{icon}
				</span>
			</div>
			<h3 className="font-heading text-base font-semibold text-on-surface mb-1.5">
				{title}
			</h3>
			<p className="text-sm text-on-surface-variant leading-relaxed">
				{description}
			</p>
		</div>
	);
}

function StatBlock({ value, label }: { value: string; label: string }) {
	return (
		<div className="text-center">
			<div className="font-heading text-2xl md:text-3xl font-bold text-primary">
				{value}
			</div>
			<div className="text-xs text-on-surface-variant mt-0.5">{label}</div>
		</div>
	);
}

export default function Home() {
	return (
		<div className="min-h-screen relative overflow-hidden">
			{/* Subtle background texture */}
			<div
				className="fixed inset-0 opacity-[0.02] pointer-events-none"
				style={{
					backgroundImage:
						"radial-gradient(var(--primary) 1px, transparent 1px)",
					backgroundSize: "32px 32px",
				}}
			/>

			{/* ─── Hero Section ─── */}
			<section className="relative z-10 flex flex-col items-center justify-center min-h-[85vh] px-6 pt-16 pb-12">
				{/* Logo / Brand */}
				<div className="mb-6 flex items-center gap-2">
					<span className="material-symbols-outlined text-primary text-3xl">
						album
					</span>
					<span className="font-heading text-xl font-bold text-on-surface tracking-tight">
						DIGSWAP
					</span>
				</div>

				{/* Headline */}
				<h1 className="font-heading text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tighter text-on-surface text-center max-w-4xl leading-[0.95]">
					Find who has the record
					<br />
					<span className="text-primary">you&apos;ve been hunting</span>
				</h1>

				{/* Subheadline */}
				<p className="mt-6 text-base md:text-lg text-on-surface-variant text-center max-w-xl leading-relaxed">
					The social network for vinyl diggers. Import your Discogs library,
					discover matches with other collectors, and connect with the
					community.
				</p>

				{/* CTAs */}
				<div className="mt-10 flex flex-col sm:flex-row gap-3 w-full max-w-sm">
					<Link
						href="/signup"
						className="flex-1 bg-primary text-on-primary font-medium py-3 px-6 rounded-lg text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
					>
						Start digging
						<span className="material-symbols-outlined text-base">
							arrow_forward
						</span>
					</Link>
					<Link
						href="/signin"
						className="flex-1 bg-surface-container-low text-on-surface font-medium py-3 px-6 rounded-lg text-sm hover:bg-surface-container transition-all flex items-center justify-center gap-2 border border-outline-variant/20"
					>
						Sign in
					</Link>
				</div>

				{/* Social proof hint */}
				<p className="mt-8 text-xs text-on-surface-variant/60">
					Free to start · Connects with Discogs · No credit card required
				</p>
			</section>

			{/* ─── How it Works ─── */}
			<section className="relative z-10 px-6 py-20 bg-surface-container-lowest/50">
				<div className="max-w-5xl mx-auto">
					<h2 className="font-heading text-2xl md:text-3xl font-bold text-on-surface text-center mb-3">
						How it works
					</h2>
					<p className="text-sm text-on-surface-variant text-center mb-12 max-w-lg mx-auto">
						Three steps from &ldquo;I want that record&rdquo; to &ldquo;I
						found who has it.&rdquo;
					</p>

					<div className="grid md:grid-cols-3 gap-6">
						<div className="text-center">
							<div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
								<span className="font-heading text-lg font-bold text-primary">
									1
								</span>
							</div>
							<h3 className="font-heading text-base font-semibold text-on-surface mb-1">
								Import your collection
							</h3>
							<p className="text-sm text-on-surface-variant">
								Connect your Discogs account. Your library and wantlist sync
								automatically.
							</p>
						</div>
						<div className="text-center">
							<div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4">
								<span className="font-heading text-lg font-bold text-secondary">
									2
								</span>
							</div>
							<h3 className="font-heading text-base font-semibold text-on-surface mb-1">
								Discover matches
							</h3>
							<p className="text-sm text-on-surface-variant">
								The Radar scans the network and tells you who owns records from
								your wantlist.
							</p>
						</div>
						<div className="text-center">
							<div className="w-12 h-12 rounded-full bg-tertiary/10 flex items-center justify-center mx-auto mb-4">
								<span className="font-heading text-lg font-bold text-tertiary">
									3
								</span>
							</div>
							<h3 className="font-heading text-base font-semibold text-on-surface mb-1">
								Connect &amp; trade
							</h3>
							<p className="text-sm text-on-surface-variant">
								Message other diggers, compare collections, and arrange trades
								directly.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* ─── Features Grid ─── */}
			<section className="relative z-10 px-6 py-20">
				<div className="max-w-5xl mx-auto">
					<h2 className="font-heading text-2xl md:text-3xl font-bold text-on-surface text-center mb-12">
						Built for serious diggers
					</h2>

					<div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
						<FeatureCard
							icon="radar"
							title="Wantlist Radar"
							description="Get notified instantly when someone in the network has a record from your wantlist."
						/>
						<FeatureCard
							icon="diamond"
							title="Rarity Scores"
							description="Every record in your collection gets a rarity score based on global ownership data."
						/>
						<FeatureCard
							icon="groups"
							title="Digger Community"
							description="Join genre-based groups, share recent finds, and discover what other diggers are playing."
						/>
						<FeatureCard
							icon="compare_arrows"
							title="Collection Compare"
							description="See overlap and unique records between your collection and another digger's."
						/>
						<FeatureCard
							icon="inventory_2"
							title="Smart Crates"
							description="Organize your next digging session with curated crates — your personal pull list."
						/>
						<FeatureCard
							icon="verified"
							title="Trust System"
							description="Trade reputation built on verified transactions and community standing."
						/>
					</div>
				</div>
			</section>

			{/* ─── Social Proof / Stats ─── */}
			<section className="relative z-10 px-6 py-16 bg-surface-container-lowest/50">
				<div className="max-w-3xl mx-auto flex justify-center gap-12 md:gap-20">
					<StatBlock value="60M+" label="Records on Discogs" />
					<StatBlock value="∞" label="Potential matches" />
					<StatBlock value="Free" label="To get started" />
				</div>
			</section>

			{/* ─── Final CTA ─── */}
			<section className="relative z-10 px-6 py-24 text-center">
				<h2 className="font-heading text-2xl md:text-3xl font-bold text-on-surface mb-4">
					Your next find is one connection away
				</h2>
				<p className="text-sm text-on-surface-variant mb-8 max-w-md mx-auto">
					Join DigSwap and turn your wantlist into real connections with
					collectors who have what you&apos;re looking for.
				</p>
				<Link
					href="/signup"
					className="inline-flex items-center gap-2 bg-primary text-on-primary font-medium py-3 px-8 rounded-lg text-sm hover:brightness-110 transition-all shadow-lg shadow-primary/20"
				>
					Start digging — it&apos;s free
					<span className="material-symbols-outlined text-base">
						arrow_forward
					</span>
				</Link>
			</section>

			{/* ─── Footer ─── */}
			<footer className="relative z-10 px-6 py-8 border-t border-outline-variant/10">
				<div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
					<div className="flex items-center gap-1.5">
						<span className="material-symbols-outlined text-primary text-lg">
							album
						</span>
						<span className="font-heading text-sm font-semibold text-on-surface">
							DIGSWAP
						</span>
					</div>
					<div className="flex items-center gap-6 text-xs text-on-surface-variant">
						<Link href="/pricing" className="hover:text-on-surface transition-colors">
							Pricing
						</Link>
						<Link href="/signin" className="hover:text-on-surface transition-colors">
							Sign in
						</Link>
						<Link href="/signup" className="hover:text-on-surface transition-colors">
							Sign up
						</Link>
					</div>
					<p className="text-xs text-on-surface-variant/50">
						© {new Date().getFullYear()} DigSwap
					</p>
				</div>
			</footer>
		</div>
	);
}
