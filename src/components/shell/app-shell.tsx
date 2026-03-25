"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "@/components/shell/app-header";
import { BottomBar } from "@/components/shell/bottom-bar";

const SHELL_EXCLUDED_PREFIXES = ["/onboarding", "/settings"];

interface AppShellProps {
	user: {
		displayName: string | null;
		avatarUrl: string | null;
	};
	children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
	const pathname = usePathname();
	const showShell = !SHELL_EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p));

	if (!showShell) {
		return <>{children}</>;
	}

	return (
		<>
			<AppHeader displayName={user.displayName} avatarUrl={user.avatarUrl} />
			<main
				className="pt-14 px-4"
				style={{
					paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
				}}
			>
				<div className="mx-auto max-w-[640px]">{children}</div>
			</main>
			<BottomBar />
		</>
	);
}
