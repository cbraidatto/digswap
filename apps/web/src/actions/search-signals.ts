"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { searchSignals } from "@/lib/db/schema/search-signals";
import { eq } from "drizzle-orm";
import { z } from "zod";

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

    // Upsert: reinforce existing signal or create new
    const existing = await db
      .select()
      .from(searchSignals)
      .where(eq(searchSignals.userId, user.id))
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      await db
        .update(searchSignals)
        .set({
          terms: [...new Set([...row.terms, ...parsed.data.terms])],
          genres: [...new Set([...row.genres, ...parsed.data.genres])],
          strength: Math.min(1.0, (row.strength ?? 0) + 0.1),
          lastReinforcedAt: new Date(),
        })
        .where(eq(searchSignals.userId, user.id));
    } else {
      await db.insert(searchSignals).values({
        userId: user.id,
        terms: parsed.data.terms,
        genres: parsed.data.genres,
        strength: 0.1,
      });
    }
  } catch (err) {
    console.error("[logSearchSignal]", err);
  }
}
