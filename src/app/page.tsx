import Link from "next/link";

export default function Home() {
	return (
		<div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
			{/* Background dot grid */}
			<div
				className="fixed inset-0 opacity-[0.03] pointer-events-none"
				style={{
					backgroundImage: "radial-gradient(#6fdd78 1px, transparent 1px)",
					backgroundSize: "32px 32px",
				}}
			/>

			<div className="relative z-10 w-full max-w-md text-center">
				{/* Terminal prompt line */}
				<div className="mb-8 inline-flex items-center gap-2 text-primary font-mono text-xs">
					<span className="material-symbols-outlined text-sm">terminal</span>
					<span>DIGSWAP_v1.0.0</span>
					<span className="w-2 h-4 bg-primary blink inline-block" />
				</div>

				{/* Logo */}
				<h1 className="font-heading text-4xl md:text-6xl font-extrabold tracking-tighter text-on-surface mb-4">
					DIG<span className="text-primary">SWAP</span>
				</h1>

				<p className="text-on-surface-variant font-sans text-sm md:text-base mb-12">
					A social network for vinyl diggers. Import your Discogs library, discover who has
					what you&apos;re hunting for, and trade audio rips via secure P2P connections.
				</p>

				{/* CTA card */}
				<div className="w-full bg-surface-container-low rounded-xl overflow-hidden shadow-2xl border border-outline-variant/10 text-left">
					<div className="h-1 bg-primary" />
					<div className="p-6">
						<div className="font-mono text-[10px] text-on-surface-variant mb-6 space-y-1">
							<div>
								<span className="text-tertiary">MISSION</span>
								<span className="text-on-surface"> =&gt; </span>
								<span className="text-secondary">&quot;find the record you&apos;ve been hunting&quot;</span>
							</div>
							<div>
								<span className="text-tertiary">STATUS</span>
								<span className="text-on-surface"> =&gt; </span>
								<span className="text-primary">[BETA_ACTIVE]</span>
							</div>
						</div>

						<div className="flex flex-col gap-3">
							<Link
								href="/signup"
								className="w-full bg-primary-container text-on-primary-container font-mono font-bold py-3 rounded text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
							>
								<span className="material-symbols-outlined text-sm">add_circle</span>
								INITIALIZE_ACCOUNT
							</Link>
							<Link
								href="/signin"
								className="w-full bg-transparent text-on-surface-variant font-mono text-sm py-3 rounded hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 border border-outline-variant/20"
							>
								<span className="material-symbols-outlined text-sm">login</span>
								AUTHENTICATE
							</Link>
						</div>
					</div>
				</div>

				<p className="mt-8 text-[10px] font-mono text-on-surface-variant/50">
					Gamified rankings · P2P audio · Discogs integration
				</p>
			</div>
		</div>
	);
}
