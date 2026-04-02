"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, type LeadStatus, type LeadTargetType } from "@/lib/db/schema/leads";
import { apiRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { saveLeadSchema, getLeadSchema, getLeadsFilterSchema } from "@/lib/validations/leads";

export async function saveLead(
  targetType: LeadTargetType,
  targetId: string,
  note: string | null,
  status: LeadStatus,
) {
  try {
    const parsed = saveLeadSchema.safeParse({ targetType, targetId, note, status });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "Not authenticated" };

    const { success: rlSuccess } = await apiRateLimit.limit(user.id);
    if (!rlSuccess) {
      return { error: "Too many requests. Please wait a moment." };
    }

    await db
      .insert(leads)
      .values({
        userId: user.id,
        targetType,
        targetId,
        note,
        status,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [leads.userId, leads.targetType, leads.targetId],
        set: { note, status, updatedAt: new Date() },
      });

    return { success: true };
  } catch (err) {
    console.error("[saveLead] error:", err);
    return { error: "Failed to save lead. Please try again." };
  }
}

export async function getLead(targetType: LeadTargetType, targetId: string) {
  try {
    const parsed = getLeadSchema.safeParse({ targetType, targetId });
    if (!parsed.success) {
      return null;
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { success: rlSuccess } = await apiRateLimit.limit(user.id);
    if (!rlSuccess) return null;

    const [lead] = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.userId, user.id),
          eq(leads.targetType, targetType),
          eq(leads.targetId, targetId),
        ),
      )
      .limit(1);

    return lead ?? null;
  } catch (err) {
    console.error("[getLead] error:", err);
    return null;
  }
}

export async function getLeads(filters?: {
  status?: LeadStatus;
  targetType?: LeadTargetType;
}) {
  try {
    const parsed = getLeadsFilterSchema.safeParse(filters);
    if (!parsed.success) {
      return [];
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const { success: rlSuccess } = await apiRateLimit.limit(user.id);
    if (!rlSuccess) return [];

    const conditions = [eq(leads.userId, user.id)];
    if (filters?.status) conditions.push(eq(leads.status, filters.status));
    if (filters?.targetType)
      conditions.push(eq(leads.targetType, filters.targetType));

    return db
      .select()
      .from(leads)
      .where(and(...conditions))
      .orderBy(leads.updatedAt);
  } catch (err) {
    console.error("[getLeads] error:", err);
    return [];
  }
}
