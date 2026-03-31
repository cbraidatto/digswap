"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/actions/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserAvatarMenuProps {
	displayName: string | null;
	avatarUrl: string | null;
}

function getInitials(displayName: string | null): string {
	if (!displayName) return "?";
	return displayName.charAt(0).toUpperCase();
}

export function UserAvatarMenu({ displayName, avatarUrl }: UserAvatarMenuProps) {
	const router = useRouter();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="cursor-pointer outline-none">
				<Avatar>
					{avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName ?? "User avatar"} /> : null}
					<AvatarFallback className="bg-primary text-primary-foreground">
						{getInitials(displayName)}
					</AvatarFallback>
				</Avatar>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" sideOffset={8} className="w-[200px]">
				<DropdownMenuItem onClick={() => router.push("/settings")}>Settings</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="text-destructive focus:text-destructive"
					onClick={() => signOut()}
				>
					Sign Out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
