import { beforeEach, describe, expect, it, vi } from "vitest";

const TRADE_ID = "11111111-1111-4111-8111-111111111111";

let mockUser: { id: string } | null = { id: "user-1" };
let selectResults: unknown[] = [];
let insertResults: unknown[] = [];
let updateResults: unknown[] = [];

const createClientMock = vi.fn(async () => ({
	auth: {
		getUser: vi.fn(async () => ({
			data: { user: mockUser },
		})),
	},
}));
const getTradeParticipantContextMock = vi.fn();
const revalidatePathMock = vi.fn();
const insertValuesMock = vi.fn();
const updateSetMock = vi.fn();
const updateWhereMock = vi.fn();

function nextResult(queue: unknown[]) {
	if (queue.length === 0) {
		return [];
	}

	return queue.shift();
}

vi.mock("@/lib/db", () => ({
	db: {
		insert: vi.fn(() => ({
			values: insertValuesMock.mockImplementation(() => Promise.resolve(nextResult(insertResults))),
		})),
		select: vi.fn(() => {
			const chain = {
				from: vi.fn(() => chain),
				where: vi.fn(() => Promise.resolve(nextResult(selectResults))),
			};

			return chain;
		}),
		update: vi.fn(() => ({
			set: updateSetMock.mockImplementation(() => ({
				where: updateWhereMock.mockImplementation(() => Promise.resolve(nextResult(updateResults))),
			})),
		})),
	},
}));

vi.mock("@/lib/db/schema/trades", () => ({
	tradeMessages: {
		body: "body",
		createdAt: "created_at",
		id: "id",
		kind: "kind",
		senderId: "sender_id",
		tradeId: "trade_id",
	},
	tradeRequests: {
		id: "id",
		providerLastReadAt: "provider_last_read_at",
		requesterLastReadAt: "requester_last_read_at",
		updatedAt: "updated_at",
	},
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: createClientMock,
}));

vi.mock("@/lib/trades/messages", () => ({
	getTradeParticipantContext: getTradeParticipantContextMock,
}));

vi.mock("next/cache", () => ({
	revalidatePath: revalidatePathMock,
}));

const { markTradeThreadRead, sendTradeMessage } = await import("@/actions/trade-messages");

beforeEach(() => {
	mockUser = { id: "user-1" };
	selectResults = [];
	insertResults = [];
	updateResults = [];
	vi.clearAllMocks();
});

describe("sendTradeMessage", () => {
	it("rejects unauthenticated caller", async () => {
		mockUser = null;

		const result = await sendTradeMessage(TRADE_ID, "Need that rip");
		expect(result.success).toBe(false);
		expect(getTradeParticipantContextMock).not.toHaveBeenCalled();
	});

	it("rejects non-participant", async () => {
		getTradeParticipantContextMock.mockResolvedValue(null);

		const result = await sendTradeMessage(TRADE_ID, "Need that rip");
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toBe("Trade not found or forbidden.");
	});

	it("rejects empty body", async () => {
		const result = await sendTradeMessage(TRADE_ID, "   ");
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toBe("Message cannot be empty.");
		expect(getTradeParticipantContextMock).not.toHaveBeenCalled();
	});

	it("rejects body longer than 2000 chars", async () => {
		const result = await sendTradeMessage(TRADE_ID, "a".repeat(2001));
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toBe("Message is too long.");
		expect(getTradeParticipantContextMock).not.toHaveBeenCalled();
	});

	it("enforces rate limit on the 11th message within 60 seconds", async () => {
		getTradeParticipantContextMock.mockResolvedValue({
			isRequester: true,
			tradeId: TRADE_ID,
		});
		selectResults = [[{ count: 10 }]];

		const result = await sendTradeMessage(TRADE_ID, "Still there?");
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toBe("Too many messages in a short period. Please wait a moment.");
		expect(insertValuesMock).not.toHaveBeenCalled();
	});

	it("inserts a user message and updates sender read state", async () => {
		getTradeParticipantContextMock.mockResolvedValue({
			isRequester: true,
			tradeId: TRADE_ID,
		});
		selectResults = [[{ count: 0 }]];
		insertResults = [undefined];
		updateResults = [undefined];

		await sendTradeMessage(TRADE_ID, "Preview sounds clean.");

		expect(insertValuesMock).toHaveBeenCalledWith({
			body: "Preview sounds clean.",
			kind: "user",
			senderId: "user-1",
			tradeId: TRADE_ID,
		});
		expect(updateSetMock).toHaveBeenCalledWith({
			requesterLastReadAt: expect.any(Date),
			updatedAt: expect.any(Date),
		});
		expect(revalidatePathMock).toHaveBeenCalledWith("/trades");
		expect(revalidatePathMock).toHaveBeenCalledWith(`/trades/${TRADE_ID}`);
	});
});

describe("markTradeThreadRead", () => {
	it("updates requester_last_read_at when caller is requester", async () => {
		getTradeParticipantContextMock.mockResolvedValue({
			isRequester: true,
			tradeId: TRADE_ID,
		});
		updateResults = [undefined];

		await markTradeThreadRead(TRADE_ID);

		expect(updateSetMock).toHaveBeenCalledWith({
			requesterLastReadAt: expect.any(Date),
		});
		expect(revalidatePathMock).toHaveBeenCalledWith("/trades");
		expect(revalidatePathMock).toHaveBeenCalledWith(`/trades/${TRADE_ID}`);
	});

	it("updates provider_last_read_at when caller is provider", async () => {
		getTradeParticipantContextMock.mockResolvedValue({
			isRequester: false,
			tradeId: TRADE_ID,
		});
		updateResults = [undefined];

		await markTradeThreadRead(TRADE_ID);

		expect(updateSetMock).toHaveBeenCalledWith({
			providerLastReadAt: expect.any(Date),
		});
	});
});
