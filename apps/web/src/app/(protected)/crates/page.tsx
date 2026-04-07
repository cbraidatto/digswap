import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCrates } from "@/lib/crates/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
	title: "Crates — DigSwap",
	description: "Organize your vinyl finds into custom crates.",
};

import { CrateCard } from "./_components/crate-card";
import { CrateEmptyState } from "./_components/crate-empty-state";
import { CratesHeader } from "./_components/crates-header";

export default async function CratesPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/signin");

	const crates = await getCrates(user.id);

	return (
		<div>
			<CratesHeader />

			{crates.length === 0 ? (
				<CrateEmptyState />
			) : (
				<div className="flex flex-col gap-3">
					{crates.map((crate) => (
						<CrateCard key={crate.id} crate={crate} />
					))}
				</div>
			)}
		</div>
	);
}
