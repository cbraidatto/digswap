import { ImageResponse } from "next/og";

export const runtime = "edge";

// OG image route — no DB imports (WASM bundle conflict).
// Stats are passed as query params, computed server-side by the caller.
// URL: /api/og/rarity/[username]?total=N&ultra=N&avg=N.N&name=Display+Name
export async function GET(
  request: Request,
  context: { params: Promise<{ username: string }> },
) {
  const { username } = await context.params;
  const { searchParams } = new URL(request.url);

  const displayName = searchParams.get("name") ?? username;
  const totalRecords = Number(searchParams.get("total") ?? 0);
  const ultraRareCount = Number(searchParams.get("ultra") ?? 0);
  const avgRarity = Number(searchParams.get("avg") ?? 0);
  const obscurityPercentile = Math.min(99, Math.round(avgRarity));
  const avgDisplay = avgRarity > 0 ? avgRarity.toFixed(1) : "-";

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
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ color: "#6fdd78", fontSize: "14px", letterSpacing: "0.2em" }}>
            [RARITY_SCORE_CARD]
          </div>
          <div style={{ color: "#dfe2eb", fontSize: "48px", fontWeight: 700 }}>
            {displayName}
          </div>
          <div style={{ color: "#8a9099", fontSize: "16px" }}>@{username}</div>
        </div>

        <div style={{ display: "flex", gap: "48px", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ color: "#6fdd78", fontSize: "64px", fontWeight: 700 }}>
              {obscurityPercentile}%
            </div>
            <div style={{ color: "#8a9099", fontSize: "12px", letterSpacing: "0.15em" }}>
              MORE OBSCURE THAN NETWORK
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "8px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ color: "#dfe2eb", fontSize: "28px", fontWeight: 600 }}>{String(totalRecords)}</div>
              <div style={{ color: "#8a9099", fontSize: "11px", letterSpacing: "0.12em" }}>RECORDS IN COLLECTION</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ color: "#ffb689", fontSize: "28px", fontWeight: 600 }}>{String(ultraRareCount)}</div>
              <div style={{ color: "#8a9099", fontSize: "11px", letterSpacing: "0.12em" }}>ULTRA-RARE RECORDS</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ color: "#aac7ff", fontSize: "28px", fontWeight: 600 }}>{avgDisplay}</div>
              <div style={{ color: "#8a9099", fontSize: "11px", letterSpacing: "0.12em" }}>AVG RARITY SCORE</div>
            </div>
          </div>
        </div>

        <div style={{ color: "#8a9099", fontSize: "14px", letterSpacing: "0.1em" }}>
          digswap.com // find who has your Holy Grails
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
