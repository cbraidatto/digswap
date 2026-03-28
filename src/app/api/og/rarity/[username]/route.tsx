import { ImageResponse } from "next/og";
import { eq, avg, count, gte, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";

// Node.js runtime — postgres driver is not edge-compatible
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> },
) {
  try {
  const { username } = await params;

  // Fetch profile
  const [profile] = await db
    .select({
      id: profiles.id,
      displayName: profiles.displayName,
      username: profiles.username,
    })
    .from(profiles)
    .where(eq(profiles.username, username))
    .limit(1);

  if (!profile) {
    return new Response("Not found", { status: 404 });
  }

  // Fetch collection stats — two simple queries, no sql template literals
  const [totalRow] = await db
    .select({ totalRecords: count(collectionItems.id), avgRarity: avg(releases.rarityScore).mapWith(Number) })
    .from(collectionItems)
    .innerJoin(releases, eq(collectionItems.releaseId, releases.id))
    .where(eq(collectionItems.userId, profile.id));

  const [ultraRareRow] = await db
    .select({ ultraRareCount: count(collectionItems.id) })
    .from(collectionItems)
    .innerJoin(releases, eq(collectionItems.releaseId, releases.id))
    .where(and(eq(collectionItems.userId, profile.id), gte(releases.rarityScore, 80)));

  const avgRarityScore = totalRow?.avgRarity ?? 0;
  const obscurityPercentile = Math.min(99, Math.round(avgRarityScore));
  const totalRecords = totalRow?.totalRecords ?? 0;
  const ultraRareCount = ultraRareRow?.ultraRareCount ?? 0;
  const avgDisplay = avgRarityScore > 0 ? avgRarityScore.toFixed(1) : "—";

  const imageOptions: ConstructorParameters<typeof ImageResponse>[1] = {
    width: 1200,
    height: 630,
  };

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          backgroundColor: "#10141a",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px",
          fontFamily: "monospace",
        }}
      >
        {/* Dot grid background */}
        <div
          style={{
            position: "absolute",
            inset: "0",
            backgroundImage: "radial-gradient(#6fdd78 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            opacity: 0.03,
          }}
        />

        {/* Top: label + username */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              color: "#6fdd78",
              fontSize: "14px",
              letterSpacing: "0.2em",
            }}
          >
            [RARITY_SCORE_CARD]
          </div>
          <div
            style={{ color: "#dfe2eb", fontSize: "48px", fontWeight: 700 }}
          >
            {profile.displayName ?? profile.username}
          </div>
          <div style={{ color: "#becab9", fontSize: "16px" }}>
            @{profile.username}
          </div>
        </div>

        {/* Middle: stats grid */}
        <div
          style={{ display: "flex", gap: "48px", alignItems: "center" }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <div
              style={{
                color: "#6fdd78",
                fontSize: "64px",
                fontWeight: 700,
              }}
            >
              {obscurityPercentile}%
            </div>
            <div
              style={{
                color: "#becab9",
                fontSize: "12px",
                letterSpacing: "0.15em",
              }}
            >
              MORE OBSCURE THAN NETWORK
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <div
                style={{
                  color: "#dfe2eb",
                  fontSize: "28px",
                  fontWeight: 600,
                }}
              >
                {totalRecords.toLocaleString()}
              </div>
              <div
                style={{
                  color: "#becab9",
                  fontSize: "11px",
                  letterSpacing: "0.12em",
                }}
              >
                RECORDS IN COLLECTION
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <div
                style={{
                  color: "#ffb689",
                  fontSize: "28px",
                  fontWeight: 600,
                }}
              >
                {ultraRareCount}
              </div>
              <div
                style={{
                  color: "#becab9",
                  fontSize: "11px",
                  letterSpacing: "0.12em",
                }}
              >
                ULTRA-RARE RECORDS
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              <div
                style={{
                  color: "#aac7ff",
                  fontSize: "28px",
                  fontWeight: 600,
                }}
              >
                {avgDisplay}
              </div>
              <div
                style={{
                  color: "#becab9",
                  fontSize: "11px",
                  letterSpacing: "0.12em",
                }}
              >
                AVG RARITY SCORE
              </div>
            </div>
          </div>
        </div>

        {/* Bottom: site URL */}
        <div
          style={{
            color: "#becab9",
            fontSize: "14px",
            letterSpacing: "0.1em",
          }}
        >
          digswap.com // find who has your Holy Grails
        </div>
      </div>
    ),
    imageOptions,
  );
  } catch (err) {
    console.error("[OG rarity] route error:", err);
    return new Response(String(err), { status: 500 });
  }
}
