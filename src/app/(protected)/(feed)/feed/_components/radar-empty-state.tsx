import Link from "next/link";

export function RadarEmptyState() {
  return (
    <div className="mb-6 p-4 bg-surface-container-low border border-outline-variant/20 rounded">
      <div className="font-mono text-[10px] text-on-surface-variant mb-2 tracking-[0.15em]">
        THE_RADAR <span className="text-tertiary">// status: no signal</span>
      </div>
      <p className="font-mono text-[11px] text-on-surface mb-3">
        Connect your Discogs wantlist to activate the Radar.
      </p>
      <Link
        href="/settings"
        className="font-mono text-[10px] text-primary hover:underline"
      >
        CONNECT_DISCOGS →
      </Link>
    </div>
  );
}
