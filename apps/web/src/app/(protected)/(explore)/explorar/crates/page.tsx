import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getPublicCrates } from "@/lib/crates/queries";

export const metadata: Metadata = {
	title: "Discover Crates — DigSwap",
	description: "Browse public crates shared by diggers in the community.",
};

export default async function ExplorarCratesPage() {
	const publicCrates = await getPublicCrates(20);

	return (
		<div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
			{/* Breadcrumb */}
			<nav className="flex items-center gap-2 font-mono text-xs text-on-surface-variant mb-6">
				<span className="text-primary">[EXPLORE]</span>
				<span>/</span>
				<Link href="/explorar" className="hover:text-primary transition-colors">
					explorar
				</Link>
				<span>/</span>
				<span className="text-on-surface">crates</span>
			</nav>

			{/* Header */}
			<div className="mb-8">
				<span className="text-xs font-mono text-primary tracking-[0.2em] uppercase">Community</span>
				<h1 className="text-3xl font-bold font-heading text-on-surface mt-1">Discover Crates</h1>
				<p className="text-sm text-on-surface-variant font-mono mt-2">
					Public crates shared by diggers — digging trips, event preps, wish lists.
				</p>
			</div>

			{/* Crate grid */}
			{publicCrates.length === 0 ? (
				<div className="bg-surface-container-low rounded-xl p-12 flex flex-col items-center gap-4 text-center border border-outline-variant/10">
					<span className="material-symbols-outlined text-5xl text-on-surface-variant/30">
						inventory_2
					</span>
					<div>
						<div className="text-xs font-mono text-primary uppercase tracking-widest mb-2">
							NO_PUBLIC_CRATES
						</div>
						<p className="text-sm text-on-surface-variant">
							No public crates yet. Be the first to share one!
						</p>
					</div>
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
					{publicCrates.map((crate) => (
						<Link
							key={crate.id}
							href={`/crates/${crate.id}`}
							className="group bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all"
						>
							{/* Cover image grid — 2×2 thumbnails */}
							<div className="grid grid-cols-2 gap-0.5 aspect-square bg-surface-container-high">
								{Array.from({ length: 4 }).map((_, i) => {
									const cover = crate.previewCovers[i];
									return (
										<div key={i} className="relative bg-surface-container-high overflow-hidden">
											{cover ? (
												<Image
													src={cover}
													alt=""
													fill
													sizes="(max-width: 640px) 25vw, (max-width: 1024px) 15vw, 10vw"
													className="object-cover"
												/>
											) : (
												<div className="absolute inset-0 flex items-center justify-center">
													<span className="material-symbols-outlined text-2xl text-on-surface-variant/20">
														album
													</span>
												</div>
											)}
										</div>
									);
								})}
							</div>

							{/* Card info */}
							<div className="p-3">
								<h2 className="font-heading text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors">
									{crate.name}
								</h2>

								{/* Owner */}
								<div className="flex items-center gap-1 mt-0.5 min-w-0">
									<span className="material-symbols-outlined text-xs text-on-surface-variant/60">
										person
									</span>
									{crate.ownerUsername ? (
										<span
											className="font-mono text-xs text-on-surface-variant truncate hover:text-primary transition-colors"
											onClick={(e) => {
												e.preventDefault();
												window.location.href = `/perfil/${crate.ownerUsername}`;
											}}
										>
											{crate.ownerDisplayName ?? crate.ownerUsername}
										</span>
									) : (
										<span className="font-mono text-xs text-on-surface-variant/50">unknown</span>
									)}
								</div>

								{/* Item count */}
								<div className="flex items-center gap-1 mt-1.5">
									<span className="material-symbols-outlined text-xs text-on-surface-variant/60">
										album
									</span>
									<span className="font-mono text-xs text-on-surface-variant">
										{crate.itemCount} {crate.itemCount === 1 ? "record" : "records"}
									</span>
								</div>
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}
