export type ImportJobType = "collection" | "wantlist" | "sync";
export type ImportJobStatus = "pending" | "processing" | "completed" | "failed";

export interface ImportJob {
	id: string;
	userId: string;
	type: ImportJobType;
	status: ImportJobStatus;
	totalItems: number;
	processedItems: number;
	currentPage: number;
	totalPages: number | null;
	currentRecord: string | null;
	errorMessage: string | null;
	startedAt: Date | null;
	completedAt: Date | null;
	createdAt: Date;
}

export interface DiscogsProgressPayload {
	jobId: string;
	type: ImportJobType;
	status: ImportJobStatus;
	processedItems: number;
	totalItems: number;
	currentRecord: string | null;
}

/** Realtime channel naming convention */
export function getImportChannelName(userId: string): string {
	return `import:${userId}`;
}

/** Discogs collection item shape (from API response basic_information) */
export interface DiscogsBasicInformation {
	id: number;
	title: string;
	year: number;
	artists: Array<{ name: string; id: number }>;
	genres: string[];
	styles: string[];
	formats: Array<{ name: string; descriptions?: string[] }>;
	cover_image: string;
	thumb: string;
	resource_url: string;
}

export interface DiscogsCollectionItem {
	id: number;
	instance_id: number;
	date_added: string;
	basic_information: DiscogsBasicInformation;
}

export interface DiscogsPagination {
	page: number;
	pages: number;
	per_page: number;
	items: number;
}

export interface DiscogsCollectionResponse {
	releases: DiscogsCollectionItem[];
	pagination: DiscogsPagination;
}
