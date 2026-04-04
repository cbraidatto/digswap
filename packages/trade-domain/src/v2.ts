import { TRADE_STATUS, TRADE_STATUS_TRANSITIONS, type TradeStatus } from "./status";

export const MINIMUM_TRADE_AUDIO_DURATION_SECONDS = 60 as const;

export interface BilateralAcceptanceSnapshot {
	requesterAcceptedAt?: string | null;
	counterpartyAcceptedAt?: string | null;
}

export interface TradeTermsSnapshot {
	status: TradeStatus;
	termsAcceptedAt?: string | null;
	termsAcceptedByRecipientAt?: string | null;
}

export interface TradePreviewSnapshot {
	status: TradeStatus;
	previewAcceptedAt?: string | null;
	previewAcceptedByRecipientAt?: string | null;
}

export interface TradeAudioSelectionMetadata {
	durationSeconds: number;
	fileSizeBytes: number;
}

export type TradeAudioSelectionValidation =
	| { ok: true }
	| {
			ok: false;
			message: string;
			reason: "invalid_file_size" | "minimum_duration";
	  };

export function canTransitionTradeStatus(
	currentStatus: TradeStatus,
	nextStatus: TradeStatus,
): boolean {
	return TRADE_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
}

export function hasBilateralAcceptance(
	snapshot: BilateralAcceptanceSnapshot,
): boolean {
	return Boolean(
		snapshot.requesterAcceptedAt && snapshot.counterpartyAcceptedAt,
	);
}

export function canAdvanceTradeToPreviewing(
	snapshot: TradeTermsSnapshot,
): boolean {
	return (
		snapshot.status === TRADE_STATUS.LOBBY &&
		hasBilateralAcceptance({
			requesterAcceptedAt: snapshot.termsAcceptedAt,
			counterpartyAcceptedAt: snapshot.termsAcceptedByRecipientAt,
		})
	);
}

export function canAdvanceTradeToTransferring(
	snapshot: TradePreviewSnapshot,
): boolean {
	return (
		snapshot.status === TRADE_STATUS.PREVIEWING &&
		hasBilateralAcceptance({
			requesterAcceptedAt: snapshot.previewAcceptedAt,
			counterpartyAcceptedAt: snapshot.previewAcceptedByRecipientAt,
		})
	);
}

export function validateTradeAudioSelection(
	metadata: TradeAudioSelectionMetadata,
): TradeAudioSelectionValidation {
	if (!Number.isFinite(metadata.fileSizeBytes) || metadata.fileSizeBytes <= 0) {
		return {
			ok: false,
			reason: "invalid_file_size",
			message: "Audio file must have a positive file size.",
		};
	}

	if (
		!Number.isFinite(metadata.durationSeconds) ||
		metadata.durationSeconds < MINIMUM_TRADE_AUDIO_DURATION_SECONDS
	) {
		return {
			ok: false,
			reason: "minimum_duration",
			message: `Audio preview requires at least ${MINIMUM_TRADE_AUDIO_DURATION_SECONDS} seconds.`,
		};
	}

	return { ok: true };
}
