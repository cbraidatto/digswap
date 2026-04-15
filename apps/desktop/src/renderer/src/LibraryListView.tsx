import React, { useState } from "react";
import type { LibraryTrack, MetadataConfidence } from "../../shared/ipc-types";

interface Props {
  tracks: LibraryTrack[];
  onTrackFieldUpdate?: (trackId: string, field: string, value: string | number | null) => void;
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
  onEdit,
}: {
  value: string | null;
  confidence: MetadataConfidence;
  className?: string;
  onEdit?: (newValue: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? "");

  if (!value) return <span className={`text-[#4a4035] ${className}`}>--</span>;

  if (editing) {
    return (
      <input
        autoFocus
        className="bg-[#0d0d0d] border border-[#c8914a]/50 rounded px-2 py-1 text-sm text-[#e8dcc8] outline-none focus:border-[#c8914a] min-w-0"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onEdit?.(editValue);
            setEditing(false);
          }
          if (e.key === "Escape") {
            setEditValue(value);
            setEditing(false);
          }
        }}
        onBlur={() => {
          onEdit?.(editValue);
          setEditing(false);
        }}
      />
    );
  }

  if (confidence === "ai") {
    return (
      <span
        className={`text-[#c8914a] ${className} cursor-pointer`}
        title="Inferido por IA — clique para editar"
        onClick={() => { setEditValue(value); setEditing(true); }}
      >
        <svg className="inline w-3 h-3 mr-1 opacity-60" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0l2 5h5l-4 3 2 5-5-3-5 3 2-5-4-3h5z" />
        </svg>
        {value}
      </span>
    );
  }

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

export function LibraryListView({ tracks, onTrackFieldUpdate }: Props) {
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
              onEdit={(val) => onTrackFieldUpdate?.(track.id, "title", val)}
            />
          </div>
          <div className="w-[180px] truncate">
            <InferredCell
              value={track.artist}
              confidence={track.artistConfidence}
              className="text-[#e8dcc8]"
              onEdit={(val) => onTrackFieldUpdate?.(track.id, "artist", val)}
            />
          </div>
          <div className="w-[180px] truncate">
            <InferredCell
              value={track.album}
              confidence={track.albumConfidence}
              className="text-[#7a6e5f]"
              onEdit={(val) => onTrackFieldUpdate?.(track.id, "album", val)}
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
