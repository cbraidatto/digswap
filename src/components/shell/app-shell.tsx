"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/shell/app-header";
import { BottomBar } from "@/components/shell/bottom-bar";
import { Sidebar } from "@/components/shell/sidebar";

const SHELL_EXCLUDED_PREFIXES = ["/onboarding", "/settings"];

interface AppShellProps {
	user: {
		displayName: string | null;
		avatarUrl: string | null;
		rank?: string;
		xp?: number;
	};
	banner?: React.ReactNode;
	children: React.ReactNode;
}

export function AppShell({ user, banner, children }: AppShellProps) {
	const pathname = usePathname();
	const showShell = !SHELL_EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p));

	if (!showShell) {
		return <>{children}</>;
	}

	return (
		<>
			<AppHeader displayName={user.displayName} avatarUrl={user.avatarUrl} xp={user.xp} />
			<Sidebar displayName={user.displayName} rank={user.rank} />
			{banner}
			<main
				className="pt-14 lg:pl-64"
				style={{
					paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
				}}
			>
				{children}
			</main>
			<BottomBar />
		</>
	);
}
