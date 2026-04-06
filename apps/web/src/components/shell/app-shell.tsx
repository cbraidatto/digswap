"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/shell/app-header";
import { BottomBar } from "@/components/shell/bottom-bar";
import { PlayerProvider } from "@/components/player/player-provider";
import { FloatingPlayer } from "@/components/player/floating-player";
import { usePlayerStore } from "@/lib/player/store";
import { ChatSidebar } from "@/components/chat/chat-sidebar";

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
		return (
			<>
				{/* Keep player alive even on shell-excluded routes (settings, onboarding)
				    so music doesn't restart when navigating back */}
				<PlayerProvider />
				{children}
			</>
		);
	}

	return (
		<>
			<PlayerProvider />
			<AppHeader displayName={user.displayName} avatarUrl={user.avatarUrl} xp={user.xp} userId={user.id} />
			{banner}
			<main
				className="pt-14"
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
			<ChatSidebar />
			<BottomBar />
		</>
	);
}
