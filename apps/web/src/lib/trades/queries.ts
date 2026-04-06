import { avg, count, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tradeReviews, tradeRequests } from "@/lib/db/schema/trades";

export interface TrustMetrics {
  responseRate: number;
  completionRate: number;
  avgQuality: string;
  totalTrades: number;
}

/**
 * Fetches trade reputation metrics for a user.
 * Used by TrustStrip component — kept here so UI components
 * don't import db/schema directly.
 */
export async function getTrustMetrics(userId: string): Promise<TrustMetrics> {
  const [reviewData] = await db
    .select({
      avgQuality: avg(tradeReviews.qualityRating).mapWith(Number),
      totalReviews: count(tradeReviews.id),
    })
    .from(tradeReviews)
    .where(sql`${tradeReviews.reviewedId} = ${userId}`);

  const [requestData] = await db
    .select({
      total: count(tradeRequests.id),
      completed: sql<number>`count(*) filter (where ${tradeRequests.status} = 'completed')`,
      responded: sql<number>`count(*) filter (where ${tradeRequests.status} != 'pending' and ${tradeRequests.providerId} = ${userId})`,
      received: sql<number>`count(*) filter (where ${tradeRequests.providerId} = ${userId})`,
    })
    .from(tradeRequests)
    .where(
      sql`${tradeRequests.requesterId} = ${userId} OR ${tradeRequests.providerId} = ${userId}`,
    );

  const completionRate =
    requestData.total > 0
      ? Math.round((requestData.completed / requestData.total) * 100)
      : 0;
  const responseRate =
    requestData.received > 0
      ? Math.round((requestData.responded / requestData.received) * 100)
      : 0;
  const avgQuality = reviewData.avgQuality
    ? reviewData.avgQuality.toFixed(1)
    : "\u2014";
  const totalTrades = reviewData.totalReviews ?? 0;

  return { responseRate, completionRate, avgQuality, totalTrades };
}
