import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";
import { createClient } from "@/lib/supabase/server";

export default async function PerfilPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/signin");
	}

	const [profile] = await db
		.select({
			displayName: profiles.displayName,
			avatarUrl: profiles.avatarUrl,
		})
		.from(profiles)
		.where(eq(profiles.id, user.id))
		.limit(1);

	const displayName = profile?.displayName ?? "Digger";
	const avatarUrl = profile?.avatarUrl ?? null;
	const initials = displayName.charAt(0).toUpperCase();

	return (
		<div className="flex flex-col items-center pt-12">
			<Avatar size="lg" className="size-20">
				{avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
				<AvatarFallback className="bg-primary text-primary-foreground text-2xl">
					{initials}
				</AvatarFallback>
			</Avatar>
			<h1 className="mt-4 font-heading text-xl font-semibold text-foreground">{displayName}</h1>
			<Link href="/settings" className="mt-2 text-base text-muted-foreground hover:underline">
				Account settings
			</Link>
		</div>
	);
}
