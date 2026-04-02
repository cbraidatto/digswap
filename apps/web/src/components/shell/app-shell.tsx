"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/shell/app-header";
import { BottomBar } from "@/components/shell/bottom-bar";
import { Sidebar } from "@/components/shell/sidebar";
import { PlayerProvider } from "@/components/player/player-provider";
import { FloatingPlayer } from "@/components/player/floating-player";
import { usePlayerStore } from "@/lib/player/store";

const SHELL_EXCLUDED_PREFIXES = ["/onboarding", "/settings"];

interface AppShellProps {
	user: {
		id: string;
		displayName: string | null;
		avatarUrl: string | null;
		rank?: string;
		xp?: number;
		subscriptionTier?: string;
	};
	banner?: React.ReactNode;
	children: React.ReactNode;
}

export function AppShell({ user, banner, children }: AppShellProps) {
	const pathname = usePathname();
	const showShell = !SHELL_EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p));
	const hasTrack = usePlayerStore((s) => s.currentTrack !== null);

	if (!showShell) {
		return <>{children}</>;
	}

	return (
		<>
			<PlayerProvider />
			<AppHeader displayName={user.displayName} avatarUrl={user.avatarUrl} xp={user.xp} userId={user.id} />
			<Sidebar
				displayName={user.displayName}
				rank={user.rank}
				subscriptionTier={user.subscriptionTier}
			/>
			{banner}
			<main
				className="pt-14 lg:pl-64"
				style={{
					// Extra bottom padding when player is active (adds ~56px for the player bar)
					paddingBottom: hasTrack
						? "calc(64px + 56px + env(safe-area-inset-bottom, 0px))"
						: "calc(64px + env(safe-area-inset-bottom, 0px))",
				}}
			>
				{children}
			</main>
			<FloatingPlayer />
			<BottomBar />
		</>
	);
}
