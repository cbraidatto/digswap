import { and, asc, count, desc, eq, gt, inArray, ne, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { tradeMessages, tradeRequests } from "@/lib/db/schema/trades";
import { profiles } from "@/lib/db/schema/users";

export type TradeMessageKind = "system" | "user";

export interface TradeParticipantContext {
	counterpartyId: string;
	createdAt: string;
	isRequester: boolean;
	lastReadAt: string | null;
	requesterId: string;
	providerId: string;
	status: string;
	tradeId: string;
	updatedAt: string;
}

export interface TradeThreadMessage {
	body: string;
	createdAt: string;
	id: string;
	isOwn: boolean;
	kind: TradeMessageKind;
	senderAvatarUrl: string | null;
	senderId: string;
	senderUsername: string | null;
	tradeId: string;
}

export interface TradeThreadListItem {
	counterpartyAvatarUrl: string | null;
	counterpartyId: string;
	counterpartyUsername: string;
	createdAt: string;
	lastMessage: {
		body: string;
		createdAt: string;
		id: string;
		kind: TradeMessageKind;
		senderId: string;
	} | null;
	lastReadAt: string | null;
	status: string;
	tradeId: string;
	unreadCount: number;
	updatedAt: string;
}

export interface TradeThreadDetail extends TradeThreadListItem {
	messages: TradeThreadMessage[];
}

interface LatestMessageRow {
	body: string;
	createdAt: Date | string;
	id: string;
	kind: string;
	senderId: string;
	tradeId: string;
}

function toIsoString(value: Date | string | null | undefined) {
	if (!value) {
		return null;
	}

	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function normalizeMessageKind(value: string): TradeMessageKind {
	return value === "system" ? "system" : "user";
}

function buildUnreadCountConditions(
	context: {
		lastReadAt: string | null;
		tradeId: string;
	},
	userId: string,
) {
	const conditions = [
		eq(tradeMessages.tradeId, context.tradeId),
		ne(tradeMessages.senderId, userId),
	];

	if (context.lastReadAt) {
		conditions.push(gt(tradeMessages.createdAt, new Date(context.lastReadAt)));
	}

	return conditions;
}

export async function getTradeParticipantContext(
	tradeId: string,
	userId: string,
): Promise<TradeParticipantContext | null> {
	const rows = await db
		.select({
			createdAt: tradeRequests.createdAt,
			id: tradeRequests.id,
			providerId: tradeRequests.providerId,
			providerLastReadAt: tradeRequests.providerLastReadAt,
			requesterId: tradeRequests.requesterId,
			requesterLastReadAt: tradeRequests.requesterLastReadAt,
			status: tradeRequests.status,
			updatedAt: tradeRequests.updatedAt,
		})
		.from(tradeRequests)
		.where(
			and(
				eq(tradeRequests.id, tradeId),
				or(eq(tradeRequests.requesterId, userId), eq(tradeRequests.providerId, userId)),
			),
		)
		.limit(1);

	const row = rows[0];
	if (!row) {
		return null;
	}

	const isRequester = row.requesterId === userId;
	const counterpartyId = isRequester ? row.providerId : row.requesterId;

	return {
		counterpartyId,
		createdAt: toIsoString(row.createdAt) ?? new Date().toISOString(),
		isRequester,
		lastReadAt: toIsoString(isRequester ? row.requesterLastReadAt : row.providerLastReadAt),
		providerId: row.providerId,
		requesterId: row.requesterId,
		status: row.status,
		tradeId: row.id,
		updatedAt: toIsoString(row.updatedAt) ?? new Date().toISOString(),
	};
}

export async function getTradeUnreadCount(tradeId: string, userId: string): Promise<number> {
	const context = await getTradeParticipantContext(tradeId, userId);
	if (!context) {
		throw new Error("Trade not found or forbidden.");
	}

	const result = await db
		.select({ count: count() })
		.from(tradeMessages)
		.where(and(...buildUnreadCountConditions(context, userId)));

	return Number(result[0]?.count ?? 0);
}

export async function listTradeThreads(userId: string): Promise<TradeThreadListItem[]> {
	const participantTrades = await db
		.select({
			createdAt: tradeRequests.createdAt,
			id: tradeRequests.id,
			providerId: tradeRequests.providerId,
			providerLastReadAt: tradeRequests.providerLastReadAt,
			requesterId: tradeRequests.requesterId,
			requesterLastReadAt: tradeRequests.requesterLastReadAt,
			status: tradeRequests.status,
			updatedAt: tradeRequests.updatedAt,
		})
		.from(tradeRequests)
		.where(or(eq(tradeRequests.requesterId, userId), eq(tradeRequests.providerId, userId)));

	if (participantTrades.length === 0) {
		return [];
	}

	const contexts = participantTrades.map((trade) => {
		const isRequester = trade.requesterId === userId;
		return {
			counterpartyId: isRequester ? trade.providerId : trade.requesterId,
			createdAt: toIsoString(trade.createdAt) ?? new Date().toISOString(),
			isRequester,
			lastReadAt: toIsoString(isRequester ? trade.requesterLastReadAt : trade.providerLastReadAt),
			status: trade.status,
			tradeId: trade.id,
			updatedAt: toIsoString(trade.updatedAt) ?? new Date().toISOString(),
		};
	});

	const tradeIds = contexts.map((context) => context.tradeId);
	const counterpartyIds = [...new Set(contexts.map((context) => context.counterpartyId))];

	const [counterpartyRows, latestMessageRows] = await Promise.all([
		db
			.select({
				avatarUrl: profiles.avatarUrl,
				id: profiles.id,
				username: profiles.username,
			})
			.from(profiles)
			.where(inArray(profiles.id, counterpartyIds)),
		db
			.selectDistinctOn([tradeMessages.tradeId], {
				body: tradeMessages.body,
				createdAt: tradeMessages.createdAt,
				id: tradeMessages.id,
				kind: tradeMessages.kind,
				senderId: tradeMessages.senderId,
				tradeId: tradeMessages.tradeId,
			})
			.from(tradeMessages)
			.where(inArray(tradeMessages.tradeId, tradeIds))
			.orderBy(tradeMessages.tradeId, desc(tradeMessages.createdAt)),
	]);

	const counterpartyById = new Map(
		counterpartyRows.map((row) => [
			row.id,
			{
				avatarUrl: row.avatarUrl,
				username: row.username?.trim() || "Unknown digger",
			},
		]),
	);

	const latestMessageByTradeId = new Map(
		(latestMessageRows as LatestMessageRow[]).map((row) => [
			row.tradeId,
			{
				body: row.body,
				createdAt: toIsoString(row.createdAt) ?? new Date().toISOString(),
				id: row.id,
				kind: normalizeMessageKind(row.kind),
				senderId: row.senderId,
			},
		]),
	);

	const unreadCounts = new Map<string, number>();
	await Promise.all(
		contexts.map(async (context) => {
			const unreadCount = await getTradeUnreadCount(context.tradeId, userId);
			unreadCounts.set(context.tradeId, unreadCount);
		}),
	);

	return contexts
		.map((context) => {
			const counterparty = counterpartyById.get(context.counterpartyId);
			return {
				counterpartyAvatarUrl: counterparty?.avatarUrl ?? null,
				counterpartyId: context.counterpartyId,
				counterpartyUsername: counterparty?.username ?? "Unknown digger",
				createdAt: context.createdAt,
				lastMessage: latestMessageByTradeId.get(context.tradeId) ?? null,
				lastReadAt: context.lastReadAt,
				status: context.status,
				tradeId: context.tradeId,
				unreadCount: unreadCounts.get(context.tradeId) ?? 0,
				updatedAt: context.updatedAt,
			} satisfies TradeThreadListItem;
		})
		.sort((left, right) => {
			const leftTimestamp = left.lastMessage?.createdAt ?? left.updatedAt;
			const rightTimestamp = right.lastMessage?.createdAt ?? right.updatedAt;

			if (leftTimestamp === rightTimestamp) {
				return right.updatedAt.localeCompare(left.updatedAt);
			}

			return rightTimestamp.localeCompare(leftTimestamp);
		});
}

export async function getTradeThread(tradeId: string, userId: string): Promise<TradeThreadDetail> {
	const context = await getTradeParticipantContext(tradeId, userId);
	if (!context) {
		throw new Error("Trade not found or forbidden.");
	}

	const [counterpartyRows, latestMessageRows, messageRows, unreadCount] = await Promise.all([
		db
			.select({
				avatarUrl: profiles.avatarUrl,
				id: profiles.id,
				username: profiles.username,
			})
			.from(profiles)
			.where(eq(profiles.id, context.counterpartyId))
			.limit(1),
		db
			.selectDistinctOn([tradeMessages.tradeId], {
				body: tradeMessages.body,
				createdAt: tradeMessages.createdAt,
				id: tradeMessages.id,
				kind: tradeMessages.kind,
				senderId: tradeMessages.senderId,
				tradeId: tradeMessages.tradeId,
			})
			.from(tradeMessages)
			.where(eq(tradeMessages.tradeId, tradeId))
			.orderBy(tradeMessages.tradeId, desc(tradeMessages.createdAt)),
		db
			.select({
				body: tradeMessages.body,
				createdAt: tradeMessages.createdAt,
				id: tradeMessages.id,
				kind: tradeMessages.kind,
				senderAvatarUrl: profiles.avatarUrl,
				senderId: tradeMessages.senderId,
				senderUsername: profiles.username,
				tradeId: tradeMessages.tradeId,
			})
			.from(tradeMessages)
			.leftJoin(profiles, eq(tradeMessages.senderId, profiles.id))
			.where(eq(tradeMessages.tradeId, tradeId))
			.orderBy(asc(tradeMessages.createdAt)),
		getTradeUnreadCount(tradeId, userId),
	]);

	const counterparty = counterpartyRows[0];
	const latestMessage = (latestMessageRows as LatestMessageRow[])[0];

	return {
		counterpartyAvatarUrl: counterparty?.avatarUrl ?? null,
		counterpartyId: context.counterpartyId,
		counterpartyUsername: counterparty?.username?.trim() || "Unknown digger",
		createdAt: context.createdAt,
		lastMessage: latestMessage
			? {
					body: latestMessage.body,
					createdAt: toIsoString(latestMessage.createdAt) ?? new Date().toISOString(),
					id: latestMessage.id,
					kind: normalizeMessageKind(latestMessage.kind),
					senderId: latestMessage.senderId,
				}
			: null,
		lastReadAt: context.lastReadAt,
		messages: messageRows.map((row) => ({
			body: row.body,
			createdAt: toIsoString(row.createdAt) ?? new Date().toISOString(),
			id: row.id,
			isOwn: row.senderId === userId,
			kind: normalizeMessageKind(row.kind),
			senderAvatarUrl: row.senderAvatarUrl,
			senderId: row.senderId,
			senderUsername: row.senderUsername,
			tradeId: row.tradeId,
		})),
		status: context.status,
		tradeId: context.tradeId,
		unreadCount,
		updatedAt: context.updatedAt,
	};
}
