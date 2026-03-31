import { create } from "zustand";
import type {
	DiscogsProgressPayload,
	ImportJobStatus,
	ImportJobType,
} from "@/lib/discogs/types";

interface ImportState {
	isActive: boolean;
	jobId: string | null;
	type: ImportJobType | null;
	status: ImportJobStatus | null;
	processedItems: number;
	totalItems: number;
	currentRecord: string | null;
	updateProgress: (payload: DiscogsProgressPayload) => void;
	reset: () => void;
	setActive: (jobId: string, type: ImportJobType) => void;
}

export const useImportStore = create<ImportState>((set) => ({
	isActive: false,
	jobId: null,
	type: null,
	status: null,
	processedItems: 0,
	totalItems: 0,
	currentRecord: null,

	updateProgress: (payload) =>
		set({
			isActive:
				payload.status === "processing" || payload.status === "pending",
			jobId: payload.jobId,
			type: payload.type,
			status: payload.status,
			processedItems: payload.processedItems,
			totalItems: payload.totalItems,
			currentRecord: payload.currentRecord,
		}),

	reset: () =>
		set({
			isActive: false,
			jobId: null,
			type: null,
			status: null,
			processedItems: 0,
			totalItems: 0,
			currentRecord: null,
		}),

	setActive: (jobId, type) =>
		set({ isActive: true, jobId, type, status: "processing" }),
}));
