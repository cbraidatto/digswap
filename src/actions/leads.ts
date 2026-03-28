"use server";

import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { leads, type LeadStatus, type LeadTargetType } from "@/lib/db/schema/leads";
import { createClient } from "@/lib/supabase/server";

export async function saveLead(
  targetType: LeadTargetType,
  targetId: string,
  note: string | null,
  status: LeadStatus,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

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
}

export async function getLead(targetType: LeadTargetType, targetId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

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
}

export async function getLeads(filters?: {
  status?: LeadStatus;
  targetType?: LeadTargetType;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const conditions = [eq(leads.userId, user.id)];
  if (filters?.status) conditions.push(eq(leads.status, filters.status));
  if (filters?.targetType)
    conditions.push(eq(leads.targetType, filters.targetType));

  return db
    .select()
    .from(leads)
    .where(and(...conditions))
    .orderBy(leads.updatedAt);
}
