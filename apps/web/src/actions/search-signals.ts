"use server";

import { sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { searchSignals } from "@/lib/db/schema/search-signals";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
	terms: z.array(z.string().max(200)).max(50).default([]),
	genres: z.array(z.string().max(100)).max(20).default([]),
});

export async function logSearchSignal(terms: string[], genres: string[]) {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return;

		const parsed = schema.safeParse({ terms, genres });
		if (!parsed.success) return;

		// Atomic upsert using ON CONFLICT — eliminates TOCTOU race condition
		// where two concurrent requests could both insert a new row.
		// Requires unique constraint on user_id (added in migration).
		await db
			.insert(searchSignals)
			.values({
				userId: user.id,
				terms: parsed.data.terms,
				genres: parsed.data.genres,
				strength: 0.1,
			})
			.onConflictDoUpdate({
				target: searchSignals.userId,
				set: {
					terms: sql`array(SELECT DISTINCT unnest(${searchSignals.terms} || ${parsed.data.terms}::text[]))`,
					genres: sql`array(SELECT DISTINCT unnest(${searchSignals.genres} || ${parsed.data.genres}::text[]))`,
					strength: sql`LEAST(1.0, ${searchSignals.strength} + 0.1)`,
					lastReinforcedAt: new Date(),
				},
			});
	} catch (err) {
		console.error("[logSearchSignal]", err);
	}
}
