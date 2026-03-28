import { avg, count, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { tradeReviews, tradeRequests } from "@/lib/db/schema/trades";

interface TrustStripProps {
  userId: string;
  variant?: "compact" | "full";
}

export async function TrustStrip({
  userId,
  variant = "full",
}: TrustStripProps) {
  // Fetch trade reputation data server-side
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

  const metrics = [
    { label: "RESPONSE", value: `${responseRate}%` },
    { label: "COMPLETION", value: `${completionRate}%` },
    { label: "AVG_QUALITY", value: `${avgQuality}\u2605` },
    { label: "TRADES", value: String(totalTrades) },
  ];

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-3 font-mono text-[10px]">
        {metrics.map((m) => (
          <span key={m.label} className="text-on-surface-variant">
            <span className="text-on-surface-variant/60">{m.label}: </span>
            <span className="text-on-surface">{m.value}</span>
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3 p-3 bg-surface-container-low rounded border border-outline-variant/10">
      {metrics.map((m) => (
        <div key={m.label} className="text-center">
          <div className="font-mono text-[18px] font-bold text-on-surface">
            {m.value}
          </div>
          <div className="font-mono text-[9px] text-on-surface-variant tracking-[0.15em] mt-0.5">
            {m.label}
          </div>
        </div>
      ))}
    </div>
  );
}
