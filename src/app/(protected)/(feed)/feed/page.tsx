export default function FeedPage() {
	return (
		<div className="flex min-h-[calc(100vh-56px)]">
			<main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
				<header className="mb-8">
					<h1 className="font-heading text-3xl font-extrabold text-on-surface mb-2 uppercase tracking-tight">
						ARCHIVE_FEED
					</h1>
					<p className="text-on-surface-variant font-mono text-sm">
						// signals from diggers you follow will surface here
					</p>
				</header>

				<section className="bg-surface-container-low rounded-xl p-12 flex flex-col items-center justify-center text-center border border-outline-variant/10">
					<span className="material-symbols-outlined text-primary text-5xl mb-6 opacity-60">
						sensors_off
					</span>
					<div className="font-mono text-sm text-primary mb-2">
						&gt; no signals yet
					</div>
					<div className="font-mono text-xs text-on-surface-variant mb-6 max-w-sm leading-relaxed">
						follow diggers to see their finds, rips, and trades here.
						<br />
						the feed goes live once you connect.
					</div>
					<div className="font-mono text-[10px] text-outline border border-outline-variant/20 px-4 py-2 rounded">
						[AWAITING_CONNECTION]
					</div>
				</section>
			</main>
		</div>
	);
}
