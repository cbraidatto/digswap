import { UserAvatarMenu } from "@/components/shell/user-avatar-menu";

interface AppHeaderProps {
	displayName: string | null;
	avatarUrl: string | null;
}

export function AppHeader({ displayName, avatarUrl }: AppHeaderProps) {
	return (
		<header className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-[oklch(0.18_0.02_55/0.85)] backdrop-blur-[12px]">
			<div className="flex h-14 items-center justify-between px-4">
				<span className="font-heading text-xl font-semibold text-primary">VinylDig</span>
				<UserAvatarMenu displayName={displayName} avatarUrl={avatarUrl} />
			</div>
		</header>
	);
}
