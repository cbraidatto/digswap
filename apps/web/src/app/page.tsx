import Link from "next/link";

export default function Home() {
	return (
		<div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
			{/* Background dot grid */}
			<div
				className="fixed inset-0 opacity-[0.03] pointer-events-none"
				style={{
					backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)",
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

				{/* Headline */}
				<h1 className="font-heading text-4xl md:text-5xl font-extrabold tracking-tighter text-on-surface mb-8">
					Stop waiting for your Holy Grails to go on sale.
					<br />
					Find the diggers who actually have them.
				</h1>

				{/* Three monospace status lines */}
				<div className="mb-12 space-y-2 text-left max-w-sm mx-auto">
					<div className="font-mono text-[11px]">
						<span className="text-primary">[RADAR_ACTIVE]</span>
						<span className="text-on-surface-variant">{"    "}// wantlist matches across the network</span>
					</div>
					<div className="font-mono text-[11px]">
						<span className="text-secondary">[COLLECTION_ID]</span>
						<span className="text-on-surface-variant">{"   "}// your Discogs library, now discoverable</span>
					</div>
					<div className="font-mono text-[11px]">
						<span className="text-tertiary">[TRUST_LAYER]</span>
						<span className="text-on-surface-variant">{"    "}// verified diggers, real trades, real reputation</span>
					</div>
				</div>

				{/* CTA card */}
				<div className="w-full bg-surface-container-low rounded-xl overflow-hidden shadow-2xl border border-outline-variant/10 text-left">
					<div className="h-1 bg-primary" />
					<div className="p-6">
						<div className="flex flex-col gap-3">
							<Link
								href="/signup"
								className="w-full bg-primary-container text-on-primary-container font-mono font-bold py-3 rounded text-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
							>
								<span className="material-symbols-outlined text-sm">add_circle</span>
								START_DIGGING
							</Link>
							<Link
								href="/signin"
								className="w-full bg-transparent text-on-surface-variant font-mono text-sm py-3 rounded hover:bg-surface-container-high transition-all flex items-center justify-center gap-2 border border-outline-variant/20"
							>
								<span className="material-symbols-outlined text-sm">login</span>
								SIGN_IN
							</Link>
						</div>
					</div>
				</div>

				<p className="mt-8 font-mono text-[10px] text-on-surface-variant/50">
					<span className="text-primary">[RADAR_ACTIVE]</span>{" "}
					// wantlist matching for serious diggers
				</p>
			</div>
		</div>
	);
}
