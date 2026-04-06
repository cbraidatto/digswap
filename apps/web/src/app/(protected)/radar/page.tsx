import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
	title: "Wantlist Radar — DigSwap",
	description: "Find diggers who have the records on your wantlist.",
};
import { getRadarMatchesPaginated } from "@/lib/wantlist/radar-queries";
import { LeadAction } from "@/components/digger-memory/lead-action";
import { ContextTooltip } from "@/components/digger-memory/context-tooltip";
import { BackButton } from "@/components/shell/back-button";
import { AddToCrateButton } from "@/components/crates/add-to-crate-button";
import { ProposeTradeButton } from "@/components/trades/ProposeTradeButton";
import Link from "next/link";

const RARITY_TIERS = [
  { value: "", label: "ALL" },
  { value: "ultra_rare", label: "ULTRA_RARE" },
  { value: "rare", label: "RARE" },
  { value: "common", label: "COMMON" },
] as const;

function getRarityLabel(score: number | null): {
  label: string;
  colorClass: string;
} {
  if (!score) return { label: "COMMON", colorClass: "text-on-surface-variant" };
  if (score >= 80) return { label: "ULTRA_RARE", colorClass: "text-tertiary" };
  if (score >= 50) return { label: "RARE", colorClass: "text-secondary" };
  return { label: "COMMON", colorClass: "text-primary" };
}

interface RadarPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function RadarPage({ searchParams }: RadarPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const params = await searchParams;
  const rarityTier = params.rarity ?? "";
  const page = Number(params.page ?? "1");

  const { matches, hasMore } = await getRadarMatchesPaginated(user.id, {
    page,
    pageSize: 20,
    rarityTier: rarityTier || undefined,
  });

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      <main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
        <header className="mb-6">
          <div className="flex items-center gap-4 mb-3">
            <BackButton />
          </div>
          <span className="font-mono text-xs text-primary tracking-[0.2em] uppercase">
            THE_RADAR
          </span>
          <h1 className="font-heading text-3xl font-extrabold text-on-surface mt-1 uppercase tracking-tight">
            ALL MATCHES
          </h1>
        </header>

        {/* Rarity tier filter chips */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          {RARITY_TIERS.map((tier) => (
            <Link
              key={tier.value}
              href={tier.value ? `/radar?rarity=${tier.value}` : "/radar"}
              className={`font-mono text-xs px-3 py-1.5 rounded border transition-colors ${
                rarityTier === tier.value
                  ? "border-primary text-primary bg-primary/10"
                  : "border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/40"
              }`}
            >
              [{tier.label}]
            </Link>
          ))}
        </div>

        {/* Match list */}
        {matches.length === 0 ? (
          <div className="font-mono text-xs text-on-surface-variant py-12 text-center">
            [NO_MATCHES] // No wantlist matches found
            {rarityTier
              ? ` in [${rarityTier.toUpperCase()}] tier`
              : ""}
            .
          </div>
        ) : (
          <div className="space-y-2">
            {matches.map((match) => {
              const rarity = getRarityLabel(match.rarityScore);
              return (
                <div
                  key={`${match.matchUserId}-${match.releaseId}`}
                  className="flex items-center gap-3 p-3 bg-surface-container-low border border-outline-variant/10 rounded hover:border-outline-variant/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {match.matchAvatarUrl ? (
                      <Image
                        src={match.matchAvatarUrl}
                        alt={match.matchUsername ?? ""}
                        width={32}
                        height={32}
                        unoptimized
                        className="w-full h-full object-cover rounded"
                      />
                    ) : (
                      <span className="font-mono text-xs font-bold text-primary">
                        {(match.matchUsername ?? "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Link
                        href={`/perfil/${match.matchUsername}`}
                        className="font-mono text-xs text-on-surface hover:text-primary transition-colors"
                      >
                        {match.matchUsername}
                      </Link>
                      <ContextTooltip type="user" id={match.matchUserId} />
                    </div>
                    <div className="font-mono text-xs text-on-surface-variant truncate">
                      has{" "}
                      {match.discogsId ? (
                        <Link href={`/release/${match.discogsId}`} className="text-on-surface hover:text-primary transition-colors">
                          {match.releaseTitle}
                        </Link>
                      ) : (
                        <span className="text-on-surface">{match.releaseTitle}</span>
                      )}
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
                          +{match.overlapCount - 1} more wantlist matches
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <AddToCrateButton
                      releaseId={match.releaseId ?? null}
                      discogsId={match.discogsId ?? null}
                      title={match.releaseTitle ?? null}
                      artist={match.releaseArtist ?? null}
                      coverImageUrl={null}
                    />
                    <ProposeTradeButton
                      providerId={match.matchUserId}
                      releaseId={match.releaseId ?? undefined}
                      compact
                    />
                    <LeadAction type="user" id={match.matchUserId} />
                    <Link
                      href={`/perfil/${match.matchUsername}`}
                      className="font-mono text-xs text-on-surface-variant hover:text-primary px-2 py-1 rounded hover:bg-surface-container-high"
                    >
                      VIEW →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Simple page navigation */}
        <div className="flex items-center gap-4 mt-8 font-mono text-xs">
          {page > 1 && (
            <Link
              href={`/radar?${rarityTier ? `rarity=${rarityTier}&` : ""}page=${page - 1}`}
              className="text-primary hover:underline"
            >
              ← PREV
            </Link>
          )}
          {hasMore && (
            <Link
              href={`/radar?${rarityTier ? `rarity=${rarityTier}&` : ""}page=${page + 1}`}
              className="text-primary hover:underline"
            >
              NEXT →
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
