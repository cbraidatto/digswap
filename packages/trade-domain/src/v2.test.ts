import { describe, expect, it } from "vitest";
import { TRADE_STATUS } from "./status";
import {
	MINIMUM_TRADE_AUDIO_DURATION_SECONDS,
	canAdvanceTradeToPreviewing,
	canAdvanceTradeToTransferring,
	canTransitionTradeStatus,
	hasBilateralAcceptance,
	validateTradeAudioSelection,
} from "./v2";

describe("Trade V2 domain helpers", () => {
	it("allows only declared status transitions", () => {
		expect(
			canTransitionTradeStatus(TRADE_STATUS.PENDING, TRADE_STATUS.LOBBY),
		).toBe(true);
		expect(
			canTransitionTradeStatus(
				TRADE_STATUS.PREVIEWING,
				TRADE_STATUS.ACCEPTED,
			),
		).toBe(true);
		expect(
			canTransitionTradeStatus(
				TRADE_STATUS.ACCEPTED,
				TRADE_STATUS.TRANSFERRING,
			),
		).toBe(true);
		expect(
			canTransitionTradeStatus(
				TRADE_STATUS.TRANSFERRING,
				TRADE_STATUS.COMPLETED,
			),
		).toBe(true);
	});

	it("rejects invalid or terminal status transitions", () => {
		expect(
			canTransitionTradeStatus(
				TRADE_STATUS.PENDING,
				TRADE_STATUS.TRANSFERRING,
			),
		).toBe(false);
		expect(
			canTransitionTradeStatus(
				TRADE_STATUS.TRANSFERRING,
				TRADE_STATUS.PREVIEWING,
			),
		).toBe(false);
		expect(
			canTransitionTradeStatus(
				TRADE_STATUS.COMPLETED,
				TRADE_STATUS.PENDING,
			),
		).toBe(false);
	});

	it("requires both timestamps for a bilateral acceptance gate", () => {
		expect(
			hasBilateralAcceptance({
				requesterAcceptedAt: "2026-04-02T10:00:00.000Z",
				counterpartyAcceptedAt: "2026-04-02T10:01:00.000Z",
			}),
		).toBe(true);

		expect(
			hasBilateralAcceptance({
				requesterAcceptedAt: "2026-04-02T10:00:00.000Z",
				counterpartyAcceptedAt: null,
			}),
		).toBe(false);
	});

	it("only advances to previewing when the lobby has bilateral term acceptance", () => {
		expect(
			canAdvanceTradeToPreviewing({
				status: TRADE_STATUS.LOBBY,
				termsAcceptedAt: "2026-04-02T10:00:00.000Z",
				termsAcceptedByRecipientAt: "2026-04-02T10:01:00.000Z",
			}),
		).toBe(true);

		expect(
			canAdvanceTradeToPreviewing({
				status: TRADE_STATUS.PENDING,
				termsAcceptedAt: "2026-04-02T10:00:00.000Z",
				termsAcceptedByRecipientAt: "2026-04-02T10:01:00.000Z",
			}),
		).toBe(false);

		expect(
			canAdvanceTradeToPreviewing({
				status: TRADE_STATUS.LOBBY,
				termsAcceptedAt: "2026-04-02T10:00:00.000Z",
				termsAcceptedByRecipientAt: null,
			}),
		).toBe(false);
	});

	it("only advances to transferring when preview acceptance is bilateral", () => {
		expect(
			canAdvanceTradeToTransferring({
				status: TRADE_STATUS.PREVIEWING,
				previewAcceptedAt: "2026-04-02T10:02:00.000Z",
				previewAcceptedByRecipientAt: "2026-04-02T10:03:00.000Z",
			}),
		).toBe(true);

		expect(
			canAdvanceTradeToTransferring({
				status: TRADE_STATUS.ACCEPTED,
				previewAcceptedAt: "2026-04-02T10:02:00.000Z",
				previewAcceptedByRecipientAt: "2026-04-02T10:03:00.000Z",
			}),
		).toBe(false);

		expect(
			canAdvanceTradeToTransferring({
				status: TRADE_STATUS.PREVIEWING,
				previewAcceptedAt: "2026-04-02T10:02:00.000Z",
				previewAcceptedByRecipientAt: null,
			}),
		).toBe(false);
	});

	it("rejects files without a positive file size", () => {
		expect(
			validateTradeAudioSelection({
				durationSeconds: MINIMUM_TRADE_AUDIO_DURATION_SECONDS,
				fileSizeBytes: 0,
			}),
		).toEqual({
			ok: false,
			reason: "invalid_file_size",
			message: "Audio file must have a positive file size.",
		});
	});

	it("rejects files shorter than the minimum preview duration", () => {
		expect(
			validateTradeAudioSelection({
				durationSeconds: MINIMUM_TRADE_AUDIO_DURATION_SECONDS - 1,
				fileSizeBytes: 1024,
			}),
		).toEqual({
			ok: false,
			reason: "minimum_duration",
			message: `Audio preview requires at least ${MINIMUM_TRADE_AUDIO_DURATION_SECONDS} seconds.`,
		});
	});

	it("accepts files that satisfy duration and size requirements", () => {
		expect(
			validateTradeAudioSelection({
				durationSeconds: MINIMUM_TRADE_AUDIO_DURATION_SECONDS,
				fileSizeBytes: 5 * 1024 * 1024,
			}),
		).toEqual({ ok: true });
	});
});
