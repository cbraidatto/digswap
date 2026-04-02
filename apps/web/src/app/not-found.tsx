import Link from "next/link";

export default function NotFound() {
	return (
		<div className="min-h-screen flex items-center justify-center p-6">
			<div className="w-full max-w-md text-center">
				<div className="w-20 h-20 mx-auto mb-6 rounded-full bg-surface-container-high flex items-center justify-center">
					<span className="material-symbols-outlined text-4xl text-muted-foreground">
						album
					</span>
				</div>

				<h1 className="font-heading text-5xl font-extrabold text-foreground mb-2">
					404
				</h1>
				<p className="text-lg text-muted-foreground mb-1">
					This record isn't in the crate
				</p>
				<p className="text-sm text-muted-foreground/60 mb-8">
					The page you're looking for doesn't exist or has been moved.
				</p>

				<Link
					href="/"
					className="inline-block bg-primary text-primary-foreground font-medium py-3 px-8 rounded-md text-sm hover:brightness-110 transition-all"
				>
					Back to home
				</Link>
			</div>
		</div>
	);
}
