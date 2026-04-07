"use client";

import { useCallback, useEffect, useState } from "react";
import { getLead, saveLead } from "@/actions/leads";
import type { Lead, LeadStatus, LeadTargetType } from "@/lib/db/schema/leads";

export function useDiggerMemory(type: LeadTargetType, id: string) {
	const [lead, setLead] = useState<Lead | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		getLead(type, id).then((result) => {
			if (!cancelled) {
				setLead(result ?? null);
				setIsLoading(false);
			}
		});
		return () => {
			cancelled = true;
		};
	}, [type, id]);

	const save = useCallback(
		async (note: string | null, status: LeadStatus) => {
			await saveLead(type, id, note, status);
			const updated = await getLead(type, id);
			setLead(updated ?? null);
		},
		[type, id],
	);

	return { lead, save, isLoading };
}
