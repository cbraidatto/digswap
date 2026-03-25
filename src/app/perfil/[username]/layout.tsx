import Link from "next/link";

export default function PublicProfileLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="min-h-screen bg-background">
			<header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 py-3 border-b border-outline-variant/20 bg-surface-dim">
				<Link href="/">
					<span className="text-xl font-bold tracking-tighter text-primary font-heading">
						CYBER-DIGGER
					</span>
				</Link>
				<Link
					href="/signin"
					className="font-mono text-xs uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
				>
					Sign In
				</Link>
			</header>
			<main className="pt-14 pb-8">{children}</main>
		</div>
	);
}
