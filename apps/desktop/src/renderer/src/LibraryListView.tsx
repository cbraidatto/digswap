import React from "react";
import type { LibraryTrack, MetadataConfidence } from "../../shared/ipc-types";

interface Props {
  tracks: LibraryTrack[];
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatBitrate(bitrate: number): string {
  // bitrate may be in bps (e.g. 1411200) or kbps (e.g. 1411)
  const kbps = bitrate > 10000 ? Math.round(bitrate / 1000) : bitrate;
  return `${kbps} kbps`;
}

function InferredCell({
  value,
  confidence,
  className = "",
}: {
  value: string | null;
  confidence: MetadataConfidence;
  className?: string;
}) {
  if (!value) return <span className={`text-[#4a4035] ${className}`}>--</span>;

  if (confidence === "low") {
    return (
      <span
        className={`text-[#8b7355] italic ${className}`}
        title="Inferido do caminho do arquivo"
      >
        {value}
      </span>
    );
  }

  return <span className={className}>{value}</span>;
}

export function LibraryListView({ tracks }: Props) {
  return (
    <div className="overflow-auto flex-1">
      {/* Header */}
      <div className="flex items-center px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#4a4035] bg-[#111008] sticky top-0 z-10 border-b border-[#2a2218]/50">
        <div className="flex-1 min-w-[200px]">Titulo</div>
        <div className="w-[180px]">Artista</div>
        <div className="w-[180px]">Album</div>
        <div className="w-[60px] text-center">Formato</div>
        <div className="w-[80px] text-right">Bitrate</div>
        <div className="w-[60px] text-right">Duracao</div>
      </div>

      {/* Rows */}
      {tracks.map((track) => (
        <div
          key={track.id}
          className="flex items-center px-4 py-2 border-b border-[#2a2218]/50 hover:bg-[#111008]/50 text-sm"
        >
          <div className="flex-1 min-w-[200px] truncate">
            <InferredCell
              value={track.title}
              confidence={track.titleConfidence}
              className="text-[#e8dcc8]"
            />
          </div>
          <div className="w-[180px] truncate">
            <InferredCell
              value={track.artist}
              confidence={track.artistConfidence}
              className="text-[#e8dcc8]"
            />
          </div>
          <div className="w-[180px] truncate">
            <InferredCell
              value={track.album}
              confidence={track.albumConfidence}
              className="text-[#7a6e5f]"
            />
          </div>
          <div className="w-[60px] text-center text-xs font-mono text-[#4a4035]">
            {track.format}
          </div>
          <div className="w-[80px] text-right text-xs font-mono text-[#4a4035]">
            {formatBitrate(track.bitrate)}
          </div>
          <div className="w-[60px] text-right text-xs font-mono text-[#4a4035]">
            {formatDuration(track.duration)}
          </div>
        </div>
      ))}
    </div>
  );
}
