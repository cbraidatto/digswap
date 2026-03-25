import Link from "next/link";
import { UserAvatarMenu } from "@/components/shell/user-avatar-menu";

interface AppHeaderProps {
	displayName: string | null;
	avatarUrl: string | null;
	xp?: number;
}

export function AppHeader({ displayName, avatarUrl, xp = 0 }: AppHeaderProps) {
	return (
		<header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center px-6 py-3 w-full border-b border-outline-variant/20 bg-surface-dim">
			<div className="flex items-center gap-8">
				<Link href="/feed">
					<span className="text-xl font-bold tracking-tighter text-primary font-heading">
						CYBER-DIGGER
					</span>
				</Link>
				<nav className="hidden md:flex gap-6 items-center">
					<Link
						href="/feed"
						className="font-mono text-xs uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
					>
						Feed
					</Link>
					<Link
						href="/comunidade"
						className="font-mono text-xs uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
					>
						Community
					</Link>
					<Link
						href="/explorar"
						className="font-mono text-xs uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
					>
						Digger
					</Link>
					<Link
						href="/perfil"
						className="font-mono text-xs uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-colors"
					>
						Profile
					</Link>
				</nav>
			</div>
			<div className="flex items-center gap-4">
				{xp > 0 && (
					<div className="hidden sm:flex items-center bg-surface-container-high px-3 py-1 rounded border border-outline-variant/20">
						<span className="font-mono text-xs text-primary uppercase tracking-wider">
							XP: {xp.toLocaleString()}
						</span>
					</div>
				)}
				<button
					type="button"
					className="p-2 text-on-surface-variant hover:bg-surface-bright transition-colors rounded"
					aria-label="Notifications"
				>
					<span className="material-symbols-outlined text-[20px]">notifications</span>
				</button>
				<UserAvatarMenu displayName={displayName} avatarUrl={avatarUrl} />
			</div>
		</header>
	);
}
