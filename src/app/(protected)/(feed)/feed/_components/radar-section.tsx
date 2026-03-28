import Link from "next/link";
import { getRadarMatches } from "@/lib/wantlist/radar-queries";
import { LeadAction } from "@/components/digger-memory/lead-action";
import { ContextTooltip } from "@/components/digger-memory/context-tooltip";

interface RadarSectionProps {
  userId: string;
}

function getRarityLabel(score: number | null): {
  label: string;
  colorClass: string;
} {
  if (!score) return { label: "COMMON", colorClass: "text-on-surface-variant" };
  if (score >= 80) return { label: "ULTRA_RARE", colorClass: "text-tertiary" };
  if (score >= 50) return { label: "RARE", colorClass: "text-secondary" };
  return { label: "COMMON", colorClass: "text-primary" };
}

export async function RadarSection({ userId }: RadarSectionProps) {
  const matches = await getRadarMatches(userId, { limit: 5 });

  if (matches.length === 0) {
    return (
      <div className="mb-6 p-4 bg-surface-container-low border border-outline-variant/20 rounded">
        <div className="font-mono text-[10px] text-on-surface-variant tracking-[0.15em]">
          THE_RADAR{" "}
          <span className="text-primary">// status: scanning</span>
        </div>
        <p className="font-mono text-[11px] text-on-surface-variant mt-1">
          No matches yet. The Radar fires when someone in the network has a
          record from your wantlist.
        </p>
      </div>
    );
  }

  return (
    <section className="mb-8">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-mono text-[10px] text-primary tracking-[0.2em] uppercase">
            THE_RADAR
          </span>
          <h2 className="font-heading text-xl font-bold text-on-surface mt-0.5">
            {matches.length} digger{matches.length !== 1 ? "s" : ""} have
            records from your wantlist
          </h2>
        </div>
        <Link
          href="/radar"
          className="font-mono text-[10px] text-primary hover:underline flex items-center gap-1"
        >
          VIEW_ALL_MATCHES →
        </Link>
      </div>

      {/* Match cards */}
      <div className="space-y-2">
        {matches.map((match) => {
          const rarity = getRarityLabel(match.rarityScore);
          return (
            <div
              key={`${match.matchUserId}-${match.releaseId}`}
              className="flex items-center gap-3 p-3 bg-surface-container-low border border-outline-variant/10 rounded hover:border-outline-variant/30 transition-colors"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center flex-shrink-0">
                {match.matchAvatarUrl ? (
                  <img
                    src={match.matchAvatarUrl}
                    alt={match.matchUsername ?? "user"}
                    className="w-full h-full object-cover rounded"
                  />
                ) : (
                  <span className="font-mono text-[11px] font-bold text-primary">
                    {(match.matchUsername ?? "?").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Link
                    href={`/perfil/${match.matchUsername}`}
                    className="font-mono text-[11px] text-on-surface hover:text-primary transition-colors"
                  >
                    {match.matchUsername}
                  </Link>
                  <ContextTooltip type="user" id={match.matchUserId} />
                </div>
                <div className="font-mono text-[10px] text-on-surface-variant truncate">
                  has{" "}
                  <span className="text-on-surface">{match.releaseTitle}</span>
                  {match.releaseArtist && (
                    <span> · {match.releaseArtist}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`font-mono text-[9px] ${rarity.colorClass}`}
                  >
                    [{rarity.label}]
                  </span>
                  {match.overlapCount > 1 && (
                    <span className="font-mono text-[9px] text-on-surface-variant">
                      +{match.overlapCount - 1} more from your wantlist
                    </span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <LeadAction type="user" id={match.matchUserId} />
                <Link
                  href={`/perfil/${match.matchUsername}`}
                  className="font-mono text-[10px] text-on-surface-variant hover:text-primary transition-colors px-2 py-1 rounded hover:bg-surface-container-high"
                >
                  VIEW →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
