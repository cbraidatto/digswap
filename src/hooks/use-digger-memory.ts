"use client";

import useSWR from "swr";
import { getLead, saveLead } from "@/actions/leads";
import type { LeadStatus, LeadTargetType } from "@/lib/db/schema/leads";

export function useDiggerMemory(type: LeadTargetType, id: string) {
  const key = ["lead", type, id];

  const {
    data: lead,
    mutate,
    isLoading,
  } = useSWR(key, () => getLead(type, id), {
    revalidateOnFocus: false,
  });

  const save = async (note: string | null, status: LeadStatus) => {
    await saveLead(type, id, note, status);
    mutate();
  };

  return { lead: lead ?? null, save, isLoading };
}
